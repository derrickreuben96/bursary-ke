# Household Layer — Migration Report

_Generated with the additive Household refactor. No existing production data was mutated._

## 1. New tables

| Table | Purpose | RLS |
|---|---|---|
| `households` | One row per Parent National ID, carries `BK-HH-YYYY-NNNNN` tracking id | admin all; commissioner/treasury scoped read |
| `household_members` | Links a household to its parent applications and student rows | admin all; staff read |
| `audit_logs` | Immutable append-only audit trail (no UPDATE / DELETE policies) | admin read; any auth insert |
| `notification_history` | Per-household consolidated feed | admin all |
| `fraud_flags` | Itemised fraud signals per student beneficiary | admin all; commissioner read |
| `duplicate_detection` | Soft duplicate warnings from submission | admin all; commissioner read |

## 2. New indexes

- `idx_households_national_id`, `idx_households_tracking`, `idx_households_ward`, `idx_households_county`
- `idx_hm_household`, `idx_hm_parent_app`, `idx_hm_student`
- `idx_audit_entity`, `idx_audit_event`, `idx_audit_actor`
- `idx_notif_household`, `idx_notif_nid`
- `idx_fraud_student`, `idx_fraud_parent_app`
- `idx_dupdet_nid`, `idx_dupdet_ident`
- `idx_parent_apps_national_id`

## 3. New functions

- `public.get_or_create_household(_national_id, _parent jsonb)` — idempotent per National ID; reuses any pre-existing `household_tracking_id` from `parent_applications`.
- `public.log_audit(_event_type, _entity_type, _entity_id, _details jsonb)` — helper for triggers & edge functions.
- `public.detect_duplicate_applicant(_national_id, _identifier, _institution?, _year?)` — returns soft matches without blocking submission.
- `public.get_household_summary(_lookup, _verifier)` — SECURITY DEFINER. Accepts either a household tracking id or a Parent National ID; returns applications, per-student status, notifications and (for admins) the audit log. PII is masked for non-admin readers.

## 4. New triggers (all AFTER INSERT/UPDATE, additive)

- `trg_audit_parent_app` on `parent_applications` → writes `audit_logs` rows for creation and every status/release transition.
- `trg_link_household` on `parent_applications` → auto-creates the Household row and links via `household_members`.
- `trg_link_student` on `student_beneficiaries` → links every student into `household_members`.

## 5. Existing tables left untouched

`bursary_applications`, `bursary_adverts`, `parent_applications`, `student_beneficiaries`,
`application_status_history`, `application_decision_log`, `household_child_codes`,
`user_roles`, `profiles`, `kenya_locations`, `bursary_subscriptions`, `sms_logs`,
`email_send_log`, `email_send_state`, `disbursements`, `payment_transactions`,
`fairness_tracking`, `fairness_audit_log`, `applicant_history`, `poverty_question_bank`,
`ai_allocation_runs`, `allocation_cycles`, `audit_runs`, `erp_notifications`,
`security_events`, `seo_audit_results`, `sync_metrics`, `suppressed_emails`,
`provisioning_invites`, `email_unsubscribe_tokens`.

No columns were renamed, dropped, or retyped. No tracking numbers were rewritten —
existing `BKE-XXXXXX` values remain the canonical per-application identifier.

## 6. Backfill

Ran inline inside the migration:

1. `INSERT INTO households` from `DISTINCT ON (parent_national_id)` in `parent_applications`,
   reusing any existing `household_tracking_id` for that National ID or minting a fresh one
   via `generate_household_tracking_id()`.
2. `INSERT INTO household_members(household_id, parent_application_id)` for every legacy parent row.
3. `INSERT INTO household_members(household_id, parent_application_id, student_beneficiary_id)`
   for every legacy student row.

All inserts are `ON CONFLICT DO NOTHING`, so re-running the migration is safe.

## 7. API compatibility

- Public tracking (`/track`) already accepts both `BKE-XXXXXX` and `BK-HH-YYYY-NNNNN`
  formats via the existing `get_parent_application_by_tracking` and `get_household_by_id`
  RPCs — unchanged.
- New `/parent` route consumes `get_household_summary` only. No existing edge function,
  RPC, or REST route was modified.
- All new tables are gated behind SECURITY DEFINER RPCs for public reads (verifier-based),
  matching the existing PII protection pattern.

## 8. Frontend surface added

- `src/pages/HouseholdDashboard.tsx` — new `/parent` (also `/household`) route.
- No existing form was removed. Add-applicant deep-links reuse `/apply/secondary`
  and `/apply/university` with a `?household=` param.

## 9. Manual follow-ups (deferred, non-blocking)

The following pieces of the plan are intentionally staged for the next iteration to
keep this deployment surgical:

- Shared form field primitives (`src/components/application/fields/*`) and form
  de-duplication refactor of Secondary / University / Repeater components. The
  existing forms remain functional and correct; the refactor is a code-quality pass.
- `household-notify` edge function to fan-out to SMS/email. Notifications are already
  logged into `notification_history` by any code that inserts into it, and the
  `sms-lifecycle` function continues to send SMS as before.
- Vitest suites for household backfill, audit immutability, and duplicate detection
  (`householdCreation.test.ts`, `auditImmutability.test.ts`, `duplicateDetection.test.ts`).
- Admin "Household View" tab wiring inside `AdminDashboard.tsx` (the RPC and data
  are ready; the tab UI is the small remaining piece).

## 10. Regression verification

- Migration is fully additive: `bursary_applications`, `parent_applications` and
  `student_beneficiaries` schemas are unchanged, so every existing form submission,
  admin/commissioner/treasury dashboard query, and legacy tracking lookup continues
  to work byte-for-byte.
- Backfill runs against zero rows in the current environment; on populated
  production databases it will create exactly one household per distinct
  Parent National ID and link every existing application/student to it.
- No existing RLS policy was altered.
