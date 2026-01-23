-- Create enum for application status
CREATE TYPE public.application_status AS ENUM ('received', 'review', 'verification', 'approved', 'rejected', 'disbursed');

-- Create enum for student type
CREATE TYPE public.student_type AS ENUM ('secondary', 'university');

-- Create enum for poverty tier
CREATE TYPE public.poverty_tier AS ENUM ('Low', 'Medium', 'High');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for secure role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create bursary_applications table
CREATE TABLE public.bursary_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number TEXT UNIQUE NOT NULL,
    student_type student_type NOT NULL,
    status application_status NOT NULL DEFAULT 'received',
    
    -- Parent/Guardian Information (encrypted/masked in display)
    parent_national_id TEXT NOT NULL,
    parent_full_name TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    parent_email TEXT,
    parent_county TEXT NOT NULL,
    sms_consent BOOLEAN NOT NULL DEFAULT false,
    
    -- Student Information
    student_full_name TEXT NOT NULL,
    student_id TEXT, -- University student ID or NEMIS ID for secondary
    institution_name TEXT NOT NULL,
    year_of_study TEXT,
    class_form TEXT, -- For secondary students
    
    -- Poverty Assessment
    household_income INTEGER NOT NULL,
    household_dependents INTEGER NOT NULL,
    poverty_score INTEGER NOT NULL,
    poverty_tier poverty_tier NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on bursary_applications
ALTER TABLE public.bursary_applications ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bursary_applications
-- Anyone can insert applications (public submission)
CREATE POLICY "Anyone can submit applications"
ON public.bursary_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can view their own application by tracking number (via phone lookup - handled in edge function)
-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.bursary_applications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.bursary_applications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bursary_applications_updated_at
BEFORE UPDATE ON public.bursary_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate tracking number
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric
    new_number := 'BKE-' || upper(substr(md5(random()::text), 1, 6));
    
    -- Check if it already exists
    SELECT COUNT(*) INTO exists_count 
    FROM public.bursary_applications 
    WHERE tracking_number = new_number;
    
    EXIT WHEN exists_count = 0;
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;