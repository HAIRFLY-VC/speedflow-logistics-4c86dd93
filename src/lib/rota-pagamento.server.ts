/**
 * Confirmação de pagamento de frete por ROTA.
 *
 * Server-only: usa o banco central com chave de serviço. A autorização do
 * usuário é verificada em `rota-pagamento.functions.ts` antes de chamar aqui.
 *
 * O valor informado na tela é rateado entre os pedidos da rota pelo valor da
 * mercadoria e enviado às mesmas filas consumidas pelo n8n (lançamento no ERP
 * por pedido + criação da tarefa de pagamento no Bitrix).
 */
import { centralDb } from "./central-db";
import type {
  FilialPagamento,
  MotivoAdicional,
  PagamentoRotaHistorico,
  PedidoPagamento,
  PreviewPagamentoRota,
  TipoPagamentoRota,
} from "./rota-pagamento.types";
import { MOTIVOS_ADICIONAIS } from "./rota-pagamento.types";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const cent = (v: number) => Math.round(v * 100) / 100;

/** Divide um valor entre os pedidos conforme os pesos informados. */
function ratear(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const soma = pesos.reduce((s, p) => s + p, 0);
  const base = soma > 0 ? pesos.map((p) => p / soma) : pesos.map(() => 1 / n);
  const parts = base.map((f) => cent(total * f));
  const ajuste = cent(total - parts.reduce((s, v) => s + v, 0));
  if (parts.length > 0) parts[0] = cent(parts[0]! + ajuste);
  return parts;
}

/** Campo do ERP que recebe o valor conforme o tipo/motivo do lançamento. */
function campoDoMotivo(
  tipo: TipoPagamentoRota,
  motivo: MotivoAdicional | null,
): "vlr_frete" | "vlr_perna" | "vlr_diaria" | "vlr_pernoite" | "vlr_reentrega" | "vlr_descarrego" {
  if (tipo === "FRETE") return "vlr_frete";
  switch (motivo) {
    case "PERNOITE":
      return "vlr_pernoite";
    case "DESCARREGO":
      return "vlr_descarrego";
    case "REENTREGA":
      return "vlr_reentrega";
    case "DIARIA":
      return "vlr_diaria";
    default:
      return "vlr_perna";
  }
}

function rotuloMotivo(motivo: string | null): string | null {
  if (!motivo) return null;
  return MOTIVOS_ADICIONAIS.find((m) => m.valor === motivo)?.rotulo ?? motivo;
}

type RotaCarregada = {
  id: string;
  code: string;
  notes: string | null;
  erp_route_id: string | null;
  total_freight: number;
  frete_confirmado_em: string | null;
};

type PedidoCarregado = {
  cod_pedido: string;
  cod_cliente: string | null;
  cod_filial: string | null;
  valor_mercadoria: number;
};

async function carregarRota(routeId: string): Promise<RotaCarregada> {
  const { data, error } = await centralDb
    .from("routes")
    .select("id, code, notes, erp_route_id, total_freight, frete_confirmado_em")
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rota não encontrada.");
  const r = data as unknown as RotaCarregada;
  return {
    id: r.id,
    code: r.code,
    notes: r.notes ?? null,
    erp_route_id: r.erp_route_id ?? null,
    total_freight: Number(r.total_freight ?? 0),
    frete_confirmado_em: r.frete_confirmado_em ?? null,
  };
}

async function carregarPedidos(routeId: string): Promise<PedidoCarregado[]> {
  const { data, error } = await centralDb
    .from("route_orders")
    .select("stop_order, orders(order_number, total_amount, cod_filial, erp_cod_cliente)")
    .eq("route_id", routeId);
  if (error) throw new Error(error.message);

  const linhas = (data ?? []) as unknown as {
    stop_order: number | null;
    orders:
      | {
          order_number: string | null;
          total_amount: number | null;
          cod_filial: string | null;
          erp_cod_cliente: string | null;
        }
      | null;
  }[];

  const pedidos = new Map<string, PedidoCarregado>();
  for (const l of linhas) {
    const o = l.orders;
    const cod = (o?.order_number ?? "").trim();
    if (!cod) continue;
    const atual = pedidos.get(cod);
    if (atual) {
      atual.valor_mercadoria = cent(atual.valor_mercadoria + Number(o?.total_amount ?? 0));
      continue;
    }
    pedidos.set(cod, {
      cod_pedido: cod,
      cod_cliente: o?.erp_cod_cliente ?? null,
      cod_filial: (o?.cod_filial ?? "").trim() || null,
      valor_mercadoria: Number(o?.total_amount ?? 0),
    });
  }
  return Array.from(pedidos.values());
}

type DadosExpedicao = {
  bordero: string | null;
  cod_filial: string | null;
  nro_nf: string | null;
};

/** Borderô, nota fiscal e filial de faturamento vindos do espelho de entregas do ERP. */
async function dadosDeExpedicao(codPedidos: string[]): Promise<Map<string, DadosExpedicao>> {
  const map = new Map<string, DadosExpedicao>();
  const TAM = 200;
  for (let i = 0; i < codPedidos.length; i += TAM) {
    const lote = codPedidos.slice(i, i + TAM);
    const { data, error } = await centralDb
      .from("entregas_abertas")
      .select("cod_pedido, bordero, cod_filial, nro_nf, dt_fatur")
      .in("cod_pedido", lote);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      cod_pedido: string;
      bordero: string | null;
      cod_filial: string | null;
      nro_nf: string | null;
      dt_fatur: string | null;
    }[]) {
      const atual = map.get(row.cod_pedido);
      const bordero = (row.bordero ?? "").trim() || null;
      const filial = (row.cod_filial ?? "").trim() || null;
      const nf = (row.nro_nf ?? "").trim() || null;
      map.set(row.cod_pedido, {
        bordero: atual?.bordero ?? bordero,
        cod_filial: atual?.cod_filial ?? filial,
        nro_nf: atual?.nro_nf ?? nf,
      });
    }
  }
  return map;
}

async function nomesDeClientes(cods: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unicos = Array.from(new Set(cods.filter(Boolean)));
  const TAM = 200;
  for (let i = 0; i < unicos.length; i += TAM) {
    const lote = unicos.slice(i, i + TAM);
    const { data } = await centralDb
      .from("clientes_erp")
      .select("cod_cliente, razao_social, nome_nf")
      .in("cod_cliente", lote);
    for (const c of (data ?? []) as { cod_cliente: string; razao_social: string | null; nome_nf: string | null }[]) {
      map.set(c.cod_cliente, c.razao_social ?? c.nome_nf ?? c.cod_cliente);
    }
  }
  return map;
}

function nomeDaRota(rota: RotaCarregada): string {
  const notas = (rota.notes ?? "").replace(/^Rota\s+/i, "").trim();
  return notas || rota.code;
}

/** Texto da tarefa do Bitrix: detalhe por filial + somatório proporcional. */
function montarTextoTarefa(
  rota: RotaCarregada,
  filiais: FilialPagamento[],
  valor: number,
  tipo: TipoPagamentoRota,
  motivo: MotivoAdicional | null,
  observacao: string | null,
): string {
  const linhas: string[] = [];
  const titulo =
    tipo === "FRETE"
      ? `Pagamento de frete — rota ${rota.erp_route_id ?? rota.code} (${nomeDaRota(rota)})`
      : `Valor adicional (${rotuloMotivo(motivo) ?? "adicional"}) — rota ${rota.erp_route_id ?? rota.code} (${nomeDaRota(rota)})`;
  linhas.push(titulo);
  linhas.push("");
  for (const f of filiais) {
    linhas.push(`Filial de faturamento ${f.cod_filial}`);
    for (const p of f.pedidos) {
      linhas.push(
        `  Pedido ${p.cod_pedido}${p.nro_nf ? ` | NF ${p.nro_nf}` : ""}${p.bordero ? ` | Borderô ${p.bordero}` : ""} | ${p.cliente} | Mercadoria ${brl(p.valor_mercadoria)} | Frete ${brl(p.frete)}`,
      );
    }
    linhas.push(`  Subtotal da filial ${f.cod_filial}: ${brl(f.frete)}`);
    linhas.push("");
  }
  linhas.push("Resumo por filial de faturamento");
  for (const f of filiais) linhas.push(`  Filial ${f.cod_filial}: ${brl(f.frete)}`);
  linhas.push(`  Total: ${brl(valor)}`);
  if (observacao) {
    linhas.push("");
    linhas.push(`Observação: ${observacao}`);
  }
  return linhas.join("\n");
}

function agrupar(
  pedidos: PedidoCarregado[],
  expedicao: Map<string, DadosExpedicao>,
  clientes: Map<string, string>,
  valor: number,
): {
  filiais: FilialPagamento[];
  semBordero: number;
  semFaturamento: number;
  valorMercadoria: number;
} {
  const pesos = pedidos.map((p) => Number(p.valor_mercadoria ?? 0));
  const rateado = ratear(valor, pesos);

  const grupos = new Map<string, FilialPagamento>();
  let semBordero = 0;
  let semFaturamento = 0;
  pedidos.forEach((p, i) => {
    const exp = expedicao.get(p.cod_pedido);
    const bordero = exp?.bordero ?? null;
    const nf = exp?.nro_nf ?? null;
    if (!bordero) semBordero += 1;
    if (!nf) semFaturamento += 1;
    const filial = p.cod_filial ?? exp?.cod_filial ?? "SEM FILIAL";
    const item: PedidoPagamento = {
      cod_pedido: p.cod_pedido,
      cliente: (p.cod_cliente ? clientes.get(p.cod_cliente) : null) ?? p.cod_cliente ?? "—",
      bordero,
      nro_nf: nf,
      valor_mercadoria: cent(Number(p.valor_mercadoria ?? 0)),
      frete: rateado[i] ?? 0,
    };
    const g = grupos.get(filial) ?? { cod_filial: filial, pedidos: [], valor_mercadoria: 0, frete: 0 };
    g.pedidos.push(item);
    g.valor_mercadoria = cent(g.valor_mercadoria + item.valor_mercadoria);
    g.frete = cent(g.frete + item.frete);
    grupos.set(filial, g);
  });

  const filiais = Array.from(grupos.values()).sort((a, b) =>
    a.cod_filial.localeCompare(b.cod_filial, "pt-BR", { numeric: true }),
  );
  for (const f of filiais) {
    f.pedidos.sort((a, b) => a.cod_pedido.localeCompare(b.cod_pedido, "pt-BR", { numeric: true }));
  }
  return {
    filiais,
    semBordero,
    semFaturamento,
    valorMercadoria: cent(pesos.reduce((s, v) => s + v, 0)),
  };
}

export async function montarPreviewPagamentoRota(params: {
  routeId: string;
  valor: number;
  tipo?: TipoPagamentoRota;
  motivo?: MotivoAdicional | null;
  observacao?: string | null;
}): Promise<PreviewPagamentoRota> {
  const rota = await carregarRota(params.routeId);
  const pedidos = await carregarPedidos(params.routeId);
  if (pedidos.length === 0) throw new Error("A rota não tem pedidos para ratear o frete.");

  const expedicao = await dadosDeExpedicao(pedidos.map((p) => p.cod_pedido));
  const clientes = await nomesDeClientes(pedidos.map((p) => p.cod_cliente ?? "").filter(Boolean));

  const valor = cent(Number(params.valor ?? 0));
  const { filiais, semBordero, semFaturamento, valorMercadoria } = agrupar(
    pedidos,
    expedicao,
    clientes,
    valor,
  );

  return {
    route_id: rota.id,
    rota: nomeDaRota(rota),
    erp_route_id: rota.erp_route_id,
    valor,
    valor_mercadoria: valorMercadoria,
    total_pedidos: pedidos.length,
    pedidos_sem_bordero: semBordero,
    pedidos_sem_faturamento: semFaturamento,
    ja_confirmado: rota.frete_confirmado_em != null,
    filiais,
    texto_tarefa: montarTextoTarefa(
      rota,
      filiais,
      valor,
      params.tipo ?? "FRETE",
      params.motivo ?? null,
      params.observacao ?? null,
    ),
  };
}

export async function confirmarPagamentoRota(params: {
  routeId: string;
  valor: number;
  tipo: TipoPagamentoRota;
  motivo: MotivoAdicional | null;
  observacao: string | null;
  userId: string;
  isAdmin: boolean;
}) {
  const rota = await carregarRota(params.routeId);
  const jaConfirmado = rota.frete_confirmado_em != null;
  if ((jaConfirmado || params.tipo === "ADICIONAL") && !params.isAdmin) {
    throw new Error("Apenas administradores podem reabrir ou lançar valores adicionais.");
  }
  if (params.tipo === "ADICIONAL" && !params.motivo) {
    throw new Error("Informe o motivo do valor adicional.");
  }
  const valor = cent(Number(params.valor ?? 0));
  if (!(valor > 0)) throw new Error("Informe um valor de frete maior que zero.");

  const preview = await montarPreviewPagamentoRota({
    routeId: params.routeId,
    valor,
    tipo: params.tipo,
    motivo: params.motivo,
    observacao: params.observacao,
  });
  if (preview.pedidos_sem_bordero > 0) {
    throw new Error(
      `Ainda há ${preview.pedidos_sem_bordero} pedido(s) sem borderô. Confirme o pagamento somente depois que todos tiverem borderô.`,
    );
  }

  const agora = new Date().toISOString();
  const { data: ordem, error: ordemErr } = await centralDb
    .from("ordens_pagamento_frete")
    .insert({
      route_id: params.routeId,
      cte_id: null,
      tipo_pagamento: params.tipo,
      motivo_adicional: params.motivo,
      valor_autorizado: valor,
      autorizado_por: params.userId,
      autorizado_em: agora,
      status: "AGUARDANDO_INTEGRACAO_ERP",
      aprovacao_status: "APROVADO",
      decidido_por: params.userId,
      decidido_em: agora,
      observacao: params.observacao,
    } as never)
    .select("id")
    .single();
  if (ordemErr) throw new Error(ordemErr.message);
  const ordemId = (ordem as { id: string }).id;

  // Reenvio do frete da rota: os lançamentos anteriores ficam marcados como
  // substituídos (nada é apagado, o histórico preserva cada confirmação).
  if (params.tipo === "FRETE") {
    await centralDb
      .from("ordens_pagamento_frete")
      .update({ substituida_em: agora } as never)
      .eq("route_id", params.routeId)
      .eq("tipo_pagamento", "FRETE")
      .is("substituida_em", null)
      .neq("id", ordemId);
  }

  const campo = campoDoMotivo(params.tipo, params.motivo);
  const zerados = {
    vlr_frete: 0,
    vlr_perna: 0,
    vlr_diaria: 0,
    vlr_pernoite: 0,
    vlr_reentrega: 0,
    vlr_descarrego: 0,
  };

  const linhas = preview.filiais.flatMap((f) =>
    f.pedidos.map((p) => ({
      ordem_pagamento_id: ordemId,
      route_id: params.routeId,
      cod_filial: f.cod_filial,
      cod_pedido: p.cod_pedido,
      bordero: p.bordero,
      ...zerados,
      [campo]: p.frete,
      status: "PENDENTE" as const,
      payload: {
        origem: "ROTA",
        route_id: params.routeId,
        rota: preview.rota,
        erp_route_id: preview.erp_route_id,
        cod_filial: f.cod_filial,
        cod_pedido: p.cod_pedido,
        bordero: p.bordero,
        tipo_pagamento: params.tipo,
        motivo_adicional: params.motivo,
        ...zerados,
        [campo]: p.frete,
      },
    })),
  );

  const { error: filaErr } = await centralDb
    .from("fila_lancamento_erp_frete")
    .insert(linhas as never);
  if (filaErr) throw new Error(filaErr.message);

  const { error: finErr } = await centralDb.from("fila_provisionamento_financeiro").insert({
    ordem_pagamento_id: ordemId,
    route_id: params.routeId,
    cte_id: null,
    status: "PENDENTE",
    payload: {
      origem: "ROTA",
      route_id: params.routeId,
      rota: preview.rota,
      erp_route_id: preview.erp_route_id,
      tipo_pagamento: params.tipo,
      motivo_adicional: params.motivo,
      valor_total: valor,
      observacao: params.observacao,
      texto_tarefa: preview.texto_tarefa,
      filiais: preview.filiais.map((f) => ({
        cod_filial: f.cod_filial,
        valor_frete: f.frete,
        valor_mercadoria: f.valor_mercadoria,
        pedidos: f.pedidos.map((p) => ({
          cod_pedido: p.cod_pedido,
          bordero: p.bordero,
          cliente: p.cliente,
          valor_mercadoria: p.valor_mercadoria,
          valor_frete: p.frete,
        })),
      })),
    },
  } as never);
  if (finErr) throw new Error(finErr.message);

  if (params.tipo === "FRETE") {
    await centralDb
      .from("routes")
      .update({
        total_freight: valor,
        frete_confirmado_em: agora,
        frete_confirmado_por: params.userId,
      } as never)
      .eq("id", params.routeId);
  }

  return { ok: true, ordem_id: ordemId, linhas: linhas.length };
}

export async function listarPagamentosDaRota(
  routeId: string,
): Promise<PagamentoRotaHistorico[]> {
  const { data: ordens, error } = await centralDb
    .from("ordens_pagamento_frete")
    .select(
      "id, created_at, autorizado_por, valor_autorizado, status, observacao, tipo_pagamento, motivo_adicional, substituida_em",
    )
    .eq("route_id", routeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const lista = (ordens ?? []) as unknown as {
    id: string;
    created_at: string;
    autorizado_por: string | null;
    valor_autorizado: number;
    status: string | null;
    observacao: string | null;
    tipo_pagamento: TipoPagamentoRota;
    motivo_adicional: string | null;
    substituida_em: string | null;
  }[];
  if (lista.length === 0) return [];

  const ids = lista.map((o) => o.id);
  const [{ data: valores }, { data: financeiro }, { data: perfis }] = await Promise.all([
    centralDb
      .from("fila_lancamento_erp_frete")
      .select("ordem_pagamento_id, status, ultimo_erro")
      .in("ordem_pagamento_id", ids),
    centralDb
      .from("fila_provisionamento_financeiro")
      .select("ordem_pagamento_id, status, referencia_erp, ultimo_erro")
      .in("ordem_pagamento_id", ids),
    centralDb
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(new Set(lista.map((o) => o.autorizado_por).filter(Boolean))) as string[]),
  ]);

  const nomes = new Map(
    ((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]),
  );
  const fin = new Map(
    ((financeiro ?? []) as {
      ordem_pagamento_id: string;
      status: string | null;
      referencia_erp: string | null;
      ultimo_erro: string | null;
    }[]).map((f) => [f.ordem_pagamento_id, f]),
  );
  const valoresPorOrdem = new Map<string, { total: number; erros: number }>();
  for (const v of (valores ?? []) as {
    ordem_pagamento_id: string;
    status: string | null;
    ultimo_erro: string | null;
  }[]) {
    const atual = valoresPorOrdem.get(v.ordem_pagamento_id) ?? { total: 0, erros: 0 };
    atual.total += 1;
    if (v.status === "ERRO") atual.erros += 1;
    valoresPorOrdem.set(v.ordem_pagamento_id, atual);
  }

  return lista.map((o) => {
    const f = fin.get(o.id);
    const v = valoresPorOrdem.get(o.id);
    return {
      id: o.id,
      created_at: o.created_at,
      autorizado_por: o.autorizado_por,
      autorizado_nome: (o.autorizado_por ? nomes.get(o.autorizado_por) : null) ?? null,
      tipo_pagamento: o.tipo_pagamento ?? "FRETE",
      motivo_adicional: rotuloMotivo(o.motivo_adicional),
      valor: Number(o.valor_autorizado ?? 0),
      observacao: o.observacao,
      substituida_em: o.substituida_em,
      status_erp: o.status ?? null,
      linhas_erp: v?.total ?? 0,
      erros_erp: v?.erros ?? 0,
      tarefa_status: f?.status ?? null,
      tarefa_referencia: f?.referencia_erp ?? null,
      tarefa_erro: f?.ultimo_erro ?? null,
    };
  });
}
