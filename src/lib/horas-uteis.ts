/**
 * Cálculo de horas dentro do expediente (fuso America/Sao_Paulo).
 *
 * Expediente:
 *  - segunda a quinta: 07:00 às 17:00
 *  - sexta: 07:00 às 16:00
 *  - sábado: 07:00 às 17:00
 *  - domingo: 07:00 às 17:00 somente quando houve movimentação no dia
 *  - almoço descontado todos os dias: 11:30 às 12:30
 *
 * As datas vindas do ERP são horário local de Brasília; por isso o cálculo é
 * feito sobre os componentes "de parede" (ano/mês/dia/hora), sem conversão.
 */

const ALMOCO_INI = 11 * 60 + 30;
const ALMOCO_FIM = 12 * 60 + 30;

/** Data/hora "de parede" em minutos absolutos + a data yyyy-mm-dd. */
type Momento = { dias: number; minutos: number };

const MS_DIA = 86_400_000;

function parse(v: string | null | undefined): Momento | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, d, hh, mi] = m;
    const dias = Date.UTC(Number(y), Number(mo) - 1, Number(d)) / MS_DIA;
    return { dias, minutos: Number(hh) * 60 + Number(mi) };
  }
  const d2 = new Date(s);
  if (!Number.isFinite(d2.getTime())) return null;
  const dias = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) / MS_DIA;
  return { dias, minutos: d2.getHours() * 60 + d2.getMinutes() };
}

function chaveDia(dias: number): string {
  return new Date(dias * MS_DIA).toISOString().slice(0, 10);
}

/** Data yyyy-mm-dd (horário de Brasília) de um timestamp do ERP. */
export function diaDe(v: string | null | undefined): string | null {
  const p = parse(v);
  return p ? chaveDia(p.dias) : null;
}

/** Agora em formato "yyyy-mm-ddTHH:MM:SS" no horário de Brasília. */
export function agoraBrt(): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
  return partes.replace(" ", "T");
}

/** Janela de expediente do dia, em minutos, ou null se não há expediente. */
function janela(dias: number, movimento?: Set<string>): [number, number] | null {
  const dow = new Date(dias * MS_DIA).getUTCDay(); // 0 = domingo, 6 = sábado
  // Sábado e domingo só contam quando houve separação de fato no dia.
  if (dow === 0 || dow === 6) {
    if (!movimento?.has(chaveDia(dias))) return null;
    return [7 * 60, 17 * 60];
  }
  if (dow === 5) return [7 * 60, 16 * 60];
  return [7 * 60, 17 * 60];
}

function sobreposicao(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

/**
 * Horas úteis (decimais) entre dois instantes, respeitando o expediente.
 * Retorna null se alguma ponta faltar ou for inválida.
 */
export function horasUteis(
  inicio: string | null | undefined,
  fim: string | null | undefined,
  movimento?: Set<string>,
): number | null {
  const a = parse(inicio);
  const b = parse(fim);
  if (!a || !b) return null;
  if (b.dias < a.dias || (b.dias === a.dias && b.minutos < a.minutos)) return null;

  let minutos = 0;
  const limite = Math.min(b.dias, a.dias + 370); // trava de segurança
  for (let d = a.dias; d <= limite; d++) {
    const j = janela(d, movimento);
    if (!j) continue;
    const ini = d === a.dias ? Math.max(j[0], a.minutos) : j[0];
    const f = d === b.dias ? Math.min(j[1], b.minutos) : j[1];
    if (f <= ini) continue;
    minutos += f - ini - sobreposicao(ini, f, ALMOCO_INI, ALMOCO_FIM);
  }
  return minutos / 60;
}
