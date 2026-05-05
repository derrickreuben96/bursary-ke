CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  source text,
  ip_address text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time
  ON public.security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_time
  ON public.security_events (ip_address, created_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view security events"
ON public.security_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage security events"
ON public.security_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anon select on security_events"
ON public.security_events FOR SELECT TO anon USING (false);

-- Logging RPC: callable by anon/authenticated, validated input, no read access
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _severity text DEFAULT 'info',
  _source text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  recent_count int;
BEGIN
  IF _event_type IS NULL OR length(_event_type) = 0 OR length(_event_type) > 80 THEN
    RAISE EXCEPTION 'invalid event_type';
  END IF;
  IF _severity NOT IN ('info','warn','error','critical') THEN
    _severity := 'info';
  END IF;

  -- Lightweight per-IP flood guard (max 60 events / 5 min per ip+type)
  IF _ip IS NOT NULL THEN
    SELECT count(*) INTO recent_count
    FROM public.security_events
    WHERE ip_address = _ip
      AND event_type = _event_type
      AND created_at > now() - interval '5 minutes';
    IF recent_count > 60 THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.security_events
    (event_type, severity, source, ip_address, user_agent, details)
  VALUES
    (_event_type, _severity, _source, _ip, _user_agent,
     COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_event(text,text,text,text,text,jsonb) TO anon, authenticated;