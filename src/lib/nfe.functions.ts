import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chaveSchema = z.object({ chave: z.string().regex(/^\d{44}$/) });

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

export const getNfe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: nfe, error } = await centralDb
      .from("nfes")
      .select("*")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { nfe: nfe ?? null };
  });

export const uploadNfeXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ xml: z.string().min(50).max(8_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { ingestNfeXml } = await import("./nfe-ingest.server");
    return ingestNfeXml(data.xml);
  });

export const getNfeXmlUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { lerXml } = await import("./xml-store.server");
    const xml = await lerXml("nfes", { coluna: "chave_acesso", valor: data.chave }, "nfe-xml");
    if (!xml) throw new Error("XML não disponível para esta NF-e");
    return { xml };
  });

export const solicitarNfeXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { data: existente } = await centralDb
      .from("nfes")
      .select("chave_acesso")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (existente) return { status: "CONCLUIDA" as const, mensagem: null as string | null };

    // 1) Tenta o ERP (Oracle) — é lá que estão as notas emitidas pela empresa.
    const { importarNfeDoErp } = await import("./nfe-erp.server");
    const erp = await importarNfeDoErp(data.chave);
    if (erp.ok) {
      await centralDb
        .from("nfe_solicitacoes")
        .update({ status: "CONCLUIDA", mensagem: "XML obtido no ERP" })
        .eq("chave_acesso", data.chave);
      return { status: "CONCLUIDA" as const, mensagem: "XML obtido no ERP" as string | null };
    }
    const erpMensagem = erp.mensagem;

    const { data: sol } = await centralDb
      .from("nfe_solicitacoes")
      .select("id, status")
      .eq("chave_acesso", data.chave)
      .maybeSingle();

    if (!sol) {
      const { error } = await centralDb.from("nfe_solicitacoes").insert({
        chave_acesso: data.chave,
        solicitado_por: context.userId,
        status: "PENDENTE",
      });
      if (error) throw new Error(error.message);
      return { status: "PENDENTE" as const, mensagem: erpMensagem };
    }

    if (sol.status === "ERRO") {
      await centralDb
        .from("nfe_solicitacoes")
        .update({ status: "PENDENTE", mensagem: erpMensagem })
        .eq("id", sol.id);
      return { status: "PENDENTE" as const, mensagem: erpMensagem };
    }

    return { status: sol.status, mensagem: erpMensagem };
  });

export const getNfeSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: sol, error } = await centralDb
      .from("nfe_solicitacoes")
      .select("status, mensagem, tentativas, updated_at")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { solicitacao: sol ?? null };
  });
