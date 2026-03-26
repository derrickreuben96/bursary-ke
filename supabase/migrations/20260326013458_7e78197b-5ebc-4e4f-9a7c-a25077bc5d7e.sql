-- Task 1: Update get_treasury_applications to filter by assigned county server-side
CREATE OR REPLACE FUNCTION public.get_treasury_applications()
RETURNS TABLE(
  id uuid, tracking_number text, student_type text, status text,
  institution_name text, allocated_amount numeric, allocation_date timestamptz,
  ecitizen_ref text, student_name_masked text, county text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT 
    ba.id, ba.tracking_number, ba.student_type::text, ba.status::text,
    ba.institution_name, ba.allocated_amount, ba.allocation_date,
    ba.ecitizen_ref,
    CASE 
      WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name <> '' THEN
        split_part(ba.student_full_name, ' ', 1) || ' ' || 
        COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
      ELSE 'N/A'
    END AS student_name_masked,
    ba.parent_county AS county,
    ba.created_at,
    ba.updated_at
  FROM public.bursary_applications ba
  WHERE ba.status IN ('approved', 'disbursed')
    AND ba.released_to_treasury = true
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        has_role(auth.uid(), 'county_treasury'::app_role)
        AND ba.parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
$$;

-- Task 2: Create storage bucket for applicant documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-documents', 'applicant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Anyone can upload documents (anon for application submissions)
CREATE POLICY "Anyone can upload applicant documents"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'applicant-documents');

-- Only admins and commissioners can view documents  
CREATE POLICY "Staff can view applicant documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'applicant-documents'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'county_commissioner'::app_role)
  )
);

-- Add document_urls column to bursary_applications
ALTER TABLE public.bursary_applications 
ADD COLUMN IF NOT EXISTS document_urls jsonb DEFAULT '[]'::jsonb;