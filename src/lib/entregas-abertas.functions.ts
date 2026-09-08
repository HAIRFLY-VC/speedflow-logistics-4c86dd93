import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { centralDb } from "@/lib/central-db";

/** Gravação das anotações (ação / responsável / prazo) das entregas em aberto. */

type Input = {
  nroNf: string;
  codPedido: string;
  acao: string | null;
  responsavel: string | null;
  prazo: string | null; // yyyy-MM-dd
};

async function ensureStaff(context: { supabase: any; userId: string }) {
  for (const r of ["adm", "gestor", "operador"] as const) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: r,
    });
    if (data) return;
  }
  throw new Error("Sem permissão para editar entregas");
}

export const salvarAcaoEntrega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    await ensureStaff(context as never);
    const { error } = await centralDb.from("entregas_acoes").upsert(
      {
        nro_nf: data.nroNf,
        cod_pedido: data.codPedido,
        acao: data.acao?.trim() || null,
        responsavel: data.responsavel?.trim() || null,
        prazo: data.prazo || null,
        atualizado_por: context.userId,
        atualizado_em: new Date().toISOString(),
      } as never,
      { onConflict: "nro_nf,cod_pedido" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
