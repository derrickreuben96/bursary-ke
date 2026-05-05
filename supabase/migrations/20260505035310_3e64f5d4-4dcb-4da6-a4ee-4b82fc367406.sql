DROP POLICY IF EXISTS "Applicants can upload documents under valid tracking number" ON storage.objects;

CREATE POLICY "Applicants can upload documents under valid folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applicant-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    -- Real submitted application
    EXISTS (
      SELECT 1 FROM public.bursary_applications ba
      WHERE ba.tracking_number = (storage.foldername(name))[1]
    )
    OR
    -- Pre-submission temporary folder, strict format: temp-<13 digit ms timestamp>
    (storage.foldername(name))[1] ~ '^temp-[0-9]{10,16}$'
  )
);