
CREATE TYPE public.app_role AS ENUM ('adm', 'gestor', 'operador', 'fretista');

CREATE TYPE public.order_status AS ENUM (
  'aguardando_aprovacao_comercial',
  'aguardando_aprovacao_credito',
  'aguardando_faturamento',
  'em_separacao',
  'aguardando_roteirizacao',
  'faturado',
  'em_transporte',
  'entregue',
  'reprovado_comercial',
  'reprovado_credito',
  'cancelado'
);

CREATE TYPE public.approval_type AS ENUM ('comercial', 'credito');
CREATE TYPE public.approval_decision AS ENUM ('aprovado', 'reprovado');
CREATE TYPE public.route_status AS ENUM ('planejada', 'em_andamento', 'concluida', 'cancelada');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('adm','gestor','operador'));
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_adm_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm')) WITH CHECK (public.has_role(auth.uid(),'adm'));

CREATE POLICY "user_roles_select_self_or_adm" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "user_roles_adm_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'adm')) WITH CHECK (public.has_role(auth.uid(),'adm'));

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT UNIQUE,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  address_line TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  erp_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_customers_legal_name ON public.customers(legal_name);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  weight_kg NUMERIC(10,3),
  stock_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.freight_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  vehicle_plate TEXT,
  vehicle_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_carriers TO authenticated;
GRANT ALL ON public.freight_carriers TO service_role;
ALTER TABLE public.freight_carriers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_freight_carriers_updated_at BEFORE UPDATE ON public.freight_carriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  salesperson_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'aguardando_aprovacao_comercial',
  status_since TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  freight_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sla_deliver_by TIMESTAMPTZ,
  erp_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_osh_order ON public.order_status_history(order_id, changed_at DESC);

CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  approval_type public.approval_type NOT NULL,
  decision public.approval_decision NOT NULL,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_approvals_order ON public.approvals(order_id);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  nfe_number TEXT,
  nfe_key TEXT,
  boleto_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.picking_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  picker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.picking_tasks TO authenticated;
GRANT ALL ON public.picking_tasks TO service_role;
ALTER TABLE public.picking_tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_picking_updated_at BEFORE UPDATE ON public.picking_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  carrier_id UUID REFERENCES public.freight_carriers(id) ON DELETE SET NULL,
  route_date DATE NOT NULL,
  status public.route_status NOT NULL DEFAULT 'planejada',
  total_freight NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_routes_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.route_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, order_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_orders TO authenticated;
GRANT ALL ON public.route_orders TO service_role;
ALTER TABLE public.route_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_route_orders_route ON public.route_orders(route_id);

CREATE TABLE public.delivery_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL UNIQUE REFERENCES public.routes(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_manifests TO authenticated;
GRANT ALL ON public.delivery_manifests TO service_role;
ALTER TABLE public.delivery_manifests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by_name TEXT,
  received_by_document TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deliveries_order ON public.deliveries(order_id);

CREATE TABLE public.delivery_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  photo_url TEXT,
  signature_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_receipts TO authenticated;
GRANT ALL ON public.delivery_receipts TO service_role;
ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.order_belongs_to_carrier(_order_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.route_orders ro
    JOIN public.routes r ON r.id = ro.route_id
    JOIN public.freight_carriers fc ON fc.id = r.carrier_id
    WHERE ro.order_id = _order_id AND fc.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed BOOLEAN := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'cancelado' THEN
    IF OLD.status = 'entregue' THEN
      RAISE EXCEPTION 'Não é possível cancelar um pedido já entregue';
    END IF;
    allowed := true;
  ELSE
    CASE OLD.status
      WHEN 'aguardando_aprovacao_comercial' THEN allowed := NEW.status IN ('aguardando_aprovacao_credito','reprovado_comercial');
      WHEN 'aguardando_aprovacao_credito' THEN allowed := NEW.status IN ('aguardando_faturamento','reprovado_credito');
      WHEN 'aguardando_faturamento' THEN allowed := NEW.status = 'em_separacao';
      WHEN 'em_separacao' THEN allowed := NEW.status = 'aguardando_roteirizacao';
      WHEN 'aguardando_roteirizacao' THEN allowed := NEW.status = 'faturado';
      WHEN 'faturado' THEN allowed := NEW.status = 'em_transporte';
      WHEN 'em_transporte' THEN allowed := NEW.status = 'entregue';
      WHEN 'reprovado_comercial' THEN allowed := NEW.status = 'aguardando_aprovacao_comercial';
      WHEN 'reprovado_credito' THEN allowed := NEW.status = 'aguardando_aprovacao_credito';
      ELSE allowed := false;
    END CASE;
  END IF;
  IF NOT allowed THEN
    RAISE EXCEPTION 'Transição inválida: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'em_transporte' THEN
    IF NOT EXISTS (SELECT 1 FROM public.route_orders WHERE order_id = NEW.id) THEN
      RAISE EXCEPTION 'Pedido precisa estar em uma rota para entrar em transporte';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE order_id = NEW.id) THEN
      RAISE EXCEPTION 'Pedido precisa ter nota fiscal emitida para entrar em transporte';
    END IF;
  END IF;
  NEW.status_since := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_status_transition BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_transition();

CREATE OR REPLACE FUNCTION public.log_order_status_history()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history(order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO public.order_status_history(order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_status_history_ins AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_history();
CREATE TRIGGER trg_orders_status_history_upd AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_history();

CREATE POLICY "customers_staff_all" ON public.customers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "customers_fretista_select" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.route_orders ro ON ro.order_id = o.id
    JOIN public.routes r ON r.id = ro.route_id
    JOIN public.freight_carriers fc ON fc.id = r.carrier_id
    WHERE o.customer_id = customers.id AND fc.user_id = auth.uid()
  ));

CREATE POLICY "products_staff_all" ON public.products FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));

CREATE POLICY "carriers_staff_all" ON public.freight_carriers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "carriers_self_select" ON public.freight_carriers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "orders_staff_all" ON public.orders FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "orders_fretista_select" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(id, auth.uid()));

CREATE POLICY "order_items_staff_all" ON public.order_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "order_items_fretista_select" ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));

CREATE POLICY "osh_staff_select" ON public.order_status_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "osh_staff_insert" ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "osh_fretista_select" ON public.order_status_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));

CREATE POLICY "approvals_staff_all" ON public.approvals FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));

CREATE POLICY "invoices_staff_all" ON public.invoices FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "invoices_fretista_select" ON public.invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));

CREATE POLICY "picking_staff_all" ON public.picking_tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));

CREATE POLICY "routes_staff_all" ON public.routes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "routes_fretista_select" ON public.routes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND EXISTS (
    SELECT 1 FROM public.freight_carriers fc WHERE fc.id = routes.carrier_id AND fc.user_id = auth.uid()
  ));

CREATE POLICY "route_orders_staff_all" ON public.route_orders FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "route_orders_fretista_select" ON public.route_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));

CREATE POLICY "manifests_staff_all" ON public.delivery_manifests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "manifests_fretista_select" ON public.delivery_manifests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND EXISTS (
    SELECT 1 FROM public.routes r
    JOIN public.freight_carriers fc ON fc.id = r.carrier_id
    WHERE r.id = delivery_manifests.route_id AND fc.user_id = auth.uid()
  ));

CREATE POLICY "deliveries_staff_all" ON public.deliveries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "deliveries_fretista_select" ON public.deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));
CREATE POLICY "deliveries_fretista_insert" ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'fretista') AND public.order_belongs_to_carrier(order_id, auth.uid()));

CREATE POLICY "receipts_staff_all" ON public.delivery_receipts FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'adm'));
CREATE POLICY "receipts_fretista_select" ON public.delivery_receipts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'fretista') AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_receipts.delivery_id
      AND public.order_belongs_to_carrier(d.order_id, auth.uid())
  ));
CREATE POLICY "receipts_fretista_insert" ON public.delivery_receipts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'fretista') AND EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = delivery_receipts.delivery_id
      AND public.order_belongs_to_carrier(d.order_id, auth.uid())
  ));
