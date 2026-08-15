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
    const { parseNfeXml } = await import("./nfe-parse.server");
    const parsed = parseNfeXml(data.xml);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storagePath = `${parsed.chave_acesso}.xml`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("nfe-xml")
      .upload(storagePath, new Blob([data.xml], { type: "application/xml" }), {
        upsert: true,
        contentType: "application/xml",
      });
    if (upErr) throw new Error(`Falha ao armazenar o XML: ${upErr.message}`);

    const { error } = await centralDb
      .from("nfes")
      .upsert(
        {
          chave_acesso: parsed.chave_acesso,
          numero: parsed.numero,
          serie: parsed.serie,
          natureza_operacao: parsed.natureza_operacao,
          cnpj_emitente: parsed.cnpj_emitente,
          nome_emitente: parsed.nome_emitente,
          cnpj_destinatario: parsed.cnpj_destinatario,
          nome_destinatario: parsed.nome_destinatario,
          uf_destino: parsed.uf_destino,
          data_emissao: parsed.data_emissao,
          valor_total: parsed.valor_total,
          valor_produtos: parsed.valor_produtos,
          valor_frete: parsed.valor_frete,
          peso_bruto: parsed.peso_bruto,
          itens: parsed.itens,
          xml_storage_path: storagePath,
        },
        { onConflict: "chave_acesso" },
      );
    if (error) throw new Error(error.message);

    return { chave_acesso: parsed.chave_acesso };
  });

export const getNfeXmlUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: nfe, error } = await centralDb
      .from("nfes")
      .select("xml_storage_path")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!nfe?.xml_storage_path) throw new Error("XML não disponível para esta NF-e");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("nfe-xml")
      .createSignedUrl(nfe.xml_storage_path, 300);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Falha ao gerar link");
    return { url: signed.signedUrl };
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      return { status: "PENDENTE" as const, mensagem: null as string | null };
    }

    if (sol.status === "ERRO") {
      await centralDb
        .from("nfe_solicitacoes")
        .update({ status: "PENDENTE", mensagem: null })
        .eq("id", sol.id);
      return { status: "PENDENTE" as const, mensagem: null as string | null };
    }

    return { status: sol.status, mensagem: null as string | null };
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
