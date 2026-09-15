import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIDEBAR_KEY = "ui:sidebar";

export const getSidebarPref = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_table_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .eq("table_key", SIDEBAR_KEY)
      .maybeSingle();
    if (error) throw error;
    const prefs = (data?.preferences ?? null) as { open?: boolean } | null;
    return { open: prefs?.open ?? true };
  });

export const saveSidebarPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { open: boolean }) => {
    if (typeof data?.open !== "boolean") throw new Error("open is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_table_preferences").upsert(
      {
        user_id: userId,
        table_key: SIDEBAR_KEY,
        preferences: { open: data.open } as never,
      },
      { onConflict: "user_id,table_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

const SEPARACAO_HORA_KEY = "ui:separacao-hora";
type MetricaHora = "pedidos" | "caixas";

export const getSeparacaoChartPref = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_table_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .eq("table_key", SEPARACAO_HORA_KEY)
      .maybeSingle();
    if (error) throw error;
    const prefs = (data?.preferences ?? null) as { metrica?: MetricaHora } | null;
    return { metrica: prefs?.metrica === "caixas" ? "caixas" : ("pedidos" as MetricaHora) };
  });

export const saveSeparacaoChartPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { metrica: MetricaHora }) => {
    if (data?.metrica !== "pedidos" && data?.metrica !== "caixas") {
      throw new Error("metrica inválida");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_table_preferences").upsert(
      {
        user_id: userId,
        table_key: SEPARACAO_HORA_KEY,
        preferences: { metrica: data.metrica } as never,
      },
      { onConflict: "user_id,table_key" },
    );
    if (error) throw error;
    return { ok: true };
  });
