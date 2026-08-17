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
| 4 | ~~`convex/runtimeIngest.ts:87-97` (`resolveToolExecutionRow`)~~ **RESOLVED 2026-08-13 — see note below** | `round` FIXED; `durationMs`/`traceId` REFUTED as exposed | `toolExecutions` table: `durationMs: v.optional(v.float64())`, `traceId: v.optional(v.string())`, `round: v.optional(v.float64())` | Yes, for `round` |
| 5 | `convex/runtimeIngest.ts:114-131` (`resolveCommandExecutionToolRow`) | `durationMs: d.durationMs ?? d.duration_ms`; `errorMessage: d.errorMessage ?? d.error_message ?? d.error` | same `toolExecutions` table, `durationMs`/`errorMessage: v.optional(v.string())` | No |

## Corrections to the table above (2026-08-13)

The sweep above was written during 112-04, before three of its entries had been checked against
the **live emitter**. Adversarial verification of 112-04 traced each candidate into
`astridr-repo`'s Python, which changed three verdicts. The rule that produced the corrections:
a `??` chain is exposed only if the **LAST** term arrives as an explicit `null`, because
`null ?? undefined` evaluates to `undefined`. A single unaliased reference has no last term to
fall through to, and is therefore the dangerous shape.

**Row 4 — `round`: CONFIRMED live, and now FIXED.** `astridr/agent/loop.py:2090-2097` sends
`tool_executed` with `"round": get_round_context()` UNCONDITIONALLY, and
`astridr/engine/telemetry.py:683` declares `get_round_context() -> int | None`. `round: d.round`
was a single unaliased reference, so an unset round context rejected the entire `toolExecutions`
insert. **Closed by plan 112-08** (`13afcadf`), which applies `normalizeOptional` and covers all
three wire shapes with a mutation-proven test. Row 4 is struck above.

**Row 4 — `durationMs`/`traceId`: REFUTED, not exposed.** astridr sends only the camelCase key
for each and never `duration_ms`/`trace_id`, so the right-hand side of both coalesces is always
`undefined` and the chain self-heals. Left deliberately unchanged; do not "fix" them.

**`case "llm_call"`: REFUTED, not exposed.** Flagged during verification as a HIGH-severity miss,
then disproven at the emitter: all three providers add `goalId`/`traceId`/`round` only behind
`if ... is not None:` (`anthropic_provider.py:681`, `ollama.py:232`, `openrouter.py:361`), so the
key is absent rather than null, and `session_id`/`cost_usd` are never sent at all. Recorded
because the code shape alone looks identical to a real defect — only the emitter distinguishes them.

**Additional sites found outside this file, still OPEN.** A separate sweep traced live exposures in
sibling ingest routes that use `body.X as Y | undefined` — a compile-time-only cast that never
coalesces `null` at runtime — in `v6Ingest.ts`, `remindersIngest.ts` and `inboxIngest.ts`. These are
worse in blast radius than `runtimeIngest.ts`: they have one outer try/catch per request with no
per-event isolation, so a null-triggered throw loses the ENTIRE write rather than one domain row
alongside a surviving generic-events row. `inboxIngest.ts`'s `heldReason`/`intentId` is the most
severe — the governor's own code comments describe its write as "record everything, unconditional",
and both fields are `None` simultaneously on the ordinary non-held, non-intent path. **Note
`inboxIngest.ts` was being actively edited by a concurrent Phase 115 session; coordinate before
touching it.**

**Candidate next step:** a small dedicated gap-closure plan (same shape as 108-07)
that applies `isOptionalString`/`isOptionalNumber` + `normalizeOptional` to all
five, once/if a live measurement confirms any of these emitters actually sends an
explicit `null` on the affected field (the same D-02 "pair every absence claim
with a control" discipline this phase's own D-02/D-03 already established).
