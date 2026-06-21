import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TablePreferences = {
  columns?: Array<{ id: string; visible: boolean; order: number }>;
  sort?: { id: string; dir: "asc" | "desc" } | null;
  filters?: Record<string, string>;
};

export const getTablePrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tableKey: string }) => {
    if (!data?.tableKey || typeof data.tableKey !== "string") {
      throw new Error("tableKey is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_table_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .eq("table_key", data.tableKey)
      .maybeSingle();
    if (error) throw error;
    return (row?.preferences ?? null) as TablePreferences | null;
  });

export const saveTablePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tableKey: string; preferences: TablePreferences }) => {
    if (!data?.tableKey || typeof data.tableKey !== "string") {
      throw new Error("tableKey is required");
    }
    if (!data.preferences || typeof data.preferences !== "object") {
      throw new Error("preferences is required");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_table_preferences").upsert(
      {
        user_id: userId,
        table_key: data.tableKey,
        preferences: data.preferences as never,
      },
      { onConflict: "user_id,table_key" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const resetTablePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tableKey: string }) => {
    if (!data?.tableKey) throw new Error("tableKey is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_table_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("table_key", data.tableKey);
    if (error) throw error;
    return { ok: true };
  });
