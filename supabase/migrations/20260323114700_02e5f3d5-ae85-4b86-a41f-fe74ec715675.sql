
-- Add released_to_treasury column (may already exist from partial migration)
ALTER TABLE public.bursary_applications 
ADD COLUMN IF NOT EXISTS released_to_treasury boolean NOT NULL DEFAULT false;

-- Recreate commissioner view with parent_ward and released_to_treasury
DROP VIEW IF EXISTS public.bursary_applications_commissioner CASCADE;

CREATE VIEW public.bursary_applications_commissioner
WITH (security_invoker = on) AS
SELECT 
  id,
  tracking_number,
  student_type::text AS student_type,
  status::text AS status,
  institution_name,
  class_form,
  year_of_study,
  CASE 
    WHEN student_full_name IS NOT NULL AND student_full_name <> '' THEN
      split_part(student_full_name, ' ', 1) || ' ' || 
      COALESCE(left(split_part(student_full_name, ' ', 2), 1), '') || '***'
    ELSE 'N/A'
  END AS student_name_masked,
  CASE 
    WHEN parent_full_name IS NOT NULL AND parent_full_name <> '' THEN
      split_part(parent_full_name, ' ', 1) || ' ' || 
      COALESCE(left(split_part(parent_full_name, ' ', 2), 1), '') || '***'
    ELSE 'N/A'
  END AS parent_name_masked,
  parent_county,
  parent_ward,
  household_income,
  household_dependents,
  poverty_score,
  poverty_tier::text AS poverty_tier,
  allocated_amount,
  allocation_date,
  is_duplicate,
  advert_id,
  ai_decision_reason,
  reviewed_at,
  created_at,
  updated_at,
  released_to_treasury
FROM public.bursary_applications;

-- Recreate commissioner RPC
DROP FUNCTION IF EXISTS public.get_commissioner_applications();

CREATE FUNCTION public.get_commissioner_applications()
RETURNS TABLE(
  id uuid, tracking_number text, student_type text, status text,
  institution_name text, class_form text, year_of_study text,
  student_name_masked text, parent_name_masked text, parent_county text,
  parent_ward text,
  household_income integer, household_dependents integer,
  poverty_score integer, poverty_tier text,
  allocated_amount numeric, allocation_date timestamptz,
  is_duplicate boolean, advert_id uuid,
  ai_decision_reason text, reviewed_at timestamptz,
  created_at timestamptz, updated_at timestamptz,
  released_to_treasury boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.bursary_applications_commissioner
  WHERE (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
$$;

-- Recreate treasury view with released_to_treasury filter
DROP VIEW IF EXISTS public.bursary_applications_treasury CASCADE;

CREATE VIEW public.bursary_applications_treasury
WITH (security_invoker = on) AS
SELECT 
  ba.id,
  ba.tracking_number,
  ba.student_type,
  ba.status,
  ba.institution_name,
  ba.allocated_amount,
  ba.allocation_date,
  ba.ecitizen_ref,
  CASE 
    WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name <> '' THEN
      split_part(ba.student_full_name, ' ', 1) || ' ' || 
      COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
    ELSE 'N/A'
  END AS student_name_masked,
  ba.parent_county AS county,
  ba.created_at,
  ba.updated_at
FROM public.bursary_applications ba
WHERE ba.status IN ('approved', 'disbursed')
  AND ba.released_to_treasury = true;

-- Recreate treasury RPC
DROP FUNCTION IF EXISTS public.get_treasury_applications();

CREATE FUNCTION public.get_treasury_applications()
RETURNS TABLE(
  id uuid, tracking_number text, student_type text, status text,
  institution_name text, allocated_amount numeric, allocation_date timestamptz,
  ecitizen_ref text, student_name_masked text, county text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ba.id, ba.tracking_number, ba.student_type::text, ba.status::text,
    ba.institution_name, ba.allocated_amount, ba.allocation_date,
    ba.ecitizen_ref,
    CASE 
      WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name <> '' THEN
        split_part(ba.student_full_name, ' ', 1) || ' ' || 
        COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
      ELSE 'N/A'
    END AS student_name_masked,
    ba.parent_county AS county,
    ba.created_at,
    ba.updated_at
  FROM public.bursary_applications ba
  WHERE ba.status IN ('approved', 'disbursed')
    AND ba.released_to_treasury = true
    AND (
      has_role(auth.uid(), 'county_treasury'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
$$;

-- Allow commissioners to update (release to treasury)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Commissioners can release to treasury'
  ) THEN
    EXECUTE 'CREATE POLICY "Commissioners can release to treasury"
    ON public.bursary_applications
    FOR UPDATE
    TO authenticated
    USING (has_role(auth.uid(), ''county_commissioner''::app_role))
    WITH CHECK (has_role(auth.uid(), ''county_commissioner''::app_role))';
  END IF;
END $$;
