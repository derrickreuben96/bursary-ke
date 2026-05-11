-- The FK only pointed to bursary_applications, but log_student_status_change()
-- inserts rows whose application_id is a parent_applications.id. That FK
-- violation was rolling back every commissioner UPDATE silently.
ALTER TABLE public.application_status_history
  DROP CONSTRAINT IF EXISTS application_status_history_application_id_fkey;

-- Keep lookups fast without the FK
CREATE INDEX IF NOT EXISTS idx_app_status_history_app_id
  ON public.application_status_history(application_id);