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
