---
phase: 115
slug: workspace-scanner
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
---

# Phase 115 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `115-RESEARCH.md` § Validation Architecture (`:765-834`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.9` (`package.json:89`) |
| **Config file** | existing `vite.config.ts` — already runs both `hooks/__tests__/*.test.mjs` and `convex/*.test.ts` (precedents: `hooks/__tests__/scanner.test.mjs`, `convex/graphSnapshots.test.ts`) |
| **Quick run command** | `npx vitest run hooks/__tests__/ convex/workspace.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5s quick / full suite per repo baseline |

**No Wave 0 framework install is required** — existing infrastructure covers both file patterns this
phase adds tests under.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run hooks/__tests__/ convex/workspace.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## What is unit-testable as a pure function

D-08 makes the classifier a pure function of `(path, config)`, which is the property that makes the
rest of this phase testable with zero I/O — no real filesystem, no Convex, no network. This follows
`convex/graphSnapshots.test.ts`'s established "pure-logic mirror function" style (`:1-83` for
`selectVersionDeletes`, `:85-140` for dispatch mapping).

| Unit under test | Why it is pure | Proves |
|-----------------|----------------|--------|
| `classifyPath(relPath, config)` | takes a path string + loaded config, returns `{ department, access, isSecret }` | D-02 deny-by-default, D-07 departments, D-14 Unclassified fallback |
| `selectVersionDeletes(...)` | copy-shaped from `graphSnapshots.ts:30-34` | D-11 inline prune selects only non-active versions, batch-capped |
| `canonicalReportHash` / `isDryRunApproved` | string in, boolean out | D-12 structural refusal |
| `deriveAccessFromCompose(parsedYaml)` | takes a `js-yaml` parse *result*, not the file | D-09 derived access; must union `astridr-agent` **and** `cli-gateway` |

---

## Mandatory mutation test — D-12's refusal (BLOCKING)

CONTEXT.md D-12 requires the refusal be **proven to fire, not asserted**. Per the project's standing
rule that a gate which can skip itself must be shown to have evaluated something, the following five
cases are a hard acceptance requirement, not a suggestion:

| # | Case | Input | Expected |
|---|------|-------|----------|
| 1 | Baseline (control) | `isDryRunApproved(hash(A), approvalFor(A))` | `true` |
| 2 | Content drift | report B differs from A in exactly one field (e.g. `withheldCount` +1); approval still holds A's hash | `false` |
| 3 | Marker absent | `isDryRunApproved(hash(A), null)` | `false` |
| 4 | Marker corrupted | `isDryRunApproved(hash(A), "not-a-real-hash")` | `false` |
| 5 | Integration control | inject a `deps.postSnapshot` spy; run the real entry point with approval invalid | spy **never called** — refusal happens *before* `fetch()` |

Case 1 is what makes cases 2-4 meaningful: without a passing control, four `false` results are
indistinguishable from a function that always returns `false`.

---

## Deferred to live verification (`it.todo`)

`convex-test` is **not** installed in this repo, so no DB round-trip is available in unit tests. The
established precedent is `it.todo(...)` markers deferred to an attended live wave —
`graphSnapshots.test.ts:275-279` carries 5 such todos from Phase 83. This phase follows the identical
pattern:

- `activeVersion` increments across two real ingests; never two active versions simultaneously.
- The inline prune removes the oldest version's rows and **never** the active version's rows.
- The versioned-write ordering holds under a mid-ingest failure (partial ingest never visible).

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| D-12 dry-run report against the real tree | This is the entire point of the gate — no fixture can substitute for Larry's actual filesystem | Run the scanner with `--dry-run`, review per-department counts / withheld count / Unclassified list / classification sample, then record approval |
| D-05 scheduled task firing unattended | Task Scheduler silent-failure precedent (`ClaudeConfigPull` ran 5+ weeks without executing, battery-gate no-op) | Observe evidence of a real overnight run — a new snapshot version in Convex the next morning, or the launcher's log file. **Not** `LastTaskResult`. |
| D-05 task registration read-back | `schtasks /query` returns zero lines from the agent shell — proven broken by a control (also fails on the known-installed `ConvexNightlyRestart`) | Executor probes `Get-ScheduledTask -TaskName 'ConvexNightlyRestart'` as a known-present control FIRST. If that control is also empty, registration verification is delegated to Larry (`taskschd.msc`). |
| Compose parse against the real `docker-compose.yml` | Fixture proves the function; only the real file proves anchors + the two-service union | Run as part of the dry-run report review |
| Convex schema reaching the live self-hosted backend | `tsc --noEmit` and `npm test` pass whether or not the deploy landed — types come from config, not the live DB | `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`, then read the output for the instance name |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or a named manual-only entry above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] D-12's five-case mutation test present and its control (case 1) passing
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
