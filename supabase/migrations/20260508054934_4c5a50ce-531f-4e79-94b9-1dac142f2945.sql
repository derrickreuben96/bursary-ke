
-- 1. audit_runs
CREATE TABLE public.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  suite text NOT NULL,
  total int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  duration_ms int NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pass','fail','partial')),
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  deployment_ref text
);
CREATE INDEX idx_audit_runs_run_at ON public.audit_runs(run_at DESC);
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage audit_runs" ON public.audit_runs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Deny anon audit_runs" ON public.audit_runs FOR SELECT TO anon USING (false);

-- 2. sync_metrics
CREATE TABLE public.sync_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_sync_metrics_recorded_at ON public.sync_metrics(recorded_at DESC);
CREATE INDEX idx_sync_metrics_metric ON public.sync_metrics(metric, recorded_at DESC);
ALTER TABLE public.sync_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sync_metrics" ON public.sync_metrics FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated can insert sync_metrics" ON public.sync_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Deny anon sync_metrics" ON public.sync_metrics FOR SELECT TO anon USING (false);

-- 3. provisioning_invites
CREATE TABLE public.provisioning_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL,
  assigned_county text,
  assigned_ward text,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  notes text
);
CREATE INDEX idx_provisioning_invites_email ON public.provisioning_invites(email);
ALTER TABLE public.provisioning_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage provisioning_invites" ON public.provisioning_invites FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Deny anon provisioning_invites" ON public.provisioning_invites FOR SELECT TO anon USING (false);

-- 4. Sanitized realtime broadcast trigger (no PII in payload)
CREATE OR REPLACE FUNCTION public.emit_dashboard_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  payload jsonb;
  ward_topic text;
  county_topic text;
BEGIN
  payload := jsonb_build_object(
    'application_id', NEW.id,
    'op', TG_OP,
    'status', NEW.status::text,
    'released_to_treasury', NEW.released_to_treasury,
    'ts', extract(epoch from now())
  );
  BEGIN
    PERFORM realtime.send(payload, 'app.change', 'dashboard:admin', false);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  IF NEW.parent_ward IS NOT NULL THEN
    ward_topic := 'dashboard:commissioner:' || lower(replace(NEW.parent_ward, ' ', '_'));
    BEGIN
      PERFORM realtime.send(payload, 'app.change', ward_topic, false);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF NEW.parent_county IS NOT NULL THEN
    county_topic := 'dashboard:treasury:' || lower(replace(NEW.parent_county, ' ', '_'));
    BEGIN
      PERFORM realtime.send(payload, 'app.change', county_topic, false);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apps_emit_dashboard_event ON public.bursary_applications;
CREATE TRIGGER trg_apps_emit_dashboard_event
AFTER INSERT OR UPDATE OF status, released_to_treasury
ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.emit_dashboard_event();

-- 5. Workflow backlog snapshot (no PII)
CREATE OR REPLACE FUNCTION public.workflow_backlog_snapshot()
RETURNS TABLE(metric text, value bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'received_pending'::text, count(*)::bigint FROM bursary_applications WHERE status::text='received'
  UNION ALL SELECT 'under_review', count(*) FROM bursary_applications WHERE status::text='under_review'
  UNION ALL SELECT 'approved_not_released', count(*) FROM bursary_applications WHERE status::text='approved' AND released_to_treasury=false
  UNION ALL SELECT 'released_pending_disbursement', count(*) FROM bursary_applications WHERE released_to_treasury=true AND status::text='approved'
  UNION ALL SELECT 'disbursed_24h', count(*) FROM bursary_applications WHERE status::text='disbursed' AND updated_at > now() - interval '24 hours'
  UNION ALL SELECT 'rejected_24h', count(*) FROM bursary_applications WHERE status::text='rejected' AND updated_at > now() - interval '24 hours';
$$;
REVOKE ALL ON FUNCTION public.workflow_backlog_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workflow_backlog_snapshot() TO authenticated;
