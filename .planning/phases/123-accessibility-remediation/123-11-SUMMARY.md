---
phase: 123-accessibility-remediation
plan: 11
subsystem: ui
tags: [tailwind, accessibility, wcag, contrast, playwright, axe]

requires:
  - phase: 123-accessibility-remediation
    provides: "plans 123-04/123-05 (shell + non-shell axe-direct fixes), 123-08 (161-occurrence classification), 123-09 (D-16 widen decision), 123-10 (status-fill remedy)"
provides:
  - "Bucket B (src/components/*/, src/pages/) ratio-gated sweep: 64 of 111 live text-primary|muted-foreground/NN occurrences deleted to full-strength token, 47 left alone against a measured passing ratio"
  - "123-SWEEP-B-LEDGER.md: per-occurrence disposition with evidence tier (axe-direct / axe-route / isolation-table-only) and the post-sweep 188-cell re-measurement"
affects: [123-12, 123-13]

tech-stack:
  added: []
  patterns:
    - "Adjacency-collision judgement: when a blanket /NN deletion would make a label and its value (or a message and its footnote) render identical, step the SPECIFIC colliding site to a distinct non-alpha token/size rather than touching the shared component all its siblings depend on"

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-SWEEP-B-LEDGER.md
    - .planning/phases/123-accessibility-remediation/a11y-sweep-b/ (188 capture JSONs)
  modified:
    - src/components/chat/VitalsRail.tsx
    - src/components/doccomments/DocViewer.tsx
    - src/components/hr/AgentCard.tsx
    - src/components/hr/AgentDetailSheet.tsx
    - src/components/hr/CatalogCard.tsx
    - src/components/hr/TeamCard.tsx
    - src/components/hr/TeamEditor.tsx
    - src/components/hr/WizardShell.tsx
    - src/components/hr/WizardStepper.tsx
    - src/components/hr/detail/DetailConfigTab.tsx
    - src/components/hr/steps/ToolsStep.tsx
    - src/components/kg/KGViewsPopover.tsx
    - src/components/reminders/CalendarOverlay.tsx
    - src/components/reminders/ReminderList.tsx
    - src/components/skills/AllSkillsOverview.tsx
    - src/components/skills/IntakeSheet.tsx
    - src/components/skills/ScopeRail.tsx
    - src/components/skills/SkillEditPopover.tsx
    - src/components/skills/SkillFilterChips.tsx
    - src/components/skills/SkillRow.tsx
    - src/components/skills/vault/SkillKanbanView.tsx
    - src/components/skills/vault/SkillRecencyView.tsx
    - src/pages/Chat.tsx
    - src/pages/KnowledgeGraph.tsx
    - src/pages/McpInventory.tsx
    - src/pages/Skills.tsx
    - src/pages/ToolGalaxy.tsx
    - src/pages/hr/Catalog.tsx
    - src/pages/hr/Roster.tsx
    - src/pages/hr/Teams.tsx

key-decisions:
  - "Live population re-derived at 111 occurrences / 42 files, not the plan's stale 113/112 carry-forward; reconciled 1:1 against 123-CONTRAST-RESULT.md section 3 with zero unreconciled"
  - "Two per-site token-step judgements instead of the default delete: DetailConfigTab.tsx:237 -> text-foreground (avoids colliding with the shared Field label at full text-primary); KnowledgeGraph.tsx:1540 -> text-muted-foreground + text-xs (avoids colliding with the {error} line directly above it)"
  - "McpInventory.tsx:184's now-visible color-contrast failure (leave-list, ServerPanel inside servers.map()) is reported, not fixed in this plan -- it is outside the reconciled change list and belongs to a future reconciliation pass"

patterns-established:
  - "Reconcile a sweep bucket's population against the corpus ledger by exact (file, line, class) triple, not by class-string membership -- catches occurrences a route-level or class-level check would silently miss"

requirements-completed: [A11Y-02]

duration: ~50min
completed: 2026-08-20
---

# Phase 123 Plan 11: Bucket B ratio-gated opacity sweep Summary

**Deleted 64 sub-threshold `text-primary/NN` and `text-muted-foreground/NN` opacity modifiers across 30 files in `src/components/*/` and `src/pages/`, leaving 47 measured-passing occurrences untouched, with the widened 188-cell re-scan confirming the 20-criterion cells clean and every route delta named.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 32 (30 source files + the ledger + 188 capture JSONs)

## Accomplishments

- Re-derived bucket B's live population (111 occurrences / 42 files) directly from the corpus
  rather than trusting the plan's stale 113/112 carry-forward, and reconciled it exactly against
  `123-CONTRAST-RESULT.md` section 3 with zero unreconciled occurrences.
- Applied the ledger's 64-row change list (7 axe-direct, 29 route-corroborated via the
  dev-server-gap addendum, 28 isolation-table-only), leaving all 47 leave-list occurrences
  untouched — confirmed by an exhaustive `(file, line, class)` diff, not a class-string count.
- Found and handled two genuine adjacency collisions the blanket-delete remedy would have created
  (a label reading identically to its value; a footnote reading identically to the message above
  it), stepping only the colliding site to a distinct token instead of leaving the collision in
  place or over-broadening the fix to a shared component.
- Re-measured the full widened 47×4 matrix post-sweep (188/188 cells captured) and named every
  per-route delta rather than folding it into an aggregate — including three anomalies none of
  which trace back to this sweep's 64 edits.

## Task Commits

1. **Task 1: Re-derive population and write the ledger** — `85c7fa85` (docs)
2. **Task 2: Apply the change list across bucket B** — `f512316e` (fix)
3. **Task 3: Re-measure and confirm no regression** — `b19dc478` (test)

## Files Created/Modified

- `.planning/phases/123-accessibility-remediation/123-SWEEP-B-LEDGER.md` — per-occurrence
  disposition (change/leave/unreconciled), evidence tier per change row, baseline collateral
  counts, and the Task 3 post-sweep comparison.
- `.planning/phases/123-accessibility-remediation/a11y-sweep-b/*.json` — 188 raw axe capture
  files from the post-sweep re-scan.
- 30 source files (listed in frontmatter) — `/NN` alpha modifier deleted from 64 occurrences;
  2 of those 64 stepped to a distinct token/size instead of a plain delete (see Decisions).

## Population re-derivation (Task 1)

```
occurrences: grep -ohE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' <42 files> | wc -l  -> 111
files:       grep -olE '<same pattern>' <42 files> | wc -l                                                                 -> 42
```

Discrimination control: `DashboardLayout.tsx` → 0 (cleaned by 123-04), `DetailConfigTab.tsx` → 15
(bucket's largest member). Both directions discriminate.

Reconciled 1:1 against `123-CONTRAST-RESULT.md` § 3 (161-row whole-corpus ledger, itself re-derived
live at write time post-123-08): 111 bucket-B ledger rows, 111 live occurrences, **0 unreconciled,
0 already-fixed**. The plan's "113 → 112" framing was simply a stale snapshot predating § 3, not
evidence of extra work done since.

**Disposition arithmetic:** `64 (change) + 47 (leave) + 0 (unreconciled) = 111 (live_before)`.

**Evidence tier for the 64 change rows** (per the orchestrator's addendum data, which post-dates
§ 3): 7 axe-direct (confirmed by a real color-contrast violation in the original scan), 29
axe-route (the citing route — HrRoster/HrOnboarding/HrTeams — now measures a real, non-zero
color-contrast violation in the recovered 48-cell addendum, though not matched node-for-node to
this specific line), 28 isolation-table-only (either the citing route now measures zero — Chat,
DocComments, Reminders — or the occurrence sits behind a `.map(`/loading-branch/conditional gate
on an otherwise-captured route and was never reached by any axe pass).

## Apply the change list (Task 2)

Applied file-by-file (not a repo-wide substitution), per-occurrence, with two exceptions to the
default "delete `/NN`" remedy:

1. **`src/components/hr/detail/DetailConfigTab.tsx:237`** — the ID field's value span
   (`text-primary/80`) sits directly under the shared `Field` component's label (`:30`,
   `text-primary/70`, also in the change list). Deleting both straight to `text-primary` would make
   the ID's label and value render in the identical color with no other differentiator (the value
   span carries no size/weight override — it just inherits the wrapper's `text-sm`). Stepped the
   value to `text-foreground` instead — the same token every *other* `Field` value in the file
   already uses (e.g. the Name field at `:240`), so it's not a new pattern, just applying the
   file's own existing convention to the one site where the default remedy would have collided.
2. **`src/pages/KnowledgeGraph.tsx:1540`** — the error banner's footnote
   (`text-muted-foreground/70`) sits directly under `{error}` (`:1539`, plain `text-muted-foreground`,
   not in the sweep pattern, so untouched). Deleting the footnote's `/70` would make it identical to
   the line above — both `text-muted-foreground`, same size, same weight. `text-muted` (a candidate
   quieter token) was already rejected in 123-04 as unsafe (undefined per-theme for emerald/amber),
   and D-04 forbids reintroducing alpha, so stepped to `text-muted-foreground text-xs` — a
   size-based de-emphasis with full contrast and no alpha.

All other 62 change-list sites use the default delete remedy. Scanned every change site's ±3–4
line window for a bare (un-suffixed) occurrence of the same base token nearby (13 candidates
surfaced); all but the two above were false positives — either the bare match was the element's
own `hover:`/`group-hover:` destination (losing a cosmetic hover transition, not a rendering
collision), a mutually-exclusive ternary branch (never rendered simultaneously), or already
differentiated by element type or font-size (icon vs. text, `text-xs` vs `text-sm`/`text-base`).

**Post-edit verification:**

- Occurrence count: `111 - 64 = 47`, exactly matching the leave count.
- `bg-*/NN` + `border-*/NN` across the 42 files: 331 → 331, unchanged.
- Hex literals across the 42 files: 51 → 51, unchanged (none introduced).
- Exhaustive `(file, line, class)` diff of survivors against the leave list: 0 missing, 0
  unexplained — every surviving occurrence is a leave row.
- `npx tsc --noEmit`: clean.
- `npm test`: the jsdom "unit" project (covers every file this task touched): **346/346 test
  files, 4879/4879 tests passed, 0 failures.** The repo's `npm test` default also runs a second,
  browser-mode chromium project (`vitest.config.ts`) that was **already uncommitted and modified
  before this plan's first tool call** (a concurrent, unrelated session's in-progress
  browser-testing infrastructure — confirmed via `git diff vitest.config.ts`/`package.json`,
  neither staged nor touched by this plan). That project fails to import `src/test/setup.ts`
  (`TypeError: Illegal invocation`) for every one of its ~364 test files uniformly, independent of
  which source files exist — proof this is an environment/config issue, not a per-component
  regression from this sweep. Not fixed here (out of scope, not owned by this plan); flagged for
  whoever owns that concurrent work.

## Re-measure (Task 3)

Re-ran the widened 47×4 matrix against the already-running `dev:noauth` server on 5181 (reused,
not restarted). 188/188 cells captured — one cell (`readable__HrRoster`) hit the D-13 marker-timeout
gate on the first pass (the same non-deterministic slow-cold-fetch behaviour the addendum already
documented for `cyan__HrRoster`) and completed cleanly on a solo re-run (13.3s).

**Criterion cells (20): color-contrast 0/0, aria-prohibited-attr 0/0 — both clean.** The lone
ALL-rules hit in the criterion set (1 object/1 node) is `scrollable-region-focusable` on
`[readable] LiveRun` — an unrelated rule, not gated by A11Y-02, matching the theme-dependent
scroll-overflow flakiness `123-CONTRAST-RESULT.md` § 1 already documented for other routes.

**Full 188-cell color-contrast: 28 objects/61 nodes (pre-sweep, per the addendum) → 14 objects/35
nodes (post-sweep): -14 objects, -26 nodes.**

Named every per-route delta (full table in the ledger). Routes this sweep touched all decreased in
line with the change list (KnowledgeGraph 12→8 nodes, ToolGalaxy 11→8, Skills 9→3, HrCatalog 6→2,
HrOnboarding 4→2, HrRoster 14→12, HrTeams 2→0). Routes not in this sweep's file list were unchanged
(Alerts, Automation, ConfigPage, HrAgentAnalytics, Infrastructure, Briefings, Executions, Memory,
HivePage, QualityDetail, SelfHealing, Settings, Tools, WorkspaceMap) — a control proving the sweep
touched only its intended surface.

**Three named anomalies, none caused by this sweep:**

1. Ideation: 474→0 nodes — `Ideation.tsx` is not a bucket-B file; § 1 already flagged this route
   as theme-unstable/timing-race, "re-measure before acting on the 474 figure alone."
2. Capabilities: 0→1 node (new) — `scrollable-region-focusable` on `[cyan]` only, same
   scroll-overflow flakiness class as the LiveRun finding; `Capabilities.tsx` not a bucket-B file.
3. **McpInventory: 3 objects/3 nodes → 1 object/4 nodes — node count went UP by one.** Pre-sweep's
   count was entirely the now-fixed `:243` site (confirmed clean on all 4 themes post-sweep).
   Post-sweep's finding is a genuinely different, untouched **leave-list** site (`:184`,
   `text-muted-foreground/70` on a `ServerPanel` "calls" badge), now flagging on `[aubergine]`
   with 4 matching nodes. `ServerPanel` is invoked inside `servers.map((g, i) => <ServerPanel
   group={g} .../>)` at `:318` — the original classification's "preceding 25 source lines"
   `.map(`-heuristic cannot see a `.map(` call made from a different function far below the
   component's own definition, so this occurrence slipped through `123-CONTRAST-RESULT.md` § 3 as
   falsely "measured-passing." This is D-17's ratchet catching a real, pre-existing classification
   gap — not a regression this sweep introduced (different site, different theme, none of the 64
   edits touch it). Left as a `leave` row per the reconciled ledger; reported here for a future
   reconciliation pass rather than fixed outside scope.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: re-derive rather than trust carried-forward counts;
step two specific adjacency-collision sites to a distinct token instead of the default delete;
report (not silently fix) the McpInventory ratchet-catch that surfaced outside this plan's
reconciled change list.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues encountered that required Rule 1-3
auto-fixes beyond the per-site adjacency judgement calls the plan itself anticipated and scoped
("Per-site judgement, applied only where the ledger flags adjacency risk or where reading the file
shows it").

**Total deviations:** 0 auto-fixed. The two token-step remedies and the McpInventory finding are
plan-anticipated judgement calls and measurement findings, not deviations from the plan's process.

## Issues Encountered

- The dev server's browser-mode test project (uncommitted, concurrent-session infrastructure, not
  part of this plan) fails uniformly across all its test files — documented above, not fixed, not
  this plan's scope.
- `readable__HrRoster` needed one solo re-run to clear a D-13 marker-timeout — matches documented
  precedent, not a new issue.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Bucket B is fully swept and re-measured clean on the 20-cell criterion. `123-12` (bucket A,
top-level `src/components/*.tsx`) can proceed independently — it does not share any file with this
plan's 30 edited files, and the shared `dev:noauth` server on 5181 was left running, untouched, and
healthy for it to reuse. One residual item for a future reconciliation pass: `McpInventory.tsx:184`
(leave-list, `.map()`-indirection classification gap) — not blocking, named for visibility.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*

## Self-Check: PASSED

All created files and all three task commits verified present.
