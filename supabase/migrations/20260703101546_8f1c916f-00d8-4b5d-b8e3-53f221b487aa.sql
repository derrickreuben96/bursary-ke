
-- =========================================================
-- Phase 1: Enums
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.education_category AS ENUM ('high_school','university','college','tvet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.assessment_pipeline AS ENUM ('basic_education','higher_education');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- bursary_adverts: quota + budget cap columns (all nullable)
-- =========================================================
ALTER TABLE public.bursary_adverts
  ADD COLUMN IF NOT EXISTS total_slots int,
  ADD COLUMN IF NOT EXISTS high_school_quota_slots int,
  ADD COLUMN IF NOT EXISTS higher_education_quota_slots int,
  ADD COLUMN IF NOT EXISTS high_school_budget_cap numeric,
  ADD COLUMN IF NOT EXISTS higher_education_budget_cap numeric,
  ADD COLUMN IF NOT EXISTS min_award_per_student numeric,
  ADD COLUMN IF NOT EXISTS max_award_per_student numeric;

CREATE OR REPLACE FUNCTION public.validate_advert_quotas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  has_quotas boolean;
BEGIN
  has_quotas := NEW.total_slots IS NOT NULL
             OR NEW.high_school_quota_slots IS NOT NULL
             OR NEW.higher_education_quota_slots IS NOT NULL
             OR NEW.high_school_budget_cap IS NOT NULL
             OR NEW.higher_education_budget_cap IS NOT NULL;
  IF NOT has_quotas THEN RETURN NEW; END IF;

  IF COALESCE(NEW.high_school_quota_slots,0) < 0
     OR COALESCE(NEW.higher_education_quota_slots,0) < 0
     OR COALESCE(NEW.high_school_budget_cap,0) < 0
     OR COALESCE(NEW.higher_education_budget_cap,0) < 0
     OR COALESCE(NEW.min_award_per_student,0) < 0
     OR COALESCE(NEW.max_award_per_student,0) < 0 THEN
    RAISE EXCEPTION 'Quota / budget / award values cannot be negative';
  END IF;

  IF NEW.min_award_per_student IS NOT NULL AND NEW.max_award_per_student IS NOT NULL
     AND NEW.min_award_per_student > NEW.max_award_per_student THEN
    RAISE EXCEPTION 'min_award_per_student cannot exceed max_award_per_student';
  END IF;

  IF NEW.total_slots IS NOT NULL
     AND NEW.high_school_quota_slots IS NOT NULL
     AND NEW.higher_education_quota_slots IS NOT NULL
     AND (NEW.high_school_quota_slots + NEW.higher_education_quota_slots) <> NEW.total_slots THEN
    RAISE EXCEPTION 'Quota slots must sum to total_slots (got % + % <> %)',
      NEW.high_school_quota_slots, NEW.higher_education_quota_slots, NEW.total_slots;
  END IF;

  IF NEW.budget_amount IS NOT NULL
     AND NEW.high_school_budget_cap IS NOT NULL
     AND NEW.higher_education_budget_cap IS NOT NULL
     AND (NEW.high_school_budget_cap + NEW.higher_education_budget_cap) > NEW.budget_amount THEN
    RAISE EXCEPTION 'Category budget caps exceed total budget';
  END IF;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_validate_advert_quotas ON public.bursary_adverts;
CREATE TRIGGER trg_validate_advert_quotas
  BEFORE INSERT OR UPDATE ON public.bursary_adverts
  FOR EACH ROW EXECUTE FUNCTION public.validate_advert_quotas();

-- =========================================================
-- student_beneficiaries: education/pipeline/disability/fraud/rank
-- =========================================================
ALTER TABLE public.student_beneficiaries
  ADD COLUMN IF NOT EXISTS education_category public.education_category,
  ADD COLUMN IF NOT EXISTS assessment_pipeline public.assessment_pipeline,
  ADD COLUMN IF NOT EXISTS ncpwd_registration_number text,
  ADD COLUMN IF NOT EXISTS disability_type text,
  ADD COLUMN IF NOT EXISTS disability_card_url text,
  ADD COLUMN IF NOT EXISTS disability_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rank_in_pipeline int,
  ADD COLUMN IF NOT EXISTS decision_reason_code text,
  ADD COLUMN IF NOT EXISTS poverty_index_score int;

-- Auto-derive pipeline from education_category, and backfill from legacy student_type
CREATE OR REPLACE FUNCTION public.derive_assessment_pipeline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.education_category IS NULL AND NEW.student_type IS NOT NULL THEN
    NEW.education_category := CASE lower(NEW.student_type)
      WHEN 'secondary' THEN 'high_school'::education_category
      WHEN 'university' THEN 'university'::education_category
      WHEN 'college' THEN 'college'::education_category
      WHEN 'tvet' THEN 'tvet'::education_category
      ELSE NULL END;
  END IF;
  IF NEW.education_category IS NOT NULL THEN
    NEW.assessment_pipeline := CASE NEW.education_category
      WHEN 'high_school' THEN 'basic_education'::assessment_pipeline
      ELSE 'higher_education'::assessment_pipeline END;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_derive_assessment_pipeline ON public.student_beneficiaries;
CREATE TRIGGER trg_derive_assessment_pipeline
  BEFORE INSERT OR UPDATE ON public.student_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.derive_assessment_pipeline();

-- Backfill existing rows
UPDATE public.student_beneficiaries
   SET education_category = CASE lower(student_type)
       WHEN 'secondary' THEN 'high_school'::education_category
       WHEN 'university' THEN 'university'::education_category
       WHEN 'college' THEN 'college'::education_category
       WHEN 'tvet' THEN 'tvet'::education_category
       ELSE NULL END
 WHERE education_category IS NULL AND student_type IS NOT NULL;

UPDATE public.student_beneficiaries
   SET assessment_pipeline = CASE education_category
       WHEN 'high_school' THEN 'basic_education'::assessment_pipeline
       ELSE 'higher_education'::assessment_pipeline END
 WHERE assessment_pipeline IS NULL AND education_category IS NOT NULL;

-- =========================================================
-- parent_applications: household id + household disability
-- =========================================================
ALTER TABLE public.parent_applications
  ADD COLUMN IF NOT EXISTS household_tracking_id text,
  ADD COLUMN IF NOT EXISTS household_disability_burden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.generate_household_tracking_id()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  yr text := to_char(now(),'YYYY');
  candidate text;
  n int;
  tries int := 0;
BEGIN
  LOOP
    tries := tries + 1;
    IF tries > 50 THEN RAISE EXCEPTION 'Could not allocate household tracking id'; END IF;
    n := floor(random()*99999)::int + 1;
    candidate := 'BK-HH-' || yr || '-' || lpad(n::text,5,'0');
    IF NOT EXISTS (SELECT 1 FROM public.parent_applications WHERE household_tracking_id = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END $fn$;

CREATE OR REPLACE FUNCTION public.assign_household_tracking_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.household_tracking_id IS NULL OR length(NEW.household_tracking_id)=0 THEN
    NEW.household_tracking_id := public.generate_household_tracking_id();
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_assign_household_tracking_id ON public.parent_applications;
CREATE TRIGGER trg_assign_household_tracking_id
  BEFORE INSERT ON public.parent_applications
  FOR EACH ROW EXECUTE FUNCTION public.assign_household_tracking_id();

-- Backfill legacy rows
UPDATE public.parent_applications
   SET household_tracking_id = public.generate_household_tracking_id()
 WHERE household_tracking_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_parent_applications_household_tracking_id
  ON public.parent_applications(household_tracking_id);

-- =========================================================
-- New table: household_child_codes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.household_child_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_beneficiary_id uuid NOT NULL REFERENCES public.student_beneficiaries(id) ON DELETE CASCADE,
  parent_application_id uuid NOT NULL REFERENCES public.parent_applications(id) ON DELETE CASCADE,
  household_tracking_id text NOT NULL,
  child_code text NOT NULL,
  child_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_tracking_id, child_code),
  UNIQUE (student_beneficiary_id)
);

GRANT SELECT ON public.household_child_codes TO authenticated;
GRANT ALL ON public.household_child_codes TO service_role;

ALTER TABLE public.household_child_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "child_codes_admin_all" ON public.household_child_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "child_codes_commissioner_read" ON public.household_child_codes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'county_commissioner'::app_role));

CREATE POLICY "child_codes_treasury_read" ON public.household_child_codes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'county_treasury'::app_role));

-- Trigger: auto-assign child code on student insert
CREATE OR REPLACE FUNCTION public.assign_household_child_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_hh text;
  v_idx int;
  v_code text;
BEGIN
  SELECT household_tracking_id INTO v_hh
    FROM public.parent_applications WHERE id = NEW.parent_application_id;
  IF v_hh IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(MAX(child_index),0) + 1 INTO v_idx
    FROM public.household_child_codes WHERE household_tracking_id = v_hh;

  v_code := v_hh || '-' || lpad(v_idx::text,2,'0');

  INSERT INTO public.household_child_codes
    (student_beneficiary_id, parent_application_id, household_tracking_id, child_code, child_index)
  VALUES (NEW.id, NEW.parent_application_id, v_hh, v_code, v_idx)
  ON CONFLICT (student_beneficiary_id) DO NOTHING;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_assign_household_child_code ON public.student_beneficiaries;
CREATE TRIGGER trg_assign_household_child_code
  AFTER INSERT ON public.student_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.assign_household_child_code();

-- Backfill child codes for existing students
DO $$
DECLARE r RECORD; v_idx int; v_code text; v_hh text;
BEGIN
  FOR r IN
    SELECT sb.id AS sid, sb.parent_application_id AS pid, pa.household_tracking_id AS hh, sb.created_at
    FROM public.student_beneficiaries sb
    JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
    LEFT JOIN public.household_child_codes hcc ON hcc.student_beneficiary_id = sb.id
    WHERE hcc.id IS NULL AND pa.household_tracking_id IS NOT NULL
    ORDER BY sb.parent_application_id, sb.created_at
  LOOP
    SELECT COALESCE(MAX(child_index),0)+1 INTO v_idx
      FROM public.household_child_codes WHERE household_tracking_id = r.hh;
    v_code := r.hh || '-' || lpad(v_idx::text,2,'0');
    INSERT INTO public.household_child_codes
      (student_beneficiary_id, parent_application_id, household_tracking_id, child_code, child_index)
    VALUES (r.sid, r.pid, r.hh, v_code, v_idx);
  END LOOP;
END $$;

-- =========================================================
-- New table: sms_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  event_type text NOT NULL,
  tracking_id text,
  applicant_name_masked text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_logs_admin_all" ON public.sms_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS ix_sms_logs_tracking_id ON public.sms_logs(tracking_id);
CREATE INDEX IF NOT EXISTS ix_sms_logs_event_type ON public.sms_logs(event_type);

-- =========================================================
-- New table: poverty_question_bank
-- =========================================================
CREATE TABLE IF NOT EXISTS public.poverty_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('static','dynamic')),
  applies_to text NOT NULL CHECK (applies_to IN ('all','basic_education','higher_education')),
  text_en text NOT NULL,
  text_sw text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight_high_school numeric NOT NULL DEFAULT 1,
  weight_higher_ed numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.poverty_question_bank TO anon, authenticated;
GRANT ALL ON public.poverty_question_bank TO service_role;

ALTER TABLE public.poverty_question_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poverty_bank_public_read" ON public.poverty_question_bank
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "poverty_bank_admin_manage" ON public.poverty_question_bank
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- Seed static core questions
INSERT INTO public.poverty_question_bank (code, category, applies_to, text_en, text_sw, options, weight_high_school, weight_higher_ed) VALUES
  ('static.parental_employment','static','all','Parent/guardian employment status?','Hali ya ajira ya mzazi/mlezi?',
   '[{"v":"both_employed","label":"Both employed"},{"v":"one_employed","label":"One employed"},{"v":"self_employed","label":"Self employed"},{"v":"both_unemployed","label":"Both unemployed"},{"v":"deceased","label":"Deceased/N/A"}]'::jsonb, 1.2, 1.0),
  ('static.household_income','static','all','Monthly household income (KES)?','Kipato cha kila mwezi cha kaya (KES)?',
   '[]'::jsonb, 1.5, 1.2),
  ('static.dependents','static','all','Number of dependents in household?','Idadi ya wategemezi katika kaya?',
   '[]'::jsonb, 1.3, 1.0),
  ('static.existing_sponsorship','static','all','Does the student receive any other bursary/sponsorship?','Je, mwanafunzi ana ufadhili mwingine?',
   '[{"v":"none","label":"None"},{"v":"partial","label":"Partial"},{"v":"full","label":"Full HELB/other"}]'::jsonb, 1.0, 1.4),
  ('static.orphan_status','static','all','Orphan status of the student?','Hali ya mwanafunzi (yatima)?',
   '[{"v":"none","label":"Both parents alive"},{"v":"single","label":"Single orphan"},{"v":"double","label":"Double orphan"}]'::jsonb, 1.5, 1.2),
  ('static.household_disability','static','all','Does the household support a person living with disability?','Je, kaya inasaidia mtu mwenye ulemavu?',
   '[{"v":"yes","label":"Yes"},{"v":"no","label":"No"}]'::jsonb, 1.2, 1.0)
ON CONFLICT (code) DO NOTHING;

-- Seed dynamic pool
INSERT INTO public.poverty_question_bank (code, category, applies_to, text_en, text_sw, options, weight_high_school, weight_higher_ed) VALUES
  ('dyn.house_type','dynamic','all','Type of house you live in?','Aina ya nyumba mnayoishi?',
   '[{"v":"owned","label":"Owned"},{"v":"rented","label":"Rented"},{"v":"informal","label":"Informal"},{"v":"other","label":"Other"}]'::jsonb, 1.0, 1.0),
  ('dyn.rent_amount','dynamic','all','Monthly rent amount (KES)?','Kodi ya kila mwezi (KES)?','[]'::jsonb, 0.8, 0.9),
  ('dyn.water_source','dynamic','all','Primary source of water?','Chanzo kikuu cha maji?',
   '[{"v":"tap","label":"Piped tap"},{"v":"borehole","label":"Borehole"},{"v":"river","label":"River"},{"v":"vendor","label":"Vendor"}]'::jsonb, 0.8, 0.6),
  ('dyn.electricity','dynamic','all','Electricity consistency at home?','Uhakika wa umeme nyumbani?',
   '[{"v":"always","label":"Always available"},{"v":"intermittent","label":"Sometimes"},{"v":"none","label":"None"}]'::jsonb, 0.7, 0.7),
  ('dyn.food_frequency','dynamic','all','How often does the household have full meals?','Ni mara ngapi kaya ina milo kamili?',
   '[{"v":"3","label":"3 or more"},{"v":"2","label":"2 per day"},{"v":"1","label":"1 per day"},{"v":"less","label":"Less than once"}]'::jsonb, 1.2, 0.8),
  ('dyn.transport','dynamic','all','Transport burden to school/institution?','Mzigo wa usafiri kwenda shule/chuo?',
   '[{"v":"walk","label":"Walk"},{"v":"public","label":"Public transport"},{"v":"boarding","label":"Boarding"},{"v":"private","label":"Private"}]'::jsonb, 1.0, 1.1),
  ('dyn.assets','dynamic','all','Household asset ownership?','Umiliki wa mali ya kaya?',
   '[{"v":"none","label":"None"},{"v":"basic","label":"Basic"},{"v":"moderate","label":"Moderate"},{"v":"substantial","label":"Substantial"}]'::jsonb, 0.9, 0.9),
  ('dyn.livestock','dynamic','all','Livestock ownership?','Umiliki wa mifugo?',
   '[{"v":"none","label":"None"},{"v":"few","label":"Few"},{"v":"herd","label":"Herd"}]'::jsonb, 0.7, 0.5),
  ('dyn.medical','dynamic','all','Regular medical expenses in the household?','Gharama za matibabu za mara kwa mara?',
   '[{"v":"none","label":"None"},{"v":"moderate","label":"Moderate"},{"v":"heavy","label":"Heavy chronic"}]'::jsonb, 1.1, 1.0),
  ('dyn.distance','dynamic','all','Distance from home to institution (km)?','Umbali kutoka nyumbani hadi chuoni (km)?','[]'::jsonb, 0.8, 1.0),
  ('dyn.helb_status','dynamic','higher_education','HELB loan status?','Hali ya mkopo wa HELB?',
   '[{"v":"approved","label":"Approved"},{"v":"pending","label":"Pending"},{"v":"denied","label":"Denied"},{"v":"none","label":"Never applied"}]'::jsonb, 0.0, 1.4),
  ('dyn.accommodation','dynamic','higher_education','Accommodation arrangement?','Malazi?',
   '[{"v":"hostel","label":"Institution hostel"},{"v":"private","label":"Private rental"},{"v":"home","label":"Home"}]'::jsonb, 0.0, 1.2)
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- New table: application_decision_log (immutable, insert-only)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.application_decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_beneficiary_id uuid NOT NULL REFERENCES public.student_beneficiaries(id) ON DELETE CASCADE,
  parent_application_id uuid REFERENCES public.parent_applications(id) ON DELETE SET NULL,
  advert_id uuid REFERENCES public.bursary_adverts(id) ON DELETE SET NULL,
  decision text NOT NULL,
  poverty_score int,
  fraud_score int,
  disability_score int,
  rank_in_pipeline int,
  quota_category text,
  reason_code text,
  decided_by uuid,
  decided_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.application_decision_log TO authenticated;
GRANT ALL ON public.application_decision_log TO service_role;

ALTER TABLE public.application_decision_log ENABLE ROW LEVEL SECURITY;

-- Insert only via service role / admin / commissioner
CREATE POLICY "decision_log_admin_insert" ON public.application_decision_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role)
           OR has_role(auth.uid(),'county_commissioner'::app_role));

CREATE POLICY "decision_log_admin_read" ON public.application_decision_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
       OR has_role(auth.uid(),'county_commissioner'::app_role)
       OR has_role(auth.uid(),'county_treasury'::app_role));

-- No update / delete policies → immutable for all non-service-role users.

CREATE INDEX IF NOT EXISTS ix_decision_log_student ON public.application_decision_log(student_beneficiary_id);
CREATE INDEX IF NOT EXISTS ix_decision_log_advert ON public.application_decision_log(advert_id);
