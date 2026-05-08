
CREATE OR REPLACE FUNCTION public.propagate_legacy_to_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_student_count int;
  v_per_student numeric;
BEGIN
  SELECT id INTO v_parent_id FROM public.parent_applications
  WHERE tracking_number = NEW.tracking_number LIMIT 1;
  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_student_count FROM public.student_beneficiaries
  WHERE parent_application_id = v_parent_id;
  IF v_student_count = 0 THEN RETURN NEW; END IF;

  v_per_student := COALESCE(NEW.allocated_amount, 0) / GREATEST(v_student_count, 1);

  -- Status / allocation propagation
  IF (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.allocated_amount IS DISTINCT FROM OLD.allocated_amount)
     OR (NEW.released_to_treasury IS DISTINCT FROM OLD.released_to_treasury)
     OR (NEW.ai_decision_reason IS DISTINCT FROM OLD.ai_decision_reason) THEN

    UPDATE public.student_beneficiaries
       SET status = NEW.status::text,
           allocated_amount = CASE WHEN NEW.allocated_amount IS NOT NULL
                                    THEN v_per_student ELSE allocated_amount END,
           allocation_date = COALESCE(NEW.allocation_date, allocation_date),
           released_to_treasury = NEW.released_to_treasury,
           ai_decision_reason = COALESCE(NEW.ai_decision_reason, ai_decision_reason),
           updated_at = now()
     WHERE parent_application_id = v_parent_id;

    UPDATE public.parent_applications
       SET status = NEW.status::text,
           released_to_treasury = NEW.released_to_treasury,
           ai_decision_reason = COALESCE(NEW.ai_decision_reason, ai_decision_reason),
           updated_at = now()
     WHERE id = v_parent_id;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_propagate_legacy_to_students ON public.bursary_applications;
CREATE TRIGGER trg_propagate_legacy_to_students
AFTER UPDATE ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.propagate_legacy_to_students();
