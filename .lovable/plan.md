# Implementation plan

## Scope
- Make returning guardian details explicitly consent-based, editable on mobile, versioned, and markable as outdated.
- Complete the operational hand-off from Commissioner approval to Treasury disbursement and processed payment records.
- Add county-level governance analysis and category-specific scoring for secondary, university, college, and TVET.
- Validate the complete phone-sized application journey through submission, approval, and Treasury visibility.

## Technical approach
- Reuse existing household, student, audit, payment, and governance architecture.
- Add database structure and secured functions only where current records cannot support the requested states.
- Preserve all legacy application and dashboard flows.
- Add focused automated tests, then run a browser-based end-to-end scenario.

## Safety
- Keep applicant information masked outside applicant-owned views.
- Maintain jurisdiction scoping and role checks.
- Preserve submitted-application immutability.
