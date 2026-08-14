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
  .inputValidator((data?: { reiniciarNsu?: boolean }) => ({
    reiniciarNsu: Boolean(data?.reiniciarNsu),
  }))
  .handler(async ({ context, data }) => {
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

    const { data: novo, error } = await context.supabase
      .from("cte_captura_comandos")
      .insert({ solicitado_por: context.userId, reiniciar_nsu: data.reiniciarNsu })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: novo.id as string, jaSolicitado: false };
  });


const LIMITE_PENDENTE_MS = 3 * 60 * 1000;
const LIMITE_PROCESSANDO_MS = 10 * 60 * 1000;

export const getUltimoComandoCaptura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("cte_captura_comandos")
      .select("id, status, mensagem, novos_ctes, created_at, iniciado_em, concluido_em")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    // Expira comandos que o robô nunca assumiu ou deixou travados.
    const inicio = new Date((data.iniciado_em ?? data.created_at) as string).getTime();
    const decorrido = Date.now() - inicio;
    const expirado =
      (data.status === "PENDENTE" && decorrido > LIMITE_PENDENTE_MS) ||
      (data.status === "PROCESSANDO" && decorrido > LIMITE_PROCESSANDO_MS);

    if (expirado) {
      const mensagem =
        "Robô não respondeu — verifique se o serviço local está atualizado e ativo.";
      await context.supabase
        .from("cte_captura_comandos")
        .update({ status: "ERRO", mensagem, concluido_em: new Date().toISOString() })
        .eq("id", data.id);
      return { ...data, status: "ERRO", mensagem };
    }

    return data;
  });

export const cancelarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("cte_captura_comandos")
      .update({
        status: "ERRO",
        mensagem: "Cancelado pelo usuário",
        concluido_em: new Date().toISOString(),
      })
      .in("status", ["PENDENTE", "PROCESSANDO"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

