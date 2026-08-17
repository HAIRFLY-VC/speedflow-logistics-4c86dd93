import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Despesas de frete já contabilizadas no ERP para as NF-es de um CT-e. */
export const getFretesContabilizadosNfes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ cteId: z.string().uuid(), chaves: z.array(z.string()).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!isStaff) throw new Error("Sem permissão");

    const { buscarFretesContabilizados } = await import("./frete-nfe-erp.server");
    return buscarFretesContabilizados(data.cteId, data.chaves);
  });
