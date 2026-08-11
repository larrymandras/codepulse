---
created: 2026-08-11
source: 111-03-PLAN.md Task 3 (operator checkpoint, step 5)
phase_origin: 111
priority: low
type: unexamined-observation
---

# Devtools "1 Issue" badge on both Phase 111 surfaces — never opened

Observed at the Phase 111 operator checkpoint (2026-08-11) on the running dev server at
`localhost:5173`. Both captured console screenshots — Live Run and Chat with command-center
mode ON — show a **`1 Issue` badge** in the devtools toolbar.

## What is actually known

- Both consoles report **`No errors`** explicitly in the sidebar counter.
- Both show **1 warning**, and in both cases that warning is the Clerk development-keys
  notice (`client:525`, "Clerk has been loaded with development keys").
- Neither console stream names `JobsPanel`, `Chat`, `SectionErrorBoundary`, or the string
  "Functions are not valid as a React child" — the last being the specific symptom
  `111-01-PLAN.md`'s threat model (T-111-02) predicted for the unguarded
  `stateIcon[job.status]` prototype-chain lookup.

## What is NOT known — and why this file exists

**The Issues panel was never opened.** Chrome's Issues panel is a separate surface from the
console stream: it aggregates breaking-change notices, deprecations, cookie/CORS/CSP
problems and other findings that do NOT necessarily print a console message. So the fact
that nothing appears in the console is **not** evidence about what that one issue is.

This file deliberately does **not** classify the entry as benign, pre-existing, or
Clerk-related. Each of those is a plausible guess; none was checked. Per this project's
error-triage rule, "pre-existing" is a conclusion that has to be earned by tracing the
finding to its source, not a label applied on sight to something unread.

## How to close it

1. Open devtools on `localhost:5173` (either the Live Run or the Chat page — the badge
   appeared on both, so either reproduces it).
2. Click the **Issues** tab (next to Console; the `1 Issue` badge is the entry point).
3. Read the entry, record its category and source verbatim.
4. Then decide: fix, file against the owning phase, or record as accepted with the reason.

Cheap to do — under a minute — and it converts an unknown into either a real finding or a
documented non-issue. It was left open only because Phase 111's checkpoint was scoped to the
console stream and closing it was not a blocker for that phase's goal.
