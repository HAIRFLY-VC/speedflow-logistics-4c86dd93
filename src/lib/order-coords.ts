// Helper client-safe para resolver a coordenada efetiva de entrega de um pedido.
// Se o pedido tiver delivery_latitude/longitude (vindo de OBS_LOGIST do ERP),
// usa essas; caso contrário, usa a latitude/longitude cadastrada no cliente.

export type CoordSource = { lat: number; lng: number; source: "order" | "customer" };

type MaybeNum = number | string | null | undefined;

function toNum(v: MaybeNum): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getOrderCoord(order: {
  delivery_latitude?: MaybeNum;
  delivery_longitude?: MaybeNum;
  customers?: { latitude?: MaybeNum; longitude?: MaybeNum } | null;
  customer_geo?: { latitude?: MaybeNum; longitude?: MaybeNum } | null;
}): CoordSource | null {
  const dLat = toNum(order.delivery_latitude);
  const dLng = toNum(order.delivery_longitude);
  if (dLat !== null && dLng !== null) {
    return { lat: dLat, lng: dLng, source: "order" };
  }
  const c = order.customers ?? order.customer_geo;
  if (c) {
    const cLat = toNum(c.latitude);
    const cLng = toNum(c.longitude);
    if (cLat !== null && cLng !== null) {
      return { lat: cLat, lng: cLng, source: "customer" };
    }
  }
  return null;
}
