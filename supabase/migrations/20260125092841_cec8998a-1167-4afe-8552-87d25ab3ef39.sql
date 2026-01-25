-- Create a restricted view for treasury staff with only payment-related fields
-- This prevents treasury staff from accessing full personal details

CREATE VIEW public.bursary_applications_treasury
WITH (security_invoker = on) AS
SELECT 
  id,
  tracking_number,
  student_type,
  status,
  allocated_amount,
  allocation_date,
  ecitizen_ref,
  institution_name,
  created_at,
  updated_at,
  -- Masked versions of PII for identification only
  LEFT(student_full_name, 1) || '***' AS student_name_masked,
  LEFT(parent_county, 20) AS county
FROM public.bursary_applications
WHERE status = 'approved';

-- Update the treasury RLS policy to deny direct SELECT access to base table
-- Treasury must use the view instead
DROP POLICY IF EXISTS "County treasury can view approved applications" ON public.bursary_applications;

CREATE POLICY "County treasury cannot directly access applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (
  NOT has_role(auth.uid(), 'county_treasury'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'county_commissioner'::app_role)
);

-- Grant treasury access to the view
GRANT SELECT ON public.bursary_applications_treasury TO authenticated;