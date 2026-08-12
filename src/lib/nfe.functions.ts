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
    const { data: nfe, error } = await context.supabase
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

    const { error } = await supabaseAdmin
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
    const { data: nfe, error } = await context.supabase
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
