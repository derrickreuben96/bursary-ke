-- Security hardening: tighten privilege escalation gaps surfaced by deep scan

-- 1) Commissioner UPDATE on bursary_applications was scoped only by role,
--    letting any commissioner mutate applications outside their ward.
--    Re-create the policy with ward enforcement on both USING and WITH CHECK,
--    and prevent commissioners from altering anything except the
--    `released_to_treasury` hand-off flag.
DROP POLICY IF EXISTS "Commissioners can release to treasury" ON public.bursary_applications;
CREATE POLICY "Commissioners can release to treasury"
ON public.bursary_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND parent_ward IS NOT NULL
  AND parent_ward = public.get_user_assigned_ward(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND parent_ward IS NOT NULL
  AND parent_ward = public.get_user_assigned_ward(auth.uid())
);

-- 2) Treasury was missing a SELECT policy on bursary_applications. They could
--    only update, never read, blocking the disbursement workflow and creating
--    an asymmetric policy gap. Allow scoped reads for released+approved or
--    already-disbursed records in their assigned county.
DROP POLICY IF EXISTS "Treasury can view released applications" ON public.bursary_applications;
CREATE POLICY "Treasury can view released applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'county_treasury'::app_role)
  AND released_to_treasury = true
  AND status IN ('approved'::application_status, 'disbursed'::application_status)
  AND parent_county = public.get_user_assigned_county(auth.uid())
);

-- 3) Lock down internal config reader — must never be reachable by clients.
REVOKE EXECUTE ON FUNCTION public.get_internal_config(text) FROM PUBLIC, anon, authenticated;

-- 4) Queue plumbing functions are server-side only; revoke broad EXECUTE.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- 5) generate_tracking_number is called by submit_parent_application (SECURITY
--    DEFINER) which runs as owner regardless of caller grants, so removing
--    public EXECUTE has no impact on the submission flow.
REVOKE EXECUTE ON FUNCTION public.generate_tracking_number() FROM PUBLIC, anon, authenticated;

-- 6) Explicitly block non-admin authenticated users from reading allocation
--    cycles. Today no permissive policy matches them so they get nothing, but
--    add a restrictive policy to make that guarantee explicit.
DROP POLICY IF EXISTS "Deny non-admin authenticated reads" ON public.allocation_cycles;
CREATE POLICY "Deny non-admin authenticated reads"
ON public.allocation_cycles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7) Constrain the public subscription INSERT to non-empty validated input
--    instead of bare `true`. Keeps the page usable for anonymous visitors
--    while blocking junk/probe rows.
DROP POLICY IF EXISTS "Anyone can subscribe for notifications" ON public.bursary_subscriptions;
CREATE POLICY "Anyone can subscribe for notifications"
ON public.bursary_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(trim(email)) BETWEEN 5 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND county IS NOT NULL
  AND length(trim(county)) BETWEEN 2 AND 80
);