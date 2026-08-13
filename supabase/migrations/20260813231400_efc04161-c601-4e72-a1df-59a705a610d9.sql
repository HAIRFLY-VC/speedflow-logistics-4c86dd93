CREATE TABLE public.cte_captura_comandos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','PROCESSANDO','CONCLUIDO','ERRO')),
  solicitado_por uuid REFERENCES auth.users(id),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  mensagem text,
  novos_ctes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cte_captura_comandos TO authenticated;
GRANT ALL ON public.cte_captura_comandos TO service_role;

ALTER TABLE public.cte_captura_comandos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ver comandos de captura"
ON public.cte_captura_comandos FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode solicitar captura"
ON public.cte_captura_comandos FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()) AND solicitado_por = auth.uid());

CREATE TRIGGER trg_cte_captura_comandos_updated_at
BEFORE UPDATE ON public.cte_captura_comandos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cte_captura_comandos_status ON public.cte_captura_comandos (status, created_at);