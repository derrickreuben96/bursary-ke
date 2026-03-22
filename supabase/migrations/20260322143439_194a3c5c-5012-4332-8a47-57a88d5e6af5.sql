
-- Add parent_ward column to bursary_applications
ALTER TABLE public.bursary_applications ADD COLUMN parent_ward text;

-- Create a trigger function to validate ward-specific bursary applications
CREATE OR REPLACE FUNCTION public.validate_ward_bursary_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  advert_ward text;
BEGIN
  -- Only validate if advert_id is provided
  IF NEW.advert_id IS NOT NULL THEN
    SELECT ward INTO advert_ward
    FROM public.bursary_adverts
    WHERE id = NEW.advert_id;

    -- If the bursary is ward-specific, the applicant's ward must match
    IF advert_ward IS NOT NULL AND advert_ward != '' THEN
      IF NEW.parent_ward IS NULL OR NEW.parent_ward != advert_ward THEN
        RAISE EXCEPTION 'This bursary is restricted to residents of % ward. Your ward (%) does not match.', advert_ward, COALESCE(NEW.parent_ward, 'not specified');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger to bursary_applications
CREATE TRIGGER enforce_ward_bursary_match
  BEFORE INSERT ON public.bursary_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ward_bursary_match();
