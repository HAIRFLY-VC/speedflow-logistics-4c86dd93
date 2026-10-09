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
  /** Praças da tabela (quando ela é por praça). */
  pracas: { id: string; destino: string; municipios?: string[] }[];
  notas: ProvisaoNota[];
  entregas: ProvisaoEntrega[];
  total_mercadoria: number;
  total: number;
  /** Motivos que impedem a gravação. */
  bloqueios: string[];
  ja_confirmado: boolean;
  /** Provisionamento ativo já gravado no ERP (null quando não existe). */
  gravado: ProvisaoGravada | null;
  /** Gravado difere do cálculo atual (total ou alguma nota). */
  divergente: boolean;
};

export type ProvisaoGravada = {
  total: number;
  dt_provisao: string | null;
  usuario: string | null;
  /** Frete gravado por nota, chave `filial|nf|borderô`. */
  por_nota: Record<string, number>;
};

export const chaveNota = (n: { cod_filial: string | number; nro_nf: string | number | null; bordero: string | number | null }) =>
  `${Number(n.cod_filial)}|${Number(n.nro_nf ?? 0)}|${Number(n.bordero ?? 0)}`;
