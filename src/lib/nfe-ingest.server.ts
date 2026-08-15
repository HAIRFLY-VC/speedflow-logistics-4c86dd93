// Ingestão de NF-e: parse do XML, upload no storage e gravação do registro.
import { centralDb } from "@/lib/central-db";
import { parseNfeXml } from "./nfe-parse.server";

export async function ingestNfeXml(xml: string) {
  const parsed = parseNfeXml(xml);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const storagePath = `${parsed.chave_acesso}.xml`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("nfe-xml")
    .upload(storagePath, new Blob([xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml",
    });
  if (upErr) throw new Error(`Falha ao armazenar o XML: ${upErr.message}`);

  const { error } = await centralDb.from("nfes").upsert(
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
}
