import postgres from "postgres";

/**
 * Acesso somente-leitura ao banco central externo (clientes, produtos,
 * vendedores, vendas, expedição). Nunca importe este arquivo do lado cliente.
 */

let client: ReturnType<typeof postgres> | null = null;

/**
 * A string de conexão do Supabase é copiada do painel no formato
 * `postgresql://postgres:[SENHA]@host:5432/postgres`. Muita gente mantém os
 * colchetes ao substituir a senha, e caracteres especiais precisam ser
 * percent-encoded. Normalizamos os dois casos aqui.
 */
export function normalizeConnectionString(raw: string): string {
  const match = /^(postgres(?:ql)?):\/\/([^:@/]+):(.*)@([^@]+)$/.exec(raw.trim());
  if (!match) return raw.trim();
  const [, scheme, user, rawPassword, rest] = match;
  let password = rawPassword ?? "";
  if (password.startsWith("[") && password.endsWith("]")) {
    password = password.slice(1, -1);
  }
  // Se já vier codificado, decodeURIComponent + encode mantém o mesmo valor.
  let decoded = password;
  try {
    decoded = decodeURIComponent(password);
  } catch {
    decoded = password;
  }
  return `${scheme}://${user}:${encodeURIComponent(decoded)}@${rest}`;
}

export function getExternalDb() {
  if (client) return client;
  const raw = process.env["EXTERNAL_DB_URL"];
  if (!raw) {
    throw new Error(
      "Conexão com o banco central não configurada (EXTERNAL_DB_URL ausente).",
    );
  }
  client = postgres(normalizeConnectionString(raw), {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });
  return client;
}

export type ExternalCliente = {
  cod_cliente: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  status_cli: string | null;
  cod_canal: string | null;
  nome_canal: string | null;
  cod_grp_emp: string | null;
  nome_grp_emp: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;
};

export type ExternalProduto = {
  cod_produto: string;
  descricao: string | null;
  marca: string | null;
  ativo: string | null;
  unidade_medida: string | null;
  qt_por_caixa: number | null;
  peso_liquido_kg: number | null;
  custo_unitario_referencia: number | null;
};

export type ExternalVendedor = {
  cod_rca: string;
  nome: string | null;
  email: string | null;
  ativo: string | null;
  cod_gerente: string | null;
  nome_gerente: string | null;
};
