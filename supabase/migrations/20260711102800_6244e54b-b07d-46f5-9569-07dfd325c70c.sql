
-- application_status_history: scope commissioner reads to their assigned ward via bursary_applications
DROP POLICY IF EXISTS "Commissioners can view status history" ON public.application_status_history;
CREATE POLICY "Commissioners can view status history"
ON public.application_status_history
FOR SELECT
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.bursary_applications ba
    WHERE ba.id = application_status_history.application_id
      AND ba.parent_ward IS NOT NULL
      AND ba.parent_ward = get_user_assigned_ward(auth.uid())
  )
);

-- duplicate_detection: scope commissioner reads via matched household or student beneficiary ward
DROP POLICY IF EXISTS "dupdet_commissioner_read" ON public.duplicate_detection;
CREATE POLICY "dupdet_commissioner_read"
ON public.duplicate_detection
FOR SELECT
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND (
    EXISTS (
      SELECT 1 FROM public.households h
      WHERE h.id = duplicate_detection.matched_household_id
        AND h.parent_ward IS NOT NULL
        AND h.parent_ward = get_user_assigned_ward(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.student_beneficiaries sb
      JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
      WHERE sb.id = duplicate_detection.matched_student_id
        AND pa.parent_ward IS NOT NULL
        AND pa.parent_ward = get_user_assigned_ward(auth.uid())
    )
  )
);

-- fraud_flags: scope commissioner reads via parent_applications ward
DROP POLICY IF EXISTS "fraud_flags_commissioner_read" ON public.fraud_flags;
CREATE POLICY "fraud_flags_commissioner_read"
ON public.fraud_flags
FOR SELECT
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = fraud_flags.parent_application_id
      AND pa.parent_ward IS NOT NULL
      AND pa.parent_ward = get_user_assigned_ward(auth.uid())
  )
);

-- household_members: split staff read into ward-scoped commissioner and county-scoped treasury policies
DROP POLICY IF EXISTS "household_members_staff_read" ON public.household_members;

CREATE POLICY "household_members_commissioner_read"
ON public.household_members
FOR SELECT
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = household_members.parent_application_id
      AND pa.parent_ward IS NOT NULL
      AND pa.parent_ward = get_user_assigned_ward(auth.uid())
  )
);

CREATE POLICY "household_members_treasury_read"
ON public.household_members
FOR SELECT
USING (
  has_role(auth.uid(), 'county_treasury'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = household_members.parent_application_id
      AND pa.parent_county IS NOT NULL
      AND pa.parent_county = get_user_assigned_county(auth.uid())
  )
);
