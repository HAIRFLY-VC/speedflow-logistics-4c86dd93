CREATE TABLE public.table_filter_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_key text NOT NULL,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, table_key, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_filter_views TO authenticated;
GRANT ALL ON public.table_filter_views TO service_role;
ALTER TABLE public.table_filter_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.table_filter_view_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL REFERENCES public.table_filter_views(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (view_id, shared_with)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_filter_view_shares TO authenticated;
GRANT ALL ON public.table_filter_view_shares TO service_role;
ALTER TABLE public.table_filter_view_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_filter_view(_view_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_filter_views v
    WHERE v.id = _view_id AND v.owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.filter_view_shared_with(_view_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_filter_view_shares s
    WHERE s.view_id = _view_id AND s.shared_with = _user_id
  )
$$;

CREATE POLICY "Owners manage their filter views"
ON public.table_filter_views FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Recipients can read shared filter views"
ON public.table_filter_views FOR SELECT TO authenticated
USING (public.filter_view_shared_with(id, auth.uid()));

CREATE POLICY "Owners manage shares of their views"
ON public.table_filter_view_shares FOR ALL TO authenticated
USING (public.owns_filter_view(view_id, auth.uid()))
WITH CHECK (public.owns_filter_view(view_id, auth.uid()));

CREATE POLICY "Recipients can read their shares"
ON public.table_filter_view_shares FOR SELECT TO authenticated
USING (shared_with = auth.uid());

CREATE TRIGGER update_table_filter_views_updated_at
BEFORE UPDATE ON public.table_filter_views
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();