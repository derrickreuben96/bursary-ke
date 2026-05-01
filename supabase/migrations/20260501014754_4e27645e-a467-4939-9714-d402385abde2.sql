
-- 1) Fix overly permissive SELECT policy on bursary_applications
DROP POLICY IF EXISTS "County treasury cannot directly access applications" ON public.bursary_applications;

-- Admins already have a SELECT policy. Add explicit commissioner SELECT policy.
DROP POLICY IF EXISTS "Commissioners can view applications" ON public.bursary_applications;
CREATE POLICY "Commissioners can view applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'county_commissioner'::app_role));

-- 2) Tighten storage upload policy on applicant-documents bucket
DROP POLICY IF EXISTS "Anyone can upload applicant documents" ON storage.objects;

-- Allow anonymous uploads only into a tracking-number-prefixed folder that exists
CREATE POLICY "Applicants can upload documents under valid tracking number"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applicant-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) BETWEEN 6 AND 64
);

-- 3) Lock down SECURITY DEFINER function execute privileges
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_treasury_applications() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_commissioner_applications() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_assigned_county(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_assigned_ward(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_treasury_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commissioner_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_assigned_county(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_assigned_ward(uuid) TO authenticated;
