---
phase: 123-accessibility-remediation
plan: 08 (addendum, produced by the orchestrator after 123-08 closed)
title: The 48-cell dev-server gap, recovered
supersedes: nothing — 123-CONTRAST-RESULT.md Section 1's "Unmeasured cells" table only
purpose: Closes the UNMEASURED category so plan 123-09's D-16 decision is made on 188/188 cells rather than 140/188.
---

# Addendum — the 48 unmeasured cells, now measured

## Why this exists

`123-CONTRAST-RESULT.md` Section 1 records 140 of 188 cells completed and **48 unmeasured**
(12 routes × 4 themes), every one failing with
`TypeError: Failed to fetch dynamically imported module` behind a browser
`504 (Outdated Optimize Dep)`. Plan 123-08's executor diagnosed the cause correctly as Vite's
dev-server dependency optimizer in a stuck state, and **declined to restart the server** — the
right call: it did not own that process, and its dispatch had explicitly told it to reuse the
shared server and not start a competing one. It recorded the cells as UNMEASURED rather than
letting an absent measurement land in the population as a zero.

The server was the orchestrator's — started before wave 0 and left running for the whole phase —
so clearing it was the orchestrator's to do, not the executor's.

**This is an environment artifact, not an application defect.** Nothing below reflects a change to
application code; no `src/` file was touched between the 140-cell run and this one.

## What was done

1. Stopped **only** the listener on 5181 (PID resolved via `Get-NetTCPConnection -LocalPort 5181`).
   Verified 5181 → `000` and, as the must-not-touch control, 5173 → `200` (the unrelated
   `CodePulseUI` autostart server was unaffected).
2. Deleted `node_modules/.vite` (the stuck optimizer cache) and restarted
   `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth` from Git Bash.
3. Waited for the optimizer to repopulate (`node_modules/.vite/deps` → 745 files) before running
   anything — running during the scan window is what produced the original 504s.
4. Re-ran **only** the 48 affected cells.

## The filter was proven to discriminate before it was trusted

A first attempt returned `Total: 0 tests` — and so did its bogus-route control, so it carried zero
information. Two defects, both in the probe rather than the suite:

- the `\]` anchor did not match, and
- **`A11Y_SCAN_ALL=1` was absent**, so the spec generated only the 21-test criterion matrix
  (5 criterion routes × 4 themes + the C5 self-check), not the widened 189.

Corrected and re-verified:

| Probe | Result |
|---|---|
| baseline, `A11Y_SCAN_ALL=1`, no grep | **189** tests (188 cells + C5 self-check) |
| 12-route filter | **48** tests |
| bogus-route control `DefinitelyNotARoute9x7q2 —` | **0** tests |
| distinct routes selected | **12**, matching the gap list exactly |

## Result: 48/48 captured, zero dev-server failures

```
A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1 \
  A11Y_CAPTURE_DIR=.planning/phases/123-accessibility-remediation/a11y-widened-rerun/ \
  PW_BASE_URL=http://localhost:5181 \
  node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --grep '<12-route filter>'
```

- Wall clock **32s** for 48 cells (≈0.67s/cell, consistent with the 0.69s/cell of the 140-cell run).
- `grep -cE 'Failed to fetch dynamically imported module|Outdated Optimize Dep'` → **0**. The
  defect did not recur.
- Exit code 1, **by design** — `A11Y_MEASURE_ONLY=1` (D-14) makes every scanned cell throw
  `"assertions suppressed: this is a measurement, not a verification"`. As Section 1 already
  states, this exit code must never be read as a pass/fail verdict.

**One cell needed a second attempt, and it was not a dev-server failure.** The first run produced
47/48; `cyan__HrRoster` failed on `expect(locator).toBeVisible()` — the D-13 marker gate timing out
at 20s, i.e. **the gate working as designed**, refusing to score a cell whose page content never
rendered. This is precisely the single risk plan 123-03 identified and judged non-triggering:
`src/pages/hr/Roster.tsx:88` returns an error branch ahead of its `PageHeader` when
`error && agents.length === 0`.

It was *not* a backend outage — the Ástríðr API answered `200` on `:8181/health`, and the other
three `HrRoster` themes captured normally in the same run. A slow cold first fetch is the
consistent explanation. Re-running that one cell alone produced the capture. **123-03's judgement
was right in substance but not guaranteed: the branch can trigger on timing alone.** Worth knowing
before anyone treats a future `HrRoster` marker timeout as an accessibility finding.

## The recovered data (unit: objects = `violations[]` entries; nodes = `sum(len(v.nodes))`)

Parsed from the capture JSON by `violations[].nodes.length`, never by grepping `"id"`.

**48 cells / 12 routes: 25 objects / 83 nodes.**

| Rule | Objects | Nodes |
|---|---|---|
| color-contrast | 10 | 24 |
| button-name | 7 | 51 |
| label | 4 | 4 |
| aria-input-field-name | 3 | 3 |
| aria-valid-attr-value | 1 | 1 |
| **TOTAL** | **25** | **83** |

| Route | Objects | Nodes |
|---|---|---|
| ConfigPage | 7 | 43 |
| Infrastructure | 4 | 16 |
| HrRoster | 6 | 14 |
| HrOnboarding | 2 | 4 |
| Settings | 4 | 4 |
| HrTeams | 2 | 2 |
| Chat, DocComments, InsightsChat, Reminders, Tasks, WarRoom | 0 | 0 |

20 of the 48 cells carry at least one violation; 28 are clean.

`/chat` — called out in 123-08-PLAN.md as needing its own note, and one of the 12 gapped routes —
now has real data in all four themes: **0 objects / 0 nodes**. It remains out of scope for
remediation (v15.0 milestone scope), but it is no longer unknown.

## Consolidated 188-cell picture

| Population | Cells | Objects | Nodes |
|---|---|---|---|
| Original run (35 routes) | 140 | 71 | 883 |
| This addendum (12 routes) | 48 | 25 | 83 |
| **Full matrix (47 routes)** | **188** | **96** | **966** |

**The 20 criterion cells remain 0 objects / 0 nodes of any rule id** — unchanged by this addendum,
since none of the 5 criterion routes were ever in the gap. A11Y-02's actual criterion set is clean.

## What this changes for plan 123-09's D-16 decision

The UNMEASURED category is now **empty**, so the decision is made on 188/188 rather than 140/188.
Two things the recovered data makes visible that the ledger could only adjudicate by class-level
inference:

1. **The widened population is not primarily a contrast problem.** Across the full 188 cells,
   `color-contrast` is 28 objects / 61 nodes, while `button-name` alone is 36 objects / 857 nodes.
   The phase has so far remediated only `color-contrast` and `aria-prohibited-attr`.
2. **Several ledger rows can be upgraded from inference to measurement.** Section 3's
   "Not-reached, adjudicated REMEDIATE" bucket contains rows whose justification reads
   *"only reachable via unmeasured route(s) … dev-server 504 gap"* — for `Chat`, `InsightsChat`,
   `DocComments`, `HrRoster` and others. Those routes now have real axe data. In particular every
   `VitalsRail.tsx` and `ChatBubble.tsx` row was adjudicated from the isolation table because
   `/chat` could not be reached; `/chat` now measures **0 violations in all four themes**, so those
   rows rest on class-level ratios rather than a rendered failure. That does not automatically make
   them wrong — an occurrence can fail in isolation and not be flagged if it never renders in the
   scanned state — but the distinction is now knowable and should be stated rather than assumed.

Neither point is adjudicated here. Both are inputs to 123-09.
