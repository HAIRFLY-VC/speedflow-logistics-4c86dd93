import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

export const solicitarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);

    const { data: pendente } = await context.supabase
      .from("cte_captura_comandos")
      .select("id, status, created_at")
      .in("status", ["PENDENTE", "PROCESSANDO"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendente) {
      return { id: pendente.id as string, jaSolicitado: true };
    }

    const { data, error } = await context.supabase
      .from("cte_captura_comandos")
      .insert({ solicitado_por: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: data.id as string, jaSolicitado: false };
  });

export const getUltimoComandoCaptura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("cte_captura_comandos")
      .select("id, status, mensagem, novos_ctes, created_at, concluido_em")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });
