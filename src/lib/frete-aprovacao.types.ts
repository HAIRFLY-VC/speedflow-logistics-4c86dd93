import type { ErpCampoValor } from "@/integrations/central/types";

export type { ErpCampoValor };

export const CAMPOS_ERP: { campo: ErpCampoValor; label: string }[] = [
  { campo: "vlr_frete", label: "Frete" },
  { campo: "vlr_perna", label: "Perna" },
  { campo: "vlr_diaria", label: "Diária" },
  { campo: "vlr_pernoite", label: "Pernoite" },
  { campo: "vlr_reentrega", label: "Reentrega" },
  { campo: "vlr_descarrego", label: "Descarrego" },
];

export type ValoresErp = Record<ErpCampoValor, number>;

export type ComponentePreview = {
  nome: string;
  valor: number;
  campo: ErpCampoValor | null;
  origem: "transportadora" | "geral" | "automatico" | "nenhum";
};

export type RegistroErp = {
  bordero: string | null;
  dt_saida: string | null;
  vlr_frete: number;
  vlr_perna: number;
  vlr_diaria: number;
  vlr_pernoite: number;
  vlr_reentrega: number;
  vlr_descarrego: number;
};

export type NfePreview = {
  chave: string;
  numero: string;
  peso_bruto: number | null;
  valor_nfe: number | null;
  valores: ValoresErp;
  registros: RegistroErp[];
};

export type AprovacaoPreview = {
  cte_id: string;
  cod_filial: string | null;
  valor_total: number;
  componentes: ComponentePreview[];
  naoMapeados: string[];
  valores: ValoresErp;
  notas: NfePreview[];
  jaAprovado: boolean;
  aprovacaoStatus: "PENDENTE" | "APROVADO" | "REPROVADO";
  observacao: string | null;
  /** Status de contabilização dos valores de frete (aprovacao interna + override). */
  contabilizado: "PENDENTE" | "APROVADO" | "REPROVADO";
  /** Status de lançamento no financeiro do ERP (consulta Oracle + override). */
  financeiro: boolean | null;
};
