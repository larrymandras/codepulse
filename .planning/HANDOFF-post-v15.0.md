# Handoff — after v15.0, 2026-08-26

Written for a session with **no prior context**. Everything below is stated with the evidence
needed to act on it, because this repo's defining failure mode — the one v15.0's retrospective
names as its top finding — is that planning notes decay and nobody re-derives them.

**Read this before trusting any status in `REQUIREMENTS.md`, `ROADMAP.md` or `STATE.md`.**
On 2026-08-26 an audit found 8 requirements marked `Pending` on phases already shipped, 3 of 4
`Partial` cells describing work that had already landed, and 6 of 9 carried-forward items wrong.
There is now a ratchet for the first class (`src/requirementsDrift.ratchet.test.ts`), but it only
catches `Pending`-on-`Complete`. Everything else still needs a code read.

## Current state

- **Milestone v15.0 "Borealis Console" is SHIPPED, closed and tagged** (`v15.0`). 8 phases
  (120–127), 87 plans, 30/30 requirements, phases archived to `.planning/milestones/v15.0-phases/`.
- **There is no active milestone.** Next is either planning v16.0 or the list below.
- `npm test` → 368 files / 5,181 passed / 0 failed, then browser 3 passed. `npx tsc --noEmit`
  exit 0. `gsd-state-coherence.ps1` exit 0.
- **`npm test` is now SEQUENTIAL** (`--project unit` then `--project browser`). Do not "simplify"
  it back to a bare `vitest run` — running the two projects concurrently is the measured cause of
  an intermittent suite failure (unit-only passed 10/10 at the same commit where both-together
  failed on iteration 1). CI's second step must stay `--project unit`.

## Work remaining, in the order I would take it

### 1. `message_routed` has no UI — needs Larry, not code
`convex/messageRoutes.ts` exists and is tested (resolver coverage at
`convex/runtimeIngest.test.ts:1443`); `messageRoutes.ts:19` states outright that it "has no UI
this phase". This is a **design decision**, not an implementation gap. Do not start building a
surface without asking what it should show.

### 2. MISSION-01 — built, waiting on one live row
Both halves are now implemented:
- orphan recovery shipped in astridr 168-06 (`subagent_jobs.py:230` `_boot_sweep` →
  `_notify_orphan` mirrors terminal `failed` to Convex);
- duration fixed 2026-08-26 in astridr `e435f71a` — `emit_subagent_job_terminal` gained
  `submitted_at`, supplied at all three call sites.

**It is NOT tickable yet.** The fix works going forward only; the 7 existing `subagentJobs` rows
still have `submittedAt === finishedAt`. It closes when a real background job produces a row with
`finishedAt > submittedAt`. Verify with:

```
npx convex run --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile --inline-query "const r = await ctx.db.query('subagentJobs').order('desc').take(20); return { rows: r.length, withRealDuration: r.filter(x => x.finishedAt != null && x.submittedAt != null && x.finishedAt !== x.submittedAt).length }"
```

**Do not tick MISSION-01's checkbox before that returns non-zero.** Tooling has auto-ticked it
twice and it was reverted twice.

### 3. Loom coverage — 3 of 4 gaps remain
`convex/loomHttp.test.ts` (13 tests) closed the security-weighted one on 2026-08-26. Still
uncovered, per `.planning/milestones/v14.0-phases/119-loom-curated-pipelines/119-VALIDATION.md`:
- `convex/loom.ts` query/mutation surface
- `src/pages/Loom.tsx` (mock `@xyflow/react` per this repo's per-file convention)
- `hooks/loom-emit.mjs` (`hooks/**/*.test.mjs` is already in the `unit` include glob, so a file
  would be collected the moment one exists)

### 4. `convex/briefings.ts:181-190` — same unbounded-read class as the `cronSummary` fix
`withIndex("by_severity")` with no range plus a POST-read `.filter()` on `detectedAt`, then
`.collect()`. In Convex `.filter()` runs on rows ALREADY READ, so this scans the whole table.
Currently harmless: `anomalyEvents` measured **40 rows** on 2026-08-26. There is no plain
`detectedAt` index (`by_severity` is `["severity","detectedAt"]`), so a correct fix needs a
schema change **and a deploy** — disproportionate for 40 rows today, but it will bite if that
table grows. See `convex/automationCronSummaryBounded.test.ts` for the guard pattern.

### 5. MISSION-02 — genuinely blocked, and do not re-litigate it cheaply
The v14.0 note says "no job↔tool join key exists in astridr". **That note is correct.** On
2026-08-26 I re-characterised it as "the key exists, one small change away", then had to retract
that — see `REQUIREMENTS.md` item 2 for the full retraction. Both facts:
- `traceId` is set at `astridr/agent/loop.py:1028` INSIDE the sub-agent's own task and reset in a
  `finally` at `:1033`. A contextvar set in a nested task does not propagate outward, so
  `get_trace_context()` at terminal-emit time reads the caller's context or `None` — never the
  sub-agent's. Not a race; the value is not there.
- `sessionId` is the CALLER's session (`delegate_task.py:184`, "originating routing context"),
  shared by every job from that chat, and `subagentJobs` has no `sessionId` field.

The real unblock is plumbing the trace id out through the `_dispatch` boundary
(`delegate_task.py:398`), which crosses the sub-agent result type. Plan it; don't improvise it.

## Shared-checkout warnings that were live today

- **codepulse and astridr are both shared with a concurrent session.** Author is `Larry Mandras`
  on every commit, so author does NOT discriminate ownership. Stage by explicit path; never
  `git add -A`. Twice today another session's commits were carried by a push, in both directions.
- **astridr** `feature/brain-swap`: at handoff time it held that session's Phase 196 work
  (uncommitted `Dockerfile`, `gateway/Dockerfile`, `gateway/gateway/adapters/tool_ceiling.py`,
  `scripts/mission_deny_fixedpoint.sh`, `.planning/STATE.md`) plus unpushed commits. Leave them.
- **`~/.claude`** has my commit `ea55c00` (planner grep-hygiene fix) committed but **NOT pushed**,
  because pushing would carry another session's `6fd9450` plus their in-flight SDK-patch work.
  Push it once they are done.
- A rebuild/deploy in either repo ships the WORKING TREE, so it deploys whatever a concurrent
  session has left there. Enumerate before building and tell the other session after.

## Not deployed

astridr's CORS fix IS live (verified in the running container). astridr's `submittedAt` fix
(`e435f71a`) is committed and pushed but **only reaches production on the next rebuild** — which
is an operator action, and which will also ship the other session's work.
