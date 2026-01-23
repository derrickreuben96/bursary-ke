-- Fix: Ensure bursary_applications table only allows authorized role-based access
-- The current RESTRICTIVE policies already limit access, but we need to ensure 
-- anonymous users cannot access the table at all

-- First, drop any existing permissive policies that might allow broader access
-- Then verify all policies are restrictive and role-based

-- Add an explicit deny policy for anonymous users to make intent clear
-- Since all existing policies use RESTRICTIVE and require has_role(), 
-- anonymous users are already blocked. However, let's add explicit documentation.

-- Verify the policies are working by checking if there's any gap
-- The current policies are:
-- 1. Admins can update applications (RESTRICTIVE) - requires admin role
-- 2. Admins can view all applications (RESTRICTIVE) - requires admin role  
-- 3. County commissioner can view all applications (RESTRICTIVE) - requires county_commissioner role
-- 4. County treasury can view approved applications (RESTRICTIVE) - requires county_treasury role AND status=approved
-- 5. Public can submit applications with valid data (RESTRICTIVE INSERT)

-- These are all RESTRICTIVE policies which means ALL must pass for access.
-- This is actually a problem - we need at least one PERMISSIVE policy for the USING clause to pass.
-- Let's fix this by converting the appropriate policies to PERMISSIVE

-- Drop existing SELECT policies and recreate them as PERMISSIVE
DROP POLICY IF EXISTS "Admins can view all applications" ON public.bursary_applications;
DROP POLICY IF EXISTS "County commissioner can view all applications" ON public.bursary_applications;
DROP POLICY IF EXISTS "County treasury can view approved applications" ON public.bursary_applications;

-- Recreate as PERMISSIVE policies (at least one must pass)
CREATE POLICY "Admins can view all applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "County commissioner can view all applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'county_commissioner'::app_role));

CREATE POLICY "County treasury can view approved applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'county_treasury'::app_role) AND status = 'approved'::application_status);