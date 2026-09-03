import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/central/client";

export type ClienteErp = {
  cod_cliente: string;
  razao_social: string | null;
  nome_nf: string | null;
  cidade: string | null;
  uf: string | null;
};

/**
 * Espelho local do cadastro de clientes do ERP, indexado pelo código.
 * Usado para exibir o nome do cliente (em vez de só o código) e a cidade de
 * entrega (praça) na estimativa de frete.
 */
export function useClientesErp() {
  const query = useQuery({
    queryKey: ["clientes-erp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes_erp")
        .select("cod_cliente,razao_social,nome_nf,cidade,uf");
      if (error) throw error;
      return (data ?? []) as ClienteErp[];
    },
    staleTime: 30 * 60 * 1000,
  });

  const porCodigo = useMemo(() => {
    const map = new Map<string, ClienteErp>();
    for (const c of query.data ?? []) map.set(String(c.cod_cliente).trim(), c);
    return map;
  }, [query.data]);

  const nomeCliente = useMemo(
    () => (cod: string | null | undefined) => {
      const codigo = cod == null ? "" : String(cod).trim();
      if (!codigo) return "Cliente";
      const c = porCodigo.get(codigo);
      return c?.razao_social?.trim() || c?.nome_nf?.trim() || `Cliente ${codigo}`;
    },
    [porCodigo],
  );

  const cidadeCliente = useMemo(
    () => (cod: string | null | undefined) => {
      const codigo = cod == null ? "" : String(cod).trim();
      if (!codigo) return null;
      return porCodigo.get(codigo)?.cidade?.trim() || null;
    },
    [porCodigo],
  );

  return { clientes: query.data ?? [], porCodigo, nomeCliente, cidadeCliente, query };
}
