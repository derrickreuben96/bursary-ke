-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function: auto-flip is_active when deadline has passed
CREATE OR REPLACE FUNCTION public.auto_expire_advert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deadline IS NOT NULL AND NEW.deadline < now() THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_expire_advert ON public.bursary_adverts;
CREATE TRIGGER trg_auto_expire_advert
BEFORE INSERT OR UPDATE ON public.bursary_adverts
FOR EACH ROW
EXECUTE FUNCTION public.auto_expire_advert();

-- Sweep function: bulk-deactivate any adverts whose deadline has passed
CREATE OR REPLACE FUNCTION public.sweep_expired_adverts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.bursary_adverts
     SET is_active = false,
         updated_at = now()
   WHERE is_active = true
     AND deadline IS NOT NULL
     AND deadline < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Run the sweep immediately to clean current state
SELECT public.sweep_expired_adverts();

-- Schedule the sweep every 5 minutes (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-expired-adverts') THEN
    PERFORM cron.unschedule('sweep-expired-adverts');
  END IF;
  PERFORM cron.schedule(
    'sweep-expired-adverts',
    '*/5 * * * *',
    $cron$ SELECT public.sweep_expired_adverts(); $cron$
  );
END;
$$;