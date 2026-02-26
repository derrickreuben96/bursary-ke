
-- Fix the SECURITY DEFINER view warning by using SECURITY INVOKER
ALTER VIEW public.bursary_applications_commissioner SET (security_invoker = on);
