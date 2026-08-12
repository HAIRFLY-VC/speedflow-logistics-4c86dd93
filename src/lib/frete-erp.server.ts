// Integração (stub) com o ERP para lançamento das ordens de pagamento de frete.
// Monta o payload e, quando ERP_API_BASE_URL estiver configurado, envia via HTTP.
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

export async function enviarOrdemParaErp(payload: OrdemPayload): Promise<EnvioResult> {
  const base = process.env["ERP_API_BASE_URL"];
  const key = process.env["ERP_API_KEY"];

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
