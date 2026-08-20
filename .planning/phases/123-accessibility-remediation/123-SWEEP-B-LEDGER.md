---
phase: 123-accessibility-remediation
plan: 11
title: Bucket B occurrence ledger — per-occurrence disposition
purpose: D-01/D-04 ratio-gated sweep over bucket B (src/components/*/ and src/pages/, per plan 123-11's 42-file `files_modified` list). Authority for plan 123-11 Task 2's edits.
---

# Bucket B — occurrence ledger

## Task 1: population re-derivation

### Live population, re-derived 2026-08-20 (not carried forward from the plan's "42 files, 113
occurrences" text — that figure predates plans 123-05/123-08/123-09/123-10)

Commands run against exactly the 42 files in `123-11-PLAN.md`'s frontmatter `files_modified` list
(built as an explicit newline list, not a `for f in $(...)` word-split loop, so no path is silently
dropped):

```
occurrences: grep -ohE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' <42 files> | wc -l   -> 111
files:       grep -olE '<same pattern>' <42 files> | wc -l                                                                  -> 42
```

- **occurrences = 111** (unit: occurrences, `grep -o | wc -l`, not matching lines)
- **files with ≥1 hit = 42** (unit: files, `grep -l | wc -l`) — every file the plan named still
  carries at least one occurrence; none was already fully cleaned by a concurrent session.

This differs from the plan's carried-forward "113 → 112 after 123-05" framing by one more
occurrence than expected. Reconciliation below (against `123-CONTRAST-RESULT.md` § 3, itself
re-derived live at write time, post-123-08) shows **zero unreconciled occurrences** and **zero
ledger rows for bucket-B files that are no longer live** — i.e. the 161-occurrence corpus in
§ 3 already reflects the current 111-count state for this bucket; the plan text's 113/112 was
simply a stale snapshot from before § 3 was written, not evidence of an additional edit made
since. No further chase needed.

### Discrimination control (C4-style: one known-absent, one known-present)

```
... DashboardLayout.tsx    -> 0   (cleaned by plan 123-04, not a bucket-B file, used as the plan's own control)
... DetailConfigTab.tsx    -> 15  (bucket B's largest member)
```

Both directions discriminate — the probe is not a vacuous zero/non-zero pair.

### Reconciliation against `123-CONTRAST-RESULT.md` § 3

§ 3's four tables (Measured-failing, Not-reached REMEDIATE, Measured-passing, Not-reached
LEAVE-ALONE — 161 rows total across the whole corpus) were filtered to the 42 bucket-B files and
joined 1:1 against the 111 live occurrences by `(file, line, class-string)`.

- **Ledger rows matching a bucket-B file: 111**
- **Live occurrences matching a ledger row: 111**
- **Only in live, absent from ledger (`unreconciled`): 0**
- **Only in ledger, no longer live (already fixed since § 3 was written): 0**

Every one of the 111 live occurrences has exactly one ledger row, and every ledger row for this
bucket is still live. `unreconciled = 0` — the plan stops-and-reports condition does not trigger.

### Disposition arithmetic

| Disposition | Count |
|---|---|
| **change** — measured-failing (pass: axe) | 7 |
| **change** — not-reached, adjudicated REMEDIATE (isolation table) | 57 |
| **change total** | **64** |
| **leave** — measured-passing (pass: axe) | 45 |
| **leave** — not-reached, adjudicated LEAVE-ALONE (isolation table) | 2 |
| **leave total** | **47** |
| **unreconciled** | **0** |
| **live_before (change + leave + unreconciled)** | **111** |

`64 + 47 + 0 = 111` — balances exactly against the re-derived live population.

### Evidence tier — RENDERED failure vs isolation-table-only (orchestrator's addendum)

The `123-CONTRAST-RESULT-ADDENDUM.md` closed the 48-cell dev-server gap after § 3 was written.
Per the orchestrator's measurement (post-dates the addendum's own route-level table): of the 41
`change` rows in this bucket citing "only reachable via unmeasured route(s) — dev-server 504 gap",
the citing route now has real axe data:

- **Chat (7 rows), DocComments (1 row), Reminders (4 rows) — 12 rows — now measure ZERO
  color-contrast violations in all 4 themes.** These rows rest on the class-level isolation table
  only; the addendum's absence of a rendered flag does not make the disposition wrong (an
  occurrence can fail in isolation and never render in the scanned DOM state, per § 3's own
  bounding note), but no rendered failure backs them.
- **HrRoster (19 rows), HrOnboarding (4 rows), HrTeams (6 rows) — 29 rows — the citing route now
  measures real, non-zero color-contrast violations** in the addendum's recovered capture. This
  corroborates the isolation-table disposition at the ROUTE level; it is not a node-level match
  to this specific `file:line` (the addendum's capture data is not fine-grained enough to say
  which exact element failed), so it is reported as route-corroborated, not as a direct axe hit
  on this line.
- The remaining **16 `change` rows** cite a different not-reached reason (`.map(` list-item,
  loading/error-branch, or conditionally-rendered heuristic) on an otherwise-CAPTURED route — these
  were never part of the 48-cell gap and are unaffected by the addendum. Isolation-table-only.
- The **7 `measured-failing (pass: axe)`** rows were confirmed by a real `color-contrast` violation
  in the original widened scan — directly backed by a rendered failure, strongest evidence tier.

Summary: **36 of 64 change rows are backed by a rendered failure** (7 direct + 29 route-corroborated
via the addendum); **28 of 64 rest on the isolation table only** (12 now-measured-zero-route rows +
16 captured-route-but-not-rendered rows). `36 + 28 = 64`.

---

## Change list (64 rows) — apply in Task 2

`E` = evidence tier: `axe-direct` (measured-failing, original scan), `axe-route` (route-corroborated
via the addendum, not node-level), `isolation` (isolation table only — route measures zero, or
occurrence never reaches the DOM in any capture).

| File:Line | Class | Ratio | E |
|---|---|---|---|
| src/components/hr/CatalogCard.tsx:87 | `text-muted-foreground/80` | 3.73:1 | axe-direct |
| src/components/skills/ScopeRail.tsx:51 | `text-primary/70` | 4.08:1 | axe-direct |
| src/pages/hr/Catalog.tsx:24 | `text-muted-foreground/80` | 3.93:1 | axe-direct |
| src/pages/KnowledgeGraph.tsx:1540 | `text-muted-foreground/70` | 3.31:1 | axe-direct |
| src/pages/McpInventory.tsx:243 | `text-primary/70` | 3.96:1 | axe-direct |
| src/pages/Skills.tsx:561 | `text-primary/70` | 4.08:1 | axe-direct |
| src/pages/ToolGalaxy.tsx:268 | `text-primary/70` | 3.96:1 | axe-direct |
| src/components/chat/VitalsRail.tsx:205 | `text-(--status-error)/60` | 2.152:1 | isolation |
| src/components/chat/VitalsRail.tsx:229 | `text-muted-foreground/50` | 2.095:1 | isolation |
| src/components/chat/VitalsRail.tsx:246 | `text-muted-foreground/50` | 2.095:1 | isolation |
| src/components/chat/VitalsRail.tsx:268 | `text-muted-foreground/50` | 2.095:1 | isolation |
| src/components/chat/VitalsRail.tsx:402 | `text-muted-foreground/40` | 1.785:1 | isolation |
| src/components/doccomments/DocViewer.tsx:36 | `text-muted-foreground/60` | 2.433:1 | isolation |
| src/components/hr/AgentCard.tsx:103 | `text-muted-foreground/80` | 3.222:1 | axe-route (HrRoster) |
| src/components/hr/AgentCard.tsx:119 | `text-primary/60` | 2.849:1 | axe-route (HrRoster) |
| src/components/hr/AgentDetailSheet.tsx:217 | `text-muted-foreground/80` | 3.222:1 | axe-route (HrRoster) |
| src/components/hr/TeamCard.tsx:38 | `text-muted-foreground/80` | 3.222:1 | axe-route (HrTeams) |
| src/components/hr/TeamCard.tsx:62 | `text-muted-foreground/60` | 2.433:1 | axe-route (HrTeams) |
| src/components/hr/TeamEditor.tsx:87 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrTeams) |
| src/components/hr/TeamEditor.tsx:112 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrTeams) |
| src/components/hr/WizardShell.tsx:82 | `text-primary/70` | 3.395:1 | axe-route (HrOnboarding) |
| src/components/hr/WizardStepper.tsx:48 | `text-muted-foreground/60` | 2.433:1 | axe-route (HrOnboarding) |
| src/components/hr/detail/DetailConfigTab.tsx:30 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:110 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:118 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:128 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:138 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:153 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:167 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:179 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:237 | `text-primary/80` | 3.984:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:244 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:262 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:276 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:298 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrRoster) |
| src/components/hr/detail/DetailConfigTab.tsx:311 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrRoster) |
| src/components/hr/steps/ToolsStep.tsx:307 | `text-primary/80` | 3.984:1 | axe-route (HrOnboarding) |
| src/components/hr/steps/ToolsStep.tsx:392 | `text-primary/80` | 3.984:1 | axe-route (HrOnboarding) |
| src/components/kg/KGViewsPopover.tsx:183 | `text-primary/60` | 2.849:1 | isolation |
| src/components/reminders/CalendarOverlay.tsx:224 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/reminders/CalendarOverlay.tsx:337 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/reminders/ReminderList.tsx:604 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/reminders/ReminderList.tsx:622 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/skills/AllSkillsOverview.tsx:92 | `text-primary/60` | 2.849:1 | isolation |
| src/components/skills/IntakeSheet.tsx:42 | `text-primary/70` | 3.395:1 | isolation |
| src/components/skills/SkillEditPopover.tsx:92 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/skills/SkillFilterChips.tsx:63 | `text-primary/80` | 3.984:1 | isolation |
| src/components/skills/SkillFilterChips.tsx:63 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/components/skills/SkillRow.tsx:166 | `text-muted-foreground/30` | 1.550:1 | isolation |
| src/components/skills/vault/SkillKanbanView.tsx:77 | `text-muted-foreground/50` | 2.095:1 | isolation |
| src/components/skills/vault/SkillRecencyView.tsx:96 | `text-muted-foreground/50` | 2.095:1 | isolation |
| src/pages/Chat.tsx:733 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/pages/Chat.tsx:746 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1553 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1712 | `text-primary/70` | 3.395:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1740 | `text-muted-foreground/70` | 2.818:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1752 | `text-primary/70` | 3.395:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1806 | `text-primary/70` | 3.395:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1812 | `text-primary/50` | 2.404:1 | isolation |
| src/pages/KnowledgeGraph.tsx:1822 | `text-muted-foreground/60` | 2.433:1 | isolation |
| src/pages/hr/Roster.tsx:117 | `text-muted-foreground/80` | 3.222:1 | axe-route (HrRoster) |
| src/pages/hr/Roster.tsx:119 | `text-primary/70` | 3.395:1 | axe-route (HrRoster) |
| src/pages/hr/Teams.tsx:54 | `text-muted-foreground/80` | 3.222:1 | axe-route (HrTeams) |
| src/pages/hr/Teams.tsx:77 | `text-muted-foreground/50` | 2.095:1 | axe-route (HrTeams) |

(64 rows: 7 axe-direct + 29 axe-route + 28 isolation.)

## Leave list (47 rows) — do NOT edit

| File:Line | Class | Ratio / Route | Pass |
|---|---|---|---|
| src/components/graph/CodeVaultGraph.tsx:797 | `text-muted-foreground/60` | Graphs | axe |
| src/components/graph/CodeVaultGraph.tsx:859 | `text-muted-foreground/50` | Graphs | axe |
| src/components/graph/CodeVaultGraph.tsx:902 | `text-primary/40` | Graphs | axe |
| src/components/graph/CodeVaultGraph.tsx:906 | `text-muted-foreground/70` | Graphs | axe |
| src/components/hr/CatalogCard.tsx:38 | `text-primary/80` | HrCatalog | axe |
| src/components/hr/CatalogCard.tsx:43 | `text-muted-foreground/80` | HrCatalog | axe |
| src/components/hr/TeamCard.tsx:56 | `text-primary/90` | 4.626:1 | isolation (passes all surfaces) |
| src/components/hr/detail/DetailConfigTab.tsx:292 | `text-primary/90` | 4.626:1 | isolation (passes all surfaces) |
| src/components/kg/KGDetailsPanel.tsx:38 | `text-muted-foreground/50` | KnowledgeGraph | axe |
| src/components/kg/KGDetailsPanel.tsx:112 | `text-muted-foreground/70` | KnowledgeGraph | axe |
| src/components/kg/KGDetailsPanel.tsx:329 | `text-muted-foreground/50` | KnowledgeGraph | axe |
| src/components/kg/KGDiffControls.tsx:95 | `text-muted-foreground/60` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:60 | `text-primary/70` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:94 | `text-muted-foreground/70` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:103 | `text-primary/50` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:107 | `text-muted-foreground/60` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:118 | `text-primary/50` | KnowledgeGraph | axe |
| src/components/kg/KGSearchResults.tsx:122 | `text-muted-foreground/60` | KnowledgeGraph | axe |
| src/components/kg/KGViewsPopover.tsx:150 | `text-primary/30` | KnowledgeGraph | axe |
| src/components/kg/KGViewsPopover.tsx:154 | `text-muted-foreground/60` | KnowledgeGraph | axe |
| src/components/skills/AllSkillsOverview.tsx:150 | `text-muted-foreground/60` | Skills | axe |
| src/components/skills/CategoryGrid.tsx:123 | `text-primary/60` | Skills | axe |
| src/components/skills/ColdStorageView.tsx:42 | `text-muted-foreground/60` | Skills | axe |
| src/components/skills/IntakeStrip.tsx:38 | `text-primary/70` | Skills | axe |
| src/components/skills/NewSkillsBanner.tsx:31 | `text-primary/70` | Skills | axe |
| src/components/skills/SkillCommandDeck.tsx:86 | `text-primary/70` | Skills | axe |
| src/components/skills/SkillEditPopover.tsx:52 | `text-muted-foreground/70` | Skills | axe |
| src/components/skills/SkillEditPopover.tsx:53 | `text-muted-foreground/70` | Skills | axe |
| src/components/skills/SkillRow.tsx:146 | `text-primary/30` | Skills | axe |
| src/components/skills/SkillRow.tsx:172 | `text-primary/60` | Skills | axe |
| src/components/skills/vault/SkillKanbanView.tsx:95 | `text-muted-foreground/60` | Skills | axe |
| src/components/skills/vault/SkillPackView.tsx:253 | `text-muted-foreground/70` | Skills | axe |
| src/components/skills/vault/SkillVaultView.tsx:194 | `text-muted-foreground/70` | Skills | axe |
| src/components/workspace/AstridrLensEmptyState.tsx:52 | `text-primary/40` | WorkspaceMap | axe |
| src/components/workspace/AstridrLensEmptyState.tsx:56 | `text-muted-foreground/70` | WorkspaceMap | axe |
| src/components/workspace/AstridrLensEmptyState.tsx:67 | `text-primary/40` | WorkspaceMap | axe |
| src/components/workspace/AstridrLensEmptyState.tsx:71 | `text-muted-foreground/70` | WorkspaceMap | axe |
| src/pages/KnowledgeGraph.tsx:940 | `text-primary/70` | KnowledgeGraph | axe |
| src/pages/McpInventory.tsx:184 | `text-muted-foreground/70` | McpInventory | axe |
| src/pages/McpInventory.tsx:307 | `text-primary/40` | McpInventory | axe |
| src/pages/McpInventory.tsx:311 | `text-muted-foreground/60` | McpInventory | axe |
| src/pages/Skills.tsx:589 | `text-primary/40` | Skills | axe |
| src/pages/ToolGalaxy.tsx:342 | `text-primary/50` | ToolGalaxy | axe |
| src/pages/ToolGalaxy.tsx:346 | `text-muted-foreground/60` | ToolGalaxy | axe |
| src/pages/ToolGalaxy.tsx:490 | `text-muted-foreground/50` | ToolGalaxy | axe |
| src/pages/ToolGalaxy.tsx:517 | `text-muted-foreground/50` | ToolGalaxy | axe |
| src/pages/ToolGalaxy.tsx:538 | `text-muted-foreground/50` | ToolGalaxy | axe |

(47 rows: 45 measured-passing (axe, rendered on a captured route) + 2 not-reached LEAVE-ALONE
(isolation table passes on every surface/theme measured).)

## Baseline collateral counts (before Task 2 edits)

Across the same 42 files:

```
bg-*/NN + border-*/NN occurrences: 331   (grep -ohE 'bg-[a-zA-Z-]+/[0-9]+|border-[a-zA-Z-]+/[0-9]+' <42 files> | wc -l)
hex literals (#RGB..#RRGGBBAA):     51   (grep -roE '#[0-9a-fA-F]{3,8}' <42 files> | wc -l)
```

Task 2 must reproduce these two counts unchanged after editing.

---

## Task 2 result (post-edit, confirmed)

- Live occurrence count after editing: **47**, exactly matching `leave` (47). Arithmetic:
  `111 (live_before) - 64 (changed) = 47 (live_after) = 47 (leave_count)`.
- `bg-*/NN` + `border-*/NN` across the 42 files: **331** — unchanged.
- Hex literals across the 42 files: **51** — unchanged.
- Exhaustive per-occurrence diff of post-edit survivors against the leave list: **0 missing, 0
  unexplained** — every surviving occurrence is a leave row, by exact `(file, line, class)` match,
  not merely by class-string membership.
- `npx tsc --noEmit`: clean.
- `npm test`'s jsdom "unit" project (the project covering every file this task touches; the repo
  also carries an uncommitted `vitest.config.ts`/`package.json` browser-mode chromium project from
  a concurrent, unrelated session, present since before this plan's first tool call, whose
  `src/test/setup.ts` import fails independent of this sweep): **346/346 test files, 4879/4879
  tests, 0 failures.**

## Task 3 result — post-sweep re-measurement (widened 188-cell matrix)

Ran `A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1` against the shared `dev:noauth` server already serving
5181 (reused, not restarted, per the plan). 188/188 cells captured (one cell, `readable__HrRoster`,
hit the D-13 marker-timeout gate on the first pass — the same non-deterministic slow-cold-fetch
behaviour the addendum already documented for `cyan__HrRoster` — and completed cleanly on a solo
re-run, 13.3s). `A11Y_MEASURE_ONLY=1` makes every scanned cell throw
`"assertions suppressed: this is a measurement, not a verification"` by design (D-14); Playwright's
own "188 failed / 1 passed" summary is not a verdict and is not read as one.

Counts parsed from `violations[].nodes.length` in each capture JSON — never grepped `"id"`.

### Criterion cells (20: Dashboard, LiveRun, Analytics, Forge, Graphs × 4 themes)

| Rule | Objects | Nodes |
|---|---|---|
| color-contrast | **0** | **0** |
| aria-prohibited-attr | **0** | **0** |
| ALL rules (must-differ control) | 1 | 1 |

**Both criterion rules the plan gates on are clean: 0/0.** The lone ALL-rules hit (1 object/1 node)
is `scrollable-region-focusable` on `[readable] LiveRun` only — an unrelated rule, not touched by
this sweep, matching the class of theme-dependent scroll-overflow flakiness § 1 already documented
for other routes (Ideation, Executions, HrCatalog). Named below, not absorbed into the criterion
verdict, and does not affect it (criterion is scoped to the two named rules).

### Full 188-cell aggregate (must-differ control, both criterion rules 0/0 confirmed via a live
188/188 capture count, not an empty scan misread as clean)

| Rule | Objects | Nodes |
|---|---|---|
| button-name | 35 | 387 |
| color-contrast | 14 | 35 |
| aria-input-field-name | 7 | 15 |
| label | 8 | 12 |
| select-name | 4 | 8 |
| scrollable-region-focusable | 6 | 6 |
| aria-valid-attr-value | 5 | 5 |
| link-in-text-block | 4 | 4 |
| **TOTAL** | **83** | **472** |

Pre-sweep full-188 baseline (§ addendum "Consolidated 188-cell picture" + its own D-16 note):
96 objects / 966 nodes ALL rules; color-contrast specifically 28 objects / 61 nodes. Post-sweep:
83/472 ALL rules (-13 objects / -494 nodes — the huge node delta is `button-name`/`Ideation`
churn, not this sweep's rule, see below); color-contrast 14/35 (**-14 objects / -26 nodes**,
this sweep's own rule, consistent with fixing 64 sub-threshold occurrences across 30 files while
D-01 explicitly leaves passing occurrences alone).

### Named per-route deltas (no route's node count silently absorbed)

Routes this sweep's 30 edited files own, decreased (improvements, consistent with the change list):

| Route | Pre-sweep | Post-sweep | Files in this sweep |
|---|---|---|---|
| KnowledgeGraph | 8 obj / 12 nodes | 4 obj / 8 nodes | KnowledgeGraph.tsx (8 change rows) |
| ToolGalaxy | 7 obj / 11 nodes | 4 obj / 8 nodes | ToolGalaxy.tsx (1 change row) |
| Skills | 3 obj / 9 nodes | 3 obj / 3 nodes | Skills.tsx, several skills/* files |
| HrCatalog | 2 obj / 6 nodes | 2 obj / 2 nodes | CatalogCard.tsx, Catalog.tsx |
| HrOnboarding (addendum) | 2 obj / 4 nodes | 2 obj / 2 nodes | WizardShell.tsx, WizardStepper.tsx, ToolsStep.tsx |
| HrRoster (addendum) | 6 obj / 14 nodes | 4 obj / 12 nodes | AgentCard.tsx, AgentDetailSheet.tsx, DetailConfigTab.tsx, Roster.tsx |
| HrTeams (addendum) | 2 obj / 2 nodes | **0 / 0** | TeamCard.tsx, TeamEditor.tsx, Teams.tsx |

Routes NOT in this sweep's file list, unchanged (control — proves the sweep did not touch
unrelated surfaces): Alerts (4/260), Automation (4/48), ConfigPage (7/43), HrAgentAnalytics (8/16),
Infrastructure (4/16 — explicitly out of scope, hardcoded-palette defect per the orchestrator),
Briefings (4/8), Executions (2/8), Memory (4/8), HivePage (4/4), QualityDetail (4/4),
SelfHealing (4/4), Settings (4/4), Tools (4/4), WorkspaceMap (4/4).

**Named anomalies — reported, not absorbed:**

1. **Ideation: 474 nodes (pre) → 0 (post), a huge favorable swing.** `Ideation.tsx` is not in this
   sweep's file list. § 1 itself flagged this exact route as "Theme-unstable... consistent with a
   live-data-dependent list... not adjudicated, re-measure before acting on the 474 figure alone."
   This drop is that documented instability landing on its clean side, not an effect of this sweep.
2. **Capabilities: 0 (pre) → 1 obj / 1 node (post), NEW.** `Capabilities.tsx` is not in this sweep's
   file list. The one flagged node is `scrollable-region-focusable` on `[cyan] Capabilities` only
   (`<div class="space-y-4 max-h-[480px] overflow-y-auto">`) — an unrelated rule, matching the same
   scroll-overflow-at-scan-time flakiness class as the LiveRun finding above.
3. **McpInventory: 3 obj / 3 nodes (pre) → 1 obj / 4 nodes (post) — node count went UP by one.**
   Pre-sweep's 3/3 was entirely the now-fixed `:243` occurrence (`text-primary/70`, this sweep's
   change list, axe-direct, now 0 on all 4 themes — confirmed clean). Post-sweep's 1 obj/4 nodes is
   a genuinely **different** site, `McpInventory.tsx:184` (`text-muted-foreground/70`, "{calls}"
   badge on `ServerPanel`) — a **leave-list** occurrence this sweep never touched, now flagging on
   `[aubergine]` only with 4 matching nodes (4 server groups rendered on that scan). This was
   classified `measured-passing` in `123-CONTRAST-RESULT.md` § 3, but `ServerPanel` is invoked
   inside `servers.map((g, i) => <ServerPanel group={g} ... />)` at `McpInventory.tsx:318` — the
   classification's "preceding 25 source lines" `.map(`-heuristic cannot see a `.map(` call made
   from a *different function*, hundreds of lines below the component's own definition, so this
   occurrence slipped through as falsely "measured-passing." This is D-17's ratchet catching a
   real pre-existing classification gap, not a regression this sweep introduced — different site,
   different theme, untouched by any of the 64 edits. Left as-is (still a `leave` row); named here
   for the operator/a future plan to reconcile, not silently fixed outside the reconciled ledger.

No other route's node count increased. The two rule families driving all three named items
(`scrollable-region-focusable`, and the pre-existing `.map(`-indirection gap) are outside this
sweep's `text-primary|muted-foreground/NN` scope.
