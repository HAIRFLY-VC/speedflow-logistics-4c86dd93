
CREATE OR REPLACE FUNCTION public.apply_order_initial_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cfg public.company_settings%ROWTYPE;
BEGIN
  -- Only act on INSERT when status is the default (aguardando_aprovacao_comercial)
  IF NEW.status IS DISTINCT FROM 'aguardando_aprovacao_comercial'::order_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO cfg FROM public.company_settings WHERE id = 1;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF cfg.auto_approve_below > 0 AND NEW.total_amount < cfg.auto_approve_below THEN
    NEW.status := 'aguardando_faturamento';
  ELSIF cfg.commercial_approval_threshold > 0
        AND NEW.total_amount < cfg.commercial_approval_threshold THEN
    NEW.status := 'aguardando_aprovacao_credito';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_initial_status ON public.orders;
CREATE TRIGGER trg_orders_initial_status
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_initial_status();
