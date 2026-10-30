## Problem

For day-first tenants, booking-v3 prints MM/DD/YYYY but reads form input in the tenant's day-first order. A person following the displayed instruction can get the wrong calendar date. This is separate from the shared parser bug: app/email reports for those same tenants remain in the parser group.

## Scope and counting

**Reports covered: 33.** These are unique report IDs merged into #4471, not export rows or intake-tag counts.

Affected tenants: alder.physio, copper.studio, pale.harbour.
Reported: 2026-04-17 through 2026-09-22.
Intake tags inside this group: parser: 15; hint: 18.

The export has 427 rows with 15 repeated rows; 412 distinct reports remain. Deduplicate by ID, filter mergedInto=4471, then classify using tenant locale, form version, and report channel via the supplied causes.ts. Browser locale and intake tags are not the cause rule.

## Evidence examples

- R-41230 — copper.studio, form: My client came on 1 June instead of 6 January. We sorted it out.
- R-41241 — alder.physio, form: We had two people show up on 8 June. They were booked for 6 August.
- R-41251 — pale.harbour, form: Wednesday 7 January showed as Wednesday 1 July. I moved it myself.

## Evidence limits

This diagnosis follows the supplied knowledge-base logic and report data. The production application is not included, so these are proposed reproduction and acceptance checks, not a claim of a live reproduction or a shipped fix.

No report in this group is in the desk's oneDayMove annotation list.

## Proposed acceptance checks

- [ ] Make the displayed date format agree with form parsing for each affected tenant.
- [ ] Enter an ambiguous date exactly as the hint instructs and verify that the stored and displayed calendar dates match the intended date.
- [ ] Include day greater than 12 and locale-specific formatting in the checks.
- [ ] Verify the separate app/email parser path; do not treat this hint fix as a fix for that path.

## Knowledge-base review and reproducibility

- Source: src/routes/kb/incidents/4471-review/+page.svx
- Rendered page: rendered/kb/incidents/4471-review/index.html
- Exact report membership and input hashes: evidence/audit.json
- Recompute: npm ci, then npm run build. Review changed data and counts before updating issues.

## Covered report IDs

R-41230, R-41241, R-41251, R-41259, R-41262, R-41275, R-41294, R-41305, R-41308, R-41366, R-41372, R-41384, R-41387, R-41396, R-41400, R-41406, R-41415, R-41416, R-41418, R-41428, R-41439, R-41441, R-41449, R-41453, R-41456, R-41460, R-41472, R-41485, R-41493, R-41539, R-41572, R-41582, R-41584

## Completion of this course review

The S01E03 classification and knowledge-base deliverable is complete: the report-ID audit, signed .svx, actual rendered HTML, and browser checks are published in this repository. The knowledge-base export downloaded again after step one is byte-for-byte identical in every archive member to the supplied export. No new issue comments or additional task instructions were present when checked.

Closing this exercise ticket records completion of that analysis and documentation handoff, as requested by the course after accepting the tickets. It does **not** claim that production code was changed, that the production defect was fixed, or that the proposed remediation checks above were executed. The five annotated reports remain visible and counted once.
