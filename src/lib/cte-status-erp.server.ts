// Status de cada CT-e: contabilizado nos valores de frete (aprovação interna)
// e lançado no financeiro do ERP Oracle (consulta em gks.a_pagctitu).
import { centralDb } from "@/lib/central-db";

import type { StatusErpCte } from "@/lib/cte-status-erp.types";
export type { StatusErpCte };

const AGENDA_FIXA = 110;

type Linha = Record<string, unknown>;

function pegar(l: Linha, campo: string): unknown {
  return l[campo] ?? l[campo.toUpperCase()] ?? l[campo.toLowerCase()];
}

async function consultarFinanceiro(
  cnpjs: number[],
  numeros: number[],
): Promise<Linha[]> {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

  // Listas somente numéricas (validadas antes) — o driver não aceita bind de array.
  const sql = `select p.dba_cpd_cgc_cpf CNPJ,
       p.dba_cpd_ntfis NUMERO,
       to_char(to_date(p.dba_cpm_venc,'yyyyMMdd'),'YYYY-MM-DD') DT_VENCIMENTO,
       p.dba_cpd_vrnota VLR_NOTA
  from gks.a_pagctitu p
 where p.dba_cpd_agenda = ${AGENDA_FIXA}
   and p.dba_cpd_cgc_cpf in (${cnpjs.join(",")})
   and p.dba_cpd_ntfis in (${numeros.join(",")})`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${cleanBase}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql, binds: {}, limit: 5000 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(`ERP API ${res.status}${t ? `: ${t}` : ""}`);
    }
    const json = (await res.json()) as { rows?: Linha[] };
    return json.rows ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function statusErpCtes(cteIds: string[]): Promise<StatusErpCte[]> {
  if (cteIds.length === 0) return [];

  const { data: ctes, error } = await centralDb
    .from("ctes")
    .select("id, numero, transportadora_id, cnpj_emitente")
    .in("id", cteIds);
  if (error) throw new Error(error.message);

  const linhasCte = (ctes ?? []) as {
    id: string;
    numero: string | null;
    transportadora_id: string | null;
    cnpj_emitente: string | null;
  }[];

  // Aprovação interna (última ordem de pagamento por CT-e).
  const { data: ordens } = await centralDb
    .from("ordens_pagamento_frete")
    .select("cte_id, aprovacao_status, created_at")
    .in("cte_id", cteIds)
    .order("created_at", { ascending: false });
  const aprovacao = new Map<string, "PENDENTE" | "APROVADO" | "REPROVADO">();
  for (const o of (ordens ?? []) as {
    cte_id: string;
    aprovacao_status: "PENDENTE" | "APROVADO" | "REPROVADO";
  }[]) {
    if (!aprovacao.has(o.cte_id)) aprovacao.set(o.cte_id, o.aprovacao_status);
  }

  // CNPJ da transportadora cadastrada (fallback: emitente do CT-e).
  const transpIds = [
    ...new Set(linhasCte.map((c) => c.transportadora_id).filter(Boolean) as string[]),
  ];
  const cnpjTransp = new Map<string, string>();
  if (transpIds.length > 0) {
    const { data: transps } = await centralDb
      .from("transportadoras")
      .select("id, cnpj")
      .in("id", transpIds);
    for (const t of (transps ?? []) as { id: string; cnpj: string | null }[]) {
      if (t.cnpj) cnpjTransp.set(t.id, t.cnpj.replace(/\D/g, ""));
    }
  }

  type Chave = { cnpj: string; numero: string };
  const chaves = new Map<string, Chave>();
  for (const c of linhasCte) {
    const cnpj =
      (c.transportadora_id ? cnpjTransp.get(c.transportadora_id) : null) ??
      (c.cnpj_emitente ?? "").replace(/\D/g, "");
    const numero = String(c.numero ?? "").replace(/\D/g, "");
    if (cnpj && numero) chaves.set(c.id, { cnpj, numero });
  }

  const cnpjs = [...new Set([...chaves.values()].map((k) => Number(k.cnpj)))].filter(
    (n) => Number.isSafeInteger(n) && n > 0,
  );
  const numeros = [...new Set([...chaves.values()].map((k) => Number(k.numero)))].filter(
    (n) => Number.isSafeInteger(n) && n > 0,
  );

  let encontrados: Map<string, { vencimento: string | null; valor: number | null }> | null =
    null;
  if (cnpjs.length > 0 && numeros.length > 0) {
    try {
      const rows = await consultarFinanceiro(cnpjs, numeros);
      encontrados = new Map();
      for (const r of rows) {
        const cnpj = String(pegar(r, "cnpj") ?? "").replace(/\D/g, "");
        const numero = String(Number(pegar(r, "numero") ?? 0));
        const venc = pegar(r, "dt_vencimento");
        const valor = Number(pegar(r, "vlr_nota") ?? 0);
        encontrados.set(`${Number(cnpj)}|${numero}`, {
          vencimento: venc == null ? null : String(venc).slice(0, 10),
          valor: Number.isFinite(valor) ? valor : null,
        });
      }
    } catch {
      encontrados = null;
    }
  }

  // Ajustes manuais feitos por administradores (não disparam fluxo no n8n).
  const { data: overrides } = await centralDb
    .from("cte_status_override")
    .select("cte_id, valores, financeiro")
    .in("cte_id", cteIds);
  const manual = new Map(
    ((overrides ?? []) as {
      cte_id: string;
      valores: "PENDENTE" | "APROVADO" | "REPROVADO" | null;
      financeiro: boolean | null;
    }[]).map((o) => [o.cte_id, o]),
  );

  return linhasCte.map((c) => {
    const k = chaves.get(c.id);
    let financeiro: boolean | null = null;
    let vencimento: string | null = null;
    let valor: number | null = null;
    if (encontrados && k) {
      const achado = encontrados.get(`${Number(k.cnpj)}|${Number(k.numero)}`);
      financeiro = Boolean(achado);
      vencimento = achado?.vencimento ?? null;
      valor = achado?.valor ?? null;
    }
    const ov = manual.get(c.id);
    return {
      cteId: c.id,
      contabilizado: ov?.valores ?? aprovacao.get(c.id) ?? "PENDENTE",
      financeiro: ov?.financeiro ?? financeiro,
      vencimento,
      valor,
      contabilizadoManual: ov?.valores != null,
      financeiroManual: ov?.financeiro != null,
    };
  });
}
