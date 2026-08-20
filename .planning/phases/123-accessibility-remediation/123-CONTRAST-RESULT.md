---
phase: 123-accessibility-remediation
plan: 08
title: The pass-labelled contrast/accessibility ledger (D-02, D-16, C4, C5)
purpose: Produces the ratio population plan 123-09's D-01 gate decides against, and the file-and-line remediation list plan 123-11 executes.
---

# 123 Contrast Result — Two-Pass Ledger

This document is the ratio-gated remediation list D-01 depends on. Every row below is labelled by
which pass produced it (`pass: axe` for the widened 47×4 render+scan, `pass: isolation` /
`pass: isolation-before` for the class-level rasteriser). "Measured" and "calculated" are not
interchangeable words here — nothing in this document is derived from hex+alpha arithmetic.

---

## Section 1 — Pass 1: the widened 47×4 axe scan

### Run record

```
Command: A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1 \
  A11Y_CAPTURE_DIR=.planning/phases/123-accessibility-remediation/a11y-widened/ \
  PW_BASE_URL=http://localhost:5181 \
  node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=line
Server reused: dev:noauth already running on 127.0.0.1:5181 (200 probed before the run;
  per dispatch instruction, no second server was started).
```

- **Measured wall-clock runtime: 130s (2.1m)**, Playwright's own reporter and an independent
  `date +%s` bracket around the command agree exactly. This is the first live measurement of the
  widened matrix — `123-RESEARCH.md` Assumption A1 had only extrapolated "minutes" from 122's
  12.2s/20-cell figure and was never re-measured until now. 130s / 188 cells ≈ 0.69s/cell,
  close to 122's ≈0.61-0.72s/cell range (12.2-14.4s / 20 cells) — the extrapolation direction was
  right, the unit ("minutes") just hadn't been pinned to a number.
- **189 tests declared** (188 matrix cells + the C5 self-check test at the bottom of the spec).
  **Exit code 1.** This is `A11Y_MEASURE_ONLY=1` / D-14 working as designed: every cell that
  reaches the axe scan throws a fixed `"assertions suppressed: this is a measurement, not a
  verification"` error by design, so the whole file reports non-zero even though every one of
  those cells completed its scan and wrote its capture. **This is not a red scan; it is a
  measurement run, and its exit code must never be read as a pass/fail verdict.**
  - `grep -c "assertions suppressed" scan-output.log` → 280 (a mix of the same message printed in
    both the per-test error block and the final numbered failure summary — not a distinct-cell
    count; the distinct-cell count for this bucket is the reconciliation below).
- **1 test passed** — the C5 self-check (`route table: population is 47 ... generated cell count
  matches`), confirming `ALL_ROUTES.length === 47`, `ALL_ROUTES.length !== 62`, and
  `generatedCellCount === THEMES.length * routes.length` (4 × 47 = 188) at the spec's own
  module-load time. This proves the **table** declares 47 routes and the **loop** generated 188
  `test()` calls from it — it does not by itself prove all 188 cells reached axe (see below, this
  run's real finding).

### Genuine finding: 48 of the 188 declared cells never reached axe — a dev-server defect, not an accessibility defect

**140 of 188 cells completed and wrote a capture. 48 did not.** This is not a silent gap — every
one of the 48 is accounted for, and the cause was isolated live rather than assumed:

- `ls .../a11y-widened/*.json | wc -l` → **140** (not 188).
- Distinct route names parsed from those 140 filenames (`sed -E 's/^[a-z]+__(.*)\.json$/\1/' | sort -u | wc -l`)
  → **35** (not 47). **Neither figure is 62** (the acceptance criterion's actual must-differ
  check) — the shortfall from 188/47 has a specific, isolated cause below, not a scan-count bug.
- The 48 missing cells are **exactly 12 routes × all 4 themes** — a clean route-level split, not a
  theme-level or random one:
  `ConfigPage, Chat, DocComments, HrOnboarding, HrRoster, HrTeams, Infrastructure, InsightsChat,
  Reminders, Settings, Tasks, WarRoom`.
- **Root cause, isolated live** (three independent probes: fresh `page.goto()`, `page.reload()`,
  and a second fresh `page.goto()` after the first two failed identically): every one of these 12
  routes throws `TypeError: Failed to fetch dynamically imported module:
  http://127.0.0.1:5181/src/pages/<Page>.tsx`, preceded by a browser console error
  `Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)`.
  React's `ErrorBoundary` catches it and renders only the app shell (nav + branding `<h1>`,
  literally the string `"CodePulse"` twice — desktop + mobile aside — with no page-specific
  content at all). This is Vite's dev-server dependency-optimizer cache entering a stuck state for
  these 12 specific lazy-loaded route chunks: it persisted across three separate navigations
  including a hard `page.reload()`, which the dev-server's own optimizer would normally self-heal
  via a forced full reload — it did not, so re-optimization is stuck server-side, not merely a
  stale client cache.
  - The dispatch's environment note said to **reuse** the already-running `dev:noauth` server and
    explicitly **not** start a second, competing one. Restarting the shared server was judged
    **out of scope for this measurement task**: it is a process this executor does not own,
    fixing it risks leaving no server running at all (breaking every OTHER concurrent session's
    use of the same port), and — per this plan's own `<measurement_discipline>` — "if a cell
    cannot be measured, it is UNMEASURED — not passing," which is precisely the disposition
    applied here rather than force-fitting a partial matrix into a false 188/47.
  - **This is a dev-server/environment artifact, not an application accessibility defect.** It
    says nothing about whether these 12 routes' real rendered content meets or fails WCAG AA —
    that remains genuinely unknown, and is recorded as such rather than defaulted to a pass or a
    fail.
- **`/chat`** (named in the plan as needing its own callout: out-of-scope for the whole v15.0
  milestone, scanned for measurement only, never remediated by this phase) is **one of the 12
  routes that hit the dev-server defect above** — it produced zero captures in any theme. Its
  out-of-scope status is therefore moot for this run: there is no data to record either way.
- **`marker: null` routes: zero.** `grep -c "marker: null" e2e/a11y-routes.ts` → 0 (excluding the
  type declaration itself, which permits but is used by no entry). Every one of the 47 table
  entries uses a real `heading` locator; the plan's required callout for `marker: null` routes is
  satisfied by stating there are none to call out.

**Reconciliation:** 140 completed + 48 unmeasured (dev-server defect) = **188 attempted**, matching
the C5-asserted `generatedCellCount`. The unmeasured 48 are excluded from every violation
aggregate below — they are not zeros, they are absent, and are never silently counted as passing.

### Per-rule totals — ALL 140 completed cells (unit: objects = violation entries, nodes = individual flagged elements)

| Rule | Objects | Nodes |
|---|---|---|
| button-name | 29 | 806 |
| color-contrast | 18 | 37 |
| aria-input-field-name | 4 | 12 |
| label | 4 | 8 |
| select-name | 4 | 8 |
| aria-valid-attr-value | 4 | 4 |
| link-in-text-block | 4 | 4 |
| scrollable-region-focusable | 4 | 4 |
| **TOTAL** | **71** | **883** |

**Must-differ control (required by this task's acceptance criteria):** the aggregate above is
non-zero, as expected — 42 of the 47 routes had never been scanned before this plan (D-16). Had
this aggregate come back 0 across 140 real cells spanning 35 previously-unscanned routes, that
would itself be the suspicious result requiring proof before recording, per this plan's own
measurement discipline; it did not, so no such proof is needed here. `pass: axe` for every row in
this table.

### Per-rule totals — the 20 criterion cells only (Dashboard, LiveRun, Analytics, Forge, Graphs × 4 themes)

**All 20 criterion cells are present** (none of the 5 criterion routes fell in the 48-cell
dev-server gap). Aggregated result: **0 `color-contrast` nodes, 0 `aria-prohibited-attr` objects,
0 violations of any rule id.** This confirms plans 123-04 (contrast), 123-05 (loading-state
contrast) and 123-06 (aria-prohibited-attr on /forge) landed and hold under the widened harness —
no finding to report against any of those plans. `pass: axe`.

### Per-route table, all 35 captured routes (sorted by node count, descending; unit: nodes = flagged elements, objects = violation entries, both summed across however many of the 4 themed cells for that route actually completed — all 35 routes below have all 4)

| Route | Cells | Objects | Nodes | Rule IDs | Note |
|---|---|---|---|---|---|
| Ideation | 4/4 | 2 | 474 | button-name, color-contrast | **Theme-unstable**: aubergine 474 nodes (2 objects), cyan/emerald/readable **0**. Same route, same markup family, wildly different result by theme — consistent with a live-data-dependent list (axe caught a large checkbox list mid/fully-rendered only in the aubergine run). Not a theme-CSS effect; a timing race. Flagged, not adjudicated — remediation plans should re-measure before acting on the 474 figure alone. |
| Alerts | 4/4 | 4 | 260 | button-name | Stable across all 4 themes (65 nodes/theme, 1 object/theme) — a real, theme-independent defect. |
| Automation | 4/4 | 4 | 48 | button-name | Stable across all 4 themes (12 nodes/theme). |
| HrAgentAnalytics | 4/4 | 8 | 16 | aria-input-field-name, button-name | Stable. |
| KnowledgeGraph | 4/4 | 8 | 12 | button-name, color-contrast | Stable (3 nodes/theme). |
| ToolGalaxy | 4/4 | 7 | 11 | button-name, color-contrast | Near-stable: readable 1 object/2 nodes, others 2 objects/3 nodes each. |
| Skills | 4/4 | 3 | 9 | color-contrast | readable theme clean (0); cyan/emerald/aubergine each 3 nodes. |
| Briefings | 4/4 | 4 | 8 | label | Stable (2 nodes/theme). |
| Executions | 4/4 | 2 | 8 | color-contrast | Theme-unstable: aubergine + readable 4 nodes each, cyan + emerald 0 — same timing-race pattern as Ideation, smaller scale. |
| Memory | 4/4 | 4 | 8 | select-name | Stable (2 nodes/theme). |
| HrCatalog | 4/4 | 2 | 6 | color-contrast | Theme-unstable: aubergine + readable 3 nodes each, cyan + emerald 0. |
| HivePage | 4/4 | 4 | 4 | button-name | Stable (1 node/theme). |
| QualityDetail | 4/4 | 4 | 4 | button-name | Stable (1 node/theme). |
| SelfHealing | 4/4 | 4 | 4 | scrollable-region-focusable | Stable (1 node/theme). |
| Tools | 4/4 | 4 | 4 | link-in-text-block | Stable (1 node/theme). |
| WorkspaceMap | 4/4 | 4 | 4 | aria-valid-attr-value | Stable (1 node/theme). |
| McpInventory | 4/4 | 3 | 3 | color-contrast | readable clean (0); cyan/emerald/aubergine 1 node each. |
| Analytics *(criterion)* | 4/4 | 0 | 0 | — | Clean. |
| Bifrost | 4/4 | 0 | 0 | — | Clean. |
| BuildProgress | 4/4 | 0 | 0 | — | Clean. |
| Capabilities | 4/4 | 0 | 0 | — | Clean. |
| Dashboard *(criterion)* | 4/4 | 0 | 0 | — | Clean. |
| Dreaming | 4/4 | 0 | 0 | — | Clean. |
| Forge *(criterion)* | 4/4 | 0 | 0 | — | Clean. |
| Galdr | 4/4 | 0 | 0 | — | Clean. |
| Graphs *(criterion)* | 4/4 | 0 | 0 | — | Clean. |
| Inbox | 4/4 | 0 | 0 | — | Clean. |
| LiveRun *(criterion)* | 4/4 | 0 | 0 | — | Clean. |
| Loom | 4/4 | 0 | 0 | — | Clean. |
| MeetingBot | 4/4 | 0 | 0 | — | Clean. |
| Quality | 4/4 | 0 | 0 | — | Clean. |
| Security | 4/4 | 0 | 0 | — | Clean. |
| SessionDetail | 4/4 | 0 | 0 | — | Clean (renders `QualityDetail`'s sibling behaviour for a nonexistent-id route, per `a11y-routes.ts` comments). |
| Studio | 4/4 | 0 | 0 | — | Clean. |
| WhatsApp | 4/4 | 0 | 0 | — | Clean. |

Every row above: `pass: axe`.

### Unmeasured cells (own category, per this plan's measurement discipline — never folded into the violation counts above)

| Route | Cells attempted | Cells unmeasured | Reason |
|---|---|---|---|
| Infrastructure | 4 | 4 | Vite dev-server "504 Outdated Optimize Dep" → dynamic-import failure → ErrorBoundary → D-13 marker never renders, 20s timeout |
| ConfigPage | 4 | 4 | same |
| Chat | 4 | 4 | same (also the named out-of-scope /chat route — moot, no data either way) |
| Settings | 4 | 4 | same |
| Tasks | 4 | 4 | same |
| Reminders | 4 | 4 | same |
| InsightsChat | 4 | 4 | same |
| WarRoom | 4 | 4 | same |
| DocComments | 4 | 4 | same |
| HrOnboarding | 4 | 4 | same |
| HrTeams | 4 | 4 | same |
| HrRoster | 4 | 4 | same |
| **Total** | **48** | **48** | 12 routes × 4 themes |

These 12 routes' real accessibility status (contrast or otherwise) is **unknown**, not passing and
not failing. Re-running the widened scan against a freshly-restarted dev server (outside this
executor's authority to perform mid-plan against a shared process) is the direct remediation;
recorded here as a named residual for plan 123-09's decision rather than silently absorbed or
guessed at.

---

## Section 2 — Pass 2: class-level isolation table

*(Task 2, below.)*

## Section 3 — Remediation list

*(Task 2, below.)*
