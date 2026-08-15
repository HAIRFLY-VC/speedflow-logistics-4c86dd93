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
