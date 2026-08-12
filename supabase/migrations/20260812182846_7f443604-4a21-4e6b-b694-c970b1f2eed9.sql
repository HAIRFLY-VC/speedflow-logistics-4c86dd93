ALTER TABLE public.tabelas_preco_frete
  ADD COLUMN IF NOT EXISTS arquivo_path text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text,
  ADD COLUMN IF NOT EXISTS arquivo_tipo text;

CREATE POLICY "Equipe pode ler arquivos de tabelas de frete"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tabelas-frete' AND public.is_staff(auth.uid()));

CREATE POLICY "Equipe pode enviar arquivos de tabelas de frete"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tabelas-frete' AND public.is_staff(auth.uid()));

CREATE POLICY "Equipe pode atualizar arquivos de tabelas de frete"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tabelas-frete' AND public.is_staff(auth.uid()));

CREATE POLICY "Equipe pode remover arquivos de tabelas de frete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tabelas-frete' AND public.is_staff(auth.uid()));