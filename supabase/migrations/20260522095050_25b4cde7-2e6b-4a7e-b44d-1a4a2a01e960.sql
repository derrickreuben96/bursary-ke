
-- IPN: Disbursement + School ERP Sync Engine (additive)

CREATE TABLE public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid,
  parent_application_id uuid,
  student_id uuid,
  school_name text,
  county text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  payment_reference text,
  provider text,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  triggered_by uuid,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disbursements_status ON public.disbursements(status);
CREATE INDEX idx_disbursements_student ON public.disbursements(student_id);
CREATE INDEX idx_disbursements_county ON public.disbursements(county);

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id uuid NOT NULL REFERENCES public.disbursements(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_reference text,
  status text NOT NULL,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_tx_disb ON public.payment_transactions(disbursement_id);

CREATE TABLE public.erp_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id uuid NOT NULL REFERENCES public.disbursements(id) ON DELETE CASCADE,
  school_name text,
  student_id uuid,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','acknowledged','failed')),
  ack_timestamp timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_erp_notif_disb ON public.erp_notifications(disbursement_id);
CREATE INDEX idx_erp_notif_status ON public.erp_notifications(delivery_status);

-- Timestamp triggers
CREATE TRIGGER trg_disb_updated BEFORE UPDATE ON public.disbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_erp_updated BEFORE UPDATE ON public.erp_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_notifications ENABLE ROW LEVEL SECURITY;

-- Disbursements
CREATE POLICY "Deny anon disbursements" ON public.disbursements
  FOR SELECT TO anon USING (false);
CREATE POLICY "Admins manage disbursements" ON public.disbursements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Treasury views county disbursements" ON public.disbursements
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_treasury'::app_role)
    AND county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- Payment transactions
CREATE POLICY "Deny anon payment_tx" ON public.payment_transactions
  FOR SELECT TO anon USING (false);
CREATE POLICY "Admins manage payment_tx" ON public.payment_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ERP notifications
CREATE POLICY "Deny anon erp_notif" ON public.erp_notifications
  FOR SELECT TO anon USING (false);
CREATE POLICY "Admins manage erp_notif" ON public.erp_notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
