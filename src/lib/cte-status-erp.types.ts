export type StatusErpCte = {
  cteId: string;
  /** Resultado da autorização feita no app (botão de aprovar). */
  contabilizado: "PENDENTE" | "APROVADO" | "REPROVADO";
  /** true/false quando foi possível consultar o ERP; null quando indisponível. */
  financeiro: boolean | null;
  vencimento: string | null;
  valor: number | null;
};
