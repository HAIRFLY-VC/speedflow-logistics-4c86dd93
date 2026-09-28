/**
 * Lançamento direto dos valores de frete no ERP (sem n8n) e consolidação
 * do status da ordem de pagamento / CT-e. Server-only.
 */
import { centralDb } from "./central-db";

const CAMPOS = [
  "vlr_frete",
  "vlr_perna",
  "vlr_diaria",
  "vlr_pernoite",
  "vlr_reentrega",
  "vlr_descarrego",
] as const;

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

function erpBase() {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  return { base: baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, ""), apiKey };
}

async function chamarErp(base: string, apiKey: string, path: string, body: unknown) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ERP ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  } finally {
    clearTimeout(t);
  }
}

/** Grava no ERP uma linha da fila de valores e atualiza seu status. */
export async function gravarLinhaValores(
  filaId: string,
  origem: "AUTOMATICA" | "MANUAL" = "MANUAL",
): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await centralDb
    .from("fila_lancamento_erp_frete")
    .select("*")
    .eq("id", filaId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: "Item da fila não encontrado" };
  const linha = data as unknown as Record<string, unknown>;
  const payload = (linha["payload"] ?? {}) as Record<string, unknown>;
  const tentativas = Number(linha["tentativas"] ?? 0) + 1;

  const codFilial = payload["cod_filial"] ?? linha["cod_filial"];
  const nroNf = payload["nro_nf"] ?? linha["nro_nf"];
  const bordero = payload["bordero"] ?? linha["bordero"];
  const valores = Object.fromEntries(
    CAMPOS.map((c) => [c, n(payload[c] ?? linha[c])]),
  ) as Record<(typeof CAMPOS)[number], number>;

  let ok = false;
  let erro: string | undefined;
  let referencia: string | null = null;
  try {
    if (!codFilial || !nroNf || !bordero)
      throw new Error("Filial, NF ou borderô ausente para lançamento no ERP");
    const { base, apiKey } = erpBase();
    const binds = {
      ...valores,
      cod_filial: Number(codFilial),
      nro_nf: Number(nroNf),
      bordero: Number(bordero),
    };
    await chamarErp(base, apiKey, "/v1/execute/update_vlr_gerentregas", { binds });

    // Confere se o ERP realmente gravou (o endpoint responde sucesso mesmo sem linha).
    const conf = await chamarErp(base, apiKey, "/v1/query", {
      sql: `select g.vlr_frete, g.vlr_perna, g.vlr_diaria, g.vlr_pernoite, g.vlr_reentrega, g.vlr_descarrego
              from gks.a_gerentregas g
             where g.cod_filial = :filial and g.nro_nf = :nf and g.bordero = :bordero`,
      binds: { filial: binds.cod_filial, nf: binds.nro_nf, bordero: binds.bordero },
      limit: 5,
    });
    const rows = (conf["rows"] as Record<string, unknown>[] | undefined) ?? [];
    if (rows.length === 0)
      throw new Error(`Registro não encontrado no ERP (filial ${codFilial}, NF ${nroNf}, borderô ${bordero})`);
    const r = rows[0]!;
    const pega = (c: string) => n(r[c] ?? r[c.toUpperCase()]);
    const divergente = CAMPOS.find((c) => valores[c] > 0 && Math.abs(pega(c) - valores[c]) > 0.01);
    if (divergente) throw new Error(`ERP não confirmou o valor de ${divergente} para a NF ${nroNf}`);
    ok = true;
    referencia = `NF ${nroNf} / BORD ${bordero}`;
  } catch (e) {
    erro = e instanceof Error ? (e.name === "AbortError" ? "ERP não respondeu a tempo" : e.message) : String(e);
  }

  const { minutosAteProximaTentativa, registrarTentativa } = await import("./fila-retry.server");
  await centralDb
    .from("fila_lancamento_erp_frete")
    .update({
      status: ok ? "CONCLUIDO" : "ERRO",
      tentativas,
      ultimo_erro: ok ? null : erro,
      referencia_erp: referencia,
      proxima_tentativa_em: ok
        ? null
        : new Date(Date.now() + minutosAteProximaTentativa(tentativas) * 60_000).toISOString(),
      processado_em: new Date().toISOString(),
    } as never)
    .eq("id", filaId);
  const raiz = (linha["raiz_id"] as string | null) ?? filaId;
  await registrarTentativa({
    fila: "valores",
    filaId,
    raizId: raiz,
    tentativa: tentativas,
    ok,
    mensagem: ok ? "Valores gravados no ERP" : (erro ?? null),
    origem,
  });

  const ordemId = linha["ordem_pagamento_id"] as string | null;
  if (ordemId) await consolidarOrdem(ordemId);
  return ok ? { ok: true } : { ok: false, erro };
}

/** Atualiza ordem e CT-e para LANCADO_ERP / ERRO_ERP conforme as duas filas. */
export async function consolidarOrdem(ordemId: string): Promise<void> {
  const [{ data: v }, { data: f }] = await Promise.all([
    centralDb.from("fila_lancamento_erp_frete").select("status").eq("ordem_pagamento_id", ordemId),
    centralDb
      .from("fila_provisionamento_financeiro")
      .select("status")
      .eq("ordem_pagamento_id", ordemId),
  ]);
  const todos = [...((v ?? []) as { status: string }[]), ...((f ?? []) as { status: string }[])];
  const houveErro = todos.some((i) => i.status === "ERRO");
  const concluiu = todos.length > 0 && todos.every((i) => i.status === "CONCLUIDO");
  if (!houveErro && !concluiu) return;
  const status = houveErro ? "ERRO_ERP" : "LANCADO_ERP";
  await centralDb.from("ordens_pagamento_frete").update({ status } as never).eq("id", ordemId);
  const { data: ordem } = await centralDb
    .from("ordens_pagamento_frete")
    .select("cte_id")
    .eq("id", ordemId)
    .maybeSingle();
  const cteId = (ordem as { cte_id?: string | null } | null)?.cte_id;
  if (cteId) await centralDb.from("ctes").update({ status } as never).eq("id", cteId);
}
