// Regra única para localizar uma entrega (usada pelo mapa do detalhe da rota
// e pela coluna "Distância (km)" da listagem), para que os números batam.
// Ordem: coordenada do pedido → localização do cliente → bairro → cidade.
import { getOrderCoord } from "@/lib/order-coords";
import { chaveLocalidade, type Localidade } from "@/lib/geo-localidades.functions";

type MaybeNum = number | string | null | undefined;

export type CoordFonte = "order" | "customer" | "bairro" | "cidade";
export type CoordResolvida = { lat: number; lng: number; source: CoordFonte };
export type LocalidadePedido = { uf: string | null; cidade: string | null; bairro: string | null };
export type GeoPonto = { lat: number | null; lng: number | null };

/** Coordenada exata (pedido ou cliente), sem aproximação. */
export function coordExata(o: {
  delivery_latitude?: MaybeNum;
  delivery_longitude?: MaybeNum;
  customer_geo?: { latitude?: MaybeNum; longitude?: MaybeNum } | null;
}): CoordResolvida | null {
  const c = getOrderCoord(o);
  return c ? { lat: c.lat, lng: c.lng, source: c.source } : null;
}

/** Localidades (bairro e cidade) a consultar para aproximar um pedido. */
export function localidadesParaAproximar(d: LocalidadePedido | null | undefined): Localidade[] {
  if (!d?.uf || !d.cidade) return [];
  return [
    { uf: d.uf, cidade: d.cidade, bairro: d.bairro ?? "" },
    { uf: d.uf, cidade: d.cidade, bairro: "" },
  ];
}

/** Aproxima pelo centroide do bairro; se não houver, pelo da cidade. */
export function aproximarPorLocalidade(
  d: LocalidadePedido | null | undefined,
  geoMap: Map<string, GeoPonto>,
): CoordResolvida | null {
  if (!d?.uf || !d.cidade) return null;
  const b = d.bairro ? geoMap.get(chaveLocalidade({ uf: d.uf, cidade: d.cidade, bairro: d.bairro })) : undefined;
  if (b?.lat != null && b.lng != null) return { lat: b.lat, lng: b.lng, source: "bairro" };
  const c = geoMap.get(chaveLocalidade({ uf: d.uf, cidade: d.cidade, bairro: "" }));
  if (c?.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng, source: "cidade" };
  return null;
}

type LatLng = { lat: number; lng: number };
type ComputeFn = (args: { data: { origin: LatLng; destination: LatLng; waypoints: LatLng[] } }) => Promise<{
  encodedPolyline: string | null;
  distanceMeters: number;
}>;

/** Fator para converter linha reta em distância rodoviária estimada. */
const FATOR_RODOVIARIO = 1.3;

function haversineMetros(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type TrajetoCalculado = {
  metros: number;
  /** Trechos que o Google não conseguiu traçar e foram estimados em linha reta. */
  trechosEstimados: number;
  polylines: string[];
  /** Trechos desenhados em linha reta (sem polyline). */
  linhasRetas: LatLng[][];
};

/**
 * Distância rodoviária de um trajeto (regra única do mapa e da listagem).
 * Tenta em blocos de até 25 pontos; se o Google não traçar um bloco (algum
 * ponto sem estrada), refaz trecho a trecho e estima em linha reta (×1,3)
 * apenas os trechos que continuarem sem rota.
 */
export async function calcularTrajeto(
  pontos: LatLng[],
  compute: ComputeFn,
  cancelado: () => boolean = () => false,
): Promise<TrajetoCalculado> {
  const out: TrajetoCalculado = { metros: 0, trechosEstimados: 0, polylines: [], linhasRetas: [] };
  if (pontos.length < 2) return out;
  const MAX = 25;
  const tentar = async (seg: LatLng[]) => {
    try {
      const r = await compute({
        data: { origin: seg[0], destination: seg[seg.length - 1], waypoints: seg.slice(1, -1) },
      });
      return r.distanceMeters > 0 ? r : null;
    } catch (err) {
      console.warn("[calcularTrajeto] Routes API falhou:", err);
      return null;
    }
  };
  for (let i = 0; i < pontos.length - 1; i += MAX - 1) {
    if (cancelado()) return out;
    const seg = pontos.slice(i, i + MAX);
    const r = await tentar(seg);
    if (r) {
      out.metros += r.distanceMeters;
      if (r.encodedPolyline) out.polylines.push(r.encodedPolyline);
      continue;
    }
    for (let j = 0; j < seg.length - 1; j++) {
      if (cancelado()) return out;
      const leg = [seg[j], seg[j + 1]];
      const rl = seg.length > 2 ? await tentar(leg) : null;
      if (rl) {
        out.metros += rl.distanceMeters;
        if (rl.encodedPolyline) out.polylines.push(rl.encodedPolyline);
      } else {
        out.metros += haversineMetros(leg[0], leg[1]) * FATOR_RODOVIARIO;
        out.trechosEstimados++;
        out.linhasRetas.push(leg);
      }
    }
  }
  return out;
}
