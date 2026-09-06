import { createFileRoute } from "@tanstack/react-router";

/** Rota temporária de diagnóstico: executa uma consulta de leitura no ERP. */
export const Route = createFileRoute("/api/public/hooks/erp-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["ERP_SYNC_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = (await request.json().catch(() => null)) as { sql?: string } | null;
        const sql = body?.sql;
        if (!sql || !/^\s*select/i.test(sql)) {
          return new Response("Only SELECT", { status: 400 });
        }
        const baseUrl = process.env["ERP_API_BASE_URL"];
        const apiKey = process.env["ERP_API_KEY"];
        if (!baseUrl || !apiKey) return new Response("ERP não configurado", { status: 500 });
        const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
        const res = await fetch(`${cleanBase}/v1/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({ sql, binds: {}, limit: 200 }),
        });
        const text = await res.text();
        return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
