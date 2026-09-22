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
  valor_mercadoria: number;
  frete: number;
};

export type FilialPagamento = {
  cod_filial: string;
  pedidos: PedidoPagamento[];
  valor_mercadoria: number;
  frete: number;
};

export type PreviewPagamentoRota = {
  route_id: string;
  rota: string;
  erp_route_id: string | null;
  valor: number;
  valor_mercadoria: number;
  total_pedidos: number;
  pedidos_sem_bordero: number;
  ja_confirmado: boolean;
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
