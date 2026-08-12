// Recebe o XML da NF-e capturado pelo robô local (certificado A1) e grava o detalhamento.
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

export const Route = createFileRoute("/api/public/hooks/ingest-nfe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let chave = "";
        try {
          const body = (await request.json()) as {
            chave?: unknown;
            xml?: unknown;
            erro?: unknown;
          };
          chave = typeof body.chave === "string" ? body.chave.replace(/\D/g, "") : "";
          const xml = typeof body.xml === "string" ? body.xml : "";
          const erro = typeof body.erro === "string" ? body.erro : "";

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (!xml) {
            if (chave) {
              const { data: atual } = await supabaseAdmin
                .from("nfe_solicitacoes")
                .select("tentativas")
                .eq("chave_acesso", chave)
                .maybeSingle();
              await supabaseAdmin
                .from("nfe_solicitacoes")
                .update({
                  status: "ERRO",
                  mensagem: erro || "XML não retornado pela SEFAZ",
                  tentativas: (atual?.tentativas ?? 0) + 1,
                })
                .eq("chave_acesso", chave);
            }
            return Response.json({ ok: false, error: erro || "XML ausente" }, { status: 400 });
          }

          if (xml.length < 50 || xml.length > 8_000_000) {
            return Response.json({ ok: false, error: "XML inválido" }, { status: 400 });
          }

          const { ingestNfeXml } = await import("@/lib/nfe-ingest.server");
          const result = await ingestNfeXml(xml);

          await supabaseAdmin
            .from("nfe_solicitacoes")
            .update({ status: "CONCLUIDA", mensagem: null })
            .eq("chave_acesso", result.chave_acesso);

          return Response.json({ ok: true, chave_acesso: result.chave_acesso });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          try {
            if (chave) {
              const { supabaseAdmin } = await import(
                "@/integrations/supabase/client.server"
              );
              const { data: atual } = await supabaseAdmin
                .from("nfe_solicitacoes")
                .select("tentativas")
                .eq("chave_acesso", chave)
                .maybeSingle();
              await supabaseAdmin
                .from("nfe_solicitacoes")
                .update({
                  status: "ERRO",
                  mensagem: msg,
                  tentativas: (atual?.tentativas ?? 0) + 1,
                })
                .eq("chave_acesso", chave);
            }
          } catch {
            // ignora falha ao registrar o erro
          }
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
