-- 1) Revoke EXECUTE on SECURITY DEFINER function not needed by clients
REVOKE EXECUTE ON FUNCTION public.order_belongs_to_carrier(uuid, uuid) FROM authenticated, anon, public;

-- 2) nfe-xml bucket policies (staff only)
CREATE POLICY nfe_xml_read_staff ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'nfe-xml' AND public.is_staff(auth.uid()));
CREATE POLICY nfe_xml_insert_staff ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nfe-xml' AND public.is_staff(auth.uid()));
CREATE POLICY nfe_xml_update_staff ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'nfe-xml' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'nfe-xml' AND public.is_staff(auth.uid()));
CREATE POLICY nfe_xml_delete_adm ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'nfe-xml' AND public.has_role(auth.uid(), 'adm'::app_role));

-- 3) delivery-receipts: staff read independent of owner already exists; add explicit
-- update/delete control so staff can manage receipts and nobody else can.
CREATE POLICY receipts_storage_staff_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'delivery-receipts' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'delivery-receipts' AND public.is_staff(auth.uid()));
CREATE POLICY receipts_storage_adm_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-receipts' AND public.has_role(auth.uid(), 'adm'::app_role));