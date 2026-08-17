---
phase: 112
slug: telemetry-coverage-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 112 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `112-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`"test": "vitest"`, `package.json:11`) |
| **Config file** | none dedicated — Vitest config is inline in `vite.config.ts` (jsdom env, setup `src/test/setup.ts`) |
| **Quick run command** | `npx vitest run convex/<changed-file>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s quick / full suite per repo norm |

Type check (not a test, but gated the same): `npx tsc --noEmit`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-file>.test.ts`
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite green **AND** the live post-deploy probe below
- **Max feedback latency:** ~30 seconds (targeted run)

**Explicitly insufficient:** build + typecheck passing. A `convex/schema.ts` change
typechecks without ever reaching the self-hosted backend, producing a false-positive
verification. The live probe is not optional.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are the required verifications and are
mapped to task IDs at plan time.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TELE-03 / D-14 | — | Resolver normalizes `held_reason` across all 3 wire shapes (explicit `null`, key-absent, string) — no event silently dropped into `droppedCount` | unit | `npx vitest run convex/runtimeIngest.test.ts -t "governor_decision"` | ✅ file exists, new cases | ⬜ pending |
| TBD | TBD | TBD | TELE-03 | T-112-01 | New domain table `record` mutation is `internalMutation`, not client-callable (CR-01) | unit | `npx vitest run convex/<domain>.test.ts -t "CR-01"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TELE-03 | T-112-02 | New list query is bounded — never `.collect()`s | unit | `npx vitest run convex/<domain>.test.ts -t "bounded"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TELE-03 / D-06 | — | Every new domain table has a positive-integer `RETENTION_DAYS` entry | unit | `npx vitest run convex/retention.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | TELE-03 / D-10, D-11 | — | Disposition const: every Group B kind has exactly one disposition with reason + measurement date; test **fails** on an undisposed or deleted entry | unit | `npx vitest run convex/<disposition-file>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TELE-03 / D-13 | — | `message_routed` route persists rows to its domain table (route only — no UI surface this phase) | unit | `npx vitest run convex/runtimeIngest.test.ts -t "message_routed"` | ✅ file exists, new cases | ⬜ pending |
| TBD | TBD | TBD | TELE-03 (UI) | — | `governor_decision` surface renders loading / empty / error states per UI-SPEC § States | component | `npx vitest run src/components/<Surface>.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | TELE-01 / D-07, D-08, D-09 | — | 5 Group A banners present; 3 critical-events rows removed | manual + grep | `grep -c "NOT EMITTED" docs/astridr-contract.md` (expect 5); assert the 3 rows absent | astridr-repo, doc-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/<domain>.test.ts` — CR-01 internalMutation guard + bounded-read guard, mirroring `convex/controlVerbSwaps.test.ts:115-131` and `:133+`
- [ ] `convex/<disposition-file>.test.ts` — D-10 drift guard, mirroring `convex/retention.test.ts`'s liveness-guard + known-present-assertion pattern
- [ ] New cases in existing `convex/runtimeIngest.test.ts` — `held_reason` null-normalization (D-14) and `message_routed` routing
- [ ] `src/components/<Surface>.test.tsx` — UI-SPEC state coverage
- [ ] Framework install: **none** — Vitest is already configured repo-wide

---

## Live-Data Claims — Control Pairing (D-02)

Every assertion about live arrival must ship with both controls in the **same run**, or it
is not evidence. Established template, re-run and confirmed by the orchestrator 2026-08-12:

| Role | Kind | Expected | Measured 2026-08-12 |
|---|---|---|---|
| **Known-present control** | `llm_call` | rows > 0 | 1,261 |
| **Known-absent control** | `definitely_not_a_real_kind_9x7q2` | 0 rows | 0 |
| Subject | `governor_decision` | — | 1,168 (83.3/day, span 14.02 d) |
| Subject | `message_routed` | — | 10 (~0.7–1.2/day) |

Probe form (read-only; `--env-file` keeps the credential off the command line):

```
npx convex run events:listByType '{"eventType":"<kind>","limit":2000}' \
  --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

Hard constraints on any re-measurement:

- **Never `events:countByType`** (`convex/events.ts:310`) — it `.collect()`s the firehose.
- **Never add `--push` or `--prod`** — `--push` deploys the working tree before running.
- Result count must be **under** the requested limit, or it is a truncated sample, not a population.
- Timestamps are epoch **seconds** — print a wall-clock comparison before deriving any rate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema deploy actually reached the self-hosted backend | TELE-03 | Build + typecheck pass without the deploy; no test can observe the live backend's schema | Deploy, then run the live probe against the new domain table's list query and assert rows with real `emitter` values — an empty array means the route is not live |
| New route receives live rows post-deploy | TELE-03 | Depends on astridr emitting after deploy | Wait for arrival, re-probe, assert rows > 0 with a known-present control in the same run |
| Group A banners + critical-events row removal | TELE-01 | Doc prose in a second repo (astridr-repo) with no test suite covering it | `grep -c "NOT EMITTED" docs/astridr-contract.md` = 5; confirm the 3 rows at the former 1785-1787 are gone and §2.25-§2.40 numbering is unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 30s
- [ ] D-10 drift guard is **mutation-proven** — the test was observed failing with a kind removed from the const, not merely asserted to work
- [ ] Live post-deploy probe run with both controls in the same run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
