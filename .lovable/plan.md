# Bursary KE v2.0 — Phase 1 Plan

Convert application from student-centric to household-centric, additively. Nothing that currently works is removed or renamed. All changes are extensions on top of existing tables/flows.

## Current state (verified from codebase)

- `parent_applications` already models a household: `household_tracking_id`, `total_students`, links to `student_beneficiaries` (max 3). `submit_parent_application` RPC already accepts 1–3 students in one submission.
- `bursary_applications` (legacy student-centric) is kept in sync via `submit_parent_application` and `propagate_legacy_to_students` trigger. Tracking numbers already resolve to households.
- Step 2 "Education Level Selection" already exists (`EducationLevelSelect.tsx`) and gates Secondary vs Higher Ed steps.
- Assessment engine (`src/lib/assessment/engine.ts`) already renders household questions once and per-student questions with `{studentName}` / `{institution}` interpolation, filtered by education category.
- Draft autosave to `sessionStorage` already implemented in `ApplicationContext`.
- Disability fields (`ncpwd_registration_number`, `disability_type`, `disability_card_url`) already exist on `student_beneficiaries` and are collected per-student.
- Duplicate prevention: `enforce_unique_student_per_advert` trigger + `enforce_max_three_students` already in DB.

Most of Phase 1 is already implemented. Remaining gaps below.

## Gaps to close in Phase 1

### 1. Wizard flow — "Both" cohort ordering
Today `StudentsRepeater` renders one repeater for the chosen type. For "Both", user must complete **Secondary section first (save)** → **Higher Education section (save)** → continue. Implement a two-phase repeater: Phase A collects secondary students; Phase B collects higher-ed students; each with its own "Save & Continue". Single-cohort selections keep current single-phase behavior.

### 2. Per-student disability capture in-form (not on reviewer dashboards)
Verify `StudentsRepeater` shows NCPWD number / card upload **inline** the moment a student's disability is declared. If it currently only appears in a later assessment step, move the trigger to the student card. Keep DB fields as-is.

### 3. Duplicate NEMIS / Admission Number — client-side pre-check with clear messaging
DB trigger already blocks duplicates across the advert cycle, but the client shows a generic RPC error. Add:
- Intra-submission duplicate check (already covered by test) with human message.
- Optional pre-flight `supabase.rpc` check or graceful mapping of `enforce_unique_student_per_advert` error to a friendly toast naming the offending student.

### 4. Intelligent cross-field validation (soft prompts, not hard blocks)
Add a lightweight consistency checker on Review step that surfaces *warnings* (not blockers) for:
- Orphan status vs "parent alive" answers
- Employment "unemployed" but income > 0
- Boarding fee_balance = 0 for a boarding school
- Disability declared but no NCPWD number / card
- HELB "received" but higher-ed not selected

Rendered as an amber "Please review these responses" panel above the submit button. User can edit or acknowledge and proceed.

### 5. State preservation on tab switch / refocus
`sessionStorage` autosave exists. Add:
- `visibilitychange` listener → flush current step + form values.
- Restore `currentStep` (not just `data`) from session on mount.

### 6. Migration — no schema changes needed
Existing rows already have `household_tracking_id` assigned by trigger. Add a one-time backfill migration only if any legacy `parent_applications` rows lack it. Verify with a read query first; only ship migration if backfill is required.

### 7. Regression tests
Add Vitest cases for:
- Both-cohort ordering (Secondary students length > 0 before Higher-Ed phase unlocks)
- Cross-field warning detector returns expected warnings for known contradictions
- Restoring `currentStep` from sessionStorage

## Out of scope for Phase 1
- Reviewer/commissioner UI changes beyond removing standalone DVL section (already inline per memory)
- New DB tables
- AI allocation changes
- Notification changes

## Technical details

Files to touch:
- `src/components/application/StudentsRepeater.tsx` — two-phase mode when `educationLevels.secondary && educationLevels.higherEd`.
- `src/components/application/ReviewSubmit.tsx` — add consistency warnings panel.
- `src/context/ApplicationContext.tsx` — persist/restore `currentStep`; `visibilitychange` flush.
- `src/lib/validation/consistency.ts` (new) — pure function returning warnings from `ApplicationData`.
- `src/test/householdFlow.test.ts` (new) — regression coverage.
- Error mapping for RPC duplicate errors in `applicationService.ts`.

No DB migration expected. Will confirm via `supabase--read_query` before starting: `select count(*) from parent_applications where household_tracking_id is null`. Backfill migration added only if count > 0.

## Acceptance
- Secondary-only: unchanged flow.
- Higher-Ed-only: unchanged flow.
- Both: Secondary form(s) → save → Higher-Ed form(s) → save → household assessment → per-student assessments → review with soft warnings → submit.
- Refresh mid-wizard restores step + data.
- Duplicate NEMIS/Admission → friendly named error.
- Existing tracking numbers, dashboards, reports, APIs, auth: untouched.

Please approve and I'll implement in this order: (1) confirm no backfill needed, (2) two-phase repeater, (3) consistency warnings, (4) step persistence, (5) error mapping, (6) tests.
