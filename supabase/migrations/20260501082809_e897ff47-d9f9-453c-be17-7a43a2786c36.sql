-- Restore anon read access to active bursary adverts.
-- The "Admins can manage adverts" policy was granted to PUBLIC, which causes
-- PostgREST to evaluate has_role() for anonymous users. Since EXECUTE on
-- has_role was revoked from anon during the recent hardening migration,
-- this surfaces as "permission denied for function has_role" and blocks the
-- public homepage. Same fix applied to bursary_subscriptions admin policies.

-- bursary_adverts: scope admin policy to authenticated only
DROP POLICY IF EXISTS "Admins can manage adverts" ON public.bursary_adverts;
CREATE POLICY "Admins can manage adverts"
  ON public.bursary_adverts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- bursary_subscriptions: same hardening (admin-only operations should be authenticated-scoped)
DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.bursary_subscriptions;
CREATE POLICY "Admins can update subscriptions"
  ON public.bursary_subscriptions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete subscriptions" ON public.bursary_subscriptions;
CREATE POLICY "Admins can delete subscriptions"
  ON public.bursary_subscriptions
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));