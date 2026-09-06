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
         E.COD_MOTORISTA, E.PLACA, E.MOTORISTA,
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

const RESPONSAVEIS_SQL = `
  SELECT TRIM(T.DBA_TIP_CODIGO_1) COD_ERP,
         TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
         T.DBA_TIP_NATUREZA COD_NAT
    FROM GKS.A_CADCTIPO T
   WHERE T.DBA_TIP_CODIGO_1 IS NOT NULL
`;

async function sincronizarEspelhoResponsaveis() {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql: RESPONSAVEIS_SQL, binds: {}, limit: 10000 }),
  });
  if (!res.ok) throw new Error(friendlyErpError(res.status, await res.text()));
  const json = (await res.json()) as ErpQueryResponse;
  const byCode = new Map<string, { cod_erp: string; razao_social: string | null; natureza: string; tipo_frete: "F" | "T" | "P" | null }>();
  for (const row of json.rows ?? []) {
    const cod = String(row.COD_ERP ?? row.cod_erp ?? "").trim();
    if (!cod || byCode.has(cod)) continue;
    const natureza = String(row.COD_NAT ?? row.cod_nat ?? "").trim().toUpperCase();
    byCode.set(cod, {
      cod_erp: cod,
      razao_social: String(row.RAZAO_SOCIAL ?? row.razao_social ?? "").trim() || null,
      natureza,
      tipo_frete: natureza === "EF" ? "F" : natureza === "ET" ? "T" : natureza === "EM" ? "P" : null,
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



type SyncResult = {
  runId: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  customers_created: number;
  errors: { pedido: number; message: string }[];
  status: "success" | "partial" | "failed";
};

export async function syncErpOrders(opts: {
  trigger: "manual" | "cron";
  triggeredBy: string | null;
}): Promise<SyncResult> {
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
    const responsaveisPromise = sincronizarEspelhoResponsaveis({ maxAgeMs: 60 * 60 * 1000 }).catch(
      (e) => {
        errors.push({ pedido: 0, message: `Atualizar responsáveis do ERP: ${describeError(e)}` });
        return 0;
      },
    );
    const rows = await fetchPendingOrdersFromErp();
    fetched = rows.length;
    try {
      await sincronizarEspelhoClientes(rows);
    } catch (e) {
      errors.push({ pedido: 0, message: `Atualizar clientes do ERP: ${describeError(e)}` });
    }
    await responsaveisPromise;

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
      // Rotas com DT_PREV_EXP sentinela (3000/4000) também devem ser exibidas.
      // 4000-01-01 representa pedidos ainda sem rota no ERP, portanto normalmente
      // não possui NOME_ROTA nem ID_ROTA. Agrupa esses pedidos em uma rota visível.
      if (!nome) {
        if (erpRouteId) nome = `ROTA ${erpRouteId}`;
        else if (dateOnly === "4000-01-01") nome = "NÃO PLANEJADO";
        else continue;
      }
      const driver = row.NOME_MOTORISTA?.trim() || null;
      const carrierCode =
        row.COD_FRT_TRP != null && String(row.COD_FRT_TRP).trim() !== ""
          ? String(row.COD_FRT_TRP).trim()
          : null;
      const erpStatus = row.ROTA_STATUS?.trim() || "P";
      const key = erpRouteId
        ? `erp:${erpRouteId}`
        : `${nome}|${dateOnly}|${driver ?? ""}|${carrierCode ?? ""}`;
      let g = groups.get(key);
      if (!g) {
        g = { erpRouteId, nome, date: dateOnly, driver, carrierCode, erpStatus, pedidos: [] };
        groups.set(key, g);
      }
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


    // Rotas pendentes (planejada/em_andamento) são sempre excluídas e reinseridas
    // a partir do retorno da query — o ERP é a fonte da verdade.
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
    try {
      const { data: pendingRoutes, error: pendErr } = await centralDb
        .from("routes")
        .select("id,erp_route_id,code,total_freight,total_distance_km,carrier_id,status,erp_status,notes")
        .in("status", ["planejada", "em_andamento"]);
      if (pendErr) throw pendErr;

      const pendingIds = (pendingRoutes ?? []).map((r) => r.id as string);
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
      errors.push({ pedido: 0, message: `Reinserção de rotas pendentes: ${describeError(e)}` });
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

    for (const p of plans) {
      const existingId =
        (p.erpRouteId
          ? (existingByErpId.get(p.erpRouteId) ?? existingByCode.get(`erp-${p.erpRouteId}`))
          : undefined) ?? existingByCode.get(p.slugCode);

      if (existingId) {
        // Rota finalizada (concluída/cancelada) reencontrada: apenas atualiza (casos raros).
        const { error } = await centralDb
          .from("routes")
          .update({
            driver_name: p.driver,
            route_date: p.date,
            erp_route_id: p.erpRouteId,
            erp_status: p.erpStatus,
            carrier_id: p.carrierId ?? undefined,
            code: p.erpRouteId ? `erp-${p.erpRouteId}` : undefined,
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
          notes: snap?.notes ?? `Rota ${p.nome}`,
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

  // Geocodifica clientes sem latitude/longitude
  let geocoded_customers = 0;

  try {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (lovableKey && gmKey) {
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
        .filter((c) => c.latitude == null || c.longitude == null)
        // Limite por execução: geocodificar tudo de uma vez estoura o tempo do servidor.
        .slice(0, 30);
      for (const c of pending) {

        const q = [c.address_line, "Brasil"]
          .filter((p) => p && String(p).trim())
          .join(", ");
        if (!q) continue;
        try {
          const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=br&language=pt-BR`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmKey },
          });
          if (!res.ok) continue;
          const json = (await res.json()) as {
            status: string;
            results?: { geometry?: { location?: { lat: number; lng: number } } }[];
          };
          if (json.status !== "OK" || !json.results?.length) continue;
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
    if (lovableKey && gmKey) {
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
            results?: { geometry?: { location?: { lat: number; lng: number } } }[];
          };
          if (json.status !== "OK" || !json.results?.length) continue;
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

