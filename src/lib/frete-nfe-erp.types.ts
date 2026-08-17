export type FreteContabilizadoNfe = {
  chave: string;
  numero: string;
  bordero: string | null;
  dt_saida: string | null;
  vlr_frete: number;
  vlr_perna: number;
  vlr_diaria: number;
  vlr_pernoite: number;
  vlr_reentrega: number;
  vlr_descarrego: number;
  total: number;
};
