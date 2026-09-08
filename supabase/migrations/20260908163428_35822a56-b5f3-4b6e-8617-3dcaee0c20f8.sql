DROP POLICY IF EXISTS "Recipients can read shared filter views" ON public.table_filter_views;
DROP POLICY IF EXISTS "Owners manage shares of their views" ON public.table_filter_view_shares;
DROP FUNCTION IF EXISTS public.filter_view_shared_with(uuid, uuid);
DROP FUNCTION IF EXISTS public.owns_filter_view(uuid, uuid);

CREATE POLICY "Owners manage shares of their views"
ON public.table_filter_view_shares FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.table_filter_views v WHERE v.id = view_id AND v.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.table_filter_views v WHERE v.id = view_id AND v.owner_id = auth.uid()));