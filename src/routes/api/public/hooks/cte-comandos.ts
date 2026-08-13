// Fila de comandos de captura forçada de CT-e; consumida pelo robô local com certificado A1.
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

export const Route = createFileRoute("/api/public/hooks/cte-comandos")({
  server: {
    handlers: {
      // Robô consulta e assume o comando pendente (se houver).
      GET: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("cte_captura_comandos")
            .select("id")
            .eq("status", "PENDENTE")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) return Response.json({ forcar: false });

          await supabaseAdmin
            .from("cte_captura_comandos")
            .update({ status: "PROCESSANDO", iniciado_em: new Date().toISOString() })
            .eq("id", data.id);

          return Response.json({ forcar: true, comandoId: data.id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      // Robô informa a conclusão do comando.
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const body = (await request.json()) as {
            comandoId?: string;
            status?: string;
            mensagem?: string;
            novosCtes?: number;
          };
          if (!body.comandoId) {
            return Response.json({ error: "comandoId obrigatório" }, { status: 400 });
          }
          const status = body.status === "ERRO" ? "ERRO" : "CONCLUIDO";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("cte_captura_comandos")
            .update({
              status,
              mensagem: body.mensagem ? String(body.mensagem).slice(0, 500) : null,
              novos_ctes: Number.isFinite(body.novosCtes) ? Number(body.novosCtes) : 0,
              concluido_em: new Date().toISOString(),
            })
            .eq("id", body.comandoId);
          if (error) throw new Error(error.message);
          return Response.json({ ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
