## Restore Centralized AI-Driven Bursary Workflow

Realign the platform to the original governance model: AI scores and allocates, commissioners only oversee + release, treasury only disburses. Strip all manual allocation UI, lock household integrity, and wire one synchronized workflow engine end-to-end.

---

### 1. Strip manual commissioner allocation UI
- Rewrite `src/components/dashboard/StudentBeneficiariesPanel.tsx` → rename to `AiAllocationReviewPanel.tsx`:
  - Remove: amount input, Approve/Reject per student, manual scoring.
  - Replace with: read-only AI allocation table (masked name, institution, AI score, AI-recommended amount, AI rationale), batch "Release to Treasury" button per parent application.
- Update `CommissionerDashboard.tsx` to surface two governance actions only:
  1. **Run AI Process Applications** (calls `process-allocations` edge function — only enabled after deadline closes).
  2. **Download AI PDF Summary** (calls `admin-summary`).
  3. **Release Batch to Treasury** (flips `released_to_treasury` for the AI-approved set).
- Remove any per-student approve/reject from `CommissionerAppTable.tsx`.

### 2. Database — enforce household + AI authority
Migration:
- Add `parent_applications.workflow_stage` enum-style text constraint: `submitted | ai_scored | ai_allocated | commissioner_review | released | disbursed`.
- Add `parent_applications.ai_processed_at`, `ai_allocation_batch_id`.
- Add `student_beneficiaries.allocation_reasoning text`, `ai_score int`.
- Tighten RLS so commissioners can ONLY update `released_to_treasury` + `workflow_stage` (not `allocated_amount`, not `status`→approved/rejected directly). AI/admin (service role via edge function) writes allocations.
- Trigger: when parent gets poverty_score, propagate to all linked students (shared household score).
- Trigger: lock parent_national_id per advert_id (already partially exists in `submit_parent_application` — verify + harden).
- Add `ai_allocation_runs` table (cycle audit: advert_id, run_at, run_by, total_budget, allocated_count, summary jsonb).

### 3. AI Allocation Engine (edge function)
Rewrite `supabase/functions/process-allocations/index.ts`:
- Input: `advert_id`.
- Guard: deadline must be passed; only commissioner/admin role.
- Pull all parent_applications + students for advert.
- For each parent: compute weighted poverty score from the 15 mandatory factors (income, employment, dependents, disability, orphan, fees, institution tier, ward profile, history, single-parent, etc.) via Lovable AI Gateway with structured tool-calling for explainability.
- Allocate: rank by score → distribute `bursary_adverts.budget_amount` respecting `max_slots`, ward fairness, per-student cap.
- Write back: set student `allocated_amount`, `ai_score`, `allocation_reasoning`, `status='approved'`; set parent `workflow_stage='ai_allocated'`, `ai_decision_reason`.
- Insert `ai_allocation_runs` row.
- Return summary JSON.

### 4. Masked tracking + display
- Centralize masking in `src/lib/maskData.ts` (verify exists, extend with `maskHouseholdRecord`).
- Update Track page: lookup by tracking number / parent ID / phone, show masked student name, workflow_stage, allocation status, treasury status, history.
- All commissioner views use masked RPCs (already in place via `get_parent_applications_for_commissioner`) — verify no raw names leak.

### 5. AI PDF Summary
- Extend `admin-summary` edge function to accept `scope='advert'` with full payload: ward overview, applicant counts, poverty distribution, vulnerability tiers, allocation logic, top priority cases (masked), budget utilization, rejected/incomplete, audit log refs.
- `aiSummaryPdf.ts` already renders — extend payload schema.

### 6. Real-time sync
- Verify `emit_parent_dashboard_event` + `emit_dashboard_event` triggers fire on `workflow_stage` changes.
- Commissioner + Treasury + Admin dashboards subscribe to their topics and refetch on event.

### 7. Validation tests
New `src/test/workflowIntegrity.test.ts`:
- 1/2/3-student household submissions.
- Shared poverty score across siblings.
- Duplicate parent_national_id per advert blocked.
- Duplicate student_identifier per advert blocked.
- Commissioner cannot write `allocated_amount` (RLS deny test).
- AI allocation produces deterministic ranking given fixed inputs.
- Tracking lookup returns masked names only.

### 8. Reports
After implementation, output a single consolidated markdown report at `/mnt/documents/bursary-ke-workflow-restoration-report.md` covering all 12 required sections.

---

### Technical notes
- `process-allocations` already exists — will be rewritten, not created.
- `verify_jwt = false` stays in config.toml; auth enforced in code via JWT validation + role check.
- All RLS changes use `has_role()` (no recursion risk).
- Mulberry32 PRNG in NEMIS lookup is untouched (out of scope).
- No NEMIS / parent form changes — those were just stabilized and the user confirmed working.

### Out of scope (explicit)
- NEMIS lookup format (already correct).
- Translation/i18n changes.
- Visual theme changes.
- Data migration of historical applications (DB was wiped earlier per user request).
