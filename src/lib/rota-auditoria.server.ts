// Auditoria de "rota completa" para a autorização de pagamento de frete.
// Confere no ERP se todos os pedidos da rota (GKS.A_GER_ROTAS_PEDIDOS) têm nota
// expedida e em aberto (GKS.A_GERENTREGAS) e importa para o app o que faltar.
import { centralDb } from "@/lib/central-db";

export type PedidoFaltante = { pedido: string; motivo: string };
export type AuditoriaRota = {
  route_id: string;
  erp_route_id: string | null;
  total: number;
  completos: number;
  completa: boolean;
  importados: number;
  faltantes: PedidoFaltante[];
  erro?: string;
};

type Row = Record<string, unknown>;

function campo(row: Row, nome: string): unknown {
  if (nome in row) return row[nome];
  return Object.entries(row).find(([k]) => k.toUpperCase() === nome)?.[1];
}
function txt(row: Row, nome: string): string | null {
  const v = campo(row, nome);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(row: Row, nome: string): number {
  const v = campo(row, nome);
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? n : 0;
}
function data(row: Row, nome: string): string | null {
  const v = txt(row, nome);
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function erp(sql: string, limit = 5000): Promise<Row[]> {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
  const base = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
  const res = await fetch(`${base}/v1/query`, {
    method: "POST",
    signal: AbortSignal.timeout(25_000),
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ sql, binds: {}, limit }),
  });
  if (!res.ok) {
    const t = (await res.text()).replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`ERP indisponível (${res.status})${t ? `: ${t}` : ""}`);
  }
  return ((await res.json()) as { rows?: Row[] }).rows ?? [];
}

const lista = (vals: string[]) => vals.map((v) => `'${v.replace(/'/g, "")}'`).join(",");

// Mesma regra do detalhamento do pagamento: pedido com NF emitida e borderô.
function motivoDe(g: Row | undefined): string {
  if (!g) return "Não encontrado";
  if (!txt(g, "NRO_NF")) return "Sem nota fiscal emitida";
  if (!txt(g, "BORDERO")) return "Sem borderô";
  return "Não encontrado";
}

/**
 * Audita as rotas do app (ids) e importa os dados faltantes. Nunca lança por
 * falha do ERP: devolve `erro` por rota para a tela bloquear a confirmação.
 */
export async function auditarEImportarRotas(routeIds: string[]): Promise<AuditoriaRota[]> {
  if (routeIds.length === 0) return [];
  const { data: rotas, error } = await centralDb
    .from("routes")
    .select("id, erp_route_id")
    .in("id", routeIds);
  if (error) throw new Error(error.message);

  const resultado = new Map<string, AuditoriaRota>();
  const erpParaApp = new Map<string, string>();
  for (const r of rotas ?? []) {
    const erpId = r.erp_route_id ? String(r.erp_route_id).trim() : null;
    const base: AuditoriaRota = {
      route_id: r.id as string,
      erp_route_id: erpId,
      total: 0,
      completos: 0,
      completa: false,
      importados: 0,
      faltantes: [],
    };
    if (erpId && /^\d+$/.test(erpId)) erpParaApp.set(erpId, r.id as string);
    else base.erro = "Rota sem vínculo com o ERP";
    resultado.set(r.id as string, base);
  }
  const erpIds = Array.from(erpParaApp.keys());
  if (erpIds.length === 0) return Array.from(resultado.values());

  try {
    const inRotas = erpIds.join(",");
    const [pedidosRota, validos] = await Promise.all([
      erp(`SELECT P.ID, P.PEDIDO FROM GKS.A_GER_ROTAS_PEDIDOS P WHERE P.ID IN (${inRotas})`),
      erp(`SELECT G.NRO_NF, G.COD_PEDIDO, G.COD_CLIENTE, G.COD_VENDEDOR, G.COD_FILIAL,
       G.COD_AGENDA, G.BORDERO, G.DT_PEDIDO, G.DT_FATUR, G.DT_SAIDA,
       G.DT_ENTREGA_CLI, G.DT_AGENDAMENTO, G.ENTREGA_AGEND,
       G.COD_TRANSP_ENT, G.TIPO_TRANSP_ENT, G.PLACA_VEICULO_ENT,
       G.VALOR, G.PESO, G.TIPOS_OCORRENCIA, G.STATUS,
       R.DT_PREV_EXP DT_PREV_EXP, R.NOME_ROTA, R.COD_FRT_TRP, R.NOME_MOTORISTA,
       R.ID AS ID_ROTA, R.STATUS AS ROTA_STATUS
  FROM GKS.A_GER_ROTAS R, GKS.A_GER_ROTAS_PEDIDOS P, GKS.A_GERENTREGAS G
 WHERE R.ID IN (${inRotas})
   AND P.ID = R.ID
   AND G.COD_PEDIDO = P.PEDIDO
   AND G.NRO_NF IS NOT NULL
   AND TRIM(G.BORDERO) IS NOT NULL`),
    ]);

    // Pedidos esperados por rota (ERP)
    const esperados = new Map<string, Set<string>>();
    for (const p of pedidosRota) {
      const id = txt(p, "ID");
      const ped = txt(p, "PEDIDO");
      if (!id || !ped) continue;
      if (!esperados.has(id)) esperados.set(id, new Set());
      esperados.get(id)!.add(ped);
    }
    const validosPorRota = new Map<string, Row[]>();
    for (const v of validos) {
      const id = txt(v, "ID_ROTA");
      if (!id) continue;
      if (!validosPorRota.has(id)) validosPorRota.set(id, []);
      validosPorRota.get(id)!.push(v);
    }

    // Motivo dos pedidos sem nota válida
    const semValido: string[] = [];
    for (const [id, peds] of esperados) {
      const ok = new Set((validosPorRota.get(id) ?? []).map((v) => txt(v, "COD_PEDIDO")));
      for (const p of peds) if (!ok.has(p)) semValido.push(p);
    }
    const detalhe = new Map<string, Row>();
    if (semValido.length > 0) {
      const rows = await erp(
        `SELECT G.COD_PEDIDO, G.NRO_NF, G.BORDERO, G.STATUS
           FROM GKS.A_GERENTREGAS G WHERE G.COD_PEDIDO IN (${lista(semValido)})`,
      );
      for (const r of rows) {
        const c = txt(r, "COD_PEDIDO");
        if (c && (!detalhe.has(c) || (txt(r, "NRO_NF") && !txt(detalhe.get(c)!, "NRO_NF")))) detalhe.set(c, r);
      }
    }

    // ---- Importação dos dados faltantes no app ----
    const todosValidos = validos.filter((v) => txt(v, "COD_PEDIDO") && txt(v, "NRO_NF"));
    const importadosPorRota = new Map<string, number>();
    if (todosValidos.length > 0) {
      const agora = new Date().toISOString();
      // 1) Espelho de entregas (NF, borderô, filial, valor)
      const entregas = todosValidos.map((v) => ({
        nro_nf: txt(v, "NRO_NF")!,
        cod_pedido: txt(v, "COD_PEDIDO")!,
        cod_cliente: txt(v, "COD_CLIENTE"),
        cod_vendedor: txt(v, "COD_VENDEDOR"),
        cod_filial: txt(v, "COD_FILIAL"),
        cod_agenda: txt(v, "COD_AGENDA"),
        bordero: txt(v, "BORDERO"),
        dt_pedido: data(v, "DT_PEDIDO"),
        dt_fatur: data(v, "DT_FATUR"),
        dt_saida: data(v, "DT_SAIDA"),
        dt_entrega_cli: data(v, "DT_ENTREGA_CLI"),
        dt_agendamento: data(v, "DT_AGENDAMENTO"),
        entrega_agend: txt(v, "ENTREGA_AGEND"),
        cod_transp_ent: txt(v, "COD_TRANSP_ENT"),
        tipo_transp_ent: txt(v, "TIPO_TRANSP_ENT"),
        placa_veiculo_ent: txt(v, "PLACA_VEICULO_ENT"),
        valor: num(v, "VALOR"),
        peso: num(v, "PESO"),
        tipos_ocorrencia: txt(v, "TIPOS_OCORRENCIA"),
        status: txt(v, "STATUS"),
        atualizado_em: agora,
      }));
      // O ERP pode repetir a mesma NF/pedido (uma linha por ocorrência):
      // junta em uma só linha para não gravar a mesma chave duas vezes.
      const unicas = new Map<string, (typeof entregas)[number]>();
      for (const e of entregas) {
        const k = `${e.nro_nf}|${e.cod_pedido}`;
        const prev = unicas.get(k);
        if (prev) {
          const oc = new Set(
            [prev.tipos_ocorrencia, e.tipos_ocorrencia]
              .flatMap((t) => (t ?? "").split(","))
              .map((t) => t.trim())
              .filter(Boolean),
          );
          unicas.set(k, { ...e, tipos_ocorrencia: oc.size ? Array.from(oc).join(", ") : null });
        } else unicas.set(k, e);
      }
      const { error: eErr } = await centralDb
        .from("entregas_abertas")
        .upsert(Array.from(unicas.values()) as never, { onConflict: "nro_nf,cod_pedido" });
      if (eErr) throw new Error(`Gravar notas: ${eErr.message}`);

      // 2) Pedidos: agrega por pedido (pode ter mais de uma NF)
      const porPedido = new Map<string, { row: Row; valor: number; peso: number }>();
      const vistos = new Set<string>();
      for (const v of todosValidos) {
        const c = txt(v, "COD_PEDIDO")!;
        const chave = `${txt(v, "NRO_NF")}|${c}`;
        if (vistos.has(chave)) continue; // não soma valor/peso em dobro
        vistos.add(chave);
        const a = porPedido.get(c);
        if (a) {
          a.valor += num(v, "VALOR");
          a.peso += num(v, "PESO");
        } else porPedido.set(c, { row: v, valor: num(v, "VALOR"), peso: num(v, "PESO") });
      }
      const cods = Array.from(porPedido.keys());
      const { data: existentes, error: oErr } = await centralDb
        .from("orders")
        .select("id, erp_id, bordero, cod_filial")
        .in("erp_id", cods);
      if (oErr) throw new Error(oErr.message);
      const idPorPedido = new Map<string, string>();
      for (const o of existentes ?? []) idPorPedido.set(String(o.erp_id), o.id as string);

      const novos = cods
        .filter((c) => !idPorPedido.has(c))
        .map((c) => {
          const { row, valor, peso } = porPedido.get(c)!;
          const dtPrev = txt(row, "DT_PREV_EXP");
          return {
            order_number: c,
            erp_id: c,
            erp_cod_cliente: txt(row, "COD_CLIENTE"),
            total_amount: valor,
            weight: peso,
            cod_filial: txt(row, "COD_FILIAL"),
            bordero: txt(row, "BORDERO"),
            nome_rota: txt(row, "NOME_ROTA"),
            nome_motorista: txt(row, "NOME_MOTORISTA"),
            dt_prev_exp: dtPrev && !isNaN(new Date(dtPrev).getTime()) ? new Date(dtPrev).toISOString() : null,
            notes: "Importado pela auditoria de rota completa",
          };
        });
      if (novos.length > 0) {
        const { data: ins, error: iErr } = await centralDb
          .from("orders")
          .upsert(novos as never, { onConflict: "erp_id" })
          .select("id, erp_id");
        if (iErr) throw new Error(`Importar pedidos: ${iErr.message}`);
        for (const o of ins ?? []) idPorPedido.set(String(o.erp_id), o.id as string);
      }
      // Completa borderô/filial ausentes nos pedidos existentes
      for (const o of existentes ?? []) {
        const r = porPedido.get(String(o.erp_id))?.row;
        if (!r) continue;
        const patch: Record<string, string> = {};
        if (!o.bordero && txt(r, "BORDERO")) patch["bordero"] = txt(r, "BORDERO")!;
        if (!o.cod_filial && txt(r, "COD_FILIAL")) patch["cod_filial"] = txt(r, "COD_FILIAL")!;
        if (Object.keys(patch).length > 0)
          await centralDb.from("orders").update(patch as never).eq("id", o.id as string);
      }

      // 3) Vínculo pedido↔rota
      const orderIds = Array.from(idPorPedido.values());
      const { data: vinculos, error: vErr } = await centralDb
        .from("route_orders")
        .select("order_id, route_id")
        .in("order_id", orderIds);
      if (vErr) throw new Error(vErr.message);
      const rotaDoPedido = new Map((vinculos ?? []).map((v) => [v.order_id as string, v.route_id as string]));
      const { data: paradas } = await centralDb
        .from("route_orders")
        .select("route_id, stop_order")
        .in("route_id", Array.from(erpParaApp.values()));
      const maxParada = new Map<string, number>();
      for (const p of paradas ?? [])
        maxParada.set(p.route_id as string, Math.max(maxParada.get(p.route_id as string) ?? 0, Number(p.stop_order)));

      const mover: { route_id: string; order_id: string; stop_order: number }[] = [];
      for (const v of todosValidos) {
        const appRoute = erpParaApp.get(txt(v, "ID_ROTA") ?? "");
        const orderId = idPorPedido.get(txt(v, "COD_PEDIDO")!);
        if (!appRoute || !orderId || rotaDoPedido.get(orderId) === appRoute) continue;
        if (mover.some((m) => m.order_id === orderId)) continue;
        const prox = (maxParada.get(appRoute) ?? 0) + 1;
        maxParada.set(appRoute, prox);
        mover.push({ route_id: appRoute, order_id: orderId, stop_order: prox });
        importadosPorRota.set(appRoute, (importadosPorRota.get(appRoute) ?? 0) + 1);
      }
      if (mover.length > 0) {
        const ids = mover.map((m) => m.order_id);
        const { error: dErr } = await centralDb.from("route_orders").delete().in("order_id", ids);
        if (dErr) throw new Error(dErr.message);
        const { error: lErr } = await centralDb.from("route_orders").insert(mover as never);
        if (lErr) throw new Error(`Vincular pedidos: ${lErr.message}`);
      }
      // Pedidos novos contam como importados mesmo que o vínculo já existisse
      for (const n of novos) {
        const r = todosValidos.find((v) => txt(v, "COD_PEDIDO") === n.erp_id);
        const appRoute = erpParaApp.get(txt(r ?? {}, "ID_ROTA") ?? "");
        if (appRoute && !mover.some((m) => m.order_id === idPorPedido.get(n.erp_id)))
          importadosPorRota.set(appRoute, (importadosPorRota.get(appRoute) ?? 0) + 1);
      }
    }

    // ---- Resultado por rota ----
    for (const [erpId, appId] of erpParaApp) {
      const res = resultado.get(appId)!;
      const peds = esperados.get(erpId) ?? new Set<string>();
      const ok = new Set(
        (validosPorRota.get(erpId) ?? []).map((v) => txt(v, "COD_PEDIDO")).filter(Boolean) as string[],
      );
      res.total = peds.size;
      res.completos = Array.from(peds).filter((p) => ok.has(p)).length;
      res.faltantes = Array.from(peds)
        .filter((p) => !ok.has(p))
        .map((p) => ({ pedido: p, motivo: motivoDe(detalhe.get(p)) }));
      res.importados = importadosPorRota.get(appId) ?? 0;
      res.completa = res.total > 0 && res.faltantes.length === 0;
      if (res.total === 0) res.erro = "Rota sem pedidos no ERP";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    for (const appId of erpParaApp.values()) {
      const r = resultado.get(appId)!;
      r.erro = `Auditoria indisponível: ${msg}`;
      r.completa = false;
    }
  }
  return Array.from(resultado.values());
}
