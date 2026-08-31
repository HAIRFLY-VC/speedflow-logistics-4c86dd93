import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SQL_RESPONSIVEIS = `select TRIM(T.DBA_TIP_RAZAO_SOCIAL) RAZAO_SOCIAL, T.DBA_TIP_CODIGO_1 COD_ERP, t.dba_tip_natureza COD_NAT
  from gks.a_cadctipo t
 where t.dba_tip_natureza in ('EM','EF','ET')`;

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

/**
 * Lista transportadoras / fretistas / frota própria do ERP para vincular a uma rota.
 */
export const listarResponsaveisErp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) {
      throw new Error("Integração com o ERP não configurada");
    }
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${cleanBase}/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql: SQL_RESPONSIVEIS, binds: {}, limit: 5000 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      const json = (await res.json()) as ErpQueryResponse;
      const rows = json.rows ?? [];
      const map = new Map<string, ResponsavelErp>();
      for (const r of rows) {
        const razao = String(getField(r, "RAZAO_SOCIAL") ?? "").trim();
        const cod = String(getField(r, "COD_ERP") ?? "").trim();
        const nat = String(getField(r, "COD_NAT") ?? "").toUpperCase().trim();
        if (!razao || !cod) continue;
        const tipoFrete =
          nat === "EF" ? "F" : nat === "ET" ? "T" : "P";
        // Evita duplicatas de código ERP, mantendo a primeira razão social encontrada.
        if (!map.has(cod)) {
          map.set(cod, { razaoSocial: razao, codErp: cod, tipoFrete });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
    } finally {
      clearTimeout(timeout);
    }
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
