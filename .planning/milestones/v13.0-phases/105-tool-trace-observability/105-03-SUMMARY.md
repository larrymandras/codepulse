---
phase: 105-tool-trace-observability
plan: 03
subsystem: api
tags: [convex, schema, ingest, toolPolicyEvents, toolExecutions, tool_executed, tool_policy_event, retention]

# Dependency graph
requires:
  - phase: 105-01
    provides: bounded { rows|tools, truncated, cap } reads on toolExecutions/llm that this plan's new Ástríðr volume flows through
  - phase: 105-02
    provides: the widened astridr tool_executed/tool_call_leaked_as_text payloads (durationMs/traceId/round, tool_was_offered/tools_offered_count/round/agentId) this plan's parsers consume
provides:
  - "toolPolicyEvents table (D-05) with by_timestamp + by_event(['event','timestamp']) indexes"
  - "convex/toolPolicyEvents.ts — internalMutation record + recent/lastReceivedAt/countsByKind queries, POLICY_FEED_READ_CAP=200"
  - "runtimeIngest.ts case 'tool_policy_event' — parses all 4 kinds via parseToolPolicyEvent, rejects (null) + console.warn's an unrecognised kind, no switch-level default"
  - "runtimeIngest.ts case 'tool_executed' extended — writes a per-call toolExecutions row (provider: astridr, via ASTRIDR_TOOL_PROVIDER) alongside the unchanged callGraphEdges upsert"
  - "traceId/round join columns on toolExecutions; round on llmMetrics; both persisted end to end (llm_call case, insert/recordCall validators)"
  - "toolPolicyEvents bounded at 90 days from day one (retention.ts)"
affects: [105-04, 105-05, 105-06, 105-07, 105-09]

tech-stack:
  added: []
  patterns:
    - "internalMutation-only writer for a new table reachable solely through the already-Bearer-gated runtimeIngest httpAction (kgBenchmark.recordRun / WR-06 convention)"
    - "Honest-null D-07 pattern: lastReceivedAt returns { timestamp: null } for an empty table, never 0 or Date.now() — distinguishes 'never received' from 'received a while ago'"
    - "Reject-and-log, not catch-all: parseToolPolicyEvent returns null for an unrecognised kind and the caller console.warns; the switch itself keeps no default arm so a fifth future kind's absence stays visible, not masked"
    - "Receiver-assigned provider tag (ASTRIDR_TOOL_PROVIDER), never read from the payload — same D-02/T-105-12 shape as 105-01's excludeByProvider"

key-files:
  created:
    - convex/toolPolicyEvents.ts
    - convex/toolPolicyEvents.test.ts
    - .planning/phases/105-tool-trace-observability/deferred-items.md
  modified:
    - convex/schema.ts
    - convex/toolExecutions.ts
    - convex/toolExecutions.test.ts
    - convex/llm.ts
    - convex/llm.test.ts
    - convex/runtimeIngest.ts
    - convex/runtimeIngest.test.ts
    - convex/retention.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "F5 confirmed: no backfill mutation exists or was added anywhere in this plan. Existing toolExecutions rows have no traceId/round/Ástríðr provenance to backfill from, and toolPolicyEvents had literally nothing stored before this plan (the whole point of D-05) — there is nothing to backfill FROM. D-04's aggregates (plan 105-04) start from now."
  - "Two Rule-1 comment-trips-own-grep fixes (same class 105-01/105-02 both hit): schema.ts's traceId/round doc comment used the literal word 'round' in prose, tripping its own acceptance grep to 2 instead of 1 — reworded to 'turn-number'. runtimeIngest.ts's tool_policy_event comment used the literal text 'switch-level `default:`' explaining why one wasn't added, which tripped the acceptance criterion requiring zero 'default:' matches in the whole file — reworded to avoid the substring while keeping the same explanation."
  - "schema.ts's diff initially landed at 47 changed lines against the plan's <45 acceptance ceiling (additive-only check) — trimmed the toolPolicyEvents doc comment from a 15-line block to a 7-line one without losing any of the required D-05/D-06/kind-shape content; final diff is 38 lines."
  - "Strengthened the toolsOfferedCount 0-vs-undefined test (Rule 2 — closing a gap the plan's own required mutation proof surfaced): the first draft only set the snake_case field (tools_offered_count: 0) with the camelCase field absent, which passes identically under both `??` and `||` (undefined || 0 === 0). Added a second case that sets the camelCase PRIMARY field to 0 (toolsOfferedCount: 0) with the fallback absent — this is the only shape where `??` and `||` diverge (0 is falsy, so `||` would fall through to the missing fallback and lose the real 0). Mutation-verified: the new test fails under `||`, the original one does not."
  - "Enumerated all 41 event kinds documented in docs/astridr-contract.md §2.1-2.41 against runtimeIngest.ts's ~65 switch case labels (verification-discipline requirement to prove the tool_policy_event class is genuinely closed, not moved one level up). Result: 11 contract-documented kinds still have no domain-specific case (message_routed, instructions_loaded, loop_lifecycle, worktree_lifecycle, batch_execution, auto_memory, prompt_assembly, structured_output_exhausted, vision.capture, control_verb_swap, control_verb_focus, governor_decision) — but this is NOT the same defect as pre-105-03 tool_policy_event: every event, regardless of switch coverage, is first written to the generic runtime_events table via the unconditional api.events.insertEvent call that runs BEFORE the switch, and legacyEventData() passes all fields through unchanged for every eventType except graph_snapshot. So these 11 kinds are captured and bounded by the existing 14-day runtime_events retention, just not queryable through a structured domain table or surfaced in the UI. Logged to deferred-items.md per the Scope Boundary rule (none are named in this plan's files_modified/objective/threat_model) rather than fixed inline."
  - "The switch genuinely has ZERO 'default:' arms after this plan (grep count 0) — confirmed both before adding the tool_policy_event case (there was none) and after (still none), so the specific defect this plan targets (an unrecognised event silently vanishing with no trace) does not exist one level up inside the new case itself: the else branch explicitly console.warns the rejected event value."

requirements-completed: []  # OBS-01/02/03 NOT marked complete — this is plan 3/9 (Convex substrate only, Wave 2). Per this project's established "green suite/single-plan != live-verified end-to-end" convention (Phase 104 precedent, and 105-02's own SUMMARY), full requirement satisfaction is deferred until the phase's live-verification plan (105-09) confirms the whole pipe end to end against the running self-hosted instance.

duration: 35min
completed: 2026-08-03
---

# Phase 105 Plan 03: Convex Substrate — toolPolicyEvents Table + tool_executed/tool_policy_event Ingest Summary

**New `toolPolicyEvents` table (internalMutation-gated writer, 4 honest queries) plus a `tool_policy_event` ingest case that parses and stores all 4 Ástríðr policy-event kinds instead of silently discarding them; `tool_executed` now also writes a per-call `toolExecutions` row tagged `provider: "astridr"` alongside the unchanged `callGraphEdges` upsert — nothing deployed to the live self-hosted instance.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-03T23:12:00Z (approx, first file read)
- **Completed:** 2026-08-03T23:47:31Z
- **Tasks:** 3 (all `type="auto"`, Tasks 2 and 3 `tdd="true"`)
- **Files modified:** 12 (9 modified, 3 created)

## Accomplishments

- New `convex/toolPolicyEvents.ts`: `record` (`internalMutation`, reachable only through the Bearer-gated `runtimeIngest` httpAction — WR-06 convention), `recent` (bounded + optional per-kind filter via `by_event`), `lastReceivedAt` (D-07: `{ timestamp: null }` for an empty table, never a fabricated `0`/`Date.now()`), and `countsByKind` (windowed tally, every one of the 4 kinds zero-filled so a missing key never means "unknown")
- New `toolPolicyEvents` schema table with `by_timestamp` + compound `by_event(["event","timestamp"])` indexes; `traceId`/`round` added to `toolExecutions` plus a `by_provider_time` index for the Tools page's default Ástríðr-only drill-down (105-06); `round` added to `llmMetrics`
- `runtimeIngest.ts` gained `case "tool_policy_event"`: `parseToolPolicyEvent` maps all 4 kinds (dual snake/camel coalescing per field, since Ástríðr genuinely sends `tool_was_offered`/`tools_offered_count` in snake_case while sending `sessionId`/`taskCategory` in camelCase), truncates `error` at 500 chars with an explicit `... [truncated]` marker, rejects (`null`) an unrecognised/absent `event` value, and the case's `else` branch `console.warn`s the rejected value rather than silently dropping it — no switch-level `default:` was added (F1: a catch-all here would mask a fifth future kind's absence the exact same way)
- `case "tool_executed"` extended: after the existing `callGraphEdges.upsertEdge` call (unchanged, still the Tool Galaxy feed), an unconditional `api.toolExecutions.insert` call now writes a per-call row via `resolveToolExecutionRow`, tagged `provider: ASTRIDR_TOOL_PROVIDER` — a constant assigned by the receiver, never read from the payload (T-105-12)
- `case "llm_call"` passes `round` through to `api.llm.recordCall`; `toolExecutions.insert` and `llm.recordCall` both widened to accept and persist `traceId`/`round`
- `toolPolicyEvents: 90` added to `retention.ts`'s build/history tier — the table is bounded from the same commit that creates it, matching Phase 104 D-20's `gatewayQuotaSnapshots` precedent (never a later mass delete)
- Regenerated `convex/_generated/api.d.ts` via `npx convex codegen` (offline binding regeneration, confirmed per this project's established precedent that this step does not modify the code running on the live deployment — see Decisions/Verification below)
- 44 new test assertions across `convex/toolPolicyEvents.test.ts` (13), `convex/runtimeIngest.test.ts` (18, including 2 static-source regression guards), `convex/llm.test.ts` (3), and `convex/toolExecutions.test.ts` (2) — every new/changed test mutation-verified against production/mirror logic before commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema — toolPolicyEvents table, plus traceId/round join columns** — `da43287a` (feat)
2. **Task 2: convex/toolPolicyEvents.ts + widen the two existing mutation validators** — `ba97dcb8` (feat)
3. **Task 3: Ingest — extend tool_executed, add the tool_policy_event case, add retention** — `833299d3` (feat)

## Files Created/Modified

- `convex/schema.ts` — new `toolPolicyEvents` table (`by_timestamp` + `by_event`); `traceId`/`round`/`by_provider_time` on `toolExecutions`; `round` on `llmMetrics`
- `convex/toolPolicyEvents.ts` — NEW. `record` internalMutation; `recent`/`lastReceivedAt`/`countsByKind` queries; `POLICY_FEED_READ_CAP = 200` exported
- `convex/toolPolicyEvents.test.ts` — NEW. 13 tests covering every `<behavior>` bullet (empty-table honesty, event filtering, cap bounding, zero-fill)
- `convex/toolExecutions.ts` — `insert` accepts `traceId`/`round`
- `convex/toolExecutions.test.ts` — 2 new tests: `traceId`/`round` persistence + omission
- `convex/llm.ts` — `recordCall` accepts `round`, added to the handler's explicit field list (not just the validator — the handler enumerates fields rather than spreading `args`)
- `convex/llm.test.ts` — 3 new tests: `round` persistence, `round: 0` survives, omission
- `convex/runtimeIngest.ts` — `ASTRIDR_TOOL_PROVIDER`, `resolveToolExecutionRow`, `TOOL_POLICY_EVENT_KINDS`, `TOOL_POLICY_ERROR_MAX_LEN`, `parseToolPolicyEvent` (all exported for testing, placed beside the existing `resolveGatewayTaskCompleted`); `case "tool_executed"` extended; `case "llm_call"` gains `round`; new `case "tool_policy_event"`
- `convex/runtimeIngest.test.ts` — 18 new tests across two `describe` blocks (`tool_executed → toolExecutions`, `tool_policy_event`), including 2 static-source regression guards (proving `case "tool_executed"` still calls both `api.callGraphEdges.upsertEdge` and the new `api.toolExecutions.insert`; proving `case "tool_policy_event"` calls `internal.toolPolicyEvents.record` and the file has zero `default:` arms)
- `convex/retention.ts` — `toolPolicyEvents: 90` added to the build/history tier
- `convex/_generated/api.d.ts` — regenerated (`npx convex codegen`) so `api.toolPolicyEvents.*` type-resolves; confirmed via `grep -c toolPolicyEvents convex/_generated/api.d.ts` returning `2`
- `.planning/phases/105-tool-trace-observability/deferred-items.md` — NEW. The 11-event-kind switch-coverage gap found while closing the `tool_policy_event` class (see Decisions)

## Decisions Made

See the `key-decisions` list in the frontmatter for the full text of each decision (F5 no-backfill, the two comment-trips-own-grep Rule-1 fixes, the schema line-count trim, the `toolsOfferedCount` test-strengthening, the 41-event-kind class-closure audit, and the zero-`default:` confirmation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `schema.ts`'s own doc comment tripped its own acceptance-criteria grep**
- **Found during:** Task 1, running the acceptance-criteria greps before commit
- **Issue:** The `traceId`/`round` doc comment on `toolExecutions` used the literal word "round" in prose ("per-call trace/round join keys"), making `grep -A 20 "toolExecutions: defineTable" | grep -c "round"` return 2 instead of the plan's required 1.
- **Fix:** Reworded to "trace/turn-number join keys" — same meaning, no literal substring collision.
- **Files modified:** convex/schema.ts
- **Verification:** Re-ran the grep, returns 1.
- **Committed in:** `da43287a`

**2. [Rule 1 - Bug] `schema.ts`'s diff exceeded the plan's 45-line additive-only ceiling**
- **Found during:** Task 1, `git diff --stat` check
- **Issue:** The initial `toolPolicyEvents` doc comment block was 15 lines, pushing the total diff to 47 changed lines against the plan's stated `<45` acceptance criterion.
- **Fix:** Condensed the same D-05/D-06/kind-shape content into a 7-line block without dropping any required information (the 4 kinds, their fields, and the pre-105 silent-drop context).
- **Files modified:** convex/schema.ts
- **Verification:** `git diff --stat convex/schema.ts` now shows 38 changed lines.
- **Committed in:** `da43287a`

**3. [Rule 1 - Bug] `runtimeIngest.ts`'s own comment tripped the "zero `default:` arms" acceptance criterion**
- **Found during:** Task 3, running the acceptance-criteria greps before commit
- **Issue:** The `tool_policy_event` case's explanatory comment used the literal text "switch-level `default:`" to explain why no catch-all was added — which is itself a match for `grep -c "default:"`, making the count 1 instead of the required 0.
- **Fix:** Reworded to "a catch-all fallback arm on the switch itself" — same explanation, no literal `default:` substring.
- **Files modified:** convex/runtimeIngest.ts
- **Verification:** `grep -c "default:" convex/runtimeIngest.ts` returns 0.
- **Committed in:** `833299d3`

**4. [Rule 2 - Missing Critical] Strengthened the `toolsOfferedCount: 0` test to actually catch a `??`→`||` regression**
- **Found during:** Task 3, mutation-verifying the new tests (mutated `??` to `||` on `toolsOfferedCount`'s coalescing line)
- **Issue:** The first-draft test set only the snake_case field (`tools_offered_count: 0`) with the camelCase field absent. Under this exact fixture, `??` and `||` produce the identical result (`undefined ?? 0` and `undefined || 0` both evaluate to `0`), so mutating `??` to `||` left the test green — a vacuous test for the specific bug class the plan's `<behavior>` bullet warns about.
- **Fix:** Added a second test asserting `toolsOfferedCount: 0` set on the PRIMARY camelCase field (with the snake_case fallback absent) survives parsing — this is the only shape where the two operators diverge (`0 || undefined` degrades to `undefined`, losing the real zero).
- **Files modified:** convex/runtimeIngest.test.ts
- **Verification:** Mutating `??` to `||` now fails the new test (`expected undefined to be +0`) while the original snake_case test stays green, confirming the new assertion is the one that actually catches this class of regression.
- **Committed in:** `833299d3`

---

**Total deviations:** 4 auto-fixed (3 Rule 1 — comment-text/acceptance-criteria collisions introduced by this plan's own new code, matching the exact class 105-01 and 105-02 both independently hit; 1 Rule 2 — closing a real test-vacuity gap found during the plan's own mandatory mutation-verification step). No production-behavior deviations from the plan's specified approach.

## Mutation Verification (required proof)

Every new/changed test was mutation-verified — production code temporarily broken, confirmed the corresponding test FAILS, then restored via a scratchpad byte-identical diff before re-running. All of these ran against `convex/runtimeIngest.ts`, `convex/toolPolicyEvents.test.ts`, `convex/llm.test.ts`, and `convex/toolExecutions.test.ts`:

| Mutation | Target | Result |
|---|---|---|
| **Plan's own required proof:** `parseToolPolicyEvent` accepts an unknown kind (drops the `TOOL_POLICY_EVENT_KINDS` membership check) | "returns null for an unrecognised event value" | FAILED as required — returned the object instead of `null` |
| `resolveToolExecutionRow`'s `provider` read from `d.provider` instead of the constant | "always tags provider: astridr, never read from the payload (T-105-12)" | FAILED as required |
| `toolsOfferedCount`'s `??` changed to `||` | New camelCase-primary-field-is-0 test | FAILED as required (`expected undefined to be +0`) — the ORIGINAL snake_case-only test stayed green under the same mutation, which is why the stronger test was added (Deviation #4) |
| `case "tool_executed"`'s `api.toolExecutions.insert` call removed | D-01 static-source regression guard | FAILED as required (`toContain` assertion) |
| `case "tool_policy_event"`'s `internal.toolPolicyEvents.record` call removed | D-05/D-06 static-source regression guard | FAILED as required |
| `error` truncation logic removed entirely | (checked, not committed as a separate row — see below) | FAILED as required |
| `lastReceivedAt` mirror hardcoded to return `0` instead of `null` for an empty store | "returns timestamp: null for an empty table" | FAILED as required |
| `recentLogic` mirror's `truncated` hardcoded to `false` | "bounds the read at the exported cap..." | FAILED as required |
| `countsByKindLogic` mirror's zero-fill loop removed | "zero-fills all 4 kinds when the table is empty" + 2 others | 3 tests FAILED as required |
| `recordCallLogic`/`insertLogic` mirrors dropped `round`/`traceId` from the insert | 4 persistence tests across `llm.test.ts`/`toolExecutions.test.ts` | FAILED as required |

All production files were restored to their pre-mutation state and diffed byte-identical (via a scratchpad backup, since these files carry uncommitted work between tasks) before proceeding.

## Class-Closure Audit (verification-discipline requirement)

Enumerated every event kind `docs/astridr-contract.md` §2.1–§2.41 documents (41 kinds) against `runtimeIngest.ts`'s ~65 switch case labels. Result:

- **30 kinds have a matching domain-specific `case`** (including the 4 `tool_policy_event` subtypes newly routed by this plan, discriminated by `data["event"]`, not by the switch's `eventType`).
- **11 kinds have no domain-specific `case`**: `message_routed`, `instructions_loaded`, `loop_lifecycle`, `worktree_lifecycle` (a differently-named `worktree_event` case exists; whether it's the same event under an old name was not investigated), `batch_execution`, `auto_memory`, `prompt_assembly` (contract doc claims routing to `api.promptAssembly.record`, but no such module exists in this repo — pre-existing doc/code drift), `structured_output_exhausted`, `vision.capture`, `control_verb_swap`, `control_verb_focus`, `governor_decision`.
- **The switch has zero `default:` arms**, confirmed both before this plan (there was none) and after (still none — `grep -c "default:" convex/runtimeIngest.ts` → `0`).

**Is this the same defect one level up? No.** The unconditional `api.events.insertEvent` call at the top of the per-event loop — which runs for EVERY event regardless of switch coverage — already persists all 11 gap kinds' full field data into the generic `runtime_events` table (`legacyEventData()` passes fields through unchanged for every `eventType` except `graph_snapshot`, verified by reading `convex/ingestSummary.ts`). So these 11 kinds are captured and bounded by the existing 14-day `runtime_events` retention; they simply lack a structured, indexed, per-kind domain table and UI surfacing — the same class of gap `tool_policy_event` had, but a strictly lesser severity (no raw data loss, unlike `tool_policy_event` before this plan, which this task confirmed had literally zero case AND was never captured with any structure). None of the 11 are in this plan's `files_modified`/objective/threat_model; logged to `.planning/phases/105-tool-trace-observability/deferred-items.md` per the Scope Boundary rule rather than fixed inline.

Within the new `case "tool_policy_event"` itself, the equivalent risk (an unrecognised 5th kind silently vanishing) is closed: `parseToolPolicyEvent` returns `null` for anything outside `TOOL_POLICY_EVENT_KINDS`, and the case's `else` branch `console.warn`s the rejected value rather than dropping it with no trace.

## Issues Encountered

None beyond the four documented deviations above (all either same-class-as-prior-plans acceptance-criteria/comment collisions, or a test-strengthening exercise triggered by the plan's own mandated mutation proof).

## User Setup Required

None — no external service configuration required. `npx convex codegen` was run (offline binding regeneration only) to pick up `api.toolPolicyEvents.*`; **no `npx convex deploy`, no `npx convex import`, no bulk delete/patch, and no schema push against the live self-hosted instance was run in this plan.** Deployment remains plan 105-09's step, per the plan's explicit `<verification>` instruction and this project's CLAUDE.md self-hosted-Convex operational rules.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0 (checked after every task and again after the final `npx convex codegen` regeneration).

`npx vitest run` (full suite):
```
Test Files  266 passed | 17 skipped (283)
     Tests  3263 passed | 193 todo (3456)
```
(The "Not implemented: HTMLCanvasElement's getContext()" lines in the output are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files, not a failure — 0 failed tests.)

`npm run build` — succeeded (`✓ built in 1.22s`); pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- `grep -c "toolPolicyEvents: defineTable" convex/schema.ts` → `1`
- `grep -A 20 "toolPolicyEvents: defineTable" convex/schema.ts | grep -c 'index("by_event", \["event", "timestamp"\])'` → `1`
- `grep -A 20 "toolExecutions: defineTable" convex/schema.ts | grep -c "traceId"` → `1`; same for `"round"` → `1`
- `grep -A 26 "llmMetrics: defineTable" convex/schema.ts | grep -c "round: v.optional"` → `1`
- `git diff --stat convex/schema.ts` → 38 changed lines (< 45)
- `grep -c "internalMutation" convex/toolPolicyEvents.ts` → `3`; `grep -c "^export const record = mutation" convex/toolPolicyEvents.ts` → `0`
- `grep -c "round: args.round" convex/llm.ts` → `1`
- `grep -c "traceId: v.optional" convex/toolExecutions.ts` → `1`
- `grep -c 'case "tool_policy_event"' convex/runtimeIngest.ts` → `1`
- `grep -c "default:" convex/runtimeIngest.ts` → `0`
- `grep -c "internal.toolPolicyEvents.record" convex/runtimeIngest.ts` → `2`
- `sed` extraction of `case "tool_executed"` body contains both `api.callGraphEdges.upsertEdge` and `api.toolExecutions.insert` → `1` each
- `grep -c "ASTRIDR_TOOL_PROVIDER" convex/runtimeIngest.ts` → `2`
- `grep -v '^\s*//' convex/retention.ts | grep -c "toolPolicyEvents: 90"` → `1`
- `grep -c toolPolicyEvents convex/_generated/api.d.ts` → `2`
- `git diff --stat package.json package-lock.json` → empty (T-105-SC: zero packages installed)

## Next Phase Readiness

- Plan 105-04 (aggregates/D-04) can now read `toolExecutions` rows with `provider: "astridr"` for "over time" tool-usage history, and `toolPolicyEvents` for policy-event trend buckets — both tables exist, are bounded by retention, and have real (test-verified, not yet live-verified) write paths.
- Plan 105-05 (trace-waterfall nesting) can now join `toolExecutions.traceId`/`round` against `llmMetrics.traceId`/`round` — both fields exist end to end from ingest through storage.
- Plan 105-06 (Tools page) can read `toolPolicyEvents.recent`/`lastReceivedAt`/`countsByKind` and `toolExecutions` filtered/sorted by `provider`/`by_provider_time`.
- Plan 105-07 (policy feed UI) has a real backend to read from: `recent`, `lastReceivedAt` (D-07 honesty), `countsByKind`.
- **Nothing has been deployed.** The live self-hosted Convex instance still runs pre-105-03 code; `toolPolicyEvents` does not yet exist there and `tool_executed`/`tool_policy_event` events arriving in the interim continue to be handled exactly as they were before this plan (captured in `runtime_events`, `tool_policy_event` never routed to a domain table) until plan 105-09 deploys.
- The 11-event-kind switch-coverage gap (Class-Closure Audit above) is logged in `deferred-items.md` for a future phase/backlog item — not blocking, not touched.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 6 spot-checked key files confirmed present on disk (`convex/toolPolicyEvents.ts`,
`convex/toolPolicyEvents.test.ts`, `.planning/phases/105-tool-trace-observability/deferred-items.md`,
`convex/schema.ts`, `convex/runtimeIngest.ts`, `convex/retention.ts`); all 3 task commit
hashes (`da43287a`, `ba97dcb8`, `833299d3`) confirmed present in git log.
