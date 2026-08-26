---
phase: 127-ack-aware-retention-janitors
plan: 08
subsystem: retention
tags: [convex, retention, janitor, deploy, audit, ackedAt]

# Dependency graph
requires:
  - phase: 127-01..127-07
    provides: "both janitors built, tested, cron-registered; Verification B fully satisfied"
provides:
  - "Task 1: exhaustive ackedAt consumer sweep - R-02's two-consumer premise CONFIRMED against the corpus"
  - "Task 2: schema + crons DEPLOYED to the self-hosted backend; index diff read verbatim"
  - "Open Question 2 / Assumption A2 ANSWERED: widening an index under an unchanged name is a DROP AND RECREATE"
affects: ["Task 3 (first-run cron watch) is the one remaining BLOCKING operator action; cron registration is NOT yet confirmed"]

key-files:
  created: []
  modified: []

# Metrics
completed: partial - Tasks 1 and 2 of 3; Task 3 pending the first cron firing
---

# Phase 127 Plan 08: Consumer Sweep, Deploy, and First-Run Watch

**Tasks 1 and 2 complete. The schema and both crons ARE deployed to the self-hosted backend
(2026-08-25, operator-run). Task 3 — the first-run cron watch — is pending, and until it is
observed, cron REGISTRATION is not confirmed; see Task 2 below for why the deploy output
cannot establish it.**

## Task 1 — Exhaustive `ackedAt` consumer sweep

`127-RESEARCH.md` grepped `ackedAt` but stated plainly that it did not perform an exhaustive
whole-repo consumer audit. R-02's entire revision rests on the claim that **exactly two**
surfaces treat `ackedAt` as a read/unread signal. That claim was checked, not inherited.

### Population derivation

The plan scoped the sweep to `src/**` and `convex/**`. It was widened to the whole repo
(excluding `node_modules`, `.git`, `dist`, `graphify-out`, `.planning`, `.claude`) so the
population came from the corpus rather than from the two files research had named.

Both sweeps return **the same 9 files**. A filter check confirmed the `.ts`/`.tsx` restriction
excluded nothing: zero `ackedAt` hits exist in any other file type.

### Complete classified hit list

Every occurrence, including the uninteresting ones — a list of only the interesting hits is
indistinguishable from a list produced by a pattern that missed things.

**(a) WRITERS — mutations that stamp `ackedAt`**

| Location | Note |
|---|---|
| `convex/inbox.ts:96` | `raiseHandler` — honours a caller-supplied `ackedAt` (Phase 188.5 WR-04) |
| `convex/inbox.ts:114` | `raise` arg validator |
| `convex/inbox.ts:129` | `ack()` — `ctx.db.patch(id, { ackedAt: now })` |
| `convex/inbox.ts:147` | `dismiss()` — same semantics as `ack()` |
| `convex/inbox.ts:318` | `dismissAllCards` — stamps every unacked `card` row |
| `convex/inboxIngest.ts:69` | HTTP ingest pass-through: `ackedAt: body.ackedAt as number \| undefined` |
| `convex/schema.ts:2177` | field declaration, `v.optional(v.float64())` |

**(b) `held`-SCOPED reads — carved out of both janitor steps by D-03, so unreachable by this phase**

| Location | Note |
|---|---|
| `convex/inbox.ts:215` | `listHeldUnackedHandler` — `rows.filter(row => row.ackedAt === undefined)`, scoped `itemType === "held"`. This is the query `convex/inboxIngest.ts:174` serves to Ástríðr's `focus_digest.py`. |
| `convex/inbox.ts:284` | `countHeldUnackedHandler` — counts `ackedAt === undefined` inside the held window |
| `convex/inbox.ts:423` | `shouldAutoClose` — READS `ackedAt` (money rows close only once acked). A read by the janitor's own predicate, not a rendering consumer, and it writes nothing. |

**(c) General read/unread RENDERING consumers — the class R-02's premise is about**

| Location | Note |
|---|---|
| `src/pages/Inbox.tsx:130` | `read: row.ackedAt != null` — the derivation named in R-02 |
| `src/components/control-center/IntelligenceFeedPanel.tsx:64` | `if (row.ackedAt != null) return "";` — suppresses the unread stripe |

**EXACTLY TWO. R-02's premise is CONFIRMED.** No third consumer exists; no disclosure widening
is required, and the deploy may proceed on this point.

**(d) TEST FIXTURES**

`convex/inbox.test.ts` (28 occurrences), `convex/inboxIngest.test.ts` (14),
`src/pages/__tests__/Inbox.test.tsx` (2). All fixture seeding or assertions; no production
behaviour.

**Comments / non-code (checked so they are not miscounted as consumers)**

`src/layouts/DashboardLayout.tsx:157` and `:170` are the only `ackedAt` hits in that file and
**both are `//` comments** describing `countHeldUnacked`'s truncation semantics and a proposed
composite index. DashboardLayout consumes the badge through `countHeldUnacked` — a class (b)
held-scoped read — and never touches `ackedAt` itself. Also comments, not reads:
`convex/inbox.ts:56,66,74,119,137,202,256,261,302,306,335,338,341,462`,
`src/pages/Inbox.tsx:308`, `src/components/control-center/IntelligenceFeedPanel.tsx:25`,
`convex/schema.ts:2181-2185`.

### The inverse property, with a paired control

The thing this phase actually shipped is that the janitors never WRITE `ackedAt`. A bare zero
would be ambiguous between "no writes" and "the grep does not work here", so it is paired:

| Check | Result |
|---|---|
| PROPERTY — `ackedAt:` write form inside the janitor region (`convex/inbox.ts:335`→EOF) | **0** |
| CONTROL A — same pattern over the WHOLE file | **5** (the grep can find writes) |
| CONTROL B — `closedAt:` write form inside the janitor region | **2** (the grep works inside the region) |

The only real `ctx.db.patch` in the janitor region is `convex/inbox.ts:487` →
`{ closedAt: nowSec }`. The two other `.patch()` strings in the region are doc-comment mentions.

`convex/ideation.ts` never appears in the sweep at all — zero `ackedAt` occurrences, since that
janitor keys on `dismissed`/`dismissedAt`.

### `npm test`

Green: `365 files passed | 17 skipped`, `5,159 passed | 4 skipped | 195 todo`, 0 failed.

**But see `deferred-items.md`:** across 8 full-suite runs on this checkout, 7 were clean and
**1 reported `1 failed` whose identity was not captured**. Every `convex/**` test was
deterministic and green in all 8. That open item is recorded there rather than resolved here.

## Task status as first written (superseded)

_Kept for provenance. Task 2 completed later the same day and its full record follows below._
_Task 3 remains pending._

---

## Task 2 — DEPLOY: COMPLETE (operator-run, 2026-08-25)

Larry ran the deploy himself, per the plan's prohibition on the agent running it.

**Command as run** (contains `--env-file`, self-hosted envfile, no `-y` needed):
```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

**Pre-deploy working tree:** `M convex/_generated/api.d.ts` only — a generated file with an
empty content diff (CRLF churn). No source shipped uncommitted. `git push origin master`
completed first (`45767824..84fd77cc`), so origin and the deployed tree matched.

**Verbatim deploy output:**
```
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
✔ No large indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Deleted table indexes:
  [-] ideationFindings.by_dismissed   dismissed, _creationTime
✔ Added table indexes:
  [+] ideationFindings.by_dismissed   dismissed, createdAt, _creationTime
  [+] ideationFindings.by_dismissedAt   dismissedAt, _creationTime
  [+] inbox.by_closedAt   closedAt, createdAt, _creationTime
✔ Deployed Convex functions to http://127.0.0.1:3210
```

### OPEN QUESTION 2 / ASSUMPTION A2 — ANSWERED

`127-RESEARCH.md` recorded, as an explicitly open question, whether widening an index under an
UNCHANGED name deploys as an in-place modification or as a drop-and-recreate, and said it could
only be settled by reading a real deploy's output. It is now settled:

**It is a DROP AND RECREATE.** `by_dismissed` went out as `[-] dismissed, _creationTime` and came
back as `[+] dismissed, createdAt, _creationTime` — same name, torn down and rebuilt.

**The transferable finding, which matters more than this phase.** `ideationFindings` is ~470
rows, so the rebuild was free and invisible. On a large table the identical one-line schema edit
is a full index drop plus backfill — exactly the class of mass operation this repo's CLAUDE.md
records as having taken the self-hosted single-node instance down for days on 2026-07-21/22.
A future widening on `events` or `toolExecutions` is NOT the harmless-looking change it appears
to be in the diff.

### Index-diff audit

- The `Deleted table indexes:` line — which CLAUDE.md names as the ONLY announcement of a
  destructive schema rollback — DID appear, and was inspected rather than skimmed. It contains
  exactly one entry, `ideationFindings.by_dismissed`, which is re-added widened in the same
  push. Nothing belonging to another session's work was dropped.
- `✔ No large indexes are deleted by this push` passed as a separate check.
- Three indexes added, all three expected: the widened `by_dismissed`, the new `by_dismissedAt`,
  and `inbox.by_closedAt` (`closedAt, createdAt` — the composite that lets one index serve both
  of the inbox janitor's steps, per D-06/R-02).
- `Schema validation complete` — the new `inbox.closedAt` field validated against live data.

### Cron registration is NOT yet confirmed — and the orchestrator's own step was wrong

The plan's step asked the operator to confirm both cron names appear in the deploy output.
**They cannot:** `convex deploy` reports functions, schema and indexes, not cron registrations.
That was a specification error by the orchestrator, not a deploy problem.

An attempt to confirm registration via `npx convex data ... _cronJobs` returned
`There are no documents in this table.` **That result is discarded as non-discriminating**, on
its control: a deliberately bogus table name (`_bogusTableNameXyz`) returns the IDENTICAL
message, so the probe cannot distinguish "no rows" from "no such table". A second control
(`ideationFindings`) returned real rows, proving the CLI works on tables it can see. The zero is
therefore evidence of nothing.

**Cron registration will be established by Task 3's first observed firing, not before.** Both
janitors log the literal string `auto-close/prune` (`convex/inbox.ts:650`,
`convex/ideation.ts:446`), and the cron names are `inbox-janitor` and
`ideation-findings-janitor` (`convex/crons.ts:242`, `:261`).

## Task 3 — first-run watch: PENDING

Awaiting the first 08:20 / 08:35 UTC (04:20 / 04:35 ET) firing after this deploy.

---

## Task 3 — PRE-FIRING BASELINE captured 2026-08-25 22:44 UTC (18:44 ET)

### The first Task 3 attempt used the WRONG PROBE, and it returned a convincing false negative

The operator ran the orchestrator-supplied command
`cmd /c "docker logs convex-backend --since 12h 2>&1" | Select-String "auto-close/prune"`
and it returned **nothing**. Two independent defects, either of which alone would have produced
that empty result and made a healthy deployment look broken:

1. **It was not yet time.** The check ran at 22:44 UTC on 2026-08-25. The crons fire at
   08:20 / 08:35 UTC — i.e. 2026-08-26, ~9.5 hours later. Nothing had fired because nothing was
   due. The orchestrator's own instructions said "tomorrow morning after 04:35 ET" but the
   command was run the same evening, and the empty output is indistinguishable from failure.
2. **`docker logs` is the wrong surface entirely.** Container stdout carries only HTTP/infra
   lines (`convex-cloud-http`, `common::http`, `stats_middleware`). Convex **function**
   `console.log` output does not appear there. Verified by reading
   `docker logs convex-backend --tail 30` directly: every line is an HTTP request log. So even
   AFTER the crons fire, that grep would return empty forever. The operator would have run a
   permanently-dead probe and read its silence as a failed deploy.

`npx convex logs` was also tried and is unsuitable as a one-shot: it STREAMS and produced zero
bytes before being killed, rather than printing history and exiting.

### The replacement probe asserts on ROWS, not on a log line

The log line is a proxy. The real observable is whether rows acquired `closedAt` /
`dismissedAt`. `npx convex run --inline-query` is sandboxed and read-only (it "can only read
data and cannot modify the database or access the network"), so it can be pointed at live
production safely.

**Baseline, with controls, all measured 2026-08-25 22:44 UTC — BEFORE any firing:**

| Probe | Result |
|---|---|
| `inbox` rows carrying `closedAt`, via `by_closedAt` | **0** |
| CONTROL — `inbox` sample rows exist | **3** (`card`, `card`, `held`); first row `closedAt === undefined` |
| `ideationFindings` rows carrying `dismissedAt`, via `by_dismissedAt` | **0** |
| CONTROL — `ideationFindings` sample rows exist | **3**, all `dismissed: false` |

The controls are what make the two zeros meaningful: the probe demonstrably returns rows when
rows exist, so a zero is a real zero and not a broken query.

**This baseline also independently verifies the deploy.** Both `by_closedAt` and
`by_dismissedAt` were USED successfully by these queries against the live deployment. The deploy
output asserted the indexes were added; this is the first evidence they are actually live and
queryable, which is a different claim.

### Nightly restart does not collide with the cron window

`ConvexNightlyRestart` (Windows scheduled task, State `Ready`, `LastTaskResult 0`) runs at
**02:00 ET**; next run 2026-08-26 02:00. The crons fire at 04:20 / 04:35 ET, ~2h20m later, so
the janitors' first run happens against a freshly restarted backend rather than one at the top
of its memory climb. Container uptime at baseline was "Up 17 hours (healthy)", consistent with
the 02:00 ET restart today.

**Memory at baseline:** 20.78 GiB / 64 GiB (32.47%), CPU 113.71%, after ~16.7h uptime — about
1.24 GiB/h, at or slightly above the ~0.17-1.04 GiB/h range recorded in
`110-MEMORY-EVIDENCE.md`. Noted, not acted on; the 02:00 restart clears it before the janitors
run.

### Task 3 remains PENDING

Expected at the next reading, after 04:35 ET on 2026-08-26:
- `inbox` rows carrying `closedAt` should become **non-zero** (the janitor's first real action).
- `ideationFindings` rows carrying `dismissedAt` should stay **0** — inert by design until
  roughly 2026-11-16. A zero there is CORRECT, and is the outcome R-01's mandatory log line
  exists to distinguish from dead-on-arrival.

---

## Task 3 — FIRST-RUN WATCH: the inbox janitor fired and worked (2026-08-26 09:05 UTC)

Measured 44 minutes after the 08:20 UTC firing, using the row-level probe established in the
baseline above — not the log grep, which was the wrong surface.

### The firing

| Probe | Baseline (2026-08-25 22:44 UTC) | After firing (2026-08-26 09:05 UTC) |
|---|---|---|
| `inbox` rows carrying `closedAt` | **0** | **588** |
| `ideationFindings` rows carrying `dismissedAt` | **0** | **0** (correct — inert by design) |
| CONTROL — `inbox` sample rows | 3 | 3 |
| CONTROL — `ideationFindings` sample rows | 3 | 3 |

The controls held in both directions, so neither the 588 nor the 0 is a broken probe.

**The `closedAt` stamp is `1787732453.002` = 2026-08-26 08:20:53 UTC** — the `inbox-janitor`
cron time exactly. The cron fired on schedule.

### The chain behaved exactly as designed

Three distinct stamps, three seconds apart, with these per-batch counts:

| Stamp (UTC) | Rows stamped |
|---|---|
| 08:20:53.002 | 198 |
| 08:20:56.005 | 200 |
| 08:20:59.007 | 190 |
| **total** | **588** |

- The 3-second spacing is `INBOX_JANITOR_RESCHEDULE_MS = 3000`. The self-rescheduling chain is
  real, observed in production, not just in tests.
- `INBOX_JANITOR_BATCH_SIZE` is 200 and the middle batch is exactly 200 — the batch cap binds.
- The chain used **3 of its 100-batch budget** and stopped. A descending query confirms the
  newest stamp IS `08:20:59.007`, i.e. it stopped because it ran out of work, not because it
  hit `INBOX_JANITOR_MAX_BATCHES`.
- **Batch 1 read 200 rows and stamped 198.** Two rows were carved out and skipped while the
  cursor still advanced — the D-08 property `partitionBatchForPrune` exists to guarantee,
  happening for real on live data.

### The carve-outs hold ON LIVE DATA — the result that matters most

| Live assertion | Result |
|---|---|
| `held` rows carrying `closedAt` | **0** |
| unacked `money` rows carrying `closedAt` | **0** |

Plan 127-07's mutation control proved these carve-outs were *test-protected*. This proves they
are *actually correct in production*. `held` is what Ástríðr's `focus_digest.py` consumes; a
leak here was the phase's headline risk.

### The delete step correctly did nothing

`closedAt` was stamped 44 minutes ago and the grace window (`INBOX_CLOSED_GRACE_SEC`) is 14
days, so no row is eligible for deletion yet. Zero deletions is the correct outcome, not a
failure. The first real deletions are due ~2026-09-09.

### T-127-28 (first backlog drain OOMing the single-node backend) did NOT materialise

- `docker ps`: `Up 3 hours (healthy)` — consistent with the 02:00 ET / 06:00 UTC
  `ConvexNightlyRestart`, i.e. no crash-restart.
- Memory sampled over 60s: **20.17 → 20.18 → 20.18 GiB / 64 GiB**. Flat, not climbing.
- CPU: 0.02% / 109% / 1.59% across those samples — ordinary bursty ingest, not a spin.

An observation recorded WITHOUT a conclusion: memory read 20.78 GiB at ~16.7h uptime yesterday
and 20.17 GiB at ~3h uptime today. Two points is not a trend, but they are more consistent with
a plateau near 20 GiB than with the linear 0.17-1.04 GiB/h climb recorded in
`110-MEMORY-EVIDENCE.md`. Not investigated here; not claimed.

### What is NOT confirmed: the ideation janitor's own firing

`ideation-findings-janitor` (08:35 UTC) leaves **no data trace by design** — 0 of 470 findings
are dismissed and the auto-dismiss threshold is 180 days, so a correct run changes nothing until
roughly 2026-11-16. Its only evidence is R-01's mandatory log line, and that is a Convex
FUNCTION log, which does not appear in `docker logs` (container stdout carries HTTP/infra lines
only, verified directly).

Two probes were tried and both correctly discarded:
- `_cronJobs` via `convex data` — **non-discriminating**: a deliberately bogus table name
  returns the identical "no documents" message.
- `cronExecutions` — a real table, but it holds **Ástríðr's** cron feed (`reminder:nudge`,
  `watch:pulse`, `skill_health:daily`). Convex-side `crons.ts` registrations never write there,
  so an absence would have meant nothing.

**What IS established:** `inbox-janitor` fired on schedule from the same `crons.ts`, deployed in
the same push, so cron registration demonstrably works. That is strong indirect evidence for its
sibling and is NOT the same as observing it. Direct confirmation requires the Convex dashboard's
function-log view or a streaming `npx convex logs` held across a firing.

## Plan 127-08: COMPLETE (Tasks 1, 2, 3)
