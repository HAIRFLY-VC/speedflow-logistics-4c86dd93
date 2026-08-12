CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('adm','gestor','operador')
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.order_belongs_to_carrier(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.route_orders ro
    JOIN public.routes r ON r.id = ro.route_id
    JOIN public.freight_carriers fc ON fc.id = r.carrier_id
    WHERE ro.order_id = _order_id AND fc.user_id = _user_id
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_belongs_to_carrier(uuid, uuid) FROM anon;