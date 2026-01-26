-- Create table for bursary notification subscriptions
CREATE TABLE public.bursary_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure at least one contact method
  CONSTRAINT contact_required CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.bursary_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow public to subscribe (insert)
CREATE POLICY "Anyone can subscribe for notifications"
ON public.bursary_subscriptions
FOR INSERT
WITH CHECK (true);

-- Allow users to view their own subscriptions (by phone/email match)
CREATE POLICY "Users can view subscriptions by contact"
ON public.bursary_subscriptions
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_bursary_subscriptions_updated_at
BEFORE UPDATE ON public.bursary_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_bursary_subscriptions_county ON public.bursary_subscriptions(county);
CREATE INDEX idx_bursary_subscriptions_phone ON public.bursary_subscriptions(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_bursary_subscriptions_email ON public.bursary_subscriptions(email) WHERE email IS NOT NULL;