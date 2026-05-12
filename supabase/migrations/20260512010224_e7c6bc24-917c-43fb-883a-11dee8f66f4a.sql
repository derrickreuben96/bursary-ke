-- Re-attach triggers that were defined as functions but never bound.
-- This is the root cause of the "fragmented flow" — status changes did not
-- cascade to parent_applications / student_beneficiaries, adverts never
-- auto-closed when fully disbursed, audit history never recorded, and
-- realtime broadcasts never fired.

-- 1. bursary_applications: status_history audit, dashboard broadcast,
--    cascade to parent/students, and auto-close advert on disbursement.
DROP TRIGGER IF EXISTS trg_log_status_change ON public.bursary_applications;
CREATE TRIGGER trg_log_status_change
AFTER UPDATE OF status ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_emit_dashboard_event ON public.bursary_applications;
CREATE TRIGGER trg_emit_dashboard_event
AFTER INSERT OR UPDATE ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.emit_dashboard_event();

DROP TRIGGER IF EXISTS trg_propagate_legacy_to_students ON public.bursary_applications;
CREATE TRIGGER trg_propagate_legacy_to_students
AFTER UPDATE ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.propagate_legacy_to_students();

DROP TRIGGER IF EXISTS trg_close_advert_when_fully_disbursed ON public.bursary_applications;
CREATE TRIGGER trg_close_advert_when_fully_disbursed
AFTER UPDATE OF status ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.close_advert_when_fully_disbursed();

DROP TRIGGER IF EXISTS trg_validate_ward_bursary_match ON public.bursary_applications;
CREATE TRIGGER trg_validate_ward_bursary_match
BEFORE INSERT ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_ward_bursary_match();

-- 2. parent_applications mirrors
DROP TRIGGER IF EXISTS trg_emit_parent_dashboard_event ON public.parent_applications;
CREATE TRIGGER trg_emit_parent_dashboard_event
AFTER INSERT OR UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.emit_parent_dashboard_event();

DROP TRIGGER IF EXISTS trg_propagate_household_poverty ON public.parent_applications;
CREATE TRIGGER trg_propagate_household_poverty
AFTER INSERT OR UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.propagate_household_poverty();

DROP TRIGGER IF EXISTS trg_validate_parent_ward_bursary_match ON public.parent_applications;
CREATE TRIGGER trg_validate_parent_ward_bursary_match
BEFORE INSERT ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_parent_ward_bursary_match();

-- 3. student_beneficiaries
DROP TRIGGER IF EXISTS trg_log_student_status_change ON public.student_beneficiaries;
CREATE TRIGGER trg_log_student_status_change
AFTER UPDATE OF status ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.log_student_status_change();

DROP TRIGGER IF EXISTS trg_enforce_max_three_students ON public.student_beneficiaries;
CREATE TRIGGER trg_enforce_max_three_students
BEFORE INSERT ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_three_students();

DROP TRIGGER IF EXISTS trg_enforce_unique_student_per_advert ON public.student_beneficiaries;
CREATE TRIGGER trg_enforce_unique_student_per_advert
BEFORE INSERT OR UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_student_per_advert();

DROP TRIGGER IF EXISTS trg_guard_commissioner_student_update ON public.student_beneficiaries;
CREATE TRIGGER trg_guard_commissioner_student_update
BEFORE UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.guard_commissioner_student_update();

-- 4. bursary_adverts: auto-expire on save and validate ward
DROP TRIGGER IF EXISTS trg_auto_expire_advert ON public.bursary_adverts;
CREATE TRIGGER trg_auto_expire_advert
BEFORE INSERT OR UPDATE ON public.bursary_adverts
FOR EACH ROW EXECUTE FUNCTION public.auto_expire_advert();

DROP TRIGGER IF EXISTS trg_validate_advert_county_ward ON public.bursary_adverts;
CREATE TRIGGER trg_validate_advert_county_ward
BEFORE INSERT OR UPDATE ON public.bursary_adverts
FOR EACH ROW EXECUTE FUNCTION public.validate_advert_county_ward();

-- 5. updated_at maintenance
DROP TRIGGER IF EXISTS trg_bursary_applications_updated_at ON public.bursary_applications;
CREATE TRIGGER trg_bursary_applications_updated_at
BEFORE UPDATE ON public.bursary_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_parent_applications_updated_at ON public.parent_applications;
CREATE TRIGGER trg_parent_applications_updated_at
BEFORE UPDATE ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_student_beneficiaries_updated_at ON public.student_beneficiaries;
CREATE TRIGGER trg_student_beneficiaries_updated_at
BEFORE UPDATE ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_bursary_adverts_updated_at ON public.bursary_adverts;
CREATE TRIGGER trg_bursary_adverts_updated_at
BEFORE UPDATE ON public.bursary_adverts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. SECURITY DEFINER RPC for treasury disbursement.
-- This replaces the raw UPDATE in the frontend, which silently failed
-- (no observable count returned because treasury lacks a SELECT policy
-- on bursary_applications). Validates caller, scopes to assigned county,
-- updates status, sets allocation_date, returns affected count + advert
-- closure status so the UI can refresh deterministically.
CREATE OR REPLACE FUNCTION public.treasury_disburse_applications(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_county text;
  v_updated int;
  v_advert_ids uuid[];
  v_closed_advert_ids uuid[];
BEGIN
  IF NOT (has_role(auth.uid(), 'county_treasury'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden: treasury role required' USING ERRCODE = '42501';
  END IF;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('updated', 0, 'closed_advert_ids', '[]'::jsonb);
  END IF;

  IF has_role(auth.uid(), 'county_treasury'::app_role) THEN
    SELECT assigned_county INTO v_county
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    IF v_county IS NULL THEN
      RAISE EXCEPTION 'Treasury account is not assigned to a county' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Capture affected adverts before update
  SELECT array_agg(DISTINCT advert_id) INTO v_advert_ids
  FROM public.bursary_applications
  WHERE id = ANY(_ids) AND advert_id IS NOT NULL;

  WITH updated AS (
    UPDATE public.bursary_applications
       SET status = 'disbursed'::application_status,
           allocation_date = COALESCE(allocation_date, now()),
           updated_at = now()
     WHERE id = ANY(_ids)
       AND released_to_treasury = true
       AND status = 'approved'::application_status
       AND (v_county IS NULL OR parent_county = v_county)
    RETURNING id, advert_id
  )
  SELECT count(*) INTO v_updated FROM updated;

  -- Identify adverts that became fully disbursed (the trigger does this too,
  -- but we collect ids to return to the UI for instant refresh).
  IF v_advert_ids IS NOT NULL THEN
    SELECT array_agg(adv_id) INTO v_closed_advert_ids
    FROM (
      SELECT a.id AS adv_id
      FROM public.bursary_adverts a
      WHERE a.id = ANY(v_advert_ids)
        AND NOT EXISTS (
          SELECT 1 FROM public.bursary_applications ba
          WHERE ba.advert_id = a.id
            AND ba.released_to_treasury = true
            AND ba.status = 'approved'::application_status
        )
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'updated', COALESCE(v_updated, 0),
    'closed_advert_ids', COALESCE(to_jsonb(v_closed_advert_ids), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.treasury_disburse_applications(uuid[]) TO authenticated;

-- 7. Backfill: close any adverts that should already be closed
UPDATE public.bursary_adverts a
   SET closed_at = COALESCE(closed_at, now()),
       is_active = false,
       updated_at = now()
 WHERE closed_at IS NULL
   AND EXISTS (SELECT 1 FROM public.bursary_applications ba
                WHERE ba.advert_id = a.id AND ba.released_to_treasury = true)
   AND NOT EXISTS (SELECT 1 FROM public.bursary_applications ba
                    WHERE ba.advert_id = a.id
                      AND ba.released_to_treasury = true
                      AND ba.status = 'approved'::application_status);