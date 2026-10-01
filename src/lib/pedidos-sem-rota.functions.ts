import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { centralDb } from "@/lib/central-db";

/**
 * Atribuição de pedidos sem rota a uma rota (nova ou existente).
 *
 * Grava no app (rotas + paradas) e replica no ERP Oracle:
 *  - capa da rota: /v1/execute/insert_capa_rota (nova) ou update_capa_rota
 *  - vínculo pedido↔rota: /v1/execute/insert_rota_pedido
 *
 * Enquanto as procedures não estiverem publicadas na API do ERP, a gravação
 * local é mantida e o erro do ERP é devolvido para a tela avisar o usuário.
 */

type NovaRota = {
  data: string; // yyyy-MM-dd
  nome: string;
  codResponsavel?: string | null;
  nomeResponsavel?: string | null;
};

type Input = {
  orderIds: string[];
  routeId?: string | null;
  routeErpId?: string | null;
  routeCode?: string | null;
  nova?: NovaRota | null;
};

async function ensureStaff(context: { supabase: any; userId: string }) {
  for (const r of ["adm", "gestor", "operador"] as const) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: r,
    });
    if (data) return;
  }
  throw new Error("Sem permissão para roteirizar pedidos");
}

function erpConfig() {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
  return {
    cleanBase: baseUrl.replace(/\/+$/, "").replace(/\/v1\/(query|execute)$/, ""),
    apiKey,
  };
}

async function executarErp(
  procedure: string,
  binds: Record<string, unknown>,
  timeoutMs = 45_000,
): Promise<Record<string, unknown>> {
  const { cleanBase, apiKey } = erpConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cleanBase}/v1/execute/${procedure}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ binds }),
      signal: controller.signal,
    });
    const texto = await res.text();
    if (!res.ok) {
      throw new Error(`ERP API ${res.status}: ${texto.replace(/\s+/g, " ").slice(0, 240)}`);
    }
    try {
      return JSON.parse(texto) as Record<string, unknown>;
    } catch {
      return {};
    }
  } finally {
    clearTimeout(timeout);
  }
}

function descrever(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function slugRota(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rota"
  );
}

/** Grava a capa da rota no ERP (insert_ger_rota) e devolve o ID oficial. */
async function criarCapaRotaErp(nova: NovaRota): Promise<string> {
  const cod = nova.codResponsavel?.toString().trim();
  const codNum = cod && /^\d+$/.test(cod) ? Number(cod) : null;
  let resposta: Record<string, unknown>;
  try {
    resposta = await executarErp("insert_ger_rota", {
      dt_prev_exp_yyyyMMdd: nova.data.replace(/-/g, ""),
      nome_rota: nova.nome.trim().toUpperCase(),
      nome_motorista: nova.nomeResponsavel?.trim().toUpperCase() || null,
      cod_frt_trp: codNum,
      status: "P",
    });
  } catch (e) {
    throw new Error(`Rota não foi criada no ERP: ${descrever(e)}`);
  }
  const out = resposta?.["outBinds"] as Record<string, unknown> | undefined;
  const bruto = out?.["id_rota"] ?? out?.["ID_ROTA"];
  if (bruto == null || String(bruto).trim() === "") {
    throw new Error("O ERP não devolveu o número da rota criada. Confira no ERP antes de tentar de novo.");
  }
  return String(bruto).trim();
}

export const criarRotaErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NovaRota) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.data ?? ""))) throw new Error("Informe a data planejada");
    if (!String(input?.nome ?? "").trim()) throw new Error("Informe o nome da rota");
    return {
      data: input.data,
      nome: input.nome.trim(),
      codResponsavel: input.codResponsavel?.toString().trim() || null,
      nomeResponsavel: input.nomeResponsavel?.trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const nomeRota = data.nome.toUpperCase();
    const erpRouteId = await criarCapaRotaErp(data);
    const code = `${slugRota(nomeRota)}-${data.data.replace(/-/g, "")}-${Date.now().toString(36)}`;
    const { data: inserida, error } = await centralDb
      .from("routes")
      .insert({
        code,
        route_date: data.data,
        driver_name: data.nomeResponsavel?.toUpperCase() || null,
        erp_carrier_code: data.codResponsavel,
        total_freight: 0,
        notes: `Rota ${nomeRota}`,
        erp_route_id: erpRouteId,
        erp_status: "P",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(`Rota ${erpRouteId} criada no ERP, mas falhou no app: ${error.message}`);
    return { routeId: (inserida as { id: string }).id, erpRouteId, nomeRota };
  });

export const atribuirPedidosARota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    const orderIds = Array.from(new Set((input?.orderIds ?? []).filter(Boolean)));
    if (!orderIds.length) throw new Error("Selecione ao menos um pedido");
    const routeId = input?.routeId?.trim() || null;
    const nova = input?.nova ?? null;
    if (!routeId && !nova) throw new Error("Escolha uma rota existente ou crie uma nova");
    if (nova) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nova.data ?? ""))) {
        throw new Error("Informe a data de previsão de expedição");
      }
      if (!String(nova.nome ?? "").trim()) throw new Error("Informe o nome da rota");
    }
    const routeErpId = input?.routeErpId?.toString().trim() || null;
    const routeCode = input?.routeCode?.trim() || null;
    return { orderIds, routeId, routeErpId, routeCode, nova };
  })
  .handler(async ({ data, context }) => {
    await ensureStaff(context);
    const avisos: string[] = [];

    let routeId = data.routeId;
    let routeDate: string;
    let nomeRota: string;
    let erpRouteId: string | null = null;

    if (routeId) {
      // A sincronização com o ERP recria as rotas pendentes com novo id interno:
      // procura pelo id e, se não achar, pelo número do ERP e pelo código.
      const cols = "id, code, notes, route_date, erp_route_id, driver_name";
      let { data: rota, error } = await centralDb.from("routes").select(cols).eq("id", routeId).maybeSingle();
      if (error) throw error;
      if (!rota && data.routeErpId) {
        const r = await centralDb.from("routes").select(cols).eq("erp_route_id", data.routeErpId)
          .in("status", ["planejada", "em_andamento"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (r.error) throw r.error;
        rota = r.data;
      }
      if (!rota && data.routeCode) {
        const r = await centralDb.from("routes").select(cols).eq("code", data.routeCode)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (r.error) throw r.error;
        rota = r.data;
      }
      if (!rota) {
        throw new Error(
          "Rota não encontrada: ela foi removida ou reorganizada pela sincronização do ERP. A lista de rotas foi atualizada — escolha a rota novamente.",
        );
      }
      routeId = rota.id;
      routeDate = rota.route_date;
      nomeRota = (rota.notes?.startsWith("Rota ") ? rota.notes.slice(5) : rota.code).toUpperCase();
      erpRouteId = rota.erp_route_id ?? null;
    } else {
      const nova = data.nova!;
      routeDate = nova.data;
      nomeRota = nova.nome.trim().toUpperCase();

      // 1) Cria a capa no ERP para obter o ID oficial da rota (falha = aborta).
      erpRouteId = await criarCapaRotaErp({
        data: routeDate,
        nome: nomeRota,
        codResponsavel: nova.codResponsavel,
        nomeResponsavel: nova.nomeResponsavel,
      });

      const code = `${slugRota(nomeRota)}-${routeDate.replace(/-/g, "")}-${Date.now().toString(36)}`;
      const { data: inserida, error } = await centralDb
        .from("routes")
        .insert({
          code,
          route_date: routeDate,
          driver_name: nova.nomeResponsavel?.trim() || null,
          total_freight: 0,
          notes: `Rota ${nomeRota}`,
          erp_route_id: erpRouteId,
          erp_status: "P",
        })
        .select("id")
        .single();
      if (error) throw error;
      routeId = inserida.id;
    }

    // 2) Paradas no app (ignora pedidos já vinculados a esta rota).
    const { data: jaNaRota } = await centralDb
      .from("route_orders")
      .select("order_id, stop_order")
      .eq("route_id", routeId!);
    const existentes = new Set((jaNaRota ?? []).map((r) => String(r.order_id)));
    let proxima = (jaNaRota ?? []).reduce((m, r) => Math.max(m, r.stop_order ?? 0), 0) + 1;

    const novos = data.orderIds.filter((id) => !existentes.has(id));
    if (novos.length) {
      // Cada pedido só pode estar em uma rota: remove o vínculo anterior
      // (ex.: agrupamento "NÃO PLANEJADO") antes de vincular à rota escolhida.
      const { error: delErr } = await centralDb
        .from("route_orders")
        .delete()
        .in("order_id", novos)
        .neq("route_id", routeId!);
      if (delErr) throw delErr;
      const { error } = await centralDb.from("route_orders").insert(
        novos.map((order_id) => ({ route_id: routeId!, order_id, stop_order: proxima++ })),
      );
      if (error) throw error;
    }

    // 3) Atualiza a data prevista e o nome da rota nos pedidos.
    const { error: upErr } = await centralDb
      .from("orders")
      .update({ dt_prev_exp: `${routeDate}T00:00:00+00:00`, nome_rota: nomeRota })
      .in("id", data.orderIds);
    if (upErr) throw upErr;

    // 4) Vincula os pedidos à rota no ERP.
    let vinculadosErp = 0;
    if (!erpRouteId) {
      avisos.push("Rota sem ID do ERP: os pedidos não foram vinculados no ERP.");
    } else {
      const { data: pedidos } = await centralDb
        .from("orders")
        .select("id, erp_id, order_number")
        .in("id", data.orderIds);
      for (const p of pedidos ?? []) {
        const numero = p.erp_id ?? p.order_number;
        if (!numero) continue;
        try {
          await executarErp("insert_rota_pedido", {
            id_rota: Number(erpRouteId),
            pedido: Number(numero),
          });
          vinculadosErp++;
        } catch (e) {
          avisos.push(`Pedido ${numero} não vinculado no ERP: ${descrever(e)}`);
        }
      }
    }

    return {
      routeId: routeId!,
      nomeRota,
      routeDate,
      adicionados: novos.length,
      vinculadosErp,
      avisos: avisos.slice(0, 5),
    };
  });
