
CREATE POLICY "receipts_storage_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-receipts' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm')));
CREATE POLICY "receipts_storage_fretista_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-receipts' AND owner = auth.uid());
CREATE POLICY "receipts_storage_fretista_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-receipts' AND owner = auth.uid() AND public.has_role(auth.uid(),'fretista'));
CREATE POLICY "receipts_storage_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-receipts' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm')));
