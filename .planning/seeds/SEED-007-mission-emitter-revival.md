---
id: SEED-007
status: dormant
planted: 2026-08-10
planted_during: v14.0 / Phase 111 (Mission Board scope narrowing)
trigger_when: the astridr emitter resumes writing subagent_job events with real submittedAt/queued/running states, OR the live-mission board is scheduled as a phase
scope: Medium
origin: "111-CONTEXT.md probe (npx convex run subagentJobs:listRecent --url http://127.0.0.1:3210, 2026-08-10T20:49Z): 7 rows ever | {failed:2, cancelled:3, completed:2} | zero queued, zero running | submittedAt === finishedAt in 7 of 7 | newest row 2026-07-07 | 0 rows with sessionId/traceId | subagentJobs absent from retention.ts (control: toolExecutions present). Corroborating code: convex/runtimeIngest.ts:594-596, convex/subagentJobs.ts:13-16, convex/schema.ts:562-586 and :1028-1041, convex/retention.ts:34."
paired_seed: .planning/seeds/SEED-002-mission-control-jobs-board.md
---

# SEED-007: Mission emitter revival (prerequisite for SEED-002's live board)

Phase 111 rewrote `JobsPanel` into a truthful post-hoc mission **history** board rather
than the live board originally scoped, because the astridr-side emitter has not written a
usable live row since 2026-07-07. This seed is the single owner of everything Phase 111
deliberately deferred as a result — the emitter repair itself, the two requirement halves
that depend on it, and the two non-goals Phase 111 measured and left alone.

## 1. The emitter repair (D-02), cross-repo, astridr-side

Three real gaps, all upstream of CodePulse:

- **Real `submittedAt` distinct from `finishedAt`.** Today `convex/subagentJobs.ts:13-16`
  documents the fallback, and 7 of 7 live rows are synthetic copies — `submittedAt` is
  backfilled from `finishedAt` at ingest, so no duration is derivable from any row that
  exists today.
- **Non-terminal `queued`/`running` states.** `convex/runtimeIngest.ts:594-596` records
  that these currently live only in Supabase, never reaching Convex. Without them, "is a
  mission still running" cannot be rendered honestly — only "it finished, eventually."
- **A mission-to-tool correlation key.** `toolExecutions` has no `jobId`
  (`convex/schema.ts:562-586`) and `subagentJobs` has no `sessionId`/`traceId`
  (`convex/schema.ts:1028-1041`). Without a join key, no tool activity can ever be
  attributed to a specific mission.

## 2. The deferred requirement halves

- **MISSION-01's duration and orphan-recovery clauses (D-04).** The status/history half
  shipped in Phase 111 (plans 111-01/111-02). Duration cannot ship until real
  `submittedAt` exists; orphan recovery cannot ship until a `running` row can arrive to be
  orphaned in the first place.
- **MISSION-02 in full (D-03).** Humanized tool labels on a mission require the
  mission-to-tool correlation key described above — see item 1. `toolExecutions`'s 14-day
  retention (`convex/retention.ts:34`) means even a retroactive join key could not recover
  tool activity for missions already outside that window (e.g. the July 2026 missions in
  today's 7 lifetime rows).

## 3. D-11 — bind `subagentJobs` in `convex/retention.ts`'s `RETENTION_DAYS`

Correctly skipped in Phase 111: 7 lifetime rows, nothing since 2026-07-07, and
`convex/retention.ts` was Phase 110's actively-edited file at the time (avoiding a
cross-phase edit collision on a shared file). It becomes necessary the moment the emitter
revives — a revived firehose against an unbounded table is exactly the growth the house
precedent at `convex/retention.ts:39-48, 79-91` pre-empts for every other live table.
Verified still absent as of this plan (Task 2 audit, D-11 below).

## 4. D-12 — bind `listRecent`'s unbounded `.collect()` (`convex/subagentJobs.ts:88`)

`listRecent` collects the whole table then slices to 50. Harmless at 7 rows; a real hazard
the moment rows arrive at volume — same class of defect the house precedent in
`retention.ts` exists to prevent. Verified still present as of this plan (Task 2 audit,
D-12 below).

## 5. Carried-forward robustness note from 111-01's threat model

`JobsPanel.tsx`'s `stateIcon[job.status]` is an unguarded prototype-chain lookup: an
emitter-supplied status of `toString` or `constructor` resolves to an inherited
`Object.prototype` member instead of `undefined`, so the `??` fallback does not fire.
Impact today is a missing icon plus a React child warning — no XSS, no disclosure — and
UI-SPEC locked that expression as preserve-as-is for Phase 111, so it was correctly left
alone. The phase that reopens this file (i.e. the emitter-revival phase this seed
triggers) should guard it with `Object.hasOwn`.

## 6. Typing note

`src/hooks/useSubagentJobs.ts`'s `SubagentJobStatus` union is narrower than the column it
models: `convex/subagentJobs.ts:28` declares `status: v.string()` and
`convex/runtimeIngest.ts:615` writes `d.status ?? "unknown"`. Phase 111 left the union
alone (no decision authorized widening it) and absorbed the gap with one cast in
`JobsPanel.test.tsx`. Widening belongs with the emitter phase, which will settle the real
state set once non-terminal states actually arrive.

## Relationship to SEED-002

This seed is the prerequisite SEED-002's live mission board has been waiting on. SEED-002
describes the live-board UX (per-mission cards, cost, confirm cards, squad grouping); none
of that can be built honestly until the astridr-side emitter gaps in item 1 above are
closed. SEED-002 is updated with a one-line cross-reference to this seed.
