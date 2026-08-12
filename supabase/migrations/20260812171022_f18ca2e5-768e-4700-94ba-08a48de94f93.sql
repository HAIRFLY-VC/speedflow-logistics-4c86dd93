CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;
ALTER FUNCTION public.pode_autorizar_frete(uuid) SET SCHEMA private;
ALTER FUNCTION public.order_belongs_to_carrier(uuid, uuid) SET SCHEMA private;

-- Thin SECURITY INVOKER wrappers kept in the exposed API schema, so the app can
-- still check its own permissions while the privileged bodies live outside it.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.is_staff(_user_id) $$;

CREATE OR REPLACE FUNCTION public.pode_autorizar_frete(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = private, public
AS $$ SELECT private.pode_autorizar_frete(_user_id) $$;

REVOKE EXECUTE ON FUNCTION private.order_belongs_to_carrier(uuid, uuid) FROM authenticated, anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.pode_autorizar_frete(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.is_staff(uuid), public.pode_autorizar_frete(uuid) TO authenticated, service_role;