
DO $$ BEGIN
  CREATE TYPE public.policy_status AS ENUM ('draft','pending','active','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. policy_profiles
CREATE TABLE IF NOT EXISTS public.policy_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  body JSONB NOT NULL,
  status public.policy_status NOT NULL DEFAULT 'draft',
  reason TEXT,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_profiles TO authenticated;
GRANT ALL ON public.policy_profiles TO service_role;
ALTER TABLE public.policy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_profiles admin read" ON public.policy_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "policy_profiles admin insert" ON public.policy_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "policy_profiles admin update" ON public.policy_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "policy_profiles admin delete" ON public.policy_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_policy_profiles_updated BEFORE UPDATE ON public.policy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. policy_audit_log
CREATE TABLE IF NOT EXISTS public.policy_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID REFERENCES public.policy_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.policy_audit_log TO authenticated;
GRANT ALL ON public.policy_audit_log TO service_role;
ALTER TABLE public.policy_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_audit_log admin read" ON public.policy_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "policy_audit_log admin insert" ON public.policy_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));

-- 3. ai_recommendation_log
CREATE TABLE IF NOT EXISTS public.ai_recommendation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_beneficiary_id UUID,
  household_id UUID,
  policy_id UUID REFERENCES public.policy_profiles(id) ON DELETE SET NULL,
  policy_version TEXT NOT NULL,
  needs_score INT NOT NULL,
  recommended_allocation NUMERIC NOT NULL DEFAULT 0,
  confidence TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_hash TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_reclog_student ON public.ai_recommendation_log(student_beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_ai_reclog_generated ON public.ai_recommendation_log(generated_at DESC);
GRANT SELECT, INSERT ON public.ai_recommendation_log TO authenticated;
GRANT ALL ON public.ai_recommendation_log TO service_role;
ALTER TABLE public.ai_recommendation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_recommendation_log admin read" ON public.ai_recommendation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "ai_recommendation_log admin insert" ON public.ai_recommendation_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- 4. simulation_runs
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policy_profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.simulation_runs TO authenticated;
GRANT ALL ON public.simulation_runs TO service_role;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulation_runs admin read" ON public.simulation_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "simulation_runs admin insert" ON public.simulation_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));

-- 5. governance_notifications
CREATE TABLE IF NOT EXISTS public.governance_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.governance_notifications TO authenticated;
GRANT ALL ON public.governance_notifications TO service_role;
ALTER TABLE public.governance_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_notifications admin read" ON public.governance_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
CREATE POLICY "governance_notifications admin insert" ON public.governance_notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "governance_notifications admin ack" ON public.governance_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'governance_approver'::app_role));
