
-- 1. Extend sms_logs to match the sms-lifecycle router contract
ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS phone_masked text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_ref text;

CREATE INDEX IF NOT EXISTS sms_logs_app_stage_idx
  ON public.sms_logs(application_id, stage);

-- 2. Auto-trigger sms-lifecycle on parent_applications status changes
CREATE OR REPLACE FUNCTION public.auto_trigger_sms_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://adhoebapzgtjrexhwame.supabase.co/functions/v1/sms-lifecycle';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaG9lYmFwemd0anJleGh3YW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNjk5NDgsImV4cCI6MjA4NDc0NTk0OH0.g_sFtlgW3DM6KcKqCVf1YjTWR1vzPxfLjIzt1CsNxoo';
  v_secret text;
  v_stage text;
BEGIN
  -- Map status -> lifecycle stage
  IF TG_OP = 'INSERT' THEN
    v_stage := 'submitted';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_stage := CASE lower(coalesce(NEW.status,''))
      WHEN 'received' THEN 'submitted'
      WHEN 'under_review' THEN 'under_review'
      WHEN 'verified' THEN 'verified'
      WHEN 'shortlisted' THEN 'shortlisted'
      WHEN 'approved' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      WHEN 'disbursed' THEN 'disbursed'
      ELSE NULL
    END;
  ELSE
    RETURN NEW;
  END IF;

  IF v_stage IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT value INTO v_secret FROM _internal.config WHERE key = 'ipn_internal_secret';
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon,
        'Authorization', 'Bearer ' || v_anon,
        'x-internal-secret', coalesce(v_secret,'')
      ),
      body := jsonb_build_object('application_id', NEW.id, 'stage', v_stage)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the transaction
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_sms_lifecycle_ins ON public.parent_applications;
CREATE TRIGGER trg_auto_sms_lifecycle_ins
AFTER INSERT ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.auto_trigger_sms_lifecycle();

DROP TRIGGER IF EXISTS trg_auto_sms_lifecycle_upd ON public.parent_applications;
CREATE TRIGGER trg_auto_sms_lifecycle_upd
AFTER UPDATE OF status ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.auto_trigger_sms_lifecycle();
