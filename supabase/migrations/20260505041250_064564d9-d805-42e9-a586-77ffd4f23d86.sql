-- SECURITY DEFINER helper so anon storage policy can validate tracking numbers
CREATE OR REPLACE FUNCTION public.tracking_number_exists(_tn text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bursary_applications WHERE tracking_number = _tn
  );
$$;

REVOKE ALL ON FUNCTION public.tracking_number_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tracking_number_exists(text) TO anon, authenticated;

-- Replace storage upload policy to use the SECURITY DEFINER check
DROP POLICY IF EXISTS "Applicants can upload documents under valid folder" ON storage.objects;
DROP POLICY IF EXISTS "Applicants can upload documents under valid tracking number" ON storage.objects;

CREATE POLICY "Applicants can upload documents under valid folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applicant-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    (storage.foldername(name))[1] ~ '^temp-[0-9]{10,16}$'
    OR public.tracking_number_exists((storage.foldername(name))[1])
  )
);