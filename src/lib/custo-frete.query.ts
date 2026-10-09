import { listarProvisoesNotas } from "@/lib/provisao-frete.functions";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/central/client";

/** Ciclo do calendário comercial do ERP. */
export type CicloComercial = { mes_comerc: string; de: string; ate: string };

export const calendarioComercialQueryOptions = () =>
  queryOptions({
    queryKey: ["erp", "calendario-comercial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_calendario_comercial")
        .select("mes_comerc,de,ate")
        .order("mes_comerc", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CicloComercial[];
    },
    staleTime: 60_000,
  });

export function cicloAtual(ciclos: CicloComercial[]): CicloComercial | null {
  const hoje = new Date().toISOString().slice(0, 10);
  return ciclos.find((c) => c.de <= hoje && c.ate >= hoje) ?? ciclos[0] ?? null;
}

/** Uma nota faturada no ciclo com o frete confirmado rateado. */
export type LinhaCustoFrete = {
  nro_nf: string;
  cod_pedido: string;
  cod_cliente: string | null;
  cliente: string;
  cidade: string | null;
  uf: string | null;
  cod_vendedor: string | null;
  valor: number;
  peso: number;
  frete: number;
  /** Rota com frete confirmado; null quando não há frete confirmado. */
  rota: string | null;
  responsavel: string | null;
  tipo: string | null;
};


/** Fonte das notas faturadas: espelho completo (v1.34.0) ou, se ainda não existir, o de entregas em aberto. */
let fonteNotas: "notas_faturadas" | "entregas_abertas" | null = null;
async function tabelaNotas(): Promise<"notas_faturadas" | "entregas_abertas"> {
  if (fonteNotas) return fonteNotas;
  const { error } = await supabase.from("notas_faturadas" as never).select("nro_nf").limit(1);
  fonteNotas = error ? "entregas_abertas" : "notas_faturadas";
  return fonteNotas;
}

const PAGINA = 1000;
const LOTE = 150;

async function emLotes<T, R>(itens: T[], fn: (lote: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < itens.length; i += LOTE) out.push(...(await fn(itens.slice(i, i + LOTE))));
  return out;
}

/**
 * Notas faturadas no período (data de faturamento do ERP) com o frete
 * CONFIRMADO da rota rateado pelo valor das mercadorias de cada pedido.
 */
export async function carregarCustoFrete(ciclo: CicloComercial): Promise<LinhaCustoFrete[]> {
  type Ent = { nro_nf: string; cod_pedido: string; cod_cliente: string | null; cod_vendedor: string | null; valor: number; peso: number };
  const entregas: Ent[] = [];
  const fonte = await tabelaNotas();
  for (let de = 0; de < 100_000; de += PAGINA) {
    const { data, error } = await supabase
      .from(fonte as "entregas_abertas")
      .select("nro_nf,cod_pedido,cod_cliente,cod_vendedor,valor,peso")
      .in("cod_agenda", ["417", "427"])
      .gte("dt_fatur", ciclo.de)
      .lte("dt_fatur", ciclo.ate)
      .order("nro_nf")
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    entregas.push(...((data ?? []) as Ent[]));
    if ((data ?? []).length < PAGINA) break;
  }
  if (entregas.length === 0) return [];

  const codPedidos = Array.from(new Set(entregas.map((e) => e.cod_pedido)));

  // Pedido -> rotas
  type Ord = { order_number: string; route_orders: { route_id: string }[] | { route_id: string } | null };
  const rosDe = (o: Ord) => (Array.isArray(o.route_orders) ? o.route_orders : o.route_orders ? [o.route_orders] : []);
  const ords = await emLotes(codPedidos, async (lote) => {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, route_orders(route_id)")
      .in("order_number", lote);
    if (error) throw error;
    return (data ?? []) as unknown as Ord[];
  });
  const rotaIds = Array.from(new Set(ords.flatMap((o) => rosDe(o).map((r) => r.route_id))));

  type Rota = { id: string; code: string; erp_route_id: string | null; total_freight: number | null; frete_confirmado_em: string | null; erp_carrier_code: string | null; driver_name: string | null };
  const rotas = await emLotes(rotaIds, async (lote) => {
    const { data, error } = await supabase
      .from("routes")
      .select("id,code,erp_route_id,total_freight,frete_confirmado_em,erp_carrier_code,driver_name")
      .in("id", lote)
      .not("frete_confirmado_em", "is", null);
    if (error) throw error;
    return (data ?? []) as unknown as Rota[];
  });
  const rotaPorId = new Map(rotas.map((r) => [r.id, r]));

  // Todos os pedidos das rotas confirmadas (para ratear sobre a rota inteira)
  type RO = { route_id: string; orders: { order_number: string | null; total_amount: number | null } | null };
  const ros = await emLotes(rotas.map((r) => r.id), async (lote) => {
    const { data, error } = await supabase
      .from("route_orders")
      .select("route_id, orders(order_number,total_amount)")
      .in("route_id", lote);
    if (error) throw error;
    return (data ?? []) as unknown as RO[];
  });
  const totalRota = new Map<string, number>();
  const valorPedidoRota = new Map<string, number>(); // route|pedido
  for (const r of ros) {
    const v = Number(r.orders?.total_amount ?? 0);
    totalRota.set(r.route_id, (totalRota.get(r.route_id) ?? 0) + v);
    const k = `${r.route_id}|${r.orders?.order_number ?? ""}`;
    valorPedidoRota.set(k, (valorPedidoRota.get(k) ?? 0) + v);
  }

  // Frete por pedido e rota do pedido
  const fretePedido = new Map<string, { frete: number; rota: Rota }>();
  for (const o of ords) {
    for (const ro of rosDe(o)) {
      const rota = rotaPorId.get(ro.route_id);
      if (!rota) continue;
      const tot = totalRota.get(rota.id) ?? 0;
      const vp = valorPedidoRota.get(`${rota.id}|${o.order_number}`) ?? 0;
      const frete = tot > 0 ? (Number(rota.total_freight ?? 0) * vp) / tot : 0;
      const atual = fretePedido.get(o.order_number);
      fretePedido.set(o.order_number, { frete: (atual?.frete ?? 0) + frete, rota: atual?.rota ?? rota });
    }
  }

  // Cadastros auxiliares
  const codClientes = Array.from(new Set(entregas.map((e) => e.cod_cliente).filter(Boolean) as string[]));
  type Cli = { cod_cliente: string; razao_social: string | null; nome_nf: string | null; cidade: string | null; uf: string | null };
  const clis = await emLotes(codClientes, async (lote) => {
    const { data, error } = await supabase.from("clientes_erp").select("cod_cliente,razao_social,nome_nf,cidade,uf").in("cod_cliente", lote);
    if (error) throw error;
    return (data ?? []) as Cli[];
  });
  const cliPor = new Map(clis.map((c) => [c.cod_cliente, c]));
  const codResp = Array.from(new Set(rotas.map((r) => r.erp_carrier_code).filter(Boolean) as string[]));
  type Resp = { cod_erp: string; razao_social: string | null; tipo_frete: string | null };
  const resps = await emLotes(codResp, async (lote) => {
    const { data, error } = await supabase.from("erp_responsaveis").select("cod_erp,razao_social,tipo_frete").in("cod_erp", lote);
    if (error) throw error;
    return (data ?? []) as unknown as Resp[];
  });
  const respPor = new Map(resps.map((r) => [r.cod_erp, r]));

  // Valor total por pedido (para ratear o frete do pedido entre as NFs)
  const valorPedidoNfs = new Map<string, number>();
  for (const e of entregas) valorPedidoNfs.set(e.cod_pedido, (valorPedidoNfs.get(e.cod_pedido) ?? 0) + Number(e.valor ?? 0));

  // Mesmo critério de Mercadorias faturadas: frete real do ERP (vlr_frete) ou provisionado.
  const merc = await carregarMercadorias(ciclo);
  const semReal = merc.filter((l) => l.origem_frete !== "R").map((l) => l.nro_nf);
  let mercFinal = merc;
  if (semReal.length) {
    try {
      mercFinal = aplicarProvisoes(merc, await listarProvisoesNotas({ data: { nfs: semReal } }));
    } catch (err) {
      console.warn("Provisões indisponíveis", err);
    }
  }
  const consolidadas = consolidarReentregas(mercFinal);

  return consolidadas.map((e) => {
    const fp = fretePedido.get(e.cod_pedido);
    const frete = Number(e.vlr_frete ?? 0);
    const cli = e.cod_cliente ? cliPor.get(e.cod_cliente) : undefined;
    const resp = fp?.rota.erp_carrier_code ? respPor.get(fp.rota.erp_carrier_code) : undefined;
    const nomeCli = cli?.razao_social || cli?.nome_nf || "Cliente";
    return {
      nro_nf: e.nro_nf,
      cod_pedido: e.cod_pedido,
      cod_cliente: e.cod_cliente,
      cliente: e.cod_cliente ? `${nomeCli} (${e.cod_cliente})` : nomeCli,
      cidade: cli?.cidade ?? null,
      uf: cli?.uf ?? null,
      cod_vendedor: e.cod_vendedor,
      valor: Number(e.valor ?? 0),
      peso: Number(e.peso ?? 0),
      frete,
      rota: fp ? `${fp.rota.erp_route_id ?? fp.rota.code}` : null,
      responsavel: fp
        ? resp?.razao_social
          ? `${resp.razao_social}${fp.rota.erp_carrier_code ? ` (${fp.rota.erp_carrier_code})` : ""}`
          : fp.rota.driver_name || fp.rota.erp_carrier_code || "Não identificado"
        : null,
      tipo: resp?.tipo_frete ?? null,
    };
  });
}

const CAMPOS_FRETE = ["vlr_frete", "vlr_perna", "vlr_diaria", "vlr_pernoite", "vlr_reentrega", "vlr_descarrego"] as const;

/**
 * Pedido reentregue (mais de uma nota/borderô no ciclo) vira uma única linha:
 * dados da nota de maior borderô e os 6 campos de frete somados.
 */
export function consolidarReentregas(linhas: LinhaMercadoria[]): LinhaMercadoria[] {
  const grupos = new Map<string, LinhaMercadoria[]>();
  for (const l of linhas) {
    const g = grupos.get(l.cod_pedido);
    if (g) g.push(l); else grupos.set(l.cod_pedido, [l]);
  }
  const out: LinhaMercadoria[] = [];
  for (const g of grupos.values()) {
    if (g.length === 1) { out.push({ ...g[0], reentrega: null }); continue; }
    const ord = [...g].sort((a, b) =>
      Number(a.bordero ?? 0) - Number(b.bordero ?? 0) ||
      String(a.dt_saida ?? "").localeCompare(String(b.dt_saida ?? "")) ||
      Number(a.nro_nf) - Number(b.nro_nf));
    const base = ord[ord.length - 1];
    const soma = Object.fromEntries(CAMPOS_FRETE.map((k) => {
      const vals = g.map((l) => l[k]).filter((v) => v != null) as number[];
      return [k, vals.length ? vals.reduce((s, v) => s + Number(v), 0) : null];
    })) as Pick<LinhaMercadoria, (typeof CAMPOS_FRETE)[number]>;
    const origem = g.some((l) => l.origem_frete === "R") ? "R" : g.some((l) => l.origem_frete === "P") ? "P" : null;
    out.push({
      ...base, ...soma, origem_frete: origem,
      reentrega: { qtd: g.length, borderos: ord.map((l) => l.bordero ?? "—"), nfs: ord.map((l) => l.nro_nf) },
    });
  }
  return out;
}

export const custoFreteQueryOptions = (ciclo: CicloComercial | null) =>
  queryOptions({
    queryKey: ["custo-frete", ciclo?.mes_comerc ?? "-"],
    queryFn: () => (ciclo ? carregarCustoFrete(ciclo) : Promise.resolve([] as LinhaCustoFrete[])),
    enabled: !!ciclo,
    staleTime: 5 * 60_000,
  });

export type ResumoCustoFrete = {
  frete: number;
  valor: number;
  pct: number | null;
  pedidos: number;
  entregas: number;
  peso: number;
  semFrete: number;
};

export function resumir(linhas: LinhaCustoFrete[]): ResumoCustoFrete {
  let frete = 0, valor = 0, peso = 0;
  const pedidos = new Set<string>(), entregas = new Set<string>(), semFrete = new Set<string>();
  for (const l of linhas) {
    frete += l.frete; valor += l.valor; peso += l.peso;
    pedidos.add(l.cod_pedido);
    entregas.add(l.cod_cliente ?? l.cod_pedido);
    if (!(l.frete > 0)) semFrete.add(l.cod_pedido);
  }
  return { frete, valor, peso, pct: valor > 0 ? (frete / valor) * 100 : null, pedidos: pedidos.size, entregas: entregas.size, semFrete: semFrete.size };
}

/** Linha do detalhamento "Mercadorias faturadas" (layout da planilha do ERP). */
export type LinhaMercadoria = {
  id_rota: string | null;
  cod_pedido: string; cod_cliente: string | null; cod_vendedor: string | null; cod_filial: string | null; cod_agenda: string | null;
  dt_pedido: string | null; status: string | null; dt_fatur: string | null; entrega_agend: string | null; bordero: string | null;
  dt_saida: string | null; dt_etrg_trsp: string | null; dt_entrega_cli: string | null; dt_agendamento: string | null;
  cod_transp_prn: string | null; tipo_transp_pn: string | null; placa_veiculo_ent: string | null; cod_transp_ent: string | null; tipo_transp_ent: string | null;
  nro_nf: string; valor: number; peso: number;
  vlr_frete: number | null; vlr_perna: number | null; vlr_diaria: number | null; vlr_pernoite: number | null; vlr_reentrega: number | null; vlr_descarrego: number | null;
  tipos_ocorrencia: string | null;
  /** R = frete real do ERP; P = provisionado; null = sem frete. */
  origem_frete: "R" | "P" | null;
  /** Preenchido quando o pedido teve mais de uma entrega (borderôs) no ciclo. */
  reentrega?: { qtd: number; borderos: string[]; nfs: string[] } | null;
};

export type ProvisaoLinha = { cod_filial: string; nro_nf: string; vlr_frete: number; vlr_perna: number; vlr_diaria: number; vlr_pernoite: number; vlr_reentrega: number; vlr_descarrego: number };

/** Preenche notas sem frete real com os valores provisionados. */
export function aplicarProvisoes(linhas: LinhaMercadoria[], provs: ProvisaoLinha[]): LinhaMercadoria[] {
  const m = new Map(provs.map((p) => [`${Number(p.cod_filial)}|${Number(p.nro_nf)}`, p]));
  return linhas.map((l) => {
    if (l.origem_frete === "R") return l;
    const p = m.get(`${Number(l.cod_filial)}|${Number(l.nro_nf)}`);
    if (!p) return l;
    return { ...l, vlr_frete: p.vlr_frete, vlr_perna: p.vlr_perna, vlr_diaria: p.vlr_diaria, vlr_pernoite: p.vlr_pernoite, vlr_reentrega: p.vlr_reentrega, vlr_descarrego: p.vlr_descarrego, origem_frete: "P" };
  });
}

export async function carregarMercadorias(ciclo: CicloComercial): Promise<LinhaMercadoria[]> {
  const linhas: Record<string, unknown>[] = [];
  const fonte = await tabelaNotas();
  for (let de = 0; de < 100_000; de += PAGINA) {
    const { data, error } = await supabase
      .from(fonte as "entregas_abertas")
      .select("*")
      .in("cod_agenda", ["417", "427"])
      .gte("dt_fatur", ciclo.de)
      .lte("dt_fatur", ciclo.ate)
      .order("nro_nf")
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
    if ((data ?? []).length < PAGINA) break;
  }
  const peds = Array.from(new Set(linhas.map((l) => String(l.cod_pedido))));
  type Ord = { order_number: string; route_orders: { routes: { code: string; erp_route_id: string | null } | null }[] | null };
  const lista = <T,>(x: T | T[] | null | undefined): T[] => (Array.isArray(x) ? x : x ? [x] : []);
  let ords: Ord[] = [];
  try {
    ords = await emLotes(peds, async (lote) => {
      const { data, error } = await supabase.from("orders").select("order_number, route_orders(routes(code,erp_route_id))").in("order_number", lote);
      if (error) throw error;
      return (data ?? []) as unknown as Ord[];
    });
  } catch (e) {
    console.warn("Rotas dos pedidos indisponíveis", e);
  }
  const rotaPor = new Map<string, string>();
  for (const o of ords) {
    const ids = lista(o.route_orders as unknown)
      .flatMap((r) => lista((r as { routes?: unknown }).routes as { code: string; erp_route_id: string | null } | null))
      .map((rt) => rt.erp_route_id ?? rt.code)
      .filter(Boolean) as string[];
    if (ids.length) rotaPor.set(o.order_number, Array.from(new Set(ids)).join(", "));
  }
  const s = (v: unknown) => (v == null ? null : String(v));
  const n = (v: unknown) => (v == null ? null : Number(v));
  return linhas.map((l) => ({
    id_rota: rotaPor.get(String(l.cod_pedido)) ?? null,
    cod_pedido: String(l.cod_pedido), cod_cliente: s(l.cod_cliente), cod_vendedor: s(l.cod_vendedor), cod_filial: s(l.cod_filial), cod_agenda: s(l.cod_agenda),
    dt_pedido: s(l.dt_pedido), status: s(l.status), dt_fatur: s(l.dt_fatur), entrega_agend: s(l.entrega_agend), bordero: s(l.bordero),
    dt_saida: s(l.dt_saida), dt_etrg_trsp: s(l.dt_etrg_trsp), dt_entrega_cli: s(l.dt_entrega_cli), dt_agendamento: s(l.dt_agendamento),
    cod_transp_prn: s(l.cod_transp_prn), tipo_transp_pn: s(l.tipo_transp_pn), placa_veiculo_ent: s(l.placa_veiculo_ent), cod_transp_ent: s(l.cod_transp_ent), tipo_transp_ent: s(l.tipo_transp_ent),
    nro_nf: String(l.nro_nf), valor: Number(l.valor ?? 0), peso: Number(l.peso ?? 0),
    vlr_frete: n(l.vlr_frete), vlr_perna: n(l.vlr_perna), vlr_diaria: n(l.vlr_diaria), vlr_pernoite: n(l.vlr_pernoite), vlr_reentrega: n(l.vlr_reentrega), vlr_descarrego: n(l.vlr_descarrego),
    tipos_ocorrencia: s(l.tipos_ocorrencia),
    origem_frete: Number(l.vlr_frete ?? 0) > 0 ? ("R" as const) : null,
  }));
}
