-- 1) Replace permissive storage INSERT policy with one that verifies tracking_number exists
DROP POLICY IF EXISTS "Applicants can upload documents under valid tracking number" ON storage.objects;

CREATE POLICY "Applicants can upload documents under valid tracking number"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applicant-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) BETWEEN 6 AND 64
  AND EXISTS (
    SELECT 1 FROM public.bursary_applications ba
    WHERE ba.tracking_number = (storage.foldername(name))[1]
  )
);

-- 2) Lock down fairness_audit_log: explicit restrictive deny for non-admins
CREATE POLICY "Restrict fairness_audit_log writes to admins"
ON public.fairness_audit_log
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Lock down application_status_history: restrict UPDATE/DELETE to admins only
CREATE POLICY "Restrict status history modifications to admins"
ON public.application_status_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));