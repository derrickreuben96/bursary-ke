
-- ============================================================
-- FIX 1: Create commissioner view that masks PII
-- Commissioners should NOT see raw national IDs, phone numbers, or emails
-- ============================================================

-- Create a view for commissioners with masked PII
CREATE OR REPLACE VIEW public.bursary_applications_commissioner AS
SELECT 
  ba.id,
  ba.tracking_number,
  ba.student_type::text,
  ba.status::text,
  ba.institution_name,
  ba.class_form,
  ba.year_of_study,
  -- Mask student name: first name + initial
  CASE 
    WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name != '' THEN
      split_part(ba.student_full_name, ' ', 1) || ' ' || 
      COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
    ELSE 'N/A'
  END as student_name_masked,
  -- Mask parent name similarly
  CASE 
    WHEN ba.parent_full_name IS NOT NULL AND ba.parent_full_name != '' THEN
      split_part(ba.parent_full_name, ' ', 1) || ' ' || 
      COALESCE(left(split_part(ba.parent_full_name, ' ', 2), 1), '') || '***'
    ELSE 'N/A'
  END as parent_name_masked,
  ba.parent_county,
  ba.household_income,
  ba.household_dependents,
  ba.poverty_score,
  ba.poverty_tier::text,
  ba.allocated_amount,
  ba.allocation_date,
  ba.is_duplicate,
  ba.advert_id,
  ba.ai_decision_reason,
  ba.reviewed_at,
  ba.created_at,
  ba.updated_at
FROM public.bursary_applications ba;

-- Create a SECURITY DEFINER function for commissioner access
CREATE OR REPLACE FUNCTION public.get_commissioner_applications()
RETURNS TABLE(
  id uuid,
  tracking_number text,
  student_type text,
  status text,
  institution_name text,
  class_form text,
  year_of_study text,
  student_name_masked text,
  parent_name_masked text,
  parent_county text,
  household_income integer,
  household_dependents integer,
  poverty_score integer,
  poverty_tier text,
  allocated_amount numeric,
  allocation_date timestamptz,
  is_duplicate boolean,
  advert_id uuid,
  ai_decision_reason text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.bursary_applications_commissioner
  WHERE (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
$$;

-- Drop the old commissioner SELECT policy that exposes all PII
DROP POLICY IF EXISTS "County commissioner can view all applications" ON public.bursary_applications;

-- ============================================================
-- FIX 2: Fix bursary_subscriptions SELECT policies
-- All are RESTRICTIVE which means no one can read (broken).
-- Replace with a single PERMISSIVE admin-only SELECT policy.
-- ============================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.bursary_subscriptions;
DROP POLICY IF EXISTS "Deny anonymous access to subscriptions" ON public.bursary_subscriptions;

-- Create a single PERMISSIVE SELECT policy restricted to admins only
CREATE POLICY "Only admins can view subscriptions"
ON public.bursary_subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
