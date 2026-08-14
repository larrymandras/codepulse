---
phase: 114-workspace-map-view
plan: 114-11
type: operator-checkpoint
status: complete
operator: Larry
performed: 2026-08-14
surface: http://localhost:5173/workspace-map (live self-hosted backend, not a fixture)
---

# Phase 114 — Operator Checkpoint

Attended live verification of `/workspace-map`, run by Larry against the live self-hosted
backend on 2026-08-14. All five steps of `114-11-PLAN.md` § how-to-verify were performed.

**Disclosure note (T-114-20).** This document records counts, verbatim chip text, verbatim
DevTools text and verdicts only. It contains no real root name and no real directory name.
Every node label reproduced below is either a department name (part of the fixed classifier
vocabulary already present in source) or an already-masked `{department} root {N}` label.
The diff was read before committing.

---

## 1. Live-data smoke (D-01, D-02, D-03, D-09)

**Result: PASS.**

- The map paints: centre hub + department hubs + root ring, department-colored fills,
  deterministic radial layout, physics off.
- **Expand:** clicking a root hub revealed its children **immediately, with no visible
  network wait** — consistent with D-02's single subscription and client-side expansion over
  the already-fetched payload.
- **Collapse:** clicking the same hub a second time collapsed it and its descendants
  disappeared with it.
- **One level per click (D-03):** no click revealed more than one level of depth.
- **Side panel, department hub:** shows the department aggregate —
  `DIRECTORIES 2348` / `FILES, TOTAL INCL. SUBDIRECTORIES 219390`.
- **Side panel, deep directory (the D-09 check):** the two counts are present and **differ**
  on a non-leaf node, which is the property the step exists to test:

  | Field | Value |
  |---|---|
  | `DIRECT` | 9 files · 148 KB |
  | `TOTAL INCL. SUBDIRECTORIES` | 294 files · 31.4 MB |
  | `LATEST ACTIVITY` | 44d ago |
  | `WITHHELD` | 10 files withheld |

  It also renders `49 more subdirectories not shown — click the node to expand.`

- **Withheld notice (T-114-08, T-114-16): PASS — the full sentence appears, not a bare
  number.** Verbatim:

  > Classified sensitive by the local scanner config — never left this machine. Only the
  > count is recorded, never the name.

### Coverage strip — all four chips, verbatim

| # | Chip text | Styling |
|---|---|---|
| 1 | `Scanned 7h ago` (`Scanned 8h ago` on a later capture, an hour having passed) | plain — not warn |
| 2 | `53/53 roots covered` | plain |
| 3 | `4300 files withheld` | plain |
| 4 | `23 roots unclassified` | plain — chip 4 never escalates, per D-14 |

---

## 2. Staleness (D-17)

**Result: PASS — not stale, and this is a positive finding for another phase.**

The scan-time chip read `Scanned 7h ago` with **no "— overdue" suffix and no warn styling**.
The capture is timestamped 11:23 local, placing the scan at roughly 04:23 against a task
registered daily at 04:15.

**This is supporting evidence that Phase 115's D-05 unattended firing worked** — that item
was still open at Phase 114 planning time, and a staleness indicator is precisely what
surfaces a scheduler that silently stopped. Recorded as **supporting evidence, not a verdict**:
this checkpoint observed the strip, it did not inspect the Task Scheduler run history, and a
manually triggered scan would look identical here. D-05 belongs to Phase 115 and its closure
is that phase's to claim.

---

## 3. Theme legibility (Claude's Discretion / UI-SPEC open items)

**Result: PASS — operator verdict "themes are fine."**

- The four department fills plus the muted Unclassified remained distinguishable, and the
  `astridr-reachable` halo remained visible, across the themes reviewed.
- `readable` — the accessibility-mandated theme whose three new department hex values had
  **never been run through a contrast checker** — was accepted by the operator.
- **Light `:root` department hues: KEEP.** The three low-chroma department hues added to the
  light theme are a deliberate, reversible departure from the monochrome Paperclip palette.
  The operator elected to keep them. The one-line revert (drop the three `:root` values)
  was **not** taken and is not outstanding work.

---

## 4. D-18 — Chrome DevTools Issues tab (observe and record only)

**Result: RECORDED. Nothing was fixed here, per the step's own instruction.**

A control was run rather than reading the normal window alone, because the operator's normal
profile carries a large number of extensions:

| Measurement | Normal window | Incognito (extensions off) |
|---|---|---|
| Console errors | 3 | **No errors** |
| Issues | 3 | **1** |

The three console errors were all the same entry:

> `Uncaught (in promise) Error: A listener indicated an asynchronous response by returning
> true, but the message channel closed before a response was received`

**They are extension-emitted, established by measurement rather than by reading the message.**
Two independent pieces of evidence: (a) the incognito control above reports `No errors` for
the same page; (b) this project's source contains **zero** references to `chrome.runtime`,
`browser.runtime`, `runtime.sendMessage` or `.onMessage`, from a grep whose control
(`ConvexProvider` in `src/main.tsx`, same pattern and file set) returns 3 hits — so the probe
discriminates and the zero is real. The app never calls the extension messaging API that
raises this error. Two of the three Issues were likewise extension-side and disappeared in
the control; note that `Include third-party cookie issues` was ticked in the normal window
and unticked in the control.

### The one genuine Issue, verbatim

> **Chrome may soon delete state for intermediate websites in a recent navigation chain**
>
> In a recent navigation chain, one or more websites without prior user interaction were
> visited. If these websites don't get such an interaction soon, Chrome will delete their
> state.
>
> **AFFECTED RESOURCES**
> 1 potentially tracking website
> `accounts.dev`
>
> *Learn more: Bounce tracking mitigations*

And one console warning, also verbatim:

> `Clerk: Clerk has been loaded with development keys. Development instances have strict
> usage limits and should not be used when deploying your application to production.`
> — `clerk.browser.js:19`

### Disposition

Both entries name **Clerk**, not the workspace map: `accounts.dev` is Clerk's dev-instance
domain. Neither is a Phase 114 defect, and neither was fixed here — D-18's rule is that any
follow-up is filed against the phase owning the offending code, which is what keeps an
open-ended browser investigation out of this phase. Filed as
`.planning/todos/pending/114-clerk-bounce-tracking-and-dev-keys.md`.

**This also closes the Phase 111 todo** `111-devtools-issues-panel-entry-unexamined.md`,
whose entire content was that a `1 Issue` badge had been seen and never opened. It has now
been opened. That todo explicitly refused to guess the entry was Clerk-related — the guess
turns out to be correct, but it is now *earned* rather than assumed, which is the distinction
it was written to preserve.

---

## 5. Privacy screenshot safety (D-15)

**Result: PASS.**

With masking on:

- Root labels render as `{department} root {N}` — observed live as `Personal root 1`,
  `Personal root 6`, `Personal root 8`, `Personal root 9`, `Personal root 11`,
  `Personal root 13`, `Personal root 14`, `Personal root 15`, `Personal root 16`,
  `Personal root 17`, `Personal root 18`, `Personal root 19`.
- Directory labels render as the redacted placeholder.
- Node positions, sizes and colors are visibly unchanged from the unmasked render — masking
  changes labels only, not geometry or classification.
- The department and access badges (`Personal`, `Local only`) remain visible, as designed:
  they are classification, not identity.

Screenshots were captured **only** with masking on, per the step's ordering requirement.

This matches, on the live surface, what was mutation-proved in the test suite: weakening the
gate at `WorkspaceMapPanel.tsx:126` or `WorkspaceMapCanvas.tsx:140` from `enabled && maskPaths`
to `enabled` alone turns exactly the `maskPaths:false` discriminator test RED.

---

## Observations carried forward (not defects, not blockers)

1. **23 of 53 roots unclassified (43%).** Chip 4 deliberately never escalates to warn (D-14,
   tested), so this surface will not nag about it. It is data, not a defect — but it is a
   large share of the tree, and worth a look if the D-16 re-map was expected to have covered
   more. Belongs to the scanner's classifier vocabulary (Phase 115), not to this view.
2. **Intermittent full-suite flakiness under parallel test runs**, observed by the
   orchestrator during execution: two of five early full runs each failed one test, a
   different one each time (`src/App.test.tsx` lazy route, Phase 106; and
   `hooks/__tests__/workspaceScan.test.mjs` real-`mkdtempSync` walk, Phase 115). Neither
   imports any Phase 114 file; both pass in isolation; the suite is green serially and on
   every subsequent parallel run; a load-matched control was green. **Not a Phase 114
   regression — but "pre-existing" is NOT proven**, because the first control also removed
   four test files and so confounded composition with load. Belongs to the Phase 106/115 test
   files.

## Verdict

**Checkpoint PASSED.** All five steps performed against live data. No Phase 114 defect was
found at the checkpoint. The one genuine DevTools Issue and the one console warning are both
Clerk-side and are filed against the Clerk integration rather than fixed here.
