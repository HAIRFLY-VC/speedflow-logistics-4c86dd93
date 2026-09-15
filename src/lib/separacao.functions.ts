import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leitura da tabela `separacao` do banco do ERP (esquema `public` do banco
 * central). Só devolve as colunas usadas pelo painel e limita o volume por
 * requisição para não estourar o tempo do servidor.
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

const COLS =
  "cod_pedido,cod_sep,separador,status,qtd_cx_sep,dt_inc,dt_ini_sep,dt_fim_sep,dt_fim_conf,prioridade";
const PAGE = 1000;
const MAX_ROWS = 8000;

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

async function buscar(query: string): Promise<SeparacaoRow[]> {
  const { getCentralRestUrl, getCentralServiceKey } = await import(
    "@/lib/central-rest.server"
  );
  const base = getCentralRestUrl();
  const key = getCentralServiceKey();
  const out: SeparacaoRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const res = await fetch(`${base}/rest/v1/separacao?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Accept-Profile": "public",
        "user-agent": "speedflow-server/1.0",
        Range: `${from}-${from + PAGE - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`Falha ao ler separação (${res.status})`);
    const page = (await res.json()) as SeparacaoRow[];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

export const carregarSeparacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    await ensureStaff(context as never);

    const [periodo, abertos] = await Promise.all([
      // Concluídos dentro do período (pela data de conclusão da separação).
      buscar(
        `select=${COLS}&dt_fim_sep=gte.${data.inicio}&dt_fim_sep=lte.${data.fim}&order=dt_fim_sep.desc`,
      ),
      // Fila e separações em andamento (volume pequeno, sempre completo).
      buscar(`select=${COLS}&dt_fim_sep=is.null&order=dt_inc.asc`),
    ]);

    return { periodo, abertos };
  });
