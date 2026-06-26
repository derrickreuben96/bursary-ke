
-- 1) parent_applications: ward-scope the commissioner UPDATE policy
DROP POLICY IF EXISTS "Commissioners release parent_applications" ON public.parent_applications;
CREATE POLICY "Commissioners release parent_applications"
ON public.parent_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND parent_ward IS NOT NULL
    AND parent_ward = public.get_user_assigned_ward(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND parent_ward IS NOT NULL
    AND parent_ward = public.get_user_assigned_ward(auth.uid())
  )
);

-- 2) ai_allocation_runs: scope commissioner SELECT to their jurisdiction via advert
DROP POLICY IF EXISTS "Commissioners view ai_allocation_runs" ON public.ai_allocation_runs;
CREATE POLICY "Commissioners view ai_allocation_runs"
ON public.ai_allocation_runs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.bursary_adverts adv
      WHERE adv.id = ai_allocation_runs.advert_id
        AND (
          (adv.ward IS NOT NULL AND adv.ward = public.get_user_assigned_ward(auth.uid()))
          OR (
            (adv.ward IS NULL OR adv.ward = '')
            AND adv.county IS NOT NULL
            AND adv.county = public.get_user_assigned_county(auth.uid())
          )
        )
    )
  )
);

-- 3) student_beneficiaries: county-scope treasury UPDATE policy
DROP POLICY IF EXISTS "Treasury marks students disbursed" ON public.student_beneficiaries;
CREATE POLICY "Treasury marks students disbursed"
ON public.student_beneficiaries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'county_treasury'::app_role)
    AND released_to_treasury = true
    AND status IN ('approved','disbursed')
    AND EXISTS (
      SELECT 1 FROM public.parent_applications pa
      WHERE pa.id = student_beneficiaries.parent_application_id
        AND pa.parent_county IS NOT NULL
        AND pa.parent_county = public.get_user_assigned_county(auth.uid())
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'county_treasury'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.parent_applications pa
      WHERE pa.id = student_beneficiaries.parent_application_id
        AND pa.parent_county IS NOT NULL
        AND pa.parent_county = public.get_user_assigned_county(auth.uid())
    )
  )
);
