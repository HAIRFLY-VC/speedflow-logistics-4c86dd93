import { useEffect, useRef } from "react";

export type MapStop = {
  lat: number;
  lng: number;
  orderNumber: string;
  customerName: string;
  kind: "existing" | "new";
};

declare global {
  interface Window {
    google?: any;
    __sugMapInit?: () => void;
    __sugMapReady?: Promise<void>;
  }
}

const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

const COLOR_EXISTING = "#2563eb"; // azul
const COLOR_NEW = "#16a34a"; // verde

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__sugMapReady) return window.__sugMapReady;
  window.__sugMapReady = new Promise<void>((resolve) => {
    window.__sugMapInit = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY ?? "",
      loading: "async",
      callback: "__sugMapInit",
    });
    if (TRACKING_ID) params.set("channel", String(TRACKING_ID));
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    document.head.appendChild(script);
  });
  return window.__sugMapReady;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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

export function sequenceStops(
  stops: MapStop[],
  depot: { lat: number; lng: number } | null,
): MapStop[] {
  const remaining = [...stops];
  const ordered: MapStop[] = [];
  let current: { lat: number; lng: number } | null = depot ?? remaining[0] ?? null;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = current ? haversineKm(current, remaining[i]) : 0;
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

export function SuggestionMap({
  stops,
  existingStops = [],
  depot,
  height = 260,
}: {
  stops: MapStop[] | { lat: number; lng: number; orderNumber: string; customerName: string }[];
  existingStops?: MapStop[];
  depot: { lat: number; lng: number } | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      const g = window.google.maps;

      const newOnes: MapStop[] = (stops as MapStop[]).map((s) => ({
        lat: s.lat,
        lng: s.lng,
        orderNumber: s.orderNumber,
        customerName: s.customerName,
        kind: "new",
      }));
      const all = [...existingStops.map((s) => ({ ...s, kind: "existing" as const })), ...newOnes];
      const ordered = sequenceStops(all, depot);

      const bounds = new g.LatLngBounds();
      if (depot) bounds.extend(depot);
      for (const p of ordered) bounds.extend(p);

      const map = new g.Map(ref.current, {
        center: bounds.getCenter(),
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      if (ordered.length + (depot ? 1 : 0) > 1) map.fitBounds(bounds, 40);

      if (depot) {
        new g.Marker({
          position: depot,
          map,
          label: { text: "D", color: "#ffffff", fontWeight: "bold" },
          title: "Depósito",
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: "#111827",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      }

      ordered.forEach((s, i) => {
        const color = s.kind === "existing" ? COLOR_EXISTING : COLOR_NEW;
        new g.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          label: { text: String(i + 1), color: "#ffffff", fontWeight: "bold", fontSize: "12px" },
          title: `${i + 1}. ${s.orderNumber} — ${s.customerName} (${s.kind === "existing" ? "existente" : "nova"})`,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      });

      const path = depot ? [depot, ...ordered.map((s) => ({ lat: s.lat, lng: s.lng }))] : ordered.map((s) => ({ lat: s.lat, lng: s.lng }));
      if (path.length > 1) {
        new g.Polyline({
          path,
          map,
          strokeColor: "#2563eb",
          strokeOpacity: 0.7,
          strokeWeight: 3,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stops, existingStops, depot]);

  return <div ref={ref} style={{ width: "100%", height }} className="rounded-md border" />;
}
