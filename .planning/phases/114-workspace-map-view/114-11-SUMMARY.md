---
plan: 114-11
phase: 114-workspace-map-view
completed: 2026-08-14
autonomous: false
tasks: 2
key_files:
  created:
    - .planning/phases/114-workspace-map-view/114-OPERATOR-CHECKPOINT.md
    - .planning/todos/pending/114-clerk-bounce-tracking-and-dev-keys.md
  modified:
    - .planning/todos/completed/111-devtools-issues-panel-entry-unexamined.md
decisions_completed:
  - D-18
decisions_evidenced:
  - D-01
  - D-02
  - D-03
  - D-09
  - D-14
  - D-15
  - D-17
---

# 114-11 — Operator Checkpoint

Attended checkpoint, run inline with Larry rather than by a subagent, because a
subagent cannot perform a human-verify gate. Both tasks complete.

## Task 1 — Operator checkpoint (blocking human-verify gate)

Larry performed all five steps against the LIVE self-hosted backend at
`localhost:5173/workspace-map`. **Checkpoint PASSED — no Phase 114 defect found.**

Full record, including every verbatim chip and DevTools string, is in
`114-OPERATOR-CHECKPOINT.md`. Condensed:

| Step | Verdict |
|---|---|
| 1 — live smoke (D-01/02/03/09) | PASS. Expand is immediate with no network wait; re-click collapses; one level per click; deep-directory panel shows DIRECT (9 files · 148 KB) vs TOTAL INCL. SUBDIRECTORIES (294 files · 31.4 MB), which differ; withheld notice renders the FULL sentence, not a bare number |
| 2 — staleness (D-17) | PASS. `Scanned 7h ago`, no "overdue", no warn styling |
| 3 — themes | PASS. Operator verdict "themes are fine"; light `:root` department hues KEPT, revert not taken |
| 4 — DevTools Issues (D-18) | RECORDED, nothing fixed. See below |
| 5 — privacy (D-15) | PASS. Root labels mask to `{department} root {N}`; geometry, sizes and colors unchanged; screenshots taken only with masking on |

Coverage strip chips, verbatim: `Scanned 7h ago` · `53/53 roots covered` ·
`4300 files withheld` · `23 roots unclassified`.

### The measurement that mattered here: an extensions-off control

The operator's normal Chrome profile carries many extensions, so the DevTools reading was
control-paired rather than taken at face value:

| | Normal window | Incognito (extensions off) |
|---|---|---|
| Console errors | 3 | **No errors** |
| Issues | 3 | **1** |

The three console errors were all
`A listener indicated an asynchronous response by returning true, but the message channel
closed before a response was received`. **Extension-emitted, established by measurement,
not by recognising the message**: the control reports `No errors` for the same page, and a
control-paired grep shows this repo contains zero references to `chrome.runtime`,
`browser.runtime`, `runtime.sendMessage` or `.onMessage` (control: `ConvexProvider` in
`src/main.tsx`, same pattern and file set, returns 3 hits — so the zero discriminates).

Without that control, the honest options were "3 unexplained errors on the new page" or an
unearned "probably an extension". The control converted it into a fact, and it also showed
that a single `N Issues` badge is a MIXTURE — 2 of the 3 were extension-side.

## Task 2 — Record the checkpoint and file the D-18 follow-up

Wrote `114-OPERATOR-CHECKPOINT.md`. The plan's automated acceptance check passes:

```
test -f ...114-OPERATOR-CHECKPOINT.md && grep -qi "issues" ... && grep -qiE "cyan|emerald|readable|aubergine" ...
-> OK: checkpoint recorded with Issues and theme sections
```

**D-18 follow-up filed against the owning code, not fixed here.** The one genuine Issue
(`Chrome may soon delete state for intermediate websites in a recent navigation chain`,
affected resource `accounts.dev`) and the one console warning (Clerk development keys,
`clerk.browser.js:19`) both name **Clerk**, not the workspace map — `accounts.dev` is Clerk's
dev-instance domain. Filed as
`.planning/todos/pending/114-clerk-bounce-tracking-and-dev-keys.md`, which records what was
deliberately NOT investigated (whether the notice has any practical effect on auth, and
whether it survives a move off `accounts.dev`) so a later reader does not mistake the
recording for a diagnosis.

**Closed the Phase 111 todo.** `111-devtools-issues-panel-entry-unexamined.md` existed solely
because a `1 Issue` badge had been seen and never opened. It has now been opened; the todo is
annotated with the verbatim entry and moved to `.planning/todos/completed/`. That file had
explicitly refused to label the unread badge "Clerk-related" without checking — the guess
proved correct, but it is now earned rather than assumed, and the extensions-off control
additionally showed the Phase 111 badge count was partly extension noise.

## Threat compliance

**T-114-20 (information disclosure via this document) — mitigated.** The checkpoint records
counts, verbatim chip text, verbatim DevTools text and verdicts only. It contains no real root
name and no real directory name: every node label reproduced is either a department name
(fixed classifier vocabulary, already in source) or an already-masked `{department} root {N}`
label. Disclosure probe run on all artifacts before committing — a fixed-string scan
(`grep -F`, never a hand-escaped backslash pattern, which silently returns 0 on Windows paths)
for the operator's home-directory prefix returns **0** in each, against a known-positive
control returning **2** in `CLAUDE.md`, so the probe discriminates. That prefix is described
rather than quoted here: typing the searched-for string into the document that records the
search is exactly how a redaction write-up reintroduces the thing it redacted.

**No deploy was run.** Per the plan, nothing here requires a Convex deploy; one would be a
separate decision governed by CLAUDE.md's `--env-file`-mandatory rule and a
`git status --porcelain` check first, since a deploy ships the whole working tree and this
checkout is shared.

## Observations carried forward (recorded, not fixed)

1. **23 of 53 roots unclassified (43%).** Chip 4 never escalates by design (D-14, tested), so
   this surface will not nag about it. Data, not a defect; belongs to the scanner's classifier
   vocabulary (Phase 115).
2. **Supporting evidence for Phase 115's D-05.** The strip showing a ~04:23 scan against a
   04:15 daily task is consistent with the scheduler having fired unattended. Recorded as
   supporting evidence, **not a verdict** — this checkpoint observed the strip, not the Task
   Scheduler run history, and a manual trigger would look identical. D-05's closure is Phase
   115's to claim.
3. **Intermittent full-suite flakiness under parallel runs** (Phase 106's `App.test.tsx` lazy
   route; Phase 115's `workspaceScan.test.mjs` real-`mkdtempSync` walk). Not a Phase 114
   regression — neither imports a Phase 114 file, both pass in isolation, the suite is green
   serially and on every later parallel run, and a load-matched control was green. **But
   "pre-existing" is NOT proven**: the first control also removed four test files, confounding
   composition with load.

## Self-Check: PASSED

- Both tasks complete; the blocking human-verify gate was answered by the operator directly.
- `114-OPERATOR-CHECKPOINT.md` exists and passes the plan's automated acceptance check.
- D-18 follow-up filed against its owning integration; nothing fixed in this phase.
- Disclosure probe run with a known-positive control on every artifact before commit.
- No deploy, no schema change, no source-code change — this plan changes planning artifacts only.
