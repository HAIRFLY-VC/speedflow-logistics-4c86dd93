ALTER TABLE public.cte_captura_comandos
  ADD COLUMN IF NOT EXISTS reiniciar_nsu boolean NOT NULL DEFAULT false;

DELETE FROM public.cte_auditorias;
DELETE FROM public.cte_divergencias;
DELETE FROM public.ordens_pagamento_frete;
DELETE FROM public.cte_status_historico;
DELETE FROM public.cte_ingest_logs;
DELETE FROM public.ctes;