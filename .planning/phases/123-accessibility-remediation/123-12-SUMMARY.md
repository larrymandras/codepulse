---
phase: 123-accessibility-remediation
plan: 12
subsystem: ui
tags: [tailwind, accessibility, wcag, contrast, playwright, axe]

requires:
  - phase: 123-accessibility-remediation
    provides: "plans 123-04/123-05 (shell + non-shell axe-direct fixes), 123-08 (161-occurrence classification), 123-09 (D-16 widen decision), 123-10 (status-fill remedy), 123-11 (bucket B sweep precedent)"
provides:
  - "Bucket A (top-level src/components/*.tsx) ratio-gated sweep: 18 of 50 live text-primary|muted-foreground/NN occurrences deleted to full-strength token (1 stepped to a distinct token), 32 left alone against a measured passing or isolation-passing ratio"
  - "123-SWEEP-A-LEDGER.md: per-occurrence disposition, a proactively-caught heuristic false-positive correction, the JobsPanel.tsx/.test.tsx lockstep rule with mutation proof, and the post-sweep 188-cell re-measurement"
affects: [123-13]

tech-stack:
  added: []
  patterns:
    - "Icon-identity test selectors: re-target a class-string selector on a Lucide icon's generated class name (svg.lucide-<name>) instead of a color/opacity class, when the color class is itself the thing under test -- decouples the assertion from the exact styling value entirely, matching the existing src/pages/Settings.test.tsx precedent"
    - "Population reconciliation catches classifier heuristic errors, not just population drift: an unrelated .map() call elsewhere in a file can fall inside a 25-line lookback window for one occurrence and not another, producing two structurally-identical sibling lines with different not-reached dispositions -- check for this before trusting a REMEDIATE row that cites 'list-item (.map)' on a file whose only .map() is unrelated to the JSX in question"

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-SWEEP-A-LEDGER.md
    - .planning/phases/123-accessibility-remediation/a11y-sweep-a/ (188 capture JSONs)
  modified:
    - src/components/AgentTopology.tsx
    - src/components/BlackboardPanel.tsx
    - src/components/ChatBubble.tsx
    - src/components/DockerPanel.tsx
    - src/components/EventFeed.tsx
    - src/components/JobsPanel.tsx
    - src/components/JobsPanel.test.tsx
    - src/components/ModelPricingAdmin.tsx
    - src/components/OnboardingGuide.tsx
    - src/components/ProviderControls.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/WarRoomKanbanColumn.tsx
    - src/components/WarRoomTaskCard.tsx

key-decisions:
  - "Live population re-derived at 50 occurrences / 21 source files (54/22 incl. JobsPanel.test.tsx), matching the plan's carried-forward count exactly (unlike bucket B, whose plan text was stale) -- reconciled 1:1 against 123-CONTRAST-RESULT.md section 3, zero unreconciled"
  - "Reclassified GitActivityWidget.tsx:47 and :53 from REMEDIATE to measured-passing LEAVE before editing: their section-3 'list-item (.map)' reason traced to an unrelated Object.entries(byDay).map() call 15 lines above (inside the classifier's 25-line lookback window), not the actual static JSX -- same heuristic-false-positive class 123-11-SUMMARY named for McpInventory.tsx:184, caught proactively here instead of discovered later"
  - "ModelPricingAdmin.tsx:231's provider parenthetical collides with its own wrapper span on a plain delete (both would render text-muted-foreground) -- stepped to text-muted-foreground text-xs per 123-11's established remedy for the identical collision shape"
  - "JobsPanel.test.tsx's three selectors re-targeted from the now-nonexistent text-muted-foreground/50 class string onto svg.lucide-clock rather than a bare text-muted-foreground swap, which was checked and found to over-match EntityRow's icon-wrapper div, the secondary/trailing text, and the elapsed span in the same render -- matches the existing src/pages/Settings.test.tsx icon-selector precedent and removes the whole class of fragility (decouples the test from the exact opacity value) rather than just patching the string"

patterns-established:
  - "Mutation-prove icon-identity selectors the same way as color-string selectors: an unmatchable-selector mutation must fail a .toBe(1) assertion, and a known-present-but-wrong-icon selector must fail a .toBe(0) control -- both were run and restored byte-identical against a pre-mutation backup"

requirements-completed: [A11Y-02]

duration: ~55min
completed: 2026-08-20
---

# Phase 123 Plan 12: Bucket A ratio-gated opacity sweep Summary

**Deleted 17 sub-threshold `text-primary/NN` and `text-muted-foreground/NN` opacity modifiers and stepped one collision to a distinct token across 13 files in the top level of `src/components/`, leaving 32 measured-passing occurrences untouched, catching a heuristic classification error before editing rather than after, and mutation-proving a JobsPanel test rewrite that decouples it from the exact opacity value.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 203 (13 source files + the ledger + 188 capture JSONs)

## Accomplishments

- Re-derived bucket A's live population (50 occurrences / 21 source files, 54/22 incl. the test
  file) directly from the corpus, matching the plan's own carried-forward count exactly, and
  reconciled it 1:1 against `123-CONTRAST-RESULT.md` § 3 with zero unreconciled occurrences.
- **Caught and corrected a classifier heuristic error before editing, not after:**
  `GitActivityWidget.tsx:47`/`:53` were classified `REMEDIATE` in § 3 on a "list-item (.map)"
  reason that traces to an unrelated `Object.entries(byDay).map(...)` call 15 lines above them —
  inside the classifier's 25-line lookback window, unlike their two structurally-identical
  siblings (`:59`/`:65`, already credited `measured-passing`) whose lookback window had scrolled
  past it. Same defect class 123-11-SUMMARY named for `McpInventory.tsx:184`; found here by
  reading the source before trusting the ledger row, not by a later re-measurement pass.
- Applied the ledger's 18-row change list (all isolation-table-only — none corroborated by a
  rendered failure; every cited route now measures 0 color-contrast in `a11y-sweep-b/`, most
  plausibly because the guarded content simply wasn't populated at scan time), leaving all 32
  leave-list occurrences untouched — confirmed by post-edit occurrence count (50 → 32, exactly the
  leave count) and `bg-*/NN`/`border-*/NN`/hex-literal counts staying byte-identical.
- Found and handled one genuine adjacency collision (`ModelPricingAdmin.tsx:231`'s provider
  parenthetical, which would otherwise render identical to its own wrapper span), stepping only
  that site to a distinct token per 123-11's established remedy for the same shape, and explicitly
  checked-and-rejected four other candidate collisions by reading the surrounding render tree.
- Rewrote and mutation-proved `JobsPanel.test.tsx`'s three affected selectors: rather than a naive
  string-swap (checked and found to over-match three unrelated elements in the same render),
  re-targeted on the Lucide icon's own generated class name, matching an existing repo precedent
  and removing the fragility class this plan exists to fix rather than relocating it.
- Re-measured the full widened 47×4 matrix post-sweep (188/188 cells captured) with both buckets'
  edits present, and named every non-color-contrast anomaly individually rather than attributing
  a 1-node total delta to this plan's edits without checking.

## Task Commits

1. **Task 1: Re-derive population and write the ledger** — `78be0cc7` (docs)
2. **Task 2: Apply the change list across bucket A** — `5926487b` (fix)
3. **Task 3: Re-measure and confirm no regression** — `73a12482` (test)

## Files Created/Modified

- `.planning/phases/123-accessibility-remediation/123-SWEEP-A-LEDGER.md` — per-occurrence
  disposition (change/leave/unreconciled), the GitActivityWidget reclassification writeup, the
  JobsPanel lockstep rule and mutation-proof design, and the Task 3 post-sweep comparison.
- `.planning/phases/123-accessibility-remediation/a11y-sweep-a/*.json` — 188 raw axe capture
  files from the post-sweep re-scan.
- 13 source files (listed in frontmatter) — `/NN` alpha modifier deleted from 17 occurrences;
  1 stepped to a distinct token (`ModelPricingAdmin.tsx:231`); `JobsPanel.test.tsx` updated in
  lockstep with `JobsPanel.tsx:96`.

## Population re-derivation (Task 1)

```
occurrences (source, 21 files): grep -ohE 'text-primary/[0-9]+|text-muted-foreground/[0-9]+|text-\(--[a-zA-Z-]+\)/[0-9]+' <21 files> | wc -l  -> 50
files with >=1 hit:              grep -olE '<same pattern>' <21 files> | wc -l                                                                -> 21
occurrences incl. test file:     grep -ohE '<same pattern>' <21 files> src/components/JobsPanel.test.tsx | wc -l                              -> 54
```

Discrimination control: `DashboardLayout.tsx` → 0 (cleaned by 123-04), `ToolExecutionPanel.tsx` →
6 (bucket A's largest member). Both directions discriminate.

Reconciled 1:1 against `123-CONTRAST-RESULT.md` § 3: 50 bucket-A live occurrences, 50 ledger rows,
**0 unreconciled**. Unlike bucket B, whose plan text carried a stale 113/112 figure, bucket A's
plan text ("22 files, 54 occurrences") matched the live re-derivation exactly — no stale-count
correction needed here.

**GitActivityWidget.tsx:47/:53 reclassification.** § 3 lists both as not-reached (list-item,
`.map`) and adjudicates REMEDIATE via the isolation table (3.395:1). Reading the source disproved
the reason: the file's only `.map(` (line 32, `Object.entries(byDay).map(...)`, an unrelated
bar-chart data transform) sits 15 lines above line 47 — inside the classifier's 25-line lookback
window — but has scrolled 27+ lines past by line 59, where the structurally-identical sibling
label is already credited `measured-passing`. All four labels ("Commits" `:47`, "PRs" `:53`,
"+ Lines" `:59`, "- Lines" `:65`) are static, non-mapped JSX in one `grid-cols-4` block. Verified
against the most recent `a11y-sweep-b/*__Dashboard.json` captures: 0 color-contrast violations
across all 4 themes. Reclassified `:47`/`:53` to `leave` on the same evidence basis as `:59`/`:65`
— this changes the plan's carried-forward 20-change/30-leave split to **18 change / 32 leave**,
still summing to the live 50.

**Disposition arithmetic:** `18 (change) + 32 (leave) + 0 (unreconciled) = 50 (live_before)`.

**Evidence tier for the 18 change rows:** all isolation-table-only. Checked every cited route
(Dashboard, HivePage, LiveRun, Chat, Settings, Tasks) against the most recent captures — all show
0 color-contrast on every theme. This most plausibly reflects the guarded content (a `.map(` list
body, a `{elapsed &&}` conditional, an admin-only panel) simply not being populated at scan time,
matching § 3's own "presence in the scanned DOM state is not established" caveat — not a
corroborated pass for these specific classes. None of the 18 changes rest on an observed rendered
failure; the isolation ratios (2.095–3.984:1) are real measured pixel data below WCAG AA
regardless.

## Apply the change list (Task 2)

Applied file-by-file (not a repo-wide substitution), per-occurrence, with one exception to the
default "delete `/NN`" remedy:

1. **`src/components/ModelPricingAdmin.tsx:231`** — the provider parenthetical
   (`text-muted-foreground/70`) sits directly inside its own wrapper span (`:230`,
   `text-muted-foreground`, full strength, not in the sweep pattern). Deleting `/70` would make
   `{m.model}` and `({m.provider})` render in the identical color with no differentiator. Stepped
   to `text-muted-foreground text-xs` — full contrast, no alpha, matching 123-11's established
   remedy for the identical collision shape (`KnowledgeGraph.tsx:1540`).

All other 17 change-list sites use the default delete remedy. Checked and rejected four other
candidate collisions by reading the surrounding render tree: `DockerPanel.tsx:84`/`:88` (both
change together, stay visually identical to each other as before); `WarRoomKanbanColumn.tsx:65`/
`:69` (different base tokens from each other and from `:63`, no merge); `OnboardingGuide.tsx:108`
(disabled `Previous` vs the `:118` dismiss button — different interactive elements, not a
label/value pair); `BlackboardPanel.tsx:117`'s fallback `Clock` icon vs `:28`'s `pending` state
icon (mutually-exclusive `Record` entries that never render for the same task, matching an
already-accepted inconsistency elsewhere in the same `Record`).

**JobsPanel lockstep.** Only `JobsPanel.tsx:96` (the fallback `Clock` icon) is a change row; `:81`
(empty-state icon) and `:34` (`CheckCircle`) are leave rows. Read live: none of the three affected
test assertions (`:172`, `:193`, `:210`) ever observe `:81` — all three mock a non-empty `jobs`
array, so only `:96`'s icon is ever in scope. A bare string-swap to `text-muted-foreground` (no
slash) was checked against the actual render tree and rejected: it would also match `EntityRow`'s
icon-wrapper div, the `secondary` paragraph, the `trailing` div, and the `elapsed` span (all
`text-muted-foreground` at full strength or with unrelated modifiers), breaking the `.toBe(1)`/
`.toBe(0)` counts. Re-targeted all three selectors on `svg.lucide-clock` — the fallback icon's own
Lucide-generated class, unique among the icons used here (`CheckCircle`/`XCircle`/`Ban`/
`ListTodo` render as `lucide-circle-check-big`/`lucide-x-circle`/`lucide-ban`/`lucide-list-todo`)
— matching the existing `src/pages/Settings.test.tsx:360` icon-selector precedent.

**Mutation proof, three separate probes, each restored byte-identical against a pre-mutation
backup (verified with `diff`):**
- `:172`'s selector mutated to `svg.lucide-clock-9x7q2` (unmatchable) → test **failed**
  (`expected +0 to be 1`).
- `:193`'s selector mutated the same way → test **failed** (`expected +0 to be 1`).
- `:210`'s selector mutated to `svg.lucide-circle-check-big` (the known-present `CheckCircle`
  icon's real class, for the "completed" status this test renders) → test **failed**
  (`expected 1 to be +0`), proving the control discriminates positively as well as negatively.

**Post-edit verification:**

- Occurrence count: `50 - 18 = 32`, exactly matching the leave count.
- `bg-*/NN` + `border-*/NN` across the 21 files: 229 → 229, unchanged.
- Hex literals across the 21 files: 14 → 14, unchanged (none introduced).
- `git diff --stat src/components/SwarmTaskNode.tsx`: empty — D-08's shadow boundary file was
  never touched (its one occurrence, `:107`, is a leave row).
- `npx tsc --noEmit`: clean.
- `npm test --project unit`: **346/346 test files, 4879/4879 tests passed, 0 failures** —
  identical figures to 123-11's own reported baseline; no new failures from this plan's edits.

## Re-measure (Task 3)

Re-ran the widened 47×4 matrix against the already-running `dev:noauth` server on 5181 (reused,
not restarted). 188/188 cells captured, 47/47 routes — asserted before any zero was recorded.
Both buckets' edits were present in the tree for this run (bucket B landed and committed before
this plan started); this measures the combined effect, stated explicitly rather than attributed
to bucket A alone.

**Criterion cells (20): color-contrast 0/0, aria-prohibited-attr 0/0 — both clean.**

**Full 188-cell color-contrast: 14 objects/36 nodes**, down from the pre-sweep addendum's 28
objects/61 nodes (both buckets combined). This is 1 node above `123-11-SUMMARY.md`'s own reported
post-bucket-B figure of 14/35 — traced directly (not assumed) to the already-known
`McpInventory.tsx:184` leave-list item 123-11 itself flagged as a classification gap: this run
caught it on `[readable]` (4 nodes) where 123-11 caught it on `[aubergine]` (4 nodes) — a theme
reassignment of the same live-data-dependent finding on an untouched file, not a new regression.

No route bucket A touches (Dashboard, HivePage, LiveRun, Chat, Settings, Tasks) shows any
color-contrast this run — all 0/0.

**Five routes show a node-count increase over their prior baseline. Every one is a
non-color-contrast rule, on a route neither bucket's `files_modified` list renders:**

| Route | Rule | Prior | Now | Disposition |
|---|---|---|---|---|
| Capabilities | `scrollable-region-focusable` | 0/0 | 1/1 (cyan) | Already named in `123-11-SUMMARY.md` as the same scroll-overflow flakiness class as LiveRun's — persists unchanged, not new. |
| HivePage | `scrollable-region-focusable` | 0 (new rule) | +2/2 (cyan, emerald) | Same flakiness class; `button-name` (4/4) unchanged. |
| Executions | `scrollable-region-focusable` | 0 (new rule) | +1/1 (cyan) | `color-contrast` byte-identical to Section 1's original theme-unstable figure (2/8) — no regression there. |
| Bifrost | `aria-prohibited-attr` | 0/0 | 1/1 (cyan only) | Not a bucket-A/B route; single-theme, matches Section 1's own theme-unstable pattern (Ideation/Executions/HrCatalog). |
| Memory | `color-contrast` (new) + `scrollable-region-focusable` (new) | 4/8 (`select-name` only) | +1/2 cc (cyan) +1/1 scroll (cyan) | **The one genuinely new color-contrast finding** — see below. |

**Memory's new color-contrast finding, inspected directly:** two badges,
`<span class="opacity-70">18</span>` on `.bg-sky-500/20` and `<span class="opacity-70">979</span>`
on `.bg-emerald-500/20`, flagged only on `cyan` (4.01 and 4.36 against a 4.5:1 threshold). This is
Tailwind's `opacity-NN` utility on a `bg-*-500/20` badge — a different class shape entirely from
this sweep's `text-primary|muted-foreground/NN` pattern (never one of § 3's 165 tracked
occurrences), on `Memory.tsx`, a file neither bucket's `files_modified` list includes, with
apparently-live numeric content consistent with the same live-data-dependent, theme-unstable
pattern Section 1 already named for Ideation/Executions/HrCatalog. Named for visibility; out of
this plan's scope to fix.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: re-derive rather than trust carried-forward
counts; reclassify `GitActivityWidget.tsx:47`/`:53` on direct evidence rather than transcribing
the ledger row; step one adjacency-collision site to a distinct token; re-target JobsPanel's test
selectors on icon identity rather than color-string, mutation-proven.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation defect] `GitActivityWidget.tsx:47`/`:53` misclassified in
`123-CONTRAST-RESULT.md` § 3**
- **Found during:** Task 1 (population reconciliation, before any edit was made)
- **Issue:** § 3 classified both lines "not-reached, list-item (.map)" and adjudicated REMEDIATE
  via the isolation table, but neither line is inside a `.map(` — the reason traces to an
  unrelated `.map()` call elsewhere in the file caught by the classifier's 25-line lookback
  heuristic.
- **Fix:** Reclassified both to `leave` (measured-passing), matching two structurally-identical
  sibling lines in the same grid already credited passing in § 3, and verified against live axe
  captures showing 0 color-contrast on the Dashboard route.
- **Files modified:** `123-SWEEP-A-LEDGER.md` (documentation only — `GitActivityWidget.tsx`
  itself received no edit for these two lines, since they are now `leave`).
- **Verification:** `a11y-sweep-b/*__Dashboard.json`, all 4 themes, 0 color-contrast.
- **Committed in:** `78be0cc7` (Task 1).

**Total deviations:** 1 auto-fixed (a classification correction caught and applied before any
source edit, not a mid-task discovery). The `ModelPricingAdmin.tsx` token-step and the mutation-
proof selector redesign are plan-anticipated judgement calls (the plan's own D-04 collision
guidance and mutation-proof requirement), not deviations from the plan's process.

## Issues Encountered

None blocking. The five non-color-contrast route anomalies in Task 3 (Capabilities, HivePage,
Executions, Bifrost, Memory) are named above, not fixed — all are on routes neither bucket's
`files_modified` list renders, and match either an already-documented flakiness class or a
class-pattern entirely outside this sweep's 165-occurrence corpus.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Bucket A is fully swept and re-measured clean on the 20-cell criterion. Plan `123-13` can proceed
independently — bucket A shares no file with `123-11`'s 30 edited files, and the shared
`dev:noauth` server on 5181 was left running, untouched, and healthy for it to reuse. One residual
item for a future reconciliation pass, named but out of scope here: `Memory.tsx`'s `opacity-NN` /
`bg-*-500/20` badge pattern — a genuinely different class shape from this sweep's tracked
occurrences, theme-unstable, on a file neither bucket touches.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*

## Self-Check: PASSED

All created files and all three task commits verified present (see below).
