---
phase: 115-workspace-scanner
plan: 09
subsystem: infra
tags: [convex-selfhosted, deploy, live-evidence, dry-run-gate, versioned-ingest, prune, workspace-scanner]

# Dependency graph
requires:
  - phase: 115-06
    provides: "convex/workspaceHttp.ts — POST /workspace-ingest route dispatching to internal.workspace.upsertWorkspaceSnapshot"
  - phase: 115-08
    provides: "hooks/workspaceScan.mjs — runWorkspaceScan entry point + the --dry-run/--approve/ingest CLI branch"
provides:
  - ".planning/phases/115-workspace-scanner/115-LIVE-EVIDENCE.md — the phase's live-proof artifact: deploy output, the reviewed report's numbers, the approval hash, six ingests, and both halves of the prune proof"
  - "convex/workspace.ts: pruneWorkspaceVersions as its own internalMutation (D-11 deviation, Larry-approved) — the ingest route now calls it in a bounded loop AFTER the insert commits, so each prune call gets a fresh read budget and no pending write set"
  - "hooks/workspaceScan.mjs: classificationView() + `hashableView = classificationView` — D-12's approval hash now covers the CLASSIFICATION (allowlist, exclusions, per-root department/access/covered, coverage, localConfigStatus) instead of the file inventory"
  - "buildDryRunReport now emits a `classification` block carrying the allowlist and exclude lists — the report did not contain the allowlist at all before"
  - "config/workspace.json + config/workspace.local.json re-mapped and trimmed per Larry's review; `.tmp` added to excludeDirs"
affects: [115-10, 114]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A Convex mutation that inserts N docs and THEN queries the same table must merge its own pending write set into that query, costing roughly N reads — so a delete cap bounds the deletes but not the read. Splitting the prune into its own internalMutation called after the insert commits is the fix; lowering the cap is not (proven by bisecting 4000→2000→1000→500, all failing identically)."
    - "An approval hash must cover the DECISION the human made, not every byte they happened to see. Hashing the whole report made file churn invalidate the approval, which would have made the nightly task exit 3 every night forever."
    - "Every probe in the live-evidence artifact is control-paired: a result the probe would return whether or not the thing were true is recorded as INCONCLUSIVE, not as a pass."

key-files:
  created:
    - .planning/phases/115-workspace-scanner/115-LIVE-EVIDENCE.md
  modified:
    - convex/workspace.ts
    - convex/workspaceHttp.ts
    - convex/workspace.test.ts
    - convex/workspaceHttp.test.ts
    - convex/http.ts
    - hooks/workspaceScan.mjs
    - hooks/__tests__/workspaceScan.test.mjs
    - config/workspace.json

key-decisions:
  - "D-11 DEVIATION, approved by Larry: the prune moved from inside upsertWorkspaceSnapshot to its own pruneWorkspaceVersions internalMutation, called by the ingest route in a bounded loop. D-11's substance is unchanged — still request-driven (never a cron), still a single-version capped delete (never a mass delete). What changed is *same mutation* → *same request*. Forced by the version-4 failure: 4,912 inserts followed by a take() in one transaction exceeded the 4,096-read limit at ANY delete cap."
  - "MAX_DIRS_PER_INGEST corrected 20,000 → 8,000. The original value sat ABOVE the ~16,000-doc write ceiling its own comment invoked as its reason for existing, so the guard admitted payloads that would then die inside the mutation. WORKSPACE_DELETE_CAP 4,000 → 1,500 with MAX_PRUNE_CALLS 6, and the steady-state invariant MAX_PRUNE_CALLS * CAP >= MAX_DIRS_PER_INGEST (9,000 >= 8,000) asserted in a test rather than left in a comment."
  - "D-12's hash scoped to the classification (post-checkpoint fix R1). Measured cause: three consecutive dry-runs gave 229,178 → 229,180 → 229,181 files and two distinct hashes; over 24 hours a change is certain, so 115-10's nightly task would have exited 3 every night, forever. Proven in BOTH directions — a hash that never changes is as broken as one that always does."
  - "The D-12 case 5 control was split. Its name promised 'someone widened the allowlist and re-ran the nightly task' while its body only added a file, so the scenario it advertised was never exercised. Now (c1) a file appearing after approval ingests, and (c2) the allowlist widened after approval refuses with exit 3 and never calls postSnapshot."

patterns-established:
  - "Record the wrong diagnoses, not just the final answer. Two of the three explanations for the version-4 failure were confidently wrong and were acted on; the artifact's Corrections section names both, because recording only the answer misrepresents how it was found."
  - "Disclose self-inflicted live-data damage in the durable artifact. A 100-directory control run wrote a real version 4 to the live database and briefly made getWorkspaceMap return a truncation — recorded, because the alternative is an artifact implying the live data was untouched."

requirements-completed: []  # No REQ-IDs for Phase 115 — traceability is via D-10/D-11/D-12 (CONTEXT.md).

# Metrics
duration: ~2h40m on 2026-08-12 + ~1h of post-checkpoint fixes on 2026-08-13
completed: 2026-08-13
---

# Phase 115 Plan 09: Deploy, Human Review, First Live Ingest Summary

**Deployed the `workspace*` schema and `/workspace-ingest` route to the self-hosted backend, obtained Larry's real three-round review of a real report against his actual filesystem, and landed eight live ingests — converting all four of plan 115-04's `it.todo` markers into control-paired live evidence, and finding two genuine defects that no test had caught.**

## Performance

- **Duration:** ~2h40m (2026-08-12 15:42–18:18) plus ~1h of post-checkpoint fixes (2026-08-13 07:55–07:56 commits)
- **Completed:** 2026-08-13
- **Tasks:** 3/3 completed, plus 2 post-checkpoint fixes Larry flagged
- **Commits:** `674403d2`, `65a0e7bf`, `7ca97783`, `810b236e`, `f36be958`, `89924f78`, `5c4851c5`

## Must-haves — all four proven live

| Truth | Status | Evidence |
|---|---|---|
| Schema + route LIVE on self-hosted, proven by deploy output naming the instance — not by exit 0 | **PASS** | `115-LIVE-EVIDENCE.md` §1.4: `Deployed Convex functions to http://127.0.0.1:3210`, `No indexes are deleted by this push`, no `*.convex.cloud` host anywhere |
| D-12 satisfied by a REAL human review of a REAL report against Larry's actual filesystem | **PASS** | §2, three review rounds with Larry's verbatim responses ending in `"approved"`; approval marker `7565e00b…` |
| D-10's versioned write proven live — activeVersion increments, never two active | **PASS** | §3 it.todo #1: observed at versions 1, 2, 3, 5, 6; `rowsReturned` equalled `totalDirs` at every step, never a mixture |
| D-11's prune proven live — oldest version's rows deleted, active version's not | **PASS** | §3 it.todo #2, **both halves**: oldest remaining row `version = 4` (asc), control returns `version = 6` (desc) proving the query returns data at all |

Artifact `115-LIVE-EVIDENCE.md` is **578 lines** against a `min_lines: 60` floor.

## What was built

### Task 1 — Deploy (PASS)

Deployed with the mandatory `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. Working tree and branch were each checked as their own tool call first (`git status --porcelain` empty, `master`) because a deploy ships the working tree, not HEAD.

Function existence was proven with a **control-paired** HTTP query probe, not exit 0 — `workspace:getWorkspaceMap` returned `{status: success, value: null}` (115-04's designed graceful-skip) while a bogus name returned `Could not find public function`. The `null` alone would have proved nothing.

Three commands were deliberately NOT run and are named in the artifact: `npx convex env list` (prints full `NAME=VALUE` against self-hosted), `npx convex run --push` (deploys the working tree), `npx convex import --replace-all` (forbidden after the 2026-07-21/22 outage).

### Task 2 — Larry's review (PASS, three rounds)

- **Round 1:** 15,648 dirs / 274,664 files / 29,488 withheld. Work 0, Consulting 0 — only two of 66 roots carried a department, both scanner inferences. `scannedRootsComplete: false`, traced to four `EPERM scandir` failures on `astridr-repo`'s pytest scratch dirs (**control:** the same probe on `codepulse` read 601 dirs with 0 failures).
- **Round 2** after Larry's re-map and trim: **4,912 dirs**, Work 554 / Consulting 1,324 / Personal 2,339 / Unclassified 695.
- **Round 3** after adding `.tmp` to `excludeDirs`: **`scannedRootsComplete: true`, 53 of 53 roots covered** — the same probe that found four failures now reports zero, a before/after contrast rather than a bare absence claim.

Withheld files are reported by extension FAMILY and count only — **no withheld filename appears anywhere in the artifact** (D-03). `git status --porcelain config/` after approval was empty, with `git check-ignore config/workspace.json` exiting 1 as the control proving the ignore rules are specific rather than blanket.

### Task 3 — Live ingest + it.todo conversion (PASS)

Eight ingests total. Versions 1–3 clean; version 4 exposed the read-limit defect (below); versions 5–6 proved the prune including its deferred-remainder self-heal across an ingest boundary; versions 7–8 proved the R1 fix end to end.

**Final live state:** `activeVersion 8`, `storedVersions [6,7,8]`, `totalDirs 4912`, `rowsReturned 4912`, `pruneIncomplete false` — all three retained versions are real, complete 4,912-directory snapshots.

`generatedAt` was sanity-checked as epoch **seconds** (1786571195 → 2026-08-12); read as millis it would be 1970, and a threshold comparison that passes vacuously reads identically to one that passes correctly.

## Deviations

1. **D-11 prune extracted to its own mutation** (approved by Larry) — see key-decisions. Substance of D-11 unchanged.
2. **Constants corrected** — `MAX_DIRS_PER_INGEST` 20,000 → 8,000, `WORKSPACE_DELETE_CAP` 4,000 → 1,500, `MAX_PRUNE_CALLS` 6, invariant asserted in a test.
3. **D-12 hash rescoped to the classification** (post-checkpoint fix R1) — the plan did not anticipate that a whole-report hash is incompatible with an unattended nightly run.
4. **Config re-mapped and trimmed** per Larry's Round-1 decisions — four bulk root groups trimmed, three roots assigned to Consulting, `.tmp` excluded.

## Corrections — two of three diagnoses were wrong

The artifact's Corrections section records these in full deliberately.

- **Wrong diagnosis 1 — the write ceiling.** Real (Convex documents `Documents written 16,000`, which also settled `115-RESEARCH.md`'s Assumption A6) but not what the code hit.
- **Wrong diagnosis 2 — the delete loop's reads.** The cap was bisected 4,000 → 2,000 → 1,000 → 500, **all failed identically**. The cap was never the lever.
- **Actual cause, isolated by a control:** holding prune work constant and varying only the insert count — **4,912 inserts FAILED, 100 inserts SUCCEEDED**. A query after N inserts in the same mutation must merge that transaction's pending write set, at roughly N reads.

**Self-inflicted damage, disclosed:** the 100-directory control run wrote a real version 4 to the live database, briefly making `getWorkspaceMap` return a 100-directory truncation. It should have used a scratch `snapshotId`. Cleaned up by rolling versions forward, never by hand-deleting rows; the oldest row physically remaining is version 6.

## Tests

Full suite after all changes: **316 files passed, 17 skipped; 4,286 tests passed, 197 todo** (as recorded in the artifact at execution time).

## Follow-ups created

1. **`convex/graphSnapshots.ts:193-219` carries the same defect** — caps deletes at 15,000 while reading via `.collect()`. Inert today because its cron is disabled at `crons.ts:145-151` for a "candidate-selection read [that] times out", very likely this same bug under a wrong diagnosis. Out of Phase 115's scope.
2. **The prune's crash path was never exercised.** The deferred-remainder path was exercised for real; the crash-between-delete-and-patch path rests on code reading only, and the `it.todo` text says so.
