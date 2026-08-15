import type { CentralDatabase } from "@/integrations/central/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Integração com o ERP para lançamento das ordens de pagamento de frete.
// Monta o payload e, quando configurado, envia via HTTP. As credenciais do ERP
// são lidas da tabela configuracoes_erp (acesso restrito a administradores).

export type OrdemPayload = {
  ordem_id: string;
  cte_chave: string;
  cte_numero: string | null;
  transportadora: { razao_social: string; cnpj: string; pix: string | null } | null;
  valor_autorizado: number;
  data_emissao: string | null;
  nfs_referenciadas: unknown;
};

export type EnvioResult = {
  ok: boolean;
  referencia_erp?: string;
  erro?: string;
  payload: OrdemPayload;
};

async function getErpConfig(db: SupabaseClient<CentralDatabase>) {
  const { data, error } = await db
    .from("configuracoes_erp")
    .select("url_base, api_key")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    base: (data?.url_base ?? "").trim() || null,
    key: (data?.api_key ?? "").trim() || null,
  };
}

export async function enviarOrdemParaErp(
  db: SupabaseClient<CentralDatabase>,
  payload: OrdemPayload,
): Promise<EnvioResult> {
  const { base, key } = await getErpConfig(db);

  // Sem endpoint configurado: opera em modo simulado (stub).
  if (!base || !key) {
    return {
      ok: true,
      referencia_erp: `SIM-${payload.ordem_id.slice(0, 8).toUpperCase()}`,
      payload,
    };
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/financeiro/ordens-frete`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, erro: `ERP ${res.status}: ${text.slice(0, 300)}`, payload };
    let referencia: string | undefined;
    try {
      const json = JSON.parse(text) as { id?: string; referencia?: string };
      referencia = json.referencia ?? json.id;
    } catch {
      referencia = text.trim().slice(0, 60) || undefined;
    }
    return { ok: true, referencia_erp: referencia, payload };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e), payload };
  }
}
