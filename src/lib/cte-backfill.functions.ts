import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão para esta operação");
}

/**
 * Preenche `nome_destinatario` dos CT-e já importados, lendo o XML armazenado.
 */
export const backfillNomeDestinatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseCteXml } = await import("./cte-parse.server");

    const { data: ctes, error } = await centralDb
      .from("ctes")
      .select("id, xml_storage_path")
      .is("nome_destinatario", null)
      .not("xml_storage_path", "is", null)
      .limit(500);
    if (error) throw new Error(error.message);

    let atualizados = 0;
    const erros: string[] = [];

    for (const c of ctes ?? []) {
      try {
        const { data: file, error: dlErr } = await supabaseAdmin.storage
          .from("cte-xml")
          .download(c.xml_storage_path as string);
        if (dlErr || !file) throw new Error(dlErr?.message ?? "XML não encontrado");
        const parsed = parseCteXml(await file.text());
        if (!parsed.nome_destinatario) continue;
        const { error: upErr } = await centralDb
          .from("ctes")
          .update({ nome_destinatario: parsed.nome_destinatario })
          .eq("id", c.id);
        if (upErr) throw new Error(upErr.message);
        atualizados++;
      } catch (e) {
        erros.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { total: ctes?.length ?? 0, atualizados, erros };
  });

/** Resolve o nome do destinatário de um CT-e específico a partir do XML armazenado. */
export const resolverNomeDestinatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { cteId?: string };
    if (!v?.cteId) throw new Error("cteId obrigatório");
    return { cteId: v.cteId };
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseCteXml } = await import("./cte-parse.server");

    const { data: cte, error } = await centralDb
      .from("ctes")
      .select("id, nome_destinatario, xml_storage_path")
      .eq("id", data.cteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cte) return { nome: null as string | null };
    if (cte.nome_destinatario) return { nome: cte.nome_destinatario };
    if (!cte.xml_storage_path) return { nome: null as string | null };

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("cte-xml")
      .download(cte.xml_storage_path);
    if (dlErr || !file) return { nome: null as string | null };

    const parsed = parseCteXml(await file.text());
    if (!parsed.nome_destinatario) return { nome: null as string | null };

    await centralDb
      .from("ctes")
      .update({ nome_destinatario: parsed.nome_destinatario })
      .eq("id", cte.id);

    return { nome: parsed.nome_destinatario };
  });

/** Lê o endereço de entrega (enderDest) do XML armazenado de um CT-e. */
export const obterEnderecoEntregaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const v = input as { cteId?: string };
    if (!v?.cteId) throw new Error("cteId obrigatório");
    return { cteId: v.cteId };
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parseEnderecoDestinatario } = await import("./cte-parse.server");

    const { data: cte, error } = await centralDb
      .from("ctes")
      .select("id, xml_storage_path")
      .eq("id", data.cteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cte?.xml_storage_path) return { endereco: null };

    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("cte-xml")
      .download(cte.xml_storage_path);
    if (dlErr || !file) return { endereco: null };

    return { endereco: parseEnderecoDestinatario(await file.text()) };
  });
