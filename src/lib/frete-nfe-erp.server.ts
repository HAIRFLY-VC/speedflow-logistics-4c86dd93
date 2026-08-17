// Despesas de frete já contabilizadas no ERP (Oracle) para cada NF-e.
import { centralDb } from "@/lib/central-db";

const SQL_FRETE_NFE = `select g.bordero, g.dt_saida, g.vlr_frete, g.vlr_perna, g.vlr_diaria,
       g.vlr_pernoite, g.vlr_reentrega, g.vlr_descarrego
  from gks.a_gerentregas g
 where g.cod_filial = :filial
   and g.nro_nf = :nf`;

export type FreteContabilizadoNfe = {
  chave: string;
  numero: string;
  bordero: string | null;
  dt_saida: string | null;
  vlr_frete: number;
  vlr_perna: number;
  vlr_diaria: number;
  vlr_pernoite: number;
  vlr_reentrega: number;
  vlr_descarrego: number;
  total: number;
};

type ErpQueryResponse = { rows?: Record<string, unknown>[] };

function pegar(linha: Record<string, unknown>, campo: string): unknown {
  return linha[campo] ?? linha[campo.toUpperCase()] ?? linha[campo.toLowerCase()];
}

function num(valor: unknown): number {
  if (valor == null) return 0;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s ? s : null;
}

/** Número da NF-e (nNF) extraído da chave de acesso de 44 dígitos. */
export function numeroDaChaveNfe(chave: string): string | null {
  const d = chave.replace(/\D/g, "");
  if (d.length !== 44) return null;
  return String(Number(d.slice(25, 34)));
}

async function consultarErp(filial: string, nf: string) {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

  const res = await fetch(`${cleanBase}/v1/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      sql: SQL_FRETE_NFE,
      binds: { filial: Number(filial), nf: Number(nf) },
      limit: 50,
    }),
  });
  if (!res.ok) {
    const t = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
    throw new Error(`ERP API ${res.status}${t ? `: ${t}` : ""}`);
  }
  const json = (await res.json()) as ErpQueryResponse;
  return json.rows ?? [];
}

/**
 * Busca no ERP as despesas de frete lançadas para as NF-es informadas,
 * usando o código da empresa (cod_erp) como filial.
 */
export async function buscarFretesContabilizados(cteId: string, chaves: string[]) {
  const { data: cte, error } = await centralDb
    .from("ctes")
    .select("id, empresa_id")
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const empresaId = (cte as { empresa_id?: string | null } | null)?.empresa_id ?? null;
  if (!empresaId) return { filial: null as string | null, itens: [] as FreteContabilizadoNfe[] };

  const { data: empresa } = await centralDb
    .from("empresas")
    .select("id, cod_erp")
    .eq("id", empresaId)
    .maybeSingle();
  const filial = (empresa as { cod_erp?: string | null } | null)?.cod_erp ?? null;
  if (!filial) return { filial: null as string | null, itens: [] as FreteContabilizadoNfe[] };

  const itens: FreteContabilizadoNfe[] = [];
  for (const chave of chaves.slice(0, 50)) {
    const numero = numeroDaChaveNfe(chave);
    if (!numero) continue;
    let linhas: Record<string, unknown>[] = [];
    try {
      linhas = await consultarErp(filial, numero);
    } catch {
      continue;
    }
    for (const l of linhas) {
      const vlr_frete = num(pegar(l, "vlr_frete"));
      const vlr_perna = num(pegar(l, "vlr_perna"));
      const vlr_diaria = num(pegar(l, "vlr_diaria"));
      const vlr_pernoite = num(pegar(l, "vlr_pernoite"));
      const vlr_reentrega = num(pegar(l, "vlr_reentrega"));
      const vlr_descarrego = num(pegar(l, "vlr_descarrego"));
      itens.push({
        chave: chave.replace(/\D/g, ""),
        numero,
        bordero: texto(pegar(l, "bordero")),
        dt_saida: texto(pegar(l, "dt_saida")),
        vlr_frete,
        vlr_perna,
        vlr_diaria,
        vlr_pernoite,
        vlr_reentrega,
        vlr_descarrego,
        total:
          vlr_frete + vlr_perna + vlr_diaria + vlr_pernoite + vlr_reentrega + vlr_descarrego,
      });
    }
  }

  return { filial, itens };
}
