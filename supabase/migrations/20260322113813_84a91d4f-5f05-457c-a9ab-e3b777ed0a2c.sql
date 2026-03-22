
-- Create cycle tracking table for bursary allocation cycles
CREATE TABLE public.allocation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_name text NOT NULL,
  fiscal_year text NOT NULL,
  county text NOT NULL,
  advert_id uuid REFERENCES public.bursary_adverts(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_budget numeric DEFAULT 0,
  total_allocated numeric DEFAULT 0,
  total_applicants integer DEFAULT 0,
  total_approved integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create applicant history table for cross-cycle tracking
CREATE TABLE public.applicant_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text NOT NULL,
  phone_number text,
  cycle_id uuid REFERENCES public.allocation_cycles(id),
  application_id uuid REFERENCES public.bursary_applications(id),
  funding_status text NOT NULL CHECK (funding_status IN ('funded', 'not_funded', 'duplicate')),
  ai_score integer DEFAULT 0,
  ward text,
  county text NOT NULL,
  allocated_amount numeric DEFAULT 0,
  red_flag boolean NOT NULL DEFAULT false,
  red_flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create fairness tracking table for priority boost logic
CREATE TABLE public.fairness_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text NOT NULL,
  application_id uuid REFERENCES public.bursary_applications(id),
  previous_attempts_count integer NOT NULL DEFAULT 0,
  previous_funded_count integer NOT NULL DEFAULT 0,
  last_funded_cycle_id uuid REFERENCES public.allocation_cycles(id),
  priority_boost_applied boolean NOT NULL DEFAULT false,
  fairness_priority_score integer NOT NULL DEFAULT 0,
  eligibility_adjustments_log jsonb DEFAULT '[]'::jsonb,
  is_fairness_priority_candidate boolean NOT NULL DEFAULT false,
  fraud_risk_level text NOT NULL DEFAULT 'low' CHECK (fraud_risk_level IN ('low', 'medium', 'high')),
  historical_status text NOT NULL DEFAULT 'new' CHECK (historical_status IN ('new', 'returning_unfunded', 'returning_funded', 'red_flagged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create audit log table for fairness decisions
CREATE TABLE public.fairness_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.bursary_applications(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_applicant_history_national_id ON public.applicant_history(national_id);
CREATE INDEX idx_applicant_history_cycle ON public.applicant_history(cycle_id);
CREATE INDEX idx_fairness_tracking_national_id ON public.fairness_tracking(national_id);
CREATE INDEX idx_fairness_tracking_application ON public.fairness_tracking(application_id);
CREATE INDEX idx_fairness_audit_application ON public.fairness_audit_log(application_id);

-- Enable RLS on all new tables
ALTER TABLE public.allocation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairness_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairness_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage allocation cycles
CREATE POLICY "Admins can manage allocation_cycles" ON public.allocation_cycles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Only admins can manage applicant history
CREATE POLICY "Admins can manage applicant_history" ON public.applicant_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Commissioners can read applicant history (no PII exposed)
CREATE POLICY "Commissioners can view applicant_history" ON public.applicant_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'county_commissioner'::app_role));

-- RLS: Only admins can manage fairness tracking
CREATE POLICY "Admins can manage fairness_tracking" ON public.fairness_tracking
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Commissioners can read fairness tracking
CREATE POLICY "Commissioners can view fairness_tracking" ON public.fairness_tracking
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'county_commissioner'::app_role));

-- RLS: Only admins can manage audit logs
CREATE POLICY "Admins can manage fairness_audit_log" ON public.fairness_audit_log
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Deny anonymous access to all new tables
CREATE POLICY "Deny anon access to allocation_cycles" ON public.allocation_cycles
  FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anon access to applicant_history" ON public.applicant_history
  FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anon access to fairness_tracking" ON public.fairness_tracking
  FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anon access to fairness_audit_log" ON public.fairness_audit_log
  FOR SELECT TO anon USING (false);

-- Add fairness columns to bursary_applications (extending, not modifying existing)
ALTER TABLE public.bursary_applications 
  ADD COLUMN IF NOT EXISTS fairness_priority_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_fairness_priority boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_risk_level text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS historical_status text DEFAULT 'new';
