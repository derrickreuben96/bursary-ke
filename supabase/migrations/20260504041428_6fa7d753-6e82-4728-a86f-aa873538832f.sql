-- Idempotent protection: prevent the same applicant from creating duplicate
-- submissions for the same advert (e.g. via double-click / retries while
-- locations or network load). Allows resubmission only after a prior attempt
-- was rejected.
CREATE UNIQUE INDEX IF NOT EXISTS bursary_applications_unique_active_submission
  ON public.bursary_applications (parent_national_id, advert_id)
  WHERE status <> 'rejected';

-- Safety net: also prevent two rows ever sharing a tracking_number
-- (generate_tracking_number already retries, but enforce at the DB level).
CREATE UNIQUE INDEX IF NOT EXISTS bursary_applications_tracking_number_key
  ON public.bursary_applications (tracking_number);