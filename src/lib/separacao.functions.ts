import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leitura da separação direto do ERP (GKS.A_SEPPEDIDO + cadastro do separador).
 * Faz duas consultas: concluídos no período do filtro e todos os registros
 * ainda não concluídos (fila + em andamento).
 */

export type SeparacaoRow = {
  cod_pedido: number;
  cod_sep: number | null;
  separador: string | null;
  status: string | null;
  qtd_cx_sep: number | null;
  dt_inc: string | null;
  dt_ini_sep: string | null;
  dt_fim_sep: string | null;
  dt_fim_conf: string | null;
  prioridade: string | null;
};

type Input = { inicio: string; fim: string };

type ErpRow = {
  COD_PEDIDO: number;
  COD_SEP: number | null;
  SEPARADOR: string | null;
  STATUS: string | null;
  QTD_CX_SEP: number | null;
  DT_INC: string | null;
  DT_INI_SEP: string | null;
  DT_FIM_SEP: string | null;
  DT_FIM_CONF: string | null;
  PRIORIDADE: number | string | null;
};

const BASE_SQL = `
  select s.cod_pedido,
         s.cod_sep,
         trim(t.dba_tip_nome_fantasia) separador,
         s.status,
         s.qtd_cx_sep,
         s.dt_inc,
         s.dt_ini_sep,
         s.dt_fim_sep,
         s.dt_fim_conf,
         s.prioridade
    from gks.a_seppedido s,
         gks.a_cadctipo t
   where s.dt_inc >= to_date('20250101','yyyyMMdd')
     and t.dba_tip_codigo_1(+) = s.cod_sep
`;

const TRANSIENT = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

async function consultarErp(sql: string, limit: number): Promise<ErpRow[]> {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("ERP não configurado (ERP_API_BASE_URL/ERP_API_KEY)");
  const url = `${baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "")}/v1/query`;

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql, binds: {}, limit }),
      });
      if (res.ok) {
        const json = (await res.json()) as { rows?: ErpRow[] };
        return json.rows ?? [];
      }
      lastErr = new Error(
        TRANSIENT.has(res.status)
          ? `ERP indisponível no momento (HTTP ${res.status}). Tente novamente em instantes.`
          : `Falha ao consultar o ERP (HTTP ${res.status}).`,
      );
      if (!TRANSIENT.has(res.status) && res.status !== 429) break;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw lastErr ?? new Error("Falha desconhecida ao consultar o ERP");
}

/** Normaliza datas: string vazia ou inválida vira null. */
function dataOuNulo(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return Number.isFinite(new Date(s).getTime()) ? s : null;
}

function mapear(rows: ErpRow[]): SeparacaoRow[] {
  const porPedido = new Map<number, SeparacaoRow>();
  for (const r of rows) {
    const cod = Number(r.COD_PEDIDO);
    if (porPedido.has(cod)) continue; // evita duplicidade do join com o cadastro
    porPedido.set(cod, {
      cod_pedido: cod,
      cod_sep: r.COD_SEP == null ? null : Number(r.COD_SEP),
      separador: r.SEPARADOR ?? null,
      status: r.STATUS ?? null,
      qtd_cx_sep: r.QTD_CX_SEP == null ? null : Number(r.QTD_CX_SEP),
      dt_inc: dataOuNulo(r.DT_INC),
      dt_ini_sep: dataOuNulo(r.DT_INI_SEP),
      dt_fim_sep: dataOuNulo(r.DT_FIM_SEP),
      dt_fim_conf: dataOuNulo(r.DT_FIM_CONF),
      prioridade: r.PRIORIDADE == null ? null : String(r.PRIORIDADE),
    });
  }
  return [...porPedido.values()];
}

/** Converte "2026-09-15T00:00:00" (horário de Brasília) em literal Oracle. */
function literalData(v: string): string {
  const limpo = v.replace(/[^0-9]/g, "").slice(0, 14).padEnd(14, "0");
  return `to_date('${limpo}','yyyyMMddHH24MiSS')`;
}

async function ensureStaff(context: { supabase: any; userId: string }) {
  for (const r of ["adm", "gestor", "operador"] as const) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: r,
    });
    if (data) return;
  }
  throw new Error("Sem permissão para ver a separação");
}

export const carregarSeparacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    await ensureStaff(context as never);

    // O ERP armazena as datas no horário local (Brasília); o filtro vem nesse
    // mesmo fuso, então é comparado diretamente.
    const periodoSql = `${BASE_SQL}
     and s.dt_fim_sep between ${literalData(data.inicio)} and ${literalData(data.fim)}
   order by s.dt_fim_sep desc`;
    const abertosSql = `${BASE_SQL}
     and s.dt_fim_sep is null
   order by s.dt_inc asc`;

    const [periodo, abertos] = await Promise.all([
      consultarErp(periodoSql, 20000),
      consultarErp(abertosSql, 5000),
    ]);

    return { periodo: mapear(periodo), abertos: mapear(abertos) };
  });
