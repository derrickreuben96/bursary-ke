-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit applications" ON public.bursary_applications;

-- Create a more restrictive INSERT policy that validates required fields
CREATE POLICY "Public can submit applications with valid data"
ON public.bursary_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  tracking_number IS NOT NULL 
  AND parent_national_id IS NOT NULL 
  AND parent_full_name IS NOT NULL
  AND parent_phone IS NOT NULL
  AND student_full_name IS NOT NULL
  AND institution_name IS NOT NULL
);