# Handoff — after v15.0

Written for a session with **no prior context**. Everything below is stated with the evidence
needed to act on it, because this repo's defining failure mode — the one v15.0's retrospective
names as its top finding — is that planning notes decay and nobody re-derives them.

**Read this before trusting any status in `REQUIREMENTS.md`, `ROADMAP.md` or `STATE.md`.**
On 2026-08-26 an audit found 8 requirements marked `Pending` on phases already shipped, 3 of 4
`Partial` cells describing work that had already landed, and 6 of 9 carried-forward items wrong.
There is now a ratchet for the first class (`src/requirementsDrift.ratchet.test.ts`), but it only
catches `Pending`-on-`Complete`. Everything else still needs a code read.

*Last revised 2026-08-27. Items 1, 3 and 4 are DONE and item 6 is half done — all kept below with
their outcomes rather than deleted, because "why is there no X" is the question a fresh session
asks next. What genuinely remains: item 2 (waiting on a live row, not on work), item 5 (blocked),
and item 6's markup half (needs an enumeration nobody has done).*

## Current state

- **Milestone v15.0 "Borealis Console" is SHIPPED, closed and tagged** (`v15.0`). 8 phases
  (120–127), 87 plans, 30/30 requirements, phases archived to `.planning/milestones/v15.0-phases/`.
- **There is no active milestone.** Next is either planning v16.0 or the list below.
- `npm test` → 376 files / 5,341 passed / 0 failed, then browser 3 passed. `npx tsc --noEmit`
  exit 0. CI and Gitleaks green on `7a782bfa`.
- **`npm test` is now SEQUENTIAL** (`--project unit` then `--project browser`). Do not "simplify"
  it back to a bare `vitest run` — running the two projects concurrently is the measured cause of
  an intermittent suite failure (unit-only passed 10/10 at the same commit where both-together
  failed on iteration 1). CI's second step must stay `--project unit`.
- **This repository is PUBLIC** (`gh repo view` → `"visibility":"PUBLIC"`). Real account
  identifiers must never enter fixtures, evidence blocks or commit messages. See "Disclosure"
  below — this has already happened once.

## Work remaining, in the order I would take it

### 1. `message_routed` UI — ✅ DONE (2026-08-27, `55ec9001`)

D-13's follow-up is closed. `convex/messageRoutes.ts` gained `channelSummary`, an aggregate over
an index-bounded 14-day window, and `src/components/MessageRoutingSummary.tsx` renders it on
/settings beside `GovernorDecisionLog`.

It is an AGGREGATE, not the row table the `governor_decision` axis got, and that difference is the
point. Measured live 2026-08-26 over the whole table: 53 rows, ONE profile, TWO channels (telegram
51, whatsapp 2), TWO senders, 16 sessions. A last-50 row table over that renders fifty
near-identical rows — the reskin D-13 refused.

Two things worth carrying forward:
- **`--chart-bar` is NOT an accent.** It is the dark neutral a chart's base series uses — in the
  cyan theme `#1e1e24`, byte-identical to `--muted`. Painting a bar fill with it renders the fill
  invisible against its own track, which is exactly what shipped first. jsdom does not resolve CSS
  custom properties, so every unit test was green. Use `--chart-bar-accent` for visible marks.
- The bounded-read guard is `convex/messageRoutesBounded.test.ts`. It asserts on the RECORDED
  QUERY, not the returned aggregates — a surviving unbounded read returns identical numbers on a
  small fixture.

### 2. MISSION-01 — built, still waiting on one live row

Both halves are implemented:
- orphan recovery shipped in astridr 168-06 (`subagent_jobs.py:230` `_boot_sweep` →
  `_notify_orphan` mirrors terminal `failed` to Convex);
- duration fixed 2026-08-26 in astridr `e435f71a` — `emit_subagent_job_terminal` gained
  `submitted_at`, supplied at all three call sites.

**It is NOT tickable.** The fix works going forward only; the existing `subagentJobs` rows still
have `submittedAt === finishedAt`. It closes when a real background job produces a row with
`finishedAt > submittedAt`. Verify with:

```
npx convex run --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile --inline-query "const r = await ctx.db.query('subagentJobs').order('desc').take(20); return { rows: r.length, withRealDuration: r.filter(x => x.finishedAt != null && x.submittedAt != null && x.finishedAt !== x.submittedAt).length }"
```

**Re-measured 2026-08-27: `{ rows: 7, withRealDuration: 0 }`** — unchanged from the day before, and
still 7 rows, meaning no new background job has run since. Status is correctly recorded `PARTIAL`
in `MILESTONES.md`, `PROJECT.md`, `REQUIREMENTS.md` and this file; nothing has auto-ticked it.

**Do not tick MISSION-01's checkbox before that probe returns non-zero.** Tooling has auto-ticked
it twice and it was reverted twice. Note also that astridr's `e435f71a` only reaches production on
the next rebuild, which is an operator action.

### 3. Loom coverage — ✅ DONE (2026-08-27, `7a782bfa`)

All three gaps from `119-VALIDATION.md` are closed, 86 tests:
- `convex/loom.test.ts` (40) — sticky-error `deriveStatus`, keep-the-newest `appendBounded`, D-06
  refusals, the run-opening rules, and an INT-03 source guard that both writes stay
  `internalMutation`.
- `src/pages/Loom.test.tsx` (24) — `@xyflow/react` mocked per-file with the `vi.hoisted`
  props-capture pattern, which is the only way to see `buildGraph`'s output (it is module-private).
- `hooks/__tests__/loomEmit.test.mjs` (22) — driven as a real subprocess, because the script
  exports nothing and its exit-code contract (0/2/3/4) is what callers branch on.

All three mutation-proved: 33 mutations, every one caught.

Two traps recorded for the next hook test: under vitest `import.meta.url` is an http:// dev-server
URL so `fileURLToPath` throws — anchor on `process.cwd()`. And any test of a script that reads
`<homedir>/...` must override HOME **and** USERPROFILE (`os.homedir()` reads the former on POSIX,
the latter on Windows), or the result depends on operator machine state.

**Not covered, stated rather than left silent:** loom-emit's 10s AbortController timeout path.
`TIMEOUT_MS` is a module constant with no injection point, so exercising it costs a real 10s wait.

### 4. Unbounded reads in `getDailyDigestDataInternal` — ✅ DONE (2026-08-27)

`convex/briefings.ts`. There were THREE instances of the class in this one query, not the one
originally recorded. All are fixed and deployed; guard is
`convex/briefingsDigestBounded.test.ts`.

- **(a) `sessions`** — the big one. `withIndex("by_status", q => q.eq("status","completed"))` with
  no range, post-read `.filter()` on `lastEventAt`, `.collect()`. Measured **1,575 completed rows
  read on every digest run** to keep one day's worth. Fixed by pushing both edges into
  `by_status` (already `["status","lastEventAt"]`) — no schema change. Before/after control run
  live: both shapes return **11 rows**, so results are identical, but the new one READS 11 where
  the old read 1,575.
- **(b) `aggregates`** — was half-bounded (`gte` in the index, `lt` post-read). `bucket_start` is
  the last field of `by_type_period_bucket`, so both edges now push in.
- **(c) `anomalyEvents`** — had no range at all. Needed a real schema change: `by_severity` is
  `["severity","detectedAt"]` and `by_metric_detected` is `["metric","detectedAt"]`, so
  `detectedAt` is SECOND in both and neither can bound a bare time range. Added
  `.index("by_detectedAt", ["detectedAt"])`. Ranging per severity would have avoided the index but
  was rejected: `severity` is `v.string()`, not a union — only a comment documents
  `"warning" | "critical"` — so an enumerated query would silently drop a future third severity
  from the count. **An index cannot be forgotten the way an enumeration can.**

Deploy output confirmed both signals: `✔ No indexes are deleted by this push` and
`✔ Added table indexes: [+] anomalyEvents.by_detectedAt`. The live query returns real data
(`totalCost` 2.71, `anomalyCount` 0, sessions and findings populated).

Consumers: `briefings.ts:404` and `emailDigest.ts:213`.

Units are consistent throughout — `detectedAt` is epoch SECONDS (`schema.ts:1279`) and
`dayEnd = dayStart + 86400`. The guard has a test pinning that, because a millisecond bound would
put the window in 1970 and read as "no activity today" rather than as a failure.

**If you add another read here:** assert on the RECORDED QUERY, never the returned rows. A
surviving unbounded read returns identical digest numbers on a small fixture, so the values cannot
discriminate. Pattern: `briefingsDigestBounded.test.ts`, `automationCronSummaryBounded.test.ts`,
`messageRoutesBounded.test.ts`.

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

### 6. The privacy levels — JS gate FIXED, markup half still open

Found 2026-08-27 while building item 1. Both halves of the mechanism were inert; one is now fixed.

`PrivacyContext` carries TWO independent pieces of state:
- `setLevel` (`src/contexts/PrivacyContext.tsx:59-66`) writes **only** `level`. It never touches
  `enabled`. So a user who picks Demo or Screenshot from the default off state still has
  `enabled === false`.
- Every `usePrivacyMask` helper gated on `enabled` alone, so at demo/screenshot level they masked
  **nothing**.
- The CSS half — `.privacy-demo [data-sensitive] { filter: blur(4px) }` and
  `.privacy-screenshot [data-sensitive] { visibility: hidden }` at `src/index.css:649-661` — keys
  off a `data-sensitive` attribute that had **zero consumers** anywhere in `src/`.

**✅ Fixed (2026-08-27):** `usePrivacyMask` now derives one `masking` flag —
`enabled || level !== "off"` — and `mask`, `maskText`, `maskFilePath`, `redact` and `maskHandle`
all gate on it. The per-setting toggles (`maskPaths`/`maskEmails`/`maskKeys`/`maskIps`) still gate
their own rule, so `masking` widens WHEN masking applies without overriding WHICH rules apply — a
test pins that distinction. Guard: `src/hooks/usePrivacyMask.test.tsx`. Mutation-proved in both
directions: reverting the gate to `enabled` alone turns 9 tests red, and forcing it always-on turns
3 red, so over-masking is caught too.

**⚠ STILL OPEN — the markup half.** `data-sensitive` has exactly TWO consumers, both in
`MessageRoutingSummary.tsx`. Screenshot mode's `visibility: hidden` rule therefore still hides
almost nothing anywhere in the app. Closing it means enumerating every element that renders PII
and marking it — and **nobody has ever enumerated that list**. That is the unknown, and it is why
this half was not swept blind: guessing at the set would produce a mechanism that looks complete
and is not, which is the same failure as the one above.

Note the JS fix alone changes behaviour app-wide: anything routed through `mask`/`maskText`/
`redact` now masks at demo and screenshot levels where it previously did not. Full suite green
(5,341 passed) and `tsc` clean after the change, so no consumer depended on the old behaviour.

## Disclosure

**This repo is public.** On 2026-08-27 a pre-push scan found the operator's real Telegram chat id
in two archived Phase 101 evidence blocks and in one commit message. The working-tree instances
were redacted in `e7f10e3f`; **the value remains in git history, including that commit message**,
because removing it means rewriting published history and breaking every existing clone — a trade
considered and declined.

It nearly spread further: fixtures for item 1 were originally written from live data and carried
that id plus a WhatsApp LID, including their partially-masked forms, which still reveal the leading
and trailing digits. They were replaced with synthetic values before the push.

**Rule going forward:** fixtures reproduce the SHAPE of live identifiers, never the values. Run a
disclosure scan as the LAST step before any push, with a control string that must return non-zero
so a probe that matches nothing is caught.

## Shared-checkout warnings

- **codepulse and astridr are both shared with a concurrent session.** Author is `Larry Mandras`
  on every commit, so author does NOT discriminate ownership. Stage by explicit path; never
  `git add -A`. On 2026-08-26 another session's commits were carried by a push, in both directions.
- `convex/_generated/api.d.ts` shows as modified with an EMPTY content diff — CRLF line-ending
  churn only. Leave it; it is not anyone's change.
- **astridr** `feature/brain-swap`: at the previous handoff it held that session's Phase 196 work
  (uncommitted `Dockerfile`, `gateway/Dockerfile`, `gateway/gateway/adapters/tool_ceiling.py`,
  `scripts/mission_deny_fixedpoint.sh`, `.planning/STATE.md`) plus unpushed commits. Leave them.
- **`~/.claude`** has commit `ea55c00` (planner grep-hygiene fix) committed but **NOT pushed**,
  because pushing would carry another session's `6fd9450` plus their in-flight SDK-patch work.
  Push it once they are done.
- A rebuild/deploy in either repo ships the WORKING TREE, so it deploys whatever a concurrent
  session has left there. Enumerate before building and tell the other session after.
- Pushing codepulse `master` triggers a **Vercel production build** (`.vercel/` + `vercel.json`
  are present) as well as CI and a Gitleaks scan.

## Deploying

The production Convex backend is SELF-HOSTED. The deploy must name it explicitly:

```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile -y
```

`--env-file` is not optional — a bare `npx convex deploy` can target the retired cloud deployment
`tidy-whale-981` (frozen 2026-07-15). Watch the output for a `Deleted table indexes:` line: that is
the ONLY announcement a deploy gives of a schema rollback. A clean run prints
`✔ No indexes are deleted by this push`.

astridr's CORS fix IS live (verified in the running container). astridr's `submittedAt` fix
(`e435f71a`) is committed and pushed but **only reaches production on the next rebuild** — which is
an operator action, and which will also ship the other session's work.
