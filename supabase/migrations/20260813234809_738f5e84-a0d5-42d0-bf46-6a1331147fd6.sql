CREATE POLICY "Staff pode encerrar comandos de captura"
ON public.cte_captura_comandos
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));