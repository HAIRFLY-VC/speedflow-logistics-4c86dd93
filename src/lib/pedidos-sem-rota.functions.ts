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

/** Reserva o próximo número de rota na sequência do ERP. */
async function proximoIdRotaErp(): Promise<string> {
  const { cleanBase, apiKey } = erpConfig();
  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql: "select gks.SEQ_ROTA_ID.nextval from dual", binds: {}, limit: 1 }),
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`ERP API ${res.status}: ${texto.replace(/\s+/g, " ").slice(0, 240)}`);
  let linha: Record<string, unknown> | undefined;
  try {
    linha = (JSON.parse(texto) as { rows?: Record<string, unknown>[] }).rows?.[0];
  } catch {
    linha = undefined;
  }
  const chave = linha ? Object.keys(linha).find((k) => k.toLowerCase() === "nextval") ?? Object.keys(linha)[0] : undefined;
  const valor = chave ? String(linha![chave] ?? "").trim() : "";
  if (!/^\d+$/.test(valor)) throw new Error("O ERP não devolveu um novo número de rota.");
  return valor;
}

/** Reserva o ID na sequência do ERP, grava a capa (insert_ger_rota) e devolve o ID. */
async function criarCapaRotaErp(nova: NovaRota): Promise<string> {
  const cod = nova.codResponsavel?.toString().trim();
  const codNum = cod && /^\d+$/.test(cod) ? Number(cod) : null;
  let idRota: string;
  let resposta: Record<string, unknown>;
  try {
    idRota = await proximoIdRotaErp();
    resposta = await executarErp("insert_ger_rota", {
      id: idRota,
      dt_prev_exp_yyyyMMdd: nova.data.replace(/-/g, ""),
      nome_rota: nova.nome.trim().toUpperCase(),
      nome_motorista: nova.nomeResponsavel?.trim().toUpperCase() || null,
      cod_frt_trp: codNum,
      status: "P",
    });
  } catch (e) {
    throw new Error(`Rota não foi criada no ERP: ${descrever(e)}`);
  }
  const linhas = Number(resposta?.["rowsAffected"] ?? 0);
  if (!(linhas >= 1)) {
    throw new Error(`O ERP não confirmou a gravação da rota ${idRota}. Confira no ERP antes de tentar de novo.`);
  }
  return idRota;
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

    // 2) Pedidos já vinculados a esta rota no app são ignorados.
    const { data: jaNaRota } = await centralDb
      .from("route_orders")
      .select("order_id, stop_order")
      .eq("route_id", routeId!);
    const existentes = new Set((jaNaRota ?? []).map((r) => String(r.order_id)));
    let proxima = (jaNaRota ?? []).reduce((m, r) => Math.max(m, r.stop_order ?? 0), 0) + 1;
    const candidatos = data.orderIds.filter((id) => !existentes.has(id));

    // 3) Inclui cada pedido no ERP primeiro (insert_pedido_na_rota); só os aceitos seguem.
    let vinculadosErp = 0;
    let falhasErp = 0;
    let aceitos: string[] = [];
    if (!erpRouteId) {
      avisos.push("Rota sem ID do ERP: os pedidos não foram incluídos no ERP.");
    } else if (candidatos.length) {
      const { data: pedidos, error: pErr } = await centralDb
        .from("orders")
        .select("id, erp_id, order_number")
        .in("id", candidatos);
      if (pErr) throw pErr;
      for (const p of pedidos ?? []) {
        const numero = p.erp_id ?? p.order_number;
        if (!numero) {
          falhasErp++;
          avisos.push(`Pedido ${p.id} sem código no ERP: não incluído.`);
          continue;
        }
        try {
          const resp = await executarErp("insert_pedido_na_rota", {
            idrota: Number(erpRouteId),
            codpedido: Number(numero),
          });
          if (Number(resp?.["rowsAffected"] ?? 0) < 1) throw new Error("ERP não confirmou a gravação");
          aceitos.push(String(p.id));
          vinculadosErp++;
        } catch (e) {
          falhasErp++;
          avisos.push(`Pedido ${numero} não incluído no ERP: ${descrever(e)}`);
        }
      }
      if (!aceitos.length) avisos.push("Nenhum pedido foi aceito pelo ERP; a rota foi criada sem pedidos.");
    }

    // 4) Vincula no app somente os pedidos aceitos pelo ERP.
    const novos = aceitos;
    if (novos.length) {
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
      const { error: upErr } = await centralDb
        .from("orders")
        .update({ dt_prev_exp: `${routeDate}T00:00:00+00:00`, nome_rota: nomeRota })
        .in("id", novos);
      if (upErr) throw upErr;
    }


    return {
      routeId: routeId!,
      nomeRota,
      routeDate,
      adicionados: novos.length,
      vinculadosErp,
      falhasErp,
      avisos: avisos.slice(0, 5),
    };
  });
