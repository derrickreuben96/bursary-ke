
-- New audit table
CREATE TABLE public.application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.bursary_applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.application_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can select status history"
ON public.application_status_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert status history"
ON public.application_status_history FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commissioners can view status history"
ON public.application_status_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'county_commissioner'::app_role));

CREATE POLICY "Deny anon access to status history"
ON public.application_status_history FOR SELECT TO anon
USING (false);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_status_history
      (application_id, from_status, to_status, changed_by)
    VALUES
      (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_log_status_change
AFTER UPDATE ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

-- Performance index
CREATE INDEX idx_status_history_application
ON public.application_status_history(application_id);
