
-- =========================================================
-- HOUSEHOLD LAYER — additive migration
-- =========================================================

-- ---------- households ----------
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_national_id text NOT NULL UNIQUE,
  parent_full_name text,
  parent_phone text,
  parent_email text,
  parent_county text,
  parent_ward text,
  household_tracking_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "households_admin_all" ON public.households
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "households_commissioner_read" ON public.households
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'county_commissioner'::app_role)
    AND parent_ward IS NOT NULL
    AND parent_ward = public.get_user_assigned_ward(auth.uid())
  );

CREATE POLICY "households_treasury_read" ON public.households
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'county_treasury'::app_role)
    AND parent_county IS NOT NULL
    AND parent_county = public.get_user_assigned_county(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_households_national_id ON public.households(parent_national_id);
CREATE INDEX IF NOT EXISTS idx_households_tracking ON public.households(household_tracking_id);
CREATE INDEX IF NOT EXISTS idx_households_ward ON public.households(parent_ward);
CREATE INDEX IF NOT EXISTS idx_households_county ON public.households(parent_county);

CREATE TRIGGER trg_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- household_members ----------
CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  parent_application_id uuid REFERENCES public.parent_applications(id) ON DELETE CASCADE,
  student_beneficiary_id uuid REFERENCES public.student_beneficiaries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, parent_application_id, student_beneficiary_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_admin_all" ON public.household_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "household_members_staff_read" ON public.household_members
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'county_commissioner'::app_role)
    OR public.has_role(auth.uid(), 'county_treasury'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_hm_household ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_hm_parent_app ON public.household_members(parent_application_id);
CREATE INDEX IF NOT EXISTS idx_hm_student ON public.household_members(student_beneficiary_id);

-- ---------- audit_logs (immutable) ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  ip text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "audit_logs_insert_any_auth" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE / DELETE policy on purpose — table is append-only.
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON public.audit_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.audit_logs(actor_user_id, created_at DESC);

-- ---------- notification_history ----------
CREATE TABLE IF NOT EXISTS public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  parent_national_id text,
  channel text NOT NULL DEFAULT 'in_app',
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_history TO authenticated;
GRANT ALL ON public.notification_history TO service_role;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_admin_all" ON public.notification_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_notif_household ON public.notification_history(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_nid ON public.notification_history(parent_national_id, created_at DESC);

-- ---------- fraud_flags ----------
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_beneficiary_id uuid REFERENCES public.student_beneficiaries(id) ON DELETE CASCADE,
  parent_application_id uuid REFERENCES public.parent_applications(id) ON DELETE CASCADE,
  flag_code text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fraud_flags TO authenticated;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_flags_admin_all" ON public.fraud_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "fraud_flags_commissioner_read" ON public.fraud_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'county_commissioner'::app_role));

CREATE INDEX IF NOT EXISTS idx_fraud_student ON public.fraud_flags(student_beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_fraud_parent_app ON public.fraud_flags(parent_application_id);

-- ---------- duplicate_detection ----------
CREATE TABLE IF NOT EXISTS public.duplicate_detection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_national_id text,
  applicant_identifier text,
  match_type text NOT NULL,
  matched_household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  matched_student_id uuid REFERENCES public.student_beneficiaries(id) ON DELETE SET NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.duplicate_detection TO authenticated;
GRANT ALL ON public.duplicate_detection TO service_role;
ALTER TABLE public.duplicate_detection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dupdet_admin_all" ON public.duplicate_detection
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "dupdet_commissioner_read" ON public.duplicate_detection
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'county_commissioner'::app_role));

CREATE INDEX IF NOT EXISTS idx_dupdet_nid ON public.duplicate_detection(parent_national_id);
CREATE INDEX IF NOT EXISTS idx_dupdet_ident ON public.duplicate_detection(applicant_identifier);

-- ---------- extra index on parent_applications ----------
CREATE INDEX IF NOT EXISTS idx_parent_apps_national_id ON public.parent_applications(parent_national_id);

-- =========================================================
-- FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_or_create_household(
  _national_id text,
  _parent jsonb DEFAULT '{}'::jsonb
) RETURNS public.households
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_row public.households%ROWTYPE;
  v_tracking text;
BEGIN
  IF _national_id IS NULL OR length(trim(_national_id)) = 0 THEN
    RAISE EXCEPTION 'parent_national_id required';
  END IF;

  SELECT * INTO v_row FROM public.households WHERE parent_national_id = _national_id;
  IF FOUND THEN
    UPDATE public.households
       SET parent_full_name = COALESCE(_parent->>'parent_full_name', parent_full_name),
           parent_phone     = COALESCE(_parent->>'parent_phone', parent_phone),
           parent_email     = COALESCE(_parent->>'parent_email', parent_email),
           parent_county    = COALESCE(_parent->>'parent_county', parent_county),
           parent_ward      = COALESCE(_parent->>'parent_ward', parent_ward),
           updated_at       = now()
     WHERE id = v_row.id
     RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  -- Reuse an existing household tracking id if a parent_applications row already has one
  SELECT household_tracking_id INTO v_tracking
    FROM public.parent_applications
   WHERE parent_national_id = _national_id
     AND household_tracking_id IS NOT NULL
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_tracking IS NULL THEN
    v_tracking := public.generate_household_tracking_id();
  END IF;

  INSERT INTO public.households (
    parent_national_id, parent_full_name, parent_phone, parent_email,
    parent_county, parent_ward, household_tracking_id
  ) VALUES (
    _national_id,
    _parent->>'parent_full_name',
    _parent->>'parent_phone',
    _parent->>'parent_email',
    _parent->>'parent_county',
    _parent->>'parent_ward',
    v_tracking
  )
  ON CONFLICT (parent_national_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END
$fn$;

CREATE OR REPLACE FUNCTION public.log_audit(
  _event_type text, _entity_type text, _entity_id text, _details jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (actor_user_id, event_type, entity_type, entity_id, details)
  VALUES (auth.uid(), _event_type, _entity_type, _entity_id, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.detect_duplicate_applicant(
  _parent_national_id text,
  _identifier text,
  _institution text DEFAULT NULL,
  _year text DEFAULT NULL
) RETURNS TABLE(match_type text, matched_student_id uuid, matched_household_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  RETURN QUERY
  SELECT 'same_identifier_diff_household'::text,
         sb.id,
         h.id
    FROM public.student_beneficiaries sb
    JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
    LEFT JOIN public.households h ON h.parent_national_id = pa.parent_national_id
   WHERE sb.student_identifier = _identifier
     AND pa.parent_national_id IS DISTINCT FROM _parent_national_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.get_household_summary(
  _lookup text, _verifier text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_household public.households%ROWTYPE;
  v_apps jsonb;
  v_notifs jsonb;
  v_audit jsonb;
  v_clean text;
  v_match boolean;
  v_is_admin boolean;
BEGIN
  IF _lookup IS NULL OR length(_lookup) = 0 THEN RETURN NULL; END IF;

  SELECT * INTO v_household FROM public.households
   WHERE household_tracking_id = upper(_lookup) OR parent_national_id = _lookup
   LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_is_admin := (auth.uid() IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'county_commissioner'::app_role)
      OR public.has_role(auth.uid(), 'county_treasury'::app_role)
    ));

  IF NOT v_is_admin THEN
    -- public lookup requires verifier (national id or phone)
    v_clean := regexp_replace(COALESCE(_verifier,''),'[^0-9]','','g');
    v_match := false;
    IF v_household.parent_national_id = _verifier THEN v_match := true; END IF;
    IF v_clean <> '' AND (
         v_household.parent_phone = v_clean
      OR v_household.parent_phone = '0' || right(v_clean,9)
      OR v_household.parent_phone = '+254' || right(v_clean,9)
      OR v_household.parent_phone = '254' || right(v_clean,9)
    ) THEN v_match := true; END IF;
    IF NOT v_match THEN
      RETURN jsonb_build_object('error','verification_failed');
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at), '[]'::jsonb)
    INTO v_apps
  FROM (
    SELECT pa.id AS parent_application_id, pa.tracking_number, pa.status, pa.current_stage,
           pa.total_students, pa.created_at, pa.updated_at, pa.released_to_treasury,
           pa.advert_id,
           (
             SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', sb.id,
               'student_full_name', CASE WHEN v_is_admin THEN sb.student_full_name
                 ELSE split_part(sb.student_full_name,' ',1)||' '||COALESCE(left(split_part(sb.student_full_name,' ',2),1),'')||'***' END,
               'education_category', sb.education_category,
               'student_type', sb.student_type,
               'institution_name', sb.institution_name,
               'class_form', sb.class_form,
               'year_of_study', sb.year_of_study,
               'status', sb.status,
               'allocated_amount', sb.allocated_amount,
               'released_to_treasury', sb.released_to_treasury,
               'fraud_score', sb.fraud_score
             ) ORDER BY sb.created_at), '[]'::jsonb)
             FROM public.student_beneficiaries sb
             WHERE sb.parent_application_id = pa.id
           ) AS students
      FROM public.parent_applications pa
     WHERE pa.parent_national_id = v_household.parent_national_id
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', n.id, 'event_type', n.event_type, 'title', n.title,
      'body', n.body, 'channel', n.channel, 'read_at', n.read_at,
      'created_at', n.created_at
    ) ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO v_notifs
  FROM public.notification_history n
  WHERE n.household_id = v_household.id;

  v_audit := '[]'::jsonb;
  IF v_is_admin THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'event_type', a.event_type, 'entity_type', a.entity_type,
      'entity_id', a.entity_id, 'details', a.details, 'created_at', a.created_at
    ) ORDER BY a.created_at DESC), '[]'::jsonb)
    INTO v_audit
    FROM public.audit_logs a
    WHERE a.entity_type = 'household' AND a.entity_id = v_household.id::text
       OR a.entity_type = 'parent_application' AND a.entity_id IN (
            SELECT id::text FROM public.parent_applications WHERE parent_national_id = v_household.parent_national_id
          );
  END IF;

  RETURN jsonb_build_object(
    'household_id', v_household.id,
    'household_tracking_id', v_household.household_tracking_id,
    'parent_full_name', CASE WHEN v_is_admin THEN v_household.parent_full_name
      ELSE split_part(v_household.parent_full_name,' ',1)||' ***' END,
    'parent_county', v_household.parent_county,
    'parent_ward', v_household.parent_ward,
    'applications', COALESCE(v_apps,'[]'::jsonb),
    'notifications', COALESCE(v_notifs,'[]'::jsonb),
    'audit_log', v_audit
  );
END
$fn$;

-- Ensure updated_at bump on households (already set above).
-- Grant execute on the new functions.
GRANT EXECUTE ON FUNCTION public.get_or_create_household(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_duplicate_applicant(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_household_summary(text, text) TO anon, authenticated, service_role;

-- =========================================================
-- TRIGGERS: audit + household linking
-- =========================================================

CREATE OR REPLACE FUNCTION public.audit_parent_application_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (actor_user_id, event_type, entity_type, entity_id, details)
    VALUES (auth.uid(), 'application_created', 'parent_application', NEW.id::text,
            jsonb_build_object('tracking_number', NEW.tracking_number, 'status', NEW.status));
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.released_to_treasury IS DISTINCT FROM OLD.released_to_treasury THEN
    INSERT INTO public.audit_logs (actor_user_id, event_type, entity_type, entity_id, details)
    VALUES (auth.uid(), 'application_updated', 'parent_application', NEW.id::text,
            jsonb_build_object('from', OLD.status, 'to', NEW.status,
                               'released', NEW.released_to_treasury));
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_audit_parent_app ON public.parent_applications;
CREATE TRIGGER trg_audit_parent_app
  AFTER INSERT OR UPDATE ON public.parent_applications
  FOR EACH ROW EXECUTE FUNCTION public.audit_parent_application_change();

CREATE OR REPLACE FUNCTION public.link_parent_app_to_household()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_h public.households%ROWTYPE;
BEGIN
  v_h := public.get_or_create_household(NEW.parent_national_id, jsonb_build_object(
    'parent_full_name', NEW.parent_full_name,
    'parent_phone', NEW.parent_phone,
    'parent_email', NEW.parent_email,
    'parent_county', NEW.parent_county,
    'parent_ward', NEW.parent_ward
  ));
  INSERT INTO public.household_members (household_id, parent_application_id)
  VALUES (v_h.id, NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_link_household ON public.parent_applications;
CREATE TRIGGER trg_link_household
  AFTER INSERT ON public.parent_applications
  FOR EACH ROW EXECUTE FUNCTION public.link_parent_app_to_household();

CREATE OR REPLACE FUNCTION public.link_student_to_household()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_hid uuid;
BEGIN
  SELECT h.id INTO v_hid
    FROM public.parent_applications pa
    JOIN public.households h ON h.parent_national_id = pa.parent_national_id
   WHERE pa.id = NEW.parent_application_id
   LIMIT 1;
  IF v_hid IS NOT NULL THEN
    INSERT INTO public.household_members (household_id, parent_application_id, student_beneficiary_id)
    VALUES (v_hid, NEW.parent_application_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_link_student ON public.student_beneficiaries;
CREATE TRIGGER trg_link_student
  AFTER INSERT ON public.student_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.link_student_to_household();

-- =========================================================
-- BACKFILL
-- =========================================================

INSERT INTO public.households (parent_national_id, parent_full_name, parent_phone, parent_email,
  parent_county, parent_ward, household_tracking_id)
SELECT DISTINCT ON (pa.parent_national_id)
       pa.parent_national_id, pa.parent_full_name, pa.parent_phone, pa.parent_email,
       pa.parent_county, pa.parent_ward,
       COALESCE(pa.household_tracking_id, public.generate_household_tracking_id())
FROM public.parent_applications pa
WHERE pa.parent_national_id IS NOT NULL
ORDER BY pa.parent_national_id, pa.created_at ASC
ON CONFLICT (parent_national_id) DO NOTHING;

INSERT INTO public.household_members (household_id, parent_application_id)
SELECT h.id, pa.id
FROM public.parent_applications pa
JOIN public.households h ON h.parent_national_id = pa.parent_national_id
ON CONFLICT DO NOTHING;

INSERT INTO public.household_members (household_id, parent_application_id, student_beneficiary_id)
SELECT h.id, sb.parent_application_id, sb.id
FROM public.student_beneficiaries sb
JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
JOIN public.households h ON h.parent_national_id = pa.parent_national_id
ON CONFLICT DO NOTHING;
