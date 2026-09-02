import type { Database } from "@/integrations/supabase/types";

/**
 * Tipos do banco central (esquema `speedflow`).
 *
 * Reaproveitam os tipos gerados do app e acrescentam o que só existe no
 * central: o vínculo `erp_cod_cliente` (cadastro de clientes vem do ERP) e o
 * cache de coordenadas `customer_geo`.
 */
type Pub = Database["public"];

type OrdersRow = Pub["Tables"]["orders"]["Row"] & {
  erp_cod_cliente: string | null;
};
type OrdersWrite = Omit<Pub["Tables"]["orders"]["Insert"], "customer_id"> & {
  erp_cod_cliente?: string | null;
};

type CustomerGeoRow = {
  cod_cliente: string;
  latitude: number | null;
  longitude: number | null;
  endereco_usado: string | null;
  updated_at: string;
};

type EmpresasRow = Pub["Tables"]["empresas"]["Row"] & { cod_erp: string | null };
type EmpresasWrite = Pub["Tables"]["empresas"]["Insert"] & { cod_erp?: string | null };

type TransportadorasRow = Pub["Tables"]["transportadoras"]["Row"] & {
  cod_erp: string | null;
};
type TransportadorasWrite = Pub["Tables"]["transportadoras"]["Insert"] & {
  cod_erp?: string | null;
};

export type FilaErpStatus = "PENDENTE" | "PROCESSANDO" | "CONCLUIDO" | "ERRO";
export type OrdemAprovacaoStatus = "PENDENTE" | "APROVADO" | "REPROVADO";
export type ErpCampoValor =
  | "vlr_frete"
  | "vlr_perna"
  | "vlr_diaria"
  | "vlr_pernoite"
  | "vlr_reentrega"
  | "vlr_descarrego";

type OpfRow = Pub["Tables"]["ordens_pagamento_frete"]["Row"] & {
  aprovacao_status: OrdemAprovacaoStatus;
  decidido_por: string | null;
  decidido_em: string | null;
  observacao: string | null;
  erp_registro_selecionado: unknown | null;
};
type OpfWrite = Pub["Tables"]["ordens_pagamento_frete"]["Insert"] & {
  aprovacao_status?: OrdemAprovacaoStatus;
  decidido_por?: string | null;
  decidido_em?: string | null;
  observacao?: string | null;
  erp_registro_selecionado?: unknown | null;
};

type FilaValoresRow = {
  id: string;
  ordem_pagamento_id: string;
  cte_id: string | null;
  payload: unknown;
  status: FilaErpStatus;
  tentativas: number;
  ultimo_erro: string | null;
  referencia_erp: string | null;
  processado_em: string | null;
  cod_filial: string | null;
  nro_nf: string | null;
  chave_nfe: string | null;
  vlr_frete: number;
  vlr_perna: number;
  vlr_diaria: number;
  vlr_pernoite: number;
  vlr_reentrega: number;
  vlr_descarrego: number;
  registro_erp: unknown | null;
  created_at: string;
  updated_at: string;
};

type FilaFinanceiroRow = {
  id: string;
  ordem_pagamento_id: string;
  cte_id: string | null;
  payload: unknown;
  status: FilaErpStatus;
  tentativas: number;
  ultimo_erro: string | null;
  referencia_erp: string | null;
  processado_em: string | null;
  created_at: string;
  updated_at: string;
};

type MapeamentoRow = {
  id: string;
  transportadora_id: string | null;
  nome_componente_cte: string;
  campo_erp: ErpCampoValor;
  created_at: string;
  updated_at: string;
};

type IntegracaoN8nRow = {
  id: number;
  webhook_url: string | null;
  webhook_url_financeiro: string | null;
  webhook_token: string | null;
  ativo: boolean;
  updated_at: string;
};

type CteStatusOverrideRow = {
  cte_id: string;
  valores: "PENDENTE" | "APROVADO" | "REPROVADO" | null;
  financeiro: boolean | null;
  definido_por: string | null;
  definido_em: string;
};

type TabelaTransportadoraRow = {
  id: string;
  tabela_id: string;
  transportadora_id: string;
  created_at: string;
};

type ErpResponsavelRow = {
  cod_erp: string;
  razao_social: string | null;
  natureza: string | null;
  tipo_frete: string | null;
  atualizado_em: string;
};

type SimpleTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type CentralDatabase = Omit<Database, "public"> & {
  public: Omit<Pub, "Tables"> & {
    Tables: Omit<
      Pub["Tables"],
      "orders" | "empresas" | "ordens_pagamento_frete" | "transportadoras"
    > & {
      transportadoras: Omit<
        Pub["Tables"]["transportadoras"],
        "Row" | "Insert" | "Update"
      > & {
        Row: TransportadorasRow;
        Insert: TransportadorasWrite;
        Update: Partial<TransportadorasWrite>;
      };
      empresas: Omit<Pub["Tables"]["empresas"], "Row" | "Insert" | "Update"> & {
        Row: EmpresasRow;
        Insert: EmpresasWrite;
        Update: Partial<EmpresasWrite>;
      };
      ordens_pagamento_frete: Omit<
        Pub["Tables"]["ordens_pagamento_frete"],
        "Row" | "Insert" | "Update"
      > & {
        Row: OpfRow;
        Insert: OpfWrite;
        Update: Partial<OpfWrite>;
      };
      orders: Omit<Pub["Tables"]["orders"], "Row" | "Insert" | "Update"> & {
        Row: OrdersRow;
        Insert: OrdersWrite;
        Update: Partial<OrdersWrite>;
      };
      customer_geo: {
        Row: CustomerGeoRow;
        Insert: Partial<CustomerGeoRow> & { cod_cliente: string };
        Update: Partial<CustomerGeoRow>;
        Relationships: [];
      };
      erp_responsaveis: SimpleTable<ErpResponsavelRow>;
      fila_lancamento_erp_frete: SimpleTable<FilaValoresRow>;
      fila_provisionamento_financeiro: SimpleTable<FilaFinanceiroRow>;
      mapeamento_componentes_erp: SimpleTable<MapeamentoRow>;
      integracao_n8n: SimpleTable<IntegracaoN8nRow>;
      tabelas_preco_frete_transportadoras: SimpleTable<TabelaTransportadoraRow>;
      cte_status_override: SimpleTable<CteStatusOverrideRow>;
    };
  };
};

