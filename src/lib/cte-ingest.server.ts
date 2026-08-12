// Ingestão de CT-e: parse do XML, upload do arquivo e gravação do registro.
// Usado tanto pela server function autenticada quanto pela rota pública de captura.
import { parseCteXml, type ParsedCte } from "./cte-parse.server";

export type IngestResult = {
  ok: boolean;
  cte_id?: string;
  chave_acesso: string;
  status: string;
  duplicated?: boolean;
  message?: string;
};

export async function ingestCteXml(params: {
  xml: string;
  origem: "MANUAL" | "SEFAZ_AUTO";
}): Promise<IngestResult> {
  const parsed: ParsedCte = parseCteXml(params.xml);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("ctes")
    .select("id, status")
    .eq("chave_acesso", parsed.chave_acesso)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      cte_id: existing.id,
      chave_acesso: parsed.chave_acesso,
      status: existing.status,
      duplicated: true,
      message: "CT-e já cadastrado",
    };
  }

  let transportadoraId: string | null = null;
  if (parsed.cnpj_emitente) {
    const { data } = await supabaseAdmin
      .from("transportadoras")
      .select("id")
      .eq("cnpj", parsed.cnpj_emitente)
      .maybeSingle();
    transportadoraId = data?.id ?? null;
  }

  let empresaId: string | null = null;
  if (parsed.cnpj_destinatario) {
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("cnpj", parsed.cnpj_destinatario)
      .maybeSingle();
    empresaId = data?.id ?? null;
  }

  const storagePath = `${parsed.chave_acesso}.xml`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("cte-xml")
    .upload(storagePath, new Blob([params.xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml",
    });
  if (upErr) throw new Error(`Falha ao armazenar o XML: ${upErr.message}`);

  const status = transportadoraId ? "RECEBIDO" : "PENDENTE_IDENTIFICACAO";

  const { data: inserted, error } = await supabaseAdmin
    .from("ctes")
    .insert({
      chave_acesso: parsed.chave_acesso,
      numero: parsed.numero,
      serie: parsed.serie,
      transportadora_id: transportadoraId,
      empresa_id: empresaId,
      cnpj_emitente: parsed.cnpj_emitente,
      cnpj_destinatario: parsed.cnpj_destinatario,
      data_emissao: parsed.data_emissao,
      valor_total_frete: parsed.valor_total_frete,
      valor_mercadoria: parsed.valor_mercadoria,
      peso_taxado: parsed.peso_taxado,
      uf_destino: parsed.uf_destino,
      componentes: parsed.componentes,
      nfs_referenciadas: parsed.nfs_referenciadas,
      xml_storage_path: storagePath,
      origem_captura: params.origem,
      status,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Auditoria automática assim que o CT-e é identificado.
  if (transportadoraId) {
    try {
      const { auditCte } = await import("./cte-audit.server");
      const outcome = await auditCte(supabaseAdmin, inserted.id);
      return {
        ok: true,
        cte_id: inserted.id,
        chave_acesso: parsed.chave_acesso,
        status: outcome.resultado === "OK" ? "APROVADO" : "DIVERGENTE",
      };
    } catch {
      // mantém o CT-e recebido para auditoria manual
    }
  }

  return { ok: true, cte_id: inserted.id, chave_acesso: parsed.chave_acesso, status };
}
