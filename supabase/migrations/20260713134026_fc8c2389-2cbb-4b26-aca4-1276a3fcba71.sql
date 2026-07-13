-- Defense-in-depth: parent_applications.submit_parent_application already
-- prevents a second submission for the same advert + national ID via an
-- explicit count check inside the RPC. This partial unique index guarantees
-- the same invariant at the database level so any future code path
-- (edge function, admin insert, direct SQL) cannot bypass it.
--
-- Verified before shipping: `SELECT advert_id, parent_national_id, count(*)
-- FROM public.parent_applications GROUP BY 1,2 HAVING count(*) > 1` returned
-- zero rows, so the constraint applies cleanly to existing data.
CREATE UNIQUE INDEX IF NOT EXISTS parent_applications_advert_national_id_uniq
  ON public.parent_applications (advert_id, parent_national_id)
  WHERE advert_id IS NOT NULL AND parent_national_id IS NOT NULL;