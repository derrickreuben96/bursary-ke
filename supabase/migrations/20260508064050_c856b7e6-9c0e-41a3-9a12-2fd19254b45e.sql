
-- Drop the over-permissive commissioner update policy
DROP POLICY IF EXISTS "Commissioners update students" ON public.student_beneficiaries;

-- Ward/county scoped commissioner update policy
CREATE POLICY "Commissioners update students in jurisdiction"
ON public.student_beneficiaries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = student_beneficiaries.parent_application_id
      AND (
        (public.get_user_assigned_ward(auth.uid()) IS NOT NULL
          AND pa.parent_ward = public.get_user_assigned_ward(auth.uid()))
        OR (
          public.get_user_assigned_ward(auth.uid()) IS NULL
          AND public.get_user_assigned_county(auth.uid()) IS NOT NULL
          AND pa.parent_county = public.get_user_assigned_county(auth.uid())
        )
      )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = student_beneficiaries.parent_application_id
      AND (
        (public.get_user_assigned_ward(auth.uid()) IS NOT NULL
          AND pa.parent_ward = public.get_user_assigned_ward(auth.uid()))
        OR (
          public.get_user_assigned_ward(auth.uid()) IS NULL
          AND public.get_user_assigned_county(auth.uid()) IS NOT NULL
          AND pa.parent_county = public.get_user_assigned_county(auth.uid())
        )
      )
  )
  -- Restrict allowed transitions: commissioners may only set approved/rejected
  -- or flip released_to_treasury. Disbursement is treasury-only.
  AND status IN ('received','review','verification','approved','rejected')
);

-- Likewise scope SELECT so commissioners only see their jurisdiction's students
DROP POLICY IF EXISTS "Commissioners view students" ON public.student_beneficiaries;
CREATE POLICY "Commissioners view students in jurisdiction"
ON public.student_beneficiaries
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = student_beneficiaries.parent_application_id
      AND (
        (public.get_user_assigned_ward(auth.uid()) IS NOT NULL
          AND pa.parent_ward = public.get_user_assigned_ward(auth.uid()))
        OR (
          public.get_user_assigned_ward(auth.uid()) IS NULL
          AND public.get_user_assigned_county(auth.uid()) IS NOT NULL
          AND pa.parent_county = public.get_user_assigned_county(auth.uid())
        )
      )
  )
);
