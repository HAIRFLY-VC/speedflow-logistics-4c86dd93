import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ConsultaCnpj = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  logradouro: string | null;
};

/** Consulta os dados cadastrais do CNPJ na base pública da Receita/SEFAZ. */
export const consultarCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cnpj: string }) => ({
    cnpj: String(data?.cnpj ?? "").replace(/\D/g, ""),
  }))
  .handler(async ({ data }): Promise<ConsultaCnpj> => {
    if (data.cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos");

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${data.cnpj}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado na base da Receita");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Falha na consulta do CNPJ [${res.status}]: ${body.slice(0, 200)}`);
    }
    const j = (await res.json()) as Record<string, unknown>;

    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const razao = str(j["razao_social"]) ?? str(j["nome_fantasia"]);
    if (!razao) throw new Error("A Receita não retornou a razão social deste CNPJ");

    const numero = str(j["numero"]);
    const logradouro = str(j["logradouro"]);

    return {
      cnpj: data.cnpj,
      razao_social: razao,
      nome_fantasia: str(j["nome_fantasia"]),
      situacao: str(j["descricao_situacao_cadastral"]),
      municipio: str(j["municipio"]),
      uf: str(j["uf"]),
      logradouro: logradouro ? `${logradouro}${numero ? `, ${numero}` : ""}` : null,
    };
  });
