-- application_decision_log: scope by ward (commissioner) / county (treasury)
DROP POLICY IF EXISTS decision_log_admin_read ON public.application_decision_log;
CREATE POLICY decision_log_admin_read ON public.application_decision_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      has_role(auth.uid(), 'county_commissioner'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.parent_applications pa
        WHERE pa.id = application_decision_log.parent_application_id
          AND pa.parent_ward IS NOT NULL
          AND pa.parent_ward = public.get_user_assigned_ward(auth.uid())
      )
    )
    OR (
      has_role(auth.uid(), 'county_treasury'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.parent_applications pa
        WHERE pa.id = application_decision_log.parent_application_id
          AND pa.parent_county IS NOT NULL
          AND pa.parent_county = public.get_user_assigned_county(auth.uid())
      )
    )
  );

-- household_child_codes: scope commissioner reads by ward, treasury by county
DROP POLICY IF EXISTS child_codes_commissioner_read ON public.household_child_codes;
CREATE POLICY child_codes_commissioner_read ON public.household_child_codes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.parent_applications pa
      WHERE pa.id = household_child_codes.parent_application_id
        AND pa.parent_ward IS NOT NULL
        AND pa.parent_ward = public.get_user_assigned_ward(auth.uid())
    )
  );

DROP POLICY IF EXISTS child_codes_treasury_read ON public.household_child_codes;
CREATE POLICY child_codes_treasury_read ON public.household_child_codes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_treasury'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.parent_applications pa
      WHERE pa.id = household_child_codes.parent_application_id
        AND pa.parent_county IS NOT NULL
        AND pa.parent_county = public.get_user_assigned_county(auth.uid())
    )
  );