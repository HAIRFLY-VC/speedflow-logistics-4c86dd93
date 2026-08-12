CREATE TABLE public.tabelas_preco_frete_rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.tabelas_preco_frete(id) ON DELETE CASCADE,
  origem text NOT NULL,
  destino text NOT NULL,
  uf_origem text,
  uf_destino text,
  tarifa_frete_peso numeric NOT NULL DEFAULT 0,
  frete_valor_percentual numeric NOT NULL DEFAULT 0,
  taxa_despacho numeric NOT NULL DEFAULT 0,
  frete_minimo numeric NOT NULL DEFAULT 0,
  peso_minimo_kg numeric NOT NULL DEFAULT 0,
  prazo_entrega_min_dias integer,
  prazo_entrega_max_dias integer,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabelas_preco_frete_rotas TO authenticated;
GRANT ALL ON public.tabelas_preco_frete_rotas TO service_role;

ALTER TABLE public.tabelas_preco_frete_rotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe lê rotas de tabela de frete"
ON public.tabelas_preco_frete_rotas FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Gestores gerenciam rotas de tabela de frete"
ON public.tabelas_preco_frete_rotas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'adm') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'adm') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_tpf_rotas_tabela ON public.tabelas_preco_frete_rotas(tabela_id);

CREATE TRIGGER trg_tpf_rotas_updated_at
BEFORE UPDATE ON public.tabelas_preco_frete_rotas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();