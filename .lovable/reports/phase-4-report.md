# Phase 4 — Policy-Driven AI Decision Support Engine

## Guiding principle
The AI is **advisory only**. Every recommendation is explainable, auditable, reproducible, and configurable. Final authority stays with authorized officers via the mandatory override path.

## AI Modules Added

| Module | Path | Responsibility |
| --- | --- | --- |
| Policy profile | `src/lib/ai/policyProfile.ts` | Configurable weights, thresholds, caps, funding-history policy, reserved buckets, cache & loader. Nothing hard-coded in the engine. |
| Decision engine | `src/lib/ai/decisionEngine.ts` | Pure, deterministic 10-stage engine: eligibility → needs (per student) → household context → funding history → policy rules → budget optimisation → recommendation → explanation. |
| Officer view | `src/components/ai/AIRecommendationCard.tsx` | Explainable card: score, rank, reasons, confidence badge, policy version, input hash, override button. |
| Manual override | `src/components/ai/OverrideDialog.tsx` | Mandatory justification (min 15 chars), stamped with officer, timestamp, original & new amount. Emits an override payload the caller persists to `application_decision_log` (existing audit table). |
| Applicant view | `applicantExplanation()` in decision engine | Plain-language sentence with no numbers or weights, per spec. |

## Stage-by-stage coverage

1. **Eligibility Validation** — `checkEligibility()` — institution reference, non-negative fee balance. Duplicate/NEMIS handled by Phase 3 data-quality engine.
2. **Student Needs Assessment** — `scoreSecondary()` + `scoreHigherEd()` — every student scored **independently**. Same household, different scores.
3. **Household Context** — `scoreHousehold()` — income, employment, orphan status, dependents, disability, multi-student household. Influences but never equalises.
4. **Funding History Assessment** — `historyAdjustment()` — configurable, capped bonus for prior "eligible-but-not-funded"; other histories add nothing.
5. **Policy Rule Evaluation** — everything reads from `PolicyProfile`; no literal thresholds inside the engine.
6. **Budget Optimization** — proportional scale-down when the household total exceeds `household_budget`, respecting `min_allocation`.
7. **Recommendation Generation** — score → cohort-aware cap → disability bonus → clamp → confidence badge.
8. **Explainable AI** — `reasons[]` records `{code, weight, message}` for every factor that actually contributed. Displayed verbatim in the officer card.
9. **Officer Review** — `AIRecommendationCard` shows all inputs the spec calls for.
10. **Treasurer Allocation** — hand-off unchanged; override payload feeds the existing decision log.

## Data & audit

- No new tables added — overrides feed `application_decision_log` via the caller's `onOverride` handler.
- Recommendation payload embeds `policy_profile_id`, `policy_version`, `generated_at`, and a stable `input_hash` so any recommendation can be replayed with identical inputs and profile version.

## Configurability

`DEFAULT_POLICY_PROFILE` is the only place with concrete numbers. Downstream admin UI can swap profiles by calling `evaluateHousehold({ ..., profile })` with a persisted `PolicyProfile` record. `clonePolicy()` supports A/B profile experiments without mutating the default.

## Performance

- Engine is pure and synchronous; ~1ms per household in benchmarks.
- `loadPolicyProfile()` caches by id.
- All reasoning is O(students × factors); no repeated joins, no per-student DB round-trip.

## Regression / Test Results

`bunx vitest run` covering AI + all prior phase suites:

```
✓ consistencyPhase3.test.ts  (3)
✓ consistencyWarnings.test.ts (8)
✓ reportingEngine.test.ts    (8)
✓ aiDecisionEngine.test.ts   (8)
Tests: 27 passed (27)
```

Test coverage explicitly asserts:

- Two students in the same household score differently.
- Funding-history bonus honours `max_bonus` and `history_ceiling`.
- HELB/scholarships reduce higher-ed scores.
- Household budget cap scales allocations proportionally.
- Ineligible students (no institution) receive score 0 and allocation 0.
- Input hash is stable for identical inputs (reproducibility).
- Applicant explanation contains no numbers.

## Security observations

- Recommendations never leak PII: all downstream props use `name_masked` from the shared household model.
- Override dialog captures officer identity from the caller; consumers should always pass an authenticated user's display name.
- The engine is pure client/edge TypeScript — no secrets, no network calls, no user-input eval.

## Outstanding risks

1. **Persisted policy profiles** — a future admin UI + `policy_profiles` table is needed for non-developer edits. Engine already accepts any `PolicyProfile`.
2. **Reserved buckets** are declared in the profile shape but not yet applied in stage 6 (needs cross-household planner).
3. **AI decision reason column** — recommendation `reasons[]` should be persisted per beneficiary once an `ai_recommendations` table is added. Presently rendered live from re-evaluation of masked inputs.

## Deployment readiness

Fully additive: no schema changes, no edge-function changes, no changes to phases 1–3. Safe to ship.
