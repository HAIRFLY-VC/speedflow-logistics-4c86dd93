/**
 * Configuração dos participantes das tarefas do Bitrix (tela Configurações).
 * - Listar usuários ativos do Bitrix (código, nome, cargo, e-mail).
 * - Ler/gravar responsável e observadores padrão (só administradores).
 * - Vínculo usuário do app ↔ usuário do Bitrix (só administradores gravam).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string };

async function exigirAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  if (!data) throw new Error("Apenas administradores podem alterar a configuração do Bitrix.");
}

export type UsuarioBitrixDto = {
  id: number;
  nome: string;
  email: string | null;
  cargo: string | null;
};

export type ConfigBitrixDto = {
  responsavel_id: number | null;
  responsavel_nome: string | null;
  observadores: { id: number; nome: string }[];
};

export type UsuarioAppVinculoDto = {
  id: string;
  full_name: string | null;
  email: string | null;
  bitrix_user_id: number | null;
  bitrix_user_nome: string | null;
};

/** Lista os usuários ativos do Bitrix (qualquer usuário logado pode ler). */
export const listarUsuariosBitrixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<UsuarioBitrixDto[]> => {
    const { listarUsuariosBitrix } = await import("./bitrix-task.server");
    return listarUsuariosBitrix();
  });

/** Lê a configuração de participantes das tarefas. */
export const obterConfigBitrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ConfigBitrixDto> => {
    const { obterConfigTarefa } = await import("./bitrix-task.server");
    return obterConfigTarefa();
  });

/** Grava responsável e observadores padrão (só administradores). */
export const salvarConfigBitrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        responsavel_id: z.number().int().positive(),
        responsavel_nome: z.string().trim().max(200).nullable().default(null),
        observadores: z
          .array(z.object({ id: z.number().int().positive(), nome: z.string().trim().max(200) }))
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as unknown as Ctx);
    const { centralDb } = await import("./central-db");
    const { error } = await centralDb.from("bitrix_task_config" as never).upsert(
      {
        id: 1,
        responsavel_id: data.responsavel_id,
        responsavel_nome: data.responsavel_nome,
        observadores: data.observadores,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
    if (error) throw new Error((error as { message: string }).message);
    return { ok: true };
  });

/** Lista os usuários do app com o vínculo atual (só administradores). */
export const listarVinculosBitrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsuarioAppVinculoDto[]> => {
    await exigirAdmin(context as unknown as Ctx);
    const { centralDb } = await import("./central-db");
    const { data, error } = await centralDb
      .from("profiles")
      .select("id, full_name, email, bitrix_user_id, bitrix_user_nome")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as UsuarioAppVinculoDto[];
  });

/** Grava o vínculo de um usuário do app com um usuário do Bitrix (só adm). */
export const salvarVinculoBitrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        bitrix_user_id: z.number().int().positive().nullable(),
        bitrix_user_nome: z.string().trim().max(200).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context as unknown as Ctx);
    const { centralDb } = await import("./central-db");
    const { error } = await centralDb
      .from("profiles")
      .update({
        bitrix_user_id: data.bitrix_user_id,
        bitrix_user_nome: data.bitrix_user_id ? data.bitrix_user_nome : null,
      } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Vínculo do usuário logado (usado para habilitar/desabilitar Confirmar Pgto). */
export const meuVinculoBitrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ bitrix_user_id: number; bitrix_user_nome: string | null } | null> => {
    const ctx = context as unknown as Ctx;
    const { vinculoBitrixDoUsuario } = await import("./bitrix-task.server");
    return vinculoBitrixDoUsuario(ctx.userId);
  });
