
CREATE TABLE public.company_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Speed Logística',
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  -- Approval rules
  commercial_approval_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_approval_threshold NUMERIC(14,2) NOT NULL DEFAULT 0,
  auto_approve_below NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- SLA (hours)
  sla_commercial_approval_hours INT NOT NULL DEFAULT 4,
  sla_credit_approval_hours INT NOT NULL DEFAULT 8,
  sla_fulfillment_hours INT NOT NULL DEFAULT 24,
  sla_delivery_hours INT NOT NULL DEFAULT 48,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_settings_read_staff"
  ON public.company_settings FOR SELECT
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'adm'));

CREATE POLICY "company_settings_write_adm"
  ON public.company_settings FOR ALL
  USING (public.has_role(auth.uid(), 'adm'))
  WITH CHECK (public.has_role(auth.uid(), 'adm'));

CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
