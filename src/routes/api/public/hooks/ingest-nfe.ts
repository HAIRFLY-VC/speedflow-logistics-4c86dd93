// Recebe o XML da NF-e capturado pelo robô local (certificado A1) e grava o detalhamento.
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
            nsu?: unknown;
          };
          chave = typeof body.chave === "string" ? body.chave.replace(/\D/g, "") : "";
          const xml = typeof body.xml === "string" ? body.xml : "";
          const erro = typeof body.erro === "string" ? body.erro : "";
          const nsu =
            typeof body.nsu === "number"
              ? body.nsu
              : typeof body.nsu === "string" && /^\d+$/.test(body.nsu)
                ? Number(body.nsu)
                : null;

          // cStat=641 significa que a empresa e a EMITENTE da nota: a consulta por chave
          // nunca funciona nesse caso e a nota chega pela varredura por NSU. Mantemos a
          // solicitacao aguardando em vez de marcar erro definitivo.
          const aguardandoVarredura = /\b641\b/.test(erro);

          if (!xml) {
            if (chave && aguardandoVarredura) {
              await centralDb
                .from("nfe_solicitacoes")
                .update({
                  // ERRO mantém a nota fora da fila por chave (que nunca funcionaria);
                  // a mensagem com 641 é traduzida na tela como "aguardando varredura".
                  status: "ERRO",
                  mensagem:
                    "cStat=641: nota emitida pela própria empresa — aguardando a varredura da SEFAZ por NSU.",
                })
                .eq("chave_acesso", chave);
              return Response.json({ ok: true, pendente: true });
            }
            if (chave) {
              const { data: atual } = await centralDb
                .from("nfe_solicitacoes")
                .select("tentativas")
                .eq("chave_acesso", chave)
                .maybeSingle();
              await centralDb
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
          const result = await ingestNfeXml(xml, nsu);

          await centralDb
            .from("nfe_solicitacoes")
            .update({ status: "CONCLUIDA", mensagem: null })
            .eq("chave_acesso", result.chave_acesso);

          return Response.json({ ok: true, chave_acesso: result.chave_acesso });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          try {
            if (chave) {
              const { data: atual } = await centralDb
                .from("nfe_solicitacoes")
                .select("tentativas")
                .eq("chave_acesso", chave)
                .maybeSingle();
              await centralDb
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
