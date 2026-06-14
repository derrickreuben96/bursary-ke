
-- 1) Update submit_parent_application to also write the legacy bursary_applications mirror row,
--    so the client no longer needs direct INSERT privileges on the table.
CREATE OR REPLACE FUNCTION public.submit_parent_application(_advert_id uuid, _parent jsonb, _students jsonb, _tracking text DEFAULT NULL::text)
 RETURNS TABLE(parent_id uuid, tracking_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tracking text;
  v_parent_id uuid;
  v_count int;
  v_student jsonb;
  v_existing int;
  v_first jsonb;
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
    COALESCE((_parent->>'poverty_score')::int,0),
    _parent->>'poverty_tier', v_count, COALESCE(_parent->'document_urls','[]'::jsonb)
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

  -- Legacy mirror row in bursary_applications (first student) so existing
  -- commissioner/admin/treasury views keep working. Best-effort; ignore failure.
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
      COALESCE((_parent->>'poverty_score')::int,0),
      (_parent->>'poverty_tier')::poverty_tier
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY SELECT v_parent_id, v_tracking;
END;
$function$;

-- 2) Drop overly-permissive public INSERT policies. All submissions must now go through the RPC.
DROP POLICY IF EXISTS "Public can submit applications with valid data" ON public.bursary_applications;
DROP POLICY IF EXISTS "Public can submit parent_applications" ON public.parent_applications;
DROP POLICY IF EXISTS "Public can submit student_beneficiaries" ON public.student_beneficiaries;

-- 3) Tighten storage policy: remove tracking_number_exists branch (enumeration vector).
--    Anonymous uploads only allowed under temp-<timestamp>/ folders during pre-submission.
DROP POLICY IF EXISTS "Applicants can upload documents under valid folder" ON storage.objects;
CREATE POLICY "Applicants can upload documents under temp folder"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'applicant-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^temp-[0-9]{10,16}$'
);
