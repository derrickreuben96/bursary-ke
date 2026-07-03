
-- =========================================================
-- 1. Household lookup RPC (BK-HH-YYYY-NNNNN)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_household_by_id(_household_id text, _verifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent public.parent_applications%ROWTYPE;
  v_clean text;
  v_match boolean := false;
  v_students jsonb;
BEGIN
  IF _household_id IS NULL OR length(_household_id) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_parent
    FROM public.parent_applications
   WHERE household_tracking_id = upper(_household_id)
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_clean := regexp_replace(COALESCE(_verifier,''), '[^0-9]', '', 'g');
  IF v_parent.parent_national_id = _verifier THEN v_match := true; END IF;
  IF v_clean <> '' AND (
       v_parent.parent_phone = v_clean
    OR v_parent.parent_phone = '0' || right(v_clean,9)
    OR v_parent.parent_phone = '+254' || right(v_clean,9)
    OR v_parent.parent_phone = '254' || right(v_clean,9)
  ) THEN v_match := true; END IF;

  IF NOT v_match THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sb.id,
    'student_full_name', sb.student_full_name,
    'institution_name', sb.institution_name,
    'student_type', sb.student_type,
    'class_form', sb.class_form,
    'year_of_study', sb.year_of_study,
    'status', sb.status,
    'allocated_amount', sb.allocated_amount,
    'released_to_treasury', sb.released_to_treasury,
    'disability_status', sb.disability_status,
    'health_status', sb.health_status,
    'child_code', (SELECT hcc.child_code FROM public.household_child_codes hcc WHERE hcc.student_beneficiary_id = sb.id)
  ) ORDER BY sb.created_at), '[]'::jsonb)
  INTO v_students
  FROM public.student_beneficiaries sb
  WHERE sb.parent_application_id = v_parent.id;

  RETURN jsonb_build_object(
    'household_tracking_id', v_parent.household_tracking_id,
    'tracking_number', v_parent.tracking_number,
    'parent_full_name', v_parent.parent_full_name,
    'parent_county', v_parent.parent_county,
    'parent_ward', v_parent.parent_ward,
    'status', v_parent.status,
    'current_stage', v_parent.current_stage,
    'released_to_treasury', v_parent.released_to_treasury,
    'created_at', v_parent.created_at,
    'updated_at', v_parent.updated_at,
    'total_students', v_parent.total_students,
    'students', v_students
  );
END
$function$;

REVOKE ALL ON FUNCTION public.get_household_by_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_household_by_id(text, text) TO anon, authenticated;

-- =========================================================
-- 2. Fraud detection helper (0-100 heuristic)
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_fraud_score(_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_score int := 0;
  v_parent public.parent_applications%ROWTYPE;
  v_student public.student_beneficiaries%ROWTYPE;
  v_nemis_dupe int := 0;
  v_nid_dupe int := 0;
  v_phone_dupe int := 0;
BEGIN
  SELECT * INTO v_student FROM public.student_beneficiaries WHERE id = _student_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_parent FROM public.parent_applications WHERE id = v_student.parent_application_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Same NEMIS/admission ID across DIFFERENT households
  IF v_student.student_identifier IS NOT NULL AND length(trim(v_student.student_identifier)) > 0 THEN
    SELECT count(*) INTO v_nemis_dupe
      FROM public.student_beneficiaries sb
      JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
     WHERE sb.student_identifier = v_student.student_identifier
       AND sb.id <> v_student.id
       AND pa.household_tracking_id IS DISTINCT FROM v_parent.household_tracking_id;
    v_score := v_score + LEAST(v_nemis_dupe * 40, 60);
  END IF;

  -- Same NationalID appearing under a DIFFERENT household code
  IF v_parent.parent_national_id IS NOT NULL AND length(trim(v_parent.parent_national_id)) > 0 THEN
    SELECT count(*) INTO v_nid_dupe
      FROM public.parent_applications pa
     WHERE pa.parent_national_id = v_parent.parent_national_id
       AND pa.household_tracking_id IS DISTINCT FROM v_parent.household_tracking_id;
    v_score := v_score + LEAST(v_nid_dupe * 25, 30);
  END IF;

  -- Same phone across different NationalIDs
  IF v_parent.parent_phone IS NOT NULL AND length(trim(v_parent.parent_phone)) > 0 THEN
    SELECT count(DISTINCT pa.parent_national_id) INTO v_phone_dupe
      FROM public.parent_applications pa
     WHERE pa.parent_phone = v_parent.parent_phone
       AND pa.parent_national_id IS DISTINCT FROM v_parent.parent_national_id;
    v_score := v_score + LEAST(v_phone_dupe * 15, 20);
  END IF;

  RETURN LEAST(v_score, 100);
END
$function$;

REVOKE ALL ON FUNCTION public.compute_fraud_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_fraud_score(uuid) TO service_role;

-- =========================================================
-- 3. Commissioner RPC: include rank_in_pipeline from decision log
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_parent_applications_for_commissioner()
RETURNS TABLE(
  id uuid, tracking_number text, status text, current_stage text,
  parent_name_masked text, parent_county text, parent_ward text,
  household_income integer, household_dependents integer,
  poverty_score integer, poverty_tier text, total_students integer,
  released_to_treasury boolean, ai_decision_reason text,
  advert_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone,
  students jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pa.id, pa.tracking_number, pa.status, pa.current_stage,
    CASE WHEN pa.parent_full_name IS NOT NULL AND pa.parent_full_name <> '' THEN
      split_part(pa.parent_full_name,' ',1)||' '||COALESCE(left(split_part(pa.parent_full_name,' ',2),1),'')||'***'
    ELSE 'N/A' END,
    pa.parent_county, pa.parent_ward, pa.household_income, pa.household_dependents,
    pa.poverty_score, pa.poverty_tier, pa.total_students, pa.released_to_treasury,
    pa.ai_decision_reason, pa.advert_id, pa.created_at, pa.updated_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sb.id,
        'student_name_masked', CASE WHEN sb.student_full_name IS NOT NULL AND sb.student_full_name <> '' THEN
          split_part(sb.student_full_name,' ',1)||' '||COALESCE(left(split_part(sb.student_full_name,' ',2),1),'')||'***'
        ELSE 'N/A' END,
        'student_type', sb.student_type,
        'institution_name', sb.institution_name,
        'class_form', sb.class_form,
        'year_of_study', sb.year_of_study,
        'status', sb.status,
        'allocated_amount', sb.allocated_amount,
        'released_to_treasury', sb.released_to_treasury,
        'ai_decision_reason', sb.ai_decision_reason,
        'fraud_score', sb.fraud_score,
        'assessment_pipeline', sb.assessment_pipeline,
        'rank_in_pipeline', (
          SELECT adl.rank_in_pipeline
            FROM public.application_decision_log adl
           WHERE adl.student_beneficiary_id = sb.id
           ORDER BY adl.decided_at DESC NULLS LAST, adl.id DESC
           LIMIT 1
        )
      ) ORDER BY sb.created_at)
      FROM public.student_beneficiaries sb
      WHERE sb.parent_application_id = pa.id
    ), '[]'::jsonb)
  FROM public.parent_applications pa
  WHERE has_role(auth.uid(),'admin'::app_role)
     OR (has_role(auth.uid(),'county_commissioner'::app_role)
         AND pa.parent_ward IS NOT NULL
         AND pa.parent_ward = public.get_user_assigned_ward(auth.uid()))
  ORDER BY pa.created_at DESC;
$function$;
