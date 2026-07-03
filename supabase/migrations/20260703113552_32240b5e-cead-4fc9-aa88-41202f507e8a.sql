ALTER TABLE public.student_beneficiaries
  ADD COLUMN IF NOT EXISTS dvl_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS dvl_verified_by uuid,
  ADD COLUMN IF NOT EXISTS dvl_notes text;

CREATE OR REPLACE FUNCTION public.mark_dvl_verified(_student_id uuid, _verified boolean, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ward text;
  v_parent_ward text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501';
  END IF;

  IF NOT (has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'county_commissioner'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  SELECT pa.parent_ward INTO v_parent_ward
    FROM public.student_beneficiaries sb
    JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
   WHERE sb.id = _student_id;
  IF v_parent_ward IS NULL THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE='42704';
  END IF;

  IF has_role(v_uid,'county_commissioner'::app_role) AND NOT has_role(v_uid,'admin'::app_role) THEN
    v_ward := public.get_user_assigned_ward(v_uid);
    IF v_ward IS NULL OR v_ward <> v_parent_ward THEN
      RAISE EXCEPTION 'Ward mismatch' USING ERRCODE='42501';
    END IF;
  END IF;

  IF _notes IS NOT NULL AND length(_notes) > 500 THEN
    RAISE EXCEPTION 'Notes too long (max 500 chars)';
  END IF;

  UPDATE public.student_beneficiaries
     SET dvl_verified_at = CASE WHEN _verified THEN now() ELSE NULL END,
         dvl_verified_by = CASE WHEN _verified THEN v_uid ELSE NULL END,
         dvl_notes = _notes,
         updated_at = now()
   WHERE id = _student_id;

  RETURN jsonb_build_object('ok', true, 'verified', _verified);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_dvl_verified(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_dvl_verified(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_applications_for_commissioner()
 RETURNS TABLE(id uuid, tracking_number text, status text, current_stage text, parent_name_masked text, parent_county text, parent_ward text, household_income integer, household_dependents integer, poverty_score integer, poverty_tier text, total_students integer, released_to_treasury boolean, ai_decision_reason text, advert_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, students jsonb)
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
        'disability_status', sb.disability_status,
        'disability_type', sb.disability_type,
        'ncpwd_registration_number', sb.ncpwd_registration_number,
        'disability_card_url', sb.disability_card_url,
        'dvl_verified_at', sb.dvl_verified_at,
        'dvl_notes', sb.dvl_notes,
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