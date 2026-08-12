CREATE TABLE public.cte_ingest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem public.cte_origem_captura NOT NULL DEFAULT 'SEFAZ_AUTO',
  chave_acesso text,
  cnpj_emitente text,
  cnpj_destinatario text,
  resultado text NOT NULL,
  mensagem text,
  cte_id uuid REFERENCES public.ctes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cte_ingest_logs TO authenticated;
GRANT ALL ON public.cte_ingest_logs TO service_role;

ALTER TABLE public.cte_ingest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cte ingest logs"
ON public.cte_ingest_logs FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE INDEX idx_cte_ingest_logs_created_at ON public.cte_ingest_logs (created_at DESC);
CREATE INDEX idx_cte_ingest_logs_resultado ON public.cte_ingest_logs (resultado);