import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mensagemErro } from "@/lib/mensagem-erro";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  roles: z
    .array(z.enum(["adm", "gestor", "operador", "fretista"]))
    .min(1)
    .max(4),
});

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

async function ensureAdmin(context: {
  supabase: { rpc: (name: "has_role", args: { _user_id: string; _role: "adm" }) => PromiseLike<{ data: boolean | null; error: unknown }> };
  userId: string;
}) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  if (error) throw new Error(mensagemErro(error));
  if (!isAdmin) throw new Error("Apenas administradores podem gerenciar usuários");
}

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  emailConfirmedAt: string | null;
  isActive: boolean;
};

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authError) throw new Error(mensagemErro(authError));

    const ids = authData.users.map((user) => user.id);
    const profilesById = new Map<string, { full_name: string | null; phone: string | null; is_active: boolean }>();
    if (ids.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, is_active")
        .in("id", ids);
      if (profilesError) throw new Error(mensagemErro(profilesError));
      for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
    }

    return authData.users.map((user) => {
      const profile = profilesById.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null),
        phone: profile?.phone ?? null,
        createdAt: user.created_at,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        isActive: profile?.is_active ?? true,
      };
    });
  });

export const confirmManagedUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email_confirm: true,
    });
    if (error) throw new Error(mensagemErro(error, "Não foi possível confirmar o e-mail."));
    return { userId: updated.user.id, emailConfirmedAt: updated.user.email_confirmed_at ?? null };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Você não pode excluir sua própria conta enquanto estiver conectado.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(mensagemErro(error, "Não foi possível excluir o usuário."));
    return { userId: data.userId };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize: only adm can invite
    await ensureAdmin(context);

    // Create or fetch the auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { full_name: data.fullName } },
    );

    let userId: string | undefined = created?.user?.id;

    if (createErr) {
      // If user already exists, look it up
      if (
        createErr.message.toLowerCase().includes("already") ||
        createErr.message.toLowerCase().includes("registered")
      ) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) throw new Error(mensagemErro(listErr));
        const existing = list.users.find(
          (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
        );
        if (!existing) throw new Error(mensagemErro(createErr, "Não foi possível criar o usuário."));
        userId = existing.id;
      } else {
        throw new Error(mensagemErro(createErr, "Não foi possível criar o usuário."));
      }
    }

    if (!userId) throw new Error("Falha ao criar usuário");

    // Ensure profile exists
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName }, { onConflict: "id" });

    // Insert roles (ignore conflicts)
    const rows = data.roles.map((role) => ({ user_id: userId, role }));
    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(rows, { onConflict: "user_id,role" });
    if (rolesErr) throw new Error(mensagemErro(rolesErr));

    return { userId, email: data.email };
  });
