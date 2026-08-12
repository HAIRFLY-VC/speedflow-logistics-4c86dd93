
-- 1. company_settings: restrict policies to authenticated role
DROP POLICY IF EXISTS company_settings_read_staff ON public.company_settings;
DROP POLICY IF EXISTS company_settings_write_adm ON public.company_settings;

CREATE POLICY company_settings_read_staff ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'adm'::app_role));

CREATE POLICY company_settings_write_adm ON public.company_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

REVOKE ALL ON public.company_settings FROM anon;

-- 2. Restrict admin-named write policies to 'adm' only (remove gestor write access
--    to carrier banking details, company entities and freight pricing tables)
DROP POLICY IF EXISTS empresas_write_admin ON public.empresas;
CREATE POLICY empresas_write_admin ON public.empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

DROP POLICY IF EXISTS transportadoras_write_admin ON public.transportadoras;
CREATE POLICY transportadoras_write_admin ON public.transportadoras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

DROP POLICY IF EXISTS tpf_write_admin ON public.tabelas_preco_frete;
CREATE POLICY tpf_write_admin ON public.tabelas_preco_frete
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

DROP POLICY IF EXISTS tpff_write_admin ON public.tabelas_preco_frete_faixas;
CREATE POLICY tpff_write_admin ON public.tabelas_preco_frete_faixas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

DROP POLICY IF EXISTS caf_update_admin ON public.configuracoes_auditoria_frete;
CREATE POLICY caf_update_admin ON public.configuracoes_auditoria_frete
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'adm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'adm'::app_role));

-- 3. order_status_history: harden insert check (staff only, and author must be self)
DROP POLICY IF EXISTS osh_staff_insert ON public.order_status_history;
CREATE POLICY osh_staff_insert ON public.order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'adm'::app_role))
    AND (changed_by IS NULL OR changed_by = auth.uid())
  );
REVOKE UPDATE, DELETE ON public.order_status_history FROM authenticated;
REVOKE ALL ON public.order_status_history FROM anon;

-- 4. SECURITY DEFINER functions: revoke public/anon execute; revoke authenticated
--    execute on trigger-only functions (triggers do not require EXECUTE grants).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.order_belongs_to_carrier(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_autorizar_frete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_belongs_to_carrier(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_autorizar_frete(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_cte_status_historico() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_order_initial_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_order_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_tabela_preco_vigencia() FROM PUBLIC, anon, authenticated;
