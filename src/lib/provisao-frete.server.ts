/**
 * Provisionamento do custo de frete de rotas de transportadora: calcula pela
 * tabela de frete vigente e grava no ERP (GKS.A_GER_PROVISAO_FRETE). Server-only.
 */
import { centralDb } from "./central-db";
import { montarPreviewPagamentoRota } from "./rota-pagamento.server";
import {
  detalharEntrega,
  tabelaVigenteDaTransportadora,
  type TabelaSim,
} from "./frete-simulacao";
import {
  chaveNota,
  type PreviewProvisao,
  type ProvisaoEntrega,
  type ProvisaoGravada,
  type ProvisaoNota,
} from "./provisao-frete.types";

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

/** Provisionamento ativo (status 'A') já gravado no ERP para a rota. */
async function consultarProvisaoGravada(idRota: number): Promise<ProvisaoGravada | null> {
  const r = await chamarErp("/v1/query", {
    sql: `select cod_filial, nro_nf, bordero, vlr_frete, to_char(dt_provisao,'yyyy-mm-dd"T"hh24:mi:ss') dt_provisao, usuario
            from gks.a_ger_provisao_frete where id_rota = :id and status = 'A'`,
    binds: { id: idRota },
    limit: 5000,
  });
  const rows = (r["rows"] as Record<string, unknown>[] | undefined) ?? [];
  if (rows.length === 0) return null;
  const g = (o: Record<string, unknown>, k: string) => o[k.toUpperCase()] ?? o[k];
  const por_nota: Record<string, number> = {};
  let dt: string | null = null;
  let usuario: string | null = null;
  for (const o of rows) {
    const k = chaveNota({
      cod_filial: Number(g(o, "cod_filial")),
      nro_nf: Number(g(o, "nro_nf")),
      bordero: Number(g(o, "bordero")),
    });
    por_nota[k] = round2((por_nota[k] ?? 0) + Number(g(o, "vlr_frete") ?? 0));
    const d = g(o, "dt_provisao");
    if (d && (!dt || String(d) > dt)) dt = String(d);
    const u = g(o, "usuario");
    if (u) usuario = String(u);
  }
  return {
    total: round2(Object.values(por_nota).reduce((a, v) => a + v, 0)),
    dt_provisao: dt,
    usuario,
    por_nota,
  };
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
  // O código do responsável da rota (a_cadctipo) pode ser diferente do código
  // do cadastro da transportadora. Nesse caso, localiza pelo CNPJ do responsável.
  if (!transportadora && cod) {
    const r = await chamarErp("/v1/query", {
      sql: "select t.dba_tip_cgc_cpf as cnpj from gks.a_cadctipo t where t.dba_tip_codigo_1 = :cod",
      binds: { cod: Number(cod) },
      limit: 1,
    });
    const row = ((r["rows"] as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    const cnpj = String(row["CNPJ"] ?? row["cnpj"] ?? "").replace(/\D/g, "");
    if (cnpj) {
      const { data } = await centralDb
        .from("transportadoras")
        .select("id, razao_social, cod_erp, cnpj")
        .not("cnpj", "is", null);
      // O responsável da rota pode ser uma filial: compara CNPJ completo e,
      // em seguida, a raiz (8 primeiros dígitos).
      const t = (data ?? []).find(
        (x) => String(x.cnpj ?? "").replace(/\D/g, "") === cnpj,
      ) ?? (data ?? []).find(
        (x) => String(x.cnpj ?? "").replace(/\D/g, "").slice(0, 8) === cnpj.slice(0, 8),
      );
      if (t) transportadora = { id: t.id, razao_social: t.razao_social, cod_erp: t.cod_erp ?? null };
    }
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
  for (const n of notas) {
    n.peso = round2(n.peso);
    n.valor_mercadoria = round2(n.valor_mercadoria);
  }
  // Agrupa por entrega (cliente + cidade/UF): calcula uma vez e rateia por peso.
  const porEntrega = new Map<string, ProvisaoEntrega>();
  for (const n of notas) {
    const cli = n.clientes[0] ?? "—";
    const k = `${cli}|${n.cidade ?? ""}|${n.uf ?? ""}`;
    const e: ProvisaoEntrega = porEntrega.get(k) ?? {
      chave: k, cliente: cli, cidade: n.cidade, uf: n.uf, peso: 0, valor_mercadoria: 0,
      vlr_frete: null, detalhe: null, notas: [],
    };
    e.notas.push(n);
    e.peso += n.peso;
    e.valor_mercadoria += n.valor_mercadoria;
    porEntrega.set(k, e);
  }
  const entregas = Array.from(porEntrega.values());
  let semPraca = 0;
  for (const e of entregas) {
    e.peso = round2(e.peso);
    e.valor_mercadoria = round2(e.valor_mercadoria);
    if (!tabela) continue;
    e.detalhe = detalharEntrega(tabela, {
      peso: e.peso,
      valorMercadoria: e.valor_mercadoria,
      municipio: e.cidade,
    });
    if (!e.detalhe) {
      semPraca += e.notas.length;
      continue;
    }
    e.vlr_frete = e.detalhe.total;
    let restante = e.vlr_frete;
    e.notas.forEach((n, i) => {
      const ultimo = i === e.notas.length - 1;
      const base = e.peso > 0 ? n.peso / e.peso : 1 / e.notas.length;
      const v = ultimo ? round2(restante) : round2(e.vlr_frete! * base);
      n.vlr_frete = v;
      restante -= v;
    });
  }
  if (semPraca > 0) bloqueios.push(`${semPraca} nota(s) sem praça encontrada na tabela de frete.`);
  if (notas.some((n) => !n.nro_nf || !n.bordero)) {
    if (!bloqueios.some((b) => b.includes("borderô") || b.includes("faturamento")))
      bloqueios.push("Há notas sem número de NF ou borderô.");
  }

  let gravado: ProvisaoGravada | null = null;
  if (pv.erp_route_id) {
    try {
      gravado = await consultarProvisaoGravada(Number(pv.erp_route_id));
    } catch (e) {
      bloqueios.push(`Não foi possível consultar o provisionamento gravado: ${(e as Error).message}`);
    }
  }
  const total = round2(notas.reduce((s, n) => s + (n.vlr_frete ?? 0), 0));
  const divergente =
    !!gravado &&
    (Math.abs(gravado.total - total) > 0.009 ||
      notas.length !== Object.keys(gravado.por_nota).length ||
      notas.some((n) => Math.abs((gravado!.por_nota[chaveNota(n)] ?? -1) - (n.vlr_frete ?? 0)) > 0.009));

  return {
    route_id: pv.route_id,
    erp_route_id: pv.erp_route_id,
    rota: pv.rota,
    transportadora,
    tabela: tabela ? { id: tabela.id, nome: tabela.nome } : null,
    pracas: (tabela?.tabelas_preco_frete_rotas ?? [])
      .filter((r) => r.id && r.destino)
      .map((r) => ({ id: r.id!, destino: r.destino! }))
      .sort((a, b) => a.destino.localeCompare(b.destino)),
    notas,
    entregas,
    total_mercadoria: round2(notas.reduce((s, n) => s + n.valor_mercadoria, 0)),
    total,
    bloqueios,
    ja_confirmado: pv.ja_confirmado,
    gravado,
    divergente,
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
  substituir = false,
): Promise<{ total: number; linhas: number }> {
  const c = await calcular(routeId);
  if (c.bloqueios.length > 0) throw new Error(c.bloqueios.join(" "));
  if (!c.erp_route_id) throw new Error("Rota sem ID do ERP.");
  const idRota = Number(c.erp_route_id);
  const t = c._tabela!;

  if (c.gravado && !substituir)
    throw new Error("Esta rota já tem provisionamento gravado. Use \"Substituir pelos novos valores\".");
  // Substituição: marca as linhas anteriores como substituídas. Na primeira
  // gravação não há o que substituir, então o passo é pulado.
  if (c.gravado) {
    try {
      await chamarErp("/v1/execute/update_status_provisao", {
        binds: { status: "S", id_rota: idRota },
      });
    } catch (e) {
      throw new Error(
        `Não foi possível substituir o provisionamento anterior (update_status_provisao deve aceitar os binds status e id_rota). ${(e as Error).message}`,
      );
    }
  }

  // O ID de cada linha vem da sequência do ERP (sem trigger na tabela).
  const proximoId = async (): Promise<number> => {
    const r = await chamarErp("/v1/query", {
      sql: "select gks.SEQ_PROVISAO_FRETE.nextval id from dual",
      limit: 1,
    });
    const row = ((r["rows"] as Record<string, unknown>[] | undefined) ?? [])[0] ?? {};
    const id = Number(row["ID"] ?? row["id"] ?? 0);
    if (!Number.isFinite(id) || id <= 0)
      throw new Error("ERP não retornou o próximo ID da sequência de provisionamento.");
    return id;
  };

  for (const n of c.notas) {
    const memoria = {
      versao: 2,
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
      entrega: (() => {
        const e = c.entregas.find((x) => x.notas.includes(n));
        return e
          ? { cliente: e.cliente, cidade: e.cidade, uf: e.uf, peso: e.peso,
              valor_mercadoria: e.valor_mercadoria, vlr_frete: e.vlr_frete, detalhe: e.detalhe,
              notas: e.notas.map((x) => ({ nro_nf: x.nro_nf, peso: x.peso, vlr_frete: x.vlr_frete })) }
          : null;
      })(),
      rateio: "proporcional ao peso da nota na entrega",
    };
    await chamarErp("/v1/execute/insert_provisao_frete", {
      binds: {
        id: await proximoId(),
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
