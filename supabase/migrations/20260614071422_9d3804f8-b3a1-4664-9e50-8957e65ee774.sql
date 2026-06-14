
-- 1. Server-side poverty score helper
CREATE OR REPLACE FUNCTION public.compute_poverty_score(_answers jsonb)
RETURNS TABLE(score int, tier text)
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s numeric := 0;
  income int := COALESCE((_answers->>'householdIncome')::int, 50);
  deps int := COALESCE((_answers->>'numberOfDependents')::int, 0);
  housing text := COALESCE(_answers->>'housingType','Other');
  emp text := COALESCE(_answers->>'parentalEmployment','One Employed');
  other_children int := COALESCE((_answers->>'otherChildrenInSchool')::int, 0);
  elec bool := COALESCE((_answers#>>'{accessToUtilities,electricity}')::bool, true);
  water bool := COALESCE((_answers#>>'{accessToUtilities,water}')::bool, true);
  inet bool := COALESCE((_answers#>>'{accessToUtilities,internet}')::bool, true);
  final_score int;
  final_tier text;
BEGIN
  s := s + (100 - LEAST(GREATEST(income,0),100));
  s := s + LEAST(deps * 5, 25);
  s := s + CASE housing
            WHEN 'Owned' THEN 0 WHEN 'Rented' THEN 10
            WHEN 'Informal' THEN 25 ELSE 15 END;
  IF NOT elec  THEN s := s + 10; END IF;
  IF NOT water THEN s := s + 10; END IF;
  IF NOT inet  THEN s := s + 5; END IF;
  s := s + CASE emp
            WHEN 'Both Employed' THEN 0
            WHEN 'One Employed' THEN 15
            WHEN 'Self-Employed' THEN 10
            WHEN 'Both Unemployed' THEN 30
            WHEN 'Deceased/N/A' THEN 25
            ELSE 0 END;
  s := s + LEAST(other_children * 3, 15);
  final_score := LEAST(GREATEST(ROUND(s/2.5)::int, 0), 100);
  final_tier := CASE WHEN final_score >= 70 THEN 'High'
                     WHEN final_score >= 40 THEN 'Medium'
                     ELSE 'Low' END;
  RETURN QUERY SELECT final_score, final_tier;
END $$;

-- 2. Rewrite submit_parent_application to compute score server-side and ignore client values
CREATE OR REPLACE FUNCTION public.submit_parent_application(
  _advert_id uuid, _parent jsonb, _students jsonb, _tracking text DEFAULT NULL::text
)
RETURNS TABLE(parent_id uuid, tracking_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tracking text; v_parent_id uuid; v_count int;
  v_student jsonb; v_existing int; v_first jsonb;
  v_score int; v_tier text;
  v_answers jsonb;
BEGIN
  IF _advert_id IS NULL THEN RAISE EXCEPTION 'advert_id is required'; END IF;
  SELECT jsonb_array_length(_students) INTO v_count;
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RAISE EXCEPTION 'You must include between 1 and 3 students';
  END IF;
  SELECT count(*) INTO v_existing FROM public.parent_applications
   WHERE advert_id = _advert_id AND parent_national_id = (_parent->>'parent_national_id');
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'You have already submitted the maximum allowed bursary application for this cycle.' USING ERRCODE='23505';
  END IF;
  v_tracking := COALESCE(_tracking, public.generate_tracking_number());

  -- Always recompute poverty score from raw answers; ignore any client-supplied score/tier
  v_answers := COALESCE(_parent->'poverty_answers', '{}'::jsonb)
               || jsonb_build_object(
                    'householdIncome', COALESCE((_parent->>'household_income')::int, 0),
                    'numberOfDependents', COALESCE((_parent->>'household_dependents')::int, 0)
                  );
  SELECT s.score, s.tier INTO v_score, v_tier FROM public.compute_poverty_score(v_answers) s;

  INSERT INTO public.parent_applications (
    tracking_number, advert_id, parent_national_id, parent_full_name, parent_phone, parent_email,
    parent_county, parent_ward, sms_consent, household_income, household_dependents,
    poverty_score, poverty_tier, total_students, document_urls
  ) VALUES (
    v_tracking, _advert_id, _parent->>'parent_national_id', _parent->>'parent_full_name',
    _parent->>'parent_phone', _parent->>'parent_email', _parent->>'parent_county', _parent->>'parent_ward',
    COALESCE((_parent->>'sms_consent')::boolean,false),
    COALESCE((_parent->>'household_income')::int,0),
    COALESCE((_parent->>'household_dependents')::int,0),
    v_score, v_tier, v_count, COALESCE(_parent->'document_urls','[]'::jsonb)
  ) RETURNING id INTO v_parent_id;

  FOR v_student IN SELECT * FROM jsonb_array_elements(_students) LOOP
    INSERT INTO public.student_beneficiaries (
      parent_application_id, student_full_name, student_identifier, student_type,
      institution_name, admission_number, class_form, year_of_study, fee_balance
    ) VALUES (
      v_parent_id, v_student->>'student_full_name', v_student->>'student_identifier',
      COALESCE(v_student->>'student_type','secondary'), v_student->>'institution_name',
      v_student->>'admission_number', v_student->>'class_form', v_student->>'year_of_study',
      COALESCE((v_student->>'fee_balance')::numeric,0)
    );
  END LOOP;

  BEGIN
    v_first := _students->0;
    INSERT INTO public.bursary_applications (
      tracking_number, student_type, status, advert_id,
      parent_national_id, parent_full_name, parent_phone, parent_email,
      parent_county, parent_ward, sms_consent,
      student_full_name, student_id, institution_name,
      year_of_study, class_form, household_income, household_dependents,
      poverty_score, poverty_tier
    ) VALUES (
      v_tracking,
      COALESCE(v_first->>'student_type','secondary')::student_type,
      'received'::application_status,
      _advert_id,
      _parent->>'parent_national_id', _parent->>'parent_full_name',
      _parent->>'parent_phone', _parent->>'parent_email',
      _parent->>'parent_county', _parent->>'parent_ward',
      COALESCE((_parent->>'sms_consent')::boolean,false),
      v_first->>'student_full_name', v_first->>'student_identifier', v_first->>'institution_name',
      v_first->>'year_of_study', v_first->>'class_form',
      COALESCE((_parent->>'household_income')::int,0),
      COALESCE((_parent->>'household_dependents')::int,0),
      v_score, v_tier::poverty_tier
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT v_parent_id, v_tracking;
END $$;

-- 3. Score range CHECK constraints (validate-only to avoid breaking existing rows)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='parent_applications_poverty_score_range') THEN
    ALTER TABLE public.parent_applications
      ADD CONSTRAINT parent_applications_poverty_score_range
      CHECK (poverty_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bursary_applications_poverty_score_range') THEN
    ALTER TABLE public.bursary_applications
      ADD CONSTRAINT bursary_applications_poverty_score_range
      CHECK (poverty_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
END $$;

-- 4. Ward-scope commissioner SELECT policies
DROP POLICY IF EXISTS "Commissioners can view applications" ON public.bursary_applications;
CREATE POLICY "Commissioners can view applications" ON public.bursary_applications
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND parent_ward IS NOT NULL
    AND parent_ward = public.get_user_assigned_ward(auth.uid())
  );

DROP POLICY IF EXISTS "Commissioners view parent_applications" ON public.parent_applications;
CREATE POLICY "Commissioners view parent_applications" ON public.parent_applications
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND parent_ward IS NOT NULL
    AND parent_ward = public.get_user_assigned_ward(auth.uid())
  );

DROP POLICY IF EXISTS "Commissioners can view applicant_history" ON public.applicant_history;
CREATE POLICY "Commissioners can view applicant_history" ON public.applicant_history
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND ward IS NOT NULL
    AND ward = public.get_user_assigned_ward(auth.uid())
  );

DROP POLICY IF EXISTS "Commissioners can view fairness_tracking" ON public.fairness_tracking;
CREATE POLICY "Commissioners can view fairness_tracking" ON public.fairness_tracking
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'county_commissioner'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.bursary_applications ba
      WHERE ba.id = fairness_tracking.application_id
        AND ba.parent_ward = public.get_user_assigned_ward(auth.uid())
    )
  );

-- 5. Scope the SECURITY DEFINER helper functions used by commissioner UI
CREATE OR REPLACE FUNCTION public.get_commissioner_applications()
RETURNS TABLE(id uuid, tracking_number text, student_type text, status text, institution_name text, class_form text, year_of_study text, student_name_masked text, parent_name_masked text, parent_county text, parent_ward text, household_income integer, household_dependents integer, poverty_score integer, poverty_tier text, allocated_amount numeric, allocation_date timestamp with time zone, is_duplicate boolean, advert_id uuid, ai_decision_reason text, reviewed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, released_to_treasury boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM public.bursary_applications_commissioner v
  WHERE has_role(auth.uid(), 'admin'::app_role)
     OR (has_role(auth.uid(), 'county_commissioner'::app_role)
         AND v.parent_ward IS NOT NULL
         AND v.parent_ward = public.get_user_assigned_ward(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.get_parent_applications_for_commissioner()
RETURNS TABLE(id uuid, tracking_number text, status text, current_stage text, parent_name_masked text, parent_county text, parent_ward text, household_income integer, household_dependents integer, poverty_score integer, poverty_tier text, total_students integer, released_to_treasury boolean, ai_decision_reason text, advert_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, students jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pa.id, pa.tracking_number, pa.status, pa.current_stage,
    CASE WHEN pa.parent_full_name IS NOT NULL AND pa.parent_full_name <> '' THEN
      split_part(pa.parent_full_name,' ',1)||' '||COALESCE(left(split_part(pa.parent_full_name,' ',2),1),'')||'***'
    ELSE 'N/A' END,
    pa.parent_county, pa.parent_ward, pa.household_income, pa.household_dependents,
    pa.poverty_score, pa.poverty_tier, pa.total_students, pa.released_to_treasury,
    pa.ai_decision_reason, pa.advert_id, pa.created_at, pa.updated_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', sb.id,
      'student_name_masked', CASE WHEN sb.student_full_name IS NOT NULL AND sb.student_full_name <> '' THEN
        split_part(sb.student_full_name,' ',1)||' '||COALESCE(left(split_part(sb.student_full_name,' ',2),1),'')||'***'
      ELSE 'N/A' END,
      'student_type', sb.student_type, 'institution_name', sb.institution_name,
      'class_form', sb.class_form, 'year_of_study', sb.year_of_study, 'status', sb.status,
      'allocated_amount', sb.allocated_amount, 'released_to_treasury', sb.released_to_treasury,
      'ai_decision_reason', sb.ai_decision_reason) ORDER BY sb.created_at)
    FROM public.student_beneficiaries sb WHERE sb.parent_application_id = pa.id), '[]'::jsonb)
  FROM public.parent_applications pa
  WHERE has_role(auth.uid(),'admin'::app_role)
     OR (has_role(auth.uid(),'county_commissioner'::app_role)
         AND pa.parent_ward IS NOT NULL
         AND pa.parent_ward = public.get_user_assigned_ward(auth.uid()))
  ORDER BY pa.created_at DESC;
$$;
