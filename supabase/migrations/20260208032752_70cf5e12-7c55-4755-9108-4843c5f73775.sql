-- Add database-level validation CHECK constraints to bursary_applications table
-- This provides server-side validation that cannot be bypassed via direct API calls
-- Note: We use CHECK constraints with length validation instead of altering column types
-- because RLS policies depend on these columns

-- Add CHECK constraint for Kenyan phone number format (0XXXXXXXXX or +254XXXXXXXXX)
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_parent_phone_format 
CHECK (parent_phone ~ '^(\+254|0)[17][0-9]{8}$');

-- Add CHECK constraint for National ID format (8 digits)
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_parent_national_id_format 
CHECK (parent_national_id ~ '^[0-9]{8}$');

-- Add CHECK constraint for tracking number format (BKE-XXXXXX)
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_tracking_number_format 
CHECK (tracking_number ~ '^BKE-[A-Z0-9]{6}$');

-- Add length limits via CHECK constraints (works with TEXT columns)
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_parent_full_name_length 
CHECK (length(parent_full_name) <= 200);

ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_student_full_name_length 
CHECK (length(student_full_name) <= 200);

ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_institution_name_length 
CHECK (length(institution_name) <= 200);

ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_parent_county_length 
CHECK (length(parent_county) <= 100);

-- Add CHECK constraint for email format (if provided) and length
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_parent_email_format 
CHECK (parent_email IS NULL OR parent_email = '' OR (
  parent_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' 
  AND length(parent_email) <= 255
));

-- Add length limit for student_id
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_student_id_length 
CHECK (student_id IS NULL OR length(student_id) <= 50);

-- Add reasonable bounds for poverty-related fields
ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_household_income_bounds 
CHECK (household_income >= 0 AND household_income <= 10000000);

ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_household_dependents_bounds 
CHECK (household_dependents >= 0 AND household_dependents <= 50);

ALTER TABLE public.bursary_applications 
ADD CONSTRAINT check_poverty_score_bounds 
CHECK (poverty_score >= 0 AND poverty_score <= 100);

-- Also add constraints to bursary_subscriptions for consistency
ALTER TABLE public.bursary_subscriptions 
ADD CONSTRAINT check_subscription_phone_format 
CHECK (phone IS NULL OR phone ~ '^(\+254|0)[17][0-9]{8}$');

ALTER TABLE public.bursary_subscriptions 
ADD CONSTRAINT check_subscription_email_format 
CHECK (email IS NULL OR email = '' OR (
  email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND length(email) <= 255
));

ALTER TABLE public.bursary_subscriptions 
ADD CONSTRAINT check_subscription_county_length 
CHECK (length(county) <= 100);