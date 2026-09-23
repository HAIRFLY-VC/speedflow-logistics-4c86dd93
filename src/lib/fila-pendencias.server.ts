/**
 * Consulta e ações da tela "Pendências de integração".
 * Server-only.
 */
import { centralDb } from "./central-db";
import { minutosAteProximaTentativa, registrarTentativa, tentarItem } from "./fila-retry.server";
import type { NomeFila } from "./fila-retry.server";

export type ItemPendencia = {
  id: string;
  raiz_id: string;
  fila: NomeFila;
  destino: string;
  status: string;
  tentativas: number;
  ultimo_erro: string | null;
  referencia_erp: string | null;
  proxima_tentativa_em: string | null;
  pausada_em: string | null;
  resolvida_manual_em: string | null;
  resolvida_manual_motivo: string | null;
  criado_em: string | null;
  processado_em: string | null;
  rota_codigo: string | null;
  cte_id: string | null;
  route_id: string | null;
  cod_filial: string | null;
  nro_nf: string | null;
  bordero: string | null;
  valor: number | null;
  titulo: string | null;
};

export type TentativaHistorico = {
  id: string;
  tentativa: number;
  ok: boolean;
  mensagem: string | null;
  origem: string;
  criado_em: string;
};

const TABELA: Record<NomeFila, "fila_lancamento_erp_frete" | "fila_provisionamento_financeiro"> = {
  valores: "fila_lancamento_erp_frete",
  financeiro: "fila_provisionamento_financeiro",
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Lista as pendências das duas filas (por padrão só o que não está concluído). */
export async function listarPendencias(
  incluirResolvidas = false,
): Promise<{ itens: ItemPendencia[]; pendentes: number; comErro: number }> {
  const itens: ItemPendencia[] = [];
  const rotaIds = new Set<string>();

  for (const fila of ["valores", "financeiro"] as NomeFila[]) {
    let q = centralDb.from(TABELA[fila]).select("*").order("created_at", { ascending: false }).limit(300);
    if (!incluirResolvidas) q = q.neq("status", "CONCLUIDO");
    const { data, error } = await q;
    if (error) continue;
    for (const bruto of (data ?? []) as unknown as Record<string, unknown>[]) {
      const payload = (bruto["payload"] ?? {}) as Record<string, unknown>;
      const routeId = texto(bruto["route_id"]);
      if (routeId) rotaIds.add(routeId);
      itens.push({
        id: String(bruto["id"]),
        raiz_id: String(bruto["raiz_id"] ?? bruto["id"]),
        fila,
        destino: fila === "valores" ? "Lançamento no ERP" : "Tarefa no Bitrix",
        status: String(bruto["status"] ?? "PENDENTE"),
        tentativas: Number(bruto["tentativas"] ?? 0),
        ultimo_erro: texto(bruto["ultimo_erro"]),
        referencia_erp: texto(bruto["referencia_erp"]),
        proxima_tentativa_em: texto(bruto["proxima_tentativa_em"]),
        pausada_em: texto(bruto["pausada_em"]),
        resolvida_manual_em: texto(bruto["resolvida_manual_em"]),
        resolvida_manual_motivo: texto(bruto["resolvida_manual_motivo"]),
        criado_em: texto(bruto["created_at"]),
        processado_em: texto(bruto["processado_em"]),
        rota_codigo: null,
        cte_id: texto(bruto["cte_id"]),
        route_id: routeId,
        cod_filial: texto(bruto["cod_filial"]),
        nro_nf: texto(bruto["nro_nf"]),
        bordero: texto(bruto["bordero"]),
        valor: bruto["vlr_frete"] != null ? Number(bruto["vlr_frete"]) : null,
        titulo: texto(payload["titulo_tarefa"]),
      });
    }
  }

  if (rotaIds.size > 0) {
    const { data: rotas } = await centralDb
      .from("routes")
      .select("id, code, notes")
      .in("id", [...rotaIds]);
    const mapa = new Map<string, string>();
    for (const r of (rotas ?? []) as unknown as Record<string, unknown>[]) {
      mapa.set(String(r["id"]), String(r["code"] ?? ""));
    }
    for (const item of itens) {
      if (item.route_id) item.rota_codigo = mapa.get(item.route_id) ?? null;
    }
  }

  itens.sort((a, b) => (b.criado_em ?? "").localeCompare(a.criado_em ?? ""));
  const ativos = itens.filter((i) => !i.resolvida_manual_em && i.status !== "CONCLUIDO");
  return {
    itens,
    pendentes: ativos.length,
    comErro: ativos.filter((i) => i.status === "ERRO").length,
  };
}

/** Histórico de tentativas de um item (pela raiz, que sobrevive aos reenvios). */
export async function historicoTentativas(raizId: string): Promise<TentativaHistorico[]> {
  const { data } = await centralDb
    .from("fila_tentativas")
    .select("id, tentativa, ok, mensagem, origem, criado_em")
    .eq("raiz_id", raizId)
    .order("criado_em", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as TentativaHistorico[];
}

/** Tenta agora, a pedido do usuário. */
export async function tentarAgora(fila: NomeFila, filaId: string) {
  return tentarItem(fila, filaId, "MANUAL");
}

/** Pausa ou retoma o reenvio automático de um item. */
export async function alternarPausa(fila: NomeFila, filaId: string, pausar: boolean) {
  const patch = pausar
    ? { pausada_em: new Date().toISOString() }
    : {
        pausada_em: null,
        proxima_tentativa_em: new Date(
          Date.now() + minutosAteProximaTentativa(0) * 60_000,
        ).toISOString(),
      };
  const { error } = await centralDb.from(TABELA[fila]).update(patch as never).eq("id", filaId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Marca o item como resolvido manualmente (sai da fila e dos avisos). */
export async function resolverManualmente(
  fila: NomeFila,
  filaId: string,
  userId: string,
  motivo: string,
) {
  const { data: atual } = await centralDb
    .from(TABELA[fila])
    .select("id, raiz_id, tentativas")
    .eq("id", filaId)
    .maybeSingle();
  const linha = (atual ?? {}) as Record<string, unknown>;

  const { error } = await centralDb
    .from(TABELA[fila])
    .update({
      status: "CONCLUIDO",
      resolvida_manual_em: new Date().toISOString(),
      resolvida_manual_por: userId,
      resolvida_manual_motivo: motivo,
      proxima_tentativa_em: null,
      processado_em: new Date().toISOString(),
    } as never)
    .eq("id", filaId);
  if (error) throw new Error(error.message);

  await registrarTentativa({
    fila,
    filaId,
    raizId: String(linha["raiz_id"] ?? filaId),
    tentativa: Number(linha["tentativas"] ?? 0),
    ok: true,
    mensagem: `Resolvido manualmente: ${motivo}`,
    origem: "MANUAL",
  });
  return { ok: true };
}
