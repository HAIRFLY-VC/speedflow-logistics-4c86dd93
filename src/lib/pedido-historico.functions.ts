import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SQL = `select l.dta_entrada,l.status,l.usu_entrada,l.obs from gks.a_logstatusped l where l.id=:codpedido order by l.dta_entrada`;

export type HistoricoStatusLinha = {
  dta_entrada: string | null;
  status: string | null;
  usu_entrada: string | null;
  obs: string | null;
};

function campo(l: Record<string, unknown>, nome: string): string | null {
  const v = l[nome] ?? l[nome.toUpperCase()];
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export const historicoStatusPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { codPedido: string }) =>
    z.object({ codPedido: z.string().trim().regex(/^\d+$/, "Código de pedido inválido") }).parse(input),
  )
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
        body: JSON.stringify({ sql: SQL, binds: { codpedido: Number(data.codPedido) }, limit: 1000 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const t = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`ERP API ${res.status}${t ? `: ${t}` : ""}`);
      }
      const json = (await res.json()) as { rows?: Record<string, unknown>[] };
      return (json.rows ?? []).map<HistoricoStatusLinha>((l) => ({
        dta_entrada: campo(l, "dta_entrada"),
        status: campo(l, "status"),
        usu_entrada: campo(l, "usu_entrada"),
        obs: campo(l, "obs"),
      }));
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error("O ERP demorou para responder. Tente de novo.");
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  });
