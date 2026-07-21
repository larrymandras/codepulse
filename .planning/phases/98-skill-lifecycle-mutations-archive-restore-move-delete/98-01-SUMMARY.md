---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
plan: 01
subsystem: api
tags: [convex, forge, skill-lifecycle, mutation, validation]

# Dependency graph
requires:
  - phase: 97-skill-intake-daemon-foundation
    provides: forgeCommands queue (claim/ack/TTL/expiry), Clerk fail-closed enqueue convention, resolveClaimTypes capability negotiation, synthesizeWriteRefusalReport adapter pattern
provides:
  - forgeCommands schema extended with commandType="lifecycle" + lifecyclePayload (migration-free, backward-compatible)
  - enqueueLifecycle mutation — auth-gated, idempotent, LAYER-1 pre-flight refusal (shadow-block, cold-collision, move-collision, delete cold-only)
  - synthesizeLifecycleRefusalReport adapter wired into ackCommand's dispatch
  - listLifecycleCommands scoped query for the future lifecycle command-row UI hook
affects: [98-02-daemon-lifecycle-executor, 98-03-lifecycle-ui-hook-and-menu, 98-04-lifecycle-dialogs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling adapter over shared-adapter edit: synthesizeLifecycleRefusalReport is a standalone function parsing a NEW lifecycle-refused:<kind>: prefix, never touching synthesizeWriteRefusalReport's write-refused:/post-placement-warning: parsing"
    - "Extracted pure decision function (validateLifecyclePreflight) tested directly against an originsForName array, following this repo's established convention of testing DB-handler logic without a live Convex runtime (no convex-test dependency)"
    - "Two-layer validation split by knowability: Convex LAYER-1 only checks what it can resolve from the origin SET (global-scope collisions); project-scope collisions are deferred to the daemon's LAYER-2 filesystem re-check, since Convex cannot resolve a workspaceId to its eventual claude-code:project:<key> origin"

key-files:
  created: []
  modified:
    - convex/schema.ts
    - convex/forge.ts
    - convex/forge.test.ts

key-decisions:
  - "isSafeSkillName is stricter than isSafeSubpath: rejects ANY path separator (not just traversal), since skillName is exactly one directory-name segment that drives a real fs rename/rmSync"
  - "validateLifecyclePreflight only enforces global-destination collisions; project-destination collisions are intentionally left to the daemon LAYER-2 re-check (D-04) because Convex has no way to resolve workspaceId to a project origin key at enqueue time"
  - "kind='collision' is shared between archive (cold-collision) and move (move-target-collision) refusals; the adapter disambiguates house copy by payload.action, not by a second kind value"
  - "delete's cold-only refusal uses a new kind='not-cold' with no UI-SPEC-defined copy; the adapter falls back to the UI-SPEC's generic '{Action} failed: ... Nothing changed on disk.' pattern for any unmapped kind"
  - "LIFE-01..06 traceability NOT marked complete in REQUIREMENTS.md by this plan — this plan ships only the Convex API/backend substrate (Phase 98's 'API/Backend tier' per RESEARCH.md's Architectural Responsibility Map); the daemon executor (98-02) and UI (98-03/04) still need to land before the requirements are genuinely end-to-end satisfied. Matches this repo's own precedent: Phase 97's INTAKE-01..04 remain 'Pending' in REQUIREMENTS.md despite Phase 97 shipping live-verified — completion is marked at full end-to-end delivery, not per-plan."

patterns-established:
  - "Lifecycle command rows follow the exact same forgeCommands row shape (buildLifecycleRow mirrors buildIntakeRow/buildLaunchRow field-for-field) so the daemon's existing claim/ack/TTL machinery needs zero changes to support the new commandType"

requirements-completed: []  # See key-decisions: backend substrate only, not marked complete in REQUIREMENTS.md pending 98-02/03/04

# Metrics
duration: 25min
completed: 2026-07-21
---

# Phase 98 Plan 01: Convex Lifecycle Substrate Summary

**Convex backend for skill lifecycle mutations — `enqueueLifecycle` mutation with shadow/collision/cold-only server-side pre-flight refusal, an `ackCommand` house-copy adapter, and a scoped `listLifecycleCommands` query, all riding the existing `forgeCommands` queue with zero new transport.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-21T20:12:00Z (approx, file-read start)
- **Completed:** 2026-07-21T20:37:00Z
- **Tasks:** 3
- **Files modified:** 3 (`convex/schema.ts`, `convex/forge.ts`, `convex/forge.test.ts`)

## Accomplishments

- `forgeCommands.commandType` gains a `"lifecycle"` literal and a `lifecyclePayload` optional-union field (action-discriminated: archive/restore/move/delete), migration-free — existing launch/stop/intake rows stay schema-valid with zero data migration.
- `enqueueLifecycle` mutation: fail-closed Clerk auth → commandId idempotency → `isSafeSkillName` bare-directory-name guard → LAYER-1 registry pre-flight (shadow-block on restore, cold-collision on archive, move-target collision, cold-only delete) → build+insert. Every refusal throws a `lifecycle-refused:<kind>:` framed error before any row lands.
- `synthesizeLifecycleRefusalReport` composes the exact 98-UI-SPEC house copy (cold-collision, move-target-collision, shadow-block) and is wired into `ackCommand`'s dispatch as a sibling of the existing intake adapter — the intake branch is byte-unchanged.
- `listLifecycleCommands` query, scoped to `commandType="lifecycle"` via the existing compound index, bounded to 30 rows — `listIntakeCommands` is untouched so lifecycle volume can never crowd the intake panel.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend forgeCommands schema, add isSafeSkillName, scaffold failing tests (Wave 0)** — `61378d7` (feat)
2. **Task 2: enqueueLifecycle mutation with LAYER-1 pre-flight validation** — `b4873fb` (feat)
3. **Task 3: ackCommand lifecycle-refusal adapter + listLifecycleCommands query** — `bc63f32` (feat)

_Note: each task is `tdd="true"`; RED scaffolds (`it.todo()` referencing the not-yet-exported symbols by name only, to keep `npx tsc --noEmit` green) were added in Task 1 and upgraded to real, passing tests in the commit that implements the corresponding symbol (Task 2 upgraded the `enqueueLifecycle` scaffolds; Task 3 upgraded the `synthesizeLifecycleRefusalReport`/`listLifecycleCommands` scaffolds). See "TDD Gate Compliance" below._

## Files Created/Modified

- `convex/schema.ts` — `forgeCommands.commandType` union gains `"lifecycle"`; new `lifecyclePayload` optional-union field mirroring `intakePayload`'s backward-compat wrapper exactly.
- `convex/forge.ts` — `isSafeSkillName`, `buildLifecycleRow`, `validateLifecyclePreflight`, `enqueueLifecycle` mutation, `synthesizeLifecycleRefusalReport`, `ackCommand`'s lifecycle dispatch branch, `listLifecycleCommands` query.
- `convex/forge.test.ts` — `isSafeSkillName` unit tests; `validateLifecyclePreflight` unit tests (9 cases covering D-02/D-03/D-05/V5); `buildLifecycleRow` field-mapping test; `enqueueLifecycleMirror` DB round-trip tests (auth, idempotency, name-safety, pre-flight refusal, valid insert × 4 actions) via a new mirror function alongside the existing `claimAndUpsertHostMirror`/`ackCommandMirror` precedent; `synthesizeLifecycleRefusalReport` adapter tests (7 cases); `listLifecycleCommands` scoping/bound tests (2 cases); extended `makeForgeCommandsStore`'s mock query builder with `.order().take()` chaining and extended `ackCommandMirror` with the lifecycle dispatch branch.

## Decisions Made

- **`isSafeSkillName` is stricter than `isSafeSubpath`** — rejects any path separator outright (not just traversal segments), since `skillName` is exactly one directory-name segment that drives a real `fs.rmSync`/rename in the daemon (Plan 98-02), not a validated multi-segment CLI arg.
- **LAYER-1 pre-flight only checks global-destination collisions.** Convex cannot resolve a `workspaceId` to its eventual `claude-code:project:<key>` origin at enqueue time (that mapping is computed by the daemon's registry rescan), so project-destination collision detection for restore/move is intentionally deferred to the daemon's LAYER-2 filesystem re-check, per D-04's "host truth wins over a possibly-stale registry."
- **`kind="collision"` is shared between archive and move refusals**, disambiguated in the adapter by `payload.action` rather than a second kind value — the UI-SPEC's cold-collision and move-target-collision copy are genuinely different strings for the same underlying refusal category.
- **Delete's cold-only refusal uses a new `kind="not-cold"`** with no UI-SPEC-defined copy (the Copywriting Contract only specifies cold-collision/move-collision/shadow-block); the adapter falls back to the UI-SPEC's generic "{Action} failed: ... Nothing changed on disk." pattern for this and any other unmapped kind.
- **LIFE-01..06 are NOT marked complete in REQUIREMENTS.md by this plan.** This plan ships only the Convex API/backend substrate (per RESEARCH.md's Architectural Responsibility Map, this is the phase's "API/Backend tier"); the daemon executor (Plan 98-02) and the UI surface (Plans 98-03/04) still need to land before a user can actually archive/restore/move/delete a skill end-to-end. This matches an existing pattern already visible in this repo: Phase 97's INTAKE-01..04 remain "Pending" in `REQUIREMENTS.md`'s traceability table despite Phase 97 having shipped live-verified — completion appears to be tracked at full end-to-end delivery, not per-plan. Marking these complete now would overstate what a user can do today.
- **`npx convex codegen` required a fresh local admin key** (`docker exec convex-backend ./generate_admin_key.sh`) — the cached one in the environment was stale/invalid (`401 BadAdminKey`). Regenerated and ran codegen against the running `convex-backend` container (the only Convex instance in this topology, per prior session memory); no functional diff resulted since `dataModel.d.ts` derives generically from `schema.ts` and no new exported functions existed yet at that point in Task 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correction of plan's stated test harness] Tests use the repo's actual mock-store convention, not "convex-test"**
- **Found during:** Task 1 read-first (reading `convex/forge.test.ts` in full before writing any test code)
- **Issue:** The plan's `<read_first>`/`<interfaces>` sections describe existing intake tests as using "the convex-test harness" and instruct new tests to "mirror their convex-test harness usage." The actual file explicitly documents (in a comment above `makeForgeCommandsStore`) that `convex-test` is **NOT installed in this repo and must not be added** — all DB-round-trip-style tests use a hand-rolled in-memory mock store + mirror-function pattern (`claimAndUpsertHostMirror`, `ackCommandMirror`, `expireStaleCommandsMirror`), and pure decision logic (auth guards, XOR checks, workspace guards) is tested by extracting the decision function and calling it directly, without any DB mock at all.
- **Fix:** Followed the ACTUAL codebase convention instead of the plan's stated one: `validateLifecyclePreflight` is an extracted pure decision function (tested directly, no DB); `enqueueLifecycleMirror` is a new mirror function alongside the existing three, reusing the existing `makeForgeCommandsStore()` (extended with `.order().take()` chaining for the new `listLifecycleCommands` scoping tests). No `convex-test` dependency was added.
- **Files modified:** `convex/forge.test.ts` (test structure only — no production-code impact)
- **Verification:** `npx vitest run convex/forge.test.ts` — 163 passed, 21 todo (pre-existing baseline), 0 regressions; repo-wide `npx vitest run` — 2249 passed.
- **Committed in:** `61378d7`, `b4873fb`, `bc63f32` (spread across the three task commits as each symbol landed)

---

**Total deviations:** 1 auto-fixed (Rule 1 — corrected a stale plan assumption about the test harness against the live codebase).
**Impact on plan:** No scope creep; the actual test coverage delivered is equivalent to or broader than what the plan's `<behavior>` blocks specified, just implemented via the repo's real testing convention instead of a nonexistent one.

## Issues Encountered

- `npx convex codegen` initially failed with `401 Unauthorized: BadAdminKey` against the local self-hosted backend (`http://127.0.0.1:3210`) — the cached admin key was stale. Resolved by regenerating a fresh key via `docker exec convex-backend ./generate_admin_key.sh` and passing it explicitly with `--admin-key`/`--url`. No production/cloud deployment was touched (this topology's only Convex instance is the local self-hosted `convex-backend` container, per prior session context).

## User Setup Required

None — no external service configuration required. The `npx convex codegen` step ran against the already-running local `convex-backend` container; no new environment variables or manual dashboard steps were introduced.

## Next Phase Readiness

- The Convex API surface Plan 98-02 (daemon executor) needs is fully in place: `forgeCommands` accepts `commandType: "lifecycle"` rows with a fully-typed `lifecyclePayload`, the daemon's `ackCommand` call will have its `lifecycle-refused:<kind>:` errors rewritten to house copy automatically, and the row shape (`buildLifecycleRow`) is byte-compatible with the existing claim/ack/TTL machinery — no daemon-side schema surprises expected.
- Plan 98-03/04 (UI hook + menu/dialogs) can build `useLifecycle.ts` directly against `api.forge.enqueueLifecycle` and `api.forge.listLifecycleCommands` — both are live in this deployment now.
- **Not yet done, and NOT claimed as done:** no daemon anywhere executes a `"lifecycle"` command yet (Plan 98-02), and no UI surface enqueues one yet (Plans 98-03/04) — a real end-to-end archive/restore/move/delete is not possible until those land. LIFE-01..06 traceability is deliberately left "Pending" (see Decisions Made).

---
*Phase: 98-skill-lifecycle-mutations-archive-restore-move-delete*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: convex/schema.ts
- FOUND: convex/forge.ts
- FOUND: convex/forge.test.ts
- FOUND: .planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-01-SUMMARY.md
- FOUND: 61378d7 (Task 1 commit)
- FOUND: b4873fb (Task 2 commit)
- FOUND: bc63f32 (Task 3 commit)
