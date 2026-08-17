---
phase: 118-studio-media-gallery
plan: 01
subsystem: infra
tags: [convex, file-storage, self-hosted, probe, media-vault]

requires: []
provides:
  - "D-01 resolved: BRANCH: convex-storage, live control-paired proof PASSED"
  - "scripts/probe-convex-storage.mjs — re-runnable D-01 round-trip probe"
  - "118-D01-EVIDENCE.md — captured evidence artifact"
  - "the exact thumbnail-transport origin/schema-field decision downstream plans need"
affects: [118-03-schema, 118-07-watcher, 118-08-scheduled-tasks]

tech-stack:
  added: []
  patterns:
    - "control-paired live probe with a known-failure control (unreachable URL, exits non-zero within 20s) proving the probe itself can fail"
    - "A2 origin-rewrite fallback pattern (verbatim URL first, then rewrite to a fixed local origin only on a transport-layer failure)"

key-files:
  created:
    - scripts/probe-convex-storage.mjs
    - .planning/phases/118-studio-media-gallery/118-D01-EVIDENCE.md
  modified:
    - .planning/phases/118-studio-media-gallery/118-CONTEXT.md

key-decisions:
  - "D-01 resolved live: BRANCH: convex-storage (probe PASSED on the first live run — 4096/4096 bytes round-tripped, HTTP 200, discriminated from a null control). local-static-origin fallback not built."
  - "The watcher must use the URL Convex returns verbatim (tailnet hostname, e.g. https://lmofficenew.tail5bb6b3.ts.net) for both upload and read-back — no origin rewrite to 127.0.0.1:3211 was needed in practice, though the probe keeps that rewrite as a defensive fallback."
  - "media.thumbStorageId is the populated schema field; media.thumbRelPath is declared optional but always absent under this branch."

patterns-established:
  - "D-01-style blocking proof plans: acquire the null-control BEFORE any write, verify the probe itself can fail via a known-unreachable-URL control, and record BRANCH:/VERDICT: lines that a later plan's automated check cross-references against CONTEXT.md rather than re-deciding."

requirements-completed: [D-01]

duration: ~25min
completed: 2026-08-14
---

# Phase 118 Plan 01: D-01 Convex Storage Round-Trip Proof Summary

**Live control-paired probe of `generateUploadUrl` → upload → `getUrl` → GET PASSED on the first run (4096/4096 bytes, HTTP 200 throughout, discriminated from a known-null control) — D-01 resolves to `BRANCH: convex-storage`, no fallback transport needed.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 3 (1 created script, 1 created evidence doc, 1 amended CONTEXT.md)

## Accomplishments

- Wrote `scripts/probe-convex-storage.mjs`, a zero-dependency Node ESM probe that acquires a
  null-control (an orphaned `avatars.imageStorageId`) before any write, mints a fresh upload URL,
  uploads a deterministic 4096-byte payload, reads it back, and prints a machine-readable
  `VERDICT:` block. Proven against two known-failure controls before the live run: an unreachable
  `CONVEX_SELFHOST_URL` exits 3 in ~65ms, and `--help` exits 2 with no network call — both well
  under the 20s ceiling, satisfying "a probe that cannot fail cannot pass."
- Ran the probe live against the self-hosted backend (`convex-backend Up 11 hours (healthy)`).
  **`VERDICT: PASS`.** The control (`avatars:getImageUrl` on the orphaned ID
  `kg2589rnrbawjb3g2867yjn3c586zngt`) resolved `null`; the experimental fresh round-trip resolved
  a working URL that served exactly 4096/4096 bytes at HTTP 200. Full evidence captured in
  `118-D01-EVIDENCE.md` (upload capability token redacted out of caution; every other value —
  host, port, path, byte counts, response bodies — is verbatim).
- Recorded the resolved transport branch as an `AMENDMENT 2026-08-14` block under D-01 in
  `118-CONTEXT.md`, matching the evidence file's own `## Resolved transport branch` section
  (cross-checked by an automated equality assertion on the `BRANCH:` string). `BRANCH:
  convex-storage`. `media.thumbStorageId` is the field the schema plan (118-03) should populate;
  `media.thumbRelPath` stays declared-but-unused. The watcher (118-07) should use the URL Convex
  returns verbatim — the A2 origin-rewrite to `127.0.0.1:3211` was implemented defensively but
  never fired, because the tailnet hostname Convex returned was directly reachable from this
  host.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the control-paired storage round-trip probe** — `db66f097` (feat)
2. **Task 2: Run the probe live and capture the evidence artifact** — `85028f87` (docs)
3. **Task 3: Record the resolved thumbnail-transport branch as a decision amendment** — `7b720e3b` (docs)

## Files Created/Modified

- `scripts/probe-convex-storage.mjs` — the re-runnable D-01 probe (Task 1)
- `.planning/phases/118-studio-media-gallery/118-D01-EVIDENCE.md` — captured run metadata, raw
  output, control pair, origin finding, verdict, and the resolved-branch section (Tasks 2-3)
- `.planning/phases/118-studio-media-gallery/118-CONTEXT.md` — `AMENDMENT 2026-08-14` under D-01
  only; `git diff --stat` shows 21 insertions, 0 deletions, no other decision touched (Task 3)

## Decisions Made

- **D-01 resolved on the `convex-storage` primary branch.** The plan's prose treated this as a
  genuinely open question with two authorized branches; the live measurement answered it in one
  run. No plan text needed correcting — CONTEXT.md's pre-flight table and RESEARCH.md's Pattern 3
  hypothesis (the orphaned nulls are explained by an unmigrated storage volume, not a broken
  mechanism) both held.
- **The A2 fallback origin (`127.0.0.1:3211`) is implemented but confirmed unnecessary in
  practice** — the minted upload URL's tailnet hostname (`https://lmofficenew.tail5bb6b3.ts.net`)
  was directly reachable from this host on the first attempt (manual `curl -I` reachability check
  run before finalizing the script's fallback-trigger condition, then re-confirmed by the actual
  probe run). Kept in the script and documented as cheap insurance for 118-07's watcher, not
  removed, since a future network-topology change could make it load-bearing.
- **Redacted the one-time upload capability token from the committed evidence file**, even though
  it is a single-use, ~1-hour-expiring Convex-generated capability URL (not a bearer header, admin
  key, or environment-variable value) and was already consumed by the time it was written down.
  This is more conservative than the plan's literal secrets-discipline wording strictly requires,
  but matches its spirit for a public repo. Host, port, path, and all response bodies are
  otherwise verbatim.

## Deviations from Plan

None — plan executed exactly as written. One thing worth flagging as a live discovery rather than
a plan defect: the plan's `<interfaces>` section describes `avatars:list` as returning "`avatars`
rows" without commenting on volume; the live table turned out to hold 4,233 rows, only 11 of which
are real persona avatars (see "Discovered but out of scope" below). This didn't require any script
change — the control-acquisition logic already filters correctly on `imageStorageId` presence
regardless of row count — but it's the kind of thing a downstream plan reading `avatars:list` for
a different reason should know about.

## Issues Encountered

None. The probe passed on the first live run; no debugging cycle was needed.

**Discovered but out of scope (documented in `118-D01-EVIDENCE.md`, not fixed here):** the
`avatars` table holds ~4,222 rows with generated-looking names (e.g.
`aexec-118-01-d4844871fc84376b`) alongside the 11 real persona rows. This plan never calls
`avatars:saveImage`/patch/delete, so it neither caused nor touched this. Flagged for visibility;
any cleanup needs its own batch-capped design per CLAUDE.md's no-mass-mutation rule and is
explicitly out of this plan's scope.

## User Setup Required

None — no external service configuration required. This plan drove already-deployed public
Convex functions with no credential (per CLAUDE.md, self-hosted public functions require none)
and made no deploy.

## Next Phase Readiness

- **Wave 2 is unblocked.** `118-D01-EVIDENCE.md` carries the required `BRANCH:` line
  (`convex-storage`), justified by a control-paired live measurement, and the matching amendment
  is in `118-CONTEXT.md`.
- Plan 118-03 (schema) can write `media.thumbStorageId`/`media.thumbRelPath` deterministically
  without re-deciding the branch.
- Plan 118-07 (watcher) can use the verbatim-origin pattern this probe proved, with the
  `127.0.0.1:3211` rewrite kept as defensive fallback code, not load-bearing.
- No later plan gains a task under the fallback branch — `local-static-origin` was not needed, so
  118-07 and 118-08 do not need the extra static-server/scheduled-task tasks that branch would
  have required.
- Full `npm test` run: **4397 passed | 0 failed** (323 test files passed, 17 skipped; 197 todo) —
  unchanged from the pre-plan baseline recorded at Phase 114's close. This plan added no tests and
  broke none.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
