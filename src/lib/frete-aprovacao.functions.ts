import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AprovacaoPreview } from "@/lib/frete-aprovacao.types";

const campoErp = z.enum([
  "vlr_frete",
  "vlr_perna",
  "vlr_diaria",
  "vlr_pernoite",
  "vlr_reentrega",
  "vlr_descarrego",
]);

async function podeAutorizar(context: { supabase: any; userId: string }) {
  const { data: pode } = await context.supabase.rpc("pode_autorizar_frete", {
    _user_id: context.userId,
  });
  if (!pode) throw new Error("Você não tem permissão para aprovar pagamento de frete");
}

async function ehAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  if (!isAdmin) throw new Error("Apenas administradores podem alterar esta configuração");
}

/** Prévia da aprovação: distribuição nos campos do ERP e registros candidatos. */
export const previewAprovacaoCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AprovacaoPreview> => {
    await podeAutorizar(context);
    const { montarPreview } = await import("./frete-aprovacao.server");
    return montarPreview(data.cteId);
  });

/** Aprova o CT-e e enfileira o lançamento no ERP. */
export const aprovarCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cteId: z.string().uuid(),
        selecoes: z
          .array(z.object({ chave: z.string(), bordero: z.string().nullable() }))
          .default([]),
        observacao: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await podeAutorizar(context);
    const { aprovar } = await import("./frete-aprovacao.server");
    return aprovar(data.cteId, context.userId, data.selecoes, data.observacao ?? null);
  });

/** Reprova o CT-e com observação obrigatória. */
export const reprovarCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ cteId: z.string().uuid(), observacao: z.string().trim().min(3).max(1000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await podeAutorizar(context);
    const { reprovar } = await import("./frete-aprovacao.server");
    return reprovar(data.cteId, context.userId, data.observacao);
  });

/** Reenvia um item de fila que falhou. */
export const reenviarFilaErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ fila: z.enum(["valores", "financeiro"]), filaId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await podeAutorizar(context);
    const { reenviarItemFila } = await import("./frete-aprovacao.server");
    return reenviarItemFila(data.fila, data.filaId);
  });

/** De-para de componentes do CT-e e configuração do n8n. */
export const getConfigLancamentoErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ehAdmin(context);
    const { centralDb } = await import("./central-db");
    const [{ data: mapeamentos }, { data: transportadoras }, { data: n8n }] = await Promise.all([
      centralDb
        .from("mapeamento_componentes_erp")
        .select("id, transportadora_id, nome_componente_cte, campo_erp")
        .order("nome_componente_cte"),
      centralDb.from("transportadoras").select("id, razao_social").order("razao_social"),
      centralDb
        .from("integracao_n8n")
        .select("webhook_url, webhook_url_financeiro, ativo")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    return {
      mapeamentos: mapeamentos ?? [],
      transportadoras: transportadoras ?? [],
      n8n: {
        webhook_url: n8n?.webhook_url ?? "",
        webhook_url_financeiro: n8n?.webhook_url_financeiro ?? "",
        ativo: n8n?.ativo ?? false,
      },
    };
  });

export const salvarMapeamentoComponente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transportadoraId: z.string().uuid().nullable().default(null),
        nomeComponente: z.string().trim().min(1).max(120),
        campoErp: campoErp,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ehAdmin(context);
    const { centralDb } = await import("./central-db");
    const nome = data.nomeComponente.trim().toUpperCase();
    const filtro = centralDb
      .from("mapeamento_componentes_erp")
      .select("id")
      .eq("nome_componente_cte", nome);
    const { data: existente } = await (data.transportadoraId
      ? filtro.eq("transportadora_id", data.transportadoraId)
      : filtro.is("transportadora_id", null)
    ).maybeSingle();

    if (existente) {
      const { error } = await centralDb
        .from("mapeamento_componentes_erp")
        .update({ campo_erp: data.campoErp })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await centralDb.from("mapeamento_componentes_erp").insert({
        transportadora_id: data.transportadoraId,
        nome_componente_cte: nome,
        campo_erp: data.campoErp,
      } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const excluirMapeamentoComponente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ehAdmin(context);
    const { centralDb } = await import("./central-db");
    const { error } = await centralDb
      .from("mapeamento_componentes_erp")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarIntegracaoN8n = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        webhookUrl: z.string().trim().max(500),
        webhookUrlFinanceiro: z.string().trim().max(500),
        ativo: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ehAdmin(context);
    const { centralDb } = await import("./central-db");
    const { error } = await centralDb
      .from("integracao_n8n")
      .update({
        webhook_url: data.webhookUrl || null,
        webhook_url_financeiro: data.webhookUrlFinanceiro || null,
        ativo: data.ativo,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Listagem das filas para a tela de pagamento de fretes. */
export const listarFilasErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await podeAutorizar(context);
    const { centralDb } = await import("./central-db");
    const [{ data: valores }, { data: financeiro }] = await Promise.all([
      centralDb
        .from("fila_lancamento_erp_frete")
        .select(
          "id, cte_id, cod_filial, nro_nf, chave_nfe, status, tentativas, ultimo_erro, referencia_erp, processado_em, created_at, vlr_frete, vlr_perna, vlr_diaria, vlr_pernoite, vlr_reentrega, vlr_descarrego",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      centralDb
        .from("fila_provisionamento_financeiro")
        .select(
          "id, cte_id, status, tentativas, ultimo_erro, referencia_erp, processado_em, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    return { valores: valores ?? [], financeiro: financeiro ?? [] };
  });
