import { SQL_EXTRAS_ENTREGA, extrasEntrega, semExtras, erroColunaAusente } from "@/lib/entregas-extras";
// Server-only helper: importa pedidos pendentes de expedição do ERP Oracle (Hairfly).
// API: POST {ERP_API_BASE_URL}/v1/query com { sql, binds, limit } e header X-API-Key.

import { centralDb } from "@/lib/central-db";


type ErpColumn = { name: string; type: string };
type ErpQueryResponse = {
  columns: ErpColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated?: boolean;
};

type ErpOrderRow = {
  PEDIDO: number;
  COD_AGENDA: number | null;
  COD_FILIAL: number | string | null;
  COD_CLIENTE: number;
  CLIENTE_RS: string | null;
  CLIENTE_NF: string | null;
  BAIRRO: string | null;
  CIDADE: string | null;
  UF: string | null;
  CEP: string | null;
  COD_VENDEDOR: number | null;
  VENDEDOR: string | null;
  VALOR_PEDIDO: number | null;
  VALOR: number | null;
  PESO: number | null;
  DT_PEDIDO: string | null;
  DT_EMISSAO: string | null;
  OBS: string | null;
  STATUS: string | null;
  DT_PREV_EXP: string | null;
  NOME_ROTA: string | null;
  NOME_MOTORISTA: string | null;
  COD_FRT_TRP: number | string | null;
  QTD_DIAS: number | null;
  ID_ROTA: number | string | null;
  ROTA_STATUS: string | null;
  OBS_LOGIST: string | null;
};

// Extrai o endereço alternativo de entrega presente no OBS_LOGIST.
// Aceita variações como "ENDERECO DE ENTREGA:", "ENDEREÇO DE ENTREGA:", etc.
function parseDeliveryOverride(obsLogist: unknown): string | null {
  if (!obsLogist || typeof obsLogist !== "string") return null;
  const m = obsLogist.match(/ENDERE[CÇ]O\s+DE\s+ENTREGA\s*:\s*([^\r\n]+)/i);
  if (!m) return null;
  const addr = m[1].trim();
  return addr.length > 0 ? addr : null;
}

const PENDING_ORDERS_SQL = `
  SELECT E.COD_AGENDA, E.COD_FILIAL, E.NR_DOCUMENTO, E.DT_AGENDA,
         E.COD_CLIENTE, E.CLIENTE_RS, E.CLIENTE_NF, E.BAIRRO, E.CIDADE, E.UF, E.PIN,
         E.COD_VENDEDOR, E.VENDEDOR, E.VALOR, E.PESO, E.VOLUME,
         E.PEDIDO, E.VALOR_PEDIDO, E.DT_PEDIDO, E.DT_EMISSAO,
         E.BORDERO, E.DT_BORDERO, E.STATUS_BORDERO,
         E.COD_MOTORISTA_BORD AS COD_MOTORISTA, E.PLACA, E.MOTORISTA_BORD AS MOTORISTA,
         E.STATUS, E.OBS, E.QTD_DIAS AS QTD_DIAS, E.OBS_LOGIST, E.DIF_ENT,
         E.GNRE, E.TP_PGTO, E.INF_CMP, E.QTD_EMB,
          R.DT_PREV_EXP DT_PREV_EXP,
         R.NOME_ROTA, R.COD_FRT_TRP, R.NOME_MOTORISTA, R.ID AS ID_ROTA, R.STATUS AS ROTA_STATUS, E.CEP
  FROM ERP_PEDIDOS_EXPEDICAO_PENDENTE E,
       A_GER_ROTAS_PEDIDOS P,
       A_GER_ROTAS R
  WHERE E.DT_SAIDA_BORDERO IS NULL
    AND (E.NF_DEVOLVIDA IS NULL OR E.NF_DEVOLVIDA = 'NAO')
    AND E.COD_AGENDA IN (417, 427)
    AND E.COD_CLIENTE NOT IN (4065, 4081, 4170, 4189, 4405, 4413, 4634, 4642)
    AND E.PEDIDO NOT IN (4034403, 4026661, 4026662, 96385, 4003534)
    AND P.PEDIDO(+) = E.PEDIDO
    AND R.ID(+) = P.ID
`;

// Erros típicos de indisponibilidade do servidor de origem (Cloudflare entre nós e o ERP).
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

function nowBr(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function friendlyErpError(status: number, bodyText: string): string {
  if (TRANSIENT_HTTP_STATUSES.has(status)) {
    return `ERP fora do ar (HTTP ${status}) em ${nowBr()}. O servidor do ERP não respondeu; tente novamente em alguns minutos.`;
  }

  if (status === 401 || status === 403) {
    return `ERP recusou a autenticação (HTTP ${status}). Verifique a API Key.`;
  }
  if (status === 429) {
    return `ERP retornou limite de requisições (HTTP 429). Tente novamente em instantes.`;
  }
  // fallback: usa o corpo curto, apenas se parecer texto útil
  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 200);
  return `ERP API ${status}${snippet ? `: ${snippet}` : ""}`;
}

/** Consulta genérica ao ERP (mesma API usada pelas demais etapas). */
async function erpQuery(sql: string, limit: number): Promise<Record<string, unknown>[]> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
      signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql, binds: {}, limit }),
  });
  if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
  const json = (await res.json()) as ErpQueryResponse;
  return json.rows ?? [];
}

/**
 * Rotas com ID do ERP sem nenhum pedido vinculado no app: importa os pedidos
 * da rota (inclusive os já expedidos) pela auditoria de rota e completa o
 * responsável (COD_FRT_TRP / motorista) quando estiver faltando.
 */
export async function completarRotasSemPedidos(limite = 50): Promise<number> {
  const { data: rotas, error } = await centralDb
    .from("routes")
    .select("id, erp_route_id, erp_carrier_code, driver_name, route_orders(id)")
    .not("erp_route_id", "is", null)
    .neq("status", "cancelada")
    .neq("erp_status", "E")
    .gte("route_date", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10))
    .lt("route_date", "3000-01-01")
    .limit(2000);
  if (error) throw error;
  const vazias = (rotas ?? [])
    .filter((r) => /^\d+$/.test(String(r.erp_route_id).trim()))
    .filter((r) => !((r.route_orders as unknown[] | null)?.length))
    .slice(0, limite);
  if (vazias.length === 0) return 0;

  // Responsável da rota no ERP
  const semResp = vazias.filter((r) => !r.erp_carrier_code || !r.driver_name);
  if (semResp.length > 0) {
    const ids = semResp.map((r) => String(r.erp_route_id).trim());
    const res = await erpQuery(
      `select ID, COD_FRT_TRP, NOME_MOTORISTA from GKS.A_GER_ROTAS where ID in (${ids.join(",")})`,
      ids.length + 10,
    );
    for (const row of res) {
      const rota = semResp.find((r) => String(r.erp_route_id).trim() === String(row.ID));
      if (!rota) continue;
      const patch: Record<string, string> = {};
      const cod = row.COD_FRT_TRP != null ? String(row.COD_FRT_TRP).trim() : "";
      const mot = row.NOME_MOTORISTA != null ? String(row.NOME_MOTORISTA).trim() : "";
      if (!rota.erp_carrier_code && cod) patch["erp_carrier_code"] = cod;
      if (!rota.driver_name && mot) patch["driver_name"] = mot;
      if (Object.keys(patch).length > 0)
        await centralDb.from("routes").update(patch as never).eq("id", rota.id as string);
    }
  }

  const { auditarEImportarRotas } = await import("@/lib/rota-auditoria.server");
  const aud = await auditarEImportarRotas(vazias.map((r) => r.id as string));
  const importados = aud.reduce((s, a) => s + a.importados, 0);
  console.log(`[erp-sync] ${vazias.length} rotas sem pedidos conferidas; ${importados} pedidos importados`);
  return importados;
}

/** Carência antes de excluir um pedido que o ERP ainda não devolveu borderô. */
const BORDERO_CARENCIA_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Rotas cujo borderô já foi emitido no ERP: elas deixam de voltar na consulta
 * de pedidos pendentes. Em vez de apagar, marca a rota e busca o número do
 * borderô de cada pedido em `GKS.A_GERENTREGAS`. Como essa tabela é alimentada
 * com atraso, o pedido sem borderô continua aguardando e só é removido depois
 * da carência.
 */
async function tratarRotasComBorderoEmitido(routeIds: string[]): Promise<void> {
  const agora = new Date().toISOString();
  if (routeIds.length > 0) {
    const { error: upErr } = await centralDb
      .from("routes")
      .update({ bordero_emitido_em: agora })
      .in("id", routeIds)
      .is("bordero_emitido_em", null);
    if (upErr) throw upErr;
  }

  // Todas as rotas com borderô emitido (inclusive de sincronizações anteriores)
  // continuam sendo consultadas enquanto tiverem pedidos sem número de borderô.
  const { data: marcadas, error: marcErr } = await centralDb
    .from("routes")
    .select("id, bordero_emitido_em")
    .not("bordero_emitido_em", "is", null);
  if (marcErr) throw marcErr;
  const marcadaEm = new Map<string, string>();
  for (const r of marcadas ?? []) {
    marcadaEm.set(String(r.id), String(r.bordero_emitido_em ?? agora));
  }
  const alvos = Array.from(marcadaEm.keys());
  if (alvos.length === 0) return;

  const { data: links, error: linkErr } = await centralDb
    .from("route_orders")
    .select("route_id, order_id, orders(erp_id, order_number, bordero)")
    .in("route_id", alvos);
  if (linkErr) throw linkErr;

  type Link = {
    route_id: string;
    order_id: string;
    orders: { erp_id: string | null; order_number: string | null; bordero: string | null } | null;
  };
  const rows = (links ?? []) as unknown as Link[];
  const codeByOrderId = new Map<string, string>();
  const routeByOrderId = new Map<string, string>();
  for (const l of rows) {
    if (l.orders?.bordero) continue; // já tem número gravado
    const cod = (l.orders?.erp_id ?? l.orders?.order_number ?? "").trim();
    if (!cod) continue;
    codeByOrderId.set(l.order_id, cod);
    routeByOrderId.set(l.order_id, String(l.route_id));
  }
  const codigos = Array.from(new Set(codeByOrderId.values()));
  if (codigos.length === 0) return;

  // A GKS.A_GERENTREGAS só ganha registro depois que a nota fiscal do pedido
  // é emitida. Pedido sem NF nunca tem borderô: quem não tem linha na tabela
  // continua aguardando, sem contar a carência e sem risco de exclusão.
  const borderoPorPedido = new Map<string, string>();
  const comRegistroNoErp = new Set<string>();
  for (let i = 0; i < codigos.length; i += 300) {
    const lote = codigos.slice(i, i + 300);
    const lista = lote.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
    const sql = `
      SELECT G.COD_PEDIDO,
             MAX(CASE WHEN NVL(G.STATUS, '-') <> 'O' THEN G.BORDERO END)
               KEEP (DENSE_RANK LAST ORDER BY CASE WHEN NVL(G.STATUS, '-') <> 'O' THEN 1 ELSE 0 END,
                     G.DT_SAIDA NULLS FIRST, G.BORDERO NULLS FIRST) BORDERO
        FROM GKS.A_GERENTREGAS G
       WHERE G.COD_PEDIDO IN (${lista})
       GROUP BY G.COD_PEDIDO
    `;
    for (const row of await erpQuery(sql, lote.length + 10)) {
      const cod = String(row.COD_PEDIDO ?? "").trim();
      if (!cod) continue;
      comRegistroNoErp.add(cod);
      const bordero = String(row.BORDERO ?? "").trim();
      if (bordero) borderoPorPedido.set(cod, bordero);
    }
  }

  // Grava o borderô encontrado em cada pedido.
  const porBordero = new Map<string, string[]>();
  const semBordero: string[] = [];
  const limite = Date.now() - BORDERO_CARENCIA_MS;
  for (const [orderId, cod] of codeByOrderId) {
    const b = borderoPorPedido.get(cod);
    if (!b) {
      // Sem registro no ERP = nota fiscal ainda não emitida: apenas aguarda.
      if (!comRegistroNoErp.has(cod)) continue;
      const marcado = Date.parse(marcadaEm.get(routeByOrderId.get(orderId) ?? "") ?? agora);
      // Ainda dentro da carência: aguarda o ERP alimentar a tabela.
      if (Number.isFinite(marcado) && marcado > limite) continue;
      semBordero.push(orderId);
      continue;
    }
    const arr = porBordero.get(b) ?? [];
    arr.push(orderId);
    porBordero.set(b, arr);
  }
  for (const [bordero, ids] of porBordero) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await centralDb
        .from("orders")
        .update({ bordero })
        .in("id", ids.slice(i, i + 200));
      if (error) throw error;
    }
  }

  if (semBordero.length === 0) return;

  // Pedido sem registro no ERP após a carência é excluído da base do app.
  for (let i = 0; i < semBordero.length; i += 200) {
    const lote = semBordero.slice(i, i + 200);
    const { error: roErr } = await centralDb.from("route_orders").delete().in("order_id", lote);
    if (roErr) throw roErr;
    const { error: oErr } = await centralDb.from("orders").delete().in("id", lote);
    if (oErr) throw oErr;
  }

  // Rota que ficou sem nenhum pedido deixa de existir.
  const afetadas = Array.from(
    new Set(semBordero.map((id) => routeByOrderId.get(id)).filter((v): v is string => Boolean(v))),
  );
  if (afetadas.length === 0) return;
  const { data: restantes, error: restErr } = await centralDb
    .from("route_orders")
    .select("route_id")
    .in("route_id", afetadas);
  if (restErr) throw restErr;
  const comPedido = new Set((restantes ?? []).map((r) => String(r.route_id)));
  const vazias = afetadas.filter((id) => !comPedido.has(id));
  if (vazias.length > 0) {
    await centralDb.from("delivery_manifests").delete().in("route_id", vazias);
    const { error } = await centralDb.from("routes").delete().in("id", vazias);
    if (error) throw error;
  }
}

async function fetchPendingOrdersFromErp(): Promise<ErpOrderRow[]> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  }
  // Aceita base URL com ou sem /v1/query no final
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const url = `${cleanBase}/v1/query`;

  const maxAttempts = 3;
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
      signal: AbortSignal.timeout(60_000),
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql: PENDING_ORDERS_SQL, binds: {}, limit: 5000 }),
      });
      if (res.ok) {
        const json = (await res.json()) as ErpQueryResponse;
        return (json.rows ?? []) as unknown as ErpOrderRow[];
      }
      const text = await res.text();
      const msg = friendlyErpError(res.status, text);
      lastErr = new Error(msg);
      if (!TRANSIENT_HTTP_STATUSES.has(res.status) && res.status !== 429) break;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < maxAttempts) {
      const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr ?? new Error("Falha desconhecida ao consultar o ERP");
}

// PIX: contato cujo CARGO é 'PIX'; a chave é o nome do contato (ou o e-mail, se o nome estiver em branco).
const RESPONSAVEIS_SQL = `
  SELECT TRIM(T.DBA_TIP_CODIGO_1) COD_ERP,
         TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
         T.DBA_TIP_NATUREZA COD_NAT,
         (SELECT MAX(CASE WHEN C.DBA_CONT_CONTATO <> '                                                            '
                          THEN TRIM(C.DBA_CONT_CONTATO)
                          ELSE TRIM(C.DBA_CONT_EMAIL) END)
            FROM GKS.A_CADCCONT C
           WHERE C.DBA_CONT_CODIGO = T.DBA_TIP_CODIGO_1
             AND C.DBA_CONT_CARGO = 'PIX                                                         ') PIX
    FROM GKS.A_CADCTIPO T
   WHERE T.DBA_TIP_NATUREZA IN ('ET','EF','EM')
`;

/**
 * Atualiza o espelho local de responsáveis (fretistas/transportadoras) do ERP.
 * Como a lista é grande (>10 mil linhas) e muda pouco, só é renovada quando a
 * última atualização tem mais de `maxAgeMs`.
 */
// Calendário comercial do ERP: cada chave 050FATPED-AAAAMM define o período
// de datas (DE/ATE) que compõe o mês comercial.
const CALENDARIO_COMERCIAL_SQL = `
  SELECT * FROM (
    SELECT TO_DATE(SUBSTR(T.DBA_TAB_ACESSO,8,6) || '01','yyyyMMdd') MES_COMERC,
           TO_DATE(SUBSTR(TRIM(DBA_TAB_CAMPO),1,8),'yyyyMMdd') DE,
           TO_DATE(SUBSTR(TRIM(DBA_TAB_CAMPO),9,8),'yyyyMMdd') ATE
      FROM gks.a_cadctabe t
     WHERE t.dba_keycadtab_sq LIKE '050FATPED-%'
     ORDER BY t.dba_keycadtab_sq DESC)
   WHERE MES_COMERC >= TO_DATE('20260101','yyyyMMdd')
`;

/** Atualiza o espelho local do calendário comercial do ERP. */
async function sincronizarCalendarioComercial() {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");

  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql: CALENDARIO_COMERCIAL_SQL, binds: {}, limit: 500 }),
  });
  if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
  const json = (await res.json()) as ErpQueryResponse;

  const toDate = (v: unknown): string | null => {
    if (v == null) return null;
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  const byMes = new Map<string, { mes_comerc: string; de: string; ate: string }>();
  for (const row of json.rows ?? []) {
    const mes = toDate(row.MES_COMERC ?? row.mes_comerc);
    const de = toDate(row.DE ?? row.de);
    const ate = toDate(row.ATE ?? row.ate);
    if (!mes || !de || !ate || byMes.has(mes)) continue;
    byMes.set(mes, { mes_comerc: mes, de, ate });
  }
  const payload = Array.from(byMes.values());
  if (payload.length === 0) return 0;
  const { error } = await centralDb.from("erp_calendario_comercial").upsert(
    payload.map((item) => ({ ...item, atualizado_em: new Date().toISOString() })),
    { onConflict: "mes_comerc" },
  );
  if (error) throw error;
  return payload.length;
}

async function sincronizarEspelhoResponsaveis(opts: { maxAgeMs: number }) {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");

  const { data: ultimo } = await centralDb
    .from("erp_responsaveis")
    .select("atualizado_em")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ultimoMs = ultimo?.atualizado_em ? new Date(ultimo.atualizado_em as string).getTime() : 0;
  if (ultimoMs && Date.now() - ultimoMs < opts.maxAgeMs) return 0;

  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
      signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql: RESPONSAVEIS_SQL, binds: {}, limit: 50000 }),
  });
  if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
  const json = (await res.json()) as ErpQueryResponse;
  const byCode = new Map<string, { cod_erp: string; razao_social: string | null; natureza: string; tipo_frete: "F" | "T" | "P" | null; pix: string | null }>();
  for (const row of json.rows ?? []) {
    const cod = String(row.COD_ERP ?? row.cod_erp ?? "").trim();
    if (!cod || byCode.has(cod)) continue;
    const natureza = String(row.COD_NAT ?? row.cod_nat ?? "").trim().toUpperCase();
    byCode.set(cod, {
      cod_erp: cod,
      razao_social: String(row.RAZAO_SOCIAL ?? row.razao_social ?? "").trim() || null,
      natureza,
      tipo_frete: natureza === "EF" ? "F" : natureza === "ET" ? "T" : natureza === "EM" ? "P" : null,
      pix: String(row.PIX ?? row.pix ?? "").trim() || null,
    });
  }
  const payload = Array.from(byCode.values());
  if (payload.length === 0) return 0;
  const { error } = await centralDb.from("erp_responsaveis").upsert(
    payload.map((item) => ({ ...item, atualizado_em: new Date().toISOString() })),
    { onConflict: "cod_erp" },
  );
  if (error) throw error;
  return payload.length;
}

/** Atualiza o espelho local de clientes com os dados que já vêm na consulta de pedidos. */
async function sincronizarEspelhoClientes(rows: ErpOrderRow[]) {
  const byCode = new Map<string, {
    cod_cliente: string;
    razao_social: string | null;
    nome_nf: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  }>();
  for (const row of rows) {
    const cod = String(row.COD_CLIENTE ?? "").trim();
    if (!cod || cod === "null" || byCode.has(cod)) continue;
    const txt = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
    byCode.set(cod, {
      cod_cliente: cod,
      razao_social: txt(row.CLIENTE_RS),
      nome_nf: txt(row.CLIENTE_NF),
      bairro: txt(row.BAIRRO),
      cidade: txt(row.CIDADE),
      uf: txt(row.UF),
    });
  }
  const payload = Array.from(byCode.values());
  if (payload.length === 0) return 0;
  const { error } = await centralDb.from("clientes_erp").upsert(
    payload.map((item) => ({ ...item, atualizado_em: new Date().toISOString() })),
    { onConflict: "cod_cliente" },
  );
  if (error) throw error;
  return payload.length;
}

/**
 * Completa o espelho de clientes buscando no cadastro do ERP (GKS.A_CADCTIPO)
 * os códigos que aparecem em pedidos já gravados mas ainda não têm cadastro
 * local. Necessário porque a consulta de pedidos pendentes só traz os clientes
 * do momento — pedidos antigos ficavam sem razão social/cidade/bairro.
 */
async function completarCadastroClientesFaltantes(
  limitePorExecucao = 2000,
  codigosExtras?: Iterable<string>,
): Promise<number> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) return 0;

  // Códigos presentes em pedidos
  const codigosPedidos = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await centralDb
      .from("orders")
      .select("erp_cod_cliente")
      .not("erp_cod_cliente", "is", null)
      .range(offset, offset + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      const cod = String((r as { erp_cod_cliente: string | null }).erp_cod_cliente ?? "").trim();
      if (cod) codigosPedidos.add(cod);
    }
    if (!data || data.length < 1000) break;
  }
  for (const c of codigosExtras ?? []) {
    const cod = String(c).trim();
    if (cod) codigosPedidos.add(cod);
  }
  if (codigosPedidos.size === 0) return 0;

  // Códigos já espelhados
  const jaTem = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await centralDb
      .from("clientes_erp")
      .select("cod_cliente")
      .range(offset, offset + 999);
    if (error) throw error;
    for (const r of data ?? []) jaTem.add(String((r as { cod_cliente: string }).cod_cliente).trim());
    if (!data || data.length < 1000) break;
  }

  const faltantes = Array.from(codigosPedidos).filter((c) => !jaTem.has(c)).slice(0, limitePorExecucao);
  if (faltantes.length === 0) return 0;

  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  let gravados = 0;
  // Oracle limita listas IN a 1000 itens.
  for (let i = 0; i < faltantes.length; i += 500) {
    const bloco = faltantes.slice(i, i + 500);
    const lista = bloco
      .filter((c) => /^[0-9A-Za-z._-]+$/.test(c))
      .map((c) => `'${c}'`)
      .join(",");
    if (!lista) continue;
    const sql = `
      SELECT TRIM(T.DBA_TIP_CODIGO_1) COD_CLIENTE,
             TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
             TRIM(T.DBA_TIP_NOME_FANTASIA) NOME_NF,
             TRIM(T.DBA_TIP_BAIRRO) BAIRRO,
             TRIM(T.DBA_TIP_CIDADE) CIDADE,
             TRIM(T.DBA_TIP_ESTADO) UF
        FROM GKS.A_CADCTIPO T
       WHERE TRIM(T.DBA_TIP_CODIGO_1) IN (${lista})
    `;
    const res = await fetch(`${cleanBase}/v1/query`, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql, binds: {}, limit: 1000 }),
    });
    if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
    const json = (await res.json()) as ErpQueryResponse;
    const byCode = new Map<string, Record<string, string | null>>();
    for (const row of json.rows ?? []) {
      const cod = String(row.COD_CLIENTE ?? "").trim();
      if (!cod || byCode.has(cod)) continue;
      const txt = (v: unknown) => (typeof v === "string" ? v.trim() || null : null);
      byCode.set(cod, {
        cod_cliente: cod,
        razao_social: txt(row.RAZAO_SOCIAL),
        nome_nf: txt(row.NOME_NF),
        bairro: txt(row.BAIRRO),
        cidade: txt(row.CIDADE),
        uf: txt(row.UF),
      });
    }
    const payload = Array.from(byCode.values());
    if (payload.length === 0) continue;
    const { error } = await centralDb.from("clientes_erp").upsert(
      payload.map((item) => ({ ...item, atualizado_em: new Date().toISOString() })) as never,
      { onConflict: "cod_cliente" },
    );
    if (error) throw error;
    gravados += payload.length;
  }
  return gravados;
}



// Entregas já expedidas e ainda não entregues (aba "ABERTOS" do modelo).
const ENTREGAS_ABERTAS_SQL = `
  SELECT G.NRO_NF, G.COD_PEDIDO, G.COD_CLIENTE, G.COD_VENDEDOR, G.COD_FILIAL,
         G.COD_AGENDA, G.BORDERO, G.DT_PEDIDO, G.DT_FATUR, G.DT_SAIDA,
         G.DT_ENTREGA_CLI, G.DT_AGENDAMENTO, G.ENTREGA_AGEND,
         G.COD_TRANSP_ENT, G.TIPO_TRANSP_ENT, G.PLACA_VEICULO_ENT,
         G.VALOR, G.PESO, G.TIPOS_OCORRENCIA, G.STATUS, ${SQL_EXTRAS_ENTREGA}
    FROM GKS.A_GERENTREGAS G
   WHERE G.STATUS = 'A'
     AND G.DT_SAIDA IS NOT NULL
     AND G.DT_ENTREGA_CLI IS NULL
     AND G.COD_AGENDA IN (417, 427)
`;

function soData(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  // As datas do ERP chegam em UTC-3 (meia-noite local); normaliza para a data local.
  const local = new Date(d.getTime() - 3 * 3600_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Atualiza o espelho de entregas em aberto (NF expedida e sem entrega).
 * Retorna os códigos de cliente encontrados, para completar o cadastro local.
 */
async function sincronizarEntregasAbertas(): Promise<{ total: number; clientes: Set<string> }> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  const clientes = new Set<string>();
  if (!baseUrl || !apiKey) return { total: 0, clientes };

  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
      signal: AbortSignal.timeout(60_000),
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql: ENTREGAS_ABERTAS_SQL, binds: {}, limit: 20000 }),
  });
  if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
  const json = (await res.json()) as ErpQueryResponse;

  const txt = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const agora = new Date().toISOString();
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of json.rows ?? []) {
    const nf = txt(row.NRO_NF);
    const pedido = txt(row.COD_PEDIDO);
    if (!nf || !pedido) continue;
    const cod = txt(row.COD_CLIENTE);
    if (cod) clientes.add(cod);
    byKey.set(`${nf}|${pedido}`, {
      nro_nf: nf,
      cod_pedido: pedido,
      cod_cliente: cod,
      cod_vendedor: txt(row.COD_VENDEDOR),
      cod_filial: txt(row.COD_FILIAL),
      cod_agenda: txt(row.COD_AGENDA),
      bordero: txt(row.BORDERO),
      dt_pedido: soData(row.DT_PEDIDO),
      dt_fatur: soData(row.DT_FATUR),
      dt_saida: soData(row.DT_SAIDA),
      dt_entrega_cli: soData(row.DT_ENTREGA_CLI),
      dt_agendamento: soData(row.DT_AGENDAMENTO),
      entrega_agend: txt(row.ENTREGA_AGEND),
      cod_transp_ent: txt(row.COD_TRANSP_ENT),
      tipo_transp_ent: txt(row.TIPO_TRANSP_ENT),
      placa_veiculo_ent: txt(row.PLACA_VEICULO_ENT),
      valor: num(row.VALOR),
      peso: num(row.PESO),
      tipos_ocorrencia: txt(row.TIPOS_OCORRENCIA),
      status: txt(row.STATUS),
      ...extrasEntrega((k) => row[k], soData),
      atualizado_em: agora,
    });
  }

  let payload = Array.from(byKey.values());
  for (let i = 0; i < payload.length; i += 200) {
    let { error } = await centralDb
      .from("entregas_abertas")
      .upsert(payload.slice(i, i + 200) as never, { onConflict: "nro_nf,cod_pedido" });
    if (error && erroColunaAusente(error.message)) {
      payload = payload.map(semExtras);
      ({ error } = await centralDb
        .from("entregas_abertas")
        .upsert(payload.slice(i, i + 200) as never, { onConflict: "nro_nf,cod_pedido" }));
    }
    if (error) throw error;
  }

  // Remove as notas que saíram da condição (entregues ou com ocorrência).
  const { error: delErr } = await centralDb
    .from("entregas_abertas")
    .delete()
    .lt("atualizado_em", agora);
  if (delErr) throw delErr;

  return { total: payload.length, clientes };
}


/**
 * Espelho de TODAS as notas faturadas (qualquer status) dos ciclos comerciais
 * recentes — base do painel Custo de Frete. Uma consulta por ciclo.
 */
async function sincronizarNotasFaturadas(): Promise<number> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) return 0;
  const { data: ciclos, error: cErr } = await centralDb
    .from("erp_calendario_comercial")
    .select("mes_comerc,de,ate")
    .order("mes_comerc", { ascending: false })
    .limit(7);
  if (cErr) throw cErr;
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const txt = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const ymd = (d: string) => d.slice(0, 10).replace(/-/g, "");
  let total = 0;
  for (const c of (ciclos ?? []) as { de: string; ate: string }[]) {
    const sql = `SELECT G.NRO_NF, G.COD_PEDIDO, G.COD_CLIENTE, G.COD_VENDEDOR, G.COD_FILIAL,
         G.COD_AGENDA, G.BORDERO, G.DT_PEDIDO, G.DT_FATUR, G.DT_SAIDA,
         G.DT_ENTREGA_CLI, G.DT_AGENDAMENTO, G.ENTREGA_AGEND,
         G.COD_TRANSP_ENT, G.TIPO_TRANSP_ENT, G.PLACA_VEICULO_ENT,
         G.VALOR, G.PESO, G.TIPOS_OCORRENCIA, G.STATUS, ${SQL_EXTRAS_ENTREGA}
    FROM GKS.A_GERENTREGAS G
   WHERE G.NRO_NF IS NOT NULL
     AND G.COD_AGENDA IN (417, 427)
     AND G.DT_FATUR >= TO_DATE('${ymd(c.de)}','yyyyMMdd')
     AND G.DT_FATUR < TO_DATE('${ymd(c.ate)}','yyyyMMdd') + 1`;
    const res = await fetch(`${cleanBase}/v1/query`, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql, binds: {}, limit: 50000 }),
    });
    if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
    const json = (await res.json()) as ErpQueryResponse;
    const agora = new Date().toISOString();
    const byKey = new Map<string, Record<string, unknown>>();
    const ordem = (r: Record<string, unknown>) => `${r.dt_saida ?? ""}|${String(r.bordero ?? "").padStart(12, "0")}`;
    for (const row of json.rows ?? []) {
      const nf = txt(row.NRO_NF), pedido = txt(row.COD_PEDIDO);
      if (!nf || !pedido) continue;
      const nova: Record<string, unknown> = {
        nro_nf: nf, cod_pedido: pedido,
        cod_cliente: txt(row.COD_CLIENTE), cod_vendedor: txt(row.COD_VENDEDOR), cod_filial: txt(row.COD_FILIAL),
        cod_agenda: txt(row.COD_AGENDA), bordero: txt(row.BORDERO),
        dt_pedido: soData(row.DT_PEDIDO), dt_fatur: soData(row.DT_FATUR), dt_saida: soData(row.DT_SAIDA),
        dt_entrega_cli: soData(row.DT_ENTREGA_CLI), dt_agendamento: soData(row.DT_AGENDAMENTO),
        entrega_agend: txt(row.ENTREGA_AGEND), cod_transp_ent: txt(row.COD_TRANSP_ENT),
        tipo_transp_ent: txt(row.TIPO_TRANSP_ENT), placa_veiculo_ent: txt(row.PLACA_VEICULO_ENT),
        valor: num(row.VALOR), peso: num(row.PESO), tipos_ocorrencia: txt(row.TIPOS_OCORRENCIA),
        status: txt(row.STATUS), ...extrasEntrega((k) => row[k], soData), atualizado_em: agora,
      };
      const k = `${nf}|${pedido}`;
      const prev = byKey.get(k);
      if (prev) {
        const oc = new Set([prev.tipos_ocorrencia, nova.tipos_ocorrencia].flatMap((t) => String(t ?? "").split(",")).map((t) => t.trim()).filter(Boolean));
        const fica = ordem(nova) >= ordem(prev) ? nova : prev;
        byKey.set(k, { ...fica, tipos_ocorrencia: oc.size ? Array.from(oc).join(", ") : null });
      } else byKey.set(k, nova);
    }
    const payload = Array.from(byKey.values());
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await centralDb.from("notas_faturadas" as never).upsert(payload.slice(i, i + 200) as never, { onConflict: "nro_nf,cod_pedido" });
      if (error) throw error;
    }
    const { error: delErr } = await centralDb
      .from("notas_faturadas" as never)
      .delete()
      .in("cod_agenda", ["417", "427"])
      .gte("dt_fatur", c.de.slice(0, 10))
      .lte("dt_fatur", c.ate.slice(0, 10))
      .lt("atualizado_em", agora);
    if (delErr) throw delErr;
    total += payload.length;
  }
  return total;
}

type SyncResult = {
  runId: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  customers_created: number;
  errors: { pedido: number; message: string }[];
  status: "success" | "partial" | "failed" | "running";
};

export async function syncErpOrders(opts: {
  trigger: "manual" | "cron";
  triggeredBy: string | null;
}): Promise<SyncResult> {
  const startedAtMs = Date.now();
  const elapsedMs = () => Date.now() - startedAtMs;
  // Orçamento de tempo: acima disso as etapas opcionais são puladas para a
  // requisição não estourar o limite do servidor (~50 s).
  const BUDGET_MS = 35_000;

  // 0) Fecha execuções anteriores presas em "em andamento" (interrompidas pelo servidor).
  try {
    await centralDb
      .from("erp_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        errors: [{ pedido: 0, message: "Execução interrompida pelo tempo limite do servidor" }],
      })
      .eq("status", "running")
      .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  } catch (e) {
    console.warn("[erp-sync] não foi possível fechar execuções presas:", e);
  }

  // 0b) Evita duas execuções simultâneas.
  {
    const { data: ativa } = await centralDb
      .from("erp_sync_runs")
      .select("id")
      .eq("status", "running")
      .gte("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();
    if (ativa) {
      // Já existe uma execução ativa: não inicia outra, devolve a atual para acompanhamento.
      return {
        runId: ativa.id as string,
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        customers_created: 0,
        errors: [],
        status: "running",
      };
    }
  }

  // 1) Abre execução
  const { data: run, error: runErr } = await centralDb
    .from("erp_sync_runs")
    .insert({
      trigger: opts.trigger,
      triggered_by: opts.triggeredBy,
      status: "running",
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(`Falha ao registrar execução: ${runErr?.message}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let customers_created = 0;
  let routes_created = 0;
  let routes_linked = 0;
  const errors: { pedido: number; message: string }[] = [];
  let fetched = 0;

  function slugify(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rota";
  }


  function parseErpDate(val: unknown): string | null {
    if (val == null) return null;
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function describeError(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "object" && e !== null) {
      try {
        return JSON.stringify(e);
      } catch {
        return String(e);
      }
    }
    return String(e);
  }

  function getErpField(row: Record<string, unknown>, field: string): unknown {
    if (field in row) return row[field];
    const found = Object.entries(row).find(([key]) => key.toUpperCase() === field);
    return found?.[1];
  }

  function parseErpInteger(val: unknown): number | null {
    if (val == null || val === "") return null;
    if (typeof val === "object") {
      const nested = getErpField(val as Record<string, unknown>, "VALUE") ?? Object.values(val)[0];
      return parseErpInteger(nested);
    }
    const normalized = typeof val === "string" ? val.replace(",", ".") : val;
    const n = Number(normalized);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  // Mapa erp_id -> orders.id, preenchido durante a gravação em lote e reutilizado
  // depois pelo vínculo com as rotas (evita novas consultas por rota).
  const orderIdByErpId = new Map<string, string>();
  const pendingLinks: { route_id: string; order_id: string; stop_order: number }[] = [];

  function buildOrderPayload(row: ErpOrderRow, prevAddress: string | null | undefined) {
    const pedidoStr = String(row.PEDIDO);
    const totalAmount = Number(row.VALOR ?? row.VALOR_PEDIDO ?? 0);
    const notes = [
      row.OBS ? `OBS: ${row.OBS.trim()}` : null,
      row.STATUS ? `Status ERP: ${row.STATUS}` : null,
      row.VENDEDOR ? `Vendedor: ${row.VENDEDOR}` : null,
      row.PESO ? `Peso: ${row.PESO} kg` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const qtdDias = parseErpInteger(
      getErpField(row as unknown as Record<string, unknown>, "QTD_DIAS"),
    );
    const deliveryAddress = parseDeliveryOverride(row.OBS_LOGIST);
    const addrChanged = (deliveryAddress ?? null) !== (prevAddress ?? null);

    return {
      order_number: pedidoStr,
      erp_id: pedidoStr,
      erp_cod_cliente: String(row.COD_CLIENTE),
      total_amount: totalAmount,
      weight: row.PESO,
      cod_agenda: row.COD_AGENDA,
      cod_filial: row.COD_FILIAL != null ? String(row.COD_FILIAL).trim() : null,
      notes: notes || null,
      dt_prev_exp: parseErpDate(row.DT_PREV_EXP),
      nome_rota: row.NOME_ROTA || null,
      nome_motorista: row.NOME_MOTORISTA || null,
      erp_status: row.STATUS || null,
      qtd_dias: qtdDias,
      delivery_address: deliveryAddress,
      ...(addrChanged ? { delivery_latitude: null, delivery_longitude: null } : {}),
    };
  }

  try {
    // Responsáveis do ERP em paralelo com a consulta de pedidos (etapa opcional,
    // renovada no máximo uma vez por hora).
    const responsaveisPromise = sincronizarEspelhoResponsaveis({ maxAgeMs: opts.trigger === "manual" ? 0 : 60 * 60 * 1000 }).catch(
      (e) => {
        errors.push({ pedido: 0, message: `Atualizar responsáveis do ERP: ${describeError(e)}` });
        return 0;
      },
    );
    // Calendário comercial: etapa opcional, falhas não abortam o sync.
    const calendarioPromise = sincronizarCalendarioComercial().catch((e) => {
      errors.push({ pedido: 0, message: `Atualizar calendário comercial: ${describeError(e)}` });
      return 0;
    });
    const rows = await fetchPendingOrdersFromErp();
    fetched = rows.length;
    try {
      await sincronizarEspelhoClientes(rows);
    } catch (e) {
      errors.push({ pedido: 0, message: `Atualizar clientes do ERP: ${describeError(e)}` });
    }
    await responsaveisPromise;
    await calendarioPromise;

    // 1) Estado atual dos pedidos já gravados (uma consulta por bloco de 300).
    const erpIds = rows.map((r) => String(r.PEDIDO));
    const existentes = new Map<string, { id: string; delivery_address: string | null }>();
    for (let i = 0; i < erpIds.length; i += 300) {
      const { data, error } = await centralDb
        .from("orders")
        .select("id, erp_id, delivery_address")
        .in("erp_id", erpIds.slice(i, i + 300));
      if (error) throw error;
      for (const o of data ?? []) {
        existentes.set(String(o.erp_id), {
          id: o.id as string,
          delivery_address: (o.delivery_address as string | null) ?? null,
        });
      }
    }

    // 2) Gravação em lote (inserir ou atualizar pelo código do pedido no ERP).
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const payloads = batch.map((row) =>
        buildOrderPayload(row, existentes.get(String(row.PEDIDO))?.delivery_address),
      );
      const { data, error } = await centralDb
        .from("orders")
        .upsert(payloads, { onConflict: "erp_id" })
        .select("id, erp_id");
      if (error) {
        for (const row of batch) {
          errors.push({ pedido: row.PEDIDO, message: describeError(error) });
        }
        continue;
      }
      for (const o of data ?? []) orderIdByErpId.set(String(o.erp_id), o.id as string);
      for (const row of batch) {
        if (existentes.has(String(row.PEDIDO))) updated++;
        else created++;
      }
    }


    // Pedidos que não retornaram na consulta do ERP são considerados expedidos.
    try {
      const fetchedErpIds = Array.from(
        new Set(rows.map((r) => String(r.PEDIDO)).filter((s) => s && s !== "null")),
      );
      const EXPEDIDO = "11-EXPEDIDO";
      let query = centralDb
        .from("orders")
        .update({ erp_status: EXPEDIDO })
        .neq("erp_status", EXPEDIDO)
        .not("erp_id", "is", null);
      if (fetchedErpIds.length > 0) {
        // Postgrest .not('erp_id','in',...) — exclui os pedidos retornados
        const list = `(${fetchedErpIds.map((v) => `"${v}"`).join(",")})`;
        query = query.not("erp_id", "in", list);
      }
      const { error: expErr } = await query;
      if (expErr) {
        errors.push({ pedido: 0, message: `Marcar expedidos: ${expErr.message}` });
      }
    } catch (e) {
      errors.push({ pedido: 0, message: `Marcar expedidos: ${describeError(e)}` });
    }

    // Atualiza o status das rotas locais "P" com o status real do ERP
    // (rotas encerradas/excluídas no ERP deixam de aparecer em Rotas Pendentes).
    try {
      const { data: locais, error: locErr } = await centralDb
        .from("routes")
        .select("id, erp_route_id")
        .eq("erp_status", "P")
        .not("erp_route_id", "is", null);
      if (locErr) throw locErr;
      const ids = Array.from(
        new Set((locais ?? []).map((r) => String(r.erp_route_id)).filter((v) => /^\d+$/.test(v))),
      );
      const statusErp = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 500) {
        const lote = ids.slice(i, i + 500);
        const res = await erpQuery(
          `select ID, STATUS from GKS.A_GER_ROTAS where ID in (${lote.join(",")})`,
          lote.length + 10,
        );
        for (const r of res) statusErp.set(String(r.ID), String(r.STATUS ?? "").trim() || "P");
      }
      const porStatus = new Map<string, string[]>();
      for (const id of ids) {
        const st = statusErp.get(id) ?? "E";
        if (st === "P") continue;
        porStatus.set(st, [...(porStatus.get(st) ?? []), id]);
      }
      for (const [st, lista] of porStatus) {
        const { error: upErr } = await centralDb
          .from("routes")
          .update({ erp_status: st })
          .in("erp_route_id", lista);
        if (upErr) throw upErr;
      }
    } catch (e) {
      errors.push({ pedido: 0, message: `Status das rotas: ${describeError(e)}` });
    }



    // Auto-cadastro de rotas a partir de ID_ROTA (ERP) + NOME_ROTA + DT_PREV_EXP + NOME_MOTORISTA
    type RouteGroup = {
      erpRouteId: string | null;
      nome: string;
      date: string;
      driver: string | null;
      carrierCode: string | null;
      erpStatus: string;
      pedidos: string[];
    };
    const groups = new Map<string, RouteGroup>();
    for (const row of rows) {
      const erpRouteId =
        row.ID_ROTA != null && String(row.ID_ROTA).trim() !== ""
          ? String(row.ID_ROTA).trim()
          : null;
      const dt = parseErpDate(row.DT_PREV_EXP);
      const rawNome = (row.NOME_ROTA ?? "").trim();
      const dateOnly = dt
        ? dt.slice(0, 10)
        : !erpRouteId && !rawNome
          ? "4000-01-01"
          : "3000-01-01";
      let nome = (row.NOME_ROTA ?? "").trim();
      // Pedidos sem rota no ERP (sem NOME_ROTA nem ID_ROTA) não geram rota no app:
      // aparecem apenas em "Pedidos sem rota" pela data do próprio pedido.
      if (!nome) {
        if (erpRouteId) nome = `ROTA ${erpRouteId}`;
        else continue;
      }
      const driver = row.NOME_MOTORISTA?.trim() || null;
      const carrierCode =
        row.COD_FRT_TRP != null && String(row.COD_FRT_TRP).trim() !== ""
          ? String(row.COD_FRT_TRP).trim()
          : null;
      const erpStatus = row.ROTA_STATUS?.trim() || "P";
      // Rota excluída no ERP (status E) não volta para o app.
      if (erpStatus === "E") continue;
      const key = erpRouteId
        ? `erp:${erpRouteId}`
        : `${nome}|${dateOnly}|${driver ?? ""}|${carrierCode ?? ""}`;
      let g = groups.get(key);
      if (!g) {
        g = { erpRouteId, nome, date: dateOnly, driver, carrierCode, erpStatus, pedidos: [] };
        groups.set(key, g);
      }
      // O responsável pode vir só em alguns pedidos: usa o primeiro preenchido.
      if (!g.driver && driver) g.driver = driver;
      if (!g.carrierCode && carrierCode) g.carrierCode = carrierCode;
      g.pedidos.push(String(row.PEDIDO));
    }

    // Resolução em lote COD_FRT_TRP -> freight_carriers.id (uma consulta por tabela).
    const carrierByCode = new Map<string, string | null>();
    const carrierCodes = Array.from(
      new Set(
        Array.from(groups.values())
          .map((g) => g.carrierCode)
          .filter((c): c is string => Boolean(c)),
      ),
    );
    if (carrierCodes.length > 0) {
      try {
        const { data: transps, error: tErr } = await centralDb
          .from("transportadoras")
          .select("id,razao_social,cod_erp")
          .in("cod_erp", carrierCodes);
        if (tErr) throw tErr;
        const transpIds = (transps ?? []).map((t) => t.id as string);
        const carrierByTransp = new Map<string, string>();
        if (transpIds.length > 0) {
          const { data: carriers, error: cErr } = await centralDb
            .from("freight_carriers")
            .select("id,transportadora_id")
            .in("transportadora_id", transpIds);
          if (cErr) throw cErr;
          for (const c of carriers ?? []) {
            const tid = c.transportadora_id ? String(c.transportadora_id) : null;
            if (tid && !carrierByTransp.has(tid)) carrierByTransp.set(tid, c.id as string);
          }
        }
        // Transportadora cadastrada sem fretista correspondente: cria o vínculo em lote
        // para que a rota fique associada (e a simulação de frete funcione).
        const faltantes = (transps ?? []).filter((t) => !carrierByTransp.has(t.id as string));
        if (faltantes.length > 0) {
          const { data: novos, error: nErr } = await centralDb
            .from("freight_carriers")
            .insert(
              faltantes.map((t) => ({
                full_name: t.razao_social,
                transportadora_id: t.id,
                is_active: true,
              })),
            )
            .select("id,transportadora_id");
          if (nErr) throw nErr;
          for (const c of novos ?? []) {
            if (c.transportadora_id) carrierByTransp.set(String(c.transportadora_id), c.id as string);
          }
        }
        for (const t of transps ?? []) {
          carrierByCode.set(String(t.cod_erp), carrierByTransp.get(t.id as string) ?? null);
        }
      } catch (e) {
        errors.push({ pedido: 0, message: `Transportadoras das rotas: ${describeError(e)}` });
      }
    }


    // Planejamento das rotas: código final, código alternativo (slug) e transportadora.
    type GroupPlan = RouteGroup & { code: string; slugCode: string; carrierId: string | null };
    const plans: GroupPlan[] = Array.from(groups.values()).map((g) => {
      const slugCode = `${slugify(g.nome)}-${g.date.replace(/-/g, "")}`;
      return {
        ...g,
        slugCode,
        code: g.erpRouteId ? `erp-${g.erpRouteId}` : slugCode,
        carrierId: g.carrierCode ? (carrierByCode.get(g.carrierCode) ?? null) : null,
      };
    });

    // Rotas pendentes que ainda vêm do ERP são excluídas e reinseridas — o ERP é
    // a fonte da verdade. As que deixaram de vir tiveram o borderô emitido:
    // permanecem no app, marcadas, com o número do borderô buscado por pedido.
    // Dados informados manualmente são preservados via snapshot.
    type RouteSnapshot = {
      erp_route_id: string | null;
      code: string;
      total_freight: number | null;
      total_distance_km: number | null;
      carrier_id: string | null;
      status: string;
      erp_status: string | null;
      notes: string | null;
    };
    const snapshotByErpId = new Map<string, RouteSnapshot>();
    const snapshotByCode = new Map<string, RouteSnapshot>();
    const erpIdsDoRetorno = new Set(
      plans.map((p) => p.erpRouteId).filter((v): v is string => Boolean(v)),
    );
    const codesDoRetorno = new Set(plans.flatMap((p) => [p.code, p.slugCode]));
    let rotasComBorderoEmitido: string[] = [];
    try {
      const { data: pendingRoutes, error: pendErr } = await centralDb
        .from("routes")
        .select("id,erp_route_id,code,total_freight,total_distance_km,carrier_id,status,erp_status,notes")
        .in("status", ["planejada", "em_andamento"])
        .is("bordero_emitido_em", null);
      if (pendErr) throw pendErr;

      const pendingIds: string[] = [];
      for (const r of pendingRoutes ?? []) {
        const snap: RouteSnapshot = {
          erp_route_id: (r.erp_route_id as string | null) ?? null,
          code: r.code as string,
          total_freight: (r.total_freight as number | null) ?? null,
          total_distance_km: (r.total_distance_km as number | null) ?? null,
          carrier_id: (r.carrier_id as string | null) ?? null,
          status: r.status as string,
          erp_status: (r.erp_status as string | null) ?? null,
          notes: (r.notes as string | null) ?? null,
        };
        if (snap.erp_route_id) snapshotByErpId.set(snap.erp_route_id, snap);
        snapshotByCode.set(snap.code, snap);
        const voltouDoErp =
          (snap.erp_route_id != null && erpIdsDoRetorno.has(snap.erp_route_id)) ||
          codesDoRetorno.has(snap.code);
        if (voltouDoErp) pendingIds.push(r.id as string);
        // Rotas sem ID do ERP nunca têm borderô: não entram na lógica de borderô emitido.
        else if (snap.erp_route_id != null) rotasComBorderoEmitido.push(r.id as string);
      }

      if (pendingIds.length > 0) {
        const { error: roErr } = await centralDb
          .from("route_orders")
          .delete()
          .in("route_id", pendingIds);
        if (roErr) throw roErr;
        const { error: dmErr } = await centralDb
          .from("delivery_manifests")
          .delete()
          .in("route_id", pendingIds);
        if (dmErr) throw dmErr;
        const { error: delRoutesErr } = await centralDb
          .from("routes")
          .delete()
          .in("id", pendingIds);
        if (delRoutesErr) throw delRoutesErr;
      }
    } catch (e) {
      rotasComBorderoEmitido = [];
      errors.push({ pedido: 0, message: `Reinserção de rotas pendentes: ${describeError(e)}` });
    }

    // Rota sem nenhum pedido (ex.: recém-criada) nunca volta na leitura de pendentes
    // do ERP; não pode ser confundida com "borderô emitido".
    if (rotasComBorderoEmitido.length > 0) {
      try {
        const comPedido = new Set<string>();
        for (let i = 0; i < rotasComBorderoEmitido.length; i += 200) {
          const { data, error } = await centralDb
            .from("route_orders")
            .select("route_id")
            .in("route_id", rotasComBorderoEmitido.slice(i, i + 200));
          if (error) throw error;
          for (const r of data ?? []) comPedido.add(String(r.route_id));
        }
        rotasComBorderoEmitido = rotasComBorderoEmitido.filter((id) => comPedido.has(id));
      } catch (e) {
        rotasComBorderoEmitido = [];
        errors.push({ pedido: 0, message: `Verificação de rotas vazias: ${describeError(e)}` });
      }
    }

    // Rotas que saíram do ERP: marca como borderô emitido e busca o número por pedido.
    try {
      await tratarRotasComBorderoEmitido(rotasComBorderoEmitido);
    } catch (e) {
      errors.push({ pedido: 0, message: `Rotas com borderô emitido: ${describeError(e)}` });
    }

    // Rotas já existentes (concluídas/canceladas ou criadas antes do ID_ROTA): uma consulta só.
    const existingByErpId = new Map<string, string>();
    const existingByCode = new Map<string, string>();
    const quote = (v: string) => `"${v.replace(/"/g, '\\"')}"`;
    try {
      const erpIdsList = Array.from(
        new Set(plans.map((p) => p.erpRouteId).filter((v): v is string => Boolean(v))),
      );
      const codesList = Array.from(new Set(plans.flatMap((p) => [p.code, p.slugCode])));
      const orParts: string[] = [];
      if (erpIdsList.length > 0) orParts.push(`erp_route_id.in.(${erpIdsList.map(quote).join(",")})`);
      if (codesList.length > 0) orParts.push(`code.in.(${codesList.map(quote).join(",")})`);
      if (orParts.length > 0) {
        const { data, error } = await centralDb
          .from("routes")
          .select("id,erp_route_id,code")
          .or(orParts.join(","));
        if (error) throw error;
        for (const r of data ?? []) {
          if (r.erp_route_id) existingByErpId.set(String(r.erp_route_id), r.id as string);
          existingByCode.set(String(r.code), r.id as string);
        }
      }
    } catch (e) {
      errors.push({ pedido: 0, message: `Consulta de rotas existentes: ${describeError(e)}` });
    }

    const routeIdByPlan = new Map<GroupPlan, string>();
    const insertByCode = new Map<
      string,
      {
        plans: GroupPlan[];
        row: {
          code: string;
          route_date: string;
          driver_name: string | null;
          erp_carrier_code: string | null;
          notes: string;
          erp_route_id: string | null;
          erp_status: string;
          carrier_id: string | null;
          total_freight: number;
          total_distance_km: number | null;
          status: "planejada" | "em_andamento";
        };
      }
    >();

    // Observação automática (`Rota <nome>`) acompanha o nome atual do ERP;
    // texto escrito manualmente é preservado.
    const notesDoNome = (snapNotes: string | null, nome: string) =>
      !snapNotes || /^Rota\s/.test(snapNotes) ? `Rota ${nome}` : snapNotes;

    for (const p of plans) {
      const existingId =
        (p.erpRouteId
          ? (existingByErpId.get(p.erpRouteId) ?? existingByCode.get(`erp-${p.erpRouteId}`))
          : undefined) ?? existingByCode.get(p.slugCode);

      const snapDoPlano =
        (p.erpRouteId ? snapshotByErpId.get(p.erpRouteId) : undefined) ??
        snapshotByCode.get(p.code) ??
        snapshotByCode.get(p.slugCode);

      if (existingId) {
        // Rota finalizada (concluída/cancelada) reencontrada: apenas atualiza (casos raros).
        const { error } = await centralDb
          .from("routes")
          .update({
            driver_name: p.driver,
            erp_carrier_code: p.carrierCode,
            route_date: p.date,
            erp_route_id: p.erpRouteId,
            erp_status: p.erpStatus,
            carrier_id: p.carrierId ?? undefined,
            code: p.erpRouteId ? `erp-${p.erpRouteId}` : undefined,
            notes: notesDoNome(snapDoPlano?.notes ?? null, p.nome),
          })
          .eq("id", existingId);
        if (error) {
          errors.push({ pedido: 0, message: `Rota ${p.nome} (${p.date}): ${describeError(error)}` });
        } else {
          routeIdByPlan.set(p, existingId);
        }
        continue;
      }

      const pendingEntry = insertByCode.get(p.code);
      if (pendingEntry) {
        // Mesmo código gerado por mais de um grupo: compartilham a mesma rota.
        pendingEntry.plans.push(p);
        continue;
      }
      const snap =
        (p.erpRouteId ? snapshotByErpId.get(p.erpRouteId) : undefined) ?? snapshotByCode.get(p.code);
      insertByCode.set(p.code, {
        plans: [p],
        row: {
          code: p.code,
          route_date: p.date,
          driver_name: p.driver,
          erp_carrier_code: p.carrierCode,
          notes: notesDoNome(snap?.notes ?? null, p.nome),

          erp_route_id: p.erpRouteId,
          erp_status: snap?.erp_status ?? p.erpStatus,
          carrier_id: p.carrierId ?? snap?.carrier_id ?? null,
          total_freight: snap?.total_freight ?? 0,
          total_distance_km: snap?.total_distance_km ?? null,
          status: (snap?.status as "planejada" | "em_andamento") ?? "planejada",
        },
      });
    }

    // Inserção em lote de todas as rotas novas (uma única gravação).
    if (insertByCode.size > 0) {
      const entries = Array.from(insertByCode.values());
      const { data: ins, error } = await centralDb
        .from("routes")
        .insert(entries.map((e) => e.row))
        .select("id,code");
      if (error) {
        errors.push({ pedido: 0, message: `Criar rotas (${entries.length}): ${describeError(error)}` });
      } else {
        const idByCode = new Map((ins ?? []).map((r) => [String(r.code), r.id as string]));
        for (const e of entries) {
          const id = idByCode.get(e.row.code);
          if (!id) continue;
          routes_created++;
          for (const p of e.plans) routeIdByPlan.set(p, id);
        }
      }
    }

    for (const [p, routeId] of routeIdByPlan) {
      const orderRows = p.pedidos
        .map((ped) => ({ id: orderIdByErpId.get(ped), erp_id: ped }))
        .filter((o): o is { id: string; erp_id: string } => Boolean(o.id));
      for (const [idx, o] of orderRows.entries()) {
        pendingLinks.push({ route_id: routeId, order_id: o.id, stop_order: idx + 1 });
      }
    }

    // Vínculos pedido↔rota gravados em lote (um pedido só pode estar em uma rota).
    if (pendingLinks.length > 0) {
      try {
        const ids = pendingLinks.map((l) => l.order_id);
        for (let i = 0; i < ids.length; i += 300) {
          const { error: delErr } = await centralDb
            .from("route_orders")
            .delete()
            .in("order_id", ids.slice(i, i + 300));
          if (delErr) throw delErr;
        }
        for (let i = 0; i < pendingLinks.length; i += 300) {
          const chunk = pendingLinks.slice(i, i + 300);
          const { error: linkErr, count } = await centralDb
            .from("route_orders")
            .upsert(chunk, { onConflict: "order_id", ignoreDuplicates: true, count: "exact" });
          if (linkErr) throw linkErr;
          routes_linked += count ?? chunk.length;
        }
      } catch (e) {
        errors.push({ pedido: 0, message: `Vínculo pedidos↔rotas: ${describeError(e)}` });
      }
    }

    // Rotas com ID do ERP e nenhum pedido no app (ex.: montadas e expedidas
    // entre dois syncs — os pedidos nunca vieram na leitura de pendentes).
    // Completa pedidos, borderô e responsável direto da rota no ERP.
    try {
      await completarRotasSemPedidos();
    } catch (e) {
      errors.push({ pedido: 0, message: `Completar rotas sem pedidos: ${describeError(e)}` });
    }




  } catch (e) {
    const msg = describeError(e);
    await centralDb
      .from("erp_sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors: [{ pedido: 0, message: msg }],
      })
      .eq("id", run.id);
    return {
      runId: run.id,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      customers_created: 0,
      errors: [{ pedido: 0, message: msg }],
      status: "failed",
    };
  }

  // Fecha a execução assim que os pedidos e rotas estão gravados. As etapas de
  // geocodificação abaixo são complementares e não devem manter a execução aberta.
  const status: SyncResult["status"] =
    errors.length === 0 ? "success" : errors.length === fetched ? "failed" : "partial";
  await centralDb
    .from("erp_sync_runs")
    .update({
      finished_at: new Date().toISOString(),
      orders_fetched: fetched,
      orders_created: created,
      orders_updated: updated,
      orders_skipped: skipped,
      customers_created,
      errors,
      status,
    })
    .eq("id", run.id);

  // A atualização manual precisa responder antes do limite da requisição.
  // Pedidos e rotas já estão persistidos neste ponto; as tarefas complementares
  // abaixo permanecem reservadas à execução agendada.
  // Notas faturadas dos ciclos recentes (painel Custo de Frete), também no manual.
  try {
    const n = await sincronizarNotasFaturadas();
    console.log(`[erp-sync] ${n} notas faturadas espelhadas`);
  } catch (err) {
    console.warn("[erp-sync] sincronizar notas faturadas falhou:", err);
  }

  if (opts.trigger === "manual") {
    console.log(`[erp-sync] rotas: ${routes_created} criadas, ${routes_linked} pedidos vinculados`);
    return { runId: run.id, fetched, created, updated, skipped, customers_created, errors, status };
  }

  // Espelha as entregas em aberto (NF expedida e ainda não entregue).
  let clientesEntregas: Set<string> = new Set();
  try {
    const entregas = await sincronizarEntregasAbertas();
    clientesEntregas = entregas.clientes;
    console.log(`[erp-sync] ${entregas.total} entregas em aberto espelhadas`);
  } catch (err) {
    console.warn("[erp-sync] sincronizar entregas em aberto falhou:", err);
  }

  // Completa o cadastro dos clientes que aparecem em pedidos antigos e ainda
  // não têm razão social/cidade/bairro no espelho local. Roda depois do
  // fechamento da execução para não atrasar a sincronização de pedidos.
  try {
    const completados = await completarCadastroClientesFaltantes(2000, clientesEntregas);
    if (completados > 0) console.log(`[erp-sync] cadastro de ${completados} clientes completado`);
  } catch (err) {
    console.warn("[erp-sync] completar cadastro de clientes falhou:", err);
  }

  // Geocodificação é opcional: só roda se ainda houver tempo dentro do orçamento.
  const geocodeAllowed = elapsedMs() < BUDGET_MS;
  if (!geocodeAllowed) {
    console.log(`[erp-sync] geocodificação pulada (tempo decorrido ${Math.round(elapsedMs() / 1000)}s)`);
  }

  // Geocodifica clientes sem latitude/longitude
  let geocoded_customers = 0;

  try {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (geocodeAllowed && lovableKey && gmKey) {
      const { data: comPedido } = await centralDb
        .from("orders")
        .select("erp_cod_cliente, delivery_address")
        .not("erp_cod_cliente", "is", null)
        .limit(5000);
      const codigos = Array.from(
        new Set((comPedido ?? []).map((o) => String(o.erp_cod_cliente)).filter(Boolean)),
      );
      const { data: geoRows } = codigos.length
        ? await centralDb
            .from("customer_geo")
            .select("cod_cliente, latitude, longitude, endereco_usado")
            .in("cod_cliente", codigos)
            .limit(5000)
        : { data: [] };
      const geoByCode = new Map((geoRows ?? []).map((g) => [String(g.cod_cliente), g]));
      const addrByCode = new Map<string, string | null>();
      for (const o of comPedido ?? []) {
        const code = String(o.erp_cod_cliente);
        if (!addrByCode.has(code)) addrByCode.set(code, o.delivery_address ?? null);
      }
      const pending = codigos
        .map((code) => {
          const geo = geoByCode.get(code);
          return {
            id: code,
            address_line: addrByCode.get(code) ?? geo?.endereco_usado ?? null,
            latitude: geo?.latitude ?? null,
            longitude: geo?.longitude ?? null,
          };
        })
        .filter((c) => c.latitude == null || c.longitude == null);
      // Endereço do cliente (bairro/cidade/UF) a partir dos pedidos em aberto no ERP.
      // Esses clientes têm prioridade: são os que aparecem nas rotas e telas.
      const erpEnd = new Map<string, string>();
      try {
        const base = (process.env.ERP_API_BASE_URL ?? "").replace(/\/+$/, "").replace(/\/v1\/query$/, "");
        const apiKey = process.env.ERP_API_KEY;
        const semEnd = pending.filter((c) => !c.address_line || String(c.address_line).split(",").filter((p) => p.trim()).length < 2).map((c) => c.id).filter((c) => /^\d+$/.test(c));
        if (base && apiKey && semEnd.length) {
          for (let i = 0; i < semEnd.length && i < 2000; i += 500) {
            const sql = `SELECT DISTINCT E.COD_CLIENTE, E.BAIRRO, E.CIDADE, E.UF FROM ERP_PEDIDOS_EXPEDICAO_PENDENTE E WHERE E.COD_CLIENTE IN (${semEnd.slice(i, i + 500).join(",")})`;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 20_000);
            try {
              const res = await fetch(`${base}/v1/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
                body: JSON.stringify({ sql, binds: {}, limit: 5000 }),
                signal: ctrl.signal,
              });
              if (!res.ok) break;
              const rows = ((await res.json()) as { rows?: Record<string, unknown>[] }).rows ?? [];
              for (const r of rows) {
                const g = (k: string) => {
                  const e = Object.entries(r).find(([key]) => key.toUpperCase() === k);
                  const v = e?.[1];
                  return v == null ? "" : String(v).trim();
                };
                const cod = g("COD_CLIENTE");
                const end = [g("BAIRRO"), g("CIDADE"), g("UF")].filter(Boolean).join(", ");
                if (cod && g("CIDADE") && !erpEnd.has(cod)) erpEnd.set(cod, end);
              }
            } finally {
              clearTimeout(t);
            }
          }
        }
      } catch (err) {
        console.warn("[erp-sync] endereço ERP para geocodificação indisponível", err);
      }
      // Só localiza com pelo menos "cidade, UF": pesquisar só "Brasil" ou só o
      // bairro devolve o centro do país ou outra cidade (ex.: cliente 216720).
      const enderecoValido = (a: string | null | undefined) =>
        !!a && String(a).split(",").filter((p) => p.trim()).length >= 2;
      const fila = pending
        .map((c) => ({
          ...c,
          address_line: enderecoValido(c.address_line) ? c.address_line : erpEnd.get(c.id) ?? null,
        }))
        .filter((c) => enderecoValido(c.address_line))
        .sort((a, b) => Number(erpEnd.has(b.id)) - Number(erpEnd.has(a.id)))
        // Limite por execução: geocodificar tudo de uma vez estoura o tempo do servidor.
        .slice(0, 30);
      for (const c of fila) {

        const q = [c.address_line, "Brasil"]
          .filter((p) => p && String(p).trim())
          .join(", ");
        try {
          const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=br&language=pt-BR`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmKey },
          });
          if (!res.ok) continue;
          const json = (await res.json()) as {
            status: string;
            results?: { types?: string[]; geometry?: { location?: { lat: number; lng: number } } }[];
          };
          if (json.status !== "OK" || !json.results?.length) continue;
          // Resposta genérica (só país/estado) não é a localização do cliente.
          const tipos = json.results[0].types ?? [];
          if (tipos.some((t) => t === "country" || t === "administrative_area_level_1")) continue;
          const loc = json.results[0].geometry?.location;
          if (!loc) continue;
          // As coordenadas ficam no cache do banco central (customer_geo);
          // o cadastro do cliente permanece sendo o do ERP.
          const { error: upErr } = await centralDb
            .from("customer_geo")
            .upsert(
              {
                 cod_cliente: String(c.id),
                latitude: loc.lat,
                longitude: loc.lng,
                endereco_usado: q,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "cod_cliente" },
            );
          if (!upErr) geocoded_customers++;

        } catch (err) {
          console.warn("[erp-sync] geocode falhou para cliente", c.id, err);
        }
      }
      if (geocoded_customers > 0) {
        console.log(`[erp-sync] geocodificados ${geocoded_customers} clientes`);
      }
    }
  } catch (err) {
    console.warn("[erp-sync] etapa de geocodificação falhou:", err);
  }

  // Geocodifica pedidos com endereço de entrega alternativo (OBS_LOGIST)
  let geocoded_orders = 0;
  try {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (geocodeAllowed && lovableKey && gmKey) {
      const { data: pendingOrders } = await centralDb
        .from("orders")
        .select("id, delivery_address")
        .not("delivery_address", "is", null)
        .is("delivery_latitude", null)
        .limit(30);
      for (const o of pendingOrders ?? []) {
        const addr = (o as { delivery_address: string | null }).delivery_address;
        if (!addr || !addr.trim()) continue;
        const q = `${addr.trim()}, Brasil`;
        try {
          const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=br&language=pt-BR`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmKey },
          });
          if (!res.ok) continue;
          const json = (await res.json()) as {
            status: string;
            results?: { types?: string[]; geometry?: { location?: { lat: number; lng: number } } }[];
          };
          if (json.status !== "OK" || !json.results?.length) continue;
          // Resposta genérica (só país/estado) não é a localização do cliente.
          const tipos = json.results[0].types ?? [];
          if (tipos.some((t) => t === "country" || t === "administrative_area_level_1")) continue;
          const loc = json.results[0].geometry?.location;
          if (!loc) continue;
          const { error: upErr } = await centralDb
            .from("orders")
            .update({ delivery_latitude: loc.lat, delivery_longitude: loc.lng })
            .eq("id", o.id);
          if (!upErr) geocoded_orders++;
        } catch (err) {
          console.warn("[erp-sync] geocode falhou para pedido", o.id, err);
        }
      }
      if (geocoded_orders > 0) {
        console.log(`[erp-sync] geocodificados ${geocoded_orders} pedidos (endereço alternativo)`);
      }
    }
  } catch (err) {
    console.warn("[erp-sync] etapa de geocodificação de pedidos falhou:", err);
  }



  console.log(`[erp-sync] rotas: ${routes_created} criadas, ${routes_linked} pedidos vinculados`);
  return { runId: run.id, fetched, created, updated, skipped, customers_created, errors, status };
}

