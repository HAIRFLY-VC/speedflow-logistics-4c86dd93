// Retorno do n8n após processar um item das filas de lançamento no ERP.
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Body = {
  fila?: "valores" | "financeiro";
  fila_id?: string;
  ok?: boolean;
  status?: string;
  referencia_erp?: string | null;
  erro?: string | null;
};

async function processar(request: Request) {
  const provided =
    request.headers.get("x-webhook-token") ??
    request.headers.get("x-ingest-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const { centralDb } = await import("@/lib/central-db");
  const { data: cfg } = await centralDb
    .from("integracao_n8n")
    .select("webhook_token")
    .eq("id", 1)
    .maybeSingle();
  const esperado = cfg?.webhook_token || process.env["CTE_INGEST_SECRET"] || "";
  if (!esperado || !provided || !safeEqual(provided, esperado)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.fila_id) return Response.json({ error: "fila_id obrigatório" }, { status: 400 });

  const tabela =
    body.fila === "financeiro"
      ? "fila_provisionamento_financeiro"
      : "fila_lancamento_erp_frete";
  const ok = body.ok !== false && body.status !== "ERRO";

  const { data: atual } = await centralDb
    .from(tabela)
    .select("id, tentativas, ordem_pagamento_id")
    .eq("id", body.fila_id)
    .maybeSingle();
  if (!atual) return Response.json({ error: "Item não encontrado" }, { status: 404 });

  const { error } = await centralDb
    .from(tabela)
    .update({
      status: ok ? "CONCLUIDO" : "ERRO",
      tentativas: Number(atual.tentativas ?? 0) + 1,
      ultimo_erro: ok ? null : (body.erro ?? "Falha no processamento"),
      referencia_erp: body.referencia_erp ?? null,
      processado_em: new Date().toISOString(),
    })
    .eq("id", body.fila_id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Ordem concluída quando não resta nenhum item pendente/erro nas duas filas.
  const ordemId = atual.ordem_pagamento_id;
  if (ordemId) {
    const [{ data: pendV }, { data: pendF }] = await Promise.all([
      centralDb
        .from("fila_lancamento_erp_frete")
        .select("id, status")
        .eq("ordem_pagamento_id", ordemId),
      centralDb
        .from("fila_provisionamento_financeiro")
        .select("id, status")
        .eq("ordem_pagamento_id", ordemId),
    ]);
    const todos = [...(pendV ?? []), ...(pendF ?? [])];
    const houveErro = todos.some((i) => i.status === "ERRO");
    const concluiu = todos.length > 0 && todos.every((i) => i.status === "CONCLUIDO");
    if (houveErro || concluiu) {
      await centralDb
        .from("ordens_pagamento_frete")
        .update({ status: houveErro ? "ERRO_ERP" : "LANCADO_ERP" })
        .eq("id", ordemId);
      const { data: ordem } = await centralDb
        .from("ordens_pagamento_frete")
        .select("cte_id")
        .eq("id", ordemId)
        .maybeSingle();
      if (ordem?.cte_id) {
        await centralDb
          .from("ctes")
          .update({ status: houveErro ? "ERRO_ERP" : "LANCADO_ERP" })
          .eq("id", ordem.cte_id);
      }
    }
  }

  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/hooks/erp-fila-callback")({
  server: { handlers: { POST: async ({ request }) => processar(request) } },
});
