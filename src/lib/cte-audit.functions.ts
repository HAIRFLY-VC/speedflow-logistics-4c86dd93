import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão para auditar fretes");
}

/** Roda a auditoria de um CT-e específico. */
export const auditarCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { auditCte } = await import("./cte-audit.server");
    return auditCte(context.supabase, data.cteId);
  });

/** Roda a auditoria de todos os CT-e ainda não auditados. */
export const auditarPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { auditCte } = await import("./cte-audit.server");

    const { data: ctes, error } = await context.supabase
      .from("ctes")
      .select("id")
      .in("status", ["RECEBIDO", "EM_AUDITORIA"])
      .limit(200);
    if (error) throw new Error(error.message);

    let ok = 0;
    let divergentes = 0;
    const erros: string[] = [];
    for (const c of ctes ?? []) {
      try {
        const res = await auditCte(context.supabase, c.id);
        if (res.resultado === "OK") ok += 1;
        else divergentes += 1;
      } catch (e) {
        erros.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { total: (ctes ?? []).length, ok, divergentes, erros };
  });

/** Registra a tratativa de uma divergência. */
export const resolverDivergencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        divergenciaId: z.string().uuid(),
        status: z.enum(["EM_NEGOCIACAO", "RESOLVIDA"]),
        observacao: z.string().max(2000).optional(),
        valorAcordado: z.number().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { data: div, error } = await context.supabase
      .from("cte_divergencias")
      .update({
        status: data.status,
        observacao_operador: data.observacao ?? null,
        valor_acordado: data.valorAcordado ?? null,
        resolvido_por: data.status === "RESOLVIDA" ? context.userId : null,
        resolvido_em: data.status === "RESOLVIDA" ? new Date().toISOString() : null,
      })
      .eq("id", data.divergenciaId)
      .select("cte_id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase
      .from("ctes")
      .update({ status: data.status === "RESOLVIDA" ? "RESOLVIDO" : "EM_RESOLUCAO" })
      .eq("id", div.cte_id);

    return { ok: true };
  });
