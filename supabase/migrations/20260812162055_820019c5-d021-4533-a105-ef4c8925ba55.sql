CREATE TABLE public.nfes (
  id uuid primary key default gen_random_uuid(),
  chave_acesso text not null unique,
  numero text,
  serie text,
  natureza_operacao text,
  cnpj_emitente text,
  nome_emitente text,
  cnpj_destinatario text,
  nome_destinatario text,
  uf_destino text,
  data_emissao timestamptz,
  valor_total numeric not null default 0,
  valor_produtos numeric not null default 0,
  valor_frete numeric not null default 0,
  peso_bruto numeric,
  itens jsonb not null default '[]'::jsonb,
  xml_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE ON public.nfes TO authenticated;
GRANT ALL ON public.nfes TO service_role;

ALTER TABLE public.nfes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfes_select_staff" ON public.nfes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "nfes_insert_staff" ON public.nfes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "nfes_update_staff" ON public.nfes FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER nfes_set_updated_at BEFORE UPDATE ON public.nfes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();