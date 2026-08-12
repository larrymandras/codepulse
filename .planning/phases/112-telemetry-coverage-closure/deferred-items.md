# Phase 112 — Deferred Items

## From plan 112-04 (2026-08-12): repo-wide defect-class sweep, out-of-scope hits

Per this project's standing verification-discipline instruction ("after fixing a
defect, grep the whole repo for the same defect CLASS... show the full hit list"),
plan 112-04 fixed D-14's `held_reason` null-normalization for `governor_decision`
and applied the same guard to `message_routed`'s `sender`/`session_id`. The defect
class is: **a field forwarded from `convex/runtimeIngest.ts` into a Convex
mutation's `v.optional(v.string())` (or `v.optional(v.float64())`) argument
WITHOUT first passing through `isOptionalString`/`isOptionalNumber` +
`normalizeOptional`** — because a bare `??` coalesce between two sources that are
BOTH explicit JSON `null` (not `undefined`) still yields `null`, which Convex's
`v.optional(...)` validator rejects outright.

The sweep was scoped to `convex/runtimeIngest.ts` itself (the file that receives
untrusted external payloads and forwards them to mutations) rather than every
`v.optional(v.string())` declaration in `convex/` (most of those are populated by
in-app UI mutations, not by this external-ingest forwarding pattern, so they are
not the same defect class). Five further call sites in this same file show the
same UNGUARDED shape. None of these has a live-measured `null` incident behind it
the way `governor_decision`/`held_reason` (424/646 rows) and
`control_verb_swap`/`session_id` (108-07) did — they are latent, not confirmed
live — and fixing them is outside this plan's scope (D-04/D-13/D-14 only, per
`112-04-PLAN.md`'s `files_modified`/`<decided_shapes>`). Logged here rather than
fixed, per the SCOPE BOUNDARY rule.

| # | Location | Field(s) | Target validator | Guard present? |
|---|----------|----------|-------------------|-----------------|
| 1 | `convex/runtimeIngest.ts:1730` (`case "kg_benchmark"`) | `workflowRunUrl: d.workflowRunUrl ?? d.workflow_run_url` | `convex/kgBenchmark.ts:17` `workflowRunUrl: v.optional(v.string())` | No |
| 2 | `convex/runtimeIngest.ts:664-669` (`case "task_quality"`, via the resolver at `~L55-58`) | `idempotencyKey: d.idempotencyKey ?? d.event_id` | `convex/evalScores.ts` `ingestTaskQuality`'s `idempotencyKey: v.optional(v.string())` | No |
| 3 | `convex/runtimeIngest.ts:182-192` (`parseToolPolicyEvent`) | `tool: d.tool`; `sessionId: d.sessionId ?? d.session_id`; `agentId: d.agentId ?? d.agent_id`; `taskCategory: d.taskCategory ?? d.task_category`; `round: d.round`; `field: d.field` | `convex/toolPolicyEvents.ts:17-24` (all `v.optional(v.string())`/`v.optional(v.float64())`) | No (note: the sibling `error` field on the SAME return object IS guarded, via `truncatePolicyError`'s `== null` check — this row's `tool`/`sessionId`/`agentId`/`taskCategory`/`round`/`field` are not) |
| 4 | `convex/runtimeIngest.ts:87-97` (`resolveToolExecutionRow`) | `durationMs: d.durationMs ?? d.duration_ms`; `traceId: d.traceId ?? d.trace_id`; `round: d.round` | `toolExecutions` table (`convex/schema.ts:562-579`): `durationMs: v.optional(v.float64())`, `traceId: v.optional(v.string())`, `round: v.optional(v.float64())` | No |
| 5 | `convex/runtimeIngest.ts:114-131` (`resolveCommandExecutionToolRow`) | `durationMs: d.durationMs ?? d.duration_ms`; `errorMessage: d.errorMessage ?? d.error_message ?? d.error` | same `toolExecutions` table, `durationMs`/`errorMessage: v.optional(v.string())` | No |

**Candidate next step:** a small dedicated gap-closure plan (same shape as 108-07)
that applies `isOptionalString`/`isOptionalNumber` + `normalizeOptional` to all
five, once/if a live measurement confirms any of these emitters actually sends an
explicit `null` on the affected field (the same D-02 "pair every absence claim
with a control" discipline this phase's own D-02/D-03 already established).
