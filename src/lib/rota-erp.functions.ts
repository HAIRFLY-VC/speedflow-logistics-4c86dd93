import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { centralDb } from "@/lib/central-db";

const SQL_RESPONSIVEIS = `select TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL, T.DBA_TIP_CODIGO_1 COD_ERP, t.dba_tip_natureza COD_NAT
  from gks.a_cadctipo t
 where t.dba_tip_natureza in ('EM','EF','ET')`;

const SQL_CADASTRO_RESPONSAVEIS = `select TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
       TRIM(T.DBA_TIP_CODIGO_1) COD_ERP,
       T.DBA_TIP_NATUREZA COD_NAT
  from gks.a_cadctipo T
 where T.DBA_TIP_CODIGO_1 is not null`;

type ErpQueryResponse = { rows?: Record<string, unknown>[] };

export type ResponsavelErp = {
  razaoSocial: string;
  codErp: string;
  tipoFrete: "P" | "F" | "T";
};

function getField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  const found = Object.entries(row).find(([key]) => key.toUpperCase() === field.toUpperCase());
  return found?.[1];
}

function erpConfig() {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
  return { cleanBase: baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, ""), apiKey };
}

async function consultarErp(sql: string, limit: number, timeoutMs = 30_000) {
  const { cleanBase, apiKey } = erpConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cleanBase}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql, binds: {}, limit }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
    }
    return ((await res.json()) as ErpQueryResponse).rows ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function tipoFreteDaNatureza(natureza: string): "P" | "F" | "T" | null {
  if (natureza === "EF") return "F";
  if (natureza === "ET") return "T";
  if (natureza === "EM") return "P";
  return null;
}

/**
 * Lista transportadoras / fretistas / frota própria do ERP para vincular a uma rota.
 */
export const listarResponsaveisErp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const rows = await consultarErp(SQL_CADASTRO_RESPONSAVEIS, 10000);
    await salvarResponsaveis(rows);
    const map = new Map<string, ResponsavelErp>();
    for (const r of rows) {
      const razao = String(getField(r, "RAZAO_SOCIAL") ?? "").trim();
      const cod = String(getField(r, "COD_ERP") ?? "").trim();
      const nat = String(getField(r, "COD_NAT") ?? "").toUpperCase().trim();
      const tipoFrete = tipoFreteDaNatureza(nat);
      if (!razao || !cod || !tipoFrete || map.has(cod)) continue;
      map.set(cod, { razaoSocial: razao, codErp: cod, tipoFrete });
    }
    return Array.from(map.values()).sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
  });

const SQL_ROTA_RESPONSAVEL = `select R.COD_FRT_TRP COD from gks.a_ger_rotas R where R.ID = :id`;

/**
 * Busca no ERP o código do responsável (COD_FRT_TRP) da rota informada.
 * Usado para pré-selecionar a transportadora/fretista no modal de edição.
 */
export const buscarResponsavelRotaErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { idRota: number }) => {
    const id = Number(input?.idRota ?? NaN);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID da rota no ERP é obrigatório");
    return { idRota: id };
  })
  .handler(async ({ data }) => {
    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${cleanBase}/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql: SQL_ROTA_RESPONSAVEL, binds: { id: data.idRota }, limit: 1 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      const json = (await res.json()) as ErpQueryResponse;
      const linha = json.rows?.[0];
      if (!linha) return { codErp: null as string | null };
      const bruto = getField(linha, "COD");
      const codErp = bruto == null || String(bruto).trim() === "" ? null : String(bruto).trim();
      return { codErp };
    } finally {
      clearTimeout(timeout);
    }
  });

/**
 * Busca no ERP o código do responsável (COD_FRT_TRP) de várias rotas de uma vez.
 */
export const listarResponsaveisDeRotasErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { idsRota: number[] }) => {
    const ids = Array.from(
      new Set((input?.idsRota ?? []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)),
    );
    return { idsRota: ids.slice(0, 1000) };
  })
  .handler(async ({ data }) => {
    const out: Record<string, string> = {};
    if (data.idsRota.length === 0) return out;

    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

    const lista = data.idsRota.join(",");
    const sql = `select R.ID, R.COD_FRT_TRP COD from gks.a_ger_rotas R where R.ID in (${lista})`;

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
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      const json = (await res.json()) as ErpQueryResponse;
      for (const linha of json.rows ?? []) {
        const id = String(getField(linha, "ID") ?? "").trim();
        const cod = String(getField(linha, "COD") ?? "").trim();
        if (id && cod) out[id] = cod;
      }
      return out;
    } finally {
      clearTimeout(timeout);
    }
  });


export type NaturezaErp = {
  codErp: string;
  razaoSocial: string;
  natureza: string;
  tipoFrete: "P" | "F" | "T" | null;
};

/**
 * Busca no ERP a natureza (EF/ET/EM/...) de códigos específicos de responsável,
 * sem filtrar por natureza — usado para identificar o tipo mesmo quando o
 * cadastro está fora da lista padrão de responsáveis.
 */
export const listarNaturezasPorCodigoErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cods: string[] }) => {
    const cods = Array.from(
      new Set(
        (input?.cods ?? [])
          .map((v) => String(v ?? "").trim())
          .filter((v) => v.length > 0 && /^[A-Za-z0-9._-]+$/.test(v)),
      ),
    ).slice(0, 500);
    return { cods };
  })
  .handler(async ({ data }) => {
    const out: Record<string, NaturezaErp> = {};
    if (data.cods.length === 0) return out;

    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

    const lista = data.cods.map((c) => `'${c}'`).join(",");
    const sql = `select T.DBA_TIP_CODIGO_1 COD, TRIM(T.DBA_TIP_RAZAO_SOCIAL) RZ, T.DBA_TIP_NATUREZA NAT
  from gks.a_cadctipo T
 where TRIM(T.DBA_TIP_CODIGO_1) in (${lista})`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${cleanBase}/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql, binds: {}, limit: 1000 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      const json = (await res.json()) as ErpQueryResponse;
      const rows = json.rows ?? [];
      for (const linha of rows) {
        const cod = String(getField(linha, "COD") ?? "").trim();
        if (!cod) continue;
        const nat = String(getField(linha, "NAT") ?? "").toUpperCase().trim();
        out[cod] = {
          codErp: cod,
          razaoSocial: String(getField(linha, "RZ") ?? "").trim(),
          natureza: nat,
          tipoFrete: tipoFreteDaNatureza(nat),
        };
      }
      await salvarResponsaveis(rows);
      return out;
    } finally {
      clearTimeout(timeout);
    }
  });

export async function salvarResponsaveis(rows: Record<string, unknown>[]) {
  const porCodigo = new Map<string, {
    cod_erp: string;
    razao_social: string | null;
    natureza: string;
    tipo_frete: "P" | "F" | "T" | null;
  }>();
  for (const row of rows) {
    const cod = String(getField(row, "COD_ERP") ?? getField(row, "COD") ?? "").trim();
    if (!cod) continue;
    const natureza = String(getField(row, "COD_NAT") ?? getField(row, "NAT") ?? "").trim().toUpperCase();
    if (!porCodigo.has(cod)) {
      porCodigo.set(cod, {
        cod_erp: cod,
        razao_social: String(getField(row, "RAZAO_SOCIAL") ?? getField(row, "RZ") ?? "").trim() || null,
        natureza,
        tipo_frete: tipoFreteDaNatureza(natureza),
      });
    }
  }
  const payload = Array.from(porCodigo.values());
  if (payload.length === 0) return 0;
  const { error } = await centralDb.from("erp_responsaveis").upsert(
    payload.map((item) => ({ ...item, atualizado_em: new Date().toISOString() })),
    { onConflict: "cod_erp" },
  );
  if (error) throw new Error(`Salvar cadastro de responsáveis: ${error.message}`);
  return payload.length;
}

/** Consulta e atualiza o espelho local completo dos responsáveis do ERP. */
export const sincronizarResponsaveisErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const rows = await consultarErp(SQL_CADASTRO_RESPONSAVEIS, 10000);
    const total = await salvarResponsaveis(rows);
    return { total, atualizados: total };
  });

/** Consulta e atualiza apenas os códigos ausentes no espelho local. */
export const sincronizarResponsaveisPorCodigo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cods: string[] }) => ({
    cods: Array.from(new Set((input?.cods ?? []).map((v) => String(v ?? "").trim()).filter(Boolean))).slice(0, 500),
  }))
  .handler(async ({ data }) => {
    if (data.cods.length === 0) return { total: 0, parcial: false };
    let total = 0;
    let parcial = false;
    // Lotes pequenos: a consulta no ERP é lenta e estourava o timeout (AbortError).
    for (let i = 0; i < data.cods.length; i += 50) {
      const lote = data.cods.slice(i, i + 50);
      const lista = lote.map((cod) => `'${cod.replace(/'/g, "''")}'`).join(",");
      try {
        const rows = await consultarErp(
          `select T.DBA_TIP_CODIGO_1 COD_ERP, TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL,
              T.DBA_TIP_NATUREZA COD_NAT
         from gks.a_cadctipo T
        where TRIM(T.DBA_TIP_CODIGO_1) in (${lista})`,
          1000,
          60_000,
        );
        total += await salvarResponsaveis(rows);
      } catch (error) {
        // Sincronização em segundo plano: não derrubar a tela por falha/timeout do ERP.
        parcial = true;
        console.error("sincronizarResponsaveisPorCodigo", error);
      }
    }
    return { total, parcial };
  });

type AtualizarCapaRotaInput = {
  id: number;
  dtPrevExpYyyyMMdd: string | null;
  nomeRota: string;
  nomeMotorista: string | null;
  codFrtTrp: string | null;
  status: string;
};

/**
 * Atualiza a capa da rota no ERP Oracle via procedure exposta em /v1/execute/update_capa_rota.
 */
export const atualizarCapaRotaErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AtualizarCapaRotaInput) => {
    const id = Number(input?.id ?? NaN);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID da rota no ERP é obrigatório");
    const nome = String(input?.nomeRota ?? "").trim();
    if (!nome) throw new Error("Nome da rota é obrigatório");
    return {
      id,
      dtPrevExpYyyyMMdd: input?.dtPrevExpYyyyMMdd ?? null,
      nomeRota: nome.toUpperCase(),
      nomeMotorista: input?.nomeMotorista?.trim() || null,
      codFrtTrp: input?.codFrtTrp?.trim() || null,
      status: String(input?.status ?? "P").trim().toUpperCase() || "P",
    };
  })
  .handler(async ({ data }) => {
    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) {
      throw new Error("Integração com o ERP não configurada");
    }
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/(query|execute)$/, "");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${cleanBase}/v1/execute/update_capa_rota`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          binds: {
            id: data.id,
            dt_prev_exp_yyyyMMdd: data.dtPrevExpYyyyMMdd,
            nome_rota: data.nomeRota,
            nome_motorista: data.nomeMotorista,
            cod_frt_trp: data.codFrtTrp,
            status: data.status,
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 300);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      return { ok: true as const };
    } finally {
      clearTimeout(timeout);
    }
  });
