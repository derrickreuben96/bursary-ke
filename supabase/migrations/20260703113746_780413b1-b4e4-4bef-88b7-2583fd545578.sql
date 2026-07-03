-- Lock down anon-callable internals (only tracking/submission endpoints should be public)
REVOKE EXECUTE ON FUNCTION public.compute_fraud_score(uuid) FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compute_fraud_score(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.assign_household_child_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_household_tracking_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_trigger_sms_lifecycle() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.derive_assessment_pipeline() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_household_tracking_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_advert_quotas() FROM anon, authenticated, PUBLIC;

-- Trigger-only functions: revoke authenticated too (they run via trigger owner)
REVOKE EXECUTE ON FUNCTION public.auto_expire_advert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_trigger_disbursement() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_advert_when_fully_disbursed() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_dashboard_event() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.emit_parent_dashboard_event() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_max_three_students() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_unique_student_per_advert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_commissioner_student_update() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_student_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_household_poverty() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.propagate_legacy_to_students() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_expired_adverts() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_advert_county_ward() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_parent_ward_bursary_match() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_ward_bursary_match() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, text, text, text, jsonb) FROM anon, PUBLIC;