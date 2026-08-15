// Fila de NF-e solicitadas pelo app; consumida pelo robô local que possui o certificado A1.
import { centralDb } from "@/lib/central-db";
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request): boolean {
  const expected = process.env.CTE_INGEST_SECRET;
  const provided =
    request.headers.get("x-ingest-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return Boolean(expected && provided && safeEqual(provided, expected));
}

export const Route = createFileRoute("/api/public/hooks/nfe-pendentes")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { registrarContatoRobo } = await import("@/lib/robo-heartbeat.server");
          await registrarContatoRobo("nfe-pendentes");
          const { data, error } = await centralDb

            .from("nfe_solicitacoes")
            .select("id, chave_acesso, tentativas")
            // Notas emitidas pela própria empresa (cStat=641) nunca vêm pela consulta
            // por chave: elas chegam pela varredura por NSU, então ficam fora desta fila.
            .in("status", ["PENDENTE", "PROCESSANDO"])
            .lt("tentativas", 5)
            .order("created_at", { ascending: true })
            .limit(20);
          if (error) throw new Error(error.message);

          const ids = (data ?? []).map((r) => r.id);
          if (ids.length) {
            await centralDb
              .from("nfe_solicitacoes")
              .update({ status: "PROCESSANDO" })
              .in("id", ids);
          }

          return Response.json({
            pendentes: (data ?? []).map((r) => ({
              chave: r.chave_acesso,
              tentativas: r.tentativas,
            })),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
