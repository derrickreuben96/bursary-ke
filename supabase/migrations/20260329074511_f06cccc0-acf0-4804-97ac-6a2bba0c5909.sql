ALTER TABLE public.bursary_adverts
ADD COLUMN IF NOT EXISTS max_slots INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.bursary_adverts.max_slots IS 
  'Maximum number of bursary recipients for this advert. NULL means budget-limited only.';

ALTER TABLE public.fairness_tracking
ADD COLUMN IF NOT EXISTS data_consistency_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS consistency_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS previous_poverty_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS previous_income_bracket TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS previous_household_size INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.fairness_tracking.data_consistency_score IS
  '0-100. Starts at 100. Reduced when key poverty data changes significantly between cycles. Lower score = lower trust.';