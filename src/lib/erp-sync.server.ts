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
         CASE WHEN R.DT_PREV_EXP IS NULL THEN
              CASE WHEN R.NOME_ROTA IS NULL THEN TO_DATE('40000101','yyyyMMdd')
                   ELSE TO_DATE('30000101','yyyyMMdd') END
              ELSE R.DT_PREV_EXP END DT_PREV_EXP,
         R.NOME_ROTA, R.COD_FRT_TRP, R.NOME_MOTORISTA, R.ID AS ID_ROTA, E.CEP
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

  async function processRow(row: ErpOrderRow) {
    const codCliente = String(row.COD_CLIENTE);
    // O cadastro de clientes é do banco central (public.clientes). Aqui apenas
    // referenciamos o código do ERP; nada é duplicado no app.
    const customerId = codCliente;
    const customerCreated = false;




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

    const qtdDias = parseErpInteger(getErpField(row as unknown as Record<string, unknown>, "QTD_DIAS"));
    const deliveryAddress = parseDeliveryOverride(row.OBS_LOGIST);

    const { data: existingOrder } = await centralDb
      .from("orders")
      .select("id, delivery_address")
      .eq("erp_id", pedidoStr)
      .maybeSingle();

    if (existingOrder) {
      const prevAddr = (existingOrder as { delivery_address: string | null }).delivery_address ?? null;
      const addrChanged = (deliveryAddress ?? null) !== prevAddr;
      const updatePayload = {
        erp_cod_cliente: customerId,
        total_amount: totalAmount,
        weight: row.PESO,
        cod_agenda: row.COD_AGENDA,
        notes: notes || null,
        dt_prev_exp: parseErpDate(row.DT_PREV_EXP),
        nome_rota: row.NOME_ROTA || null,
        nome_motorista: row.NOME_MOTORISTA || null,
        erp_status: row.STATUS || null,
        qtd_dias: qtdDias,
        ...(addrChanged
          ? {
              delivery_address: deliveryAddress,
              delivery_latitude: null,
              delivery_longitude: null,
            }
          : {}),
      };
      const { error } = await centralDb
        .from("orders")
        .update(updatePayload)
        .eq("id", existingOrder.id);
      if (error) throw error;
      return { customerCreated, outcome: "updated" as const };
    }

    const { error } = await centralDb.from("orders").insert({
      order_number: pedidoStr,
      erp_id: pedidoStr,
      erp_cod_cliente: customerId,
      total_amount: totalAmount,
      weight: row.PESO,
      cod_agenda: row.COD_AGENDA,
      notes: notes || null,
      dt_prev_exp: parseErpDate(row.DT_PREV_EXP),
      nome_rota: row.NOME_ROTA || null,
      nome_motorista: row.NOME_MOTORISTA || null,
      erp_status: row.STATUS || null,
      qtd_dias: qtdDias,
      delivery_address: deliveryAddress,
    });
    if (error) {
      if (error.code === "23505") return { customerCreated, outcome: "skipped" as const };
      throw error;
    }
    return { customerCreated, outcome: "created" as const };
  }

  try {
    const rows = await fetchPendingOrdersFromErp();
    fetched = rows.length;

    const CONCURRENCY = 15;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (row) => {
          try {
            const r = await processRow(row);
            return { ok: true as const, row, ...r };
          } catch (e) {
            const msg = describeError(e);
            return { ok: false as const, row, message: msg };
          }
        }),
      );
      for (const r of results) {
        if (!r.ok) {
          errors.push({ pedido: r.row.PEDIDO, message: r.message });
          continue;
        }
        if (r.customerCreated) customers_created++;
        if (r.outcome === "created") created++;
        else if (r.outcome === "updated") updated++;
        else skipped++;
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
      pedidos: string[];
    };
    const groups = new Map<string, RouteGroup>();
    for (const row of rows) {
      const nome = (row.NOME_ROTA ?? "").trim();
      if (!nome) continue;
      const dt = parseErpDate(row.DT_PREV_EXP);
      if (!dt) continue;
      const dateOnly = dt.slice(0, 10);
      if (dateOnly === "3000-01-01" || dateOnly === "4000-01-01") continue;
      const driver = row.NOME_MOTORISTA?.trim() || null;
      const carrierCode =
        row.COD_FRT_TRP != null && String(row.COD_FRT_TRP).trim() !== ""
          ? String(row.COD_FRT_TRP).trim()
          : null;
      const erpRouteId =
        row.ID_ROTA != null && String(row.ID_ROTA).trim() !== ""
          ? String(row.ID_ROTA).trim()
          : null;
      const key = erpRouteId
        ? `erp:${erpRouteId}`
        : `${nome}|${dateOnly}|${driver ?? ""}|${carrierCode ?? ""}`;
      let g = groups.get(key);
      if (!g) {
        g = { erpRouteId, nome, date: dateOnly, driver, carrierCode, pedidos: [] };
        groups.set(key, g);
      }
      g.pedidos.push(String(row.PEDIDO));
    }

    // Cache de resolução COD_FRT_TRP -> freight_carriers.id
    const carrierCache = new Map<string, string | null>();
    async function resolveCarrierId(codErp: string): Promise<string | null> {
      if (carrierCache.has(codErp)) return carrierCache.get(codErp) ?? null;
      const { data: transp } = await centralDb
        .from("transportadoras")
        .select("id")
        .eq("cod_erp", codErp)
        .maybeSingle();
      if (!transp) {
        carrierCache.set(codErp, null);
        return null;
      }
      const { data: carrier } = await centralDb
        .from("freight_carriers")
        .select("id")
        .eq("transportadora_id", transp.id)
        .maybeSingle();
      const id = carrier?.id ?? null;
      carrierCache.set(codErp, id);
      return id;
    }

    for (const g of groups.values()) {
      try {
        const code = g.erpRouteId
          ? `erp-${g.erpRouteId}`
          : `${slugify(g.nome)}-${g.date.replace(/-/g, "")}`;

        const carrierId = g.carrierCode ? await resolveCarrierId(g.carrierCode) : null;

        let existing: { id: string } | null = null;
        if (g.erpRouteId) {
          const { data } = await centralDb
            .from("routes")
            .select("id")
            .eq("erp_route_id", g.erpRouteId)
            .maybeSingle();
          existing = data ?? null;
        }
        if (!existing) {
          // Tenta achar por código erp-* (caso erp_route_id ainda não esteja preenchido)
          if (g.erpRouteId) {
            const { data } = await centralDb
              .from("routes")
              .select("id")
              .eq("code", `erp-${g.erpRouteId}`)
              .maybeSingle();
            existing = data ?? null;
          }
        }
        if (!existing) {
          // Fallback: rota slug-based pré-existente (criada antes do ERP retornar ID_ROTA)
          const slugCode = `${slugify(g.nome)}-${g.date.replace(/-/g, "")}`;
          const { data } = await centralDb
            .from("routes")
            .select("id")
            .eq("code", slugCode)
            .maybeSingle();
          existing = data ?? null;
        }


        let routeId: string;
        if (existing) {
          routeId = existing.id;
          await centralDb
            .from("routes")
            .update({
              driver_name: g.driver,
              route_date: g.date,
              erp_route_id: g.erpRouteId,
              carrier_id: carrierId,
              code: g.erpRouteId ? `erp-${g.erpRouteId}` : undefined,
            })
            .eq("id", routeId);

        } else {
          const { data: ins, error } = await centralDb
            .from("routes")
            .insert({
              code,
              route_date: g.date,
              driver_name: g.driver,
              notes: `Rota ${g.nome}`,
              erp_route_id: g.erpRouteId,
              carrier_id: carrierId,
            })
            .select("id")
            .single();
          if (error || !ins) throw error ?? new Error("insert route falhou");
          routeId = ins.id;
          routes_created++;
        }

        const { data: orderRows } = await centralDb
          .from("orders")
          .select("id,erp_id")
          .in("erp_id", g.pedidos);

        if (orderRows && orderRows.length > 0) {
          const orderIds = orderRows.map((o) => o.id);
          // Remove vínculos antigos em outras rotas (pedido só pode estar em 1 rota)
          const { error: delErr } = await centralDb
            .from("route_orders")
            .delete()
            .in("order_id", orderIds)
            .neq("route_id", routeId);
          if (delErr) throw delErr;

          const links = orderRows.map((o, idx) => ({
            route_id: routeId,
            order_id: o.id,
            stop_order: idx + 1,
          }));
          const { error: linkErr, count } = await centralDb
            .from("route_orders")
            .upsert(links, { onConflict: "order_id", ignoreDuplicates: true, count: "exact" });
          if (linkErr) throw linkErr;
          routes_linked += count ?? 0;
        }
      } catch (e) {
        const msg = describeError(e);
        errors.push({ pedido: 0, message: `Rota ${g.nome} (${g.date}): ${msg}` });
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

  // Geocodifica clientes sem latitude/longitude
  let geocoded_customers = 0;
  try {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (lovableKey && gmKey) {
      const { data: comPedido } = await centralDb
        .from("orders")
        .select("erp_cod_cliente")
        .not("erp_cod_cliente", "is", null)
        .limit(5000);
      const codigos = Array.from(
        new Set((comPedido ?? []).map((o) => String(o.erp_cod_cliente))),
      );
      const { data: pending } = codigos.length
        ? await centralDb
            .from("customers")
            .select("id, address_line, city, state, zip_code")
            .in("id", codigos)
            .or("latitude.is.null,longitude.is.null")
            .limit(200)
        : { data: [] };
      for (const c of pending ?? []) {
        const q = [c.address_line, c.city, c.state, c.zip_code, "Brasil"]
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
        .limit(200);
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

  console.log(`[erp-sync] rotas: ${routes_created} criadas, ${routes_linked} pedidos vinculados`);
  return { runId: run.id, fetched, created, updated, skipped, customers_created, errors, status };
}
