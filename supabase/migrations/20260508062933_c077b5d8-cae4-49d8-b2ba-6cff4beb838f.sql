
-- ============================================================
-- MULTI-STUDENT BURSARY APPLICATIONS (retry, ward trigger bypass on backfill)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.parent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number text NOT NULL UNIQUE,
  advert_id uuid NOT NULL,
  parent_national_id text NOT NULL,
  parent_full_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text,
  parent_county text NOT NULL,
  parent_ward text,
  sms_consent boolean NOT NULL DEFAULT false,
  household_income integer NOT NULL DEFAULT 0,
  household_dependents integer NOT NULL DEFAULT 0,
  poverty_score integer NOT NULL DEFAULT 0,
  poverty_tier text,
  total_students integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'received',
  current_stage text NOT NULL DEFAULT 'received',
  locked_for_resubmission boolean NOT NULL DEFAULT true,
  document_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_decision_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  released_to_treasury boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_app_unique_per_advert UNIQUE (advert_id, parent_national_id),
  CONSTRAINT parent_app_total_students_chk CHECK (total_students BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_parent_app_advert ON public.parent_applications(advert_id);
CREATE INDEX IF NOT EXISTS idx_parent_app_county ON public.parent_applications(parent_county);
CREATE INDEX IF NOT EXISTS idx_parent_app_ward ON public.parent_applications(parent_ward);
CREATE INDEX IF NOT EXISTS idx_parent_app_status ON public.parent_applications(status);
CREATE INDEX IF NOT EXISTS idx_parent_app_phone ON public.parent_applications(parent_phone);
CREATE INDEX IF NOT EXISTS idx_parent_app_natid ON public.parent_applications(parent_national_id);

CREATE TABLE IF NOT EXISTS public.student_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_application_id uuid NOT NULL REFERENCES public.parent_applications(id) ON DELETE CASCADE,
  student_full_name text NOT NULL,
  student_identifier text NOT NULL,
  student_type text NOT NULL DEFAULT 'secondary',
  institution_name text NOT NULL,
  admission_number text,
  class_form text,
  year_of_study text,
  fee_balance numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'received',
  allocated_amount numeric,
  allocation_date timestamptz,
  released_to_treasury boolean NOT NULL DEFAULT false,
  ai_decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_unique_per_parent UNIQUE (parent_application_id, student_identifier)
);

CREATE INDEX IF NOT EXISTS idx_student_parent ON public.student_beneficiaries(parent_application_id);
CREATE INDEX IF NOT EXISTS idx_student_status ON public.student_beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_student_identifier ON public.student_beneficiaries(student_identifier);

CREATE OR REPLACE FUNCTION public.enforce_max_three_students()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.student_beneficiaries WHERE parent_application_id = NEW.parent_application_id;
  IF cnt >= 3 THEN RAISE EXCEPTION 'Maximum of 3 students allowed per parent application'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_max_three_students ON public.student_beneficiaries;
CREATE TRIGGER trg_max_three_students BEFORE INSERT ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_three_students();

CREATE OR REPLACE FUNCTION public.enforce_unique_student_per_advert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE this_advert uuid; conflict_count int;
BEGIN
  SELECT advert_id INTO this_advert FROM public.parent_applications WHERE id = NEW.parent_application_id;
  IF this_advert IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO conflict_count
  FROM public.student_beneficiaries sb
  JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
  WHERE pa.advert_id = this_advert
    AND sb.student_identifier = NEW.student_identifier
    AND sb.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid);
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Student % already registered for this bursary cycle', NEW.student_identifier;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_unique_student_per_advert ON public.student_beneficiaries;
CREATE TRIGGER trg_unique_student_per_advert BEFORE INSERT OR UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_student_per_advert();

CREATE OR REPLACE FUNCTION public.validate_parent_ward_bursary_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE advert_ward text;
BEGIN
  IF NEW.advert_id IS NOT NULL THEN
    SELECT ward INTO advert_ward FROM public.bursary_adverts WHERE id = NEW.advert_id;
    IF advert_ward IS NOT NULL AND advert_ward <> '' THEN
      IF NEW.parent_ward IS NULL OR NEW.parent_ward <> advert_ward THEN
        RAISE EXCEPTION 'This bursary is restricted to residents of % ward.', advert_ward;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_parent_ward ON public.parent_applications;
CREATE TRIGGER trg_validate_parent_ward BEFORE INSERT OR UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_parent_ward_bursary_match();

DROP TRIGGER IF EXISTS trg_parent_app_updated_at ON public.parent_applications;
CREATE TRIGGER trg_parent_app_updated_at BEFORE UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_student_updated_at ON public.student_beneficiaries;
CREATE TRIGGER trg_student_updated_at BEFORE UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_student_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.application_status_history (application_id, from_status, to_status, changed_by, notes)
    VALUES (NEW.parent_application_id, OLD.status, NEW.status, auth.uid(), 'student:' || NEW.id::text);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_log_student_status ON public.student_beneficiaries;
CREATE TRIGGER trg_log_student_status AFTER UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.log_student_status_change();

ALTER TABLE public.parent_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_beneficiaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny anon parent_applications" ON public.parent_applications;
CREATE POLICY "Deny anon parent_applications" ON public.parent_applications FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "Public can submit parent_applications" ON public.parent_applications;
CREATE POLICY "Public can submit parent_applications" ON public.parent_applications
FOR INSERT TO anon, authenticated WITH CHECK (
  tracking_number IS NOT NULL AND advert_id IS NOT NULL
  AND parent_national_id IS NOT NULL AND parent_full_name IS NOT NULL AND parent_phone IS NOT NULL
);
DROP POLICY IF EXISTS "Admins manage parent_applications" ON public.parent_applications;
CREATE POLICY "Admins manage parent_applications" ON public.parent_applications FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Commissioners view parent_applications" ON public.parent_applications;
CREATE POLICY "Commissioners view parent_applications" ON public.parent_applications FOR SELECT TO authenticated
USING (has_role(auth.uid(),'county_commissioner'::app_role));
DROP POLICY IF EXISTS "Commissioners release parent_applications" ON public.parent_applications;
CREATE POLICY "Commissioners release parent_applications" ON public.parent_applications FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'county_commissioner'::app_role)) WITH CHECK (has_role(auth.uid(),'county_commissioner'::app_role));
DROP POLICY IF EXISTS "Treasury views released parent_applications" ON public.parent_applications;
CREATE POLICY "Treasury views released parent_applications" ON public.parent_applications FOR SELECT TO authenticated
USING (has_role(auth.uid(),'county_treasury'::app_role) AND released_to_treasury=true
  AND parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Deny anon students" ON public.student_beneficiaries;
CREATE POLICY "Deny anon students" ON public.student_beneficiaries FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "Public can submit students" ON public.student_beneficiaries;
CREATE POLICY "Public can submit students" ON public.student_beneficiaries FOR INSERT TO anon, authenticated
WITH CHECK (parent_application_id IS NOT NULL AND student_full_name IS NOT NULL
  AND student_identifier IS NOT NULL AND institution_name IS NOT NULL);
DROP POLICY IF EXISTS "Admins manage students" ON public.student_beneficiaries;
CREATE POLICY "Admins manage students" ON public.student_beneficiaries FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS "Commissioners view students" ON public.student_beneficiaries;
CREATE POLICY "Commissioners view students" ON public.student_beneficiaries FOR SELECT TO authenticated
USING (has_role(auth.uid(),'county_commissioner'::app_role));
DROP POLICY IF EXISTS "Commissioners update students" ON public.student_beneficiaries;
CREATE POLICY "Commissioners update students" ON public.student_beneficiaries FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'county_commissioner'::app_role)) WITH CHECK (has_role(auth.uid(),'county_commissioner'::app_role));
DROP POLICY IF EXISTS "Treasury views released students" ON public.student_beneficiaries;
CREATE POLICY "Treasury views released students" ON public.student_beneficiaries FOR SELECT TO authenticated
USING (has_role(auth.uid(),'county_treasury'::app_role) AND released_to_treasury=true
  AND EXISTS (SELECT 1 FROM public.parent_applications pa WHERE pa.id = student_beneficiaries.parent_application_id
    AND pa.parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)));
DROP POLICY IF EXISTS "Treasury marks students disbursed" ON public.student_beneficiaries;
CREATE POLICY "Treasury marks students disbursed" ON public.student_beneficiaries FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'county_treasury'::app_role) AND released_to_treasury=true AND status='approved')
WITH CHECK (has_role(auth.uid(),'county_treasury'::app_role) AND status='disbursed');

CREATE OR REPLACE FUNCTION public.submit_parent_application(_advert_id uuid, _parent jsonb, _students jsonb)
RETURNS TABLE(parent_id uuid, tracking_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tracking text; v_parent_id uuid; v_count int; v_student jsonb; v_existing int;
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
  v_tracking := public.generate_tracking_number();
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
  RETURN QUERY SELECT v_parent_id, v_tracking;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_parent_application(uuid, jsonb, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_application_by_tracking(_tracking text, _verifier text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    'released_to_treasury', sb.released_to_treasury) ORDER BY sb.created_at), '[]'::jsonb)
  INTO v_students FROM public.student_beneficiaries sb WHERE sb.parent_application_id = v_parent.id;
  RETURN jsonb_build_object(
    'tracking_number', v_parent.tracking_number, 'parent_full_name', v_parent.parent_full_name,
    'parent_county', v_parent.parent_county, 'parent_ward', v_parent.parent_ward,
    'status', v_parent.status, 'current_stage', v_parent.current_stage,
    'released_to_treasury', v_parent.released_to_treasury, 'created_at', v_parent.created_at,
    'updated_at', v_parent.updated_at, 'total_students', v_parent.total_students, 'students', v_students);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_parent_application_by_tracking(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_applications_for_commissioner()
RETURNS TABLE(id uuid, tracking_number text, status text, current_stage text,
  parent_name_masked text, parent_county text, parent_ward text,
  household_income int, household_dependents int, poverty_score int, poverty_tier text,
  total_students int, released_to_treasury boolean, ai_decision_reason text, advert_id uuid,
  created_at timestamptz, updated_at timestamptz, students jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  WHERE has_role(auth.uid(),'county_commissioner'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  ORDER BY pa.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_parent_applications_for_commissioner() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_treasury_student_beneficiaries()
RETURNS TABLE(id uuid, parent_application_id uuid, tracking_number text,
  student_name_masked text, student_type text, institution_name text,
  allocated_amount numeric, allocation_date timestamptz, status text,
  county text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sb.id, sb.parent_application_id, pa.tracking_number,
    CASE WHEN sb.student_full_name IS NOT NULL AND sb.student_full_name <> '' THEN
      split_part(sb.student_full_name,' ',1)||' '||COALESCE(left(split_part(sb.student_full_name,' ',2),1),'')||'***'
    ELSE 'N/A' END,
    sb.student_type, sb.institution_name, sb.allocated_amount, sb.allocation_date, sb.status,
    pa.parent_county, sb.created_at, sb.updated_at
  FROM public.student_beneficiaries sb
  JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
  WHERE sb.released_to_treasury = true AND sb.status IN ('approved','disbursed')
    AND (has_role(auth.uid(),'admin'::app_role)
      OR (has_role(auth.uid(),'county_treasury'::app_role)
          AND pa.parent_county = (SELECT assigned_county FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)))
  ORDER BY sb.updated_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_treasury_student_beneficiaries() TO authenticated;

CREATE OR REPLACE FUNCTION public.emit_parent_dashboard_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payload jsonb; ward_topic text; county_topic text;
BEGIN
  payload := jsonb_build_object('parent_id', NEW.id, 'op', TG_OP, 'status', NEW.status,
    'released_to_treasury', NEW.released_to_treasury, 'ts', extract(epoch from now()));
  BEGIN PERFORM realtime.send(payload, 'parent.change', 'dashboard:admin', false);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  IF NEW.parent_ward IS NOT NULL THEN
    ward_topic := 'dashboard:commissioner:' || lower(replace(NEW.parent_ward,' ','_'));
    BEGIN PERFORM realtime.send(payload, 'parent.change', ward_topic, false);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF NEW.parent_county IS NOT NULL THEN
    county_topic := 'dashboard:treasury:' || lower(replace(NEW.parent_county,' ','_'));
    BEGIN PERFORM realtime.send(payload, 'parent.change', county_topic, false);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_emit_parent_dashboard ON public.parent_applications;
CREATE TRIGGER trg_emit_parent_dashboard AFTER INSERT OR UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.emit_parent_dashboard_event();

CREATE OR REPLACE FUNCTION public.workflow_backlog_snapshot()
RETURNS TABLE(metric text, value bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'parents_received'::text, count(*)::bigint FROM parent_applications WHERE status='received'
  UNION ALL SELECT 'parents_under_review', count(*) FROM parent_applications WHERE status='under_review'
  UNION ALL SELECT 'parents_approved_not_released', count(*) FROM parent_applications WHERE status='approved' AND released_to_treasury=false
  UNION ALL SELECT 'students_pending_disbursement', count(*) FROM student_beneficiaries WHERE released_to_treasury=true AND status='approved'
  UNION ALL SELECT 'students_disbursed_24h', count(*) FROM student_beneficiaries WHERE status='disbursed' AND updated_at > now() - interval '24 hours'
  UNION ALL SELECT 'students_rejected_24h', count(*) FROM student_beneficiaries WHERE status='rejected' AND updated_at > now() - interval '24 hours'
  UNION ALL SELECT 'legacy_received_pending', count(*) FROM bursary_applications WHERE status::text='received'
  UNION ALL SELECT 'legacy_under_review', count(*) FROM bursary_applications WHERE status::text='under_review';
$$;

-- Backfill (bypass ward trigger so legacy mismatches don't block)
ALTER TABLE public.parent_applications DISABLE TRIGGER trg_validate_parent_ward;
DO $$
DECLARE r record; new_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.bursary_applications LOOP
    IF EXISTS (SELECT 1 FROM public.parent_applications WHERE tracking_number = r.tracking_number) THEN CONTINUE; END IF;
    IF r.advert_id IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.parent_applications WHERE advert_id = r.advert_id AND parent_national_id = r.parent_national_id) THEN CONTINUE; END IF;
    INSERT INTO public.parent_applications (
      tracking_number, advert_id, parent_national_id, parent_full_name, parent_phone, parent_email,
      parent_county, parent_ward, sms_consent, household_income, household_dependents,
      poverty_score, poverty_tier, total_students, status, current_stage,
      locked_for_resubmission, document_urls, ai_decision_reason, reviewed_at, reviewed_by,
      released_to_treasury, created_at, updated_at
    ) VALUES (
      r.tracking_number, r.advert_id, r.parent_national_id, r.parent_full_name, r.parent_phone, r.parent_email,
      r.parent_county, r.parent_ward, r.sms_consent, r.household_income, r.household_dependents,
      r.poverty_score, r.poverty_tier::text, 1, r.status::text, r.status::text,
      true, COALESCE(r.document_urls,'[]'::jsonb), r.ai_decision_reason, r.reviewed_at, r.reviewed_by,
      r.released_to_treasury, r.created_at, r.updated_at
    ) RETURNING id INTO new_id;
    INSERT INTO public.student_beneficiaries (
      parent_application_id, student_full_name, student_identifier, student_type,
      institution_name, admission_number, class_form, year_of_study,
      status, allocated_amount, allocation_date, released_to_treasury,
      ai_decision_reason, created_at, updated_at
    ) VALUES (
      new_id, r.student_full_name,
      COALESCE(r.student_id, r.tracking_number || '-S1'),
      r.student_type::text, r.institution_name, NULL,
      r.class_form, r.year_of_study,
      r.status::text, r.allocated_amount, r.allocation_date, r.released_to_treasury,
      r.ai_decision_reason, r.created_at, r.updated_at
    );
  END LOOP;
END $$;
ALTER TABLE public.parent_applications ENABLE TRIGGER trg_validate_parent_ward;
