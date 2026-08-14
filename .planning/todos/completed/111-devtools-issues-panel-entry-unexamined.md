---
created: 2026-08-11
source: 111-03-PLAN.md Task 3 (operator checkpoint, step 5)
phase_origin: 111
priority: low
type: unexamined-observation
status: closed
closed: 2026-08-14
closed_by: 114-11 operator checkpoint (D-18)
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


---

## CLOSED 2026-08-14 — by the Phase 114 operator checkpoint (114-11, D-18)

The Issues panel was opened. All four "How to close it" steps were performed on
`localhost:5173/workspace-map`, and the entry is recorded verbatim in
`.planning/phases/114-workspace-map-view/114-OPERATOR-CHECKPOINT.md` § 4:

> **Chrome may soon delete state for intermediate websites in a recent navigation chain**
> ... AFFECTED RESOURCES: 1 potentially tracking website — `accounts.dev`
> *Learn more: Bounce tracking mitigations*

**The answer is Clerk-related — but it is now earned rather than assumed, which is the exact
distinction this file was written to preserve.** `accounts.dev` is Clerk's dev-instance
domain. This file deliberately refused to label the unread badge "Clerk-related" on sight;
that refusal was correct discipline even though the guess turned out right, because the
alternative was a conclusion nobody had checked.

One thing this file could not have known, and which changes the count: the Phase 114 run
measured the page in a **control** — an incognito window with extensions disabled — and found
`3 Issues` in the normal profile collapse to `1`, with 3 console errors collapsing to
`No errors`. So the badge count seen at Phase 111 was partly extension noise. A single
"N Issues" badge is not one finding; it is a mixture, and only the extensions-off control
separates them.

**Disposition:** not a defect in Phase 111's or Phase 114's code. Filed against the owning
integration as `.planning/todos/pending/114-clerk-bounce-tracking-and-dev-keys.md`, which also
records what was deliberately NOT investigated (whether the notice has any practical effect on
auth, and whether it survives a move off `accounts.dev`).
