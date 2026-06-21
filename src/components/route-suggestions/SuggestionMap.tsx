import { useEffect, useRef } from "react";

type Stop = { lat: number; lng: number; orderNumber: string; customerName: string };

declare global {
  interface Window {
    google?: any;
    __sugMapInit?: () => void;
    __sugMapReady?: Promise<void>;
  }
}

const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

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

export function SuggestionMap({
  stops,
  depot,
  height = 260,
}: {
  stops: Stop[];
  depot: { lat: number; lng: number } | null;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current || !window.google?.maps) return;
      const g = window.google.maps;
      const bounds = new g.LatLngBounds();
      const points: { lat: number; lng: number }[] = [];
      if (depot) points.push(depot);
      points.push(...stops);
      for (const p of points) bounds.extend(p);

      const map = new g.Map(ref.current, {
        center: bounds.getCenter(),
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      if (points.length > 1) map.fitBounds(bounds, 40);

      if (depot) {
        new g.Marker({
          position: depot,
          map,
          label: "D",
          title: "Depósito",
        });
      }
      stops.forEach((s, i) => {
        new g.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          label: String(i + 1),
          title: `${s.orderNumber} — ${s.customerName}`,
        });
      });

      // Polyline conectando depósito -> paradas
      const path = depot ? [depot, ...stops.map((s) => ({ lat: s.lat, lng: s.lng }))] : stops.map((s) => ({ lat: s.lat, lng: s.lng }));
      if (path.length > 1) {
        new g.Polyline({
          path,
          map,
          strokeColor: "#2563eb",
          strokeOpacity: 0.85,
          strokeWeight: 3,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [stops, depot]);

  return <div ref={ref} style={{ width: "100%", height }} className="rounded-md border" />;
}
