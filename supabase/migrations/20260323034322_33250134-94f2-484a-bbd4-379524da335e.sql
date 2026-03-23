CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_count INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique tracking number after 100 attempts';
    END IF;

    new_number := 'BKE-' || upper(substr(md5(random()::text), 1, 6));

    SELECT COUNT(*) INTO exists_count
    FROM public.bursary_applications
    WHERE tracking_number = new_number;

    EXIT WHEN exists_count = 0;
  END LOOP;

  RETURN new_number;
END;
$$ LANGUAGE plpgsql SET search_path = public;