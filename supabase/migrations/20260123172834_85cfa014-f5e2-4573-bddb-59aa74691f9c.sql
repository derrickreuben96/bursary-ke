-- Drop the restrictive policy and create a permissive one for public access
DROP POLICY IF EXISTS "Public can view active adverts" ON public.bursary_adverts;

-- Create a PERMISSIVE policy (default) for public to view active adverts
CREATE POLICY "Public can view active adverts" 
ON public.bursary_adverts 
FOR SELECT 
TO anon, authenticated
USING (is_active = true);