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
  COD_CLIENTE: number;
  CLIENTE_RS: string | null;
  CLIENTE_NF: string | null;
  BAIRRO: string | null;
  CIDADE: string | null;
  UF: string | null;
  COD_VENDEDOR: number | null;
  VENDEDOR: string | null;
  VALOR_PEDIDO: number | null;
  VALOR: number | null;
  PESO: number | null;
  DT_PEDIDO: string | null;
  DT_EMISSAO: string | null;
  OBS: string | null;
  STATUS: string | null;
};

const PENDING_ORDERS_SQL = `
  SELECT E.PEDIDO, E.COD_CLIENTE, E.CLIENTE_RS, E.CLIENTE_NF, E.BAIRRO, E.CIDADE, E.UF,
         E.COD_VENDEDOR, E.VENDEDOR, E.VALOR_PEDIDO, E.VALOR, E.PESO,
         E.DT_PEDIDO, E.DT_EMISSAO, E.OBS, E.STATUS
  FROM ERP_PEDIDOS_EXPEDICAO_PENDENTE E
  WHERE E.DT_SAIDA_BORDERO IS NULL
    AND (E.NF_DEVOLVIDA IS NULL OR E.NF_DEVOLVIDA = 'NAO')
    AND E.COD_AGENDA IN (417, 427)
    AND E.COD_CLIENTE NOT IN (4065, 4081, 4170, 4189, 4405, 4413, 4634, 4642)
    AND E.PEDIDO NOT IN (4034403, 4026661, 4026662, 96385, 4003534)
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
  const errors: { pedido: number; message: string }[] = [];
  let fetched = 0;

  try {
    const rows = await fetchPendingOrdersFromErp();
    fetched = rows.length;

    for (const row of rows) {
      try {
        // 2a) Upsert customer por erp_id
        const codCliente = String(row.COD_CLIENTE);
        const legalName = row.CLIENTE_RS ?? row.CLIENTE_NF ?? `Cliente ${codCliente}`;
        const customerPayload = {
          erp_id: codCliente,
          legal_name: legalName,
          trade_name: row.CLIENTE_NF,
          city: row.CIDADE,
          state: row.UF,
          address_line: row.BAIRRO,
        };

        const { data: existingCustomer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("erp_id", codCliente)
          .maybeSingle();

        let customerId: string;
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
          customers_created++;
        }

        // 2b) Upsert order por erp_id
        const pedidoStr = String(row.PEDIDO);
        const totalAmount = Number(row.VALOR_PEDIDO ?? row.VALOR ?? 0);
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
          .select("id, status")
          .eq("erp_id", pedidoStr)
          .maybeSingle();

        if (existingOrder) {
          // Atualiza só campos cadastrais. NUNCA muda status (preserva fluxo operacional).
          const { error } = await supabaseAdmin
            .from("orders")
            .update({
              customer_id: customerId,
              total_amount: totalAmount,
              notes: notes || null,
            })
            .eq("id", existingOrder.id);
          if (error) throw error;
          updated++;
        } else {
          // Cria novo pedido com status default (aguardando_aprovacao_comercial)
          const { error } = await supabaseAdmin.from("orders").insert({
            order_number: pedidoStr,
            erp_id: pedidoStr,
            customer_id: customerId,
            total_amount: totalAmount,
            notes: notes || null,
          });
          if (error) {
            // Se já existe pelo order_number (conflito), pula
            if (error.code === "23505") {
              skipped++;
              continue;
            }
            throw error;
          }
          created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ pedido: row.PEDIDO, message: msg });
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
