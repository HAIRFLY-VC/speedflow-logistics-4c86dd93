ALTER TABLE public.transportadoras ADD COLUMN cod_erp text;

CREATE INDEX IF NOT EXISTS idx_transportadoras_cod_erp ON public.transportadoras (cod_erp);

COMMENT ON COLUMN public.transportadoras.cod_erp IS 'Código da transportadora/fretista no ERP Oracle';