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
affects: ["Tasks 2 and 3 are BLOCKING operator actions - deploy and first-run watch - both unrun"]

key-files:
  created: []
  modified: []

# Metrics
completed: partial - Task 1 of 3
---

# Phase 127 Plan 08: `ackedAt` Consumer Sweep (Task 1 of 3)

**Task 1 complete. Tasks 2 and 3 are blocking operator actions and are deliberately unrun —
nothing has been deployed.**

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

## Tasks 2 and 3 — BLOCKING, unrun

- **Task 2:** deploy the schema to the self-hosted backend with
  `npx convex deploy --env-file …selfhosted.envfile` and read the index diff verbatim,
  specifically what it says about the widened `by_dismissed`. Larry runs this; the plan
  explicitly forbids the agent from running it.
- **Task 3:** watch the first 08:20 / 08:35 UTC cron firing after the deploy.

**Nothing is deployed. Registering a cron in `crons.ts` does not make it live.**

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
