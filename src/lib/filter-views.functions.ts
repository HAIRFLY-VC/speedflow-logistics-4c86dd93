import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Visões de filtro salvas por usuário, com compartilhamento pessoa a pessoa. */

export type FilterViewColumnFilter = {
  type: "text" | "number" | "date";
  values?: string[];
  op?: string;
  value?: string | number | null;
  value2?: string | number | null;
};

export type FilterViewDefinition = {
  columnFilters?: Record<string, FilterViewColumnFilter>;
  sort?: { id: string; dir: "asc" | "desc" } | null;
};

export type FilterView = {
  id: string;
  name: string;
  tableKey: string;
  definition: FilterViewDefinition;
  ownerId: string;
  ownerName: string | null;
  shared: boolean;
};

export const listFilterViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tableKey: string }) => {
    if (!data?.tableKey) throw new Error("tableKey é obrigatório");
    return data;
  })
  .handler(async ({ data, context }): Promise<FilterView[]> => {
    const { supabase, userId } = context;

    const { data: minhas, error } = await supabase
      .from("table_filter_views")
      .select("id, name, table_key, definition, owner_id")
      .eq("owner_id", userId)
      .eq("table_key", data.tableKey)
      .order("name");
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shares } = await supabaseAdmin
      .from("table_filter_view_shares")
      .select("view_id")
      .eq("shared_with", userId);
    const ids = (shares ?? []).map((s) => s.view_id);

    let compartilhadas: typeof minhas = [];
    const nomes = new Map<string, string | null>();
    if (ids.length) {
      const { data: rows } = await supabaseAdmin
        .from("table_filter_views")
        .select("id, name, table_key, definition, owner_id")
        .in("id", ids)
        .eq("table_key", data.tableKey)
        .order("name");
      compartilhadas = rows ?? [];
      const owners = Array.from(new Set(compartilhadas.map((r) => r.owner_id)));
      if (owners.length) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", owners);
        for (const p of profs ?? []) nomes.set(p.id, p.full_name);
      }
    }

    const map = (r: (typeof minhas)[number], shared: boolean): FilterView => ({
      id: r.id,
      name: r.name,
      tableKey: r.table_key,
      definition: (r.definition ?? {}) as FilterViewDefinition,
      ownerId: r.owner_id,
      ownerName: shared ? nomes.get(r.owner_id) ?? null : null,
      shared,
    });

    return [
      ...(minhas ?? []).map((r) => map(r, false)),
      ...compartilhadas.map((r) => map(r, true)),
    ];
  });

export const saveFilterView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string | null;
      tableKey: string;
      name: string;
      definition: FilterViewDefinition;
    }) => {
      if (!data?.tableKey) throw new Error("tableKey é obrigatório");
      if (!data?.name?.trim()) throw new Error("Informe um nome para a visão");
      if (data.name.trim().length > 80) throw new Error("Nome muito longo");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      table_key: data.tableKey,
      name: data.name.trim(),
      definition: (data.definition ?? {}) as never,
    };

    if (data.id) {
      const { error } = await supabase
        .from("table_filter_views")
        .update(payload)
        .eq("id", data.id)
        .eq("owner_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("table_filter_views")
      .upsert(payload, { onConflict: "owner_id,table_key,name" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteFilterView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id é obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("table_filter_views")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Usuários ativos (para escolher com quem compartilhar) + quem já tem acesso. */
export const getFilterViewShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id é obrigatório");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: view, error: vErr } = await supabase
      .from("table_filter_views")
      .select("id")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!view) throw new Error("Visão não encontrada");

    const { data: shares, error: sErr } = await supabase
      .from("table_filter_view_shares")
      .select("shared_with")
      .eq("view_id", data.id);
    if (sErr) throw new Error(sErr.message);

    const { data: users, error: uErr } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    if (uErr) throw new Error(uErr.message);

    return {
      selecionados: (shares ?? []).map((s) => s.shared_with),
      usuarios: (users ?? [])
        .filter((u) => u.id !== userId)
        .map((u) => ({ id: u.id, nome: u.full_name ?? "Sem nome" })),
    };
  });

export const setFilterViewShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; userIds: string[] }) => {
    if (!data?.id) throw new Error("id é obrigatório");
    if (!Array.isArray(data.userIds)) throw new Error("userIds inválido");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: view, error: vErr } = await supabase
      .from("table_filter_views")
      .select("id")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!view) throw new Error("Visão não encontrada");

    const alvo = Array.from(new Set(data.userIds.filter((u) => u && u !== userId)));

    const { error: delErr } = await supabase
      .from("table_filter_view_shares")
      .delete()
      .eq("view_id", data.id);
    if (delErr) throw new Error(delErr.message);

    if (alvo.length) {
      const { error: insErr } = await supabase
        .from("table_filter_view_shares")
        .insert(alvo.map((u) => ({ view_id: data.id, shared_with: u })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true, total: alvo.length };
  });
