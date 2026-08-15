import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

async function assertPodeAutorizar(context: { supabase: any; userId: string }) {
  const { data: pode } = await context.supabase.rpc("pode_autorizar_frete", {
    _user_id: context.userId,
  });
  if (!pode) throw new Error("Você não tem permissão para autorizar pagamento de frete");
}

/** Autoriza o pagamento de um CT-e aprovado/resolvido e cria a ordem de pagamento. */
export const autorizarPagamentoFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cteId: z.string().uuid(),
        valorAutorizado: z.number().positive().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPodeAutorizar(context);

    const { data: cte, error } = await centralDb
      .from("ctes")
      .select("id, status, valor_total_frete")
      .eq("id", data.cteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cte) throw new Error("CT-e não encontrado");
    if (!["APROVADO", "RESOLVIDO"].includes(cte.status)) {
      throw new Error("Somente CT-e aprovado ou com divergência resolvida pode ser autorizado");
    }

    const { data: divergencia } = await centralDb
      .from("cte_divergencias")
      .select("valor_acordado")
      .eq("cte_id", cte.id)
      .eq("status", "RESOLVIDA")
      .order("resolvido_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const valor =
      data.valorAutorizado ??
      Number(divergencia?.valor_acordado ?? cte.valor_total_frete);

    const { data: ordem, error: insErr } = await centralDb
      .from("ordens_pagamento_frete")
      .insert({
        cte_id: cte.id,
        valor_autorizado: valor,
        autorizado_por: context.userId,
        autorizado_em: new Date().toISOString(),
        status: "AUTORIZADO",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await centralDb.from("ctes").update({ status: "AUTORIZADO" }).eq("id", cte.id);

    return { ok: true, ordem_id: ordem.id, valor_autorizado: valor };
  });

/** Rejeita um CT-e (não será pago). */
export const rejeitarCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ cteId: z.string().uuid(), motivo: z.string().min(3).max(1000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertPodeAutorizar(context);
    const { error } = await centralDb
      .from("ctes")
      .update({ status: "REJEITADO", observacao: data.motivo })
      .eq("id", data.cteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envia a ordem de pagamento para o ERP (stub quando não há endpoint configurado). */
export const lancarOrdemNoErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ordemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertPodeAutorizar(context);

    const { data: ordem, error } = await centralDb
      .from("ordens_pagamento_frete")
      .select("id, valor_autorizado, status, cte_id")
      .eq("id", data.ordemId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ordem) throw new Error("Ordem não encontrada");
    if (ordem.status === "LANCADO_ERP") throw new Error("Ordem já lançada no ERP");

    const { data: cte } = await centralDb
      .from("ctes")
      .select("chave_acesso, numero, data_emissao, nfs_referenciadas, transportadora_id")
      .eq("id", ordem.cte_id)
      .maybeSingle();

    let transportadora: { razao_social: string; cnpj: string; pix: string | null } | null =
      null;
    if (cte?.transportadora_id) {
      const { data: t } = await centralDb
        .from("transportadoras")
        .select("razao_social, cnpj, pix")
        .eq("id", cte.transportadora_id)
        .maybeSingle();
      transportadora = t ?? null;
    }

    await centralDb
      .from("ordens_pagamento_frete")
      .update({ status: "AGUARDANDO_INTEGRACAO_ERP" })
      .eq("id", ordem.id);

    const { enviarOrdemParaErp } = await import("./frete-erp.server");
    const result = await enviarOrdemParaErp(centralDb, {
      ordem_id: ordem.id,
      cte_chave: cte?.chave_acesso ?? "",
      cte_numero: cte?.numero ?? null,
      transportadora,
      valor_autorizado: Number(ordem.valor_autorizado),
      data_emissao: cte?.data_emissao ?? null,
      nfs_referenciadas: cte?.nfs_referenciadas ?? [],
    });

    await centralDb
      .from("ordens_pagamento_frete")
      .update({
        status: result.ok ? "LANCADO_ERP" : "ERRO_ERP",
        referencia_erp: result.referencia_erp ?? null,
        erro_mensagem: result.erro ?? null,
        payload_erp_enviado: result.payload as never,
      })
      .eq("id", ordem.id);

    await centralDb
      .from("ctes")
      .update({ status: result.ok ? "LANCADO_ERP" : "ERRO_ERP" })
      .eq("id", ordem.cte_id);

    if (!result.ok) throw new Error(result.erro ?? "Falha ao lançar no ERP");
    return { ok: true, referencia_erp: result.referencia_erp ?? null };
  });

/** Atualiza as tolerâncias usadas pelo motor de auditoria. */
export const salvarToleranciasAuditoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        toleranciaValor: z.number().min(0).max(100000),
        toleranciaPercentual: z.number().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await centralDb
      .from("configuracoes_auditoria_frete")
      .update({
        tolerancia_valor: data.toleranciaValor,
        tolerancia_percentual: data.toleranciaPercentual,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
