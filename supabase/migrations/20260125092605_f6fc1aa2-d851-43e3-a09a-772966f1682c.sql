-- Add explicit RLS policy to deny anonymous/public SELECT access to bursary_applications
-- This ensures unauthenticated users cannot query sensitive applicant data

CREATE POLICY "Deny anonymous access to applications"
ON public.bursary_applications
FOR SELECT
TO anon
USING (false);