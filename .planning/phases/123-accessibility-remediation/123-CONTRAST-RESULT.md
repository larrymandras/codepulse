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

### Run record

```
Command: node_modules/.bin/playwright test e2e/contrast-isolation.spec.ts --reporter=line
Result: 8 passed (6.4s). No CLASS_MATRIX extension was needed -- the widened Section-1 scan did
  not surface any new surface a tracked class sits on beyond the existing DEFAULT_SURFACES
  (--background, --card, --popover, --muted); every measured-failing node found in Section 1 sits
  on one of those four. e2e/contrast-isolation.spec.ts is therefore unmodified this plan
  (`git diff --stat e2e/contrast-isolation.spec.ts` empty), a legitimate "no extension needed"
  outcome rather than an oversight.
```

- `e2e/.artifacts/123-isolation-pass2.json` holds **248 rows**: 240 `pass: isolation` (15 classes ×
  4 themes × 4 surfaces, exact) + 8 `pass: isolation-before` (2 C6-probed classes × 4 themes,
  exact) — both counts match the spec's own hard assertion on exact expected totals, not just the
  ≥60 floor. Every row carries a `pass` field; none derived from hex+alpha arithmetic (canvas
  rasterisation only, per `e2e/lib/contrast.ts`).
- **C3** (harness discriminates sub-AA from compliant): confirmed live in all 4 themes this run —
  `text-muted-foreground/30` on `--background` measured 1.557–1.651:1 (FAIL, as required) in every
  theme; `text-foreground` on `--background` measured 15.448–19.357:1 (PASS, as required) in every
  theme. Both directions differ, so the harness is shown to discriminate rather than blanket-flag
  or blanket-pass.
- **Sentinel discipline**: `sampleColor(page, "not-a-color-9x7q2")` → `null`; `sampleColor(page,
  "#ffffff")` → `[255,255,255]`. Refuses on unparseable input, resolves exactly on valid input.
- **C6 before-control** (both probed classes, live, `--card`, per theme):

  | Class | cyan | emerald | readable | aubergine |
  |---|---|---|---|---|
  | `text-muted-foreground/80` | 4.813 | 4.804 | 3.825 | 3.676 |
  | `text-primary/60` | 3.361 | 3.264 | 4.751 | 3.112 |

  Both classes measure below 4.5:1 on `--card` in 3 of 4 themes at this anchor — a real "before"
  measurement, not an assumption, confirming `DashboardLayout.tsx`'s pre-123-04 state genuinely
  had a contrast problem there (both classes are now absent from that file — `C4` control in
  Section 3 below reconfirms 0 occurrences post-fix).

### Class-level table (all 15 tracked classes, min/max ratio across the 4×4 = 16 theme×surface cells each)

| Class | Min ratio | Max ratio | Verdict on the generic isolation table |
|---|---|---|---|
| `text-primary/70` | 3.395 | 6.568 | Fails on ≥1 surface/theme |
| `text-muted-foreground/50` | 2.095 | 2.702 | Fails on ≥1 surface/theme |
| `text-muted-foreground/70` | 2.818 | 4.230 | Fails on ≥1 surface/theme |
| `text-muted-foreground/60` | 2.433 | 3.386 | Fails on ≥1 surface/theme |
| `text-primary/80` | 3.984 | 8.229 | Fails on ≥1 surface/theme |
| `text-muted-foreground/80` | 3.222 | 5.270 | Fails on ≥1 surface/theme |
| `text-primary/60` | 2.849 | 5.073 | Fails on ≥1 surface/theme |
| `text-primary/40` | 2.009 | 2.943 | Fails on ≥1 surface/theme |
| `text-primary/50` | 2.404 | 3.901 | Fails on ≥1 surface/theme |
| `text-primary/90` | **4.626** | 10.249 | **Passes everywhere** |
| `text-primary/30` | 1.642 | 2.201 | Fails on ≥1 surface/theme |
| `text-muted-foreground/40` | 1.785 | 2.152 | Fails on ≥1 surface/theme |
| `text-muted-foreground/30` | 1.550 | 1.736 | Fails on ≥1 surface/theme |
| `text-(--status-warn)/80` | **5.415** | 7.550 | **Passes everywhere** |
| `text-(--status-error)/60` | 2.152 | 3.168 | Fails on ≥1 surface/theme |

Only 2 of 15 classes (`text-primary/90`, `text-(--status-warn)/80`) survive every generic
`DEFAULT_SURFACES` × theme combination — every other class fails at least one of the 16 cells.
This is the isolation table's role in this ledger: a **conservative fallback** used only for
occurrences the widened axe scan never reached (below). It is not authoritative over real axe
data — see the next section's methodology note, where several `text-primary/70` occurrences
measured genuinely passing against their real DOM ancestor despite the class failing broadly here
(a different real background than any of the 4 generic surfaces). Every row: `pass: isolation` /
`pass: isolation-before`.

Threshold used throughout this class-level table: a flat **4.5:1**, per this plan's own D-03 rule
("font size is a property of an occurrence, not of a class"). No occurrence below is claimed under
the 3:1 large-text allowance — none of the 7 measured-failing sites (Section 3) carry a
`readTextMetrics` reading, and none needed one: `DashboardLayout.tsx:148`/`:91`'s calibration case
(14px normal / 12px bold, both owing 4.5:1) is the only precedent in this phase, and it does not
recur in this corpus.

## Section 3 — Occurrence classification and remediation list

### Methodology

All 165 live `text-primary/[0-9]+` / `text-muted-foreground/[0-9]+` / `text-(--status-*)/[0-9]+`
occurrences were re-derived at write time:

```
grep -rhoE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' src | wc -l   -> 165
```

**165, not 176.** Plans 123-04 (9) and 123-05 (1) account for 10 of the 11-occurrence drop; the
remaining 1 was not chased further since it is a decrease (fewer live sites), not a population
loss that would need explaining before a remediation gate. **4 of the 165 are in
`src/components/JobsPanel.test.tsx`** (a test fixture, never shipped to a real user) and are
excluded from classification below, matching the corpus interfaces' own precedent of excluding
the one known test-file occurrence. **161 real, classifiable occurrences remain.**

**C4 control** (a known-absent and a known-present string, run against the same population
command): `... | grep -c 'DashboardLayout'` → **0** (clean since 123-04); `... | grep -c
'ToolExecutionPanel'` → **1**. Both directions discriminate.

Each of the 161 occurrences was placed in exactly one of the three plan-defined buckets:

- **measured-failing (pass: axe)** — the occurrence's exact class string was found, by an
  exhaustive regex search of every `color-contrast` violation's raw HTML across all 140 pass-1
  captures, inside a flagged node's `html` field, and the specific source file:line was confirmed
  by grepping the violation's literal text content back into `src/`. **7 occurrences**, all with
  axe's own reported `contrastRatio`.
- **measured-passing (pass: axe)** — the occurrence's containing route was one of the 35 captured
  routes (traced via a real import-closure BFS from every `src/pages/**/*.tsx` entry, following
  both relative and `@/` alias imports — script output cross-checked by hand against several known
  cases, e.g. `InfoTooltip.tsx` correctly resolving to 13 pages), the occurrence is **static JSX**
  (not inside a `.map(`, not behind a loading/error-state branch, not behind a
  `{condition && ...}` render gate — checked via both an automated heuristic scan of the preceding
  25 source lines and spot-checked by hand), and it was **not** one of the 7 measured-failing
  sites. Absence of a flag for an element that genuinely rendered during a real axe pass is
  positive evidence, not a guess — this is why several `text-primary/70` sites below are recorded
  passing at ~4.0–4.4:1 despite the generic isolation table (Section 2) saying that class fails
  broadly: the real ancestor these specific elements sit on (e.g. a highlighted card variant) is
  not one of the isolation harness's 4 generic surfaces, and D-02 intentionally treats real pixels
  as authoritative over a generic surface guess for anything the axe pass actually reached.
  **74 occurrences.**
- **not-reached** — everything else: on one of the 12 dev-server-gap routes (Section 1), inside a
  `.map(` list body, behind a loading/error-state branch, behind a `{cond && ...}`-style render
  gate, or (one case) deliberately suppressed for the whole scan
  (`OnboardingGuide.tsx`, per `theme-contrast.spec.ts`'s own `addInitScript` call setting
  `codepulse_onboarding_complete`). **80 occurrences.** Adjudicated per the plan's own rule against
  the Section 2 class-level table: **77 REMEDIATE** (class fails on ≥1 surface/theme in isolation)
  and **3 LEAVE-ALONE** (class is one of the two that pass the isolation table everywhere —
  all 3 are `text-primary/90`, min 4.626:1).

**Reconciliation:** 74 (measured-passing) + 7 (measured-failing) + 80 (not-reached) = **161**,
matching the live re-derived non-test population exactly. 161 + 4 (test-file, excluded) = 165,
matching the unfiltered live grep. No occurrence lost.

**Bounding this methodology, explicitly** (in the spirit of `123-SWEEP-BOUNDARY.md`'s own honesty
requirement): "static JSX on a captured route" is a **heuristic for likely-rendered**, not a proof
of DOM presence at scan time, for the 74 measured-passing sites — a genuinely correct classifier
would need axe's `passes` array (not captured by `theme-contrast.spec.ts`, which stores only
`violations`) or a targeted per-occurrence DOM-presence probe, neither of which this task's scope
covers. The heuristic is deliberately conservative in the safe direction: anything with a `.map(`,
a loading/error branch, or a conditional-render marker in its preceding 25 lines was **not**
credited as passing — it was pushed to not-reached and adjudicated by the (also conservative)
isolation table instead, which is why 77 of 80 not-reached sites land in REMEDIATE. The remaining
risk this bounds is the opposite direction: a small number of the 74 measured-passing sites could
in principle sit behind a render gate my heuristic did not catch (e.g. a gate more than 25 lines
above the JSX, or one not matching the `.map(`/`&&`/loading-keyword patterns). This is named, not
silently assumed away.

<!-- section3-tables.md content follows -->
### Remediation list (file-and-line explicit)

Every occurrence below is a real edit target for plan 123-11. `remedy` follows D-04's default
(delete the `/NN` alpha modifier, stepping to the full-strength token) unless a specific file
already has a documented different remedy from an earlier plan.

#### Measured-failing (pass: axe) — confirmed by a real color-contrast violation in the widened scan

| File:Line | Class | Measured ratio | Themes failing | Remedy |
|---|---|---|---|---|
| src/components/hr/CatalogCard.tsx:87 | `text-muted-foreground/80` | 3.73:1 | aubergine,readable | delete `/80` → full-strength token |
| src/components/skills/ScopeRail.tsx:51 | `text-primary/70` | 4.08:1 | aubergine,cyan,emerald | delete `/70` → full-strength token |
| src/pages/hr/Catalog.tsx:24 | `text-muted-foreground/80` | 3.93:1 | aubergine,readable | delete `/80` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1540 | `text-muted-foreground/70` | 3.31:1 | aubergine,cyan,emerald,readable | delete `/70` → full-strength token |
| src/pages/McpInventory.tsx:243 | `text-primary/70` | 3.96:1 | aubergine,cyan,emerald | delete `/70` → full-strength token |
| src/pages/Skills.tsx:561 | `text-primary/70` | 4.08:1 | aubergine,cyan,emerald | delete `/70` → full-strength token |
| src/pages/ToolGalaxy.tsx:268 | `text-primary/70` | 3.96:1 | aubergine,cyan,emerald | delete `/70` → full-strength token |

#### Not-reached, adjudicated REMEDIATE (class fails the isolation table on at least one theme/surface)

| File:Line | Class | Reason not-reached | Isolation min ratio | Remedy |
|---|---|---|---|---|
| src/components/AgentTopology.tsx:225 | `text-primary/70` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/AgentTopology.tsx:234 | `text-primary/80` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.984:1 | delete `/80` → full-strength token |
| src/components/BlackboardPanel.tsx:117 | `text-muted-foreground/50` | list-item (.map), on captured route(s) [HivePage] but presence in the scanned DOM state is not established | 2.095:1 | delete `/50` → full-strength token |
| src/components/chat/VitalsRail.tsx:205 | `text-(--status-error)/60` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.152:1 | delete `/60` → full-strength token |
| src/components/chat/VitalsRail.tsx:229 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/chat/VitalsRail.tsx:246 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/chat/VitalsRail.tsx:268 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/chat/VitalsRail.tsx:402 | `text-muted-foreground/40` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 1.785:1 | delete `/40` → full-strength token |
| src/components/ChatBubble.tsx:207 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [Chat,InsightsChat] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/ChatBubble.tsx:228 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [Chat,InsightsChat] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/doccomments/DocViewer.tsx:36 | `text-muted-foreground/60` | only reachable via unmeasured route(s) [DocComments] — dev-server 504 gap (Section 1) | 2.433:1 | delete `/60` → full-strength token |
| src/components/DockerPanel.tsx:84 | `text-primary/70` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/DockerPanel.tsx:88 | `text-primary/70` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/EventFeed.tsx:102 | `text-muted-foreground/50` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 2.095:1 | delete `/50` → full-strength token |
| src/components/GitActivityWidget.tsx:47 | `text-primary/70` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/GitActivityWidget.tsx:53 | `text-primary/70` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/AgentCard.tsx:103 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/hr/AgentCard.tsx:119 | `text-primary/60` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.849:1 | delete `/60` → full-strength token |
| src/components/hr/AgentDetailSheet.tsx:217 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:30 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:110 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:118 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:128 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:138 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:153 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:167 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:179 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:237 | `text-primary/80` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.984:1 | delete `/80` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:244 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:262 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:276 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:298 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/detail/DetailConfigTab.tsx:311 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/steps/ToolsStep.tsx:307 | `text-primary/80` | only reachable via unmeasured route(s) [HrOnboarding] — dev-server 504 gap (Section 1) | 3.984:1 | delete `/80` → full-strength token |
| src/components/hr/steps/ToolsStep.tsx:392 | `text-primary/80` | only reachable via unmeasured route(s) [HrOnboarding] — dev-server 504 gap (Section 1) | 3.984:1 | delete `/80` → full-strength token |
| src/components/hr/TeamCard.tsx:38 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/hr/TeamCard.tsx:62 | `text-muted-foreground/60` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 2.433:1 | delete `/60` → full-strength token |
| src/components/hr/TeamEditor.tsx:87 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/TeamEditor.tsx:112 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/hr/WizardShell.tsx:82 | `text-primary/70` | only reachable via unmeasured route(s) [HrOnboarding] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/hr/WizardStepper.tsx:48 | `text-muted-foreground/60` | only reachable via unmeasured route(s) [HrOnboarding] — dev-server 504 gap (Section 1) | 2.433:1 | delete `/60` → full-strength token |
| src/components/JobsPanel.tsx:96 | `text-muted-foreground/50` | list-item (.map), on captured route(s) [LiveRun] but presence in the scanned DOM state is not established | 2.095:1 | delete `/50` → full-strength token |
| src/components/kg/KGViewsPopover.tsx:183 | `text-primary/60` | list-item (.map), on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 2.849:1 | delete `/60` → full-strength token |
| src/components/ModelPricingAdmin.tsx:231 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Settings] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/components/OnboardingGuide.tsx:108 | `text-muted-foreground/50` | state-gated: onboarding overlay force-suppressed for the whole scan (theme-contrast.spec.ts addInitScript) | 2.095:1 | delete `/50` → full-strength token |
| src/components/ProviderControls.tsx:78 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [Settings] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/components/reminders/CalendarOverlay.tsx:224 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Reminders] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/components/reminders/CalendarOverlay.tsx:337 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Reminders] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/components/reminders/ReminderList.tsx:604 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Reminders] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/components/reminders/ReminderList.tsx:622 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Reminders] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/components/skills/AllSkillsOverview.tsx:92 | `text-primary/60` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 2.849:1 | delete `/60` → full-strength token |
| src/components/skills/IntakeSheet.tsx:42 | `text-primary/70` | loading/error-branch, on captured route(s) [Skills] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/components/skills/SkillEditPopover.tsx:92 | `text-muted-foreground/70` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 2.818:1 | delete `/70` → full-strength token |
| src/components/skills/SkillFilterChips.tsx:63 | `text-primary/80` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 3.984:1 | delete `/80` → full-strength token |
| src/components/skills/SkillFilterChips.tsx:63 | `text-muted-foreground/70` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 2.818:1 | delete `/70` → full-strength token |
| src/components/skills/SkillRow.tsx:166 | `text-muted-foreground/30` | conditionally-rendered (heuristic), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 1.550:1 | delete `/30` → full-strength token |
| src/components/skills/vault/SkillKanbanView.tsx:77 | `text-muted-foreground/50` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 2.095:1 | delete `/50` → full-strength token |
| src/components/skills/vault/SkillRecencyView.tsx:96 | `text-muted-foreground/50` | list-item (.map), on captured route(s) [Skills] but presence in the scanned DOM state is not established | 2.095:1 | delete `/50` → full-strength token |
| src/components/ToolExecutionPanel.tsx:266 | `text-primary/60` | list-item (.map), on captured route(s) [Dashboard] but presence in the scanned DOM state is not established | 2.849:1 | delete `/60` → full-strength token |
| src/components/WarRoomKanbanColumn.tsx:65 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [Tasks] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/WarRoomKanbanColumn.tsx:69 | `text-primary/70` | only reachable via unmeasured route(s) [Tasks] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/components/WarRoomTaskCard.tsx:66 | `text-primary/50` | only reachable via unmeasured route(s) [Tasks] — dev-server 504 gap (Section 1) | 2.404:1 | delete `/50` → full-strength token |
| src/components/WarRoomTaskCard.tsx:92 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [Tasks] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/components/WarRoomTaskCard.tsx:105 | `text-muted-foreground/60` | only reachable via unmeasured route(s) [Tasks] — dev-server 504 gap (Section 1) | 2.433:1 | delete `/60` → full-strength token |
| src/pages/Chat.tsx:733 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/pages/Chat.tsx:746 | `text-muted-foreground/70` | only reachable via unmeasured route(s) [Chat] — dev-server 504 gap (Section 1) | 2.818:1 | delete `/70` → full-strength token |
| src/pages/hr/Roster.tsx:117 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/pages/hr/Roster.tsx:119 | `text-primary/70` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 3.395:1 | delete `/70` → full-strength token |
| src/pages/hr/Teams.tsx:54 | `text-muted-foreground/80` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 3.222:1 | delete `/80` → full-strength token |
| src/pages/hr/Teams.tsx:77 | `text-muted-foreground/50` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 2.095:1 | delete `/50` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1553 | `text-muted-foreground/70` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 2.818:1 | delete `/70` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1712 | `text-primary/70` | list-item (.map), on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1740 | `text-muted-foreground/70` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 2.818:1 | delete `/70` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1752 | `text-primary/70` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1806 | `text-primary/70` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 3.395:1 | delete `/70` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1812 | `text-primary/50` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 2.404:1 | delete `/50` → full-strength token |
| src/pages/KnowledgeGraph.tsx:1822 | `text-muted-foreground/60` | loading/error-branch, on captured route(s) [KnowledgeGraph] but presence in the scanned DOM state is not established | 2.433:1 | delete `/60` → full-strength token |

**Remediation list total: 7 + 77 = 84 occurrences.**

### Left alone (with measured ratio) — not edited by 123-11

#### Measured-passing (pass: axe) — rendered on a captured route, axe raised no violation

| File:Line | Class | Route(s) |
|---|---|---|
| src/components/ActiveSessions.tsx:53 | `text-primary/70` | Dashboard |
| src/components/ActiveSessions.tsx:57 | `text-primary/70` | Dashboard |
| src/components/ActiveSessions.tsx:63 | `text-primary/60` | Dashboard |
| src/components/AlertRulesEngine.tsx:132 | `text-primary/70` | Alerts |
| src/components/AlertRulesEngine.tsx:175 | `text-primary/80` | Alerts |
| src/components/AlertRulesEngine.tsx:257 | `text-primary/80` | Alerts |
| src/components/BlackboardPanel.tsx:28 | `text-muted-foreground/50` | HivePage |
| src/components/BlackboardPanel.tsx:29 | `text-primary/60` | HivePage |
| src/components/BlackboardPanel.tsx:32 | `text-primary/80` | HivePage |
| src/components/BlackboardPanel.tsx:87 | `text-muted-foreground/50` | HivePage |
| src/components/CostBreakdown.tsx:161 | `text-muted-foreground/50` | HivePage |
| src/components/DriftTimeline.tsx:169 | `text-primary/70` | Dashboard |
| src/components/DriftTimeline.tsx:170 | `text-primary/70` | Dashboard |
| src/components/GitActivityWidget.tsx:59 | `text-primary/70` | Dashboard |
| src/components/GitActivityWidget.tsx:65 | `text-primary/70` | Dashboard |
| src/components/graph/CodeVaultGraph.tsx:797 | `text-muted-foreground/60` | Graphs |
| src/components/graph/CodeVaultGraph.tsx:859 | `text-muted-foreground/50` | Graphs |
| src/components/graph/CodeVaultGraph.tsx:902 | `text-primary/40` | Graphs |
| src/components/graph/CodeVaultGraph.tsx:906 | `text-muted-foreground/70` | Graphs |
| src/components/hr/CatalogCard.tsx:38 | `text-primary/80` | HrCatalog |
| src/components/hr/CatalogCard.tsx:43 | `text-muted-foreground/80` | HrCatalog |
| src/components/InfoTooltip.tsx:4 | `text-primary/70` | Analytics,Automation,Capabilities,Dashboard,Graphs,Ideation,KnowledgeGraph,McpInventory,Memory,Quality,Security,ToolGalaxy,Tools |
| src/components/JobsPanel.tsx:34 | `text-primary/80` | LiveRun |
| src/components/JobsPanel.tsx:81 | `text-muted-foreground/50` | LiveRun |
| src/components/kg/KGDetailsPanel.tsx:38 | `text-muted-foreground/50` | KnowledgeGraph |
| src/components/kg/KGDetailsPanel.tsx:112 | `text-muted-foreground/70` | KnowledgeGraph |
| src/components/kg/KGDetailsPanel.tsx:329 | `text-muted-foreground/50` | KnowledgeGraph |
| src/components/kg/KGDiffControls.tsx:95 | `text-muted-foreground/60` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:60 | `text-primary/70` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:94 | `text-muted-foreground/70` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:103 | `text-primary/50` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:107 | `text-muted-foreground/60` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:118 | `text-primary/50` | KnowledgeGraph |
| src/components/kg/KGSearchResults.tsx:122 | `text-muted-foreground/60` | KnowledgeGraph |
| src/components/kg/KGViewsPopover.tsx:150 | `text-primary/30` | KnowledgeGraph |
| src/components/kg/KGViewsPopover.tsx:154 | `text-muted-foreground/60` | KnowledgeGraph |
| src/components/skills/AllSkillsOverview.tsx:150 | `text-muted-foreground/60` | Skills |
| src/components/skills/CategoryGrid.tsx:123 | `text-primary/60` | Skills |
| src/components/skills/ColdStorageView.tsx:42 | `text-muted-foreground/60` | Skills |
| src/components/skills/IntakeStrip.tsx:38 | `text-primary/70` | Skills |
| src/components/skills/NewSkillsBanner.tsx:31 | `text-primary/70` | Skills |
| src/components/skills/SkillCommandDeck.tsx:86 | `text-primary/70` | Skills |
| src/components/skills/SkillEditPopover.tsx:52 | `text-muted-foreground/70` | Skills |
| src/components/skills/SkillEditPopover.tsx:53 | `text-muted-foreground/70` | Skills |
| src/components/skills/SkillRow.tsx:146 | `text-primary/30` | Skills |
| src/components/skills/SkillRow.tsx:172 | `text-primary/60` | Skills |
| src/components/skills/vault/SkillKanbanView.tsx:95 | `text-muted-foreground/60` | Skills |
| src/components/skills/vault/SkillPackView.tsx:253 | `text-muted-foreground/70` | Skills |
| src/components/skills/vault/SkillVaultView.tsx:194 | `text-muted-foreground/70` | Skills |
| src/components/SwarmTaskDetail.tsx:94 | `text-muted-foreground/60` | HivePage |
| src/components/SwarmTaskNode.tsx:100 | `text-muted-foreground/70` | HivePage |
| src/components/SwarmTaskNode.tsx:101 | `text-primary/70` | HivePage |
| src/components/SwarmTaskNode.tsx:104 | `text-primary/70` | HivePage |
| src/components/SwarmTaskNode.tsx:107 | `text-(--status-warn)/80` | HivePage |
| src/components/ToolExecutionPanel.tsx:145 | `text-primary/40` | Dashboard |
| src/components/ToolExecutionPanel.tsx:166 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:170 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:174 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:283 | `text-muted-foreground/50` | Dashboard |
| src/components/ToolPolicyFeed.tsx:266 | `text-primary/70` | Tools |
| src/components/workspace/AstridrLensEmptyState.tsx:52 | `text-primary/40` | WorkspaceMap |
| src/components/workspace/AstridrLensEmptyState.tsx:56 | `text-muted-foreground/70` | WorkspaceMap |
| src/components/workspace/AstridrLensEmptyState.tsx:67 | `text-primary/40` | WorkspaceMap |
| src/components/workspace/AstridrLensEmptyState.tsx:71 | `text-muted-foreground/70` | WorkspaceMap |
| src/pages/KnowledgeGraph.tsx:940 | `text-primary/70` | KnowledgeGraph |
| src/pages/McpInventory.tsx:184 | `text-muted-foreground/70` | McpInventory |
| src/pages/McpInventory.tsx:307 | `text-primary/40` | McpInventory |
| src/pages/McpInventory.tsx:311 | `text-muted-foreground/60` | McpInventory |
| src/pages/Skills.tsx:589 | `text-primary/40` | Skills |
| src/pages/ToolGalaxy.tsx:342 | `text-primary/50` | ToolGalaxy |
| src/pages/ToolGalaxy.tsx:346 | `text-muted-foreground/60` | ToolGalaxy |
| src/pages/ToolGalaxy.tsx:490 | `text-muted-foreground/50` | ToolGalaxy |
| src/pages/ToolGalaxy.tsx:517 | `text-muted-foreground/50` | ToolGalaxy |
| src/pages/ToolGalaxy.tsx:538 | `text-muted-foreground/50` | ToolGalaxy |

#### Not-reached, adjudicated LEAVE-ALONE (class passes the isolation table on every surface/theme measured)

| File:Line | Class | Reason not-reached | Isolation min ratio |
|---|---|---|---|
| src/components/ChatBubble.tsx:224 | `text-primary/90` | only reachable via unmeasured route(s) [Chat,InsightsChat] — dev-server 504 gap (Section 1) | 4.626:1 |
| src/components/hr/detail/DetailConfigTab.tsx:292 | `text-primary/90` | only reachable via unmeasured route(s) [HrRoster] — dev-server 504 gap (Section 1) | 4.626:1 |
| src/components/hr/TeamCard.tsx:56 | `text-primary/90` | only reachable via unmeasured route(s) [HrTeams] — dev-server 504 gap (Section 1) | 4.626:1 |

### Not-reached and `marker: null` counts, quantified (D-17)

- **80 occurrences not-reached** out of 161 (49.7%), re-derived by machine count (not estimated)
  from the same classification data the tables above were generated from, verified to sum exactly
  to 80 with zero double-counting: **53** trace to the 12 dev-server-gap routes named in Section 1;
  **18** are `.map(`-list-body occurrences on otherwise-captured routes; **7** are loading/error-branch
  occurrences on otherwise-captured routes (all 7 on `KnowledgeGraph.tsx`, whose error fallback the
  widened scan happened to render — see Section 1's KnowledgeGraph row); **1** is
  `OnboardingGuide.tsx`'s deliberately-suppressed overlay text; **1** is a generic
  conditionally-rendered heuristic hit (`SkillRow.tsx:166`). 53+18+7+1+1 = 80.
- **`marker: null` routes: 0** (already stated in Section 1 — every one of the 47 table entries in
  `e2e/a11y-routes.ts` uses a real heading locator).
