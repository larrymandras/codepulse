---
phase: 123-accessibility-remediation
plan: 09
title: D-16 mid-phase checkpoint — does A11Y-02's criterion widen to 188 cells?
purpose: The operator's decision brief and recorded answer for whether A11Y-02's pass/fail gate stays at the 20 measured cells or widens to all 188, now that the extra 42 routes have real numbers.
---

# 123 Criterion Decision — D-16

## Sources

This brief is made against two documents, in this order:

1. `123-CONTRAST-RESULT.md` — the original 140/188-cell run (Section 1), the class-level isolation
   table (Section 2), and the occurrence remediation list (Section 3). Its own Section 1 records
   48 cells as **unmeasured** (a dev-server 504 gap) — that framing is **superseded** by (2) below
   and must not be read as current.
2. `123-CONTRAST-RESULT-ADDENDUM.md` — produced by the orchestrator after 123-08 closed, recovering
   the 48-cell gap. **The matrix is now 188/188 measured. The UNMEASURED category is empty.**

Every figure below is either quoted directly from one of those two documents or is a sum I
performed and show my working for — no number appears here that is not traceable to the ledger.

## 1. The 20-cell criterion status

**0 objects / 0 nodes of any rule id**, across all 20 cells (Dashboard, LiveRun, Analytics, Forge,
Graphs × 4 themes) — `123-CONTRAST-RESULT.md` §"Per-rule totals — the 20 criterion cells only".
None of the 5 criterion routes were ever in the 48-cell gap, so the addendum changes nothing here.
This confirms plans 123-04/123-05/123-06 hold under the full widened harness.

## 2. The extra 42 routes (168 non-criterion cells)

47 routes total − 5 criterion routes = 42 non-criterion routes × 4 themes = **168 cells**. Since
the 20 criterion cells contribute 0/0, the 168-cell aggregate equals the full 188-cell aggregate.

**Consolidated totals: 96 objects / 966 nodes**, per `123-CONTRAST-RESULT-ADDENDUM.md`
§"Consolidated 188-cell picture" (140-cell original 71/883 + 48-cell addendum 25/83 = 96/966).

**Per-rule breakdown, independently re-verified** by summing `123-CONTRAST-RESULT.md`'s 140-cell
per-rule table against `123-CONTRAST-RESULT-ADDENDUM.md`'s 48-cell per-rule table:

| Rule | 140-cell (original) | 48-cell (addendum) | Combined 188-cell |
|---|---|---|---|
| button-name | 29 / 806 | 7 / 51 | **36 / 857** |
| color-contrast | 18 / 37 | 10 / 24 | **28 / 61** |
| aria-input-field-name | 4 / 12 | 3 / 3 | **7 / 15** |
| label | 4 / 8 | 4 / 4 | **8 / 12** |
| select-name | 4 / 8 | 0 / 0 | **4 / 8** |
| aria-valid-attr-value | 4 / 4 | 1 / 1 | **5 / 5** |
| link-in-text-block | 4 / 4 | 0 / 0 | **4 / 4** |
| scrollable-region-focusable | 4 / 4 | 0 / 0 | **4 / 4** |
| **TOTAL** | **71 / 883** | **25 / 83** | **96 / 966** |

Both the row sums (36+28+7+8+4+5+4+4=96 objects; 857+61+15+12+8+5+4+4=966 nodes) and the two
source-table totals (71+25=96, 883+83=966) agree, and match the addendum's own stated consolidated
per-rule figures verbatim. **Verified.**

**button-name alone is 36 objects / 857 nodes — ~89% of all flagged nodes in the widened
population.** color-contrast is 28/61 — a small fraction of the total. **The widened population is
not primarily a contrast problem**, per the addendum's own framing.

### Distribution across the 42 routes (by node count, combining both source tables)

Non-criterion, non-zero-node routes (23 of 42): Ideation 474, Alerts 260, Automation 48,
ConfigPage 43, HrAgentAnalytics 16, Infrastructure 16, HrRoster 14, KnowledgeGraph 12, ToolGalaxy
11, Skills 9, Briefings 8, Executions 8, Memory 8, HrCatalog 6, HivePage 4, QualityDetail 4,
SelfHealing 4, Tools 4, WorkspaceMap 4, HrOnboarding 4, Settings 4, McpInventory 3, HrTeams 2.

- **19 of 42 routes have zero violations** (Bifrost, BuildProgress, Capabilities, Dreaming, Galdr,
  Inbox, Loom, MeetingBot, Quality, Security, SessionDetail, Studio, WhatsApp, Chat, DocComments,
  InsightsChat, Reminders, Tasks, WarRoom).
- **2 of 42 routes have 1–5 nodes** (McpInventory 3, HrTeams 2).
- **21 of 42 routes have more than 5 nodes** (the rest of the non-zero list above, 6 to 474 nodes).
- 19 + 2 + 21 = 42. **Verified.**

**Top five routes by node count**, named individually:

1. **Ideation** — 474 nodes (2 objects: button-name, color-contrast)
2. **Alerts** — 260 nodes (4 objects: button-name)
3. **Automation** — 48 nodes (4 objects: button-name)
4. **ConfigPage** — 43 nodes (7 objects, addendum)
5. **HrAgentAnalytics** and **Infrastructure** — tied at 16 nodes each (8 objects / 4 objects
   respectively) — named both since the ledger does not break the tie.

**Named caveat: Ideation's 474 nodes are theme-unstable, not a firm number.**
`123-CONTRAST-RESULT.md`'s per-route table flags Ideation explicitly: aubergine measured 474 nodes
(2 objects), cyan/emerald/readable measured **0** — "a live-data-dependent list ... a timing race.
Flagged, not adjudicated — remediation plans should re-measure before acting on the 474 figure
alone." Ideation alone is 474 of the 857 button-name nodes in the whole 188-cell matrix (55%).
Anyone acting on the button-name total must re-measure Ideation first; the true stable button-name
population may be substantially smaller than 857.

## 3. The remediation cost if the criterion widens

This is the part the ledger can only partly answer, and I am stating the boundary rather than
guessing past it.

**color-contrast (28 objects / 61 nodes total):** `123-CONTRAST-RESULT.md` Section 3 gives file:line
for exactly **7** of these 28 objects — the "measured-failing" table, all already inside plan
123-11's `files_modified` list. The remaining **21 color-contrast objects have no file:line mapping
in this ledger.** Section 3's 84-occurrence remediation list (7 measured-failing + 77 not-reached
adjudicated REMEDIATE) is a *class-census* population (every live `text-primary/[0-9]+` /
`text-muted-foreground/[0-9]+` / `text-(--status-*)/[0-9]+` occurrence in `src/`), not a 1:1
mapping to axe's 28 raw color-contrast violation objects — the two are related but not the same
count, and this document does not reconcile them.

**The other 7 rule categories (68 objects / 905 nodes total — button-name, aria-input-field-name,
label, select-name, aria-valid-attr-value, link-in-text-block, scrollable-region-focusable): this
ledger contains zero file:line entries for any of them.** Neither `123-CONTRAST-RESULT.md` nor its
addendum names a single source file for a button-name, label, select-name, aria-valid-attr-value,
link-in-text-block, or scrollable-region-focusable violation. These are not opacity-modifier
contrast defects — they are missing accessible names, missing form labels, invalid ARIA attribute
values, links embedded in text blocks, and non-focusable scrollable regions: categorically
different fixes (markup/ARIA changes, not token swaps) from what 123-10/123-11/123-12 do.

**So: the file count and occurrence count option (a) would add to plan 123-11 is NOT derivable
from this ledger.** What is derivable is the object/node count that would need a *new* triage pass
(axe capture → source file:line, the same methodology Section 3 applied to the `text-*/NN` class
family) before any file could even be named: **68 objects / 905 nodes**, plus the 21
not-yet-mapped color-contrast objects. **This does not fit inside plan 123-11 as scoped** — 123-11's
own `files_modified` list is 33 files, every one selected for a `text-primary/NN` /
`text-muted-foreground/NN` class edit; it is not built to touch button accessible names or form
labels, and doing so would require both a new triage pass this ledger doesn't contain and edits
outside its current file list.

## 4. What does not change either way

The 42 routes are **scanned regardless** — D-16 widened the scan unconditionally, and 123-08 (plus
this checkpoint's addendum) already ran it. A future regression on any of the 47 routes is now
*measurable*. The only question this checkpoint answers is whether those 168 cells' current
violations **gate this phase's close**, or become a backlog item sized for later.

## 5. `/chat`

Excluded from both options — out of scope for the whole v15.0 milestone (named explicitly in
123-08-PLAN.md). Reported separately so it is visible and clearly not counted in either option's
totals above. `123-CONTRAST-RESULT.md`'s original run could not reach it (one of the 12 dev-server
gap routes). The addendum closed that gap: **`/chat` now measures 0 objects / 0 nodes in all 4
themes** (`123-CONTRAST-RESULT-ADDENDUM.md` §"The recovered data"). It remains unremediated by this
phase regardless — but it is no longer unknown, and its own numbers are clean.

**Consequence for Section 3's "not-reached" bucket:** several rows in `123-CONTRAST-RESULT.md`
Section 3 were adjudicated REMEDIATE via the class-level isolation table specifically because their
justification read *"only reachable via unmeasured route(s) [Chat/InsightsChat] — dev-server 504
gap"* (`VitalsRail.tsx` ×5 rows, `ChatBubble.tsx` ×2 rows, plus one LEAVE-ALONE `ChatBubble.tsx:224`
row). `/chat` measuring 0 violations in all 4 themes does not retroactively make those rows wrong —
"an occurrence can fail in isolation and not be flagged if it never renders in the scanned state"
(addendum, verbatim) — but the distinction between "measured clean" and "adjudicated by class
inference because unreachable" is now knowable for those rows rather than assumed, and 123-11's
existing scope (which already includes `VitalsRail.tsx` and would include `ChatBubble.tsx` if it
were in-file-list — it is not currently in 123-11's `files_modified`) should be read with that in
mind.

## 6. Two options

### Option (a) — Widen the criterion to all 188 cells
- **Costs:** Plan 123-11's scope would need to grow by at minimum 68 objects / 905 nodes of
  non-contrast violations (button-name, aria-input-field-name, label, select-name,
  aria-valid-attr-value, link-in-text-block, scrollable-region-focusable) that this ledger has not
  triaged to file:line at all, plus 21 color-contrast objects with no file:line mapping yet either
  — a new triage pass, not a scope bump, and 123-11/123-12 are contrast-only sweeps by design.
  `ROADMAP.md`'s Phase 123 criterion 1 would need amending on disk. The phase closes later.
- **Buys:** A11Y-02 becomes a claim about the whole app, not 5 of 47 routes; no follow-up phase
  needed for these 42 routes.

### Option (b) — Hold at 20 cells, file the rest as a sized backlog
- **Costs:** The app ships with known sub-AA/accessibility issues on up to 42 routes after this
  phase closes; the backlog item must be filed now (this task), with real numbers, or it evaporates.
- **Buys:** The phase closes on its roadmapped scope; 123-11/123-12 stay contrast-only, matching
  what they were built to do; a follow-up phase gets real measured numbers instead of a guess; no
  surface get remediated twice if Phase 124/125 rewrite it first.

**What the numbers point to, stated plainly:** the widened population is dominated by a rule
category (button-name, 857 of 966 nodes, and unstable at that — see §2) that none of this phase's
remaining plans are built to fix, and this ledger contains no file:line data for 7 of the 8 rule
categories in the widened population. Widening the criterion here would bind A11Y-02 to work its
own remaining plans structurally cannot deliver. This is a fact about scope fit, not a
recommendation — the operator's decision is recorded below.

---

## Decision

**Date:** 2026-08-20
**Option chosen:** `hold-and-size`

**Operator's words** (Larry, at the mid-phase checkpoint, against the 188-cell numbers above):

> "Does A11Y-02's finish line move from the 20 criterion cells to all 188, or do the 42 extra
> routes ship as a sized backlog?" — **Keep the criterion at the 20 cells; size the rest as a
> backlog item.**
>
> Rationale accepted: the 20 criterion cells already measure 0 objects / 0 nodes of any rule id.
> Across the other 42 routes: 96 objects / 966 nodes, with button-name alone (36 objects / 857
> nodes) ≈ 89% of flagged nodes. Plans 123-11 and 123-12 are opacity-modifier CONTRAST sweeps
> (`text-primary/NN`, `text-muted-foreground/NN`, `text-(--token)/NN`) — they remediate
> `color-contrast` only. Widening A11Y-02 to 188 cells would define the phase's goal as something
> its own remaining plans structurally cannot deliver.

### Consequence applied

- `ROADMAP.md`'s Phase 123 success criterion 1 is **UNCHANGED** — it still names "every theme ×
  page cell A11Y-01 measured", i.e. the 20 criterion cells. No edit made to that line.
- Plan 123-11's scope is **UNCHANGED** — still the 33-file `text-primary/NN` /
  `text-muted-foreground/NN` sweep already in its `files_modified` list. Plan 123-12 likewise
  unchanged.
- The sized backlog item is filed at
  `.planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md`, carrying the per-rule and
  per-route figures from §2 above, the Ideation instability caveat, and the derivation commands.
