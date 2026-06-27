
-- 1. New per-student columns (nullable; existing rows stay NULL — no per-student
--    data was historically captured, so we cannot fabricate it).
ALTER TABLE public.student_beneficiaries
  ADD COLUMN IF NOT EXISTS disability_status text,
  ADD COLUMN IF NOT EXISTS health_status text;

COMMENT ON COLUMN public.student_beneficiaries.disability_status IS
  'Per-student disability answer (option value from disability_student question). Captured from poverty questionnaire when application has 2+ students.';
COMMENT ON COLUMN public.student_beneficiaries.health_status IS
  'Per-student ongoing-health-challenge answer (option value from health_challenges question).';

-- 2. Audit column: persist raw questionnaire answers used by the scorer so
--    we can recompute / audit later. Existing rows back-fill to empty object.
ALTER TABLE public.parent_applications
  ADD COLUMN IF NOT EXISTS poverty_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.parent_applications.poverty_answers IS
  'Raw poverty questionnaire answers as submitted (includes per-student keys like disability_student::s0).';

-- 3. Replace compute_poverty_score so per-student keys are honored.
--    For perStudent questions (disability_student, health_challenges) we scan
--    `${id}::s0..s9` and take MAX score (most-needy student drives priority).
CREATE OR REPLACE FUNCTION public.compute_poverty_score(_answers jsonb)
RETURNS TABLE(score integer, tier text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  s numeric := 0;

  -- Household-level inputs (unchanged behavior)
  income int := COALESCE((_answers->>'householdIncome')::int, 50);
  deps int := COALESCE((_answers->>'numberOfDependents')::int, 0);
  housing text := COALESCE(_answers->>'housingType','Other');
  emp text := COALESCE(_answers->>'parentalEmployment','One Employed');
  other_children int := COALESCE((_answers->>'otherChildrenInSchool')::int, 0);
  elec  bool := COALESCE((_answers#>>'{accessToUtilities,electricity}')::bool, true);
  water bool := COALESCE((_answers#>>'{accessToUtilities,water}')::bool, true);
  inet  bool := COALESCE((_answers#>>'{accessToUtilities,internet}')::bool, true);

  -- Per-student helpers
  disability_max int := 0;
  health_max int := 0;
  has_disability bool := false;
  has_health bool := false;
  k text;
  v text;
  v_score int;

  final_score int;
  final_tier text;

  -- Scoring tables for per-student answers (mirror client povertyQuestions.ts)
  disability_scores constant jsonb := '{
    "severe_physical": 100, "visual_impairment": 95, "hearing_impairment": 95,
    "intellectual": 90, "mild_disability": 70, "chronic_illness": 80,
    "no_disability": 0
  }';
  health_scores constant jsonb := '{
    "hiv_aids": 85, "chronic_illness": 80, "mental_health": 75,
    "multiple_conditions": 95, "minor_issues": 20, "no_issues": 0
  }';
BEGIN
  -- Household-level contributions (existing logic, unchanged)
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

  -- Per-student aggregation: walk every key in _answers and grab the highest
  -- (most-needy) score for the two perStudent questions. We also accept the
  -- legacy household-level key (`disability_student`) for back-compat.
  IF _answers IS NOT NULL AND jsonb_typeof(_answers) = 'object' THEN
    FOR k, v IN SELECT key, value::text FROM jsonb_each_text(_answers) LOOP
      IF k = 'disability_student' OR k LIKE 'disability_student::s%' THEN
        v_score := COALESCE((disability_scores->>v)::int, 0);
        IF v_score > disability_max THEN disability_max := v_score; END IF;
        has_disability := true;
      ELSIF k = 'health_challenges' OR k LIKE 'health_challenges::s%' THEN
        v_score := COALESCE((health_scores->>v)::int, 0);
        IF v_score > health_max THEN health_max := v_score; END IF;
        has_health := true;
      END IF;
    END LOOP;
  END IF;

  -- Add per-student contributions ONLY when answers were provided, so the
  -- legacy "no questionnaire data" path still produces the same scores.
  IF has_disability THEN
    s := s + (disability_max * 0.30);  -- weighted contribution, capped at 30
  END IF;
  IF has_health THEN
    s := s + (health_max * 0.20);      -- weighted contribution, capped at 20
  END IF;

  final_score := LEAST(GREATEST(ROUND(s / 2.5)::int, 0), 100);
  final_tier := CASE WHEN final_score >= 70 THEN 'High'
                     WHEN final_score >= 40 THEN 'Medium'
                     ELSE 'Low' END;
  RETURN QUERY SELECT final_score, final_tier;
END
$function$;

-- 4. Update submit_parent_application to:
--    (a) persist raw poverty_answers on the parent row
--    (b) write each student's disability_status / health_status from the
--        matching `::s${idx}` answer (or the household-level answer when there
--        is only one student / only one answer).
CREATE OR REPLACE FUNCTION public.submit_parent_application(
  _advert_id uuid, _parent jsonb, _students jsonb, _tracking text DEFAULT NULL::text
)
RETURNS TABLE(parent_id uuid, tracking_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tracking text; v_parent_id uuid; v_count int;
  v_student jsonb; v_existing int; v_first jsonb;
  v_score int; v_tier text;
  v_answers jsonb;
  v_idx int := 0;
  v_disability text;
  v_health text;
  v_inserted_id uuid;
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

  v_answers := COALESCE(_parent->'poverty_answers', '{}'::jsonb)
               || jsonb_build_object(
                    'householdIncome',     COALESCE((_parent->>'household_income')::int, 0),
                    'numberOfDependents',  COALESCE((_parent->>'household_dependents')::int, 0)
                  );
  SELECT s.score, s.tier INTO v_score, v_tier FROM public.compute_poverty_score(v_answers) s;

  INSERT INTO public.parent_applications (
    tracking_number, advert_id, parent_national_id, parent_full_name, parent_phone, parent_email,
    parent_county, parent_ward, sms_consent, household_income, household_dependents,
    poverty_score, poverty_tier, total_students, document_urls, poverty_answers
  ) VALUES (
    v_tracking, _advert_id, _parent->>'parent_national_id', _parent->>'parent_full_name',
    _parent->>'parent_phone', _parent->>'parent_email', _parent->>'parent_county', _parent->>'parent_ward',
    COALESCE((_parent->>'sms_consent')::boolean,false),
    COALESCE((_parent->>'household_income')::int,0),
    COALESCE((_parent->>'household_dependents')::int,0),
    v_score, v_tier, v_count, COALESCE(_parent->'document_urls','[]'::jsonb),
    v_answers
  ) RETURNING id INTO v_parent_id;

  v_idx := 0;
  FOR v_student IN SELECT * FROM jsonb_array_elements(_students) LOOP
    -- Pick this student's per-question answer. Fall back to household-level
    -- key when only one set of answers exists (single-student application).
    v_disability := COALESCE(
      v_answers->>('disability_student::s' || v_idx::text),
      v_answers->>'disability_student'
    );
    v_health := COALESCE(
      v_answers->>('health_challenges::s' || v_idx::text),
      v_answers->>'health_challenges'
    );

    INSERT INTO public.student_beneficiaries (
      parent_application_id, student_full_name, student_identifier, student_type,
      institution_name, admission_number, class_form, year_of_study, fee_balance,
      disability_status, health_status
    ) VALUES (
      v_parent_id, v_student->>'student_full_name', v_student->>'student_identifier',
      COALESCE(v_student->>'student_type','secondary'), v_student->>'institution_name',
      v_student->>'admission_number', v_student->>'class_form', v_student->>'year_of_study',
      COALESCE((v_student->>'fee_balance')::numeric,0),
      v_disability, v_health
    ) RETURNING id INTO v_inserted_id;

    v_idx := v_idx + 1;
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
END
$function$;

-- 5. Extend the tracking RPC to surface per-student disability/health on the
--    student cards (useful for parents reviewing what was recorded).
CREATE OR REPLACE FUNCTION public.get_parent_application_by_tracking(_tracking text, _verifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_parent public.parent_applications%ROWTYPE; v_clean text; v_match boolean := false; v_students jsonb;
BEGIN
  SELECT * INTO v_parent FROM public.parent_applications WHERE tracking_number = upper(_tracking);
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_clean := regexp_replace(COALESCE(_verifier,''), '[^0-9]', '', 'g');
  IF v_parent.parent_national_id = _verifier THEN v_match := true; END IF;
  IF v_clean <> '' AND (v_parent.parent_phone = v_clean
       OR v_parent.parent_phone = '0' || right(v_clean,9)
       OR v_parent.parent_phone = '+254' || right(v_clean,9)
       OR v_parent.parent_phone = '254' || right(v_clean,9)) THEN v_match := true; END IF;
  IF NOT v_match THEN RETURN jsonb_build_object('error','verification_failed'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sb.id, 'student_full_name', sb.student_full_name, 'institution_name', sb.institution_name,
    'student_type', sb.student_type, 'class_form', sb.class_form, 'year_of_study', sb.year_of_study,
    'status', sb.status, 'allocated_amount', sb.allocated_amount,
    'released_to_treasury', sb.released_to_treasury,
    'disability_status', sb.disability_status,
    'health_status', sb.health_status
  ) ORDER BY sb.created_at), '[]'::jsonb)
  INTO v_students FROM public.student_beneficiaries sb WHERE sb.parent_application_id = v_parent.id;
  RETURN jsonb_build_object(
    'tracking_number', v_parent.tracking_number, 'parent_full_name', v_parent.parent_full_name,
    'parent_county', v_parent.parent_county, 'parent_ward', v_parent.parent_ward,
    'status', v_parent.status, 'current_stage', v_parent.current_stage,
    'released_to_treasury', v_parent.released_to_treasury, 'created_at', v_parent.created_at,
    'updated_at', v_parent.updated_at, 'total_students', v_parent.total_students, 'students', v_students);
END
$function$;
