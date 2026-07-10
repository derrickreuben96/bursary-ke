
# Bursary KE — Household Layer & Production Refactor (Additive)

This is a **strictly additive** upgrade. No existing table, column, tracking number, RLS policy, edge function, or workflow will be removed or renamed. Every change is guarded by feature detection and backward-compatible defaults.

Note on current state: the codebase already has partial foundations — `parent_applications.household_tracking_id` (BK-HH-YYYY-NNNNN), `household_child_codes`, `application_status_history`, `application_decision_log`, `student_beneficiaries` with fraud fields, and `get_parent_application_by_tracking` / `get_household_by_id` RPCs. The plan below builds **on top of** those instead of re-creating them.

---

## Phase A — Database (single additive migration)

New tables (all with GRANTs + RLS via `has_role`):

- `households` — one row per `parent_national_id`. Columns: `id`, `parent_national_id UNIQUE`, `parent_full_name`, `parent_phone`, `parent_email`, `parent_county`, `parent_ward`, `household_tracking_id UNIQUE` (reuses `BK-HH-YYYY-NNNNN` format), timestamps.
- `household_members` — link table `household_id → parent_application_id` (nullable) and `student_beneficiary_id` (nullable). Enables grouping legacy applications without touching them.
- `audit_logs` — immutable (`INSERT`-only policy): `actor_user_id`, `actor_role`, `event_type`, `entity_type`, `entity_id`, `ip`, `user_agent`, `details jsonb`, `created_at`. No UPDATE / DELETE policies.
- `notification_history` — per-household consolidated feed: `household_id`, `channel` (in_app/sms/email), `event_type`, `title`, `body`, `read_at`, `created_at`.
- `fraud_flags` — `student_beneficiary_id`, `flag_code`, `severity`, `evidence jsonb`, `created_at`. (Complements existing `student_beneficiaries.fraud_score`.)
- `duplicate_detection` — `parent_national_id`, `applicant_identifier`, `match_type`, `resolved` (bool), `resolution_notes`.
- `application_timeline` — denormalized view/materialized table combining `application_status_history` + `application_decision_log` for fast per-household timeline queries.

Indexes:
- `households(parent_national_id)`, `households(household_tracking_id)`
- `household_members(household_id)`, `household_members(parent_application_id)`, `household_members(student_beneficiary_id)`
- `audit_logs(entity_type, entity_id, created_at desc)`
- `notification_history(household_id, created_at desc)`
- `parent_applications(parent_national_id)` if missing

Backfill (idempotent, inside the same migration):
- For every distinct `parent_national_id` in `parent_applications`, upsert a `households` row (reuse the most recent `household_tracking_id` if present, otherwise call `generate_household_tracking_id()`).
- Insert one `household_members` row for every existing `parent_applications` row and every `student_beneficiaries` row.
- No existing tracking numbers (`BKE-XXXXXX`) are altered.

## Phase B — Database functions & triggers (additive)

- `get_or_create_household(_national_id, _parent jsonb) → households` — SECURITY DEFINER. Called by the existing `submit_parent_application` RPC (edit is additive: append call at top, use returned id to insert into `household_members` after the parent row is created).
- `get_household_summary(_household_id_or_tracking, _verifier)` → JSON with parent info, applicants, statuses, timeline. Extends existing `get_household_by_id` — old function stays; new one supersets it.
- `log_audit(_event_type, _entity_type, _entity_id, _details)` — helper used by triggers and edge functions.
- Triggers on `parent_applications`, `student_beneficiaries`, `bursary_applications`: on INSERT/UPDATE of status, call `log_audit(...)`. Existing `log_status_change` trigger stays; the new trigger only writes to `audit_logs`.
- `detect_duplicate_applicant(_parent_national_id, _identifier, _institution, _year)` → returns match rows, writes to `duplicate_detection`. Called from `submit_parent_application` before insert; on match, raises a soft warning surfaced through the RPC return payload (not a hard rejection).

## Phase C — Form audit & shared components (frontend)

Audit target (files already in repo): `ParentGuardianForm.tsx`, `SecondaryStudentForm.tsx`, `UniversityStudentForm.tsx`, `StudentsRepeater.tsx`, `PovertyQuestionnaire.tsx`, `DynamicPovertyBank.tsx`, `ReviewSubmit.tsx`.

Deliverables:
- New folder `src/components/application/fields/` with shared, single-source primitives:
  - `NationalIdField`, `PhoneField`, `EmailField`, `NemisIdField`, `AdmissionNumberField`, `InstitutionSelect`, `CountyWardSelect`, `EducationLevelSelect`, `FeeBalanceField`, `DisabilityBlock` (NCPWD reg + type + card upload).
- New `src/lib/schemas/` central Zod definitions imported by every form; existing `validationSchemas.ts` re-exports from here to preserve imports.
- Refactor Secondary / University / Repeater forms to consume the shared primitives. Same field IDs, same labels — but rendered exactly once per screen.
- Add a unit test `formSchemaUniqueness.test.ts` that scans the shared registry and asserts unique field IDs / labels / validators.

## Phase D — Household UX

- New route `/parent` (Household dashboard). Existing `/apply/secondary` and `/apply/university` keep working; the dashboard has "+ Add Applicant" that routes into them with `?household_id=` prefilled.
- `HouseholdDashboard.tsx` — parent info card, household tracking number, applicants table (name, level, institution, status, last updated), buttons: View / Edit / Track / Download / Notifications.
- `AddApplicantWizard.tsx` — step 1 picks Secondary / University / TVET / College; step 2 loads the corresponding form with `household_id` prefilled.
- `ExistingHouseholdBanner.tsx` — shown on the Parent Guardian form when the entered National ID matches a household; asks "Add another applicant to this household?" and logs the decision to `audit_logs`.
- `/track` extended to search either `BK-HH-YYYY-NNNNN` or `BKE-XXXXXX` — both work; the household form of the result groups all children.

## Phase E — Admin

- Admin search: entering a Parent ID returns the full household (applicants, statuses, timeline, audit history, institution distribution, education level breakdown, approvals). Uses `get_household_summary`.
- Extend `AdminDashboard.tsx` with a "Household View" tab; existing tabs untouched.
- New `NotificationsPanel` reads from `notification_history` scoped by household or (for admin) globally.

## Phase F — Notifications

- Edge function `household-notify` (new; sibling to existing SMS/email functions). Writes to `notification_history` and fans out to existing `sms-lifecycle` / `send-transactional-email`. Not called from any legacy flow unless a status transition occurs.
- Parent dashboard shows unread badge + feed.

## Phase G — Security

- All new tables: RLS on, policies via `has_role` (`admin`, `county_commissioner`, `county_treasury`) plus household-owner reads via `parent_national_id` match through SECURITY DEFINER RPCs — never direct client SELECT on PII.
- Rate limiting: reuse `_shared/rateLimiter.ts` on any new edge function.
- Input validation: Zod on frontend, `SET search_path` + explicit type casts on every new SQL function.
- `audit_logs` has no UPDATE / DELETE policy — immutable.

## Phase H — Migration report

At the end, generate `.lovable/reports/household-migration-report.md` covering:
- New tables + indexes.
- Untouched legacy tables (explicit list).
- Backfill counts (households created, members linked).
- Compatibility checks (legacy tracking lookup still resolves, legacy adverts still allocate).
- Regression test results.
- Manual follow-ups (none expected; noted if any).

## Phase I — Tests (Vitest + Deno for RPCs)

- `householdCreation.test.ts` — get_or_create_household idempotent per national id.
- `householdBackfill.test.ts` — every legacy `parent_applications` row has a `household_members` link.
- `duplicateDetection.test.ts` — same NEMIS / admission across households flags but doesn't reject.
- `auditImmutability.test.ts` — attempts to UPDATE / DELETE `audit_logs` fail.
- `trackingLookup.test.ts` — both `BK-HH-*` and `BKE-*` resolve.
- `formUniqueness.test.ts` — no duplicate field IDs / labels.
- Regression: existing Vitest + Deno RLS suites must pass unchanged.

---

## Execution order

1. Migration (all new tables, indexes, triggers, functions, backfill) — single call.
2. Edit `submit_parent_application` (additive) + add helpers.
3. Frontend shared field primitives + form refactor.
4. Household dashboard + Add Applicant wizard + track lookup extension.
5. Admin household view + notifications feed.
6. `household-notify` edge function.
7. Tests + migration report.

## Out of scope (explicit)

- No changes to `BKE-XXXXXX` tracking format or `bursary_applications` legacy fields.
- No auth provider changes, no RLS helper renames.
- No changes to allocation math or AI decision pipeline.
- No visual redesign — reuses existing tokens and Kenyan theme.

---

**Scope is large (~1 migration + ~15 files). Confirm and I'll execute in the order above, starting with the migration.**
