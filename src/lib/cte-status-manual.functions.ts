import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Altera manualmente os status de um CT-e (somente adm). Não dispara n8n/ERP. */
export const definirStatusManualCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cteId: z.string().uuid(),
        valores: z.enum(["PENDENTE", "APROVADO", "REPROVADO"]).nullable().optional(),
        financeiro: z.boolean().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "adm",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem alterar estes status");

    const { salvarStatusManual } = await import("./cte-status-manual.server");
    await salvarStatusManual({ ...data, userId: context.userId });
    return { ok: true };
  });
