CREATE TYPE public.nfe_solicitacao_status AS ENUM ('PENDENTE','PROCESSANDO','CONCLUIDA','ERRO');

CREATE TABLE public.nfe_solicitacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave_acesso text NOT NULL UNIQUE,
  status public.nfe_solicitacao_status NOT NULL DEFAULT 'PENDENTE',
  tentativas integer NOT NULL DEFAULT 0,
  mensagem text,
  solicitado_por uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.nfe_solicitacoes TO authenticated;
GRANT ALL ON public.nfe_solicitacoes TO service_role;

ALTER TABLE public.nfe_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff pode ver solicitacoes de NF-e"
  ON public.nfe_solicitacoes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode criar solicitacoes de NF-e"
  ON public.nfe_solicitacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff pode atualizar solicitacoes de NF-e"
  ON public.nfe_solicitacoes FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER set_nfe_solicitacoes_updated_at
  BEFORE UPDATE ON public.nfe_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_nfe_solicitacoes_status ON public.nfe_solicitacoes (status, created_at);