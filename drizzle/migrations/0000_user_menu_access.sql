CREATE TABLE public.user_menu_access (
  user_id uuid NOT NULL,
  menu_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, menu_url)
);
COMMENT ON TABLE public.user_menu_access IS 'Itens do menu liberados por usuário. Linha menu_url=__custom__ indica menu personalizado.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_menu_access TO authenticated;
GRANT ALL ON public.user_menu_access TO service_role;
ALTER TABLE public.user_menu_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê seu menu" ON public.user_menu_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'adm'));
CREATE POLICY "Admin insere menu" ON public.user_menu_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'adm'));
CREATE POLICY "Admin altera menu" ON public.user_menu_access FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'adm')) WITH CHECK (public.has_role(auth.uid(), 'adm'));
CREATE POLICY "Admin remove menu" ON public.user_menu_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'adm'));