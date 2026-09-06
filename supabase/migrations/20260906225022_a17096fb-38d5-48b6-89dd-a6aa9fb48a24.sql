-- lovable-cron-fallback-reviewed: 96 runs/day; job pré-existente de 15 em 15 minutos; apenas o cabeçalho de autorização é corrigido, cadência inalterada
CREATE OR REPLACE FUNCTION public.__set_erp_cron(p_secret text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'erp-sync-orders';
  SELECT cron.schedule(
    'erp-sync-orders',
    '*/15 * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L), body := ''{}''::jsonb, timeout_milliseconds := 120000);',
      'https://project--0f575c65-0542-477f-8d03-b4c26e47b952.lovable.app/api/public/hooks/erp-sync',
      p_secret
    )
  ) INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.__set_erp_cron(text) TO PUBLIC;