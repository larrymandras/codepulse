---
phase: 95-hardening-security-audit-key-rotation-dependency-majors
plan: 04
subsystem: infra
tags: [hard-02, forge-daemon, ingest-verification, live-round-trip, convex, no-rotation, cross-repo-fix]

# Dependency graph
requires: [95-01]
provides:
  - "HARD-02 closed as verified-no-rotation: both ingest keys real on prod, both sides live-round-trip verified"
  - "Forge daemon located (C:\\Users\\mandr\\forge) + its config model documented in memory"
  - "docs/forge-deploy-checklist.md .cloud->.site host bug fixed"
  - "forge daemon startup crash (migration v4 FK) root-caused + fixed (forge repo) + live DB migrated v3->v6"
affects: [95-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verify ingest round-trips against forgeJobs/forgeWorkspaces/forgeHosts (Convex table names), not the daemon's local jobs/workspaces SQLite names"
    - "SQLite table-rebuild migrations must disable foreign_keys for the migration run (outside any txn) + foreign_key_check after — legacy_alter_table=ON does NOT prevent FK-ref rewrite on RENAME in SQLite 3.51.x"

key-files:
  created: []
  modified:
    - ".planning/REQUIREMENTS.md"
    - "docs/forge-deploy-checklist.md"
    - "C:/Users/mandr/forge/src/store/db.ts (cross-repo fix, branch fix/db-migration-fk-rebuild)"

key-decisions:
  - "HARD-02 closed as verification + documentation with NO new rotation (D-01) — the 2026-07-05 secret verification stands; live authenticated round trip proves both sides"
  - "Fixed two real blockers surfaced during verification rather than deferring: the checklist .cloud->.site host bug (codepulse) and the forge daemon migration-v4 FK startup crash (forge repo)"
  - "Migrated the live forge.db v3->v6 with FK-off + integrity-check (data intact: 27 jobs / 22 loop_rounds), backed up first — unblocks daemon startup without data loss"

requirements-completed: [HARD-02]

# Metrics
duration: ~90min (incl. cross-repo daemon debugging + operator live round trip)
completed: 2026-07-07
---

# Phase 95 Plan 04: HARD-02 Forge Ingest Verification Summary

**HARD-02 closed honestly as verification + documentation (NO new rotation): both ingest keys confirmed real on prod Convex `tidy-whale-981`, and both emitter sides proven by live round trip — a completed `codex`/`goal` job from the real Forge daemon (`host lmofficenew`) landed a fresh `forgeJobs` row (`01KWYJ2GVQ09WRQTRN96VP926Y` @ 15:10:18Z), corroborated by a live Ástríðr `events` row at 13:40:44Z. Getting there required fixing two real blockers: a `.cloud`→`.site` host bug in the deploy checklist and a forge-daemon startup crash (migration-v4 FK violation).**

## Performance

- **Duration:** ~90 min (dominated by locating the daemon, root-causing its startup crash, and the operator-run live round trip)
- **Completed:** 2026-07-07
- **Tasks:** 2 (Task 1 human-verify checkpoint; Task 2 records update)
- **Files modified:** 2 in codepulse (`REQUIREMENTS.md`, `docs/forge-deploy-checklist.md`) + 1 cross-repo (`forge/src/store/db.ts`)

## Accomplishments

- **Verified both ingest keys real on prod** (`convex env list`, masked): `FORGE_INGEST_API_KEY` 48 chars, `ASTRIDR_INGEST_API_KEY` 43 chars, `FORGE_INGEST_ALLOW_ANON` unset (fail-closed), `CODEPULSE_ALLOWED_ORIGIN` set (CORS not fail-open in prod)
- **Proved the live real-emitter round trip** (D-02): fresh `forgeJobs` row from the real Forge daemon (`codex`/`goal`, completed, host `lmofficenew`, `forgeJobId 01KWYJ2GVQ09WRQTRN96VP926Y`, `_creationTime 2026-07-07T15:10:18Z` > baseline 13:40:01Z); Ástríðr side corroborated by a live `events` row at 13:40:44Z; `forgeHosts.lastSeenAt` bumped by the command-bridge poll confirmed live auth
- **Located the daemon** (`C:\Users\mandr\forge`) and documented its config model in the `forge-deployment-tidy-whale-981` memory (no `.env`/dotenv → export in shell; correct `.site` URLs; `forgeJobs`/`forgeWorkspaces` Convex table names; local job API bearer)
- **Fixed the checklist `.cloud`→`.site` bug** (`docs/forge-deploy-checklist.md`, commit `0ca0824`) — the silent-failure trap that mismatched HTTP-action host
- **Root-caused + fixed the forge daemon startup crash** (`FOREIGN KEY constraint failed`): migration v4's table rebuild orphans `loop_rounds` under `foreign_keys=ON` because SQLite 3.51.x rewrites the FK ref on `RENAME` despite `legacy_alter_table=ON`; fix disables FKs around `runMigrations` + adds `foreign_key_check` (forge branch `fix/db-migration-fk-rebuild`, `9f80b36`, 88/88 store tests pass), and migrated the live DB v3→v6 data-intact (backup `forge.db.bak-20260623-162616`)
- **Updated records** (D-03): `REQUIREMENTS.md` HARD-02 rewritten to verified-no-rotation close-out (placeholder retired, `[x]`, traceability → Complete); memory appended with daemon location/config + round-trip evidence + both fixes. No secret values written anywhere (char-counts + behavior only)

## Task Commits

1. **Task 1: Confirm Forge-daemon env + live round trip** — human-verify checkpoint; operator launched a real `codex` job, fresh `forgeJobs` row verified. Enabling fixes committed en route: `0ca0824` (checklist), forge `9f80b36` (daemon DB fix).
2. **Task 2: Update records (REQUIREMENTS.md + memory)** — this SUMMARY + tracking commit.

## Files Created/Modified

- `.planning/REQUIREMENTS.md` — HARD-02 marked `[x]` with verified-no-rotation wording + round-trip evidence; traceability row → Complete
- `docs/forge-deploy-checklist.md` — three ingest-URL examples corrected `.convex.cloud`→`.convex.site` + a prominent host-gotcha callout (`0ca0824`)
- `C:/Users/mandr/forge/src/store/db.ts` — (cross-repo) FK-off-during-migrations fix on branch `fix/db-migration-fk-rebuild` (`9f80b36`)

## Decisions Made

- **No new rotation (D-01):** the 07-05 verification stands; HARD-02 is a verification + documentation close, confirmed by a live authenticated round trip rather than a rotation.
- **Fix, don't defer (error-triage):** two genuine blockers surfaced (checklist host bug + daemon FK crash). Both were root-caused and fixed rather than deferred, since HARD-02 could not be honestly closed without a running daemon and a correct checklist.
- **Preserve daemon data:** migrated the live `forge.db` v3→v6 (FK-off + `foreign_key_check`) with a backup, rather than deleting/recreating it — kept the 27 jobs / 22 loop_rounds history.

## Deviations from Plan

- **Scope expanded into the forge repo.** The plan assumed a runnable daemon; in reality the daemon was unlocatable at first, its deploy checklist had a `.cloud`/`.site` bug, and it crashed on startup with an unrelated SQLite migration FK bug. Closing HARD-02 required fixing all three. The daemon fix is a `forge`-repo change (committed on a branch, not merged), outside the codepulse phase surface — flagged as such.
- **Corrected an earlier mis-observation:** initial "jobs/workspaces empty → Forge never worked" was wrong — those are the daemon's local SQLite table names; the real Convex tables (`forgeJobs`/`forgeWorkspaces`) hold historical rows back to 2026-06-23. The Forge bridge had worked before; it was simply not running/configured recently.

## Issues Encountered / Follow-ups

- **Forge daemon ingest config non-durability — RESOLVED (2026-07-07):** `main()` now loads a `.env` via Node's native `process.loadEnvFile` (forge commit `e70e45e`); `.env.example` added; `forge/.gitignore` closed the `.env` gap. Ingest vars persist across runs.
- **`fix/db-migration-fk-rebuild` — MERGED to forge `master` (2026-07-07, `9adacfe`)** and branch deleted; post-merge build + 800 tests green.

## User Setup Required

- **Done:** forge branch merged to `master`; daemon durability fix landed.
- To keep Forge emitting to CodePulse across restarts: copy `forge/.env.example` → `forge/.env` and fill in `FORGE_INGEST_API_KEY` (from `npx convex env get FORGE_INGEST_API_KEY`). The daemon now auto-loads it — no shell export needed.

## Next Phase Readiness

- HARD-02 resolved. With 95-01/95-02/95-04 done, the shipped tree + dependency + key-verification work is settled — Plan 03's `/cso` audit can now certify the final state (D-11 ordering: audit last).

## Self-Check: PASSED

- FOUND: .planning/phases/95-.../95-04-SUMMARY.md
- FOUND: fresh forgeJobs row 01KWYJ2GVQ09WRQTRN96VP926Y @ 2026-07-07T15:10:18Z (> baseline)
- FOUND: REQUIREMENTS.md HARD-02 marked [x] + traceability Complete, placeholder retired, "no new rotation" recorded
- FOUND: forge-deployment-tidy-whale-981 memory updated with daemon-side env + round-trip evidence
- FOUND: docs/forge-deploy-checklist.md uses .convex.site (commit 0ca0824)

---
*Phase: 95-hardening-security-audit-key-rotation-dependency-majors*
*Completed: 2026-07-07*
