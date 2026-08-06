---
phase: 103-brain-swap-control-surface
plan: 02
subsystem: database
tags: [convex, schema, ingest, brain-swap, reactive-read, self-hosted-convex]

# Dependency graph
requires:
  - phase: 103-01
    provides: "103-CONTRACT.md §4 (model_routing event field names) that this plan's ingest case implements"
provides:
  - "convex/schema.ts — activeEngineSnapshots table (profileId/model/mode/selectionPath/expiresAt/timestamp, by_profileId + by_timestamp indexes), deployed live on the self-hosted instance"
  - "convex/activeEngine.ts — deduplicateByProfile (pure, unit-tested), latestByProfile (bounded reactive query), recordRouting (append-only ingest-only write)"
  - "convex/runtimeIngest.ts case \"model_routing\" — dual snake/camelCase ingest case routing astridr's model_routing telemetry into activeEngineSnapshots"
affects: [103-03, 103-06, 103-07, 103-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Latest-per-key reactive table (deduplicateByProfile / latestByProfile) — a straight rename of gatewayQuota.ts's deduplicateByProvider / latestByProvider pattern, applied to the profile axis"
    - "Public mutation (not internalMutation) as the ingest write target, matching runtimeIngest.ts's existing api.X.y call convention for sibling cases (profile_config, provider_health)"

key-files:
  created:
    - convex/activeEngine.ts
    - convex/activeEngine.test.ts
  modified:
    - convex/schema.ts
    - convex/runtimeIngest.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "activeEngineSnapshots kept structurally separate from profileConfigs — D-03/D-14 boundary: this table holds only the live-resolved engine (telemetry-owned), never the persisted default (Ástríðr-owned, mirrored in profileConfigs.modelPreferences)"
  - "No configChanges audit row written from activeEngine.ts — that audit belongs to the persisted-default write path in profiles.upsertConfig; duplicating it here would conflate the two axes"
  - "recordRouting is a public mutation (not internalMutation), matching how runtimeIngest.ts calls every other sibling case (api.profiles.upsertConfig, api.providerHealth.upsert), not gatewayQuota.ts's internalAction-only precedent"
  - "mode kept as v.string() in the schema (not a Literal union) per this schema's defensive-boundary convention — the session/pinned/inherited vocabulary is validated at the ingest edge, not enforced by Convex's type system"

patterns-established:
  - "Per-profile reactive telemetry axis, structurally isolated from the per-profile persisted-config axis (profileConfigs) — the pattern later per-profile Convex tables in this phase should follow"

requirements-completed: []  # BSC-01 intentionally NOT marked complete — see Decisions Made below

# Metrics
duration: ~20min (Tasks 1+3; Task 2 was a human-action checkpoint, deploy performed by the user)
completed: 2026-07-28
---

# Phase 103 Plan 02: Convex Reactive Substrate for Per-Profile Active Engine Summary

**Built and deployed the `activeEngineSnapshots` Convex table + `activeEngine.ts` (latest-per-profile dedup query, append-only ingest mutation) on the live self-hosted instance, and wired astridr's existing `model_routing` telemetry event into it via a new `runtimeIngest.ts` case — the reactive substrate BSC-01's per-profile axis reads from.**

## Performance

- **Duration:** ~20 min of agent execution (Tasks 1 and 3); Task 2 was a blocking human-action checkpoint where the user ran the live schema deploy
- **Started:** 2026-07-28T10:29:27-04:00 (Task 1 commit)
- **Completed:** 2026-07-28T10:43:39-04:00 (Task 3 commit)
- **Tasks:** 3/3 completed (1 auto, 1 checkpoint:human-verify, 1 auto)
- **Files modified:** 2 created (`convex/activeEngine.ts`, `convex/activeEngine.test.ts`), 3 modified (`convex/schema.ts`, `convex/runtimeIngest.ts`, `convex/_generated/api.d.ts`)

## Accomplishments
- `activeEngineSnapshots` table added to `convex/schema.ts` — a pure additive change (`git diff` showed 25 insertions, 0 deletions), modeled field-for-field on `gatewayQuotaSnapshots`, with `by_profileId`/`by_timestamp` indexes.
- `convex/activeEngine.ts` ships `deduplicateByProfile` (exported pure helper, unit-tested in isolation), `latestByProfile` (bounded `take(200)` reactive query over `by_timestamp` descending, never `.collect()`), and `recordRouting` (append-only insert mutation, explicitly documented as ingest-only per D-14).
- **[BLOCKING] schema push completed live** — the user ran `npx convex deploy --yes` against the self-hosted instance at `http://127.0.0.1:3210` and confirmed the table and function resolve for real, not just in generated TypeScript types:
  ```
  ✔ No indexes are deleted by this push
  Schema validation complete.
  ✔ Added table indexes:
    [+] activeEngineSnapshots.by_profileId   profileId, timestamp, _creationTime
    [+] activeEngineSnapshots.by_timestamp   timestamp, _creationTime
  ✔ Deployed Convex functions to http://127.0.0.1:3210

  npx convex run activeEngine:latestByProfile
  []
  ```
  This closes the false-positive-verification gap the plan's own Task 2 `<what-built>` text called out: every downstream reactive-path claim in Plans 103-03/06/07/08 is now backed by a real, live table, not merely generated types.
- `case "model_routing"` added to `runtimeIngest.ts`'s existing ~40-case event switch (no second ingest endpoint), following the identical dual snake/camelCase coalescing convention as its `profile_config`/`provider_health` neighbors, routing into `api.activeEngine.recordRouting`.
- `convex/activeEngine.test.ts` — 5 tests, all green: latest-per-profile dedup across two profiles, single-profile-multiple-snapshots collapse, empty-input-never-undefined, and the two-profile/two-distinct-model "Mixed brains" precondition fixture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the activeEngineSnapshots table and convex/activeEngine.ts** - `c3180f12` (feat)
2. **Task 2: [BLOCKING] Push the Convex schema to the live self-hosted instance** - human-action checkpoint, no code commit (deploy performed directly against the live instance by the user; see "Checkpoint" below)
3. **Task 3: Wire the model_routing ingest case and test the dedup path** - `a10c8b0b` (test — also carries the `convex/_generated/api.d.ts` regeneration produced by Task 2's live deploy)

_No separate plan-metadata commit issued for code — this SUMMARY + STATE/ROADMAP updates are committed together per the final_commit step below._

## Checkpoint: Task 2 (human-action)

Per this session's `<checkpoint_notice>` and `CLAUDE.md` §"Self-Hosted Convex — Operational Rules," the schema push against the production self-hosted Convex instance was surfaced as a blocking human-action checkpoint rather than run by the agent. The user ran:

```
npx convex deploy --yes
npx convex run activeEngine:latestByProfile
```

and confirmed: an additive-only deploy (no index/table deletions), and `activeEngine:latestByProfile` returning `[]` — proving the table and function are genuinely live on `http://127.0.0.1:3210`, not merely present in generated types. En route, a stale `CONVEX_SELF_HOSTED_ADMIN_KEY` in `codepulse\.env.local` (relative to `C:\Users\mandr\convex-selfhost\admin-key.txt`) caused an initial 401; the user updated `.env.local` and the deploy then succeeded. This also reconfirms `npx convex deploy` from this repo targets the local self-hosted backend, not any cloud deployment.

No `import --replace-all`, bulk delete, or bulk patch was run — this was a pure additive table creation, consistent with the plan's HARD PROHIBITIONS.

## Files Created/Modified
- `convex/schema.ts` — added `activeEngineSnapshots` table (additive only)
- `convex/activeEngine.ts` — `deduplicateByProfile`, `latestByProfile`, `recordRouting`
- `convex/activeEngine.test.ts` — 5 unit tests for the dedup helper
- `convex/runtimeIngest.ts` — added `case "model_routing"` to the existing event switch
- `convex/_generated/api.d.ts` — regenerated module registration for `activeEngine` (produced by the Task 2 live deploy; tracked in this repo, committed alongside Task 3 per this repo's existing convention of committing generated files when they change)

## Decisions Made

- **BSC-01 intentionally left unmarked in REQUIREMENTS.md.** This plan ships only the Convex-side reactive substrate — no UI component consumes `latestByProfile` yet (that's Plans 103-06/103-07). BSC-01's wording ("live view of the current reasoning engine... reactive from Convex/telemetry") is an operator-facing requirement; the backend piece alone doesn't satisfy it. This matches this project's established precedent (Phase 103 Plan 01's own BSC-02/BSC-05 deferral, and Phases 98/99/100/101 generally) of deferring requirement completion to full end-to-end delivery, not per-plan code-completion. No `gsd-sdk requirements.mark-complete` call was made.
- **`recordRouting` built as a public `mutation`, not `internalMutation`** — the plan explicitly asked to check `runtimeIngest.ts`'s existing call convention and match it; every sibling case in that switch (`api.profiles.upsertConfig`, `api.providerHealth.upsert`, `api.episodic.recordEvent`) calls a public mutation via `api.X.y`, not `internal.X.y`. `gatewayQuota.ts`'s `internalMutation` precedent is a different pattern (called from an `internalAction`, not from the ingest switch) and was correctly not followed here.
- **No `configChanges` audit row in `activeEngine.ts`** — per the plan's explicit instruction and D-03/D-14, that audit trail belongs exclusively to the persisted-default write path in `profiles.upsertConfig`. Verified via `grep -c 'configChanges' convex/activeEngine.ts` = 0.
- **`convex/_generated/api.d.ts` committed alongside Task 3**, not Task 1 — the regeneration was produced by Task 2's live deploy (which ran between Task 1's and Task 3's commits), so it naturally landed in the Task 3 commit rather than being backdated into Task 1.

## Deviations from Plan

None — plan executed exactly as written. Task 2's checkpoint was handled per the plan's own `gate="blocking"` designation and this session's explicit `<checkpoint_notice>`, not treated as an auto-approvable checkpoint.

## Issues Encountered

None in the agent-executed tasks. The human-action checkpoint (Task 2) surfaced one real-world hiccup (stale `CONVEX_SELF_HOSTED_ADMIN_KEY` in `.env.local` causing an initial 401), resolved by the user updating the key before the deploy succeeded — not an agent-side issue, documented here for continuity.

## User Setup Required

None further — the one external dependency this plan had (the live schema push) was completed as the Task 2 checkpoint, verified live.

## Next Phase Readiness

- The reactive per-profile active-engine table is live on the self-hosted Convex instance and safe to build against — Plans 103-03 (per-profile picker), 103-06/103-07 (header badge / Settings row / composer pill), and 103-08 (live-stack verification) can now consume `api.activeEngine.latestByProfile` for real, not against a merely-typed table.
- No blockers. The one open item carried forward from 103-CONTEXT.md remains unchanged: Ástríðr Phase 184.1 must actually emit a profile-scoped `model_routing` event before this table receives real (non-empty) rows — until then, `latestByProfile` will correctly and honestly return `[]`.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: `convex/activeEngine.ts`
- FOUND: `convex/activeEngine.test.ts`
- FOUND: `.planning/phases/103-brain-swap-control-surface/103-02-SUMMARY.md`
- FOUND commit `c3180f12` in `git log --oneline --all`
- FOUND commit `a10c8b0b` in `git log --oneline --all`
- `grep -c 'activeEngineSnapshots' convex/schema.ts` = 1
