import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { centralDb } from "@/lib/central-db";

/**
 * Localiza bairros/cidades pelo Google Maps (com cache no banco central).
 * Usado como aproximação de distância quando o endereço exato não foi localizado.
 */
export type Localidade = { uf: string; cidade: string; bairro: string };
export type LocalidadeGeo = Localidade & { chave: string; lat: number | null; lng: number | null };

const norm = (v: string) => (v ?? "").trim().toUpperCase();
export const chaveLocalidade = (l: Localidade) => `${norm(l.uf)}|${norm(l.cidade)}|${norm(l.bairro)}`;

const MAX_NOVAS = 50;
const CONCORRENCIA = 5;

async function geocodificar(l: Localidade): Promise<{ lat: number; lng: number } | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gmKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !gmKey) return null;
  const endereco = [l.bairro, l.cidade, l.uf, "Brasil"].filter((s) => s && s.trim()).join(", ");
  const comps = `country:BR|administrative_area:${encodeURIComponent(l.uf)}`;
  const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&components=${comps}&region=br&language=pt-BR`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmKey },
  });
  if (!res.ok) {
    console.warn(`[geo-localidades] geocode ${res.status}: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    status: string;
    results?: { geometry: { location: { lat: number; lng: number } }; address_components?: { short_name: string; types: string[] }[] }[];
  };
  const r = json.results?.[0];
  if (json.status !== "OK" || !r) return null;
  // Confere se o resultado está na UF pedida.
  const ufRes = r.address_components?.find((c) => c.types.includes("administrative_area_level_1"))?.short_name;
  if (ufRes && norm(ufRes) !== norm(l.uf)) return null;
  return r.geometry.location;
}

export const localizarLocalidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { localidades: Localidade[] }) => {
    const lista = (input?.localidades ?? [])
      .filter((l) => l && typeof l.uf === "string" && typeof l.cidade === "string" && l.uf.trim() && l.cidade.trim())
      .slice(0, 2000)
      .map((l) => ({ uf: norm(l.uf).slice(0, 2), cidade: norm(l.cidade).slice(0, 120), bairro: norm(l.bairro ?? "").slice(0, 120) }));
    return { localidades: lista };
  })
  .handler(async ({ data }): Promise<LocalidadeGeo[]> => {
    const unicas = new Map<string, Localidade>();
    for (const l of data.localidades) unicas.set(chaveLocalidade(l), l);
    const chaves = [...unicas.keys()];
    const resultado = new Map<string, LocalidadeGeo>();

    let cacheOk = true;
    for (let i = 0; i < chaves.length; i += 200) {
      const { data: rows, error } = await (centralDb as any)
        .schema("speedflow")
        .from("geo_localidades")
        .select("chave, uf, cidade, bairro, lat, lng")
        .in("chave", chaves.slice(i, i + 200));
      if (error) {
        cacheOk = false;
        console.warn("[geo-localidades] cache indisponível:", error.message);
        break;
      }
      for (const r of rows ?? []) resultado.set(r.chave, r);
    }

    const faltando = chaves.filter((c) => !resultado.has(c)).slice(0, MAX_NOVAS);
    const novas: LocalidadeGeo[] = [];
    for (let i = 0; i < faltando.length; i += CONCORRENCIA) {
      await Promise.all(
        faltando.slice(i, i + CONCORRENCIA).map(async (chave) => {
          const l = unicas.get(chave)!;
          try {
            const geo = await geocodificar(l);
            const item = { chave, ...l, lat: geo?.lat ?? null, lng: geo?.lng ?? null };
            resultado.set(chave, item);
            novas.push(item);
          } catch (err) {
            console.warn("[geo-localidades] falha", chave, err);
          }
        }),
      );
    }
    if (cacheOk && novas.length) {
      const { error } = await (centralDb as any)
        .schema("speedflow")
        .from("geo_localidades")
        .upsert(novas.map((n) => ({ ...n, fonte: "google", atualizado_em: new Date().toISOString() })));
      if (error) console.warn("[geo-localidades] falha ao gravar cache:", error.message);
    }
    return [...resultado.values()];
  });
