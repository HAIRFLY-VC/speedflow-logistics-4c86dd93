import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(120),
  roles: z
    .array(z.enum(["adm", "gestor", "operador", "fretista"]))
    .min(1)
    .max(4),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize: only adm can invite
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "adm",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Apenas administradores podem convidar usuários");

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
        if (listErr) throw new Error(listErr.message);
        const existing = list.users.find(
          (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
        );
        if (!existing) throw new Error(createErr.message);
        userId = existing.id;
      } else {
        throw new Error(createErr.message);
      }
    }

    if (!userId) throw new Error("Falha ao criar usuário");

    // Ensure profile exists
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: data.fullName }, { onConflict: "id" });

    // Insert roles (ignore conflicts)
    const rows = data.roles.map((role) => ({ user_id: userId!, role }));
    const { error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(rows, { onConflict: "user_id,role" });
    if (rolesErr) throw new Error(rolesErr.message);

    return { userId, email: data.email };
  });
