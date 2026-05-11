DROP POLICY IF EXISTS "Restrict status history modifications to admins" ON public.application_status_history;

CREATE POLICY "Restrict status history updates to admins"
ON public.application_status_history
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Restrict status history deletes to admins"
ON public.application_status_history
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));