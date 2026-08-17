---
phase: 112-telemetry-coverage-closure
reviewed: 2026-08-13T12:14:50Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - convex/governorDecisions.ts
  - convex/governorDecisions.test.ts
  - convex/governorDecisionsFilters.ts
  - convex/messageRoutes.ts
  - convex/messageRoutes.test.ts
  - convex/retention.ts
  - convex/retention.test.ts
  - convex/runtimeIngest.ts
  - convex/runtimeIngest.test.ts
  - convex/schema.ts
  - convex/telemetryDispositions.ts
  - convex/telemetryDispositions.test.ts
  - src/components/GovernorDecisionLog.tsx
  - src/components/GovernorDecisionLog.test.tsx
  - src/pages/Settings.tsx
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 112: Code Review Report

**Reviewed:** 2026-08-13T12:14:50Z
**Depth:** standard
**Files Reviewed:** 15 (+ tsconfig.json, convex/tsconfig.json, convex/_generated/api.d.ts checked as config/generated, no findings)
**Status:** clean

## Summary

Phase 112 adds two routed domain tables (`governorDecisions`, `messageRoutes`), a
machine-readable disposition record (`telemetryDispositions.ts`), a retention-bound
extension, a read-only UI surface (`GovernorDecisionLog.tsx`), and a compiler
tightening (`noFallthroughCasesInSwitch`). I read every file in scope, traced the
`governor_decision`/`message_routed` resolvers end-to-end (ingest → resolver →
`internalMutation` → schema validator → UI), cross-checked field names against
`astridr-contract.md` §2.16 and §2.40, ran both tsconfigs through `npx tsc --noEmit`
(0 errors each), and ran the full affected Vitest suite (168 tests across 7 files,
all passing) including a live run of `Settings.test.tsx` to confirm no mount-time
regression from wiring in the new component.

Verified specifically, not just assumed:

- **CR-01 boundary held**: `governorDecisions.record` and `messageRoutes.record` are
  both `internalMutation`, unreachable from the public `api.` namespace (confirmed via
  `convex/_generated/api.d.ts`'s `FilterApi` split and the source-level regression
  guards in both test files), and `grep`-confirmed as called from nowhere but
  `runtimeIngest.ts`.
- **D-14's null-normalization class is applied correctly on both new resolvers**:
  `resolveGovernorDecisionEvent`'s `held_reason` and `resolveMessageRoutedEvent`'s
  `sender`/`sessionId` all route through `isOptionalString` → `normalizeOptional`
  before reaching a `v.optional(v.string())` validator, matching the proven
  `control_verb_swap`/`session_id` precedent. Tests cover all three live wire shapes
  (explicit null, key-absent, real string) for `held_reason`, and both null and
  absent for `message_routed`'s two optional fields.
- **`spoke` is checked with `typeof spoke !== "boolean"`, not truthiness** — verified
  a truthy-but-wrong-typed value (`spoke: "true"`) is correctly rejected, both by
  reading the code and by the test asserting exactly that case.
- **Retention bounding (D-06)**: both new tables are present in `RETENTION_DAYS`
  (`governorDecisions: 30`, `messageRoutes: 90`) in the same change that created
  them, and `retention.test.ts` has by-name regression assertions (not just a
  generic "every key is a real table" check) that would catch either entry being
  silently deleted.
- **Drift guard (D-10/D-11)**: `telemetryDispositions.test.ts` parses the live
  `runtimeIngest.ts` dispatch switch and `schema.ts` table set from source (not
  imported codegen) and cross-checks every "routed" entry has a real case + real
  table, every "generic-table-by-design" entry has NO case, and enforces D-03's
  scope-caveat wording via negative source-text assertions. This is a real guard,
  not a self-referential one — I traced the regex boundaries and confirmed they
  can't pass vacuously (Layer 1 explicitly asserts a known-present/known-absent
  control before anything downstream is trusted).
- **Wire-field names match the contract**: `message_routed`'s `channel`/`profile`/
  `sender`/`session_id` and `governor_decision`'s `emitter`/`priority`/`spoke`/
  `held_reason` match `astridr-contract.md` §2.16/§2.40 exactly.
- **`noFallthroughCasesInSwitch` change**: both tsconfigs compile clean (`npx tsc
  --noEmit` from repo root and `npx tsc -p convex/tsconfig.json --noEmit`, both exit
  0), consistent with the commit's own claim of a proven-clean baseline.
- **UI**: `GovernorDecisionLog.tsx` is mounted inside `<SectionErrorBoundary>` in
  `Settings.tsx`, so the already-known "a throwing `useQuery` unmounts the tree"
  hazard is mitigated for this specific mount point. Timestamp math
  (`row.timestamp * 1000`) is correct for the confirmed epoch-seconds unit. Styling
  uses shadcn primitives (`Table`, `Badge`), CSS-var color tokens
  (`text-(--status-ok)`), and Lucide icons only — no hardcoded hex, no ad hoc
  markup.

No Critical or Warning findings survived verification. All reviewed logic is either
correct, defensively guarded, or an accepted/documented tradeoff per the phase's own
decision record.

## What I looked for and could not substantiate (dropped, not reported)

- **Public `listRecent` on `messageRoutes`** (no auth, no rate limit): considered as
  a possible new finding distinct from the governorDecisions instance the task
  pre-cleared, but `messageRoutes.test.ts`'s own docstring and `CLAUDE.md`'s D-SEED-008
  entry establish the same "tailnet is the auth boundary, don't harden one module in
  isolation" decision applies uniformly across all ~215 public mutations/queries in
  this codebase, including this one. Flagging it here would contradict an explicit,
  dated architecture decision rather than surface something new. Confidence it's a
  real *new* issue: low — dropped.
- **`resolveToolExecutionRow`'s `round` field losing its `normalizeOptional` guard**:
  checked because the field is adjacent to phase-112 code; confirmed commit
  `13afcadf` (112-08) already applies `normalizeOptional(d.round)` correctly, with a
  passing three-shape-equivalent test suite. Not a defect.
- **`heldReasonCopy` duplicated between `GovernorDecisionLog.tsx` and
  `InboxCard.tsx`**: diffed both implementations byte-for-byte; behaviorally
  identical (the parameter type differs — `string` vs. a narrower literal union —
  but the schema's `heldReason` field is `v.string()`, not an enum, so the wider
  type in the new copy is arguably more correct, not a defect). The duplication
  itself is an explicitly reasoned, documented decision in the component's own
  docstring, not an oversight. Confidence this is a live quality problem: low —
  dropped per the zero-false-positive standard.
- **`deferred-items.md`'s row #4 going stale** (it still lists `resolveToolExecutionRow`'s
  `round` as unguarded, when commit `13afcadf` fixed it): real drift, but the file is
  a planning artifact, not one of the source files in scope for this review — noted
  here for completeness, not reported as a finding against source code.

---

_Reviewed: 2026-08-13T12:14:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
