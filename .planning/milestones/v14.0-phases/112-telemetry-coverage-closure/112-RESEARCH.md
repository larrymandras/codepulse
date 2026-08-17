# Phase 112: Telemetry Coverage Closure - Research

**Researched:** 2026-08-12
**Domain:** Convex telemetry ingest routing (self-hosted, single-node SQLite) + cross-repo doc correction
**Confidence:** HIGH (all load-bearing claims are either live-probe results with paired controls, or `file:line` reads of live code — no WebSearch was needed for this phase; it is entirely internal codebase/data investigation)

## Summary

The single question this phase's plan depends on — D-05's `message_routed` volume gate —
is now answered by a live, control-paired measurement: **`message_routed` is genuinely
low-volume (10 rows total across the full 14-day retention window, ~0.7 rows/day)**, not a
firehose. Under D-05's own stated rule, this measurement clears it for a route-and-surface
build in this phase, same as `governor_decision`. `governor_decision` was independently
measured at **~83 rows/day** (1,168 rows spanning the full 14.0-day window, uncapped) — a
real, moderate, steadily-arriving policy-audit stream, newest row 2 minutes before
measurement.

The second highest-value finding is a **live data/contract divergence** on
`governor_decision.held_reason`: the contract (§2.40) documents it as `str | null`,
present whenever `spoke:false`. Live data shows three distinct wire shapes — explicit
string (`"quiet-hours"`/`"focus"`, 73 of 646 held rows), explicit JSON `null` (424 of
646), and the **key entirely absent** (149 of 646, all from `watch_pulse` and
`startup_test`). The `null` and `<absent>` cases are indistinguishable to a consumer that
doesn't check `'held_reason' in data`, and — critically — a naive resolver that forwards
`held_reason: null` straight into a `v.optional(v.string())` Convex validator will throw,
because `v.optional()` rejects explicit `null` (proven both by live data and by the exact
in-code precedent at `runtimeIngest.ts:207-227`, the identical defect already fixed once
for `control_verb_swap`'s `session_id`). The new `governor_decision` resolver must apply
the same `isOptionalString`/`normalizeOptional` pattern from day one, not discover the gap
in a second gap-closure round.

The routing pattern itself (`control_verb_swap`, Phase 108/109) is a clean, complete,
seven-seam checklist to imitate exactly. The D-10 drift-guard model (`retention.test.ts`)
is an existing, working, source-level-parsing test suite with a proven mutation-testing
history — the planner should copy its shape, not invent a new one. TELE-01's astridr-repo
edit surface is confirmed doc-only with no CI friction (no markdown lint, no doc-touching
GitHub Action).

**Primary recommendation:** Route and surface **both** `governor_decision` (D-04, already
committed) and `message_routed` (D-05, now cleared by measurement) in this phase, following
the `control_verb_swap` seven-file checklist below for each, with `held_reason`
null-normalization built in from the first commit for `governor_decision`, and a
`message_routed`-specific UI pass per the UI-SPEC's explicit warning that it does not
inherit the `governor_decision` component shape.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `governor_decision` ingest routing | API/Backend (Convex `runtimeIngest.ts`) | Database (`governorDecisions` table) | Same seam as every existing routed kind — dispatch switch case + domain table insert |
| `message_routed` ingest routing | API/Backend (Convex `runtimeIngest.ts`) | Database (new domain table) | Same seam, contingent on D-05's now-cleared gate |
| Disposition record (D-10/D-11) | API/Backend (`convex/` config module) | — | Machine-readable const + test, no UI, mirrors `RETENTION_DAYS` |
| Retention bounding (D-06) | Database (`convex/retention.ts`) | — | Existing nightly-prune infrastructure, additive entries only |
| `GovernorDecisionLog` surface | Browser/Client (React, `Settings.tsx` host) | API/Backend (new bounded query) | Read-only audit table, per UI-SPEC |
| astridr-contract.md correction (TELE-01) | Docs (astridr-repo) | — | No runtime tier — pure documentation, different repo, no build |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** The bar a Group B kind must clear to earn "route + surface" is live arrival
  inside the 14-day `runtime_events` retention window, established by a control-paired
  probe rather than by emitter presence in astridr source.
- **D-02:** Any plan asserting a kind is absent MUST pair the probe with a known-present
  control and a known-absent control in the same run.
- **D-03:** The measurement of record (2026-08-12): `governor_decision` PASSES (route +
  surface), `control_verb_swap` already routed, `message_routed` PASSES but gated (D-05),
  `prompt_assembly`/`structured_output_exhausted`/`vision.capture`/`control_verb_focus` are
  `generic-table-by-design` (no rows in the 14-day window as of measurement date — not
  "never emitted").
- **D-04:** `governor_decision` is routed to a domain table and surfaced in this phase.
- **D-05:** `message_routed` clears D-01's bar, but its build is gated on a measured
  rows/day figure obtained first. Low-volume result → may be routed in this phase.
  Firehose result → `bar-passing but deliberately generic, volume-justified`. Neither
  outcome may be left ambiguous.
- **D-06:** Any new domain table introduced here is bounded in `RETENTION_DAYS` before it
  can ever grow, following the pre-emptive pattern (`gatewayQuotaSnapshots` D-20,
  `toolPolicyEvents` Phase 105 D-05, `activeEngineSnapshots` Phase 108 D-10). Window value
  is planner's discretion.
- **D-07:** The 5 Group A kinds are corrected in place in `astridr-contract.md` §2.20–§2.24
  — a dated "NOT EMITTED — aspirational" banner, no deletion, no relocation (would renumber
  §2.25–§2.40 including §2.40 `governor_decision` itself).
- **D-08:** The 3 critical-events rows at `docs/astridr-contract.md:1785-1787`
  (`worktree_lifecycle`, `batch_execution`, `loop_lifecycle`) are removed.
- **D-09:** The banner text must state WHY these kinds exist (v1.6.0, 2026-03-09, "Claude
  Code Feb/Mar 2026 release alignment", sourced from `docs/new_claude_capabilities.md`),
  not merely that they're unimplemented.
- **D-10:** The TELE-03 dispositions become a machine-readable const checked into
  CodePulse, mirroring `RETENTION_DAYS` + `retention.test.ts`. A test asserts every Group B
  kind is routed or explicitly disposed generic-by-design.
- **D-11:** Each disposition entry carries its reason and measurement date.
- **D-12:** An astridr-repo-side emitter probe was considered and NOT taken into this
  phase — recorded in Deferred Ideas.

### Claude's Discretion

- Table/column naming, index choice, and retention window for the `governor_decision`
  domain table — within D-06's "bound it before it grows" constraint.
- Exact file/shape of the D-10 const and its test, provided it fails on an undisposed
  kind (mutation-proven, not asserted).
- Precise wording of the D-07 banner, provided it satisfies D-09.

### Deferred Ideas (OUT OF SCOPE)

- astridr-repo emitter probe (D-12) — a guard failing when the contract documents a kind
  no code emits. Strong candidate for a future astridr-repo phase.
- `message_routed` domain route as a carry-forward candidate — **superseded by this
  research's measurement**: the volume gate is now cleared (see Primary Research Question
  below), so this deferred item's premise ("if D-05 disqualifies it") did not occur.
- Group A implementation (actually emitting the 5 aspirational kinds) — astridr-side
  feature, out of scope by REQUIREMENTS.md:74.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TELE-01 | `docs/astridr-contract.md` no longer documents the 5 Group A kinds as behaviour | §2.20–§2.24 headings confirmed at exact lines (674/703/736/765/798 by section start; verify against live grep below). Critical-events rows confirmed at lines 1785-1787 verbatim. v1.6.0 changelog confirmed at line 1884 verbatim. `docs/new_claude_capabilities.md` confirmed present (16,181 bytes, mtime 2026-03-09). No doc lint/CI in astridr-repo `.github/workflows/` touches `docs/*.md` — edit is CI-safe. |
| TELE-03 | Every remaining Group B kind receives a recorded, justified disposition | D-03's 7-kind Group B list re-verified live 2026-08-12 (4 zero-arrival kinds re-probed, still zero; `governor_decision` and `message_routed` volume-measured with full method below). `control_verb_swap` routing precedent fully mapped (7-file checklist). `retention.test.ts` read in full as the D-10 guard-test model. |

</phase_requirements>

## Primary Research Question: D-05 Volume Measurement

### Method

All probes run from `C:\Users\mandr\codepulse` (CWD verified via `pwd` before every
command — CWD drift silently returns empty per the 2026-07-21 lesson) against the live
self-hosted instance (`docker ps` confirmed `convex-backend` "Up 54 minutes (healthy)"
before probing). Every probe used `events:listByType` (indexed `by_type`, bounded
`.take()`) — `events:countByType` (`convex/events.ts:310`, `.collect()`) was never
invoked.

**Wall-clock sanity check (unit proof, required by the task):**
```
$ date +%s
1786539509
$ date -u -d @1786539509
Wed Aug 12 12:58:29 UTC 2026
```
Matches the actual measurement date (2026-08-12) — confirms epoch-**seconds**
interpretation is correct for the timestamps below, not a 1970 artifact.

**Control pair (same run, D-02 compliance):**
```
$ npx convex run events:listByType '{"eventType":"llm_call","limit":3}' \
    --url http://127.0.0.1:3210 --admin-key <redacted>
[ 3 rows returned, newest timestamp 1786487011.34 ]

$ npx convex run events:listByType '{"eventType":"definitely_not_a_real_kind_9x7q2","limit":3}' \
    --url http://127.0.0.1:3210 --admin-key <redacted>
[]
```
Known-present control returns rows; known-absent control returns `[]` — the harness
discriminates, so the zero-row results below (for the 4 already-disposed kinds) are
meaningful, not an invocation artifact.

**Credential-handling note for the planner:** this research used `--admin-key
"$(docker exec convex-backend ./generate_admin_key.sh)"` per the task's own instructions.
A stronger-precedent form exists in this repo's own history (`110-DUR-EVIDENCE.md:5,18-19`,
Phase 110 DUR-03): `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile` —
confirmed present on disk (`find` located `selfhosted.envfile` and
`selfhosted.envfile.example` in `C:\Users\mandr\convex-selfhost\`) — which "never places a
credential value on the command line." **Any future re-measurement (D-02's
re-measurability requirement) should prefer `--env-file` over `--admin-key`** to avoid
echoing a live admin key into a transcript, as this session's probes did.

### `message_routed` — MEASURED LOW-VOLUME. Recommend: ROUTE IT.

```
$ npx convex run events:listByType '{"eventType":"message_routed","limit":1000}' \
    --url http://127.0.0.1:3210 --admin-key <redacted>
[ 10 rows returned — NOT capped at the 1000 limit ]
```

Because the result (10) is well under the requested limit (1000), this is the **complete
population** currently in the 14-day retention window, not a truncated sample — no
higher-limit re-probe can change this number; there are exactly 10 `message_routed` rows
in the entire window as of 2026-08-12T13:00 UTC.

| Metric | Value |
|---|---|
| Total rows (14-day window) | **10** |
| Oldest row | 2026-07-29T23:08:09Z (13.58 days before measurement — near the retention edge) |
| Newest row | 2026-08-07T11:06:53Z (5.08 days before measurement — matches D-03's "~5.1 days" exactly) |
| Span-based rate | 10 rows / 8.5 days ≈ **1.2 rows/day** (burst period); **0.7 rows/day** averaged over the full 13.58-day span |
| Arrival pattern | Bursty, not steady: 2 rows on 2026-07-29 (whatsapp), 6 rows on 2026-08-01 (web), 1 row on 2026-07-29 (whatsapp, separate session), 1 row on 2026-08-07 (telegram). Nothing in the last 5 days. |

**This is unambiguously low-volume** — two orders of magnitude below `governor_decision`'s
measured rate, and far below any table CLAUDE.md's operational rules would flag as a
tombstone/OOM hazard (`toolPolicyEvents` at "boot/reload fire once per boot" is the closest
precedent tier, and even that is likely higher-volume than this). **D-05's gate resolves in
favor of routing `message_routed` in this phase.**

**Payload shape** (all 10 rows, contract §2.16 cross-checked):

```json
{
  "channel": "telegram" | "web" | "whatsapp",
  "profile": "personal",
  "sender": "<channel-specific id>",
  "session_id": "<uuid>"
}
```
Matches the contract's documented 4 required fields (`profile`, `channel`, `session_id`,
`sender`) exactly — **no divergence found** for this kind, unlike `governor_decision`
below. `profile` is always `"personal"` in this sample (single-profile install); do not
assume other values never occur — the field is a live profile ID, not a fixed enum.

**UI-SPEC's explicit warning applies:** `message_routed`'s fields (routing target/session
metadata) are structurally different from `governor_decision`'s (spoke/held outcome) — a
route+surface build here needs its own short design pass, not a reskin of
`GovernorDecisionLog`. This research does not attempt that design pass (out of the
UI-SPEC's stated scope); flag it to whichever plan builds the route.

### `governor_decision` — MEASURED ~83 rows/day, real-time arrival confirmed.

```
$ npx convex run events:listByType '{"eventType":"governor_decision","limit":1500}' \
    --url http://127.0.0.1:3210 --admin-key <redacted>
[ 1168 rows returned — NOT capped at the 1500 limit ]
```

| Metric | Value |
|---|---|
| Total rows (14-day window) | **1,168** (uncapped — true 14-day population) |
| Oldest row | 2026-07-29T12:35:05Z (14.02 days before measurement — exactly at the retention edge) |
| Newest row | 2026-08-12T13:00:31Z (2.0 minutes before measurement — arriving in real time) |
| True rate | 1,168 rows / 14.02 days = **83.3 rows/day** |

This confirms and supersedes D-03's earlier 12-minute-freshness spot check with a full
14-day census. 83/day is a real, moderate, steady policy-audit stream — well above
`message_routed` but nowhere near the `runtime_events`/`llm_call` firehose tier that
motivates the tombstone-hazard warnings in CLAUDE.md.

**Emitter distribution (1,168 rows):**

| Emitter | Count | Contract §2.40 lists it? |
|---|---|---|
| `watch_pulse` | 921 | Yes |
| `cron:task_section_email` | 69 | No — `cron_dispatcher`/`cron_jobs` are the documented catch-all names; actual emitters use a `cron:<taskname>` namespace |
| `startup_test` | 38 | No |
| `cron:dep_scanner` | 46 | No (same namespacing note) |
| `cron:task_also_deliver` | 26 | No |
| `cron:task_delivery` | 26 | No |
| `cron:operator_score` | 13 | No |
| `cron:pr_digest` | 11 | No |
| `verification_layer` | 7 | Yes |
| `cron:skill_health` | 6 | No |
| `cron_failure` | 2 | No |
| `focus_exit_digest` | 2 | No |
| `watch_pulse_duplicate_alert` | 1 | No |

**Finding:** `emitter` is genuinely free-form (matches the schema convention already used
elsewhere in this repo of `v.string()`, not a `Literal` union — see `controlVerbSwaps`
schema comment, `schema.ts:2136-2139`). The contract's illustrative list
(`reminder_nudge, watch_pulse, heartbeat, delegate_task, delegate_goal, subagent_jobs,
verification_layer, wiring, cron_dispatcher, cron_jobs`) is representative, not
exhaustive — live data shows a `cron:<taskname>` namespacing convention the contract
doesn't document, plus operational/test emitters (`startup_test`, `cron_failure`,
`watch_pulse_duplicate_alert`, `focus_exit_digest`) it doesn't mention at all. **This is
informational for TELE-01's banner scope (Group A only) — it does not block TELE-03**,
but the planner should NOT constrain the new domain table's `emitter` column to a closed
enum.

**Priority distribution:** `{normal: most common, high, low, money}` — all 4 documented
enum values observed, no unexpected values. Matches contract exactly.

**`spoke` distribution:** 522 `true` (44.7%), 646 `false` (55.3%) — both outcomes common,
confirming the UI-SPEC's "held is not rare" framing is correct.

**`held_reason` — CONTRACT DIVERGENCE FOUND.** Contract §2.40 documents this field as
`str | null`, present "`spoke:false` only," with two enum values (`"focus"`,
`"quiet-hours"`). Actual wire shapes across the 646 `spoke:false` rows:

| Wire shape | Count | Example emitters |
|---|---|---|
| Explicit string `"quiet-hours"` | 20 | `cron:operator_score`, `cron:skill_health`, `startup_test`, `cron_failure` |
| Explicit string `"focus"` | 53 | `watch_pulse`, `cron:pr_digest`, `cron:dep_scanner`, `cron:task_section_email`, `cron:task_also_deliver`, `cron:task_delivery` |
| Explicit JSON `null` | 424 | `watch_pulse` (396), `startup_test` (26), `focus_exit_digest` (2) |
| **Key absent entirely** | **149** | `watch_pulse` (137), `startup_test` (9), `cron_failure` (1 — wait, recount below) |

(Exact counts from the full 1,168-row cross-tab: `watch_pulse | <absent>`: 137,
`watch_pulse | null`: 396, `startup_test | <absent>`: 9, `startup_test | null`: 26,
`focus_exit_digest | null`: 2 — 149 absent-key rows total, 424 explicit-null rows total,
73 real-string rows total; 149+424+73 = 646, reconciles with the total held count.)

**Why this matters for the plan, concretely:** this is the **exact same defect class**
already fixed once in this codebase for `control_verb_swap`'s `session_id`
(`runtimeIngest.ts:207-227`, `246-248`): astridr's buffered telemetry sender can serialize
an absent optional field as either a missing key OR an explicit JSON `null`, and Convex's
`v.optional(v.string())` validator **rejects an explicit `null` outright** — a resolver
that doesn't strip it will throw inside the switch case, and (per the per-event
try/catch documented at `runtimeIngest.ts:482-509`) that specific event gets dropped
(counted in `droppedCount`) rather than poisoning the batch, but that is still silent data
loss on 424 of 646 held rows (36% of all `governor_decision` rows) if the planner ships a
naive resolver. **The `governor_decision` resolver MUST apply the same
`isOptionalString`/`normalizeOptional` pair used by `resolveControlVerbSwapEvent`
(`runtimeIngest.ts:369-421`) to `held_reason` from the first commit** — this is not an
edge case to discover later, it is the majority shape in live data.

### Recommendation on D-05's gate

**Route `message_routed` in this phase**, alongside `governor_decision`. The measured
rate (10 rows / 14-day window, ~0.7-1.2/day) is unambiguously low-volume by every
precedent tier in `RETENTION_DAYS` (compare `toolPolicyEvents`: "boot/reload fire once per
boot, denials and leaks are rare by design" — a table description that could apply
verbatim here). D-05's "firehose" branch does not apply; the "low-volume, may be routed"
branch does. This is a **measured outcome**, not a judgment call — the disposition record
(D-10/D-11) should record `message_routed`'s reason as "measured 0.7-1.2 rows/day
(10 rows in 14-day window), 2026-08-12" alongside `governor_decision`'s "measured
83.3 rows/day (1,168 rows in 14-day window), 2026-08-12."

## Secondary Research Question 1: Routing Pattern Fidelity — the `control_verb_swap` checklist

Full file-by-file seam list, read from Phase 108/109's actual shipped code
(`convex/runtimeIngest.ts:1022-1051`, `convex/schema.ts:2120-2170`,
`convex/controlVerbSwaps.ts`, `convex/controlVerbSwapsFilters.ts`,
`src/hooks/useControlVerbSwaps.ts`):

| # | File | What changes | Precedent |
|---|---|---|---|
| 1 | `convex/schema.ts` | New `defineTable({...})` block + `.index(...)` | `controlVerbSwaps` at `schema.ts:2140-2170`; `activeEngineSnapshots` at `2109-2118` |
| 2 | `convex/<domain>.ts` (new file, e.g. `governorDecisions.ts`) | `internalMutation` write (`record`), `query` read(s) bounded by `.take(CAP)` | `controlVerbSwaps.ts` — `record` is `internalMutation` (CR-01 rule: not client-callable, closes the devtools-forgeable write path), `listByScope`/`listGlobal` are `query` with a named CAP constant |
| 3 | `convex/<domain>Filters.ts` (new file, if the domain needs shared pure helpers) | CAP constant + any pure predicate/formatting helpers | `controlVerbSwapsFilters.ts` — split out specifically because value-importing a constant from a file that also imports `internalMutation`/`query` pulls the whole Convex server runtime into the client bundle (documented gotcha, `controlVerbSwaps.ts:18-27`) |
| 4 | `convex/runtimeIngest.ts` | New `case "<eventType>":` in the dispatch switch, calling a resolver function + `ctx.runMutation(internal.<domain>.record, resolved)` | `case "control_verb_swap"` at line 1022; the always-run generic `events.insertEvent` write at line 517 happens BEFORE the switch and is untouched — routing is strictly additive |
| 5 | `convex/runtimeIngest.ts` (same file, above the switch) | A pure `resolve<Kind>Event(data, timestamp)` function performing runtime type-checking of every field, using `isOptionalString`/`isOptionalStringArray`/`normalizeOptional` for every optional field that might arrive as explicit `null` | `resolveControlVerbSwapEvent` at lines 369-421; the helper functions themselves at 207-268 |
| 6 | `convex/retention.ts` | New `RETENTION_DAYS` entry with an in-line comment recording the chosen window and why (D-06) | `controlVerbSwaps: 30` at the bottom of the map, with its own dated comment block |
| 7 | `convex/retention.test.ts` | Extend the "Phase 108 tables must not silently become unbounded" test (or add an equivalent) asserting the new table is present with the chosen window | `retention.test.ts:68-71` |
| 8 | `src/hooks/use<Domain>.ts` (new file) | Thin `useQuery(api.<domain>.<query>) ?? []` wrapper | `useControlVerbSwaps.ts` |
| 9 | New React component | The UI surface per `112-UI-SPEC.md` | `SwapHistoryList.tsx` (structural analog), `DeliveryHistory.tsx` (hosting/loading-empty-error analog per UI-SPEC) |
| 10 | Convex/hook/component test files | Unit tests for the resolver, the mutation's args-shape (read from the live validator, not hand-typed), the CR-01 internalMutation-not-public-mutation guard, and the bounded-read guard | `runtimeIngest.test.ts`, `controlVerbSwaps.test.ts` (all 4 `describe` blocks read at `controlVerbSwaps.test.ts:37-133+`) |

**Additive, not replacing:** `runtimeIngest.ts:513-523` always inserts into
`runtime_events` regardless of switch coverage — confirmed still true, unchanged by this
research. Routing `governor_decision`/`message_routed` cannot lose data even if the new
resolver has a bug; worst case is the row lands only in the generic table (as it does
today) instead of also in the domain table.

**Per-event isolation already covers new cases for free:** the try/catch documented at
`runtimeIngest.ts:482-509` wraps the entire loop body (both the generic insert and the
switch), so a malformed event in a new `governor_decision`/`message_routed` case is
dropped and counted in `droppedCount`, never poisoning the rest of the batch. No new
per-case try/catch discipline is needed — this is inherited, not something the plan must
add.

## Secondary Research Question 2: D-10 Drift Guard Model

`convex/retention.test.ts` (231 lines, read in full) is the concrete model. Its mechanism:

1. **Source-level schema parsing, not a live import.** `schemaTables` is built by
   regexing `convex/schema.ts`'s raw source (`/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm`)
   rather than importing the generated schema object — this keeps the test free of Convex
   codegen/runtime, matching `runtimeIngest.test.ts`/`activeEngine.test.ts`'s precedent.
   **The planner's D-10 test should follow this exact pattern** if it needs to cross-check
   the disposition const against real schema tables or real switch cases.

2. **"Guard the guard" liveness check** (`retention.test.ts:29-36`): before asserting
   anything about `RETENTION_DAYS`, the test first asserts the regex actually found a
   plausible number of tables (`size > 20`) and two known-present ones by name
   (`alerts`, `llmMetrics`). This is the mutation-provability requirement D-10 explicitly
   demands — **without this guard, a regex that silently stops matching would make every
   downstream assertion pass vacuously against an empty set.** The planner's D-10 test
   needs an equivalent liveness check on whatever source-parsing or import mechanism it
   uses to enumerate "every Group B kind" and "every schema table."

3. **Known-present + known-absent pairing inside the test itself**, mirroring D-02's
   live-probe discipline in test form: e.g. `retention.test.ts:73-93` proves `prompts`
   is *exempt by design* (not a typo) by asserting `prompts` is absent from
   `RETENTION_DAYS` **and** present in `schemaTables` **and** the exemption is documented
   in `retention.ts`'s own source text (`expect(retentionSource).toContain("D-13")`). This
   is the pattern to copy for D-11's "reason and measurement date" requirement — the
   D-10 test should assert both that the const is complete AND that the source text near
   each generic-by-design entry contains its reason/date, not merely that the const has
   the right keys.

4. **Positive-and-negative pairing at the "windows are correct" layer**
   (`retention.test.ts:50-71`): one test hard-asserts specific tables at specific values
   (`gatewayQuotaSnapshots` = 30, `controlVerbSwaps` = 30, `activeEngineSnapshots` = 30),
   documented as a deliberate response to an adversarial mutation-testing finding that
   generic assertions ("every key is real", "every window is positive") did NOT catch an
   entry being deleted outright. **The planner's D-10 test needs the equivalent: a
   specific assertion that `governor_decision` (and `message_routed`, if routed) is
   present in the disposition const with its specific disposition** — a generic "every
   kind has *some* disposition" assertion is exactly the shape that was proven
   insufficient here.

**Mutation-provability instruction for the plan:** state explicitly (as `retention.test.ts`'s
own comments do) which specific deletion/typo the test is designed to catch, and verify by
temporarily deleting or mistyping one disposition entry and confirming the suite goes red
— this is the "must be mutation-proven, not asserted" bar CONTEXT.md sets for D-10.

## Secondary Research Question 3: Group B Enumeration

**Re-verified live 2026-08-12**, not merely re-read from CONTEXT.md:

```
$ npx convex run events:listByType '{"eventType":"prompt_assembly","limit":5}' ...        -> []
$ npx convex run events:listByType '{"eventType":"structured_output_exhausted","limit":5}' ... -> []
$ npx convex run events:listByType '{"eventType":"vision.capture","limit":5}' ...          -> []
$ npx convex run events:listByType '{"eventType":"control_verb_focus","limit":5}' ...      -> []
```

All 4 confirmed still zero-arrival, consistent with D-03. Combined with the two measured
kinds above and the already-routed `control_verb_swap`, **D-03's 7-kind Group B list is
confirmed complete** — no evidence of an 8th kind. The origin document
(`.planning/milestones/v13.0-phases/105-tool-trace-observability/deferred-items.md:83-89`)
independently derived the same 7 kinds by grepping astridr's `ctx.telemetry.send(...)`
call sites (`feature/brain-swap` branch) — two independent methods (emitter-existence
grep and live-arrival probe) converge on the same list, which is stronger evidence than
either alone.

**Spelling verified exactly as the ingest switch and live data spell them** (no
hyphen/underscore/colon mismatches found): `governor_decision`, `control_verb_swap`
(already a case, `runtimeIngest.ts:1022`), `message_routed`, `prompt_assembly`,
`structured_output_exhausted`, `vision.capture`, `control_verb_focus`. All match the
`eventType` string used in both the contract doc's JSON examples and the live probe
queries verbatim.

## Secondary Research Question 4: Retention Window Choice

Precedent table, read directly from `convex/retention.ts`:

| Table | Window | Stated reason | Read pattern |
|---|---|---|---|
| `gatewayQuotaSnapshots` (D-20) | 30 days | Poll snapshots, ~288 rows/provider/day; "only the latest row per provider is ever read... pure headroom for trend queries" | Latest-per-key |
| `toolPolicyEvents` (Phase 105 D-05) | 90 days | "Boot/reload fire once per boot, and denials and leaks are rare by design" — low-volume, keeps the feed useful across a milestone | Time-range scan (`by_event` compound index) |
| `activeEngineSnapshots` (Phase 108 D-10) | 30 days | "Only the latest row per profile is ever read... any window is pure headroom, not a functional limit" | Latest-per-profile |
| `controlVerbSwaps` (Phase 108 D-14) | 30 days | "Manual/rare operator action... 30 days is ample without reaching for the 90-day build/history tier" | Bounded `.take(CAP)` audit list |

`governor_decision` at the **measured 83.3 rows/day** does not match the "rare, once per
boot" framing that justified `toolPolicyEvents`' 90-day window, nor the "latest row only"
framing of `activeEngineSnapshots`/`gatewayQuotaSnapshots`. Its read pattern (a bounded
`.take(CAP)` audit list, per the UI-SPEC's `GovernorDecisionLog`) is structurally closest
to `controlVerbSwaps` — an append-only audit trail read via a capped list, not a
latest-per-key lookup. At 83/day, a 30-day window (matching `controlVerbSwaps`) would
accumulate ~2,500 rows; a 90-day window (matching `toolPolicyEvents`) would accumulate
~7,500 rows. Neither is large in absolute terms for a single SQLite table, and per
CLAUDE.md's DUR-03 finding, the self-hosted instance's memory growth is **not** correlated
with data volume (`db.sqlite3` stayed byte-identical across a 7.6→31 GiB working-set
climb) — so the choice here is about read-cost/relevance, not the OOM hazard directly.
D-06's actual requirement (bound it BEFORE it can need a mass delete) is satisfied by any
finite window; this is genuinely the planner's discretionary call, but **30 days
(matching `controlVerbSwaps`, the closest structural analog) is the best-fit precedent** —
recorded here as a recommendation, not a decision, per CONTEXT.md's discretion grant.

`message_routed` at ~0.7-1.2 rows/day is lower-volume than every existing precedent table
— a 90-day window (matching `toolPolicyEvents`' "rare event" framing, or even longer)
would accumulate well under 200 rows total. This is squarely in the "ample headroom, not a
functional limit" category regardless of the exact number chosen.

## Secondary Research Question 5: astridr-repo Doc Edit Surface (TELE-01)

- **§2.20–§2.24 headings confirmed at exact line numbers**
  (`C:\Users\mandr\astridr-repo\docs\astridr-contract.md`):
  `### 2.20 instructions_loaded` (line 674), `### 2.21 loop_lifecycle` (703),
  `### 2.22 worktree_lifecycle` (736), `### 2.23 batch_execution` (765),
  `### 2.24 auto_memory` (798).
- **Critical-events rows confirmed verbatim at lines 1785-1787** — three consecutive
  table rows for `worktree_lifecycle`, `batch_execution`, `loop_lifecycle`, immediately
  followed by a `subagent_job` row (line 1788, NOT part of Group A, must not be touched)
  and the table's closing "Framework implementation" note.
- **v1.6.0 changelog confirmed verbatim at line 1884**, including the exact text D-09
  requires the banner to reflect: `"Claude Code Feb/Mar 2026 release alignment... Added 5
  new event types (§2.20–§2.24)... See docs/new_claude_capabilities.md for full
  implementation PRD."`
- **`docs/new_claude_capabilities.md` confirmed present**: `16,181 bytes, mtime Mar 9
  15:29` — date matches the v1.6.0 changelog entry (2026-03-09) exactly, safe to cite.
- **No doc-linting or doc-touching CI in astridr-repo.** `.github/workflows/` contains
  exactly 4 workflows: `eval-net.yml`, `gitleaks-scan.yml`, `kg-benchmark.yml`,
  `supabase-migration-check.yml` — none reference `docs/*.md` or run a markdown linter.
  No `.markdownlint*` config file exists at repo root. **A banner insertion into
  `astridr-contract.md` will not trip any CI gate.** `gitleaks-scan.yml` scans for
  secrets, not doc structure — irrelevant to prose-only banner text, but worth noting the
  banner text itself must not contain anything secret-shaped (it won't; it's a dated
  "NOT EMITTED" notice).
- **Confirmed doc-only, no code, no rebuild** — no `.py`/`.ts` files reference
  `astridr-contract.md` by path (it is documentation, not a generated or lint-checked
  artifact); the only "consumer" of this file's accuracy is future human/agent readers.

**One unrelated doc-hygiene observation, informational only (not in scope for TELE-01):**
the file's own header claims `Version: 1.8.0` (line 3) but the changelog table's last
entry is `1.7.0` (2026-07-06) — the 1.8.0 bump was never logged. Not a TELE-01 blocker
(D-07/D-08/D-09 don't touch the header or changelog table structure), but a future
astridr-repo doc-hygiene phase might want it. Not included in this phase's scope.

## Secondary Research Question 6: Convex Deploy Step

**Confirmed, this repo's own precedent (Phase 110 DUR-03, `110-DUR-EVIDENCE.md`,
`110-04-SUMMARY.md`, `110-05-PLAN.md`):** the correct, safe, already-proven invocation
for deploying a `convex/schema.ts` change to THIS self-hosted instance is

```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

**Confirmed present on disk:** `find` located both
`C:\Users\mandr\convex-selfhost\selfhosted.envfile` and `...envfile.example` — the real
credential file exists (not read for contents, per the project's env-file-secrecy rule).

**Do NOT use** `npm run deploy` (`package.json`'s script — runs bare `npx convex deploy &&
npx vite build`) or CLAUDE.md's own documented `npx convex deploy --yes` command as
written, **without** the `--env-file` flag: per this repo's memory notes
(`convex-topology-all-local.md`), the CLOUD deployment (`tidy-whale-981`) is
"retired/frozen 2026-07-15," and a bare `npx convex deploy` with ambient
`CONVEX_DEPLOY_KEY`/project config could target that stale, frozen deployment instead of
the live self-hosted instance — the schema change would appear to succeed (exit 0) while
never reaching the backend this phase's ingest code actually talks to. **This is a
required, explicit task for the planner** (not implied by `npm run build`/`npm test`
passing): build and typecheck succeed with a schema-only change never deployed, so CI
green is a false-positive signal for this specific step. Flag this exact risk in the
plan's verification steps.

`110-DUR-EVIDENCE.md:5,502,526` and `110-04-SUMMARY.md:58,127` are the load-bearing
precedent — this exact `--env-file` form was proven live-reachable for both `internalQuery`
functions and raw `--inline-query` reads against this instance in Phase 110, and is
recorded there as the safer form specifically because it "never places a credential value
on the command line" (unlike this research's own `--admin-key` probes above, which did).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Optional-field null/absent normalization at the ingest boundary | A new ad-hoc `?? undefined` or truthiness check per field | `isOptionalString`/`isOptionalNumber`/`isOptionalStringArray` + `normalizeOptional` (`runtimeIngest.ts:207-268`) | Already handles the exact `null`-vs-`undefined`-vs-absent footgun this phase's own `held_reason` data proves is live; a hand-rolled check risks re-discovering the same defect two phases later, as happened once already for `control_verb_swap` |
| Bounded recent-rows read for a new domain table | A raw `.collect()` with in-memory `.slice()` | `.withIndex(...).order("desc").take(CAP)` | `events:countByType`'s `.collect()` is the CLAUDE.md-documented anti-pattern that contributed to the 2026-07-21/22 OOM incident; every existing domain-table query in this repo (`listByScope`, `listGlobal`) uses bounded `.take()` |
| Drift detection between a disposition list and the real switch/schema | A manually-maintained checklist doc | Source-level regex parsing of `runtimeIngest.ts`/`schema.ts` inside a Vitest suite, following `retention.test.ts`'s pattern | Proven pattern in this exact repo, with a documented mutation-testing history showing what generic assertions miss |
| Cross-module constant sharing between a Convex server file and client code | Re-exporting a constant from a file that also exports `internalMutation`/`query` | A dedicated `*Filters.ts` pure-helpers file | `controlVerbSwaps.ts:18-27`'s explicit warning: doing this once already pulled the Convex server runtime into the client bundle |

**Key insight:** every hand-roll risk in this phase has already been hit once in this exact
codebase for the `control_verb_swap` precedent and fixed with a specific, named pattern —
this phase's job is to reuse those patterns, not rediscover the bugs they fix.

## Common Pitfalls

### Pitfall 1: `held_reason` explicit-null rejection (governor_decision-specific)

**What goes wrong:** A resolver that forwards `held_reason: null` straight to a
`v.optional(v.string())` mutation argument throws inside the switch case.
**Why it happens:** Convex's `v.optional(...)` accepts an omitted key or `undefined` but
rejects an explicit JSON `null` — and live data shows astridr's telemetry sender emits
explicit `null` for `held_reason` on 424 of 646 held rows (65.6%).
**How to avoid:** Apply `isOptionalString`/`normalizeOptional` to `held_reason` exactly as
`resolveControlVerbSwapEvent` does for `session_id` (`runtimeIngest.ts:369-421`).
**Warning signs:** If the plan's resolver test suite doesn't include a case for
`held_reason: null` (not just `held_reason: undefined` and `held_reason: "focus"`), it has
not covered the majority real-world shape.

### Pitfall 2: Bare `npx convex deploy` targeting the wrong backend

**What goes wrong:** Schema change is written and typechecks, but never reaches the
self-hosted instance the ingest code actually runs against — CI stays green, the feature
silently doesn't work.
**Why it happens:** The cloud deployment (`tidy-whale-981`) is retired but its config may
still be ambient; `--env-file` is required to force-target the self-hosted instance.
**How to avoid:** Always deploy with
`--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`, and verify post-deploy by
probing the new table exists via `npx convex run --env-file <path> --inline-query "..."`.
**Warning signs:** `npm run build`/`npx tsc --noEmit` passing is not evidence the backend
was deployed — this phase must include an explicit deploy-and-verify task.

### Pitfall 3: Un-bounded `emitter`/`priority` enum assumptions

**What goes wrong:** Constraining the new domain table's `emitter` column (or a UI filter)
to the contract's illustrative emitter list would silently exclude the majority of real
rows — `watch_pulse` alone is 78.9% of measured `governor_decision` volume, but a dozen
`cron:<taskname>`-namespaced and operational emitters (`startup_test`, `cron_failure`,
`watch_pulse_duplicate_alert`, `focus_exit_digest`) also appear and aren't in the
contract's example list at all.
**Why it happens:** The contract gives 2 illustrative examples ("e.g. reminder_nudge,
watch_pulse"), easy to mistake for an exhaustive enum.
**How to avoid:** Keep `emitter` as `v.string()` (matches this schema's existing
defensive-boundary convention for `verb`/`path` in `controlVerbSwaps`, per
`schema.ts:2136-2139`'s own comment), never a `Literal` union.
**Warning signs:** A test asserting "emitter is one of {list}" would need constant
updating and is evidence of exactly this trap.

### Pitfall 4: Reading `countByType` "just this once" for convenience

**What goes wrong:** A future re-measurement (D-02 requires this to be re-measurable) that
reaches for `events:countByType` instead of `events:listByType` performs an unbounded
`.collect()` against the live single-node instance.
**Why it happens:** `countByType` gives an exact count in one call, which is tempting
when `listByType`'s `.take()` cap requires the span-based extrapolation this research had
to do.
**How to avoid:** Never call it. This research's `governor_decision` and `message_routed`
totals were obtained safely by raising `listByType`'s `limit` argument until the result
came back under the cap (proving completeness), never by `.collect()`.
**Warning signs:** Any future plan or script that imports/calls `countByType` against the
live URL — this function should arguably be deleted or clearly marked test-only, though
that's outside this phase's scope.

## Code Examples

### The null-normalization pattern to reuse for `held_reason`

```typescript
// Source: convex/runtimeIngest.ts:207-268, 369-421 (this repo, live code)
function isOptionalString(value: unknown): value is string | undefined | null {
  return value === undefined || value === null || typeof value === "string";
}
function normalizeOptional<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

// In a new resolveGovernorDecisionEvent(data, timestamp):
const heldReason = d.held_reason;
if (!isOptionalString(heldReason)) return null; // type guard: skip on wrong-typed
// ... later, in the returned object:
return {
  emitter,
  priority,
  spoke,
  heldReason: normalizeOptional(heldReason), // strips explicit null -> undefined
  timestamp,
};
```

### The bounded-read pattern for the new domain table's list query

```typescript
// Source: convex/controlVerbSwaps.ts:76-87 (this repo, live code)
export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("governorDecisions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(GOVERNOR_DECISION_CAP); // never .collect()
  },
});
```

### The RETENTION_DAYS entry pattern to copy

```typescript
// Source: convex/retention.ts:2140-2159 comment block (this repo, live code, paraphrased shape)
export const RETENTION_DAYS: Record<string, number> = {
  // ... existing entries ...
  // Phase 112 D-06: new table, bounded BEFORE it can ever grow (same pre-emptive
  // move as controlVerbSwaps/activeEngineSnapshots above). Measured 2026-08-12:
  // ~83.3 rows/day (1,168 rows/14.02-day window, uncapped read) — an append-only
  // audit log read via a capped .take(), same read pattern as controlVerbSwaps.
  governorDecisions: 30, // <- planner's discretionary window, recommend 30 (see Q4 above)
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| "arrival ~ live in a short sample window" (Phase 105's 0.66h sample) | 14-day full-window census via raised `.take()` limit until uncapped | 2026-08-12 (this research + D-03) | Eliminates the "cannot establish absence for a rare event" weakness the origin doc itself flagged; this research's `message_routed`/`governor_decision` numbers are complete-population counts, not samples |
| Deleting/relocating aspirational contract sections | Dated in-place "NOT EMITTED — aspirational" banner (D-07) | This phase | Avoids a second renumbering disruption (the doc's own changelog already records one renumbering as painful) |

**Deprecated/outdated:** none identified specific to this phase's scope — the
`control_verb_swap` pattern this phase imitates is itself current (Phase 108/109,
2026-08-07/11), not a stale precedent.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 30-day retention window is the best-fit precedent for `governorDecisions` (vs. 90-day `toolPolicyEvents` framing or a different value) | Secondary Q4 | Low — D-06 only requires SOME bound before growth; this is explicitly Claude's Discretion per CONTEXT.md, recommendation only, not a locked claim |
| A2 | `message_routed`'s `profile` field is not a fixed enum (only `"personal"` observed) | Primary Research Question, message_routed payload shape | Low — schema should use `v.string()` regardless; if wrong, only affects documentation precision, not the schema decision |

**All other factual claims in this document are either `[VERIFIED: live probe]` (the
volume measurements, payload shapes, control-pair results — all reproduced above with
exact commands and outputs) or `[VERIFIED: file:line]` (every code/doc citation was read
directly in this session, not recalled from training data).** No `[ASSUMED]`-tagged claim
in this document rests on unverified package/library knowledge — this phase does not
introduce any new external dependency.

## Open Questions

1. **Exact table/column names for the new `message_routed` domain table.**
   - What we know: the payload shape (`channel`, `profile`, `sender`, `session_id`) and
     that it needs its own UI design pass per the UI-SPEC's explicit warning.
   - What's unclear: naming (`messageRoutedEvents`? `routedMessages`?) and whether it
     needs a `by_profile` index (given `profile` is a real field here, unlike
     `governor_decision` which has none) — this could support a future per-profile
     "recent inbound messages" view the UI-SPEC didn't scope.
   - Recommendation: planner's discretion, same as `governor_decision`'s naming (already
     granted in CONTEXT.md's Claude's Discretion section) — but flag that `message_routed`
     doesn't have a CONTEXT.md-approved UI-SPEC yet, so its build may need a short design
     pass before implementation, per the UI-SPEC's own note.

2. **Whether `message_routed`'s route+surface work fits inside Phase 112 or should be a
   fast-follow.**
   - What we know: the volume gate is cleared, and CONTEXT.md's Deferred Ideas section
     anticipated the opposite outcome ("if D-05's volume measurement disqualifies it...").
     The measurement disqualifies neither kind, so both are now in scope by D-04+D-05's own
     logic.
   - What's unclear: whether the phase's task budget accounts for a SECOND UI design pass
     (message_routed's own component, per the UI-SPEC's explicit non-reskin warning) on top
     of the already-approved `GovernorDecisionLog`.
   - Recommendation: the planner should treat this as a scope decision to make explicitly
     (build both in this phase vs. `governor_decision` now + `message_routed` fast-follow),
     not silently absorb it — the UI-SPEC was written before this measurement existed and
     scoped only `governor_decision`'s UI.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (`"test": "vitest"`, `package.json:11`) |
| Config file | none dedicated — Vite/Vitest config is inline in `vite.config.ts` (jsdom environment, setup file `src/test/setup.ts`) |
| Quick run command | `npx vitest run convex/<new-file>.test.ts` (single file, <30s) |
| Full suite command | `npm test` (Vitest, all `src/**/*.test.tsx` + `convex/**/*.test.ts`) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TELE-03 | `governor_decision` resolver correctly normalizes `held_reason: null` to `undefined` | unit | `npx vitest run convex/runtimeIngest.test.ts -t "governor_decision"` | ❌ new test cases needed in the existing `runtimeIngest.test.ts` (file exists, precedent: `resolveControlVerbSwapEvent`'s own test block) |
| TELE-03 | New domain table's `record` mutation is `internalMutation`, not client-callable (CR-01) | unit | `npx vitest run convex/<domain>.test.ts -t "CR-01"` | ❌ Wave 0 — new file, follow `controlVerbSwaps.test.ts:115-131`'s exact source-level guard pattern |
| TELE-03 | New domain table's list query never `.collect()`s | unit | `npx vitest run convex/<domain>.test.ts -t "bounded"` | ❌ Wave 0 — follow `controlVerbSwaps.test.ts:133+`'s pattern |
| TELE-03 | New `RETENTION_DAYS` entries bound the new table(s) at a positive integer window | unit | `npx vitest run convex/retention.test.ts` | ✅ file exists, extend it (mirrors `retention.test.ts:68-71`'s exact pattern) |
| TELE-03 | D-10 disposition const: every Group B kind has exactly one disposition, test fails on an undisposed/deleted entry | unit | `npx vitest run convex/<disposition-file>.test.ts` | ❌ Wave 0 — new file, follow `retention.test.ts`'s full pattern (liveness guard + specific known-present assertions, per Secondary Q2 above) |
| TELE-03 | New UI surface (`GovernorDecisionLog`) renders loading/empty/error states honestly | component | `npx vitest run src/components/GovernorDecisionLog.test.tsx` | ❌ Wave 0 — follow `DeliveryHistory.tsx`'s test precedent if one exists (verify at plan time) |
| TELE-01 | astridr-contract.md banners present, critical-events rows removed | manual | `grep -c "NOT EMITTED" docs/astridr-contract.md` (expect 5); `sed -n '1785,1787p'` (expect the 3 target rows absent) | manual verification, doc-only change, no astridr-repo test suite covers doc prose |
| TELE-03 (live) | New route actually receives live rows post-deploy | live probe | `npx convex run --env-file <path> governorDecisions:listRecent` (or equivalent) — assert rows exist with real `emitter` values, not an empty array | manual, post-deploy verification step (see Pitfall 2) |

### Sampling Rate

- **Per task commit:** targeted `npx vitest run <changed-file>.test.ts`
- **Per wave merge:** `npm test` (full suite) + `npx tsc --noEmit`
- **Phase gate:** full suite green AND the live post-deploy probe (TELE-03 live row above)
  before `/gsd:verify-work` — build/typecheck passing is explicitly NOT sufficient (Pitfall
  2: a schema change can typecheck while never reaching the self-hosted backend).

### Wave 0 Gaps

- [ ] `convex/<domain>.test.ts` (e.g. `governorDecisions.test.ts`) — CR-01 guard +
      bounded-read guard + args-shape-from-live-validator tests, mirroring
      `controlVerbSwaps.test.ts` in full
- [ ] `convex/<disposition-file>.test.ts` — D-10's drift guard, mirroring
      `retention.test.ts`'s liveness-guard + known-present-assertion pattern
- [ ] New test cases inside the existing `convex/runtimeIngest.test.ts` — resolver
      null-normalization cases for `held_reason` (and `message_routed`'s fields if routed)
- [ ] `src/components/GovernorDecisionLog.test.tsx` — loading/empty/error states per
      UI-SPEC's States section (verify whether a comparable `DeliveryHistory.test.tsx`
      exists as a template at plan time)
- [ ] Framework install: none — Vitest is already configured and used repo-wide

## Security Domain

> This phase's `security_enforcement` status was not found explicitly set in
> `.planning/config.json`'s available excerpt; treating as enabled per the default rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new auth surface |
| V3 Session Management | No | No session handling introduced |
| V4 Access Control | Yes | New domain-table write path MUST be `internalMutation` (CR-01 rule, not a public `mutation`) — the exact pattern `controlVerbSwaps.record` and `activeEngine.recordRouting` already use, and the exact gap this repo's CLAUDE.md documents as unenforced for 197 of 215 public mutations (SEED-008) |
| V5 Input Validation | Yes | Runtime type-guards (`isOptionalString` etc.) on every field before it reaches a Convex validator — required, not optional, given the live `held_reason` null/absent finding above |
| V6 Cryptography | No | No credential/crypto material introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Devtools-forgeable write to a new domain table (any holder of `VITE_CONVEX_URL` calling `api.<domain>.record` directly to fabricate a fake "server-confirmed" governor decision) | Spoofing/Tampering | Declare the write mutation as `internalMutation`, never `mutation` — closes the client-callable `api.` namespace entirely, per `controlVerbSwaps.ts:38-44`'s own documented rationale |
| Unbounded read against the live single-node instance (a new query that `.collect()`s instead of `.take()`s) | Denial of Service | Every new query MUST use `.withIndex(...).take(CAP)`, never `.collect()` — this is the documented cause of the 2026-07-21/22 OOM incident cited throughout CLAUDE.md |
| Schema change silently not deployed to the live backend (false-positive CI green) | (not classic STRIDE — availability/integrity of the deployed system) | Explicit `--env-file`-scoped deploy step + post-deploy live probe, per Pitfall 2 above; this is a process control, not a code control |

## Sources

### Primary (HIGH confidence — live probes, this session)
- `npx convex run events:listByType` against `http://127.0.0.1:3210` (self-hosted
  `convex-backend`, confirmed healthy via `docker ps` before probing) — 6 distinct probes:
  known-present control (`llm_call`), known-absent control
  (`definitely_not_a_real_kind_9x7q2`), `governor_decision` at limits 200/1000/1500,
  `message_routed` at limit 1000, and the 4 zero-arrival kinds re-verified at limit 5 each.
- `date +%s` / `date -u -d @<epoch>` — wall-clock unit sanity check.

### Primary (HIGH confidence — file:line reads, this session)
- `convex/runtimeIngest.ts` (lines 200-268, 340-620, 990-1071) — dispatch switch, type
  guards, `resolveControlVerbSwapEvent`, per-event try/catch structure.
- `convex/schema.ts` (lines 1-40, 595-637, 1595-1616, 2095-2170) — `runtime_events`,
  `toolPolicyEvents`, `gatewayQuotaSnapshots`, `activeEngineSnapshots`, `controlVerbSwaps`
  table definitions.
- `convex/events.ts` (lines 1-60, 255-322) — `events:listByType`, `events:countByType`.
- `convex/retention.ts` (lines 1-100) — `RETENTION_DAYS` map and its precedent comments.
- `convex/retention.test.ts` (full file, 231 lines) — D-10 guard-test model.
- `convex/controlVerbSwaps.ts` (full file) — `record`/`listByScope`/`listGlobal`.
- `convex/controlVerbSwapsFilters.ts` (partial, `SWAP_HISTORY_CAP` = 20) — CAP precedent.
- `src/hooks/useControlVerbSwaps.ts` (full file) — hook wrapping pattern.
- `src/pages/Settings.tsx` (lines 19-21, 970-982) — `DeliveryHistory`/`NotificationPreferences` host location, confirms UI-SPEC's cited lines.
- `C:\Users\mandr\astridr-repo\docs\astridr-contract.md` (lines 1-5, 578-651, 674-798,
  1253-1293, 1780-1889) — contract §2.16 `message_routed`, §2.20-2.24 headings, §2.40
  `governor_decision`, critical-events table, full changelog.
- `.planning/milestones/v13.0-phases/105-tool-trace-observability/deferred-items.md`
  (full file) — Group A/B origin, independent emitter-grep evidence.
- `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md`,
  `110-04-SUMMARY.md`, `110-05-PLAN.md` (grep hits) — `--env-file` deploy precedent.
- `C:\Users\mandr\astridr-repo\.github\workflows\` (directory listing) — CI surface check.
- `find` for `selfhosted.envfile` — confirmed present, not read.

### Secondary (MEDIUM confidence)
- None — this phase required no external/library research; all findings are internal
  codebase/data investigation, verifiable by re-running the exact commands shown.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new libraries introduced by this phase
- Architecture (routing pattern): HIGH — read directly from shipped, tested Phase 108/109 code
- Volume measurements (D-05): HIGH — live, control-paired, unit-sanity-checked, uncapped-result-verified
- Pitfalls: HIGH — the `held_reason` null-divergence is a direct live-data finding cross-checked against existing in-repo code precedent for the identical defect class

**Research date:** 2026-08-12
**Valid until:** Volume measurements should be treated as re-measurable, not permanent
(D-02's own requirement) — re-verify before relying on these numbers if planning starts
more than ~7 days after this research date, since `governor_decision`'s `watch_pulse`
majority emitter is itself subject to change. Routing-pattern and doc-structure findings
are stable until the next schema/contract-restructuring phase (no fixed expiry).
