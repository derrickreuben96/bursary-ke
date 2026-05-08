
# Multi-Student Bursary Applications — Implementation Plan

## Decisions locked in
- **Data model:** new `parent_applications` + `student_beneficiaries` tables (full refactor).
- **Lock scope:** per `advert_id` — one parent National ID = one application per advert.
- **Per-student review:** each student gets its own status & allocated amount.
- **Existing data (you didn't pick):** I will auto-wrap each legacy `bursary_applications` row as a `parent_application` with exactly 1 student beneficiary, preserving tracking numbers, statuses, history, and dashboards. Tell me if you'd rather leave legacy untouched.

---

## 1. Database migration

New tables:

```text
parent_applications
  id, tracking_number (unique), advert_id (FK, NOT NULL),
  parent_national_id, parent_full_name, parent_phone, parent_email,
  parent_county, parent_ward, sms_consent,
  household_income, household_dependents, poverty_score, poverty_tier,
  total_students, status (overall), current_stage,
  locked_for_resubmission bool, submission_cycle (= advert_id),
  document_urls jsonb, fairness fields, ai_decision_reason,
  created_at, updated_at, reviewed_at, reviewed_by

student_beneficiaries
  id, parent_application_id FK ON DELETE CASCADE,
  student_full_name, student_id_or_birthcert, student_type,
  institution_name, admission_number, course_level/class_form,
  year_of_study, fee_balance,
  status (per-student), allocated_amount, allocation_date,
  released_to_treasury, ai_decision_reason,
  created_at, updated_at
```

Constraints & integrity:
- `UNIQUE (advert_id, parent_national_id)` → blocks duplicate per cycle.
- `UNIQUE (advert_id, student_id_or_birthcert)` → blocks reusing a student across parents in same cycle.
- Trigger: max 3 children per parent (raises on 4th insert).
- Trigger: same student_id can't appear twice in one parent application.
- Existing ward/advert validation triggers re-pointed to new tables.
- `log_status_change` trigger on `student_beneficiaries`.
- `emit_dashboard_event` re-pointed (still PII-safe, only ids/status).
- `generate_tracking_number` reused.

RLS: mirror current `bursary_applications` policies (deny anon, admin/commissioner read, treasury county-scoped, public anon INSERT with required fields). Add same to `student_beneficiaries` (joined via parent).

Migration of legacy rows: insert one parent_application per existing `bursary_applications`, one matching student_beneficiary; preserve all PKs/tracking_numbers; keep old table intact (read-only) for 1 release as safety.

Updated RPCs:
- `get_commissioner_applications()` → returns parent rows + json_agg of students.
- `get_treasury_applications()` → returns one row per **student** (released + approved), county-scoped.
- New `track_parent_application(tracking, verifier)` returns parent + students.
- New `workflow_backlog_snapshot()` recalculated against students.

## 2. Application form (UI)

- `ParentGuardianForm` unchanged (collects parent + advert).
- New `StudentsRepeater` component:
  - Renders 1 student card by default.
  - "+ Add another student" enabled while count < 3; disabled at 3 with helper text "Maximum of 3 students allowed per application."
  - "Remove" button per student (min 1).
  - Each card: name, ID/birthcert, institution, admission no, class/year, fee balance, type.
  - In-form duplicate detection across cards.
- `ApplySecondary` and `ApplyUniversity` swap their single-student step for the repeater.
- `ReviewSubmit` lists all students; submit calls new edge function `submit-parent-application` which performs the transactional insert + lock check.

## 3. Edge functions

- **New `submit-parent-application`**: validates (Zod), pre-checks `UNIQUE(advert_id, parent_national_id)`, inserts parent + students in one transaction (RPC `submit_parent_application_tx`), returns tracking number. Returns 409 with friendly message on duplicate.
- **`track-application`**: extended to look up parent + students; phone variants logic preserved.
- **`process-allocations` / `allocate-bursary` / `fairness-engine`**: switched to operate per `student_beneficiaries` row; quota counts students, not parents.
- **`send-sms-notifications`**: one SMS per parent summarizing per-student outcomes.
- **`lifecycle-audit`**: new checks (orphan students, parents without students, duplicate-lock violations, max-3 enforcement).

## 4. Dashboards

- **Commissioner**: parent rows with expand-to-show students; per-student approve/reject; "Release to treasury" still per parent (cascades to all approved children) with new option to release individual students.
- **Admin**: aggregate counts switch to students; parent count shown alongside.
- **Treasury**: list per student (since amounts are per student); county scoped.
- **AdminOps**: backlog snapshot includes new metrics.
- Realtime channels unchanged (still PII-safe payloads from new trigger).

## 5. Tracking page

- Lookup by tracking_number / parent national ID / phone.
- Shows parent header (status, stage, BKE-XXXXXX) + accordion of children with each student's status, institution (masked where applicable), allocated amount.

## 6. Anti-fraud / locking

- DB-level uniqueness is the source of truth; UI shows pre-flight error from edge function.
- `locked_for_resubmission` set true on insert; cleared automatically when advert deadline passes (no action needed — different advert = different cycle).
- Cross-application student reuse blocked by uniqueness + audit log entry.

## 7. Tests

- DB: insert 1/2/3 students passes; 4 fails; duplicate parent_national_id+advert fails; duplicate student across parents fails.
- E2E (vitest + supabase mocks): submission flow returns tracking; tracking returns parent + N students; commissioner RPC returns aggregated; treasury RPC returns one row per student.
- Update `lifecycle-audit` regression suite.

## 8. Rollout order
1. Migration (new tables, triggers, RLS, RPCs, legacy backfill).
2. Edge function `submit-parent-application` + update `track-application`.
3. Frontend repeater + form wiring + tracking UI.
4. Dashboards (commissioner → admin → treasury).
5. Allocation/fairness/SMS edge functions.
6. Tests + lifecycle audit additions.

---

**Scope warning:** this is a large refactor (~15+ files, 1 big migration, 3 edge functions changed/added, 3 dashboards updated). Approving this plan kicks off all of it in one go. Reply **"go"** to proceed, or tell me what to trim (e.g., "skip per-student treasury split for now").
