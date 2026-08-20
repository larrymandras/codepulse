---
phase: 123-accessibility-remediation
plan: 12
title: Bucket A occurrence ledger — per-occurrence disposition
purpose: D-01/D-04 ratio-gated sweep over bucket A (top-level src/components/*.tsx, per plan 123-12's frontmatter files_modified list). Authority for plan 123-12 Task 2's edits.
---

# Bucket A — occurrence ledger

## Task 1: population re-derivation

### Live population, re-derived 2026-08-20

Commands run against exactly the 21 top-level `src/components/*.tsx` source files in
`123-12-PLAN.md`'s frontmatter `files_modified` list (built as an explicit array, not a
`for f in $(...)` word-split loop — no path silently dropped), plus `JobsPanel.test.tsx` counted
separately:

```
occurrences (source, 21 files): grep -ohE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' <21 files> | wc -l   -> 50
files with >=1 hit (21 files):  grep -olE '<same pattern>' <21 files> | wc -l                                                                  -> 21
occurrences incl. test file:    grep -ohE '<same pattern>' <21 files> src/components/JobsPanel.test.tsx | wc -l                                -> 54
```

- **occurrences (source) = 50** (unit: occurrences, `grep -o | wc -l`, not matching lines)
- **files with >=1 hit = 21** (unit: files, `grep -l | wc -l`) — all 21 source files still carry
  at least one occurrence.
- **occurrences incl. the 4 test-file hits = 54**, files = 22 — matches the plan's "22 files, 54
  occurrences" framing exactly; no stale-count correction needed here (unlike bucket B, whose
  113/112 plan text predated later plans).

### Discrimination control (C4-style: one known-absent, one known-present)

```
... DashboardLayout.tsx     -> 0  (cleaned by plan 123-04, not a bucket-A file, used as the plan's own control)
... ToolExecutionPanel.tsx  -> 6  (bucket A's largest member)
```

Both directions discriminate.

### Reconciliation against `123-CONTRAST-RESULT.md` § 3

§ 3's four tables (Measured-failing, Not-reached REMEDIATE, Measured-passing, Not-reached
LEAVE-ALONE) were filtered to the 21 bucket-A source files and joined 1:1 against the 50 live
occurrences by `(file, line, class-string)`. All 50 live occurrences matched an existing § 3 row;
**0 unreconciled**, **0 only-in-ledger-no-longer-live**.

One reclassification was made during reconciliation (see "Reclassification finding" below):
`GitActivityWidget.tsx:47` and `:53` are moved from § 3's REMEDIATE table to the measured-passing
LEAVE disposition. This is a correction of a heuristic error found in § 3 itself, not a
disagreement with the live population — both lines are still counted among the 50.

### Reclassification finding: `GitActivityWidget.tsx:47` / `:53` (heuristic false positive)

§ 3 lists these two as "not-reached, list-item (.map)" and adjudicates REMEDIATE via the isolation
table (3.395:1). Reading the source disproves the "list-item" reason: lines 47 and 53 are two of
**four structurally identical, non-mapped, static JSX stat labels** ("Commits", "PRs", "+ Lines",
"- Lines") in one `grid-cols-4` block (lines 44-70) — and the OTHER two labels in the same block,
`:59` and `:65`, are already classified `measured-passing` in § 3.

The file's only `.map(` call (`grep -n '\.map(' src/components/GitActivityWidget.tsx` -> line 32,
`Object.entries(byDay).map(...)`) is a data-transform for an unrelated bar-chart array, nowhere
near this JSX. It sits within the classifier's 25-line look-back window for line 47 (15 lines
back) but has scrolled out of that window by line 59 (27 lines back) — the same "unrelated `.map(`
inside the preceding-25-lines heuristic window" failure mode `123-11-SUMMARY.md` already named for
`McpInventory.tsx:184`, caught here proactively instead of found later.

Live verification: `.planning/phases/123-accessibility-remediation/a11y-sweep-b/*__Dashboard.json`
(the most recent Dashboard captures, all 4 themes) show **0 color-contrast violations** —
consistent with `:59`/`:65`'s already-credited measured-passing disposition, and with no reason to
believe `:47`/`:53` differ from their two structurally-identical siblings four lines away in the
same grid. Reclassified to `leave` / measured-passing, same evidence basis as `:59`/`:65`.

### Disposition arithmetic

| Disposition | Count |
|---|---|
| **change** — not-reached, adjudicated REMEDIATE (isolation table) | 18 |
| **change total** | **18** |
| **leave** — measured-passing (pass: axe), incl. 2 reclassified | 31 |
| **leave** — not-reached, adjudicated LEAVE-ALONE (isolation table) | 1 |
| **leave total** | **32** |
| **unreconciled** | **0** |
| **live_before (change + leave + unreconciled)** | **50** |

`18 + 32 + 0 = 50` — balances exactly against the re-derived live population. Bucket A has none of
§ 3's 7 measured-failing (pass: axe, real violation) sites.

### Evidence tier — RENDERED failure vs isolation-table-only

All 18 `change` rows are `isolation-table-only`. Checked against the most recent post-123-11
captures (`a11y-sweep-b/`) for every route the 18 rows cite:

- **Dashboard, HivePage, LiveRun** (the ".map(), on captured route" rows — items 1-2, 3, 6-7, 8,
  13 below): all 4 themes, **0 color-contrast violations** on each route. These routes ARE
  captured, but the specific list bodies (`filters`, `tasks`, `containers`, `events`, `jobs`,
  `filteredExecutions`) evidently held nothing to render at scan time — consistent with § 3's own
  "presence in the scanned DOM state is not established" caveat, not a pass verdict for these
  specific elements.
- **Chat, Settings, Tasks** (the "dev-server 504 gap" rows, now closed by
  `123-CONTRAST-RESULT-ADDENDUM.md` — items 4-5, 10, 12, 14-18 below): all 4 themes,
  **0 color-contrast violations** on each of these three routes too (Settings carries 1
  violation of a different, non-color-contrast rule). Same caveat as above — route-level
  cleanliness here most plausibly reflects an empty/no-content render state (no unpriced models,
  no `elapsed` timestamp, no populated task cards), not a corroborated pass for these classes.
- **OnboardingGuide.tsx:108** is its own category: the whole-scan `addInitScript` deliberately
  marks onboarding complete, so axe can never reach this element by construction, regardless of
  route capture state.

None of the 18 changes are backed by an observed rendered failure; every one rests on the
Section 2 class-level isolation table alone. This is stated per the orchestrator's instruction,
not as a reason to skip the edit — the isolation ratios (2.095-3.984:1) are real measured pixel
data below the WCAG AA threshold, D-04's default remedy applies regardless of which pass produced
the disposition, and the sub-threshold classes are genuinely in the DOM whenever their guarding
condition is true.

## Task 1: full occurrence list, all 50 live sites

### Change (18) — isolation-table-only, remedy = delete `/NN` unless noted

| # | File:Line | Class | Isolation ratio | Reason not-reached | Remedy |
|---|---|---|---|---|---|
| 1 | src/components/AgentTopology.tsx:225 | `text-primary/70` | 3.395:1 | list-item (`.map`), Dashboard | delete `/70` |
| 2 | src/components/AgentTopology.tsx:234 | `text-primary/80` | 3.984:1 | list-item (`.map`), Dashboard | delete `/80` |
| 3 | src/components/BlackboardPanel.tsx:117 | `text-muted-foreground/50` | 2.095:1 | list-item (`.map`), HivePage | delete `/50` |
| 4 | src/components/ChatBubble.tsx:207 | `text-muted-foreground/80` | 3.222:1 | dev-server gap [Chat,InsightsChat], now closed (0 c-c) | delete `/80` |
| 5 | src/components/ChatBubble.tsx:228 | `text-muted-foreground/80` | 3.222:1 | dev-server gap [Chat,InsightsChat], now closed (0 c-c) | delete `/80` |
| 6 | src/components/DockerPanel.tsx:84 | `text-primary/70` | 3.395:1 | list-item (`.map`), Dashboard | delete `/70` |
| 7 | src/components/DockerPanel.tsx:88 | `text-primary/70` | 3.395:1 | list-item (`.map`), Dashboard | delete `/70` |
| 8 | src/components/EventFeed.tsx:102 | `text-muted-foreground/50` | 2.095:1 | list-item (`.map`), Dashboard | delete `/50` |
| 9 | src/components/JobsPanel.tsx:96 | `text-muted-foreground/50` | 2.095:1 | list-item (`.map`), LiveRun | delete `/50` (JobsPanel.test.tsx lockstep — see below) |
| 10 | src/components/ModelPricingAdmin.tsx:231 | `text-muted-foreground/70` | 2.818:1 | dev-server gap [Settings], now closed (0 c-c) | **token-step, not delete** — see Collision below |
| 11 | src/components/OnboardingGuide.tsx:108 | `text-muted-foreground/50` | 2.095:1 | state-gated (onboarding overlay force-suppressed) | delete `/50` |
| 12 | src/components/ProviderControls.tsx:78 | `text-muted-foreground/50` | 2.095:1 | dev-server gap [Settings], now closed (0 c-c) | delete `/50` |
| 13 | src/components/ToolExecutionPanel.tsx:266 | `text-primary/60` | 2.849:1 | list-item (`.map`), Dashboard | delete `/60` |
| 14 | src/components/WarRoomKanbanColumn.tsx:65 | `text-muted-foreground/80` | 3.222:1 | dev-server gap [Tasks], now closed (0 c-c) | delete `/80` |
| 15 | src/components/WarRoomKanbanColumn.tsx:69 | `text-primary/70` | 3.395:1 | dev-server gap [Tasks], now closed (0 c-c) | delete `/70` |
| 16 | src/components/WarRoomTaskCard.tsx:66 | `text-primary/50` | 2.404:1 | dev-server gap [Tasks], now closed (0 c-c) | delete `/50` |
| 17 | src/components/WarRoomTaskCard.tsx:92 | `text-muted-foreground/80` | 3.222:1 | dev-server gap [Tasks], now closed (0 c-c) | delete `/80` |
| 18 | src/components/WarRoomTaskCard.tsx:105 | `text-muted-foreground/60` | 2.433:1 | dev-server gap [Tasks], now closed (0 c-c) | delete `/60` |

**Collision found — `ModelPricingAdmin.tsx:231` (row 10):** the occurrence
(`<span className="text-muted-foreground/70">({m.provider})</span>`) is nested directly inside its
own wrapper span (`:230`, `<span className="tabular-nums text-muted-foreground">{m.model} <span
.../></span>`). A plain delete would make the provider parenthetical render in the identical color
as its own `{m.model}` label, losing the visual distinction between the two — the same
label/annotation collision shape `123-11-SUMMARY.md` documented for
`DetailConfigTab.tsx:237`/`KnowledgeGraph.tsx:1540`. Per D-04, stepped to a distinct non-alpha
differentiator instead of a plain delete: `text-muted-foreground text-xs` — full contrast, no
alpha, matching the size-based de-emphasis pattern 123-11 already established for the identical
collision shape (its `KnowledgeGraph.tsx:1540` fix).

**Collisions checked and found NOT to apply** (±3-4 line window scanned for a bare occurrence of
the same base token, per 123-11's practice):
- `DockerPanel.tsx:84`/`:88` ("CPU"/"Mem" labels) — both are `change` rows, changing together to
  the same full-strength token; they stay visually identical to each other, as before.
- `WarRoomKanbanColumn.tsx:65` (role) and `:69` (status) — different base tokens
  (`text-muted-foreground` vs `text-primary`) and different from `:63`'s `text-foreground` — three
  distinct colors before and after the edit, no merge.
- `OnboardingGuide.tsx:108`'s disabled-`Previous` button vs the `:118` dismiss button — different
  interactive elements (Previous vs Skip), not a label/value pair; the `cursor-not-allowed` and
  absent hover state remain as the disabled signal. Not the label==value collision shape this
  guard exists for.
- `BlackboardPanel.tsx:117`'s fallback `<Clock>` vs `:28`'s `pending` state icon (same class,
  `text-muted-foreground/50`, `:28` is a `leave` row): these are two mutually-exclusive
  `Record<string, ReactNode>` entries — `:117`'s `?? <Clock ... />` fires only when `task.state`
  is absent from the Record, so it never renders for the same task as `:28`. Different tasks in
  the same list could show one lighter than the other post-edit, but that is a change in relative
  emphasis between two different tasks' rows, not the same-element label/value merge the D-04
  guard targets — matches the already-accepted pattern in this same Record (`:31` `text-primary`
  and `:33`/`:34` no-alpha status tokens already sit inconsistently alongside `:29`'s
  `text-primary/60`).

### JobsPanel.tsx / JobsPanel.test.tsx lockstep rule

`JobsPanel.tsx` has 3 live occurrences: `:34` (`text-primary/80`, CheckCircle icon, **leave**),
`:81` (`text-muted-foreground/50`, empty-state ListTodo icon, **leave**), `:96`
(`text-muted-foreground/50`, fallback Clock icon, **change**, row 9 above).

Read live (2026-08-20): none of the four test occurrences actually observe `:81` — `:81` only
renders when `jobs.length === 0`, and every test that exercises the
`[class*="text-muted-foreground/50"]` selector (`:172`, `:193`, `:210`) mocks a **non-empty**
`jobs` array, so only `:96`'s fallback icon is ever in scope for these three assertions:
- `:172` (status `"unknown"`) and `:193` (status `"running"`) both fall through to `:96`'s
  fallback icon (neither status is a `stateIcon` key) — currently `.toBe(1)`.
- `:210` (status `"completed"`, a mapped key) renders `:34`'s `CheckCircle`/`text-primary/80`
  instead, never `:96` — currently `.toBe(0)`.

**Rule:** `:96` is a `change` row, so all three selectors break under a naive string-swap (the
class `text-muted-foreground/50` will no longer exist anywhere `:172`/`:193` can reach once `:96`
loses its `/50`) and must be re-targeted in the same commit as the source edit. `:81` is a `leave`
row and needs no change — and per the read above, none of these three tests observe it anyway.
`:34` is also `leave`, so the `:200` comment naming `text-primary/80` stays factually accurate and
needs no wording change.

**A bare string-swap to `text-muted-foreground` (no slash) does not work as the replacement
selector.** The rendered tree for a non-empty `jobs` list also contains an `EntityRow` icon-wrapper
div (`text-muted-foreground`, full strength already), a `secondary` `<p>` (`text-sm
text-muted-foreground truncate`), a `trailing` div (`text-sm text-muted-foreground`), and — when
`elapsed` is truthy, which it is for every fixture here — a `<span className="text-xs font-mono
text-muted-foreground">` sibling. `[class*="text-muted-foreground"]` (no slash) would match all of
these as well as the icon, breaking the `.toBe(1)`/`.toBe(0)` counts. Verified by inspecting
`EntityRow.tsx:29,32,34` and `JobsPanel.tsx:107` directly, not assumed.

**Applied fix:** re-target on the Lucide-generated icon class instead of the color class —
`svg.lucide-clock`, which is unique to the fallback icon in this render (the only other icons used
here, `CheckCircle`/`XCircle`/`Ban`/`ListTodo`, render as `lucide-circle-check`/`lucide-circle-x`/
`lucide-ban`/`lucide-list-todo`). This matches the existing repo precedent at
`src/pages/Settings.test.tsx:360` (`svg.lucide-triangle-alert`), decouples the test from the exact
opacity value entirely (removing the whole class of fragility this plan exists to fix), and keeps
the same `.toBe(1)`/`.toBe(1)`/`.toBe(0)` semantics per the WR-02 rationale already documented in
the test's own comments. See Task 2 for the mutation proof.

### Leave (32)

#### Measured-passing (pass: axe) — 31, incl. 2 reclassified

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
| src/components/GitActivityWidget.tsx:47 | `text-primary/70` | Dashboard (**reclassified** — see above) |
| src/components/GitActivityWidget.tsx:53 | `text-primary/70` | Dashboard (**reclassified** — see above) |
| src/components/GitActivityWidget.tsx:59 | `text-primary/70` | Dashboard |
| src/components/GitActivityWidget.tsx:65 | `text-primary/70` | Dashboard |
| src/components/InfoTooltip.tsx:4 | `text-primary/70` | 13 routes |
| src/components/JobsPanel.tsx:34 | `text-primary/80` | LiveRun |
| src/components/JobsPanel.tsx:81 | `text-muted-foreground/50` | LiveRun |
| src/components/SwarmTaskDetail.tsx:94 | `text-muted-foreground/60` | HivePage |
| src/components/SwarmTaskNode.tsx:100 | `text-muted-foreground/70` | HivePage |
| src/components/SwarmTaskNode.tsx:101 | `text-primary/70` | HivePage |
| src/components/SwarmTaskNode.tsx:104 | `text-primary/70` | HivePage |
| src/components/SwarmTaskNode.tsx:107 | `text-(--status-warn)/80` | HivePage — **D-08 boundary, untouched** |
| src/components/ToolExecutionPanel.tsx:145 | `text-primary/40` | Dashboard |
| src/components/ToolExecutionPanel.tsx:166 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:170 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:174 | `text-primary/70` | Dashboard |
| src/components/ToolExecutionPanel.tsx:283 | `text-muted-foreground/50` | Dashboard |
| src/components/ToolPolicyFeed.tsx:266 | `text-primary/70` | Tools |

#### Not-reached, adjudicated LEAVE-ALONE (isolation table) — 1

| File:Line | Class | Isolation ratio |
|---|---|---|
| src/components/ChatBubble.tsx:224 | `text-primary/90` | 4.626:1 |

## Test-file occurrences (4, excluded from the 50/54 classification per § 3's own precedent)

| File:Line | Class | Role | Disposition |
|---|---|---|---|
| src/components/JobsPanel.test.tsx:172 | `text-muted-foreground/50` | selector, asserts `.toBe(1)` | re-target to `svg.lucide-clock` |
| src/components/JobsPanel.test.tsx:193 | `text-muted-foreground/50` | selector, asserts `.toBe(1)` | re-target to `svg.lucide-clock` |
| src/components/JobsPanel.test.tsx:200 | `text-primary/80` | explanatory comment | unchanged — `:34` is a leave row |
| src/components/JobsPanel.test.tsx:210 | `text-muted-foreground/50` | selector, asserts `.toBe(0)` | re-target to `svg.lucide-clock` |
