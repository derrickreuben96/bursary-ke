DO $$
DECLARE
  app_rec RECORD;
  new_advert_id uuid;
BEGIN
  FOR app_rec IN
    SELECT id FROM public.bursary_applications WHERE advert_id IS NULL
  LOOP
    INSERT INTO public.bursary_adverts (title, description, county, ward, deadline, is_active, budget_amount)
    VALUES (
      'Legacy Archived Application ' || substr(app_rec.id::text, 1, 8),
      'System placeholder for a legacy application submitted before advert linkage was enforced. Hidden from applicants.',
      'Nairobi', 'Westlands',
      now() - interval '1 day',
      false,
      0
    )
    RETURNING id INTO new_advert_id;

    UPDATE public.bursary_applications
       SET advert_id = new_advert_id
     WHERE id = app_rec.id;
  END LOOP;
END $$;

ALTER TABLE public.bursary_applications
  ALTER COLUMN advert_id SET NOT NULL;