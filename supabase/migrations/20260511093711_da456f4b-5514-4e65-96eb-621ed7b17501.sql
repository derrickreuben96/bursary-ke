ALTER TABLE public.bursary_adverts
  ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.close_advert_when_fully_disbursed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending int;
BEGIN
  IF NEW.advert_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text <> 'disbursed' THEN RETURN NEW; END IF;
  IF OLD.status::text = 'disbursed' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_pending
  FROM public.bursary_applications
  WHERE advert_id = NEW.advert_id
    AND released_to_treasury = true
    AND status::text = 'approved';

  IF v_pending = 0 THEN
    UPDATE public.bursary_adverts
       SET closed_at = COALESCE(closed_at, now()),
           is_active = false,
           updated_at = now()
     WHERE id = NEW.advert_id
       AND closed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_advert_when_fully_disbursed ON public.bursary_applications;
CREATE TRIGGER trg_close_advert_when_fully_disbursed
AFTER UPDATE OF status ON public.bursary_applications
FOR EACH ROW
EXECUTE FUNCTION public.close_advert_when_fully_disbursed();

DROP FUNCTION IF EXISTS public.get_treasury_applications();

CREATE FUNCTION public.get_treasury_applications()
 RETURNS TABLE(id uuid, tracking_number text, student_type text, status text, institution_name text, allocated_amount numeric, allocation_date timestamp with time zone, ecitizen_ref text, student_name_masked text, county text, created_at timestamp with time zone, updated_at timestamp with time zone, advert_id uuid, advert_title text, advert_deadline timestamp with time zone, advert_ward text, advert_budget numeric, poverty_tier text, poverty_score integer, advert_closed_at timestamp with time zone, advert_is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ba.id, ba.tracking_number, ba.student_type::text, ba.status::text,
    ba.institution_name, ba.allocated_amount, ba.allocation_date,
    ba.ecitizen_ref,
    CASE
      WHEN ba.student_full_name IS NOT NULL AND ba.student_full_name <> '' THEN
        split_part(ba.student_full_name, ' ', 1) || ' ' ||
        COALESCE(left(split_part(ba.student_full_name, ' ', 2), 1), '') || '***'
      ELSE 'N/A'
    END,
    ba.parent_county,
    ba.created_at,
    ba.updated_at,
    ba.advert_id,
    adv.title,
    adv.deadline,
    adv.ward,
    adv.budget_amount,
    ba.poverty_tier::text,
    ba.poverty_score,
    adv.closed_at,
    adv.is_active
  FROM public.bursary_applications ba
  LEFT JOIN public.bursary_adverts adv ON adv.id = ba.advert_id
  WHERE ba.status IN ('approved', 'disbursed')
    AND ba.released_to_treasury = true
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        has_role(auth.uid(), 'county_treasury'::app_role)
        AND ba.parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    )
$function$;

UPDATE public.bursary_adverts a
   SET closed_at = COALESCE(a.closed_at, now()),
       is_active = false,
       updated_at = now()
 WHERE a.closed_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.bursary_applications ba
     WHERE ba.advert_id = a.id AND ba.released_to_treasury = true
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.bursary_applications ba
     WHERE ba.advert_id = a.id
       AND ba.released_to_treasury = true
       AND ba.status::text = 'approved'
   );