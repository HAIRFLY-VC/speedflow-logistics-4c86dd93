import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Preenche `nome_destinatario` dos CT-e já importados, lendo o XML armazenado. */
export const backfillNomeDestinatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("./cte-backfill.server");
    await m.assertStaff(context);
    return m.runBackfillNomeDestinatario();
  });

/** Resolve o nome do destinatário de um CT-e específico a partir do XML armazenado. */
export const resolverNomeDestinatario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { cteId?: string };
    if (!v?.cteId) throw new Error("cteId obrigatório");
    return { cteId: v.cteId };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const m = await import("./cte-backfill.server");
    await m.assertStaff(context);
    return m.runResolverNomeDestinatario(data.cteId);
  });

/** Lê o endereço de entrega (enderDest) do XML armazenado de um CT-e. */
export const obterEnderecoEntregaCte = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = input as { cteId?: string };
    if (!v?.cteId) throw new Error("cteId obrigatório");
    return { cteId: v.cteId };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const m = await import("./cte-backfill.server");
    await m.assertStaff(context);
    return m.runObterEnderecoEntregaCte(data.cteId);
  });

/**
 * Recalcula o tomador do serviço (e a empresa responsável) de CT-e já
 * capturados, relendo o XML armazenado.
 */
export const reprocessarIdentificacaoCtes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const v = (input ?? {}) as { cteIds?: string[]; somentePendentes?: boolean };
    return {
      cteIds: Array.isArray(v.cteIds) ? v.cteIds.filter((i) => typeof i === "string") : null,
      somentePendentes: !!v.somentePendentes,
    };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const m = await import("./cte-backfill.server");
    await m.assertStaff(context);
    return m.runReprocessarIdentificacaoCtes(data);
  });
