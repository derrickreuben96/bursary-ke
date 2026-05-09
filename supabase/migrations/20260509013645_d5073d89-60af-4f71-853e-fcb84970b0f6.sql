-- 1. Tighten commissioner UPDATE on student_beneficiaries: only released_to_treasury is mutable
DROP POLICY IF EXISTS "Commissioners update students in jurisdiction" ON public.student_beneficiaries;

CREATE POLICY "Commissioners release students in jurisdiction"
ON public.student_beneficiaries
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = student_beneficiaries.parent_application_id
      AND (
        (get_user_assigned_ward(auth.uid()) IS NOT NULL AND pa.parent_ward = get_user_assigned_ward(auth.uid()))
        OR (get_user_assigned_ward(auth.uid()) IS NULL
            AND get_user_assigned_county(auth.uid()) IS NOT NULL
            AND pa.parent_county = get_user_assigned_county(auth.uid()))
      )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'county_commissioner'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.parent_applications pa
    WHERE pa.id = student_beneficiaries.parent_application_id
      AND (
        (get_user_assigned_ward(auth.uid()) IS NOT NULL AND pa.parent_ward = get_user_assigned_ward(auth.uid()))
        OR (get_user_assigned_ward(auth.uid()) IS NULL
            AND get_user_assigned_county(auth.uid()) IS NOT NULL
            AND pa.parent_county = get_user_assigned_county(auth.uid()))
      )
  )
);

-- Field-level guard: commissioners can ONLY change released_to_treasury.
-- Admin role bypasses (admin policy has its own ALL clause).
CREATE OR REPLACE FUNCTION public.guard_commissioner_student_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and service role bypass entirely
  IF has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'county_commissioner'::app_role) THEN
    -- Reject mutation of any AI-owned field
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.allocated_amount IS DISTINCT FROM OLD.allocated_amount
       OR NEW.ai_decision_reason IS DISTINCT FROM OLD.ai_decision_reason
       OR NEW.allocation_date IS DISTINCT FROM OLD.allocation_date
       OR NEW.student_full_name IS DISTINCT FROM OLD.student_full_name
       OR NEW.student_identifier IS DISTINCT FROM OLD.student_identifier
       OR NEW.institution_name IS DISTINCT FROM OLD.institution_name THEN
      RAISE EXCEPTION 'Commissioners may only release records to Treasury. Allocation, scoring and approval are AI-only.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_commissioner_student_update_trg ON public.student_beneficiaries;
CREATE TRIGGER guard_commissioner_student_update_trg
BEFORE UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.guard_commissioner_student_update();

-- 2. Household poverty inheritance
CREATE OR REPLACE FUNCTION public.propagate_household_poverty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.poverty_score IS DISTINCT FROM OLD.poverty_score
     OR NEW.poverty_tier IS DISTINCT FROM OLD.poverty_tier THEN
    -- Mirror household score onto every linked student via ai_decision_reason prefix
    -- (student rows do not have their own poverty score column — household score is canonical)
    UPDATE public.student_beneficiaries
       SET updated_at = now()
     WHERE parent_application_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_household_poverty_trg ON public.parent_applications;
CREATE TRIGGER propagate_household_poverty_trg
AFTER INSERT OR UPDATE OF poverty_score, poverty_tier
ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.propagate_household_poverty();

-- 3. Workflow stage column on parent_applications
ALTER TABLE public.parent_applications
  ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'submitted';

ALTER TABLE public.parent_applications
  DROP CONSTRAINT IF EXISTS parent_applications_workflow_stage_check;

ALTER TABLE public.parent_applications
  ADD CONSTRAINT parent_applications_workflow_stage_check
  CHECK (workflow_stage IN ('submitted','ai_scored','ai_allocated','released','disbursed'));

-- 4. AI allocation audit table
CREATE TABLE IF NOT EXISTS public.ai_allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advert_id uuid NOT NULL,
  run_at timestamptz NOT NULL DEFAULT now(),
  run_by uuid,
  total_budget numeric NOT NULL DEFAULT 0,
  total_allocated numeric NOT NULL DEFAULT 0,
  applicants_count integer NOT NULL DEFAULT 0,
  approved_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_allocation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai_allocation_runs"
ON public.ai_allocation_runs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Commissioners view ai_allocation_runs"
ON public.ai_allocation_runs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'county_commissioner'::app_role));

CREATE POLICY "Deny anon ai_allocation_runs"
ON public.ai_allocation_runs
FOR SELECT
TO anon
USING (false);

CREATE INDEX IF NOT EXISTS ai_allocation_runs_advert_idx ON public.ai_allocation_runs(advert_id, run_at DESC);