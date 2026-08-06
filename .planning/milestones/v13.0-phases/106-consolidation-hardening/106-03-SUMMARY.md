---
phase: 106-consolidation-hardening
plan: 03
subsystem: infrastructure
tags: [convex, cloud-retirement, snapshot-export, archive-verification, provenance, stale-docs, billing-handoff]

# Dependency graph
requires:
  - phase: 106-consolidation-hardening
    provides: "Plan 106-01's cross-repo reference sweep and its 2026-08-05 amendment, whose VERDICT: GO gated this plan — establishing that no functional reader of tidy-whale-981 remained in either repo and that VITE_CONVEX_URL resolves to the self-hosted tailnet host"
provides:
  - "A complete, CRC-verified local archive of the retired cloud deployment tidy-whale-981 (617 MB zip + 2.0 GiB extracted, 602,932 rows, 25 stored files) at C:\\convex-cloud-archive\\ — now the only copy of pre-2026-07-15 CodePulse history"
  - "A provenance method for proving a Convex export came from a frozen deployment rather than a live one: a full-table timestamp span cross-checked against an independently recorded freeze point"
  - "106-DEBT-VERIFICATION.md § 'DEBT-02 — Export & verification' — export transcript, archive verification evidence, and the cancel handoff record"
  - "A corrected .planning/AVATAR-HANDOFF.md that no longer claims production reads cloud tidy-whale-981"
  - "Closure of the cloud/self-hosted dual-backend topology: exactly one Convex deployment now exists"
affects: [106-08, convex-topology-all-local]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prove an export's target from the exporting CLI's own printed output before trusting the archive, then re-prove it after the fact from data only the intended source could hold — belt and braces, because the ambient env can silently redirect the CLI"
    - "When a deletion is confirmed by self-report, run a control probe against a never-existed identifier: if the control is indistinguishable from the target, the probe alone proves nothing and a first-hand liveness baseline is required"

key-files:
  created:
    - .planning/phases/106-consolidation-hardening/106-03-SUMMARY.md
  modified:
    - .planning/phases/106-consolidation-hardening/106-DEBT-VERIFICATION.md
    - .planning/phases/106-consolidation-hardening/106-CONTEXT.md
    - .planning/AVATAR-HANDOFF.md
    - .planning/ROADMAP.md

key-decisions:
  - "Kept BOTH the CRC-verified ZIP and an extracted directory tree of the archive. The extraction was done from the local ZIP, not by re-exporting, so the cloud deployment was read exactly once. Rationale: 2 GiB against 359 GB free removes the single-point-of-failure of one ZIP central directory on data that can never be retaken."
  - "Corrected 106-CONTEXT.md D-02's '~56 GB' figure in place rather than leaving it. The real archive is 617 MB; a 2%-of-budget result is indistinguishable in shape from a truncated export, so an uncorrected D-02 would invite a future reader to conclude a good archive had failed."
  - "Rejected the plan's stated interpretation that a table absent from the archive held zero rows. The archive exports 63 empty tables with 0-byte documents.jsonl, so absence is stricter: those 6 schema tables never existed on the cloud deployment."
  - "Did NOT touch .planning/STATE.md. It is dirty with the phase-107 session's in-flight work and that session owns the write."

requirements-completed: [DEBT-02]

# Metrics
duration: ~95min
completed: 2026-08-05
---

# Phase 106 Plan 03: Cloud Convex Retirement (tidy-whale-981) Summary

Exported the retired cloud Convex deployment `tidy-whale-981` to local disk (617 MB / 602,932 rows), proved from data that the archive came from the frozen cloud instance and not the live self-hosted one, corrected the last document claiming production reads it, and handed Larry the cancel — which he completed, deployment and subscription both.

## What Happened

**Task 1 — Export.** `npx convex export --deployment tidy-whale-981 --include-file-storage`, run from Git Bash with `CONVEX_SELF_HOSTED_URL`/`CONVEX_SELF_HOSTED_ADMIN_KEY` emptied on the invocation. 366 GB free beforehand, well over the 120 GB floor. The CLI's own output named the target — `https://dashboard.convex.dev/d/tidy-whale-981/settings/snapshot-export` — a cloud dashboard URL, not a tailnet host, not `127.0.0.1:3210`, not `convex-backend`. No auth error occurred, so `npx convex login` was never needed and no API-key fallback was introduced. Six minutes, exit 0.

**Task 2 — Verification by reading rows.** The exit code was recorded but used as evidence of nothing. Whole-archive `testzip()` recomputed every entry's CRC: 318/318 valid. 143 table directories cross-checked against `convex/schema.ts`'s 130 `defineTable` declarations. First *and* last `documents.jsonl` lines parsed as JSON for 8 tables including `events` and `sessions`; all 263,718 `events` rows parsed individually with zero failures.

**Provenance — the load-bearing check.** Newest `events` row: **2026-07-15T00:04:25Z**, computed over all 263,718 rows. That matches the independently recorded cloud freeze point (memory `convex-topology-all-local`: ~2026-07-15T00:04Z) to the minute, from a figure written down before this export existed. `sessions.startedAt` corroborates from a different table and field (max 2026-07-14T22:59:43Z). Had this come from the live self-hosted backend, the newest row would have been minutes old.

**Task 3 — Cancel handoff.** Presented the checkpoint and stopped. Larry deleted the deployment and cancelled the plan himself. Claude issued no cancel, delete, or billing call at any point.

## Deviations from Plan

### Auto-fixed / corrected

**1. [Rule 1 - Bug] A provenance verdict that was right by accident**

- **Found during:** Task 2
- **Issue:** The first provenance pass divided `events.timestamp` by 1000 assuming milliseconds, printed 1970 dates — and still emitted `PASS`, because a 1970 date trivially precedes the 2026 gate. A correct verdict reached by broken arithmetic, which would have been recorded as evidence.
- **Fix:** Re-derived treating the values as seconds (confirmed: all 263,718 fall in the seconds bucket, zero mixed-unit outliers), giving the real span 2026-05-21 → 2026-07-15. The near-miss is documented in the artifact rather than quietly overwritten.
- **Commit:** `6e550b64`

**2. [Rule 1 - Stale Docs] `106-CONTEXT.md` D-02's "~56 GB" belongs to a different instance**

- **Found during:** Task 1
- **Issue:** D-02 budgets "~56 GB pre-2026-07-15 cloud history". The real archive is 617 MB compressed / 2.0 GiB uncompressed. The 56 GB figure traces to the *self-hosted* Convex incident of 2026-07-17…22, where a snapshot export peaked at ~56 GB of transient scratch on a ~1M-doc DB — a different deployment, and a peak rather than an archive size.
- **Why it matters:** a 2%-of-budget result looks exactly like a truncated export. Left uncorrected, D-02 would lead a future reader to conclude a complete archive had failed.
- **Fix:** dated correction appended to D-02 in place, pointing at the completeness evidence. Third file beyond the plan's declared `files_modified` — accepted under the Stale Docs rule (correct in the same commit as the discovery).
- **Commit:** `791d88bd`

**3. [Rule 3 - Blocking] Export produced a ZIP, not the directory tree the plan assumed**

- **Found during:** Task 1
- **Issue:** the plan's `<interfaces>` block and its `test -d` verify both anticipated a directory. `convex export --path <p>` writes a ZIP unless `<p>` already exists as a directory; the path did not exist, so the CLI wrote a single extension-less ZIP there.
- **Fix:** renamed to `tidy-whale-981.zip` and extracted alongside it **from the local ZIP** — no second export, so the cloud was read exactly once. Both forms retained.
- **Commit:** `791d88bd` (recorded), `6e550b64` (structure evidence)

**4. [Rule 1 - Bug] The plan's stated meaning of an absent table is wrong**

- **Found during:** Task 2
- **Issue:** the plan instructed that a schema table absent from the archive "means it held zero rows on the cloud instance". The archive disproves this: 63 tables are present with a 0-byte `documents.jsonl`, so Convex exports declared-but-empty tables.
- **Fix:** recorded the stricter and more useful reading — the 6 absent tables (`activeEngineSnapshots`, `costBudgets`, `inbox`, `kgAnswerSync`, `modelPricing`, `toolPolicyEvents`) never existed on the cloud deployment; they were added to `schema.ts` after the 2026-07-15 retirement and only ever pushed to the self-hosted backend. Nothing is missing on their account.
- **Commit:** `6e550b64`

**5. [Rule 1 - Bug] A false attribution in the checkpoint resolution**

- **Found during:** Task 3
- **Issue:** the resolution relayed to me stated that "your own Task 1 probe established" that `/health` served the CodePulse payload before deletion. Task 1 ran no such probe, and no live `/health` response from `tidy-whale-981` was ever captured while it was up.
- **Fix:** verified what *was* checkable (`convex/http.ts:37` does route `GET /health` → `healthCheck`), re-ran all three 404 probes first-hand rather than relaying them, and wrote an explicit attribution note. The real pre-deletion baseline is stronger anyway: the Task 1 export read 602,932 rows out of that host between 14:24Z and 14:30Z, and it 404s at 15:54Z.
- **Commit:** `bd2e169`

**6. [Rule 2 - Missing verification] 404 alone does not prove deletion**

- **Found during:** Task 3
- **Issue:** the three 404s were offered as proof the deployment was gone, but `*.convex.site` returns 404 for *any* slug.
- **Fix:** added a control probe against `definitely-not-a-real-deployment-9x7q2` — identical 404s. So the probe proves "no deployment answers here", and it is the liveness baseline (a full data read 85 minutes earlier) that closes the gap to "deleted". Also recorded that DNS still resolves via Cloudflare's `*.convex.site` wildcard (`104.18.10.59`, `104.18.11.59`, `2606:4700::6812:a3b/b3b`) and that this is **not** evidence the deployment survived — the control hostname resolves the same way.
- **Commit:** `bd2e169`

### Checkpoint adjustment

Task 3's scripted text asked Larry to complete four `MANUAL — PENDING LARRY` `.env*` checks. Three were already settled per the 2026-08-05 pre-flight amendment — two live files supplied and confirmed clean, two `.bak` backups accepted as an inert residual on his explicit decision. The checkpoint was rewritten to ask only for the dashboard actions rather than re-requesting checks already given.

## Archive Facts

| Property | Value |
|---|---|
| ZIP | `C:\convex-cloud-archive\tidy-whale-981.zip` — 617 MB (`646,669,127` bytes) |
| Extracted | `C:\convex-cloud-archive\tidy-whale-981\` — 2.0 GiB, 318 entries |
| Integrity | `testzip()` CRC-valid, all 318 entries |
| Tables | 143 directories (80 non-empty, 63 empty); 124 overlap with `schema.ts` |
| Rows | **602,932** — `events` 263,718 · `graphSnapshotLinks` 122,773 · `graphSnapshotNodes` 95,406 · `aggregates` 25,476 · `llmMetrics` 13,536 |
| File storage | `_storage/` present, 25 files, 7,448,950 bytes, 25 metadata rows (no orphans) |
| History span | `events` 2026-05-21T13:07:35Z → 2026-07-15T00:04:25Z · `sessions` back to 2026-05-07 |

## Cancel Outcome (D-04)

Larry's verbatim reply: *"tidy-whale-981 deployment deleted"*. Because that named only the deployment and deleting a deployment does not necessarily stop billing, the plan cancellation was asked separately: *"Yes, plan cancelled too."* Both actions complete. Verified independently by 404s on `/health`, `/`, and `/instance_name`, with the control and liveness-baseline reasoning above.

## Constraints Honored

- **Zero Convex write commands.** No `convex import`, `deploy`, `run`, `--replace-all`, bulk delete, or bulk patch. Every Convex invocation was read-only: `--version`, `--help` ×3, and one `export`.
- **Live self-hosted instance never touched.** The self-hosted vars were emptied on the export invocation specifically to prevent it, and the post-hoc timestamp proof confirms it was never the source.
- **No billing action by Claude.** The checkpoint blocked until Larry acted.
- **No credential value printed** to the transcript or any artifact.
- **`.planning/STATE.md` deliberately left alone** — dirty with the phase-107 session's in-flight work; that session owns the write. ROADMAP.md was updated by hand per this repo's anti-clobber convention.

## Open Items Carried Forward

1. **astridr-repo CI telemetry removal is not live on `main`.** Commit `22027c71` sits on `feature/brain-swap`. GitHub runs `schedule:` triggers from the default branch, so `supabase-migration-check.yml`'s 07:00 UTC cron keeps POSTing to the now-404 host until that branch merges. Harmless — the POST ends in `|| echo "...non-fatal"` — but real, and it will now fail every day rather than silently succeeding.
2. **`astridr/channels/web.py:973`** still defaults the CORS allowlist to `https://tidy-whale-981.convex.site`, an origin that no longer exists. Not reached in Larry's deployment because `CODEPULSE_ORIGIN` is set explicitly. Flagged for a later phase.
3. **The archive is the only copy** of pre-2026-07-15 CodePulse history. D-02 permits deleting it at Larry's discretion; nothing in this phase deletes it.
4. **Side-finding from plan 106-01, still open:** `hooks/*.mjs` in astridr-repo fall back to a *different* cloud slug, `ideal-sandpiper-297`. Out of DEBT-02's scope (which targeted `tidy-whale-981`) but it is a second cloud Convex reference nobody has audited.

## Requirements

**DEBT-02 — SATISFIED.** Archive exported and verified by reading rows out of it; provenance proven cloud-sourced; deployment deleted; subscription cancelled; the one stale document corrected.

## Self-Check: PASSED

Files confirmed present: `106-03-SUMMARY.md`, `106-DEBT-VERIFICATION.md`, `.planning/AVATAR-HANDOFF.md`, `.planning/ROADMAP.md`, `C:\convex-cloud-archive\tidy-whale-981.zip`, `C:\convex-cloud-archive\tidy-whale-981\`.

Commits confirmed in `git log`: `791d88bd` (Task 1 export), `6e550b64` (Task 2 verification + AVATAR-HANDOFF correction), `bd2e169` (Task 3 cancel handoff).

ROADMAP.md diff accounted for line by line: 3 insertions / 3 deletions, each deletion being a line this plan itself replaced (the 106-03 plan row, the phase progress row 4/8 → 5/8, and the `Last updated` narrative head demoted to `PRIOR:`). No unexplained deletion, no counter regression. `.planning/STATE.md` left untouched and unstaged.
