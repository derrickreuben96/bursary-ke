
DROP FUNCTION IF EXISTS public.get_treasury_applications();

CREATE OR REPLACE FUNCTION public.get_treasury_applications()
 RETURNS TABLE(id uuid, tracking_number text, student_type text, status text, institution_name text, allocated_amount numeric, allocation_date timestamp with time zone, ecitizen_ref text, student_name_masked text, county text, created_at timestamp with time zone, updated_at timestamp with time zone, advert_id uuid, advert_title text, advert_deadline timestamp with time zone, advert_ward text, advert_budget numeric, poverty_tier text, poverty_score integer)
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
    END AS student_name_masked,
    ba.parent_county AS county,
    ba.created_at,
    ba.updated_at,
    ba.advert_id,
    adv.title AS advert_title,
    adv.deadline AS advert_deadline,
    adv.ward AS advert_ward,
    adv.budget_amount AS advert_budget,
    ba.poverty_tier::text AS poverty_tier,
    ba.poverty_score
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
