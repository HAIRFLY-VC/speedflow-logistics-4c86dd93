// Ingestão de NF-e: parse do XML, gravação do XML completo no banco e das
// colunas de conferência. O upload no bucket é mantido apenas por
// compatibilidade — a leitura passa a ser sempre do banco.
import { parseNfeXml } from "./nfe-parse.server";
import { upsertComFallback } from "./xml-store.server";

export async function ingestNfeXml(xml: string, nsu?: number | null) {
  const parsed = parseNfeXml(xml);

  const storagePath = `${parsed.chave_acesso}.xml`;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from("nfe-xml")
      .upload(storagePath, new Blob([xml], { type: "application/xml" }), {
        upsert: true,
        contentType: "application/xml",
      });
  } catch {
    // o XML fica guardado no banco de qualquer forma
  }

  const { error } = await upsertComFallback(
    "nfes",
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
      peso_liquido: parsed.peso_liquido,
      volumes: parsed.volumes,
      especie_volumes: parsed.especie_volumes,
      itens: parsed.itens,
      xml_storage_path: storagePath,
      xml_conteudo: xml,
      nsu: nsu ?? null,
      xml_obtido_em: new Date().toISOString(),
    },
    "chave_acesso",
  );
  if (error) throw new Error(error.message);

  return { chave_acesso: parsed.chave_acesso };
}
