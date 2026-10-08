import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PreviewProvisao } from "@/lib/provisao-frete.types";

type Ctx = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
  claims?: { email?: string };
};

async function podeAutorizar(context: Ctx) {
  const { data: pode } = await context.supabase.rpc("pode_autorizar_frete", { _user_id: context.userId });
  if (pode) return;
  const { data: gestor } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor" });
  if (!gestor) throw new Error("Você não tem permissão para provisionar frete.");
}

const input = (i: unknown) => z.object({ routeId: z.string().uuid() }).parse(i);

export const previewProvisaoFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data, context }): Promise<PreviewProvisao> => {
    await podeAutorizar(context as unknown as Ctx);
    const { previewProvisao } = await import("./provisao-frete.server");
    return previewProvisao(data.routeId);
  });

export const gravarProvisaoFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ routeId: z.string().uuid(), substituir: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await podeAutorizar(ctx);
    const { gravarProvisao } = await import("./provisao-frete.server");
    return gravarProvisao(data.routeId, ctx.claims?.email ?? ctx.userId, !!data.substituir);
  });
