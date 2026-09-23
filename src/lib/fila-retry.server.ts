/**
 * Reenvio automático das pendências de integração.
 *
 * Cobre as duas filas:
 *  - `valores`     → lançamento dos valores de frete no ERP;
 *  - `financeiro`  → criação da tarefa de pagamento no Bitrix.
 *
 * Itens com erro (ou parados aguardando retorno) ganham uma hora marcada para
 * a próxima tentativa, com intervalos crescentes: 1, 5, 15 e depois 30 minutos.
 *
 * Server-only.
 */
import { centralDb } from "./central-db";

export type NomeFila = "valores" | "financeiro";

const TABELA: Record<NomeFila, "fila_lancamento_erp_frete" | "fila_provisionamento_financeiro"> = {
  valores: "fila_lancamento_erp_frete",
  financeiro: "fila_provisionamento_financeiro",
};

/** Intervalos crescentes (minutos) por número de tentativas já realizadas. */
const INTERVALOS = [1, 5, 15, 30];

export function minutosAteProximaTentativa(tentativas: number): number {
  const i = Math.max(0, Math.min(tentativas, INTERVALOS.length - 1));
  return INTERVALOS[i] ?? 30;
}

function emMinutos(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

/** Registra uma tentativa no histórico (falhas de log nunca quebram o fluxo). */
export async function registrarTentativa(params: {
  fila: NomeFila;
  filaId: string;
  raizId: string;
  tentativa: number;
  ok: boolean;
  mensagem: string | null;
  origem: "AUTOMATICA" | "MANUAL" | "CALLBACK";
}): Promise<void> {
  try {
    await centralDb.from("fila_tentativas").insert({
      fila: params.fila,
      fila_id: params.filaId,
      raiz_id: params.raizId,
      tentativa: params.tentativa,
      ok: params.ok,
      mensagem: params.mensagem,
      origem: params.origem,
    } as never);
  } catch {
    /* histórico é complementar */
  }
}

type LinhaFila = Record<string, unknown> & {
  id: string;
  raiz_id: string | null;
  tentativas: number | null;
  status: string;
  cte_id: string | null;
  route_id: string | null;
};

/**
 * Recoloca um item na fila do n8n. A publicação é feita por gatilho de INSERT,
 * então o item é recriado (o histórico de tentativas fica em `fila_tentativas`).
 */
export async function reenfileirarItem(
  fila: NomeFila,
  filaId: string,
  origem: "AUTOMATICA" | "MANUAL" = "AUTOMATICA",
): Promise<{ ok: boolean; novoId?: string; erro?: string }> {
  const tabela = TABELA[fila];
  const { data: atual, error } = await centralDb
    .from(tabela)
    .select("*")
    .eq("id", filaId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!atual) return { ok: false, erro: "Item da fila não encontrado" };

  const linha = { ...(atual as unknown as LinhaFila) };
  const raiz = linha.raiz_id ?? linha.id;
  const tentativas = Number(linha.tentativas ?? 0);

  await centralDb.from(tabela).delete().eq("id", filaId);

  delete (linha as Record<string, unknown>)["id"];
  delete (linha as Record<string, unknown>)["created_at"];
  delete (linha as Record<string, unknown>)["updated_at"];
  const novo = {
    ...linha,
    raiz_id: raiz,
    status: "PENDENTE",
    ultimo_erro: null,
    processado_em: null,
    tentativas,
    pausada_em: null,
    // Se o n8n não devolver retorno, o item é reenviado depois deste prazo.
    proxima_tentativa_em: emMinutos(30),
  };
  const { data: inserido, error: insErr } = await centralDb
    .from(tabela)
    .insert(novo as never)
    .select("id")
    .single();
  if (insErr) return { ok: false, erro: insErr.message };

  const novoId = (inserido as { id: string }).id;
  await registrarTentativa({
    fila,
    filaId: novoId,
    raizId: raiz,
    tentativa: tentativas + 1,
    ok: true,
    mensagem: "Reenviado para a fila de lançamento no ERP",
    origem,
  });
  return { ok: true, novoId };
}

/** Executa uma tentativa de um item específico (usada pelo robô e pelo botão). */
export async function tentarItem(
  fila: NomeFila,
  filaId: string,
  origem: "AUTOMATICA" | "MANUAL" = "AUTOMATICA",
): Promise<{ ok: boolean; erro?: string }> {
  const tabela = TABELA[fila];
  const { data, error } = await centralDb
    .from(tabela)
    .select("id, raiz_id, tentativas, status, cte_id, route_id")
    .eq("id", filaId)
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  if (!data) return { ok: false, erro: "Item da fila não encontrado" };
  const linha = data as unknown as LinhaFila;
  const raiz = linha.raiz_id ?? linha.id;
  const tentativas = Number(linha.tentativas ?? 0);

  // Tarefa do Bitrix de rota: criada pelo próprio app.
  if (fila === "financeiro" && linha.route_id && !linha.cte_id) {
    const { processarTarefaFinanceiraRota } = await import("./rota-pagamento.server");
    let resultado: { ok: boolean; erro?: string };
    try {
      resultado = await processarTarefaFinanceiraRota(filaId);
    } catch (e) {
      resultado = { ok: false, erro: (e as Error).message };
    }
    await registrarTentativa({
      fila,
      filaId,
      raizId: raiz,
      tentativa: tentativas + 1,
      ok: resultado.ok,
      mensagem: resultado.ok ? "Tarefa criada no Bitrix" : (resultado.erro ?? null),
      origem,
    });
    await centralDb
      .from(tabela)
      .update({
        raiz_id: raiz,
        proxima_tentativa_em: resultado.ok
          ? null
          : emMinutos(minutosAteProximaTentativa(tentativas + 1)),
      } as never)
      .eq("id", filaId);
    return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
  }

  const r = await reenfileirarItem(fila, filaId, origem);
  return r.ok ? { ok: true } : { ok: false, erro: r.erro };
}

/** Itens que continuam pendentes de solução (para tela e avisos). */
export async function contarPendencias(): Promise<number> {
  let total = 0;
  for (const fila of ["valores", "financeiro"] as NomeFila[]) {
    const { count } = await centralDb
      .from(TABELA[fila])
      .select("id", { count: "exact", head: true })
      .eq("status", "ERRO")
      .is("resolvida_manual_em", null);
    total += count ?? 0;
  }
  return total;
}

/**
 * Passada do robô: reenvia tudo o que já venceu o intervalo da próxima
 * tentativa e avisa os administradores quando restam pendências.
 */
export async function processarPendencias(): Promise<{
  tentados: number;
  resolvidos: number;
  pendentes: number;
}> {
  const agora = new Date().toISOString();
  let tentados = 0;
  let resolvidos = 0;

  for (const fila of ["valores", "financeiro"] as NomeFila[]) {
    const { data, error } = await centralDb
      .from(TABELA[fila])
      .select("id, status, tentativas, raiz_id, cte_id, route_id")
      .in("status", ["ERRO", "PENDENTE"])
      .is("pausada_em", null)
      .is("resolvida_manual_em", null)
      // Itens antigos ficaram sem horário marcado: também entram na varredura.
      .or(`proxima_tentativa_em.lte.${agora},proxima_tentativa_em.is.null`)
      .order("proxima_tentativa_em", { ascending: true })
      .limit(50);
    if (error) continue;
    for (const item of (data ?? []) as unknown as LinhaFila[]) {
      tentados += 1;
      const r = await tentarItem(fila, item.id, "AUTOMATICA");
      if (r.ok) resolvidos += 1;
    }
  }

  const pendentes = await contarPendencias();
  if (pendentes > 0) {
    const { avisarAdministradores } = await import("./notificacoes-pendencias.server");
    await avisarAdministradores(pendentes);
  }

  return { tentados, resolvidos, pendentes };
}
