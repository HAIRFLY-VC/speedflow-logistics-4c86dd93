// Coleta de volumes / peso bruto das NF-es referenciadas em um CT-e.
// Os dados vêm do XML da NF-e (bloco <vol>), baixado pelo robô e guardado no
// bucket `nfe-xml`. Quando a NF-e ainda não foi baixada, é criada uma
// solicitação para o robô buscá-la na SEFAZ.
import { centralDb } from "@/lib/central-db";

export type NfeVolumeInfo = {
  chave: string;
  numero: string | null;
  volumes: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  especie: string | null;
  status: "DISPONIVEL" | "PENDENTE" | "PROCESSANDO" | "ERRO" | "AUSENTE";
  mensagem: string | null;
};

const digits = (v: string) => v.replace(/\D/g, "");

/** Cria solicitações de download para as NF-es do CT-e que ainda não temos. */
export async function solicitarNfesDoCte(
  chaves: string[],
  solicitadoPor: string | null = null,
): Promise<number> {
  const alvos = Array.from(new Set(chaves.map(digits).filter((c) => c.length === 44)));
  if (alvos.length === 0) return 0;

  const { data: existentes } = await centralDb
    .from("nfes")
    .select("chave_acesso")
    .in("chave_acesso", alvos);
  const temXml = new Set((existentes ?? []).map((n) => n.chave_acesso));

  const { data: solicitadas } = await centralDb
    .from("nfe_solicitacoes")
    .select("chave_acesso, status")
    .in("chave_acesso", alvos);
  const jaSolicitadas = new Set(
    (solicitadas ?? [])
      .filter((s) => s.status !== "ERRO")
      .map((s) => s.chave_acesso),
  );

  const novas = alvos.filter((c) => !temXml.has(c) && !jaSolicitadas.has(c));
  if (novas.length === 0) return 0;

  await centralDb.from("nfe_solicitacoes").insert(
    novas.map((chave) => ({
      chave_acesso: chave,
      status: "PENDENTE" as const,
      solicitado_por: solicitadoPor,
    })),
  );
  return novas.length;
}

/** Lê volumes e peso bruto de cada NF-e informada, a partir do XML armazenado. */
export async function coletarVolumesNfes(chaves: string[]): Promise<NfeVolumeInfo[]> {
  const alvos = Array.from(new Set(chaves.map(digits).filter((c) => c.length === 44)));
  if (alvos.length === 0) return [];

  const [{ data: nfes }, { data: sols }] = await Promise.all([
    centralDb
      .from("nfes")
      .select("chave_acesso, numero, peso_bruto, xml_storage_path")
      .in("chave_acesso", alvos),
    centralDb
      .from("nfe_solicitacoes")
      .select("chave_acesso, status, mensagem")
      .in("chave_acesso", alvos),
  ]);

  const nfeMap = new Map((nfes ?? []).map((n) => [n.chave_acesso, n]));
  const solMap = new Map((sols ?? []).map((s) => [s.chave_acesso, s]));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { parseNfeXml } = await import("./nfe-parse.server");

  const out: NfeVolumeInfo[] = [];
  for (const chave of alvos) {
    const nfe = nfeMap.get(chave);
    const sol = solMap.get(chave);

    if (!nfe) {
      out.push({
        chave,
        numero: null,
        volumes: null,
        peso_bruto: null,
        peso_liquido: null,
        especie: null,
        status:
          sol?.status === "PROCESSANDO"
            ? "PROCESSANDO"
            : sol?.status === "ERRO"
              ? "ERRO"
              : sol
                ? "PENDENTE"
                : "AUSENTE",
        mensagem: sol?.mensagem ?? null,
      });
      continue;
    }

    let volumes: number | null = null;
    let pesoLiquido: number | null = null;
    let especie: string | null = null;
    let pesoBruto = nfe.peso_bruto == null ? null : Number(nfe.peso_bruto);

    if (nfe.xml_storage_path) {
      try {
        const { data: file } = await supabaseAdmin.storage
          .from("nfe-xml")
          .download(nfe.xml_storage_path);
        if (file) {
          const parsed = parseNfeXml(await file.text());
          volumes = parsed.volumes;
          pesoLiquido = parsed.peso_liquido;
          especie = parsed.especie_volumes;
          if (parsed.peso_bruto != null) pesoBruto = parsed.peso_bruto;
        }
      } catch {
        // mantém o que já está gravado na NF-e
      }
    }

    out.push({
      chave,
      numero: nfe.numero,
      volumes,
      peso_bruto: pesoBruto,
      peso_liquido: pesoLiquido,
      especie,
      status: "DISPONIVEL",
      mensagem: null,
    });
  }

  return out;
}
