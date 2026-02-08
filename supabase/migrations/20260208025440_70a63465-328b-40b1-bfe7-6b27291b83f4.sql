-- Fix RLS policies for bursary_subscriptions table
-- Add an explicit RESTRICTIVE policy that requires authentication for viewing subscriptions

-- First, drop if exists
DROP POLICY IF EXISTS "Deny anonymous access to subscriptions" ON public.bursary_subscriptions;

-- Create the restrictive policy with proper syntax
CREATE POLICY "Deny anonymous access to subscriptions"
ON public.bursary_subscriptions
FOR SELECT
TO anon, authenticated
USING (auth.uid() IS NOT NULL);

-- For the bursary_applications_treasury view, set security_invoker
ALTER VIEW public.bursary_applications_treasury SET (security_invoker = on);