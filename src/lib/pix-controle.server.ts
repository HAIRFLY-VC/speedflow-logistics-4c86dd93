/**
 * Controle do PIX do responsável pelo frete (server-only).
 * - PIX obrigatório para fretista (tipo F).
 * - PIX diferente do usado na última autorização fica bloqueado até um
 *   administrador liberar a troca.
 */
import { centralDb } from "./central-db";
import type { SituacaoPix } from "./rota-pagamento.types";

const norm = (v: string | null | undefined) => (v ?? "").trim();
const normPix = (v: string | null | undefined) => norm(v).toLowerCase();

export async function situacaoPix(codErp: string | null): Promise<SituacaoPix> {
  const cod = norm(codErp);
  if (!cod) {
    return { cod_erp: null, tipo: null, pix: null, favorecido: null, pix_referencia: null, bloqueio: null };
  }
  const { data: resp } = await centralDb
    .from("erp_responsaveis")
    .select("cod_erp, razao_social, tipo_frete, pix")
    .eq("cod_erp", cod)
    .maybeSingle();
  const r = (resp ?? null) as { razao_social: string | null; tipo_frete: string | null; pix: string | null } | null;
  const tipo = (r?.tipo_frete ?? null) as SituacaoPix["tipo"];
  const pix = norm(r?.pix) || null;
  const favorecido = norm(r?.razao_social) || null;

  // Referência: o mais recente entre a última autorização e a última liberação.
  const [ordemR, libR] = await Promise.all([
    centralDb
      .from("ordens_pagamento_frete")
      .select("pix_utilizado, created_at")
      .eq("cod_responsavel_pix" as never, cod)
      .not("pix_utilizado" as never, "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    centralDb
      .from("pix_liberacoes" as never)
      .select("pix_novo, liberado_em")
      .eq("cod_erp", cod)
      .order("liberado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const ordem = (ordemR.data ?? null) as { pix_utilizado: string; created_at: string } | null;
  const lib = (libR.data ?? null) as { pix_novo: string; liberado_em: string } | null;
  let referencia: string | null = null;
  if (ordem && lib) referencia = ordem.created_at > lib.liberado_em ? ordem.pix_utilizado : lib.pix_novo;
  else referencia = ordem?.pix_utilizado ?? lib?.pix_novo ?? null;

  let bloqueio: SituacaoPix["bloqueio"] = null;
  if (tipo === "F" && !pix) bloqueio = "SEM_PIX";
  else if (pix && referencia && normPix(referencia) !== normPix(pix)) bloqueio = "PIX_ALTERADO";

  return { cod_erp: cod, tipo, pix, favorecido, pix_referencia: referencia, bloqueio };
}

export function mensagemBloqueioPix(s: SituacaoPix): string | null {
  if (s.bloqueio === "SEM_PIX") {
    return `Fretista sem PIX cadastrado no ERP. Cadastre o contato PIX do fretista (código ${s.cod_erp}) e clique em "Atualizar cadastro" na tela Transportadoras.`;
  }
  if (s.bloqueio === "PIX_ALTERADO") {
    return `PIX alterado (anterior: ${s.pix_referencia}; novo: ${s.pix}) — aguardando liberação de um administrador.`;
  }
  return null;
}

/** Descobre o código do responsável da rota (código gravado ou nome do motorista). */
export async function codResponsavelDaRota(rota: {
  erp_carrier_code: string | null;
  driver_name: string | null;
}): Promise<string | null> {
  if (norm(rota.erp_carrier_code)) return norm(rota.erp_carrier_code);
  const nome = norm(rota.driver_name);
  if (nome.length < 4) return null;
  const { data } = await centralDb
    .from("erp_responsaveis")
    .select("cod_erp")
    .ilike("razao_social", nome)
    .limit(1)
    .maybeSingle();
  return norm((data as { cod_erp?: string } | null)?.cod_erp) || null;
}

export async function liberarPix(codErp: string, userId: string) {
  const s = await situacaoPix(codErp);
  if (!s.pix) throw new Error("O responsável não tem PIX cadastrado para liberar.");
  const { error } = await centralDb.from("pix_liberacoes" as never).insert({
    cod_erp: s.cod_erp,
    pix_anterior: s.pix_referencia,
    pix_novo: s.pix,
    liberado_por: userId,
  } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}
