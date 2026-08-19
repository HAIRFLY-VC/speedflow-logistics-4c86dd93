export type NfeVolumeInfo = {
  chave: string;
  numero: string | null;
  volumes: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  /** Valor das mercadorias (vProd) da NF-e. */
  valor_produtos: number | null;
  especie: string | null;
  status:
    | "DISPONIVEL"
    | "PENDENTE"
    | "PROCESSANDO"
    | "ERRO"
    | "AUSENTE"
    | "AGUARDANDO_VARREDURA";
  /** Origem do dado exibido: XML da NF-e ou carga declarada no CT-e. */
  origem?: "NFE" | "CTE";
  mensagem: string | null;
};
