/**
 * Provisionamento do custo de frete de rotas de transportadora: calcula pela
 * tabela de frete vigente e grava no ERP (GKS.A_GER_PROVISAO_FRETE). Server-only.
 */
import { centralDb } from "./central-db";
import { montarPreviewPagamentoRota } from "./rota-pagamento.server";
import {
  simularEntrega,
  tabelaVigenteDaTransportadora,
  type TabelaSim,
} from "./frete-simulacao";
import type { PreviewProvisao, ProvisaoNota } from "./provisao-frete.types";

const round2 = (v: number) => Math.round(v * 100) / 100;

function erpBase() {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  return { base: baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, ""), apiKey };
}

async function chamarErp(path: string, body: unknown): Promise<Record<string, unknown>> {
  const { base, apiKey } = erpBase();
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
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("ERP não respondeu a tempo");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

type Calculo = PreviewProvisao & { _tabela: TabelaSim | null };

async function calcular(routeId: string): Promise<Calculo> {
  const pv = await montarPreviewPagamentoRota({ routeId, valor: 0 });
  const bloqueios: string[] = [];
  if (pv.pedidos_sem_faturamento > 0)
    bloqueios.push(`${pv.pedidos_sem_faturamento} pedido(s) sem faturamento.`);
  if (pv.pedidos_sem_bordero > 0) bloqueios.push(`${pv.pedidos_sem_bordero} pedido(s) sem borderô.`);

  const cod = pv.responsavel?.cod_erp ?? null;
  let transportadora: PreviewProvisao["transportadora"] = null;
  if (cod) {
    const { data } = await centralDb
      .from("transportadoras")
      .select("id, razao_social, cod_erp")
      .eq("cod_erp", cod)
      .limit(1);
    const t = data?.[0];
    if (t) transportadora = { id: t.id, razao_social: t.razao_social, cod_erp: t.cod_erp ?? null };
  }
  if (!transportadora) bloqueios.push("Transportadora da rota não encontrada no cadastro.");

  let tabela: TabelaSim | null = null;
  if (transportadora) {
    const [tq, vq] = await Promise.all([
      centralDb
        .from("tabelas_preco_frete")
        .select("*, tabelas_preco_frete_faixas(*), tabelas_preco_frete_rotas(*)")
        .eq("ativo", true),
      centralDb.from("tabelas_preco_frete_transportadoras").select("tabela_id, transportadora_id"),
    ]);
    if (tq.error) throw new Error(tq.error.message);
    tabela = tabelaVigenteDaTransportadora(
      (tq.data ?? []) as unknown as TabelaSim[],
      (vq.data ?? []) as { tabela_id: string; transportadora_id: string }[],
      transportadora.id,
    );
    if (!tabela) bloqueios.push("Transportadora sem tabela de frete vigente.");
  }

  // Uma linha por nota fiscal (filial + NF + borderô), como na A_GERENTREGAS.
  const porNota = new Map<string, ProvisaoNota>();
  for (const f of pv.filiais) {
    for (const p of f.pedidos) {
      const k = `${f.cod_filial}|${p.nro_nf ?? p.cod_pedido}|${p.bordero ?? ""}`;
      const n = porNota.get(k) ?? {
        cod_filial: f.cod_filial,
        nro_nf: p.nro_nf,
        bordero: p.bordero,
        pedidos: [],
        clientes: [],
        cidade: p.cidade,
        uf: p.uf,
        peso: 0,
        valor_mercadoria: 0,
        vlr_frete: null,
      };
      n.pedidos.push(p.cod_pedido);
      const cli = p.cod_cliente ? `${p.cliente} (${p.cod_cliente})` : p.cliente;
      if (!n.clientes.includes(cli)) n.clientes.push(cli);
      n.peso += p.peso;
      n.valor_mercadoria += p.valor_mercadoria;
      porNota.set(k, n);
    }
  }
  const notas = Array.from(porNota.values());
  let semPraca = 0;
  for (const n of notas) {
    n.peso = round2(n.peso);
    n.valor_mercadoria = round2(n.valor_mercadoria);
    if (tabela) {
      n.vlr_frete = simularEntrega(tabela, {
        peso: n.peso,
        valorMercadoria: n.valor_mercadoria,
        municipio: n.cidade,
      });
      if (n.vlr_frete == null) semPraca++;
    }
  }
  if (semPraca > 0) bloqueios.push(`${semPraca} nota(s) sem praça encontrada na tabela de frete.`);
  if (notas.some((n) => !n.nro_nf || !n.bordero)) {
    if (!bloqueios.some((b) => b.includes("borderô") || b.includes("faturamento")))
      bloqueios.push("Há notas sem número de NF ou borderô.");
  }

  return {
    route_id: pv.route_id,
    erp_route_id: pv.erp_route_id,
    rota: pv.rota,
    transportadora,
    tabela: tabela ? { id: tabela.id, nome: tabela.nome } : null,
    notas,
    total: round2(notas.reduce((s, n) => s + (n.vlr_frete ?? 0), 0)),
    bloqueios,
    ja_confirmado: pv.ja_confirmado,
    _tabela: tabela,
  };
}

export async function previewProvisao(routeId: string): Promise<PreviewProvisao> {
  const { _tabela, ...rest } = await calcular(routeId);
  void _tabela;
  return rest;
}

export async function gravarProvisao(
  routeId: string,
  usuario: string,
): Promise<{ total: number; linhas: number }> {
  const c = await calcular(routeId);
  if (c.bloqueios.length > 0) throw new Error(c.bloqueios.join(" "));
  if (!c.erp_route_id) throw new Error("Rota sem ID do ERP.");
  const idRota = Number(c.erp_route_id);
  const t = c._tabela!;

  // Reprovisionamento: marca as linhas anteriores como substituídas.
  await chamarErp("/v1/execute/update_status_provisao", {
    binds: { status: "S", id_rota: idRota },
  });

  for (const n of c.notas) {
    const memoria = {
      versao: 1,
      calculado_em: new Date().toISOString(),
      rota: { id_erp: idRota, nome: c.rota },
      transportadora: c.transportadora,
      tabela: {
        id: t.id,
        nome: t.nome,
        tipo_calculo: t.tipo_calculo,
        data_inicio: t.data_inicio,
        data_fim: t.data_fim,
        percentual_valor: t.percentual_valor,
        gris_percentual: t.gris_percentual,
        gris_minimo: t.gris_minimo,
        ad_valorem_percentual: t.ad_valorem_percentual,
        tas_valor: t.tas_valor,
        frete_minimo: t.frete_minimo,
        icms_percentual: t.icms_percentual,
      },
      nota: n,
    };
    await chamarErp("/v1/execute/insert_provisao_frete", {
      binds: {
        id_rota: idRota,
        cod_filial: Number(n.cod_filial),
        nro_nf: Number(n.nro_nf),
        bordero: Number(n.bordero),
        cod_pedido: Number(n.pedidos[0]),
        cod_transp: c.transportadora?.cod_erp ?? null,
        vlr_frete: n.vlr_frete ?? 0,
        vlr_perna: 0,
        vlr_diaria: 0,
        vlr_pernoite: 0,
        vlr_reentrega: 0,
        vlr_descarrego: 0,
        memoria_calculo: JSON.stringify(memoria),
        usuario: usuario.slice(0, 100),
      },
    });
  }

  // Confere se o ERP gravou todas as notas.
  const conf = await chamarErp("/v1/query", {
    sql: `select count(*) qtd from gks.a_ger_provisao_frete where id_rota = :id and status = 'A'`,
    binds: { id: idRota },
    limit: 1,
  });
  const row = ((conf["rows"] as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
  const qtd = Number(row["QTD"] ?? row["qtd"] ?? 0);
  if (qtd < c.notas.length)
    throw new Error(`ERP confirmou ${qtd} de ${c.notas.length} nota(s) provisionadas.`);

  const { error } = await centralDb
    .from("routes")
    .update({ frete_confirmado_em: new Date().toISOString(), total_freight: c.total } as never)
    .eq("id", routeId);
  if (error) throw new Error(error.message);
  return { total: c.total, linhas: c.notas.length };
}
