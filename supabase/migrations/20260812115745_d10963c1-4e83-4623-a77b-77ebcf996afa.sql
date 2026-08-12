CREATE TABLE public.configuracoes_erp (
    id integer PRIMARY KEY DEFAULT 1,
    url_base text,
    api_key text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_erp TO authenticated;
GRANT ALL ON public.configuracoes_erp TO service_role;

ALTER TABLE public.configuracoes_erp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas administradores gerenciam configurações do ERP"
ON public.configuracoes_erp
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'adm'))
WITH CHECK (public.has_role(auth.uid(), 'adm'));

INSERT INTO public.configuracoes_erp (id, url_base, api_key)
VALUES (1, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_configuracoes_erp_updated_at
BEFORE UPDATE ON public.configuracoes_erp
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();