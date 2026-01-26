-- Allow users to update their own subscriptions (deactivate)
CREATE POLICY "Users can update their own subscriptions"
ON public.bursary_subscriptions
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow users to delete their own subscriptions
CREATE POLICY "Users can delete their own subscriptions"
ON public.bursary_subscriptions
FOR DELETE
USING (true);