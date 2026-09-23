// Endpoint público chamado pelo pg_cron para reprocessar automaticamente as
// pendências de integração (lançamento no ERP e tarefa no Bitrix).
// Autenticado pelo mesmo segredo dedicado do sync (ERP_SYNC_CRON_SECRET).
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/fila-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ERP_SYNC_CRON_SECRET;
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || !provided || !safeEqual(provided, expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { processarPendencias } = await import("@/lib/fila-retry.server");
          const resultado = await processarPendencias();
          return new Response(JSON.stringify({ ok: true, ...resultado }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
