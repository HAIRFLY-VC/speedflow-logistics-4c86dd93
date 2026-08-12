-- ============ ENUMS ============
CREATE TYPE public.cte_origem_captura AS ENUM ('MANUAL','SEFAZ_AUTO');
CREATE TYPE public.cte_status AS ENUM (
  'RECEBIDO','PENDENTE_IDENTIFICACAO','EM_AUDITORIA','APROVADO','DIVERGENTE',
  'EM_RESOLUCAO','RESOLVIDO','AUTORIZADO','LANCADO_ERP','ERRO_ERP','REJEITADO'
);
CREATE TYPE public.cte_divergencia_status AS ENUM ('ABERTA','EM_NEGOCIACAO','RESOLVIDA');
CREATE TYPE public.ordem_pagamento_status AS ENUM ('PENDENTE','AUTORIZADO','AGUARDANDO_INTEGRACAO_ERP','LANCADO_ERP','ERRO_ERP');
CREATE TYPE public.tabela_frete_tipo_calculo AS ENUM ('peso','valor');
CREATE TYPE public.cte_auditoria_resultado AS ENUM ('OK','DIVERGENTE');

-- ============ PERMISSAO GRANULAR ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pode_autorizar_pagamento_frete boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.pode_autorizar_frete(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND (
       EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'adm')
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND pode_autorizar_pagamento_frete)
     );
$$;
REVOKE EXECUTE ON FUNCTION public.pode_autorizar_frete(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pode_autorizar_frete(uuid) TO authenticated, service_role;

-- ============ EMPRESAS ============
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas_select_staff" ON public.empresas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "empresas_write_admin" ON public.empresas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRANSPORTADORAS ============
CREATE TABLE public.transportadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text NOT NULL UNIQUE,
  banco text,
  agencia text,
  conta text,
  pix text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transportadoras TO authenticated;
GRANT ALL ON public.transportadoras TO service_role;
ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transportadoras_select_staff" ON public.transportadoras FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "transportadoras_write_admin" ON public.transportadoras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_transportadoras_updated_at BEFORE UPDATE ON public.transportadoras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.freight_carriers
  ADD COLUMN IF NOT EXISTS transportadora_id uuid REFERENCES public.transportadoras(id) ON DELETE SET NULL;

-- ============ TABELAS DE PRECO ============
CREATE TABLE public.tabelas_preco_frete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transportadora_id uuid NOT NULL REFERENCES public.transportadoras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date,
  tipo_calculo public.tabela_frete_tipo_calculo NOT NULL DEFAULT 'peso',
  percentual_valor numeric NOT NULL DEFAULT 0,
  gris_percentual numeric NOT NULL DEFAULT 0,
  ad_valorem_percentual numeric NOT NULL DEFAULT 0,
  pedagio_valor numeric NOT NULL DEFAULT 0,
  tas_valor numeric NOT NULL DEFAULT 0,
  frete_minimo numeric NOT NULL DEFAULT 0,
  icms_percentual numeric NOT NULL DEFAULT 0,
  uf_destino text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabelas_preco_frete TO authenticated;
GRANT ALL ON public.tabelas_preco_frete TO service_role;
ALTER TABLE public.tabelas_preco_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpf_select_staff" ON public.tabelas_preco_frete FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "tpf_write_admin" ON public.tabelas_preco_frete FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_tpf_updated_at BEFORE UPDATE ON public.tabelas_preco_frete FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_tabela_preco_vigencia()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_fim IS NOT NULL AND NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'Data fim da vigência não pode ser anterior à data início';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_tpf_vigencia BEFORE INSERT OR UPDATE ON public.tabelas_preco_frete
  FOR EACH ROW EXECUTE FUNCTION public.validate_tabela_preco_vigencia();

CREATE TABLE public.tabelas_preco_frete_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_id uuid NOT NULL REFERENCES public.tabelas_preco_frete(id) ON DELETE CASCADE,
  peso_de numeric NOT NULL DEFAULT 0,
  peso_ate numeric,
  valor_por_kg numeric NOT NULL DEFAULT 0,
  valor_fixo_faixa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tpf_faixas_tabela ON public.tabelas_preco_frete_faixas(tabela_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tabelas_preco_frete_faixas TO authenticated;
GRANT ALL ON public.tabelas_preco_frete_faixas TO service_role;
ALTER TABLE public.tabelas_preco_frete_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpff_select_staff" ON public.tabelas_preco_frete_faixas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "tpff_write_admin" ON public.tabelas_preco_frete_faixas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'));

-- ============ CTES ============
CREATE TABLE public.ctes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso text NOT NULL UNIQUE CHECK (char_length(chave_acesso) = 44),
  numero text,
  serie text,
  transportadora_id uuid REFERENCES public.transportadoras(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  cnpj_emitente text,
  cnpj_destinatario text,
  data_emissao timestamptz,
  valor_total_frete numeric NOT NULL DEFAULT 0,
  valor_mercadoria numeric NOT NULL DEFAULT 0,
  peso_taxado numeric,
  uf_destino text,
  componentes jsonb NOT NULL DEFAULT '{}'::jsonb,
  nfs_referenciadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  xml_storage_path text,
  origem_captura public.cte_origem_captura NOT NULL DEFAULT 'MANUAL',
  status public.cte_status NOT NULL DEFAULT 'RECEBIDO',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ctes_status ON public.ctes(status);
CREATE INDEX idx_ctes_transportadora ON public.ctes(transportadora_id);
CREATE INDEX idx_ctes_data_emissao ON public.ctes(data_emissao);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ctes TO authenticated;
GRANT ALL ON public.ctes TO service_role;
ALTER TABLE public.ctes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctes_select_staff" ON public.ctes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "ctes_insert_staff" ON public.ctes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "ctes_update_staff" ON public.ctes FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (
    public.is_staff(auth.uid())
    AND (status NOT IN ('AUTORIZADO','LANCADO_ERP') OR public.pode_autorizar_frete(auth.uid()))
  );
CREATE POLICY "ctes_delete_admin" ON public.ctes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'adm'));
CREATE TRIGGER trg_ctes_updated_at BEFORE UPDATE ON public.ctes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ HISTORICO ============
CREATE TABLE public.cte_status_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.ctes(id) ON DELETE CASCADE,
  status_anterior public.cte_status,
  status_novo public.cte_status NOT NULL,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  observacao text
);
CREATE INDEX idx_cte_hist_cte ON public.cte_status_historico(cte_id);
GRANT SELECT ON public.cte_status_historico TO authenticated;
GRANT ALL ON public.cte_status_historico TO service_role;
ALTER TABLE public.cte_status_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cte_hist_select_staff" ON public.cte_status_historico FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_cte_status_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cte_status_historico(cte_id, status_anterior, status_novo, alterado_por)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.cte_status_historico(cte_id, status_anterior, status_novo, alterado_por)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_ctes_hist_ins AFTER INSERT ON public.ctes FOR EACH ROW EXECUTE FUNCTION public.log_cte_status_historico();
CREATE TRIGGER trg_ctes_hist_upd AFTER UPDATE ON public.ctes FOR EACH ROW EXECUTE FUNCTION public.log_cte_status_historico();

-- ============ AUDITORIAS ============
CREATE TABLE public.cte_auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.ctes(id) ON DELETE CASCADE,
  tabela_preco_id uuid REFERENCES public.tabelas_preco_frete(id) ON DELETE SET NULL,
  valor_esperado_total numeric NOT NULL DEFAULT 0,
  valor_cobrado_total numeric NOT NULL DEFAULT 0,
  diferenca numeric NOT NULL DEFAULT 0,
  percentual_diferenca numeric NOT NULL DEFAULT 0,
  detalhamento jsonb NOT NULL DEFAULT '[]'::jsonb,
  tolerancia_aplicada jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado public.cte_auditoria_resultado NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cte_auditorias_cte ON public.cte_auditorias(cte_id);
GRANT SELECT, INSERT ON public.cte_auditorias TO authenticated;
GRANT ALL ON public.cte_auditorias TO service_role;
ALTER TABLE public.cte_auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cte_aud_select_staff" ON public.cte_auditorias FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "cte_aud_insert_staff" ON public.cte_auditorias FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- ============ DIVERGENCIAS ============
CREATE TABLE public.cte_divergencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.ctes(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  observacao_operador text,
  valor_acordado numeric,
  status public.cte_divergencia_status NOT NULL DEFAULT 'ABERTA',
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolvido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cte_div_cte ON public.cte_divergencias(cte_id);
GRANT SELECT, INSERT, UPDATE ON public.cte_divergencias TO authenticated;
GRANT ALL ON public.cte_divergencias TO service_role;
ALTER TABLE public.cte_divergencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cte_div_select_staff" ON public.cte_divergencias FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "cte_div_insert_staff" ON public.cte_divergencias FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "cte_div_update_staff" ON public.cte_divergencias FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_cte_div_updated_at BEFORE UPDATE ON public.cte_divergencias FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDENS DE PAGAMENTO ============
CREATE TABLE public.ordens_pagamento_frete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cte_id uuid NOT NULL REFERENCES public.ctes(id) ON DELETE CASCADE,
  valor_autorizado numeric NOT NULL DEFAULT 0,
  autorizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autorizado_em timestamptz,
  status public.ordem_pagamento_status NOT NULL DEFAULT 'PENDENTE',
  payload_erp_enviado jsonb,
  referencia_erp text,
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_opf_cte ON public.ordens_pagamento_frete(cte_id);
GRANT SELECT, INSERT, UPDATE ON public.ordens_pagamento_frete TO authenticated;
GRANT ALL ON public.ordens_pagamento_frete TO service_role;
ALTER TABLE public.ordens_pagamento_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opf_select_staff" ON public.ordens_pagamento_frete FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "opf_insert_autorizador" ON public.ordens_pagamento_frete FOR INSERT TO authenticated
  WITH CHECK (public.pode_autorizar_frete(auth.uid()));
CREATE POLICY "opf_update_autorizador" ON public.ordens_pagamento_frete FOR UPDATE TO authenticated
  USING (public.pode_autorizar_frete(auth.uid()))
  WITH CHECK (public.pode_autorizar_frete(auth.uid()));
CREATE TRIGGER trg_opf_updated_at BEFORE UPDATE ON public.ordens_pagamento_frete FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CONFIGURACAO ============
CREATE TABLE public.configuracoes_auditoria_frete (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tolerancia_valor numeric NOT NULL DEFAULT 5.00,
  tolerancia_percentual numeric NOT NULL DEFAULT 0.01,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.configuracoes_auditoria_frete TO authenticated;
GRANT ALL ON public.configuracoes_auditoria_frete TO service_role;
ALTER TABLE public.configuracoes_auditoria_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caf_select_staff" ON public.configuracoes_auditoria_frete FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "caf_update_admin" ON public.configuracoes_auditoria_frete FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'adm') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_caf_updated_at BEFORE UPDATE ON public.configuracoes_auditoria_frete FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.configuracoes_auditoria_frete (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ STORAGE POLICIES (bucket cte-xml) ============
CREATE POLICY "cte_xml_read_staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cte-xml' AND public.is_staff(auth.uid()));
CREATE POLICY "cte_xml_insert_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cte-xml' AND public.is_staff(auth.uid()));
CREATE POLICY "cte_xml_update_staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cte-xml' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'cte-xml' AND public.is_staff(auth.uid()));