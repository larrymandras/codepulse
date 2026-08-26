---
phase: 127
slug: ack-aware-retention-janitors
status: planned  # task IDs assigned 2026-08-25 by /gsd:plan-phase 127
nyquist_compliant: true
wave_0_complete: false  # tests are Wave 3 (plans 127-04, 127-05); the handlers they cover are Wave 2
created: 2026-08-25
---

# Phase 127 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `127-RESEARCH.md`'s `## Validation Architecture` section and
> `127-CONTEXT.md`'s Verification Criteria A–F.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`"test": "vitest"`, confirmed live 2026-08-25 as the sole runner) |
| **Config file** | `vitest.config.ts` — its `include` array covers `convex/**/*.test.ts` (line 59) |
| **Quick run command** | `npx vitest run convex/inbox.test.ts convex/ideation.test.ts` |
| **Full suite command** | `npm test` (equivalently `npx vitest run`) |
| **Estimated runtime** | ~5s quick / full suite per repo norm |

**Load-bearing constraint: there is no `convex-test` runtime harness in this repo.**
Every Convex test uses a hand-rolled in-memory fake `ctx.db` (documented at
`convex/runtimeIngest.test.ts:9`, repeated across ~25 files, confirmed by repo-wide
grep 2026-08-25). This determines how Verification A can and cannot be proven —
see "Known limitation" below.

---

## Sampling Rate

- **After every task commit:** `npx vitest run convex/inbox.test.ts convex/ideation.test.ts`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** full suite green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

Task IDs assigned 2026-08-25. Requirement IDs were minted at the same time and now
exist in `.planning/REQUIREMENTS.md`: **JANITOR-01** (inbox janitor), **JANITOR-02**
(ideationFindings janitor), **JANITOR-03** (coverage-bucket move) — the three-way split
RESEARCH.md recommended, confirmed by the planner.

Note the table below covers `inbox` rows; the identical A/B/C/D set exists for
`ideationFindings` in plan 127-05, against `dismissed`/`dismissedAt` instead of `closedAt`.

| Task ID | Plan | Wave | Requirement | Verification | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|--------------|----------|-----------|-------------------|-------------|--------|
| 127-04 T1 | 127-04 | 3 | JANITOR-01 | **A** | Absent `closedAt` (inbox) / `dismissedAt` (ideationFindings) structurally excluded from the delete-step index range — asserted at the QUERY layer, with a control row whose field is explicitly `0` that IS returned | unit (query-layer, NOT outcome-layer) | `npx vitest run convex/inbox.test.ts -t "structural"` | ❌ W0 | ⬜ pending |
| 127-04 T2 + 127-05 T2 (auto) / 127-07 T1 (manual control) | 127-04 | 3 | JANITOR-01, JANITOR-02 | **B** | `held` / `money` / `critical`+`high` carve-outs survive a guard-deletion mutation-testing control | unit (mutation pair: intact run + guard-removed re-run) | `npx vitest run convex/inbox.test.ts -t "carve-out"` · `convex/ideation.test.ts -t "carve-out"` | ❌ W0 | ⬜ pending |
| 127-04 T3 + 127-05 T2 | 127-04 | 3 | JANITOR-01, JANITOR-02 | **C** | An all-excluded batch still advances the cursor and does not reschedule unchanged | unit — direct regression test for `retentionCursor.ts:122-139` | `npx vitest run convex/inbox.test.ts -t "cursor advances on skip"` | ❌ W0 | ⬜ pending |
| 127-04 T3 + 127-05 T2 | 127-04 | 3 | JANITOR-01, JANITOR-02 | **D** | Full-batch reschedules / short-batch stops / ceiling reached does zero further work | unit — adapted from `media.test.ts:636-713` | `npx vitest run convex/inbox.test.ts -t "batch"` | ❌ W0 | ⬜ pending |
| 127-06 T2 | 127-06 | 3 | JANITOR-03 | **E** | Both tables in `COVERAGE_BOUNDED_BY_CRON`, both crons registered LIVE (non-commented) | unit — existing machine-check | `npx vitest run convex/retentionCoverage.test.ts` | ✅ mechanism exists (`retentionCoverage.test.ts:130-142`); only the DATA is new | ⬜ pending |
| 127-04 T1 | 127-04 | 3 | JANITOR-01 | **R-02** | Auto-close step's patch call NEVER names `ackedAt` (source-level assertion, per `media.test.ts:740-743` convention) | unit — source-text assertion | `npx vitest run convex/inbox.test.ts -t "never patches ackedAt"` | ❌ W0 | ⬜ pending |
| 127-08 T3 | 127-08 | 5 | JANITOR-01, JANITOR-02 | **F** | First backlog-draining run observed in `docker logs convex-backend` with no crash-loop | **manual** — see Manual-Only below | n/a | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Verification R-02 is not lettered in CONTEXT.md** — CONTEXT.md's A–F list predates
the 2026-08-25 revision. It is required, not implied by B, and the planner must add
it explicitly. It is the most direct test of the thing the revision exists to prevent.

---

## Wave 0 Requirements

- [ ] `convex/inbox.test.ts` — new describe blocks for A, B, C, D, R-02 (file exists; blocks do not)
- [ ] `convex/ideation.test.ts` — new describe blocks for B (carve-out) and the janitor chain
- [ ] Mock `ctx.db` fixture modelled on `media.test.ts:513-560`'s `makeJanitorMockCtx`,
      adapted to `closedAt` / `dismissedAt`
- [ ] No framework install needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Verification | Why Manual | Test Instructions |
|----------|--------------|------------|-------------------|
| Carve-out guard genuinely exercises the exclusion | **B** control | No `convex-test` harness; the control requires deleting the guard line and re-running. RESEARCH.md notes a parameterized-injection variant may make this CI-safe — planner should prefer that if it does not weaken the control | Run the carve-out test suite. Then delete the `itemType !== "held"` line in the auto-close handler and re-run the identical test. The held row MUST now also be auto-closed and deleted. If the outcome does not flip, the test proves nothing. Repeat for `priority === "money"` and `severity IN {critical, high}`. Restore the guard. |
| Index deploy diff | **D-06** | Convex's docs do not cover widening an index under an unchanged name; only a real deploy settles it | Run `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. Read the output for the `by_dismissed` widening. Confirm it reports "No indexes are deleted by this push" — or, if it reports a delete+re-add, record that and reassess before proceeding. |
| First backlog-draining run | **F** | Requires a real deploy plus a real cron firing against the live single-node SQLite backend | After the 08:20/08:35 UTC fire: `docker logs convex-backend --since 1h \| grep -i "inbox\|ideation"`. Confirm the chain drained (~13 batches inbox) with no OOM crash-loop. Do NOT accept the cron's own success line as proof. |
| `ideationFindings` inert-run log | **R-01** | At M=180d the auto-dismiss matches zero rows until ~2026-11-16 | Confirm the janitor logs a line stating it ran and matched nothing. For ~83 days this log line is the ONLY signal distinguishing "correct and dormant" from "dead on arrival". |
| No third `ackedAt` closure-consumer | **R-02** | RESEARCH.md grepped `ackedAt` but did not do an exhaustive whole-repo consumer audit | Grep `ackedAt` across `src/**` and `convex/**`; confirm no consumer besides `Inbox.tsx:130`, `IntelligenceFeedPanel.tsx:64`, and the two `held`-only queries treats it as a general closure signal. |

---

## Known limitation — Verification A proves less than it appears to

Because there is no `convex-test` harness, "the database-level index range excludes
absent fields" can only be asserted against a **hand-rolled mock query builder that
reimplements that exclusion in JavaScript** — the pattern `media.test.ts:513-560`
already uses (its `.take()` filters `r.deletedAt !== undefined` as an explicit line,
`media.test.ts:548`).

So Verification A demonstrates that **the handler asks the index for the right
range**. It does **not** demonstrate that Convex's real index excludes `undefined`.
That property rests on the docs citation (`controlVerbSwaps.ts:105-109` →
docs.convex.dev/database/types) and on two existing production call sites depending
on it, *not* on this test.

RESEARCH.md flags that this ordering guarantee was **not** re-fetched from live docs
for `closedAt` in that research pass. The property is general to Convex's indexing
engine rather than field-specific, so there is no reason to expect divergence — but
it is corroborating evidence, not verification.

**State this in the plan.** Do not let a green A imply more than it proves. The
control (seed a row with `closedAt` explicitly `0`, assert it IS returned under the
same cutoff) is what keeps the test meaningful rather than tautological — keep it.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] Verification R-02 (`ackedAt` never patched) present in a plan
- [ ] Verification A's limitation stated explicitly in the plan text
- [x] `nyquist_compliant: true` set in frontmatter
- [x] Verification R-02 present in plan 127-04, Task 1 (behavioural + source-level, with a
      `closedAt:` control hit so the `ackedAt` zero is discriminating)
- [x] Verification A's limitation required in the plan text AND in the test file (127-04 T1,
      127-05 T1)
- [x] Two verifications added that CONTEXT.md's A-F list does not carry, both mandatory:
      a **unit-scale control** (a row created this instant must NOT be auto-closed) and, for
      `ideationFindings`, R-01's **zero-row log assertion** with a non-1970 cutoff year. Every
      timestamp in both tables is epoch SECONDS while the `media.ts` template this phase clones
      is MILLISECONDS — a cutoff computed in ms and compared against a seconds field is larger
      than every row's timestamp, so the janitor would auto-close rows created moments ago.
      Neither source artifact states the units.

**Approval:** planner-approved 2026-08-25. Sign-off items above verified against the eight
PLAN.md files as written; the two manual gates (127-07, 127-08) remain outstanding by design.
