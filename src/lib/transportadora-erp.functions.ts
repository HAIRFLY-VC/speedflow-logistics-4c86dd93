import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ErpQueryResponse = { rows?: Record<string, unknown>[] };

const SQL_COD_TRANSPORTADORA = `select t.dba_tip_codigo_1 as cod
  from gks.a_cadctipo t
 where t.dba_tip_cgc_cpf = :cnpj`;

/**
 * Consulta o código da transportadora no ERP Oracle a partir do CNPJ.
 * Retorna `null` quando o ERP não encontra o cadastro.
 */
export const buscarCodErpTransportadora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cnpj: string }) => ({
    cnpj: String(input?.cnpj ?? "").replace(/\D/g, ""),
  }))
  .handler(async ({ data }) => {
    if (!data.cnpj) throw new Error("Informe o CNPJ da transportadora");

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
        body: JSON.stringify({
          sql: SQL_COD_TRANSPORTADORA,
          binds: { cnpj: Number(data.cnpj) },
          limit: 1,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      const json = (await res.json()) as ErpQueryResponse;
      const linha = json.rows?.[0];
      if (!linha) return { codErp: null as string | null };
      const bruto =
        linha["cod"] ?? linha["COD"] ?? linha["dba_tip_codigo_1"] ??
        linha["DBA_TIP_CODIGO_1"] ?? Object.values(linha)[0];
      const codErp =
        bruto == null || String(bruto).trim() === "" ? null : String(bruto).trim();
      return { codErp };
    } finally {
      clearTimeout(timeout);
    }
  });
