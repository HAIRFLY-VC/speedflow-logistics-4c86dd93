CREATE TABLE public.robo_heartbeats (
  origem TEXT PRIMARY KEY,
  ultimo_contato TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalhe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.robo_heartbeats TO authenticated;
GRANT ALL ON public.robo_heartbeats TO service_role;

ALTER TABLE public.robo_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe pode ver o contato do robo"
ON public.robo_heartbeats
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_robo_heartbeats_updated_at
BEFORE UPDATE ON public.robo_heartbeats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();