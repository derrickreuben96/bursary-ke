
-- Allow treasury users to update applications they can see (released to them)
CREATE POLICY "Treasury can mark as disbursed"
ON public.bursary_applications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'county_treasury'::app_role)
  AND released_to_treasury = true
  AND status = 'approved'
  AND parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  has_role(auth.uid(), 'county_treasury'::app_role)
  AND status = 'disbursed'
);
