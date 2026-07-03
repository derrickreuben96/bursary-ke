# Bursary KE — Strict Modular System Upgrade (IPN-Style Additive)

This is an **additive upgrade** to the existing production platform. No rebuild, no destructive migrations, no regression of legacy auth, RLS, or dashboards. Every new column is nullable with safe defaults; every new table is separate; every new edge function is a sibling to existing ones. Legacy records continue to work exactly as today.

---

## 1. Database migration (single migration, all nullable/additive)

**New enums**
- `education_category`: `high_school | university | college | tvet`
- `assessment_pipeline`: `basic_education | higher_education`

**`bursary_adverts` — add nullable quota columns**
- `total_slots int`, `high_school_quota_slots int`, `higher_education_quota_slots int`
- `high_school_budget_cap numeric`, `higher_education_budget_cap numeric`
- `min_award_per_student numeric`, `max_award_per_student numeric`
- Trigger `validate_advert_quotas`: if any quota field set, enforce sums == totals, non-negative, cap <= budget. Legacy adverts with all NULL quotas keep current behavior.

**`student_beneficiaries` — add**
- `education_category education_category`
- `assessment_pipeline assessment_pipeline` (auto-derived by trigger from category)
- `ncpwd_registration_number text`, `disability_type text`, `disability_card_url text`
- `disability_verified boolean default false`
- `fraud_score int default 0`, `fraud_flags jsonb default '[]'`
- `rank_in_pipeline int`, `decision_reason_code text`
- `poverty_index_score int` (per-student final score after per-student weighting)

**`parent_applications` — add**
- `household_tracking_id text unique` (format `BK-HH-YYYY-NNNNN`)
- `household_disability_burden boolean default false`
- Backfill `household_tracking_id` for existing rows using existing `tracking_number` as fallback.

**New table: `household_child_codes`**
Maps `student_beneficiary_id` → child code `BK-HH-YYYY-NNNNN-01/02/03`. Populated by trigger on insert.

**New table: `sms_logs`**
- `id, recipient, message, status, event_type, tracking_id, applicant_name_masked, sent_at, error`
- RLS: admin/service role only.

**New table: `poverty_question_bank`**
- `id, code, pipeline, category (static|dynamic), weight_high_school, weight_higher_ed, text_en, text_sw, options jsonb`
- Seed static + dynamic pools per spec.

**New table: `application_decision_log`** (immutable, insert-only)
- `id, student_id, decision, poverty_score, fraud_score, disability_score, rank, quota_category, reason_code, decided_by, decided_at, snapshot jsonb`

All new tables get `GRANT`s (service_role + authenticated read where needed) and RLS policies via `has_role()`.

---

## 2. Advanced Poverty Scoring Engine (APSE)

**Client**: extend `src/lib/povertyQuestions.ts`
- Split into `STATIC_CORE_QUESTIONS`, `DYNAMIC_POOL_HIGH_SCHOOL`, `DYNAMIC_POOL_HIGHER_ED`
- Deterministic randomizer seeded from `parent_national_id + advert_id` picks 5–8 dynamic questions, no repeats
- Route by chosen `education_category`

**Server**: extend `compute_poverty_score(_answers jsonb, _pipeline text)` DB function
- Static core weights (income, dependents, employment, orphan, sponsorship, household disability)
- Pipeline-specific weights (basic vs higher ed) per spec
- Bands: 0–30 low / 31–60 moderate / 61–80 high / 81–100 critical
- Legacy calls without `_pipeline` default to current behavior (backward compatible overload)

## 3. Disability Verification Layer

- `PovertyQuestionnaire.tsx`: conditional block when `has_disability=yes` → NCPWD number, type, card upload (reuses `applicant-documents` bucket)
- Zod schema: block submission if missing/invalid format `NCPWD/[A-Z]{2,3}/\d{4,6}`
- Duplicate NCPWD detection in `submit_parent_application` (raise on repeat within advert)
- Scoring bonuses: declared +10, verified +20, severe +10 (added inside `compute_poverty_score`)
- Separate "household supports PWD" question feeds `household_disability_burden`

## 4. Split application engine

- Application form step 2 gains **Education Level** selector per student (High School / University / College / TVET)
- Auto-derive pipeline; store on `student_beneficiaries`
- `process-allocations` edge function rewritten to allocate **per pipeline per advert**:
  1. Load advert quotas
  2. Rank basic_education students by poverty_index within `high_school_quota_slots` & budget cap
  3. Rank higher_education students by poverty_index within `higher_education_quota_slots` & budget cap
  4. Enforce min/max award; write `rank_in_pipeline`, `decision_reason_code` (`quota_exhausted | lower_rank | incomplete_docs | approved | existing_sponsorship`)
  5. Insert `application_decision_log` row per student (immutable audit)

## 5. Household tracking

- On parent submission generate `BK-HH-YYYY-NNNNN`; each student gets child code
- `/track` page extended: lookup by household ID returns parent + N students with per-child status, rank, reason
- Track function returns masked names + child codes; existing `BKE-XXXXXX` lookup still works

## 6. SMS lifecycle engine

- Extend `send-sms-notifications` edge function with event router: `submitted | under_review | verification_required | shortlisted | approved | rejected | disbursed`
- Templates with variables `{name} {tracking_id} {status} {reason} {award}` (EN/SW)
- Every send inserts into `sms_logs`
- Hooked into: submission RPC, allocation function, disbursement-auto, commissioner release

## 7. Fraud detection

- New edge function `fraud-detect` (invoked inside `process-allocations` pre-ranking)
- Checks: repeated national_id, repeated NCPWD, repeated admission_number, repeated fee invoice hash, household duplication
- Writes `fraud_score` + `fraud_flags`; score > 70 → `decision_reason_code='manual_review'`, excluded from auto-approval, surfaced in admin queue

## 8. Admin transparency panel

- Extend `CommissionerAppTable.tsx` + new `AdminDecisionPanel.tsx`
- Per applicant: poverty score, disability status, household burden, category, quota, rank, fraud score, reason code
- Admin approval actions write to `application_decision_log` (immutable)

## 9. Admin advert form

- Extend `AdminAdverts.tsx` with quota + budget cap + award min/max inputs
- Client-side + DB trigger validation
- Dashboard cards show per-category utilization, remaining slots, budget balance

## 10. Backward compatibility guarantees

- All new columns nullable, defaulted
- Legacy `bursary_applications` untouched
- Legacy adverts (no quotas) fall back to single-pool allocation
- Legacy tracking numbers still resolvable
- No changes to auth, RLS helper `has_role`, or existing dashboards' data contracts

## 11. Security

- New tables: RLS + `has_role`-gated policies
- `application_decision_log` insert-only (no UPDATE/DELETE policy)
- Document uploads reuse existing private `applicant-documents` bucket
- Rate limiting on new endpoints via existing `_shared/rateLimiter.ts`
- Input validation via Zod on all new form fields

## 12. Tests

New Vitest suites:
- `apse.test.ts` — deterministic randomization, pipeline weighting, band boundaries
- `quotaAllocation.test.ts` — per-pipeline caps, min/max award enforcement
- `householdTracking.test.ts` — child code generation, per-child independent outcomes
- `fraudDetection.test.ts` — duplicate ID/NCPWD/admission triggers
- `disabilityVerification.test.ts` — required fields, format, duplicate NCPWD block

---

## Execution order

1. Migration (all schema + seed poverty_question_bank)
2. DB functions (compute_poverty_score v2, household code generator, decision logger)
3. Edge functions (process-allocations rewrite, fraud-detect, sms lifecycle)
4. Frontend (application form category step, disability block, dynamic questions, admin quota form, decision panel, household track view)
5. Tests
6. Manual smoke: legacy tracking lookup + legacy advert allocation must still work

## Out of scope (explicit)

- NEMIS lookup logic (untouched)
- i18n framework changes (only add SW strings for new UI)
- Visual theme (semantic tokens preserved)
- Historical data migration beyond safe backfill of household_tracking_id

---

**Confirm and I execute in the order above (single migration first, then code).**