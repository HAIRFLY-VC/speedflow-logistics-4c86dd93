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

type LogEntry = {
  origem: "MANUAL" | "SEFAZ_AUTO";
  resultado: "CRIADO" | "DUPLICADO" | "ERRO" | "IGNORADO";
  chave_acesso?: string | null;
  cnpj_emitente?: string | null;
  cnpj_destinatario?: string | null;
  cnpj_remetente?: string | null;
  nome_remetente?: string | null;
  mensagem?: string | null;
  cte_id?: string | null;
};

/** Grava o recebimento (sucesso, duplicado ou erro) no log de ingestão. */
export async function logCteIngest(entry: LogEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("cte_ingest_logs").insert({
      origem: entry.origem,
      resultado: entry.resultado,
      chave_acesso: entry.chave_acesso ?? null,
      cnpj_emitente: entry.cnpj_emitente ?? null,
      cnpj_destinatario: entry.cnpj_destinatario ?? null,
      cnpj_remetente: entry.cnpj_remetente ?? null,
      nome_remetente: entry.nome_remetente ?? null,
      mensagem: entry.mensagem ?? null,
      cte_id: entry.cte_id ?? null,
    });
  } catch {
    // log nunca deve derrubar a ingestão
  }
}

export async function ingestCteXml(params: {
  xml: string;
  origem: "MANUAL" | "SEFAZ_AUTO";
}): Promise<IngestResult> {
  const parsed: ParsedCte = parseCteXml(params.xml);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Só importa CT-e cujo REMETENTE seja uma das empresas cadastradas (detentoras do certificado A1).
  let empresaRemetenteId: string | null = null;
  if (parsed.cnpj_remetente) {
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("id, razao_social")
      .eq("cnpj", parsed.cnpj_remetente)
      .maybeSingle();
    empresaRemetenteId = data?.id ?? null;
    // Completa a razão social quando ela foi cadastrada apenas com o CNPJ.
    if (
      data?.id &&
      parsed.nome_remetente &&
      (!data.razao_social || data.razao_social === `Empresa ${parsed.cnpj_remetente}`)
    ) {
      await supabaseAdmin
        .from("empresas")
        .update({ razao_social: parsed.nome_remetente })
        .eq("id", data.id);
    }
  }
  if (!empresaRemetenteId) {
    const msg = `CT-e ignorado: remetente ${parsed.cnpj_remetente ?? "não informado"}${
      parsed.nome_remetente ? ` (${parsed.nome_remetente})` : ""
    } não é uma empresa cadastrada`;
    await logCteIngest({
      origem: params.origem,
      resultado: "IGNORADO",
      chave_acesso: parsed.chave_acesso,
      cnpj_emitente: parsed.cnpj_emitente,
      cnpj_destinatario: parsed.cnpj_destinatario,
      cnpj_remetente: parsed.cnpj_remetente,
      nome_remetente: parsed.nome_remetente,
      mensagem: msg,
    });
    return {
      ok: true,
      chave_acesso: parsed.chave_acesso,
      status: "IGNORADO",
      message: msg,
    };
  }


  const { data: existing } = await supabaseAdmin
    .from("ctes")
    .select("id, status")
    .eq("chave_acesso", parsed.chave_acesso)
    .maybeSingle();

  if (existing) {
    await logCteIngest({
      origem: params.origem,
      resultado: "DUPLICADO",
      chave_acesso: parsed.chave_acesso,
      cnpj_emitente: parsed.cnpj_emitente,
      cnpj_destinatario: parsed.cnpj_destinatario,
      cnpj_remetente: parsed.cnpj_remetente,
      nome_remetente: parsed.nome_remetente,
      mensagem: "CT-e já cadastrado",
      cte_id: existing.id,
    });
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

  const empresaId: string | null = empresaRemetenteId;

  const storagePath = `${parsed.chave_acesso}.xml`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("cte-xml")
    .upload(storagePath, new Blob([params.xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml",
    });
  if (upErr) throw new Error(`Falha ao armazenar o XML: ${upErr.message}`);

  const status = transportadoraId && empresaId ? "RECEBIDO" : "PENDENTE_IDENTIFICACAO";

  const { data: inserted, error } = await supabaseAdmin
    .from("ctes")
    .insert({
      chave_acesso: parsed.chave_acesso,
      numero: parsed.numero,
      serie: parsed.serie,
      transportadora_id: transportadoraId,
      empresa_id: empresaId,
      cnpj_emitente: parsed.cnpj_emitente,
      nome_emitente: parsed.nome_emitente,
      cnpj_destinatario: parsed.cnpj_destinatario,
      data_emissao: parsed.data_emissao,
      valor_total_frete: parsed.valor_total_frete,
      valor_mercadoria: parsed.valor_mercadoria,
      peso_taxado: parsed.peso_taxado,
      uf_destino: parsed.uf_destino,
      componentes: parsed.componentes,
      nfs_referenciadas: parsed.nfs_referenciadas,
      tipo_cte: parsed.tipo_cte,
      chave_cte_complementado: parsed.chave_cte_complementado,
      xml_storage_path: storagePath,
      origem_captura: params.origem,
      status,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logCteIngest({
    origem: params.origem,
    resultado: "CRIADO",
    chave_acesso: parsed.chave_acesso,
    cnpj_emitente: parsed.cnpj_emitente,
    cnpj_destinatario: parsed.cnpj_destinatario,
      cnpj_remetente: parsed.cnpj_remetente,
      nome_remetente: parsed.nome_remetente,
    mensagem: transportadoraId
      ? empresaId
        ? null
        : "Empresa remetente não cadastrada"
      : "Transportadora emitente não cadastrada",
    cte_id: inserted.id,
  });

  // Auditoria automática assim que o CT-e é identificado.
  if (transportadoraId && empresaId) {
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
