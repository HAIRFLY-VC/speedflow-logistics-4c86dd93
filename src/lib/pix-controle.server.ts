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
    return `Fretista sem PIX cadastrado no ERP (código ${s.cod_erp}). Cadastre o contato PIX no ERP e clique em "Consultar PIX no ERP".`;
  }
  if (s.bloqueio === "PIX_ALTERADO") {
    // Nunca exibir a chave PIX. A mensagem do servidor não pode conter as chaves,
    // pois o erro chega à tela via toast (rota-pagamento.server.ts).
    return "PIX alterado — aguardando liberação de um administrador.";
  }
  return null;
}

/** Busca no ERP o código do responsável (COD_FRT_TRP) da rota. */
export async function codResponsavelNoErp(erpRouteId: string): Promise<string | null> {
  const id = Number(norm(erpRouteId));
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!Number.isFinite(id) || id <= 0 || !baseUrl || !apiKey) return null;
  const base = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${base}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        sql: `select R.COD_FRT_TRP COD from gks.a_ger_rotas R where R.ID = ${id}`,
        binds: {},
        limit: 1,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const rows = ((await res.json()) as { rows?: Record<string, unknown>[] }).rows ?? [];
    const row = rows[0] ?? {};
    const v = Object.entries(row).find(([k]) => k.toUpperCase() === "COD")?.[1];
    return norm(v == null ? null : String(v)) || null;
  } catch (e) {
    console.error("codResponsavelNoErp", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Descobre o código do responsável da rota (código gravado, nome do motorista ou ERP). */
export async function codResponsavelDaRota(rota: {
  id?: string;
  erp_route_id?: string | null;
  erp_carrier_code: string | null;
  driver_name: string | null;
}): Promise<string | null> {
  if (norm(rota.erp_carrier_code)) return norm(rota.erp_carrier_code);
  const nome = norm(rota.driver_name);
  if (nome.length >= 4) {
    const { data } = await centralDb
      .from("erp_responsaveis")
      .select("cod_erp")
      .ilike("razao_social", nome)
      .limit(1)
      .maybeSingle();
    const cod = norm((data as { cod_erp?: string } | null)?.cod_erp);
    if (cod) return cod;
  }
  if (!rota.erp_route_id) return null;
  const cod = await codResponsavelNoErp(rota.erp_route_id);
  if (cod && rota.id) {
    const { data: resp } = await centralDb
      .from("erp_responsaveis")
      .select("razao_social")
      .eq("cod_erp", cod)
      .maybeSingle();
    const razao = norm((resp as { razao_social?: string } | null)?.razao_social) || null;
    await centralDb
      .from("routes")
      .update({ erp_carrier_code: cod, ...(razao && !nome ? { driver_name: razao } : {}) } as never)
      .eq("id", rota.id);
  }
  return cod;
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
