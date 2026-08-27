# Phase 128 Plan 02 — Todo Re-Derivation Ledger

Thirteen pending todos re-checked against the code in this worktree on 2026-08-27, per D-04
(re-verify independently, do not inherit the scoping sweep's `resolves_phase` tags) and D-06
(the same evidence bar closes a todo or keeps it open).

## Method

Re-derived from code, not from the scoping sweep (commits `89def342`, `02e6557e`) or from this
plan's own planner-authored expectation table — both are treated as claims, not findings, per D-04.

**Correction to this plan's own task framing.** Task 1's title and `<read_first>` say "the eight
statically-settleable todos." Re-counting the plan's own table: `Yes` = 6 rows
(`ideationrow-text-white-raw-palette-class`, `inbox-page-undercounts-held-behind-200-cap`,
`phase-state-missing-array-never-encodes-ui-spec`, `polish-geometry-spec-measures-cold-page`,
`public-repo-exposes-user-path-and-operational-posture`, `sidebar-4px-horizontal-overflow-separator`),
`Partly` = 1 row (`a11y-02-widened-scan-42-route-backlog`) — **seven**, not eight. The plan's own
`<action>` bullet list for Task 1 also enumerates exactly these seven. Per CLAUDE.md's standing
rule to treat plan-authored text as a draft rather than a spec, this ledger produces the population
the table and read_first actually name (7 Task-1 rows) rather than forcing an eighth. Task 2 then
carries 6 rows (3 visual + 3 flake filings — see its own count note below), for **13 total**, which
matches Task 3's per-file scope (13 pending todo files in `files_modified`) and is what the acceptance
criteria ultimately gate on ("thirteen rows total").

Every citation below was opened in this worktree during this session; paths are relative to the
repo root.

## Verdicts

### 1. `ideationrow-text-white-raw-palette-class.md`

- **Claim as filed:** `SEVERITY_CLASSES` in `IdeationRow.tsx` uses raw `text-white` (not a token)
  at 3 sites: `critical`, `high`, `low`.
- **Read:** `src/components/IdeationRow.tsx:27-32`.
- **What the code does now:**
  ```
  critical: "bg-(--status-error) text-white",
  high:     "bg-(--status-error)/70 text-white",
  medium:   "bg-(--status-warn) text-(--primary-foreground)",
  low:      "bg-(--status-ok) text-white",
  ```
  Lines 28, 29, 31 are unchanged since filing — still raw `text-white`. Line 30 (`medium`) is the
  one already remedied (123-10, D-05) and is not part of this claim.
- **Verdict: STILL OPEN — evidence cited.**
- **resolves_phase:** 131 (confirmed — .planning/REQUIREMENTS.md:247, `FIX-04 | Phase 131 | Pending`).

### 2. `inbox-page-undercounts-held-behind-200-cap.md`

- **Claim as filed:** `/inbox`'s Held tab undercounts (page said 9) against the sidebar badge (46)
  because the page's tab counts derive from `listAll`'s `DEFAULT_LIST_ALL_LIMIT` (200, all
  itemTypes merged) while the badge derives from the unbounded, itemType-scoped
  `listHeldUnacked`.
- **Read, both caps:**
  - `convex/inbox.ts:175,184-190` — `DEFAULT_LIST_ALL_LIMIT = 200`; `listAllHandler` still takes
    exactly this many rows across all itemTypes, unchanged since filing.
  - `convex/inbox.ts:247,269-288` — `HELD_COUNT_SCAN_CAP = 2000`; `countHeldUnackedHandler` is a
    **new** query (not present when this todo was filed) that scans `by_itemType` for
    `itemType="held"`, takes `CAP+1`, and counts `ackedAt===undefined` in the window, returning
    `{ count, truncated }`.
  - `src/pages/Inbox.tsx:200` — `const heldTotal = useQuery(api.inbox.countHeldUnacked);`
  - `src/pages/Inbox.tsx:384-396` — `heldTotalPrecise = heldTotal != null && heldTotal.truncated
    === false`; `totals.held = heldTotalPrecise ? heldTotal.count : (unset, falls back to the
    generic floor marker)`.
- **What the code does now:** the Held tab's "N of M" denominator no longer comes from the
  200-row `listAll` window at all — it comes from `countHeldUnacked`, capped at 2000 (~43x
  headroom over the ~46 held-unacked rows measured live at filing time), the same
  `by_itemType`-scoped read the badge itself performs (`src/layouts/DashboardLayout.tsx:146`,
  `useQuery(api.inbox.countHeldUnacked)`). Both page and badge now read the same
  bounded-but-effectively-complete count. Confirmed by a dedicated regression test:
  `src/pages/__tests__/Inbox.test.tsx:330-338`, `"Held tab renders the precise 'N of M' when
  countHeldUnacked has resolved and is untruncated"`, fixture `{ count: 46, truncated: false }` —
  the exact figure this todo cites as the badge's correct value — plus a paired control at
  `:340-352` proving a *truncated* `countHeldUnacked` falls back to the honest floor marker
  rather than propagating a false precise count (closing the todo's own "Option 2, honest
  capped counts" suggestion).
- **Verdict: ALREADY FIXED — close.** This is Phase 126's SWEEP-01/SWEEP-03 work (D-03/D-04),
  landed after this todo was filed.
- **resolves_phase:** 130 (confirmed — .planning/REQUIREMENTS.md:246, `FIX-03 | Phase 130 | Pending`).

### 3. `phase-state-missing-array-never-encodes-ui-spec.md`

- **Claim as filed:** `phase-state.json`'s `missing: []` carries no signal about whether a
  UI-SPEC exists, for any phase.
- **Sampled (3 files, different UI-spec situations, per the plan's instruction to state the
  population):**
  1. `.planning/phases/128-planning-reconciliation/phase-state.json` — `isFrontend: true`, no
     `128-UI-SPEC.md` anywhere in the phase dir (confirmed: this phase builds one test file, no
     UI). History: `{"command":"plan-phase","ready":false,"missing":["UI-SPEC.md"]}` (both
     entries, `:9-13` and `:17-21`) — **non-empty and wrong**, since 128 needs no UI-SPEC.
  2. `.planning/milestones/v15.0-phases/124-shell-information-architecture/phase-state.json` —
     `isFrontend: true`, **has** `124-UI-SPEC.md` (`artifacts."UI-SPEC.md".files:["124-UI-SPEC.md"]`,
     `:30-36`). History: `{"command":"code-review","ready":true,"missing":[]}` (`:6-11`) — empty/green.
  3. `.planning/milestones/v15.0-phases/126-page-body-and-convex-read-defect-sweep/phase-state.json`
     — `isFrontend: true`, **no** UI-SPEC in `artifacts` (deliberate skip, matches ROADMAP's
     recorded `--skip-ui` policy for sweep phases). History includes
     `{"command":"execute-phase","ready":true,"missing":[]}` (`:12-17`) — also empty/green.
- **What the code does:** files 2 and 3 are byte-identical on the `missing` field
  (`[]`) despite one having a UI-SPEC and the other deliberately not — confirming the field
  cannot discriminate the two cases under `execute-phase`. File 1 supplies the second half the
  todo's own 2026-08-27 addendum already found: under `plan-phase`, `missing` populates but with
  a false positive on a phase that needs no spec. Both failure modes the todo's body already
  names (vacuously empty under `execute-phase`; confidently wrong under `plan-phase`) are live
  in the current corpus, not just historically true.
- **Verdict: STILL OPEN — evidence cited.**
- **resolves_phase:** 138 (confirmed — .planning/REQUIREMENTS.md:262, `GATE-01 | Phase 138 | Pending`).

### 4. `polish-geometry-spec-measures-cold-page.md`

- **Claim as filed:** the header three-zone min-content measurement in
  `e2e/polish-geometry.spec.ts` runs immediately after `page.goto()`, before `SystemChip` and
  `BrainHeaderBadge` resolve their Convex subscriptions, undercounting zone 3.
- **Read:** `e2e/polish-geometry.spec.ts:355-379` — before any measurement, the test now
  `await expect(systemChip).toBeVisible({ timeout: 15000 })` and the same for
  `brainHeaderBadge` (both located via `data-testid`), and **fails** (does not skip) if either
  does not render within 15s, with a comment explicitly citing "A measurement taken before these
  async children render undercounts zone 3 (the whole defect this wait exists to close)."
  `:404-425` then takes two readings `HEADER_ZONE_SETTLE_POLL_MS` (500ms) apart in a bounded loop
  and asserts they **agree** within `HEADER_ZONE_AGREEMENT_TOLERANCE_PX` (1px) before trusting
  either — closing exactly the gap this todo's own "Verification when fixed" section asked for
  ("assert the two measurements now agree... that agreement... IS the test").
- **What the code does:** the wait and the agreement-loop are both present and load-bearing; the
  inline comments at `:355-379` and `:381-409` name this todo's own mechanism and Phase 126-04
  (SWEEP-07) as the fix.
- **Verdict: ALREADY FIXED — close.**
- **resolves_phase:** 132 (confirmed — .planning/REQUIREMENTS.md:252, `FIX-09 | Phase 132 | Pending`).

### 5. `public-repo-exposes-user-path-and-operational-posture.md`

- **Claim as filed:** the repo is public and nobody has decided whether `.planning/` and
  `CLAUDE.md` belong in it.
- **Read:** `.planning/REQUIREMENTS.md:117-120` — `GATE-02`: "The public-repo posture is DECIDED
  and recorded... nobody has ever decided..." — the checkbox is `- [ ]` (unchecked/Pending), and
  the requirement's own text is a restatement of the open question, not a resolution.
  `.planning/REQUIREMENTS.md:263` — traceability row `GATE-02 | Phase 138 | Pending`.
- **Where else looked:** grepped `.planning/**/*.md` for "public repo" / "GATE-02" / "DECIDED"
  outside REQUIREMENTS.md — no other decision record found. `CLAUDE.md`'s deploy-command section
  is unchanged and still mandates the absolute `C:\Users\mandr\...` path this todo names as the
  reason a blanket sanitize would be undone by the next correctly-written plan; it records no
  public/private decision either.
- **What this establishes:** the claim is an absence (no decision exists) plus a presence (a
  requirement scheduling the decision for a future phase). REQUIREMENTS.md confirms both halves
  exactly as filed.
- **Verdict: STILL OPEN — evidence cited.**
- **resolves_phase:** 138 (confirmed — .planning/REQUIREMENTS.md:263, `GATE-02 | Phase 138 | Pending`).

### 6. `sidebar-4px-horizontal-overflow-separator.md`

- **Claim as filed:** the sidebar `<nav>` has `overflow-y-auto` with no horizontal constraint;
  a `<Separator className="my-2 mx-3" />` overhangs its containing box by ~4px
  (`235px` scrollWidth vs `231px` clientWidth, measured live at 1512x900), and because
  `overflow-y` is set, the browser computes `overflow-x` as `auto`, producing a visible
  horizontal scrollbar.
- **Read:** `src/layouts/DashboardLayout.tsx:544` — nav container still
  `className="flex-1 overflow-y-auto py-2 px-2"` (unchanged; this is the same line FIX-05's
  REQUIREMENTS.md text and this todo's own filed `:458,463` both eventually point at — the file
  has moved/grown since filing, exactly as the todo warned it might; line numbers drifted, the
  markup identity did not).
  `src/layouts/DashboardLayout.tsx:549-566` — the separator is now:
  ```tsx
  {i > 0 && (
    <div className="px-3 my-2">
      <Separator />
    </div>
  )}
  ```
  with an inline comment ("126-04 (SWEEP-06)") explicitly stating this "is what closed the
  231/235px (nav clientWidth/scrollWidth) 4px overhang" — the Separator itself no longer carries
  `mx-3`; the padding moved to a wrapper `<div>`, which is exactly this todo's suggested remedy
  option 1 ("Drop `mx-3` and inset the separator with padding on its wrapper instead").
- **Corroborating regression test:** `e2e/polish-geometry.spec.ts:528-557`, `"Sidebar nav —
  horizontal overflow (SWEEP-06)"`, asserts `navScrollWidth <= navClientWidth` and
  `widestDescendantRight <= navRight + 0.5` at the same 1512x900 viewport this todo's own
  measurement used.
- **Verdict: ALREADY FIXED — close.**
- **resolves_phase:** 131 (confirmed — .planning/REQUIREMENTS.md:248, `FIX-05 | Phase 131 | Pending`).

### 7. `a11y-02-widened-scan-42-route-backlog.md`

- **Claim as filed:** a 96-object/966-node violation backlog across 42 routes (7 of 8 rule
  categories un-triaged to source), sized by Phase 123's measurement, held out of that phase's
  criterion by operator decision.
- **Settled half — read:** `.planning/REQUIREMENTS.md:77-79` —
  `A11Y-03`: "The 42-route violation backlog is triaged to source. 96 objects / 966 nodes
  measured 2026-08-20, with 7 of 8 rule categories carrying no `file:line` triage at all. Sizing
  the un-triaged categories is task 1" — this is a verbatim match to the todo's own framing and
  figures. `.planning/REQUIREMENTS.md:253` — traceability row `A11Y-03 | Phase 133 | Pending`.
  The referenced measurement artifacts still exist on disk (moved by the v15.0 milestone close,
  not deleted): `.planning/milestones/v15.0-phases/123-accessibility-remediation/123-CONTRAST-RESULT.md`,
  `123-CONTRAST-RESULT-ADDENDUM.md`, `123-CRITERION-DECISION.md` — all present (`ls` confirmed).
- **Un-settleable half:** whether the 96/966 figure still holds TODAY is a live-DOM/axe-scan
  property, not a code property — re-measuring it requires running
  `e2e/theme-contrast.spec.ts` against a live `dev:noauth` server, which reading source cannot
  substitute for. Per D-07: `REQUIRES LIVE MEASUREMENT — deferred to Phase 133`. The todo's own
  "CRITICAL" section already flags one specific reason the figure may have moved (the Ideation
  route's theme-unstable 474-node reading, 55% of the button-name total) — re-affirmed here as
  the first thing Phase 133 must re-check, not settled by this session.
- **Verdict: SPLIT — the ownership half is CONFIRMED CURRENT (A11Y-03 now owns the triage
  exactly as filed); the population half REQUIRES LIVE MEASUREMENT — deferred to Phase 133. The
  todo file itself stays in `pending/` (D-06: the population-holds-today claim is unverified by
  reading, so it cannot be closed on that basis either).**
- **resolves_phase:** 133 (confirmed — .planning/REQUIREMENTS.md:253, `A11Y-03 | Phase 133 | Pending`).

---

### 8. `alert-rules-engine-rows-overlap.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 131

- **Claim as filed:** Alert Rules Engine rows overlap/bunch text on `/alerts`; not root-caused;
  the todo's own body explicitly says "do not guess" and specifies `getBoundingClientRect()`
  measurement as the first step.
- **Why code cannot settle it:** the defect is rendered row geometry (vertical pitch, text
  overlap) — a property of the browser's box layout at runtime, not of the class strings.
  Reading the same Tailwind utility classes the todo already cites
  (`src/components/AlertRulesEngine.tsx:75,108-109,205,218-219,388`, re-read this session and
  found byte-identical to the todo's transcription) cannot establish whether they currently
  produce overlapping boxes; only a live DOM measurement can, and the todo's own prior author
  already declined to guess at a mechanism for exactly this reason.
- **Context only (not evidence of presence or absence):** the cited lines still carry the same
  row-container, name/condition truncate classes, and list-container classes the todo
  transcribed; nothing in the file's `git log` since 2026-08-21 touches this component.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 131.**
- **resolves_phase:** 131 (confirmed — .planning/REQUIREMENTS.md:249, `FIX-06 | Phase 131 | Pending`).

### 9. `forge-analytics-visual-polish.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 131

- **Claim as filed:** two visual complaints — Forge's selected job row paints as a full-strength
  accent slab, and a single-series LLM-by-provider chart on `/analytics` renders as a flat
  saturated rectangle.
- **Why code cannot settle it:** both are rendered-appearance judgements ("reads as a slab",
  "occupies most of the panel") depending on token color values, chart-library layout, and
  screen composition together — not determinable from class strings or component code alone.
  The todo's own text already establishes (via a two-way diff against the pre-Phase-122 blob)
  that neither site's code changed since the operator's original complaint, which is a
  code-history fact, not a presence/absence verdict on the visual complaint itself.
- **Context only:** `src/pages/../components/forge/ForgeJobList.tsx` still contains
  `isSelected ? "bg-accent border-l-2 border-primary" : ""` at the line the todo cites, and
  `LlmProviderPanel.tsx`'s wrapper is still `bg-card/50`, per a re-read this session — cited for
  continuity only, not as proof the visual complaint is still live.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 131.**
- **resolves_phase:** 131 (confirmed — .planning/REQUIREMENTS.md:251, `FIX-08 | Phase 131 | Pending`).

### 10. `forge-job-list-column-clips-card-rows.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 131

- **Claim as filed:** on `/forge` at 1920px, job-card header rows clip mid-word inside the 280px
  master column (badge survives, workspace chip and engine name truncate against the container
  edge).
- **Why code cannot settle it:** the todo's own investigation already ruled out every
  code-level candidate (fixed-width class unchanged since pre-Phase-122, no responsive-override
  regression, no column-level overflow — `scrollWidth === clientWidth` on the column itself) and
  concluded the actual defect is that "the card header row has no wrapping or truncation
  strategy for a 280px container" — i.e. it is a rendered-content-overflow-at-a-given-viewport
  claim, which requires measuring real rendered card content (job names/workspace chips vary in
  length) at 1920px, not a static class read.
- **Context only:** `src/pages/ForgePage.tsx:175`'s master-column classes, re-read this session,
  are unchanged from the todo's transcription.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 131.**
- **resolves_phase:** 131 (confirmed — .planning/REQUIREMENTS.md:250, `FIX-07 | Phase 131 | Pending`).

### 11-13. The flake family — count and verdict

**Population check, per Task 2's instruction to count rather than assume.** Three flake-related
files are filed in this repo's `.planning/todos/pending/`: `kg-answer-sync-glxy02-test-flake.md`,
`test-isolation-full-suite-only-failures.md`, `vitest-suite-nondeterministic-one-random-failure-per-run.md`.
`.planning/REQUIREMENTS.md:99` states "Four separate filings that are ONE family" — the fourth
lives outside this repo (`test-isolation-full-suite-only-failures.md`'s own body names it:
`astridr-repo/.planning/phases/195-persona-dial-dashboard/deferred-items.md`), so only three of
the four are this repo's to re-derive.

**Within those three, they are not three independent defects.** `kg-answer-sync-glxy02-test-flake.md`
and `vitest-suite-nondeterministic-one-random-failure-per-run.md` both name the SAME concrete
failure — `KnowledgeGraph.test.tsx`'s `GLXY-02` assertion — observed from two different vantage
points (Phase 122's wave-6 gate; Phase 192's cross-repo post-merge gate). `test-isolation-full-suite-only-failures.md`
is a genuinely different codepulse-side failure (`AvatarAura.browser.test.tsx`, a different
vitest project entirely — `browser` vs `unit`), and its own body explicitly warns "do not merge"
it with the astridr-side analog it also references. **Judged: 3 filings in this repo, at most 2
distinct codepulse-side failure signatures (GLXY-02, named twice; AvatarAura.browser, named
once).** Each filing still gets its own ledger row and its own todo-file update, because Task 3's
checker operates per pending-todo-file, not per underlying defect.

#### 11. `kg-answer-sync-glxy02-test-flake.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 136

- **Why code cannot settle it:** the todo's own investigation already read the emitting code
  (`src/pages/KnowledgeGraph.tsx:824-825`) and confirmed the log line the test expects IS present
  in the branch — the defect is that the branch is not always REACHED before the assertion runs,
  an async-timing race. A source read cannot reproduce a ~17% intermittent timing failure;
  establishing whether it still fires needs N repeated live runs (the todo's own six-run table).
- **Context only:** `src/pages/KnowledgeGraph.tsx:824-825` still emits the asserted log line, per
  a re-read this session.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 136.**
- **resolves_phase:** 136 (confirmed — .planning/REQUIREMENTS.md:259, `FLAKE-01 | Phase 136 | Pending`).

#### 12. `test-isolation-full-suite-only-failures.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 136

- **Why code cannot settle it:** the todo's own text is explicit that a single re-run cannot
  discriminate "transient" from "order-dependent under full-suite load" — the whole point of the
  filing is that isolated reruns structurally cannot reproduce a full-suite-only condition.
  Establishing a reproduction rate (the todo's own prescribed first step) requires repeated live
  `npm test` runs, not a source read.
- **Context only:** `vitest.config.ts`'s two-project (`unit`/`browser`) layout, cited by the todo,
  is unchanged this session.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 136.**
- **resolves_phase:** 136 (confirmed — .planning/REQUIREMENTS.md:259, `FLAKE-01 | Phase 136 | Pending`).

#### 13. `vitest-suite-nondeterministic-one-random-failure-per-run.md` — REQUIRES LIVE MEASUREMENT — deferred to Phase 136

- **Why code cannot settle it:** "a different test fails each run" is a claim about run-to-run
  statistical behaviour, which by definition cannot be settled by reading any single point-in-time
  state of the source. The todo's own suggested first move is "run the suite N times."
- **Context only:** `src/test/setup.ts`'s `audioWorklet` guard, which the todo's own investigation
  already exonerated by reading (`proto.audioWorklet` is `undefined` under jsdom both before and
  after the cited change), is unchanged this session — re-confirms the exoneration, proves
  nothing about whether the flake itself still fires.
- **Verdict: REQUIRES LIVE MEASUREMENT — deferred to Phase 136.**
- **resolves_phase:** 136 (confirmed — .planning/REQUIREMENTS.md:259, `FLAKE-01 | Phase 136 | Pending`).

## Findings (D-05)

Three disagreements between this session's re-derivation and REQUIREMENTS.md's current prose —
none are disagreements with the scoping sweep's `resolves_phase` tags (all thirteen of those were
confirmed correct against the Traceability table; zero changed), but they are the same class of
finding D-05 asks to be recorded rather than quietly corrected, and they sharpen this plan's own
verdicts above:

1. **FIX-03** (`.planning/REQUIREMENTS.md:57-60`) reads `- [ ]` (Pending) and describes the
   inbox-undercount defect in the present tense ("Today the page counts off
   `DEFAULT_LIST_ALL_LIMIT`... the badge scans to `HELD_COUNT_SCAN_CAP`... they render
   contradictory figures"). Verdict 2 above shows this is no longer true — Phase 126 already
   fixed it. REQUIREMENTS.md was not updated when that landed.
2. **FIX-05** (`.planning/REQUIREMENTS.md:63-64`) reads `- [ ]` (Pending) and cites
   `src/layouts/DashboardLayout.tsx:544`'s `overflow-y-auto` with "no `overflow-x` constraint; a 4px overflow
   produces a visible bar" as a current defect. Verdict 6 above shows the Separator overhang that
   caused it was fixed in the same Phase 126 pass (SWEEP-06). The `overflow-y-auto` class itself
   is unchanged (it was never the defect — the overhanging child was), so the requirement's own
   diagnosis was already slightly imprecise at filing time, and is now stale regardless.
3. **FIX-09** (`.planning/REQUIREMENTS.md:71-73`) reads `- [ ]` (Pending) and states
   `e2e/polish-geometry.spec.ts` "currently measures a cold [page] and undercounts header zone
   3." Verdict 4 above shows Phase 126-04 (SWEEP-07) added the settle wait and agreement loop
   this requirement describes as missing.

**Not fixed here** — REQUIREMENTS.md is not in this plan's `files_modified`, and Task 3's own
scope is the todo files only. Recorded so Phase 130/131/132 (FIX-03/05/09's owning phases) do not
re-derive the same population from scratch, and so REQUIREMENTS.md's next re-derivation pass
knows exactly which three checkboxes are stale.

No disagreements were found with any filed `resolves_phase` value — all thirteen were re-checked
against `.planning/REQUIREMENTS.md`'s Traceability table (`:238-269`) and all thirteen matched the
value already recorded in the todo's frontmatter.

## Live-measurement gaps

| Todo | Owning phase | Measurement that would settle it |
|---|---|---|
| `alert-rules-engine-rows-overlap.md` | 131 | Live `getBoundingClientRect()` on a rule row, its name/condition text children, and the left toggle/badge column on `/alerts`, per the todo's own "First step when picked up" section — establish the actual row pitch and whether it is forced short, then compare against the ~66px a two-line `py-4` row needs. |
| `forge-analytics-visual-polish.md` | 131 | A live screenshot/rasterised capture of the Forge selected-row treatment and the single-series `/analytics` chart under at least one dark theme, judged by role (does it read as a fill vs a control state) rather than by class string. |
| `forge-job-list-column-clips-card-rows.md` | 131 | A live render of `/forge` at 1920px with real (non-trivial-length) job/workspace/engine names, measuring whether the card header row's children now wrap/truncate instead of clipping against the 280px column edge. |
| `kg-answer-sync-glxy02-test-flake.md` | 136 | Repeated isolated runs of `KnowledgeGraph.test.tsx`'s GLXY-02 test (the todo's own six-run methodology) to re-establish whether the ~17% failure rate still holds on current `HEAD`. |
| `test-isolation-full-suite-only-failures.md` | 136 | N repeated full `npm test` runs (both projects) capturing pass/fail per run, to establish an actual reproduction rate for `AvatarAura.browser.test.tsx`'s "Failed to fetch dynamically imported module" failure — a single rerun cannot discriminate transient from full-suite-only. |
| `vitest-suite-nondeterministic-one-random-failure-per-run.md` | 136 | N repeated full `npx vitest run` invocations capturing the failing test id per run, to re-establish the reported "~1 random failure per run" rate and whether it still spreads across the same files (`JobsPanel.test.tsx`, `KnowledgeGraph.test.tsx`). |
| `a11y-02-widened-scan-42-route-backlog.md` (population half only — ownership half is settled, see Verdict 7) | 133 | Re-run `A11Y_SCAN_ALL=1 A11Y_MEASURE_ONLY=1 ... playwright test e2e/theme-contrast.spec.ts` (command already given in the todo body) against a live `dev:noauth` server, with the Ideation route specifically re-measured across all 4 themes first, per the todo's own CRITICAL caveat about its theme-unstable 474-node reading. |
