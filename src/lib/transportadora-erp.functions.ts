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

const SQL_TRANSPORTADORAS_ERP = `select TRIM(t.dba_tip_codigo_1) COD, TRIM(t.dba_tip_razao_social) RAZAO, t.dba_tip_cgc_cpf CNPJ
  from gks.a_cadctipo t
 where TRIM(t.dba_tip_natureza) = 'ET'`;

/**
 * Cria no cadastro do app as transportadoras (natureza ET) do ERP que ainda
 * não existem (por código ERP) e atualiza a razão social das existentes.
 * Não sobrescreve CNPJ, dados bancários ou tabela de frete.
 */
export const importarTransportadorasErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const baseUrl = process.env["ERP_API_BASE_URL"];
    const apiKey = process.env["ERP_API_KEY"];
    if (!baseUrl || !apiKey) throw new Error("Integração com o ERP não configurada");
    const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let rows: Record<string, unknown>[] = [];
    try {
      const res = await fetch(`${cleanBase}/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ sql: SQL_TRANSPORTADORAS_ERP, limit: 5000 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
      }
      rows = ((await res.json()) as ErpQueryResponse).rows ?? [];
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("ERP não respondeu a tempo");
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    const { centralDb } = await import("./central-db");
    const { data: existentes, error } = await centralDb
      .from("transportadoras")
      .select("id, cod_erp, cnpj, razao_social");
    if (error) throw new Error(error.message);
    const porCod = new Map((existentes ?? []).filter((t) => t.cod_erp).map((t) => [String(t.cod_erp).trim(), t]));
    const porCnpj = new Map((existentes ?? []).map((t) => [String(t.cnpj ?? "").replace(/\D/g, ""), t]));

    let criadas = 0;
    let atualizadas = 0;
    const semCnpj: string[] = [];
    for (const r of rows) {
      const cod = String(r["COD"] ?? r["cod"] ?? "").trim();
      const razao = String(r["RAZAO"] ?? r["razao"] ?? "").trim();
      const cnpjBruto = String(r["CNPJ"] ?? r["cnpj"] ?? "").replace(/\D/g, "");
      if (!cod || !razao) continue;
      const cnpj = cnpjBruto && Number(cnpjBruto) > 0 ? cnpjBruto.padStart(cnpjBruto.length > 11 ? 14 : 11, "0") : "";
      const atual = porCod.get(cod) ?? (cnpj ? porCnpj.get(cnpj) : undefined);
      if (atual) {
        const patch: Record<string, unknown> = {};
        if (atual.razao_social !== razao) patch["razao_social"] = razao;
        if (!atual.cod_erp) patch["cod_erp"] = cod;
        if (Object.keys(patch).length > 0) {
          await centralDb.from("transportadoras").update(patch as never).eq("id", atual.id);
          atualizadas++;
        }
        continue;
      }
      if (!cnpj) {
        semCnpj.push(`${razao} (${cod})`);
        continue;
      }
      const { error: insErr } = await centralDb
        .from("transportadoras")
        .insert({ razao_social: razao, cnpj, cod_erp: cod, ativo: true } as never);
      if (insErr) semCnpj.push(`${razao} (${cod}): ${insErr.message}`);
      else criadas++;
    }
    return { criadas, atualizadas, ignoradas: semCnpj };
  });
