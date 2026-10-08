/** Tipos compartilhados do provisionamento de frete de rotas de transportadora. */
import type { DetalheFrete } from "./frete-simulacao";

/** Entrega = notas do mesmo cliente na mesma cidade/UF; frete calculado uma vez e rateado por peso. */
export type ProvisaoEntrega = {
  chave: string;
  cliente: string;
  cidade: string | null;
  uf: string | null;
  peso: number;
  valor_mercadoria: number;
  vlr_frete: number | null;
  detalhe: DetalheFrete | null;
  notas: ProvisaoNota[];
};

export type ProvisaoNota = {
  cod_filial: string;
  nro_nf: string | null;
  bordero: string | null;
  pedidos: string[];
  clientes: string[];
  cidade: string | null;
  uf: string | null;
  peso: number;
  valor_mercadoria: number;
  /** Frete calculado pela tabela (null quando a praça não foi encontrada). */
  vlr_frete: number | null;
};

export type PreviewProvisao = {
  route_id: string;
  erp_route_id: string | null;
  rota: string;
  transportadora: { id: string; razao_social: string; cod_erp: string | null } | null;
  tabela: { id: string; nome: string } | null;
  notas: ProvisaoNota[];
  entregas: ProvisaoEntrega[];
  total_mercadoria: number;
  total: number;
  /** Motivos que impedem a gravação. */
  bloqueios: string[];
  ja_confirmado: boolean;
};
