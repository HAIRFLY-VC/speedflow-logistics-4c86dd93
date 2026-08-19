// Ajuste manual dos status "Valores" e "Financeiro" de um CT-e.
// Grava apenas o status — nenhum fluxo do n8n/ERP é disparado.
import { centralDb } from "@/lib/central-db";

export type StatusManualInput = {
  cteId: string;
  valores?: "PENDENTE" | "APROVADO" | "REPROVADO" | null;
  financeiro?: boolean | null;
  userId: string;
};

export async function salvarStatusManual(input: StatusManualInput): Promise<void> {
  const { data: atual } = await centralDb
    .from("cte_status_override")
    .select("cte_id, valores, financeiro")
    .eq("cte_id", input.cteId)
    .maybeSingle();

  const valores = input.valores !== undefined ? input.valores : (atual?.valores ?? null);
  const financeiro =
    input.financeiro !== undefined ? input.financeiro : (atual?.financeiro ?? null);

  if (valores == null && financeiro == null) {
    const { error } = await centralDb
      .from("cte_status_override")
      .delete()
      .eq("cte_id", input.cteId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await centralDb.from("cte_status_override").upsert(
    {
      cte_id: input.cteId,
      valores,
      financeiro,
      definido_por: input.userId,
      definido_em: new Date().toISOString(),
    },
    { onConflict: "cte_id" },
  );
  if (error) throw new Error(error.message);
}
