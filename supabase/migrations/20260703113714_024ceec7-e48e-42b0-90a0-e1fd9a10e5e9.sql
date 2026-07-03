GRANT EXECUTE ON FUNCTION public.compute_fraud_score(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_household_by_id(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_application_by_tracking(text, text) TO anon, authenticated;