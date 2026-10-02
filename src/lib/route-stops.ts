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
