-- Restore EXECUTE on generate_tracking_number for applicants.
-- It generates a random opaque code and only reads bursary_applications
-- to check uniqueness. Submission flow calls it before submit_parent_application.
GRANT EXECUTE ON FUNCTION public.generate_tracking_number() TO anon, authenticated;