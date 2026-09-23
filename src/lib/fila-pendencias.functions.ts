import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ItemPendencia, TentativaHistorico } from "@/lib/fila-pendencias.server";

const filaSchema = z.enum(["valores", "financeiro"]);

type Ctx = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
};

async function exigeAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  if (!data) throw new Error("Apenas administradores podem gerenciar as pendências de integração.");
}

/** Lista as pendências de lançamento no ERP e de criação de tarefa no Bitrix. */
export const listarPendenciasIntegracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ incluirResolvidas: z.boolean().default(false) }).parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ itens: ItemPendencia[]; pendentes: number; comErro: number }> => {
      await exigeAdmin(context as unknown as Ctx);
      const { listarPendencias } = await import("./fila-pendencias.server");
      return listarPendencias(data.incluirResolvidas);
    },
  );

/** Histórico de tentativas de um item. */
export const historicoPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ raizId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TentativaHistorico[]> => {
    await exigeAdmin(context as unknown as Ctx);
    const { historicoTentativas } = await import("./fila-pendencias.server");
    return historicoTentativas(data.raizId);
  });

/** Força uma nova tentativa imediata. */
export const tentarPendenciaAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fila: filaSchema, id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigeAdmin(context as unknown as Ctx);
    const { tentarAgora } = await import("./fila-pendencias.server");
    return tentarAgora(data.fila, data.id);
  });

/** Pausa ou retoma o reenvio automático. */
export const pausarPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ fila: filaSchema, id: z.string().uuid(), pausar: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigeAdmin(context as unknown as Ctx);
    const { alternarPausa } = await import("./fila-pendencias.server");
    return alternarPausa(data.fila, data.id, data.pausar);
  });

/** Marca a pendência como resolvida manualmente. */
export const resolverPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fila: filaSchema,
        id: z.string().uuid(),
        motivo: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await exigeAdmin(ctx);
    const { resolverManualmente } = await import("./fila-pendencias.server");
    return resolverManualmente(data.fila, data.id, ctx.userId, data.motivo);
  });
