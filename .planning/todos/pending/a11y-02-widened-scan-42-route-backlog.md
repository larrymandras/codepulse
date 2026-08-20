---
id: TODO-a11y-02-widened-scan-42-route-backlog
status: pending
planted: 2026-08-20
planted_during: Phase 123 (Accessibility Remediation) — plan 123-09, D-16's mid-phase operator checkpoint
trigger_when: A follow-up phase scoped to accessibility/ARIA remediation beyond opacity-modifier contrast — this is NOT a fit for 123-11/123-12 (contrast-only sweeps) or for a quick pickup, since 7 of 8 flagged rule categories have no file:line triage yet
scope: Large — 96 objects / 966 nodes across 42 routes, 7 of 8 rule categories entirely un-triaged to source
source: Measured 2026-08-20 by plan 123-08 (140/188 cells) + its orchestrator addendum (the remaining 48/188 cells, dev-server-gap recovery). Operator decision recorded in 123-CRITERION-DECISION.md.
resolves_phase: null
last_reviewed: 2026-08-20
---

# A11Y-02's criterion held at 20 cells — the other 42 routes' violations, sized

## Decision this backlog item implements

D-16's mid-phase checkpoint (`123-CRITERION-DECISION.md`) asked whether A11Y-02's pass/fail
criterion should widen from the 20 measured cells (Dashboard, LiveRun, Analytics, Forge, Graphs ×
4 themes) to all 188 (47 routes × 4 themes). The operator chose to **hold the criterion at 20
cells** and ship the extra 42 routes' violations as this sized backlog item. Full brief, options,
and the operator's verbatim words: `.planning/phases/123-accessibility-remediation/123-CRITERION-DECISION.md`.

Plan 123-11's scope is **unchanged** by this decision — still the 33-file `text-primary/NN` /
`text-muted-foreground/NN` opacity-modifier sweep it was already scoped to.

## The measured population (188/188 cells, no unmeasured cells remaining)

Source: `123-CONTRAST-RESULT.md` (original 140-cell run) + `123-CONTRAST-RESULT-ADDENDUM.md` (the
48-cell dev-server-gap recovery, produced by the orchestrator after 123-08 closed).

**42 non-criterion routes × 4 themes = 168 cells. Since the 20 criterion cells are 0/0, this
population equals the full 188-cell total: 96 objects / 966 nodes.**

### Per-rule totals (independently re-summed, both source tables agree)

| Rule | Objects | Nodes |
|---|---|---|
| button-name | 36 | 857 |
| color-contrast | 28 | 61 |
| aria-input-field-name | 7 | 15 |
| label | 8 | 12 |
| select-name | 4 | 8 |
| aria-valid-attr-value | 5 | 5 |
| link-in-text-block | 4 | 4 |
| scrollable-region-focusable | 4 | 4 |
| **TOTAL** | **96** | **966** |

**button-name is ~89% of all flagged nodes (857 of 966).** This is not primarily a contrast
problem — it is missing accessible names on buttons, followed at much smaller scale by missing
form labels, invalid ARIA attribute values, links embedded in text blocks, and non-focusable
scrollable regions. Only `color-contrast` (28/61, ~6% of nodes) is the kind of fix 123-10/11/12
already do.

### CRITICAL — do not act on the 857 button-name node figure without re-measuring Ideation first

`123-CONTRAST-RESULT.md`'s per-route table flags **Ideation** explicitly as theme-unstable:
aubergine measured 474 nodes (2 objects: button-name, color-contrast); cyan/emerald/readable
measured **0** for the identical route and markup family. This is judged "a timing race... not a
theme-CSS effect", consistent with a live-data-dependent list axe caught mid/fully-rendered only
in one run. **474 of the 857 button-name nodes (55%) come from this single unstable measurement.**
Re-measure Ideation across all 4 themes before sizing any button-name remediation work — the true
stable population may be far smaller than 857.

### Per-route distribution (42 routes, by node count)

- **19 of 42 routes: zero violations** — Bifrost, BuildProgress, Capabilities, Dreaming, Galdr,
  Inbox, Loom, MeetingBot, Quality, Security, SessionDetail, Studio, WhatsApp, Chat, DocComments,
  InsightsChat, Reminders, Tasks, WarRoom.
- **2 of 42 routes: 1–5 nodes** — McpInventory (3), HrTeams (2).
- **21 of 42 routes: more than 5 nodes** — see table below.

**Top five routes by node count:**

| Rank | Route | Objects | Nodes | Rule(s) | Note |
|---|---|---|---|---|---|
| 1 | Ideation | 2 | 474 | button-name, color-contrast | Theme-unstable — see caveat above. Re-measure before acting. |
| 2 | Alerts | 4 | 260 | button-name | Stable across all 4 themes (65 nodes/theme). |
| 3 | Automation | 4 | 48 | button-name | Stable across all 4 themes (12 nodes/theme). |
| 4 | ConfigPage | 7 | 43 | (addendum — not itemized by rule in source) | From the 48-cell dev-server-gap recovery. |
| 5 (tie) | HrAgentAnalytics | 8 | 16 | aria-input-field-name, button-name | Stable. |
| 5 (tie) | Infrastructure | 4 | 16 | (addendum — not itemized by rule in source) | From the 48-cell dev-server-gap recovery. |

Remaining routes with violations (6–14 nodes each): HrRoster (6 objects/14 nodes),
KnowledgeGraph (8/12), ToolGalaxy (7/11), Skills (3/9), Briefings (4/8), Executions (2/8),
Memory (4/8), HrCatalog (2/6).

## What is NOT in this backlog item — the un-triaged 68 objects / 905 nodes

**No file:line mapping exists anywhere in this repo's planning artifacts for 7 of the 8 flagged
rule categories** (button-name, aria-input-field-name, label, select-name, aria-valid-attr-value,
link-in-text-block, scrollable-region-focusable — 68 objects / 905 nodes combined). Only
`color-contrast`'s 7 "measured-failing" objects have file:line (already in 123-11's scope); the
remaining 21 `color-contrast` objects and all 68 non-contrast objects need a NEW triage pass —
axe capture → source file:line — before a single edit target can be named. This is the same
methodology `123-CONTRAST-RESULT.md` Section 3 applied to the `text-primary/NN` class family; it
has not been applied to button-name/label/select-name/aria-*/link-in-text-block/
scrollable-region-focusable, and doing so is the first task of whatever phase picks this up.

## Derivation commands (for re-measurement)

```bash
# Full widened scan, all 188 cells, against dev:noauth
A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1 \
  A11Y_CAPTURE_DIR=.planning/phases/123-accessibility-remediation/<new-dir>/ \
  PW_BASE_URL=http://localhost:5181 \
  node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=line

# Per-rule / per-node counts from capture JSON — never by grepping "id"
# (parse violations[].nodes.length per the addendum's stated methodology)

# Re-measure Ideation specifically, all 4 themes, before trusting the 857 button-name figure
node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --grep 'Ideation'
```

## Why this is not fixed now

Phase 123's remaining plans (123-10, 123-11, 123-12) are opacity-modifier contrast sweeps by
design (`text-primary/NN`, `text-muted-foreground/NN`, `text-(--token)/NN`) — they remediate
`color-contrast` only, per the operator's decision recorded in `123-CRITERION-DECISION.md`.
button-name/label/select-name/aria-*/link-in-text-block/scrollable-region-focusable are markup and
ARIA-attribute fixes, a different work category, and this phase's plans were not built to do a
fresh axe-to-source triage pass on top of the contrast sweep already scoped.
