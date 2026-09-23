/** Tipos compartilhados (cliente + servidor) da confirmação de pagamento por rota. */

export type TipoPagamentoRota = "FRETE" | "ADICIONAL";

export type MotivoAdicional =
  | "PERNOITE"
  | "DESCARREGO"
  | "DIFICULDADE_ENTREGA"
  | "REENTREGA"
  | "DIARIA";

export const MOTIVOS_ADICIONAIS: { valor: MotivoAdicional; rotulo: string }[] = [
  { valor: "PERNOITE", rotulo: "Pernoite" },
  { valor: "DESCARREGO", rotulo: "Descarrego" },
  { valor: "DIFICULDADE_ENTREGA", rotulo: "Dificuldade de entrega" },
  { valor: "REENTREGA", rotulo: "Reentrega" },
  { valor: "DIARIA", rotulo: "Diária" },
];

export type PedidoPagamento = {
  cod_pedido: string;
  cliente: string;
  bordero: string | null;
  nro_nf: string | null;
  valor_mercadoria: number;
  frete: number;
};

export type FilialPagamento = {
  cod_filial: string;
  pedidos: PedidoPagamento[];
  valor_mercadoria: number;
  frete: number;
};

/** Prazo mínimo (em dias) entre hoje e a data sugerida de pagamento. */
export const PRAZO_PAGAMENTO_DIAS = 9;

/** Data de hoje no fuso de Brasília, no formato AAAA-MM-DD. */
export function hojeBrasilia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Soma dias a uma data AAAA-MM-DD. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Data mínima (= sugerida) de pagamento: hoje + 9 dias. */
export function dataMinimaPagamento(): string {
  return somarDias(hojeBrasilia(), PRAZO_PAGAMENTO_DIAS);
}

/** Formata AAAA-MM-DD como dd/MM/aaaa. */
export function formatarDataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export type PreviewPagamentoRota = {
  route_id: string;
  rota: string;
  erp_route_id: string | null;
  valor: number;
  valor_mercadoria: number;
  total_pedidos: number;
  pedidos_sem_bordero: number;
  /** Pedidos ainda sem nota fiscal emitida (não faturados). */
  pedidos_sem_faturamento: number;
  ja_confirmado: boolean;
  /** Data sugerida de pagamento (AAAA-MM-DD). */
  data_pagamento: string;
  /** Pedidos/notas efetivamente considerados no rateio. */
  pedidos_selecionados: string[];
  filiais: FilialPagamento[];
  texto_tarefa: string;
};

export type PagamentoRotaHistorico = {
  id: string;
  created_at: string;
  autorizado_por: string | null;
  autorizado_nome: string | null;
  tipo_pagamento: TipoPagamentoRota;
  motivo_adicional: string | null;
  valor: number;
  observacao: string | null;
  substituida_em: string | null;
  status_erp: string | null;
  linhas_erp: number;
  erros_erp: number;
  tarefa_status: string | null;
  tarefa_referencia: string | null;
  tarefa_erro: string | null;
};
