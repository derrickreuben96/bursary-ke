CREATE POLICY "Commissioners can view jurisdiction adverts"
ON public.bursary_adverts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'county_commissioner'::app_role)
  AND (
    (
      public.get_user_assigned_ward(auth.uid()) IS NOT NULL
      AND ward = public.get_user_assigned_ward(auth.uid())
    )
    OR (
      public.get_user_assigned_ward(auth.uid()) IS NULL
      AND public.get_user_assigned_county(auth.uid()) IS NOT NULL
      AND county = public.get_user_assigned_county(auth.uid())
    )
  )
);