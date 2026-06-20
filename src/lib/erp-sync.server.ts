// Server-only helper: importa pedidos pendentes de expedição do ERP Oracle (Hairfly).
// API: POST {ERP_API_BASE_URL}/v1/query com { sql, binds, limit } e header X-API-Key.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
};

const PENDING_ORDERS_SQL = `
  SELECT E.COD_AGENDA, E.COD_FILIAL, E.NR_DOCUMENTO, E.DT_AGENDA,
         E.COD_CLIENTE, E.CLIENTE_RS, E.CLIENTE_NF, E.BAIRRO, E.CIDADE, E.UF, E.PIN,
         E.COD_VENDEDOR, E.VENDEDOR, E.VALOR, E.PESO, E.VOLUME,
         E.PEDIDO, E.VALOR_PEDIDO, E.DT_PEDIDO, E.DT_EMISSAO,
         E.BORDERO, E.DT_BORDERO, E.STATUS_BORDERO,
         E.COD_MOTORISTA, E.PLACA, E.MOTORISTA,
         E.STATUS, E.OBS, E.QTD_DIAS, E.OBS_LOGIST, E.DIF_ENT,
         E.GNRE, E.TP_PGTO, E.INF_CMP, E.QTD_EMB,
         CASE WHEN R.DT_PREV_EXP IS NULL THEN
              CASE WHEN R.NOME_ROTA IS NULL THEN TO_DATE('40000101','yyyyMMdd')
                   ELSE TO_DATE('30000101','yyyyMMdd') END
              ELSE R.DT_PREV_EXP END DT_PREV_EXP,
         R.NOME_ROTA, R.NOME_MOTORISTA, E.CEP
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

async function fetchPendingOrdersFromErp(): Promise<ErpOrderRow[]> {
  const baseUrl = process.env.ERP_API_BASE_URL;
  const apiKey = process.env.ERP_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  }
  // Aceita base URL com ou sem /v1/query no final
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const url = `${cleanBase}/v1/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ sql: PENDING_ORDERS_SQL, binds: {}, limit: 5000 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ERP API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as ErpQueryResponse;
  return (json.rows ?? []) as unknown as ErpOrderRow[];
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
  const { data: run, error: runErr } = await supabaseAdmin
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

  async function processRow(row: ErpOrderRow) {
    const codCliente = String(row.COD_CLIENTE);
    const legalName = row.CLIENTE_RS ?? row.CLIENTE_NF ?? `Cliente ${codCliente}`;
    const customerPayload = {
      erp_id: codCliente,
      legal_name: legalName,
      trade_name: row.CLIENTE_NF,
      city: row.CIDADE,
      state: row.UF,
      address_line: row.BAIRRO,
      zip_code: row.CEP,
    };

    const { data: existingCustomer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("erp_id", codCliente)
      .maybeSingle();

    let customerId: string;
    let customerCreated = false;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      const { error } = await supabaseAdmin
        .from("customers")
        .update({
          legal_name: customerPayload.legal_name,
          trade_name: customerPayload.trade_name,
          city: customerPayload.city,
          state: customerPayload.state,
          address_line: customerPayload.address_line,
          zip_code: customerPayload.zip_code,
        })
        .eq("id", customerId);
      if (error) throw error;
    } else {
      const { data: ins, error } = await supabaseAdmin
        .from("customers")
        .insert(customerPayload)
        .select("id")
        .single();
      if (error || !ins) throw error ?? new Error("insert customer falhou");
      customerId = ins.id;
      customerCreated = true;
    }

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

    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("erp_id", pedidoStr)
      .maybeSingle();

    if (existingOrder) {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({
          customer_id: customerId,
          total_amount: totalAmount,
          weight: row.PESO,
          cod_agenda: row.COD_AGENDA,
          notes: notes || null,
          dt_prev_exp: parseErpDate(row.DT_PREV_EXP),
          nome_rota: row.NOME_ROTA || null,
          nome_motorista: row.NOME_MOTORISTA || null,
        })
        .eq("id", existingOrder.id);
      if (error) throw error;
      return { customerCreated, outcome: "updated" as const };
    }

    const { error } = await supabaseAdmin.from("orders").insert({
      order_number: pedidoStr,
      erp_id: pedidoStr,
      customer_id: customerId,
      total_amount: totalAmount,
      weight: row.PESO,
      cod_agenda: row.COD_AGENDA,
      notes: notes || null,
      dt_prev_exp: parseErpDate(row.DT_PREV_EXP),
      nome_rota: row.NOME_ROTA || null,
      nome_motorista: row.NOME_MOTORISTA || null,
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
            const msg = e instanceof Error ? e.message : String(e);
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

    // Auto-cadastro de rotas a partir de NOME_ROTA + DT_PREV_EXP + NOME_MOTORISTA
    type RouteGroup = { nome: string; date: string; driver: string | null; pedidos: string[] };
    const groups = new Map<string, RouteGroup>();
    for (const row of rows) {
      const nome = (row.NOME_ROTA ?? "").trim();
      if (!nome) continue;
      const dt = parseErpDate(row.DT_PREV_EXP);
      if (!dt) continue;
      const dateOnly = dt.slice(0, 10);
      if (dateOnly === "3000-01-01" || dateOnly === "4000-01-01") continue;
      const driver = row.NOME_MOTORISTA?.trim() || null;
      const key = `${nome}|${dateOnly}|${driver ?? ""}`;
      let g = groups.get(key);
      if (!g) {
        g = { nome, date: dateOnly, driver, pedidos: [] };
        groups.set(key, g);
      }
      g.pedidos.push(String(row.PEDIDO));
    }

    for (const g of groups.values()) {
      try {
        const code = `${slugify(g.nome)}-${g.date.replace(/-/g, "")}`;
        const { data: existing } = await supabaseAdmin
          .from("routes")
          .select("id")
          .eq("code", code)
          .maybeSingle();

        let routeId: string;
        if (existing) {
          routeId = existing.id;
          await supabaseAdmin
            .from("routes")
            .update({ driver_name: g.driver, route_date: g.date })
            .eq("id", routeId);
        } else {
          const { data: ins, error } = await supabaseAdmin
            .from("routes")
            .insert({
              code,
              route_date: g.date,
              driver_name: g.driver,
              notes: `Rota ${g.nome}`,
            })
            .select("id")
            .single();
          if (error || !ins) throw error ?? new Error("insert route falhou");
          routeId = ins.id;
          routes_created++;
        }

        const { data: orderRows } = await supabaseAdmin
          .from("orders")
          .select("id,erp_id")
          .in("erp_id", g.pedidos);

        if (orderRows && orderRows.length > 0) {
          const links = orderRows.map((o, idx) => ({
            route_id: routeId,
            order_id: o.id,
            stop_order: idx + 1,
          }));
          const { error: linkErr, count } = await supabaseAdmin
            .from("route_orders")
            .upsert(links, { onConflict: "route_id,order_id", ignoreDuplicates: true, count: "exact" });
          if (linkErr) throw linkErr;
          routes_linked += count ?? 0;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ pedido: 0, message: `Rota ${g.nome} (${g.date}): ${msg}` });
      }
    }



  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
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

  const status: SyncResult["status"] =
    errors.length === 0 ? "success" : errors.length === fetched ? "failed" : "partial";

  await supabaseAdmin
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

  return { runId: run.id, fetched, created, updated, skipped, customers_created, errors, status };
}
