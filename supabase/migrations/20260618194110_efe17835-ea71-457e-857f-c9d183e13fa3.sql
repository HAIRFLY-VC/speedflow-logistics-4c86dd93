
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'adm') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'adm')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_bootstrap_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();
