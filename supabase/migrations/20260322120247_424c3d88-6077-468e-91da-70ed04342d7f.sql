-- Create profiles table for ward/county scoping
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  assigned_county text,
  assigned_ward text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins can manage all profiles
CREATE POLICY "Admins can manage profiles"
ON public.profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Deny anon
CREATE POLICY "Deny anon access to profiles"
ON public.profiles FOR SELECT TO anon
USING (false);

-- Functions to get assigned ward/county for current user
CREATE OR REPLACE FUNCTION public.get_user_assigned_county(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT assigned_county FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_assigned_ward(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT assigned_ward FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;