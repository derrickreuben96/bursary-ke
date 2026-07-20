CREATE OR REPLACE FUNCTION public.propagate_legacy_to_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
  v_total_weight numeric;
  v_household_amount numeric;
BEGIN
  SELECT id INTO v_parent_id FROM public.parent_applications
  WHERE tracking_number = NEW.tracking_number LIMIT 1;
  IF v_parent_id IS NULL THEN RETURN NEW; END IF;

  IF NOT (
       (NEW.status IS DISTINCT FROM OLD.status)
    OR (NEW.allocated_amount IS DISTINCT FROM OLD.allocated_amount)
    OR (NEW.released_to_treasury IS DISTINCT FROM OLD.released_to_treasury)
    OR (NEW.ai_decision_reason IS DISTINCT FROM OLD.ai_decision_reason)
  ) THEN
    RETURN NEW;
  END IF;

  v_household_amount := COALESCE(NEW.allocated_amount, 0);

  -- Weight per education level (higher-ed carries greater fee burden).
  -- Only count students not already individually approved (those keep their amount).
  SELECT COALESCE(SUM(
           CASE lower(student_type)
             WHEN 'university' THEN 1.8
             WHEN 'college'    THEN 1.5
             WHEN 'tvet'       THEN 1.3
             ELSE 1.0
           END
         ), 0)
    INTO v_total_weight
    FROM public.student_beneficiaries
   WHERE parent_application_id = v_parent_id
     AND NOT (status = 'approved' AND COALESCE(allocated_amount, 0) > 0);

  -- Update ONLY students not already individually approved.
  IF v_total_weight > 0 THEN
    UPDATE public.student_beneficiaries sb
       SET status = NEW.status::text,
           allocated_amount = CASE
             WHEN NEW.allocated_amount IS NOT NULL AND NEW.status::text = 'approved' THEN
               ROUND(v_household_amount *
                 (CASE lower(sb.student_type)
                    WHEN 'university' THEN 1.8
                    WHEN 'college'    THEN 1.5
                    WHEN 'tvet'       THEN 1.3
                    ELSE 1.0
                  END) / v_total_weight)
             WHEN NEW.status::text = 'rejected' THEN 0
             ELSE sb.allocated_amount
           END,
           allocation_date = COALESCE(NEW.allocation_date, sb.allocation_date),
           released_to_treasury = NEW.released_to_treasury,
           ai_decision_reason = COALESCE(NEW.ai_decision_reason, sb.ai_decision_reason),
           updated_at = now()
     WHERE sb.parent_application_id = v_parent_id
       AND NOT (sb.status = 'approved' AND COALESCE(sb.allocated_amount, 0) > 0);
  END IF;

  -- Keep parent_applications header in sync (status/release flag),
  -- but derive the header amount from the sum of student allocations so
  -- partial per-student approvals aggregate correctly.
  UPDATE public.parent_applications pa
     SET status = NEW.status::text,
         released_to_treasury = NEW.released_to_treasury,
         ai_decision_reason = COALESCE(NEW.ai_decision_reason, pa.ai_decision_reason),
         updated_at = now()
   WHERE pa.id = v_parent_id;

  RETURN NEW;
END; $$;
