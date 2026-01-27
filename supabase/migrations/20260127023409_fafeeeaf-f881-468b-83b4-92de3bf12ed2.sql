-- Fix 1: Create RLS policies for bursary_applications_treasury view
-- The view already uses security_invoker=on, so we need policies on the underlying view

-- Enable RLS on the view if not already enabled
-- Note: Views don't have RLS in PostgreSQL - instead we ensure the underlying query is protected
-- The view is already created with security_invoker=on which means it respects RLS on base tables

-- However, since the view exposes data from bursary_applications (which has RLS),
-- we need to grant explicit SELECT access to treasury roles through a separate approach

-- Create a function for treasury access that returns only approved applications
CREATE OR REPLACE FUNCTION public.get_treasury_applications()
RETURNS TABLE (
  id uuid,
  tracking_number text,
  student_type text,
  status text,
  institution_name text,
  allocated_amount numeric,
  allocation_date timestamp with time zone,
  ecitizen_ref text,
  student_name_masked text,
  county text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ba.id,
    ba.tracking_number,
    ba.student_type::text,
    ba.status::text,
    ba.institution_name,
    ba.allocated_amount,
    ba.allocation_date,
    ba.ecitizen_ref,
    -- Mask student name: show first name and initial of last name
    CASE 
      WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name != '' THEN
        split_part(ba.student_full_name, ' ', 1) || ' ' || 
        COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
      ELSE 'N/A'
    END as student_name_masked,
    ba.parent_county as county,
    ba.created_at,
    ba.updated_at
  FROM public.bursary_applications ba
  WHERE ba.status IN ('approved', 'disbursed')
    AND (
      has_role(auth.uid(), 'county_treasury'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
$$;

-- Grant execute to authenticated users (the function itself checks roles)
GRANT EXECUTE ON FUNCTION public.get_treasury_applications() TO authenticated;


-- Fix 2: Restrict bursary_subscriptions RLS policies
-- Current policies are too permissive with USING (true)

-- First, drop the overly permissive policies
DROP POLICY IF EXISTS "Users can view subscriptions by contact" ON public.bursary_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.bursary_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.bursary_subscriptions;

-- Create a function to verify subscription ownership via edge function
-- Since anonymous users can't use auth.uid(), we use a different approach:
-- The unsubscribe page calls an edge function that verifies ownership

-- For now, we'll restrict direct table access and require edge function for management
-- Keep INSERT open for subscriptions but restrict SELECT/UPDATE/DELETE to admins only

-- Admin can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.bursary_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update subscriptions
CREATE POLICY "Admins can update subscriptions"
ON public.bursary_subscriptions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete subscriptions
CREATE POLICY "Admins can delete subscriptions"
ON public.bursary_subscriptions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));