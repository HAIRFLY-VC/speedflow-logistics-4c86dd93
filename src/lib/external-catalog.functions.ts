import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ExternalCliente,
  ExternalProduto,
  ExternalVendedor,
} from "@/lib/external-catalog.types";

const searchInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  limit: z.number().int().min(1).max(1000).optional().default(300),
});

export const listClientesExternos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { getExternalDb } = await import("@/lib/external-db.server");
    const sql = getExternalDb();
    const term = `%${data.search.replace(/[%_]/g, "")}%`;
    const hasTerm = data.search.length > 0;

    const rows = hasTerm
      ? await sql`
          select cod_cliente::text as cod_cliente, cnpj, razao_social, nome_fantasia,
                 status_cli, cod_canal, nome_canal, cod_grp_emp::text as cod_grp_emp,
                 nome_grp_emp, endereco_logradouro, endereco_numero, endereco_bairro,
                 endereco_cidade, endereco_uf, endereco_cep
          from public.clientes
          where razao_social ilike ${term}
             or nome_fantasia ilike ${term}
             or cnpj ilike ${term}
             or cod_cliente::text ilike ${term}
             or endereco_cidade ilike ${term}
          order by razao_social
          limit ${data.limit}
        `
      : await sql`
          select cod_cliente::text as cod_cliente, cnpj, razao_social, nome_fantasia,
                 status_cli, cod_canal, nome_canal, cod_grp_emp::text as cod_grp_emp,
                 nome_grp_emp, endereco_logradouro, endereco_numero, endereco_bairro,
                 endereco_cidade, endereco_uf, endereco_cep
          from public.clientes
          order by razao_social
          limit ${data.limit}
        `;

    const [{ total }] = await sql<{ total: string }[]>`
      select count(*)::text as total from public.clientes
    `;

    return {
      rows: rows as unknown as ExternalCliente[],
      total: Number(total),
      truncated: rows.length >= data.limit,
    };
  });

export const listProdutosExternos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getExternalDb } = await import("@/lib/external-db.server");
    const sql = getExternalDb();
    const rows = await sql`
      select cod_produto::text as cod_produto, descricao, marca, ativo, unidade_medida,
             qt_por_caixa::float8 as qt_por_caixa,
             peso_liquido_kg::float8 as peso_liquido_kg,
             custo_unitario_referencia::float8 as custo_unitario_referencia
      from public.produtos
      order by descricao
    `;
    return { rows: rows as unknown as ExternalProduto[], total: rows.length };
  });

export const listVendedoresExternos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getExternalDb } = await import("@/lib/external-db.server");
    const sql = getExternalDb();
    const rows = await sql`
      select cod_rca::text as cod_rca, nome, email, ativo,
             cod_gerente::text as cod_gerente, nome_gerente
      from public.vendedores
      order by nome
    `;
    return { rows: rows as unknown as ExternalVendedor[], total: rows.length };
  });

/** Diagnóstico da conexão com o banco central. */
export const pingBancoCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getExternalDb } = await import("@/lib/external-db.server");
    const sql = getExternalDb();
    const [row] = await sql<{ clientes: string; produtos: string; vendedores: string }[]>`
      select (select count(*) from public.clientes)::text as clientes,
             (select count(*) from public.produtos)::text as produtos,
             (select count(*) from public.vendedores)::text as vendedores
    `;
    return {
      ok: true,
      clientes: Number(row?.clientes ?? 0),
      produtos: Number(row?.produtos ?? 0),
      vendedores: Number(row?.vendedores ?? 0),
    };
  });
