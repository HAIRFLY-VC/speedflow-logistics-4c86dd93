import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

type LatLng = { lat: number; lng: number };

export const computeRoutePolyline = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { origin: LatLng; destination: LatLng; waypoints: LatLng[] }) => data,
  )
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      throw new Error("Google Maps connector não configurado");
    }

    const body = {
      origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
      destination: {
        location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } },
      },
      intermediates: data.waypoints.map((w) => ({
        location: { latLng: { latitude: w.lat, longitude: w.lng } },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };

    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Routes API ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      routes?: { polyline?: { encodedPolyline?: string } }[];
    };
    const encoded = json.routes?.[0]?.polyline?.encodedPolyline ?? null;
    return { encodedPolyline: encoded };
  });
