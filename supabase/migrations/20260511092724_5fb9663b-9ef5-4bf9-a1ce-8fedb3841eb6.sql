-- Broaden INSERT policy on application_status_history so that the
-- log_status_change trigger can record entries for any authorised role
-- whose UPDATE on bursary_applications / student_beneficiaries is itself
-- already gated by RLS. The history row is written by a SECURITY DEFINER
-- trigger but RLS still applies under the invoking user.
DROP POLICY IF EXISTS "Admins can insert status history" ON public.application_status_history;

CREATE POLICY "Authorised roles can insert status history"
ON public.application_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'county_commissioner'::app_role)
  OR has_role(auth.uid(), 'county_treasury'::app_role)
);
