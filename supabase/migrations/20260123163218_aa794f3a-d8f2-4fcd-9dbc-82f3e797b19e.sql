-- Create bursary_adverts table for running bursary advertisements
CREATE TABLE public.bursary_adverts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  ward TEXT,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  budget_amount NUMERIC(12,2),
  venues JSONB DEFAULT '[]'::jsonb,
  required_documents TEXT[] DEFAULT ARRAY['National ID (Parent/Guardian)', 'Birth Certificate', 'School Admission Letter', 'Fee Structure', 'Academic Transcripts', 'Death Certificate (if orphan)', 'Medical Certificate (if disabled)'],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on bursary_adverts
ALTER TABLE public.bursary_adverts ENABLE ROW LEVEL SECURITY;

-- Public can view active adverts
CREATE POLICY "Public can view active adverts"
ON public.bursary_adverts
FOR SELECT
USING (is_active = true);

-- Admins can manage adverts
CREATE POLICY "Admins can manage adverts"
ON public.bursary_adverts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add columns to bursary_applications for allocation tracking
ALTER TABLE public.bursary_applications 
ADD COLUMN IF NOT EXISTS ai_decision_reason TEXT,
ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS allocation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ecitizen_ref TEXT,
ADD COLUMN IF NOT EXISTS advert_id UUID REFERENCES public.bursary_adverts(id),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.bursary_applications(id);

-- Enable realtime for bursary_applications
ALTER PUBLICATION supabase_realtime ADD TABLE public.bursary_applications;

-- Add RLS policy for county treasury to view approved applications
CREATE POLICY "County treasury can view approved applications"
ON public.bursary_applications
FOR SELECT
USING (
  has_role(auth.uid(), 'county_treasury'::app_role) 
  AND status = 'approved'
);

-- Add RLS policy for county commissioner to view all applications
CREATE POLICY "County commissioner can view all applications"
ON public.bursary_applications
FOR SELECT
USING (has_role(auth.uid(), 'county_commissioner'::app_role));

-- Create trigger for updated_at on bursary_adverts
CREATE TRIGGER update_bursary_adverts_updated_at
BEFORE UPDATE ON public.bursary_adverts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();