import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


const UNROUTED_DATE = "4000-01-01";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type Coord = { lat: number; lng: number };

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function ensureStaff(context: { supabase: any; userId: string }) {
  const roles = ["adm", "gestor", "operador"] as const;
  for (const r of roles) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: r,
    });
    if (data) return;
  }
  throw new Error("Sem permissão para sugerir rotas");
}

async function geocodeAddress(query: string): Promise<Coord | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmKey) throw new Error("Google Maps connector não configurado");
  const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=br&language=pt-BR`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmKey,
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: string;
    results?: { geometry?: { location?: { lat: number; lng: number } } }[];
  };
  if (json.status !== "OK" || !json.results?.length) return null;
  const loc = json.results[0].geometry?.location;
  if (!loc) return null;
  return { lat: loc.lat, lng: loc.lng };
}

function buildAddressQuery(c: {
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}): string {
  return [c.address_line, c.city, c.state, c.zip_code, "Brasil"]
    .filter((p) => p && String(p).trim())
    .join(", ");
}

export const geocodePendingCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const supabase = centralDb;

    const seen = new Set<string>();
    const targets: { id: string; query: string }[] = [];

    function addTarget(c: {
      id: string;
      address_line: string | null;
      city: string | null;
      state: string | null;
      zip_code: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null) {
      if (!c) return;
      if (seen.has(c.id)) return;
      seen.add(c.id);
      if (c.latitude != null && c.longitude != null) return;
      const query = buildAddressQuery(c);
      if (!query.trim()) return;
      targets.push({ id: c.id, query });
    }

    // Clientes envolvidos em pedidos sem rota
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("customer_id, customers(id, address_line, city, state, zip_code, latitude, longitude)")
      .gte("dt_prev_exp", "3999-01-01");
    if (oErr) throw oErr;

    for (const o of orders ?? []) {
      const c = (o as { customers: unknown }).customers as {
        id: string;
        address_line: string | null;
        city: string | null;
        state: string | null;
        zip_code: string | null;
        latitude: number | null;
        longitude: number | null;
      } | null;
      addTarget(c);
    }

    // Todos os clientes da base sem lat/lng
    const { data: allCustomers, error: cErr } = await supabase
      .from("customers")
      .select("id, address_line, city, state, zip_code, latitude, longitude")
      .or("latitude.is.null,longitude.is.null");
    if (cErr) throw cErr;
    for (const c of allCustomers ?? []) {
      addTarget(c);
    }

    let geocoded = 0;
    let failed = 0;
    for (const t of targets) {
      try {
        const coord = await geocodeAddress(t.query);
        if (!coord) {
          failed++;
          continue;
        }
        const { error } = await supabase
          .from("customers")
          .update({ latitude: coord.lat, longitude: coord.lng })
          .eq("id", t.id);
        if (error) {
          failed++;
        } else {
          geocoded++;
        }
      } catch {
        failed++;
      }
    }

    // Geocodifica também o depósito, se configurado e sem lat/lng
    const { data: cfg } = await supabase
      .from("company_settings")
      .select("depot_address, depot_latitude, depot_longitude")
      .eq("id", 1)
      .maybeSingle();
    if (cfg?.depot_address && (cfg.depot_latitude == null || cfg.depot_longitude == null)) {
      try {
        const coord = await geocodeAddress(cfg.depot_address);
        if (coord) {
          await supabase
            .from("company_settings")
            .update({ depot_latitude: coord.lat, depot_longitude: coord.lng })
            .eq("id", 1);
        }
      } catch {
        // ignore
      }
    }

    return { totalPending: targets.length, geocoded, failed };
  });

export type SuggestionStop = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  city: string | null;
  state: string | null;
  weight: number;
  amount: number;
  lat: number;
  lng: number;
};

export type RouteSuggestion = {
  id: string;
  type: "new_route" | "append_existing";
  routeId: string | null;
  routeLabel: string;
  routeDate: string;
  driverName: string | null;
  orderIds: string[];
  stops: SuggestionStop[];
  existingStops: SuggestionStop[];
  totalWeight: number;
  totalAmount: number;
  capacityWeight: number;
  existingWeight: number;
  existingValue: number;
  existingDeliveries: number;
  centroid: Coord;
  freightCost?: number | null;
};

function nextBusinessDay(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function nearestNeighborOrder<T extends Coord>(origin: Coord, points: T[]): T[] {
  const remaining = [...points];
  const ordered: T[] = [];
  let current = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [pick] = remaining.splice(bestIdx, 1);
    ordered.push(pick);
    current = pick;
  }
  return ordered;
}

export const suggestRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureStaff(context);
    const supabase = centralDb;

    const { data: cfg } = await supabase
      .from("company_settings")
      .select(
        "depot_latitude, depot_longitude, max_route_weight_kg, max_route_value_brl, route_cluster_radius_km",
      )
      .eq("id", 1)
      .maybeSingle();

    const maxWeight = Number(cfg?.max_route_weight_kg ?? 5000) || 5000;
    const maxValue = Number(cfg?.max_route_value_brl ?? 0) || 0;
    const radiusKm = Number(cfg?.route_cluster_radius_km ?? 30) || 30;
    const depot: Coord | null =
      cfg?.depot_latitude != null && cfg?.depot_longitude != null
        ? { lat: Number(cfg.depot_latitude), lng: Number(cfg.depot_longitude) }
        : null;

    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, total_amount, weight, customer_id, delivery_latitude, delivery_longitude, customers(id, trade_name, legal_name, city, state, latitude, longitude)",
      )
      .gte("dt_prev_exp", "3999-01-01");
    if (oErr) throw oErr;

    type Pending = NonNullable<typeof orders>[number];
    const withCoords: (Pending & { _coord: Coord; _weight: number; _amount: number })[] = [];
    const missing: { id: string; order_number: string; customer: string; city: string | null }[] = [];

    for (const o of orders ?? []) {
      const oAny = o as Pending & {
        delivery_latitude: number | null;
        delivery_longitude: number | null;
        customers: { latitude: number | null; longitude: number | null; trade_name: string | null; legal_name: string | null; city: string | null } | null;
      };
      const c = oAny.customers;
      const name = c?.trade_name || c?.legal_name || "Cliente";
      const dLat = oAny.delivery_latitude;
      const dLng = oAny.delivery_longitude;
      let coord: Coord | null = null;
      if (dLat != null && dLng != null) {
        coord = { lat: Number(dLat), lng: Number(dLng) };
      } else if (c && c.latitude != null && c.longitude != null) {
        coord = { lat: Number(c.latitude), lng: Number(c.longitude) };
      }
      if (!coord) {
        missing.push({
          id: o.id,
          order_number: o.order_number,
          customer: name,
          city: c?.city ?? null,
        });
        continue;
      }
      withCoords.push({
        ...(o as Pending),
        _coord: coord,
        _weight: Number(o.weight ?? 0),
        _amount: Number(o.total_amount ?? 0),
      });
    }

    // Existing planned routes (today onward)
    const today = new Date().toISOString().slice(0, 10);
    const { data: routes, error: rErr } = await supabase
      .from("routes")
      .select(
        "id, code, route_date, status, driver_name, notes, route_orders(stop_order, orders(id, order_number, weight, total_amount, customer_id, delivery_latitude, delivery_longitude, customers(trade_name, legal_name, city, state, latitude, longitude)))",
      )
      .eq("status", "planejada")
      .gte("route_date", today);
    if (rErr) throw rErr;

    type ExistingRoute = {
      id: string;
      label: string;
      date: string;
      driverName: string | null;
      centroid: Coord | null;
      existingWeight: number;
      existingValue: number;
      existingDeliveries: number;
      customerIds: Set<string>;
      existingStops: SuggestionStop[];
    };
    const existing: ExistingRoute[] = [];
    for (const r of routes ?? []) {
      const rows = (r.route_orders ?? []).slice().sort(
        (a: { stop_order: number | null }, b: { stop_order: number | null }) =>
          (a.stop_order ?? 0) - (b.stop_order ?? 0),
      );
      const stops = rows
        .map((ro) => ro.orders)
        .filter((o): o is NonNullable<typeof o> => !!o);
      const existingStops: SuggestionStop[] = stops
        .map((o) => {
          const oAny = o as typeof o & { delivery_latitude: number | null; delivery_longitude: number | null };
          const c = o.customers;
          const dLat = oAny.delivery_latitude;
          const dLng = oAny.delivery_longitude;
          let lat: number | null = null;
          let lng: number | null = null;
          if (dLat != null && dLng != null) {
            lat = Number(dLat);
            lng = Number(dLng);
          } else if (c && c.latitude != null && c.longitude != null) {
            lat = Number(c.latitude);
            lng = Number(c.longitude);
          }
          if (lat == null || lng == null) return null;
          return {
            orderId: o.id,
            orderNumber: o.order_number,
            customerId: o.customer_id ?? "",
            customerName: c?.trade_name || c?.legal_name || "Cliente",
            city: c?.city ?? null,
            state: c?.state ?? null,
            weight: Number(o.weight ?? 0),
            amount: Number(o.total_amount ?? 0),
            lat,
            lng,
          } satisfies SuggestionStop;
        })
        .filter((s): s is SuggestionStop => !!s);
      const centroid = existingStops.length
        ? {
            lat: existingStops.reduce((s, p) => s + p.lat, 0) / existingStops.length,
            lng: existingStops.reduce((s, p) => s + p.lng, 0) / existingStops.length,
          }
        : null;
      const existingWeight = stops.reduce((s, o) => s + Number(o.weight ?? 0), 0);
      const existingValue = stops.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
      const customerIds = new Set<string>(
        stops.map((o) => o.customer_id).filter((id): id is string => !!id),
      );
      const existingDeliveries = customerIds.size;
      const label = r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code;
      existing.push({
        id: r.id,
        label,
        date: r.route_date,
        driverName: r.driver_name,
        centroid,
        existingWeight,
        existingValue,
        existingDeliveries,
        customerIds,
        existingStops,
      });
    }


    const suggestions: RouteSuggestion[] = [];
    const usedOrderIds = new Set<string>();

    // 1) Tentar encaixar em rota existente
    for (const o of withCoords) {
      let bestRoute: ExistingRoute | null = null;
      let bestDist = Infinity;
      for (const r of existing) {
        if (!r.centroid) continue;
        const d = haversineKm(o._coord, r.centroid);
        if (d > radiusKm) continue;
        if (r.existingWeight + o._weight > maxWeight) continue;
        if (maxValue > 0 && r.existingValue + o._amount > maxValue) continue;
        if (d < bestDist) {
          bestDist = d;
          bestRoute = r;
        }
      }
      if (bestRoute) {
        let s = suggestions.find((x) => x.type === "append_existing" && x.routeId === bestRoute!.id);
        if (!s) {
          s = {
            id: `existing-${bestRoute.id}`,
            type: "append_existing",
            routeId: bestRoute.id,
            routeLabel: bestRoute.label,
            routeDate: bestRoute.date,
            driverName: bestRoute.driverName,
            orderIds: [],
            stops: [],
            totalWeight: 0,
            totalAmount: 0,
            capacityWeight: maxWeight,
            existingWeight: bestRoute.existingWeight,
            existingValue: bestRoute.existingValue,
            existingDeliveries: bestRoute.existingDeliveries,
            existingStops: bestRoute.existingStops,
            centroid: bestRoute.centroid!,
          };
          suggestions.push(s);
        }
        const c = (o as { customers: { trade_name: string | null; legal_name: string | null; city: string | null; state: string | null } | null }).customers!;
        s.orderIds.push(o.id);
        s.stops.push({
          orderId: o.id,
          orderNumber: o.order_number,
          customerId: o.customer_id,
          customerName: c.trade_name || c.legal_name || "Cliente",
          city: c.city,
          state: c.state,
          weight: o._weight,
          amount: o._amount,
          lat: o._coord.lat,
          lng: o._coord.lng,
        });
        s.totalWeight += o._weight;
        s.totalAmount += o._amount;
        bestRoute.existingWeight += o._weight;
        bestRoute.existingValue += o._amount;
        // existingDeliveries reflects the route's current state (before append)
        usedOrderIds.add(o.id);
      }
    }

    // 2) Cluster greedy dos restantes (por proximidade)
    const remaining = withCoords.filter((o) => !usedOrderIds.has(o.id));
    const newDate = nextBusinessDay();
    let groupIdx = 0;

    while (remaining.length) {
      groupIdx++;
      const seed = remaining.shift()!;
      const group: typeof remaining = [seed];
      let groupWeight = seed._weight;
      let groupValue = seed._amount;
      let centroid = seed._coord;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const o = remaining[i];
        if (haversineKm(o._coord, centroid) > radiusKm) continue;
        if (groupWeight + o._weight > maxWeight) continue;
        if (maxValue > 0 && groupValue + o._amount > maxValue) continue;
        group.push(o);
        groupWeight += o._weight;
        groupValue += o._amount;
        centroid = {
          lat: group.reduce((s, x) => s + x._coord.lat, 0) / group.length,
          lng: group.reduce((s, x) => s + x._coord.lng, 0) / group.length,
        };
        remaining.splice(i, 1);
      }

      const origin = depot ?? centroid;
      const ordered = nearestNeighborOrder(
        origin,
        group.map((o) => ({
          lat: o._coord.lat,
          lng: o._coord.lng,
          o,
        })),
      );

      const cityOfSeed = (seed as { customers: { city: string | null } | null }).customers?.city ?? "";
      const label = cityOfSeed
        ? `M-${cityOfSeed.toUpperCase()}`
        : `M-SUGESTAO ${groupIdx}`;

      suggestions.push({
        id: `new-${groupIdx}`,
        type: "new_route",
        routeId: null,
        routeLabel: label,
        routeDate: newDate,
        driverName: null,
        orderIds: ordered.map((p) => p.o.id),
        stops: ordered.map((p) => {
          const c = (p.o as { customers: { trade_name: string | null; legal_name: string | null; city: string | null; state: string | null } | null }).customers!;
          return {
            orderId: p.o.id,
            orderNumber: p.o.order_number,
            customerId: p.o.customer_id,
            customerName: c.trade_name || c.legal_name || "Cliente",
            city: c.city,
            state: c.state,
            weight: p.o._weight,
            amount: p.o._amount,
            lat: p.o._coord.lat,
            lng: p.o._coord.lng,
          };
        }),
        totalWeight: groupWeight,
        totalAmount: groupValue,
        capacityWeight: maxWeight,
        existingWeight: 0,
        existingValue: 0,
        existingDeliveries: 0,
        existingStops: [],
        centroid,
      });
    }

    return {
      suggestions,
      missingGeocode: missing,
      depot,
      config: { maxWeight, maxValue, radiusKm },
      existingRoutes: existing.map((r) => ({
        id: r.id,
        label: r.label,
        date: r.date,
        driverName: r.driverName,
        existingWeight: r.existingWeight,
        existingValue: r.existingValue,
        existingDeliveries: r.existingDeliveries,
        capacityWeight: maxWeight,
      })),
    };
  });

export const confirmRouteSuggestion = createServerFn({ method: "POST" })
  .inputValidator((data: { suggestion: RouteSuggestion }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const supabase = centralDb;
    const s = data.suggestion;
    if (!s.orderIds.length) throw new Error("Sugestão sem pedidos");

    let routeId = s.routeId;

    if (s.type === "new_route" || !routeId) {
      const slug = (s.routeLabel || "rota")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "rota";
      const code = `${slug}-${s.routeDate.replace(/-/g, "")}-${Date.now().toString(36)}`;
      const { data: inserted, error } = await supabase
        .from("routes")
        .insert({
          code,
          route_date: s.routeDate,
          driver_name: s.driverName,
          total_freight: 0,
          notes: `Rota ${s.routeLabel}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      routeId = inserted.id;
    }

    // Próximo stop_order
    const { data: existingStops } = await supabase
      .from("route_orders")
      .select("stop_order")
      .eq("route_id", routeId)
      .order("stop_order", { ascending: false })
      .limit(1);
    let nextStop = (existingStops?.[0]?.stop_order ?? 0) + 1;

    const rows = s.orderIds.map((orderId) => ({
      route_id: routeId!,
      order_id: orderId,
      stop_order: nextStop++,
    }));
    const { error: roErr } = await supabase.from("route_orders").insert(rows);
    if (roErr) throw roErr;

    // Atualiza dt_prev_exp dos pedidos para a data da rota
    const isoTs = `${s.routeDate}T00:00:00+00:00`;
    const { error: upErr } = await supabase
      .from("orders")
      .update({ dt_prev_exp: isoTs })
      .in("id", s.orderIds);
    if (upErr) throw upErr;

    return { ok: true, routeId };
  });
