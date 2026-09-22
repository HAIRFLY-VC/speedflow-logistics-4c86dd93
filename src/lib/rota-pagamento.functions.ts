import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  PagamentoRotaHistorico,
  PreviewPagamentoRota,
} from "@/lib/rota-pagamento.types";

const motivoSchema = z.enum([
  "PERNOITE",
  "DESCARREGO",
  "DIFICULDADE_ENTREGA",
  "REENTREGA",
  "DIARIA",
]);

type Ctx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string };

async function podeAutorizar(context: Ctx) {
  const { data: pode } = await context.supabase.rpc("pode_autorizar_frete", {
    _user_id: context.userId,
  });
  if (!pode) throw new Error("Você não tem permissão para confirmar pagamento de frete.");
}

async function ehAdmin(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  return Boolean(data);
}

/** Prévia do rateio do frete da rota (agrupado por filial de faturamento). */
export const previewPagamentoRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        routeId: z.string().uuid(),
        valor: z.number().nonnegative(),
        tipo: z.enum(["FRETE", "ADICIONAL"]).default("FRETE"),
        motivo: motivoSchema.nullable().default(null),
        observacao: z.string().trim().max(1000).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PreviewPagamentoRota> => {
    await podeAutorizar(context as unknown as Ctx);
    const { montarPreviewPagamentoRota } = await import("./rota-pagamento.server");
    return montarPreviewPagamentoRota(data);
  });

/** Confirma o pagamento e enfileira ERP + tarefa do Bitrix. */
export const confirmarPagamentoRotaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        routeId: z.string().uuid(),
        valor: z.number().positive(),
        tipo: z.enum(["FRETE", "ADICIONAL"]).default("FRETE"),
        motivo: motivoSchema.nullable().default(null),
        observacao: z.string().trim().max(1000).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await podeAutorizar(ctx);
    const isAdmin = await ehAdmin(ctx);
    const { confirmarPagamentoRota } = await import("./rota-pagamento.server");
    return confirmarPagamentoRota({ ...data, userId: ctx.userId, isAdmin });
  });

/** Histórico de solicitações de pagamento da rota. */
export const listarPagamentosRota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ routeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PagamentoRotaHistorico[]> => {
    const { listarPagamentosDaRota } = await import("./rota-pagamento.server");
    return listarPagamentosDaRota(data.routeId);
  });
