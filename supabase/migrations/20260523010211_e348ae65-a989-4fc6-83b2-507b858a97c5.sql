
-- ============================================================
-- Security hardening migration
-- ============================================================

-- 1) bursary_applications: restrict public INSERT scoring fields
DROP POLICY IF EXISTS "Public can submit applications with valid data" ON public.bursary_applications;
CREATE POLICY "Public can submit applications with valid data"
ON public.bursary_applications
FOR INSERT
WITH CHECK (
  tracking_number IS NOT NULL
  AND parent_national_id IS NOT NULL
  AND parent_full_name IS NOT NULL
  AND parent_phone IS NOT NULL
  AND student_full_name IS NOT NULL
  AND institution_name IS NOT NULL
  AND status = 'received'::application_status
  AND released_to_treasury = false
  AND allocated_amount IS NULL
  AND allocation_date IS NULL
  AND ai_decision_reason IS NULL
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND COALESCE(fraud_risk_level, 'low') = 'low'
  AND COALESCE(historical_status, 'new') = 'new'
  AND COALESCE(is_fairness_priority, false) = false
  AND COALESCE(fairness_priority_score, 0) = 0
  AND COALESCE(is_duplicate, false) = false
  AND duplicate_of IS NULL
);

-- 2) parent_applications: restrict public INSERT scoring/decision fields
DROP POLICY IF EXISTS "Public can submit parent_applications" ON public.parent_applications;
CREATE POLICY "Public can submit parent_applications"
ON public.parent_applications
FOR INSERT
WITH CHECK (
  tracking_number IS NOT NULL
  AND advert_id IS NOT NULL
  AND parent_national_id IS NOT NULL
  AND parent_full_name IS NOT NULL
  AND parent_phone IS NOT NULL
  AND status = 'received'
  AND current_stage = 'received'
  AND workflow_stage = 'submitted'
  AND released_to_treasury = false
  AND ai_decision_reason IS NULL
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND COALESCE(poverty_score, 0) = 0
  AND poverty_tier IS NULL
);

-- 3) student_beneficiaries: restrict public INSERT decision fields
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='student_beneficiaries' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.student_beneficiaries', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Public can submit student_beneficiaries"
ON public.student_beneficiaries
FOR INSERT
WITH CHECK (
  parent_application_id IS NOT NULL
  AND student_full_name IS NOT NULL
  AND student_identifier IS NOT NULL
  AND institution_name IS NOT NULL
  AND status = 'received'
  AND released_to_treasury = false
  AND allocated_amount IS NULL
  AND allocation_date IS NULL
  AND ai_decision_reason IS NULL
);

-- 4) sync_metrics: restrict INSERT to admin/service only
DROP POLICY IF EXISTS "Authenticated can insert sync_metrics" ON public.sync_metrics;
CREATE POLICY "Admins can insert sync_metrics"
ON public.sync_metrics
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Storage: explicit UPDATE/DELETE policies for applicant-documents (admin only)
DROP POLICY IF EXISTS "Admins can update applicant documents" ON storage.objects;
CREATE POLICY "Admins can update applicant documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'applicant-documents' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'applicant-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete applicant documents" ON storage.objects;
CREATE POLICY "Admins can delete applicant documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'applicant-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Fix function search_path mutability
ALTER FUNCTION public.generate_tracking_number() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 7) Revoke EXECUTE from anon/PUBLIC on SECURITY DEFINER functions that should
--    not be callable by unauthenticated clients. Trigger functions never need
--    EXECUTE granted to roles; admin RPCs require auth.
REVOKE EXECUTE ON FUNCTION public.auto_expire_advert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_trigger_disbursement() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_advert_when_fully_disbursed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emit_dashboard_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.emit_parent_dashboard_event() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_max_three_students() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_unique_student_per_advert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_commissioner_student_update() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_status_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_student_status_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_household_poverty() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.propagate_legacy_to_students() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sweep_expired_adverts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_advert_county_ward() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_parent_ward_bursary_match() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_ward_bursary_match() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_parent_applications_for_commissioner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_treasury_applications() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_treasury_student_beneficiaries() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.treasury_disburse_applications(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon;

-- Public/anon flows that must remain callable: submit_parent_application,
-- get_parent_application_by_tracking, tracking_number_exists. Leave as-is.
