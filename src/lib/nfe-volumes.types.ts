export type NfeVolumeInfo = {
  chave: string;
  numero: string | null;
  volumes: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  especie: string | null;
  status: "DISPONIVEL" | "PENDENTE" | "PROCESSANDO" | "ERRO" | "AUSENTE";
  mensagem: string | null;
};
