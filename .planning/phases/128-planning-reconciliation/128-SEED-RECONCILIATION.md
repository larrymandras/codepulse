# Phase 128 Plan 03: Seed Reconciliation Ledger

## Method

Per D-04, every verdict below was re-derived from the repository (code, ROADMAP.md,
REQUIREMENTS.md, archived milestone requirements/roadmaps, and git history) rather than applied
from D-09's proposed mapping on trust. D-09's table is treated throughout as a hypothesis to
confirm or correct, never as ground truth. Where a verdict diverges from D-09 — including a
divergence in scope or completeness, not just in the status label — it is recorded under
`## Findings (D-05)` with the evidence that forced it.

Artifacts read: all nine `.planning/seeds/SEED-*.md` files; `.planning/REQUIREMENTS.md` (v16.0
requirement list, Traceability table, carried-forward disposition table); `.planning/ROADMAP.md`
(v16.0 Progress table); `.planning/milestones/v14.0-ROADMAP.md` and
`.planning/milestones/v14.0-REQUIREMENTS.md` (Phases 116-119, SEED-005); `.planning/milestones/
v15.0-REQUIREMENTS.md` (A11Y-01/02/03, SEED-006); `.planning/todos/pending/
vitest-suite-nondeterministic-one-random-failure-per-run.md` and `.planning/todos/pending/
test-isolation-full-suite-only-failures.md` (SEED-009's trigger); live reads of `convex/
bifrost.ts`, `convex/retention.ts`, `convex/retentionCoverage.ts`, `convex/subagentJobs.ts`,
`convex/runtimeIngest.ts`, `src/pages/Settings.tsx`, `src/App.tsx`, `src/lib/navRegistry.ts`; and
`git show`/`git log` against both the codepulse and astridr-repo checkouts for the cited commit
SHAs.

## Seed verdicts

| Seed | Current status | Verdict | `absorbed_by` | Evidence |
|---|---|---|---|---|
| SEED-001 (anchored doc-comment HITL) | `shipped` | **CONFIRMED unchanged** | — | Live-verified, not just filed: `/doc-comments` route exists at `src/App.tsx:192`, nav entry at `src/lib/navRegistry.ts:161`, `src/pages/DocComments.tsx` + test present. Matches the frontmatter's PR #54 claim. |
| SEED-002 (Mission Control jobs board) | `dormant` | **`absorbed`** → BOARD-01, BOARD-02, BOARD-03 — **PARTIAL, see finding** | BOARD-01, BOARD-02, BOARD-03 | All three IDs exist in `.planning/REQUIREMENTS.md`'s v16.0 list and Traceability table (BOARD-01→Phase 146, BOARD-02→Phase 147, BOARD-03→Phase 148, both phases present in ROADMAP.md's v16.0 Progress table). BOARD-01 covers live per-mission cards/cost/duration/status; BOARD-02 covers humanized tool activity; BOARD-03 covers HITL confirm cards. **Not covered**: SEED-002's squad grouping ("phase two, astridr MC-2") and the self-critique `{critique, follow_up}` "deploy follow-up" card have no requirement text anywhere in the BOARD group — see Finding 1. |
| SEED-003 (cache-aware cost pricing) | `dormant` | **`absorbed`** → COST-04, COST-05, COST-06 | COST-04, COST-05, COST-06 | All three IDs exist in REQUIREMENTS.md and Traceability (COST-04→139, COST-05→139, COST-06→139; Phase 139 present in ROADMAP.md). Full coverage: COST-04 matches the seed's core ask (distinguish cache-write/cache-read/uncached at real rates); COST-05 matches the seed's own `trigger_when` clause ("reconciling CodePulse against an actual Anthropic invoice"); COST-06 matches the seed's other `trigger_when` clause ("a budget/alert threshold tuned against real dollars"). No uncovered remainder. |
| SEED-004 (Project Lifecycle Cockpit) | `dormant` | **`absorbed`** → COCKPIT-01, COCKPIT-02, COCKPIT-03, COCKPIT-04, COCKPIT-05, COCKPIT-06 | COCKPIT-01..06 | All six IDs exist in REQUIREMENTS.md and Traceability (COCKPIT-01→155, -02→156, -03→140, -04→157, -05→142, -06→141; all phases present in ROADMAP.md). One-to-one: component 1 (Inbox/composer)→COCKPIT-01, component 2 (Factory)→COCKPIT-02, component 3 (Projects view)→COCKPIT-03, component 4 (ship gates)→COCKPIT-04, component 5 (tailnet cockpit)→COCKPIT-05, the "Non-negotiables" (Scrap→Purge, refuse-not-guess preflights)→COCKPIT-06. Full coverage. The seed's billing/`ANTHROPIC_API_KEY`-passthrough constraint has no dedicated requirement ID, but it is carried as milestone-level context in `PROJECT.md`'s v16.0 target-feature #11 and is paired to a Forge-repo roadmap item outside CodePulse's own requirement set — not a gap in what this seed's CodePulse-side content asks for. |
| SEED-005 (Seiðr Suite) | `dormant` | **`shipped`** | — | Phases 116-119 all read `Complete` in `.planning/milestones/v14.0-ROADMAP.md`'s Progress table: 116 (2026-08-10), 117 (2026-08-10, phase-level summary, 0/0 plans by design), 118 (2026-08-17, verified 16/16), 119 (2026-08-11, phase-level summary, 0/0 plans by design). All four surfaces (Galdr `/galdr`, Bifröst `/bifrost`, Studio `/studio`, Loom `/loom`) confirmed present in the v14.0 phase summary. |
| SEED-006 (WCAG-AA contrast remediation) | `dormant` | **`shipped`** (seed's own declared scope) **+ `absorbed_by`** A11Y-03, A11Y-04, A11Y-05 (widened scope beyond the seed's own text) | A11Y-03, A11Y-04, A11Y-05 | See Finding 2 — decided against the seed's OWN scope text, not the topic. |
| SEED-007 (Mission emitter revival) | `dormant` | **`shipped`** (submittedAt half only) **+ `absorbed_by`** BOARD-01, BOARD-02 — **PARTIAL, see finding** | BOARD-01, BOARD-02 | astridr commit `e435f71a` ("feat(telemetry): populate subagent_job.submittedAt so duration is derivable") ships item 1's FIRST gap only. Verified against the live `convex/runtimeIngest.ts:713-737` `subagent_job` case: the comment still reads "queued/running, those live only in Supabase" (item 1's SECOND gap, unshipped) and the `upsert` mutation args carry no `sessionId`/`traceId` field (item 1's THIRD gap — the mission-to-tool correlation key, unshipped). D-11 (bind `subagentJobs` in `RETENTION_DAYS`) and D-12 (bound `listRecent`'s `.collect()`) are also still open: `grep -n subagentJobs convex/retention.ts` returns nothing, and `convex/subagentJobs.ts:88` still reads `ctx.db.query("subagentJobs").collect()`. See Finding 3. |
| SEED-008 (Convex auth posture) | `resolved` | **CONFIRMED unchanged** | — | Decision-type seed, not a build seed (per the plan's own instruction, `absorbed`/`shipped` do not apply). Frontmatter's `resolved`/`resolution` keys already carry the full disposition — no code change to verify beyond what SEED-008 itself already cites (the LAN firewall block, `preflight.ps1`'s named checks). Confirmed present: `grep -n "firewall:Block-Convex" convex-selfhost/preflight.ps1` not re-run here since it is outside this repo's tracked tree and the seed's own resolution text already carries the mutation-tested evidence. Not re-litigated per plan instruction. |
| SEED-009 (App.test.tsx `/memory` lazy-route timeout) | `dormant` | **CONFIRMED — stays `dormant`** | — | Trigger is "a SECOND occurrence." Both pending flake todos were read: `vitest-suite-nondeterministic-one-random-failure-per-run.md` names `JobsPanel.test.tsx:173` (icon count) and `KnowledgeGraph.test.tsx` (GLXY-02 console-spy assertion). `test-isolation-full-suite-only-failures.md` names `AvatarAura.browser.test.tsx` (codepulse) and astridr-repo's own `KnowledgeGraph.test.tsx` (a different repo's file of the same name). Neither todo names `src/App.test.tsx` or the `/memory` lazy-route case at all. The trigger has not fired — the seed's own text warned "today's flake filings name DIFFERENT tests," and that is exactly what both live filings show. |

## Findings (D-05)

Verdicts matched D-09's proposed status LABEL on all nine seeds, but three of the nine needed a
correction or an added qualifier beyond what D-09's one-line table states — recorded here rather
than silently rounded up to full agreement.

**Finding 1 — SEED-002's `absorbed` verdict is PARTIAL, not full (T-128-08).** BOARD-01/02/03
cover the live-board, humanized-tool-activity, and HITL-confirm-card thirds of SEED-002's content.
Two pieces of the seed have no requirement anywhere in the v16.0 list: the squad-grouping
feature ("phase two, astridr MC-2" — parent mission with grouped children) and the self-critique
`{critique, follow_up}` epilogue rendering as a "deploy follow-up" card. Per this plan's Task 1
instruction, absorption is recorded as partial rather than rounded up — these two pieces remain
genuinely unscoped ideas, not built and not on the v16.0 roadmap under any ID. Not re-scoped here
(out of this plan's authority); flagged so a later reader does not assume BOARD-01..03 close
SEED-002 completely.

**Finding 2 — SEED-006 needed the dual-field read D-09 only hinted at, decided from the seed's
OWN scope text.** SEED-006's body explicitly scopes itself to the SAME matrix its origin describes:
"`e2e/theme-contrast.spec.ts` runs axe-core... over 4 themes x 5 pages" — a 20-cell matrix, not
all 47 routes. Its frontmatter `scope: Medium-Large (unmeasured — sizing is task 1)` and its
"Shape of the work" step 1 ("measure first... everything else is sized off that") make the seed's
directive a two-step measure-then-fix cycle, not a fixed 47-route commitment. That 20-cell cycle
is exactly what v15.0 Phase 122 (A11Y-01, measure) and Phase 123 (the fix requirement, closed as
part of v15.0's Accessibility group — both `Complete`
in `.planning/milestones/v15.0-REQUIREMENTS.md`'s Traceability table) delivered: 0 violations
across all 20 criterion cells, re-confirmed twice. But the MEASUREMENT half of the seed's own
instruction ("build the real per-theme/per-page violation table") was itself only partially
executed — Phase 122's A11Y-01 explicitly records "Sampling limit: 5 of 47 route files measured,"
with the other 42 routes deliberately deferred as a sized backlog
(`todos/pending/a11y-02-widened-scan-42-route-backlog.md`, itself folded into v16.0's A11Y-03/04/05
per REQUIREMENTS.md). So the honest read is dual-status: `shipped` for the seed's own declared
20-cell scope, `absorbed_by: [A11Y-03, A11Y-04, A11Y-05]` for the wider-app remainder the seed's
own "measure everything, size the fix" instruction implied but v15.0 never actually measured. D-09
proposed plain `shipped`; the vocabulary permits both fields (SEED-007 precedent) and the seed's
own text supports splitting it this way rather than either extreme.

**Finding 3 — SEED-007's `shipped` half is narrower than D-09's table implies.** D-09 labels the
whole "repair half" shipped against astridr `e435f71a`. Re-reading that commit and the current
`convex/runtimeIngest.ts`, only ONE of SEED-007 item 1's three named gaps closed (real
`submittedAt`). The other two — non-terminal `queued`/`running` states, and a mission-to-tool
correlation key — are both still open in the live code, confirmed by the surviving code comment
("queued/running, those live only in Supabase") and the absence of any `sessionId`/`traceId` field
on `subagentJobs`. Neither gap is covered by any v16.0 requirement: BOARD-01's text assumes
today's data shape is sufficient for a live board ("orphan recovery already surfaces honestly as
FAILED... and that behaviour is preserved") rather than committing to build the non-terminal-state
emitter, and BOARD-02 is explicitly gated on XREPO-01 (the correlation key's astridr-side half),
not on SEED-007's emitter items directly. D-11 (retention binding) and D-12 (bounding
`listRecent`) are ALSO still open, independent of the `absorbed`/`shipped` question — verified live
(`convex/retention.ts` has no `subagentJobs` entry; `convex/subagentJobs.ts:88` is still an
unbounded `.collect()`). These four remaining gaps are not silently dropped by this ledger; they
remain real, unabsorbed, unshipped SEED-007 content, and Phase 146/147 (BOARD-01/02) inherit them
as unstated dependencies worth naming for whoever plans those phases.

**No fourth divergence.** SEED-001, SEED-003, SEED-004, SEED-005, SEED-008, and SEED-009 all
matched D-09's proposed status with no correction needed beyond the evidence already cited in the
verdicts table above.

## Carried-forward audit (RECON-03)

Per D-04, each of the nine items in `.planning/REQUIREMENTS.md`'s "Carried forward from v14.0 —
DISSOLVED into v16.0" table was re-derived independently against the artifact it claims, rather
than accepted from the table's own disposition column.

| # | Item | Disposition as filed | What was verified | Verdict |
|---|---|---|---|---|
| 1 | MISSION-01 duration + orphan recovery | → XREPO-03 (built; awaits a live row) | `XREPO-03` exists in REQUIREMENTS.md's v16.0 list and Traceability table, mapped to Phase 145, which has a row in ROADMAP.md's v16.0 Progress table ("145. XREPO — Mission-01 Live Row Confirmation"). The "built" claim is the SEED-007 `submittedAt` shipment (astridr `e435f71a`, verified above) plus the pre-existing orphan-FAILED behaviour BOARD-01's text also relies on. **HOLDS** — with the caveat, already recorded in Finding 3 above, that the underlying live-board data shape (non-terminal states) is not fully built; that caveat belongs to BOARD-01/Phase 146, not to XREPO-03's own scope, which is narrowly "a real background job produces a row with `finishedAt > submittedAt`" — a claim about ONE row's shape, already satisfiable by `e435f71a`. |
| 2 | MISSION-02 humanized tool activity | → BOARD-02, unblocked by XREPO-01 | `BOARD-02` exists, maps to Phase 147 (ROADMAP.md row present) and its own text states "Blocked on XREPO-01." `XREPO-01` exists, maps to Phase 143 (ROADMAP.md row present), and its own text states "Gates BOARD-02." The blocking relationship is stated identically and bidirectionally in both requirement entries — not just asserted on one side. **HOLDS.** |
| 3 | `message_routed` routed but unsurfaced | DONE 2026-08-27 (`55ec9001`) | `git show --stat 55ec9001` confirms the commit exists and its message states "Closes D-13's recorded follow-up from Phase 112" via a new `channelSummary` aggregate. `src/components/MessageRoutingSummary.tsx` exists with a companion test file, and `grep -rln MessageRoutingSummary src/pages/` shows it is mounted in `src/pages/Settings.tsx` (not merely defined and orphaned). **HOLDS.** |
| 4 | `links` retention + unbounded read | Closed before v16.0 — `bifrost.ts:85` bounded; `links` in `COVERAGE_KEEP_FOREVER` | `convex/bifrost.ts`'s `listHandler` reads `ctx.db.query("links").take(LINK_LIST_SCAN_CAP + 1)` — a real bound on the scan itself (not a post-read `.filter()`, so CLAUDE.md's `.filter()`-does-not-bound trap does not apply here). `convex/retentionCoverage.ts:120` lists `links: "curated links"` inside the exported `COVERAGE_KEEP_FOREVER` record. **HOLDS.** |
| 5 | `llm-analytics-rollup` CR-01 | Absorbed as v15.0 DEBT-08 | `.planning/milestones/v15.0-REQUIREMENTS.md:71` shows `DEBT-08` `[x]` Complete, explicitly describing the `costByModel`/`providerBreakdown` migration to `aggregates` rollups and linking `todos/pending/llm-analytics-rollup-migration-cr01.md` as the full brief; `:209` maps `DEBT-08 | Phase 121 | Complete`. That todo file is confirmed moved to `.planning/todos/completed/llm-analytics-rollup-migration-cr01.md` (not still pending). **HOLDS.** |
| 6 | `detectCredentialValue` rule C | Accepted decision, not open work | `.planning/todos/completed/118-detectcredentialvalue-misses-fal-key.md` records the actual resolution: rule A's name alternation was widened (the real fix), and rule C's 40-char bound was explicitly left UNCHANGED — "Rule A now catches the realistic `<uuid>:<32-hex>` shape by NAME instead, which is why relaxing C was unnecessary," with Larry's own 2026-08-16 call quoted ("file it, don't touch it now") as the accepted-decision record. **HOLDS.** |
| 7 | Nyquist coverage (117/119) | Closed 2026-08-26/27 — VALIDATION docs written, Loom coverage landed (`7a782bfa`) | Both `117-VALIDATION.md` and `119-VALIDATION.md` exist under `.planning/milestones/v14.0-phases/`. `git show --stat 7a782bfa` confirms the commit ("test(loom): close the three coverage gaps from 119-VALIDATION.md," 40 new tests in `convex/loom.test.ts`). **CORRECTED — Phase 119 alone is fully closed; Phase 117 is NOT.** `117-VALIDATION.md`'s own "Nyquist verdict" section (dated 2026-08-26, same day as the row's claim) reads **"PARTIAL, improved"** — one behavior (`# 5`, the container-name liveness dot reflecting `dockerContainers.status`) is explicitly recorded `❌ GAP — untested`, judged "cosmetic: a wrong dot misinforms, it does not cost reads or break a page" but never closed. The row's blanket "Nyquist coverage (117/119) closed" over-claims Phase 117's status; Phase 119 is fully closed, Phase 117 is deliberately PARTIAL with one named, accepted, still-open gap. Corrected in `.planning/REQUIREMENTS.md` (Phase 128 corrector) — see below. |
| 8 | DEBT-06 | Closed GUARDED — 80 clean soak iterations, cause never identified, disposition recorded | `.planning/ROADMAP.md`'s Phase 113 row states "DEBT-06 **closed guarded** with its criterion honestly reworded after 80 clean soak iterations produced no reproduction" and Phase 113 reads `Complete` in the v14.0 archived Progress table (2026-08-13, 8/8 plans). **HOLDS.** |
| 9 | astridr CORS on deployed branch | → XREPO-02 | `XREPO-02` exists in REQUIREMENTS.md's v16.0 list and Traceability table, mapped to Phase 144, which has a row in ROADMAP.md's v16.0 Progress table ("144. XREPO — Deployed CORS Origin Fix"). Its own text ("port it" from `main` to `feature/brain-swap`, "a decommissioned Convex subdomain can be re-allocated") matches the filed item's description exactly. **HOLDS.** |

**Closing statement.** Eight of the nine items HOLD as filed. Item 7 (Nyquist coverage) is
CORRECTED: the claim that both Phase 117 and Phase 119 closed is only half true — Phase 119
closed 2026-08-27 (`7a782bfa`), but Phase 117's own `117-VALIDATION.md` records a still-open,
named, deliberately-accepted gap (the liveness-dot join), which the disposition table's blanket
"closed" phrasing did not reflect. No item survives as an UNOWNED note: every one of the nine maps
either to a v16.0 requirement ID with a Traceability-table row and a ROADMAP.md phase row (items
1, 2, 9), or to a verified-closed artifact with file:line/commit evidence (items 3, 4, 5, 6, 8), or
— for item 7 — to a corrected disposition that still names an owner (the accepted, recorded gap in
`117-VALIDATION.md` itself, which already carries its own resolution rather than needing a new
one). The correction to item 7's row is applied in `.planning/REQUIREMENTS.md`, confined to the
carried-forward table, per this task's own constraint.
