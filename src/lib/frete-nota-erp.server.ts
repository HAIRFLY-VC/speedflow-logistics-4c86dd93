/**
 * Consulta no ERP a nota fiscal (e filial/borderô) de cada pedido.
 *
 * Usada como complemento do espelho de entregas: pedidos já com borderô
 * emitido saem da consulta de expedição pendente, mas continuam em
 * GKS.A_GERENTREGAS com a nota fiscal necessária para o lançamento do frete.
 */

export type NotaDoPedido = {
  nro_nf: string | null;
  cod_filial: string | null;
  bordero: string | null;
};

async function erpQuery(sql: string, limit: number): Promise<Record<string, unknown>[]> {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql, limit }),
  });
  if (!res.ok) {
    const t = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`ERP API ${res.status}${t ? `: ${t}` : ""}`);
  }
  const json = (await res.json()) as { rows?: Record<string, unknown>[] };
  return json.rows ?? [];
}

function txt(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Para cada pedido informado, devolve a nota fiscal mais recente lançada no
 * ERP. Falhas de comunicação não quebram o fluxo: o pedido simplesmente fica
 * sem nota e a confirmação do pagamento é bloqueada na tela.
 */
export async function buscarNotasPorPedido(
  codPedidos: string[],
): Promise<Map<string, NotaDoPedido>> {
  const mapa = new Map<string, NotaDoPedido>();
  const unicos = Array.from(new Set(codPedidos.map((c) => c.trim()).filter(Boolean)));
  for (let i = 0; i < unicos.length; i += 300) {
    const lote = unicos.slice(i, i + 300);
    const lista = lote.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
    const sql = `
      SELECT G.COD_PEDIDO,
             MAX(G.NRO_NF) KEEP (DENSE_RANK LAST ORDER BY G.NRO_NF) NRO_NF,
             MAX(G.COD_FILIAL) KEEP (DENSE_RANK LAST ORDER BY G.NRO_NF) COD_FILIAL,
             MAX(G.BORDERO) BORDERO
        FROM GKS.A_GERENTREGAS G
       WHERE G.COD_PEDIDO IN (${lista})
       GROUP BY G.COD_PEDIDO
    `;
    let linhas: Record<string, unknown>[] = [];
    try {
      linhas = await erpQuery(sql, lote.length + 10);
    } catch {
      continue;
    }
    for (const row of linhas) {
      const cod = txt(row["COD_PEDIDO"] ?? row["cod_pedido"]);
      if (!cod) continue;
      mapa.set(cod, {
        nro_nf: txt(row["NRO_NF"] ?? row["nro_nf"]),
        cod_filial: txt(row["COD_FILIAL"] ?? row["cod_filial"]),
        bordero: txt(row["BORDERO"] ?? row["bordero"]),
      });
    }
  }
  return mapa;
}
