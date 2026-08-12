// Endpoint público preparado para captura automática de CT-e (DF-e / provedor SEFAZ).
// Autenticado por segredo dedicado (CTE_INGEST_SECRET), nunca pela anon key.
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/ingest-cte")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CTE_INGEST_SECRET;
        const provided =
          request.headers.get("x-ingest-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || !provided || !safeEqual(provided, expected)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const contentType = request.headers.get("content-type") ?? "";
          let xml = "";
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as { xml?: unknown };
            xml = typeof body.xml === "string" ? body.xml : "";
          } else {
            xml = await request.text();
          }
          const { ingestCteXml, logCteIngest } = await import("@/lib/cte-ingest.server");

          if (xml.length < 50 || xml.length > 4_000_000) {
            await logCteIngest({
              origem: "SEFAZ_AUTO",
              resultado: "ERRO",
              mensagem: "XML inválido ou fora do tamanho permitido",
            });
            return Response.json({ error: "XML inválido" }, { status: 400 });
          }

          try {
            const result = await ingestCteXml({ xml, origem: "SEFAZ_AUTO" });
            return Response.json(result, { status: 200 });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await logCteIngest({ origem: "SEFAZ_AUTO", resultado: "ERRO", mensagem: msg });
            return Response.json({ ok: false, error: msg }, { status: 500 });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
