# Phase 123: Accessibility Remediation - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

> **Formatting note for the decision-coverage gate.** Decisions below use the template's
> `- **D-NN:** Title.` form (colon inside a tight bold on the ID alone), NOT the
> `- **D-NN: Title.**` whole-title-bolded form used in `120-CONTEXT.md`/`121-CONTEXT.md`/
> `122-CONTEXT.md`. That style is the documented parser gap that made
> `check.decision-coverage-plan` return `passed: true, skipped: true, total: 0` against a
> CONTEXT.md holding 28 decisions in Phase 122. The style change is deliberate. It still does
> not make the gate trustworthy — verify `total` against the count below and run a control
> (`D-99` must report uncovered) before believing any green.

<domain>
## Phase Boundary

Every WCAG-AA violation Phase 122 measured is fixed, and the contrast suite is made structurally
incapable of reporting green against a page it never rendered.

**In scope:** the `color-contrast` and `aria-prohibited-attr` violations in the measured matrix;
the opacity-modifier defect class that causes them; the two known sub-AA pairings axe cannot
reach; the harness changes that close four separate vacuous-pass paths.

**Not in scope:** new surface, new tokens, palette redesign (122 froze it), route changes
(that is Phase 124), the Signal Horizon / ECG hero (Phase 125), `/chat` (out of scope for the
whole milestone).

**Requirements:** A11Y-02, A11Y-03.

</domain>

<premise_corrections>
## Premise corrections — read before planning

Three claims in the upstream artifacts are wrong or incomplete as written. Per the Stale Docs
rule they are corrected here and must be corrected **on disk during planning**, because the
planner and the decision-coverage gate both read those files.

1. **`ROADMAP.md:801`'s goal understates the scope.** It says *"Every contrast violation Phase
   122 measured is fixed."* But A11Y-02's actual criterion is that `e2e/theme-contrast.spec.ts`
   passes, and that spec asserts `expect(results.violations).toEqual([])` (`:107`). The matrix
   contains 4 `aria-prohibited-attr` objects that are **not** contrast violations, so a
   colour-only sweep cannot satisfy criterion 1. `122-FOLLOW-UPS.md` B3 predicted exactly this
   ("Phase 123 is framed as contrast remediation throughout and a colour-only sweep will miss
   it"). The goal line should read *"Every WCAG-AA violation Phase 122 measured."*

2. **`ROADMAP.md:807` and `REQUIREMENTS.md:68` contradict each other on the gate guard.**
   ROADMAP's criterion 2 requires that raising the Clerk gate *"makes the suite **fail** (not
   skip)."* REQUIREMENTS.md's A11Y-03 says the guard **is** the skip (`fee96b5d`) and this
   phase's job is to *"verify that guard still holds."* The shipped mechanism is `test.skip()`
   at `e2e/theme-contrast.spec.ts:66-73`, and a Playwright run of 20 skipped cells **exits 0** —
   so the skip is honest inside the report and green outside it. D-11 resolves this; both lines
   should be reconciled to D-11's wording during planning.

3. **A grep I ran during discussion is NOT a census and must not be inherited as one.**
   `grep -rn 'aria-label' src --include=*.tsx | grep -vE 'role=|<button|...'` returned **254**.
   That is a line-based filter over multi-line JSX — the element tag usually sits on a different
   line from the attribute, so it counts attributes, not defects. Do not plan against 254. The
   only trustworthy figure in that family is `aria-busy`, which appears in exactly **2 files**
   (`src/components/forge/ForgeJobList.tsx` x2, `src/components/skills/SkillReviewDrawer.tsx` x1).

</premise_corrections>

<measured_input>
## What is actually broken (re-derived from `a11y-after/*.json`, 2026-08-20)

24 violation objects / 209 nodes across 20 cells. Aggregated from the 20 committed JSON files
this session, not transcribed from `122-CONTRAST-BASELINE.md`'s prose:

| fg on bg | ratio | nodes | source |
|---|---|---|---|
| `#817264` on `#181222` | 3.93 | 77 | aubergine nav labels — `text-muted-foreground/80`, `src/layouts/DashboardLayout.tsx:148` |
| `#717a8a` on `#171b22` | 3.98 | 77 | readable, same element |
| `#0b7157` on `#020617` | 3.37 | 15 | emerald nav group headers — `text-primary/60`, `DashboardLayout.tsx:91` |
| `#7d56a5` on `#181222` | 3.26 | 10 | aubergine, same element |
| `#077084` on `#07080b` | 3.49 | 10 | cyan, same element |
| `#7a54a1` / `#067083` | 3.29 / 3.52 | 10 | aubergine / cyan, same element, second surface |
| smaller pairs | 1.90–2.69 | 5 | `.lg\:flex > .gap-1\.5` (the SYS:/LAT: header badge) and near-black variants |
| `#877867` on `#120d18` | **4.48** | 1 | `.text-(--muted-foreground)` — **no opacity modifier at all**, 0.02 short |
| `aria-prohibited-attr` | — | 4 | `src/components/forge/ForgeJobList.tsx:174` — `<div aria-busy aria-label>` |

**The single root cause is an opacity modifier applied to an already-muted token.** Census
re-derived this session with `grep -rhoE` (occurrences, not matching lines):
`text-primary/NN` = **86**, `text-muted-foreground/NN` = **88**, plus `text-(--status-warn)/80`
and `text-(--status-error)/60` = **2**. Total **176** occurrences; **75 files** contain at least
one `text-*/NN`. (D-01 refers to this as "~174" from the two headline families; the planner must
re-derive the exact population at plan time and reconcile, never adopt either figure — this is
the same unit discipline `122-CONTEXT.md` needed four times.)

**Why the modifier is the whole story:** `122-FOLLOW-UPS.md` A1 measured full-opacity
`--muted-foreground` against `--card` at **6.93 (cyan) / 5.20 (readable) / 5.04 (aubergine)** —
all above AA. The `/80` alone is what drops the nav labels to 3.93–3.98. No token value needs to
move.

</measured_input>

<decisions>
## Implementation Decisions

**18 decisions, D-01 through D-18.**

### Fix altitude — the opacity-modifier sweep

- **D-01:** Ratio-gated class sweep, not an instance fix. Enumerate every
  `text-primary/NN` / `text-muted-foreground/NN` / `text-(--token)/NN` occurrence across `src/`
  (re-derive the population at plan time; discussion measured 176 occurrences in 75 files),
  measure each pairing against its actual composited background, and fix only those below
  threshold. Fixing only the ~5 elements axe flags was explicitly rejected: it is the
  instance-not-class shape, and ~170 siblings of the identical defect live on the 42 unmeasured
  routes. Blanket-banning the idiom was also rejected — some `/NN` uses are deliberate
  de-emphasis on large text that already clears AA-large.

- **D-02:** Hybrid measurement — axe-reachable first, isolation harness second. Pass 1: widen the
  axe run past the 5 routes (see D-16) so every site that renders on a reachable page is measured
  with real pixels and real ancestors. Pass 2: for sites axe cannot reach (state-gated,
  error-only, behind a live bridge), render the component in isolation via Playwright against each
  theme's real surface tokens and rasterise with canvas `getImageData`. **Every ledger row is
  labelled by which pass produced it** — "measured" must never silently mean "calculated".
  Computing ratios analytically from token hex + alpha was rejected: it has to guess the ancestor,
  and it is exactly what would have missed the 4.48:1 node, where an intermediate semi-transparent
  layer sits between the text and the deepest opaque ancestor (`122-21-REMATRIX.md` Root Cause 2).

- **D-03:** The isolation harness applies WCAG's own thresholds, mirroring axe: **4.5:1 normal,
  3:1 for large text** (>=24px, or >=18.66px bold), read from each element's computed font-size
  and weight. Both passes then produce directly comparable numbers in one ledger. A flat 4.5:1
  was rejected because it flags genuinely-compliant large display text and makes the two passes
  disagree about the same element. Note both currently-flagged shell elements owe 4.5:1 either
  way — `DashboardLayout.tsx:148` is `text-sm` (14px), `:91` is `text-xs` bold (12px).

- **D-04:** Default remedy is **deleting the `/NN`**. Where removing it makes two adjacent
  elements read as the same level, move to the next quieter **token**, never reintroduce alpha.
  Stepping each site up to its own lowest-passing alpha was rejected: the passing value is a
  function of that site's composited background, producing a scatter of undefendable magic
  numbers that any parent-surface change silently pushes back under threshold, with no guard
  behind them.

### Scope — what else rides in this phase

- **D-05:** Fold in B1's warn-fill pairing. `bg-(--status-warn) text-(--foreground)` rasterises
  to **~1.4–1.8:1** — the worst ratio in the codebase — at `src/components/IdeationRow.tsx:30`,
  `src/components/InboxCard.tsx:98`, `src/components/ScanResultsPanel.tsx:41`, inherited by
  `src/components/TaskDetail.tsx:29`. **Also correct the two header comments at
  `InboxCard.tsx:12` and `ScanResultsPanel.tsx:12` that DOCUMENT the defective pairing** and will
  re-seed it into new code otherwise. `src/components/StatusBadge.tsx:55` already ships the
  corrected form (`bg-(--status-warn) text-(--primary-foreground)`) as a working control to copy.
  axe never sees these sites because they do not render on the 5 measured routes.

- **D-06:** ARIA scope is **measurement-defined with a named floor**. Whatever
  `aria-prohibited-attr` — or any other non-contrast `wcag2a`/`wcag2aa` rule — fires on across the
  scanned route set gets fixed, same discipline as the contrast work, with no hand-maintained
  census to go stale. **Floor, fixed regardless of whether they render during a scan:** the 2
  `aria-busy` sites in `src/components/forge/ForgeJobList.tsx` (including `:174`, the flagged one)
  and the 1 in `src/components/skills/SkillReviewDrawer.tsx`. A full JSX-AST census of
  role-restricted ARIA attributes was considered and rejected as a second harness in a phase that
  already builds one.

- **D-07:** Fold `.planning/todos/pending/tailwind-scans-beyond-src.md`. `src/index.css` only
  excludes `../.planning`, so Tailwind compiles `bg-gray-950/50` into the **production
  stylesheet** from a string literal in `scripts/migrate_tokens.py`. This phase makes a
  completeness claim about a sweep, and "clean in `src/`" provably does not equal "clean in what
  ships" — the claim has to be either true or explicitly bounded.

- **D-08:** Fold `.planning/todos/pending/shadow-rgba-outside-sweep-buckets.md`. A bare
  `rgba(...)` inside `shadow-[...]` is not `bg-`/`text-`/`border-` prefixed, so no sweep bucket
  and no ratchet bucket can see it (e.g. `SwarmTaskNode.tsx`'s deliberate violet state glow).
  Shadows do not produce WCAG **text**-contrast violations, so this is honesty-about-the-ratchet
  rather than remediation — the deliverable is a stated boundary, not necessarily a code change.

- **D-09:** Fold `.planning/todos/pending/forgepage-pageheader-adoption.md` (TOKEN-05's known
  partial). `src/pages/ForgePage.tsx:150-159` hand-rolls its header; `/forge` is one of the 5
  measured routes and carries 8 of the 24 violation objects, so the file is open anyway.
  **Rider, non-negotiable:** `122-11` declined this substitution specifically because `PageHeader`
  bakes in `mb-4` that the hand-rolled header lacks — converting doubles the vertical gap above
  the master-detail body — *and that plan had no visual-check step to catch it*. Folding it here
  therefore obliges D-18's checkpoint to inspect `/forge` header spacing by name.

- **D-10:** All four themes are held to the **same AA bar**. `readable` carries 78 of 209
  violation nodes and is branded "Readable Dark (WCAG-AA)" in `CLAUDE.md`, but its stated
  differentiator is effects suppression (glow/CRT/matrix off), not a higher contrast standard.
  Holding everything to AA makes the label true without inventing a second threshold, a second
  ledger, or a second pass/fail. AAA (7:1) for `readable` was rejected: on a dark surface it
  forces near-white body text and collapses the muted/foreground distinction, i.e. redesigning a
  theme inside a remediation phase, against 122's palette freeze.

### A11Y-03 — closing every vacuous-pass path

- **D-11:** Keep `test.skip()`, **fail the run on any skip**. The annotation at
  `e2e/theme-contrast.spec.ts:66-73` is what distinguishes "never rendered" from "rendered clean",
  and that distinction stays in the report. Add a file-level skipped-cell counter plus an
  `afterAll` that throws if it is non-zero: the cell still reads `skipped`, the **suite** fails,
  exit code is non-zero. This satisfies `ROADMAP.md:807`'s "fail (not skip)" literally and
  `REQUIREMENTS.md:68`'s "verify the guard still holds" simultaneously, losing no information.
  Converting the skip into a bare assertion was rejected: it makes a gated run indistinguishable
  from a genuinely violating one, and hands 20 unexplained red tests to anyone who runs the suite
  against the ordinary gated `:5173`.

- **D-12:** Prove the guard two ways. **Durable half:** an in-suite self-test that injects the
  sign-in screen deterministically (stub the auth state / render the gated shell), asserts the
  guard fires, and asserts the run goes non-zero — no Clerk key, no gated server, no operator, and
  it re-runs on every future suite execution so a broken guard fails immediately. **Evidence
  half:** one operator-run 20-cell matrix against the real gated `:5173`, confirming skip-then-
  fail. Both are required: the self-test proves the guard survives, the live run proves the
  self-test models reality. **This split exists because an agent structurally cannot run the live
  probe** — `122-CONTRAST-BASELINE.md` records that 122's attempt "was blocked by this session's
  own permission classifier before it could execute; not run this time, stated plainly rather than
  claimed", the same class of block as Phase 121's `npx convex deploy`.

- **D-13:** Add a **per-page content marker** — a 5-entry route-to-marker table so each cell waits
  on something only *that* page renders before axe runs, and **fails** (not skips) if it never
  appears. This closes a second vacuous-pass hole one level below the one `fee96b5d` closed: the
  current marker is `getByRole("navigation", { name: "Main navigation" })`, which is the app
  **shell** and renders on all five pages whether or not the page's **content** does. Phase 121
  established this is not hypothetical — three real query timeouts on `/analytics` are routinely
  caught by `SectionErrorBoundary`, so that route can legitimately render as shell-plus-error-
  boundaries: few elements, few violations, green. The spec's comment (`:54-59`) avoided a
  per-route table on maintenance grounds; 5 rows against the 5 hardcoded `PAGES` entries ten lines
  above is not a maintenance burden.

- **D-14:** Keep `A11Y_MEASURE_ONLY`, but make a run using it **non-green**. All 20 cells still
  run to completion and all captures still get written — that is the switch's whole purpose, and
  123's own before/after ledger needs it — but the run ends non-zero with an explicit "assertions
  suppressed: this is a measurement, not a verification" message. Today `:105` is
  `if (process.env.A11Y_MEASURE_ONLY === "1") return;`, so 20 cells **pass while asserting
  nothing**, and in a log that is indistinguishable from a genuine pass. Deleting the switch was
  rejected — the full-matrix capture would then have to be rebuilt under another name mid-phase.

### Harness trust

- **D-15:** Fix the SYS:/LAT: badge like any other violator, and **retire the ex-badge column**.
  `src/layouts/DashboardLayout.tsx:607-620` is a genuine `color-contrast` violator whose node
  count swings **5 to 26 across four captures with zero code change**, because it is gated on live
  Convex data arriving before the scan. `122-CONTRAST-BASELINE.md` built the ex-badge column
  because 122 was comparing *deltas* and a 21-node swing swamps a 2-node change. **123's target is
  zero**, so node-count reproducibility stops mattering — a cell passes or it does not — and once
  the badge clears AA it contributes zero nodes whether it renders or not, dissolving the confound
  rather than excluding it. Seeding/mocking backend state for determinism was rejected: it trades
  a real render for a synthetic one in the exact suite whose credibility rests on measuring what
  ships. **Residual rule:** any *other* intermittently-failing cell is treated as a real finding,
  never written off as noise.

- **D-16:** Widen the **scan** to all 47 route files x 4 themes; hold the **criterion** at the 20
  cells A11Y-01 measured; **checkpoint mid-phase to decide whether to widen the criterion too.**
  The scan is cheap — the 20-cell matrix runs in 12.2s (Playwright's own reported time), so ~188
  cells is minutes — and it *is* pass 1 of D-02's hybrid. Holding A11Y-02's finish line at 20
  cells keeps the phase bounded and checkable. At the checkpoint: if the extra 42 routes add few
  violations, fold them in and widen the criterion; if they add many, they ship as a **sized**
  backlog with real numbers rather than a guess. Committing the criterion to all 47 up front was
  rejected — it binds the phase to fixing an unknown quantity on routes nobody has ever scanned,
  discovered after planning closes. Route denominator is **47** (42 top-level non-test +
  5 under `src/pages/hr/`); **do not propagate 62**, which is the top-level glob *including* tests.

- **D-17:** **The widened axe suite is the ratchet.** With the matrix scanning all 47 routes, any
  newly-introduced sub-AA site on a rendered page fails the suite on the next run — a
  *measurement* ratchet, not a *pattern* ratchet, so it cannot false-positive on a legitimate
  `/NN` that passes (which is precisely why D-01 rejected banning the idiom) and it catches
  sub-AA pairings written with no opacity modifier at all, like the 4.48:1 node, which a grep
  bucket sails straight past. **No `text-*/NN` bucket is added to
  `src/tokenSweep.ratchet.test.ts`.** Stated gap: sites that never render during a scan are
  guarded only by D-02's ledger.

- **D-18:** **One blocking operator visual checkpoint before close.** After the sweep and the
  ForgePage change land, the operator runs `npm run dev`, cycles all four themes, and confirms two
  named things: (a) dropping the opacity modifiers has not flattened the nav's visual hierarchy,
  and (b) `/forge`'s header spacing did not regress from `PageHeader`'s baked-in `mb-4` (D-09's
  rider). Same shape as 122's checkpoint, which caught a real defect — "one flat tone for the most
  part" — that four automated gates missed. A non-blocking screenshot pack was rejected: nothing
  blocks on the operator looking, which is how a phase closes green on something nobody looked at.

### Claude's Discretion

Not raised as their own gray areas; the planner decides, guided by the decisions above:

- How the sweep splits into plans and waves, and whether the 47-route scan runs **before** the
  shell fixes (giving a complete population up front, at the cost of a second scan afterward) or
  **after** (one scan, but the population is discovered late).
- Whether `await page.waitForLoadState("networkidle")` (`e2e/theme-contrast.spec.ts:38`) is a
  sound pre-scan wait for a page fed by a live Convex **WebSocket** subscription — WS traffic does
  not gate `networkidle`, so it does not guarantee data arrival. Largely mooted by D-13's content
  markers and D-15's badge fix, but worth one look while the file is open.
- Where the new ledger and after-capture live. Recommended shape, consistent with the
  2026-08-18 anchor-on-explicit-artifacts rule: a **new** `123-CONTRAST-RESULT.md` plus a new
  capture directory, anchored against `122-.../a11y-before/` (the frozen control, **never**
  regenerate) and `122-.../a11y-after/` (the immediate pre-123 state). Do not amend 122's
  artifacts in place.

### Folded Todos

| Todo | Decision | Why it fits |
|---|---|---|
| `.planning/todos/pending/warn-fill-foreground-pairing-sub-aa.md` | D-05 | Worst contrast ratio in the app (~1.4–1.8:1); both sides already tokens, so it is contrast work; a working control already exists at `StatusBadge.tsx:55` |
| `.planning/todos/pending/forge-loading-div-aria-prohibited-attr.md` | D-06 | Inside the measured matrix; blocks A11Y-02's criterion 1 by force, not by choice |
| `.planning/todos/pending/tailwind-scans-beyond-src.md` | D-07 | This phase claims sweep completeness; "clean in src/" != "clean in what ships" |
| `.planning/todos/pending/shadow-rgba-outside-sweep-buckets.md` | D-08 | A stated boundary on what the ratchet can see, in the phase that defines the ratchet |
| `.planning/todos/pending/forgepage-pageheader-adoption.md` | D-09 | `/forge` is a measured route carrying 8 of 24 objects; the file is open regardless. Carries the D-18 visual-check rider |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 122's measurement — this phase's entire input
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — the
  before/after/delta matrix, per-rule breakdown, named-pair ratios, the enumerated 5-of-47
  sampling limit, and the "READ THIS BEFORE QUOTING ANY NODE-LEVEL FIGURE" determinism caveat.
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before/*.json` — 20 files, the
  **frozen control**. Never regenerate.
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/*.json` — 20 files, the
  immediate pre-123 state (24 objects / 209 nodes).
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-FOLLOW-UPS.md` §B, §C, §E, §F —
  what 122 deliberately did not fix (B1 warn-fill, B3 Forge aria), the sweep's stated scope limits
  (C1 shadows, C2 Tailwind's scan root), verification debt, and the probe hazards that each
  produced a real false result this milestone.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-21-REMATRIX.md` — Root Cause 2,
  the semi-transparent intermediate layer that produces the 4.48:1 near-miss D-02 is designed
  around.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTEXT.md` — the 28 locked
  decisions the token layer was built on. D-04 (amber excluded from the matrix), D-24 (the 47
  route denominator and the 62 trap), D-27 (rasterise; never scrape computed colour strings).
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-BADGE-LAW.md` §8 — the measured
  badge pairings, including the control table for the old Forge `failed` pairing.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-RATCHET-EXEMPTIONS.md` — the
  "record, not a blessing" discipline governing `src/tokenSweep.ratchet.test.ts`, and the account
  of the 8 real violations found while building it. Relevant to D-17's decision **not** to add a
  bucket.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — A11Y-02 (`:67`), A11Y-03 (`:68`), A11Y-01's closure note (`:66`)
  carrying the sampling limit and delta direction. TOKEN-05's partial (`:47`) explains D-09.
- `.planning/ROADMAP.md` §"Phase 123: Accessibility Remediation" (`:799-810`) — goal, dependency,
  and the two success criteria. **Both criterion lines need the corrections in
  `<premise_corrections>` above.**

### The code under change
- `e2e/theme-contrast.spec.ts` — the whole file. `:20-38` matrix + navigation, `:40-73` the
  `fee96b5d` gate guard (D-11, D-13), `:75-101` capture, `:99-107` the `A11Y_MEASURE_ONLY` bypass and the
  assertion it guards (D-14).
- `src/layouts/DashboardLayout.tsx` — `:91` nav group headers (`text-primary/60`), `:148` nav
  labels (`text-muted-foreground/80`), `:607-620` the SYS:/LAT: badge (D-15).
- `src/components/StatusBadge.tsx:53-56` — the corrected warn pairing, D-05's control.
- `src/components/forge/ForgeJobList.tsx:170-178` — the `aria-prohibited-attr` div (D-06).
- `src/pages/ForgePage.tsx:150-159` — the hand-rolled header (D-09).
- `src/tokenSweep.ratchet.test.ts` — the existing ratchet D-17 declines to extend.

### Project rules that bind this phase
- `CLAUDE.md` §Styling — token-driven, never hardcode hex; the four selectable themes and
  `readable`'s stated guarantee (D-10).
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — relevant only if any scan touches the
  live backend.
- Memory `[[tailwind-v4-oklch-defeats-css-color-scraping]]` — why D-02 rasterises and never parses
  a `getComputedStyle` colour string.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `e2e/theme-contrast.spec.ts` — the 20-cell matrix, capture plumbing, and the gate guard all
  already exist and work. D-11/D-13/D-14/D-16 are edits to this file, not a new harness.
- `e2e/theme-rendered-result.spec.ts` (122-18, D-27) — already contains a working canvas
  `getImageData` rasteriser and a `channelDistance` helper with per-call-site threshold
  rationale. D-02's isolation harness should extend this rather than build a second rasteriser.
- `src/components/StatusBadge.tsx:53-56` — the already-measured, already-correct warn/error fill
  pairings. D-05 copies from here.
- `src/tokenSweep.ratchet.test.ts` + `122-RATCHET-EXEMPTIONS.md` — a working corpus-derived ratchet
  with an established exemption discipline. D-17 declines to add to it and says why.
- `SectionErrorBoundary` — already wraps `/analytics` panels; it is *why* D-13 is needed, and the
  marker table has to tolerate a boundary rendering in place of a panel.

### Established Patterns
- **Tokens only, no hex.** Every fix lands as a token or a token swap (D-04), never a literal.
- **Controls are mandatory.** 122 paired every measurement with a must-differ control; 123
  inherits that (D-12's self-test, D-15's residual rule, D-16's 47-vs-62 denominator control).
- **Unit discipline.** `grep -c` = matching lines per file; `grep -o | wc -l` = occurrences;
  `grep -l | wc -l` = files. Four separate counts in 122 failed re-derivation. Every population
  figure in this phase must name its unit.
- **Fixed-string matching for anything with backslashes.** The axe target selectors are full of
  them (`.lg\:flex > .gap-1\.5`); use `-F`/`--fixed-strings`, never hand-escape.

### Integration Points
- `src/layouts/DashboardLayout.tsx` is the highest-leverage file: `:91` and `:148` between them
  account for **184 of 205** contrast nodes (`:148` = 154, `:91` = 30, re-derived per-node from
  `a11y-after/*.json` by selector group; the remaining 21 are the SYS:/LAT: badge (15),
  `.text-primary/70.text-base` (3) and `.text-(--muted-foreground)` (3)), and because they are shared app-shell chrome, one fix
  clears them in all four themes and on all five pages at once. This is why D-10's "readable ships
  first" sequencing option was rejected as probably non-separable.
- The `PAGES` array (`e2e/theme-contrast.spec.ts:12-18`) is the single place D-13's marker table
  and D-16's widened route list both attach.

</code_context>

<specifics>
## Specific Ideas

- Retire the ex-badge column rather than carrying it forward — an exclusion nobody needs is one
  somebody later mistakes for a known-failing carve-out (D-15).
- The `readable` theme's name is treated as a promise the whole app has to make true, not as a
  licence to hold one theme to a different standard (D-10).
- Two header comments are treated as **code** for remediation purposes: a comment documenting a
  defective pairing re-seeds it (D-05).
- Ledger rows must be labelled by *how* they were measured. "Measured" and "calculated" are not
  interchangeable words in this phase's output (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Widening A11Y-02's criterion to all 47 routes** — deliberately held at the D-16 checkpoint
  rather than committed up front. If the extra 42 routes turn out to hold many violations, they
  become a sized backlog item for a follow-up phase, with real numbers.
- **A JSX-AST census of role-restricted ARIA attributes** — a genuinely complete answer to D-06,
  declined as a second harness in a phase that already builds one. Worth revisiting if the
  measurement-defined sweep keeps surfacing new instances.
- **A `text-*/NN` grep bucket in the ratchet** — declined at D-17 in favour of the measurement
  ratchet. Revisit only if unrenderable sites prove to be a real regression source.
- **AAA (7:1) for `readable`** — rejected at D-10 as a theme redesign inside a remediation phase.
  Belongs in the theme-redesign work the operator flagged at 122's close ("I am going to redesign
  some of the themes anyway").

### Reviewed Todos (not folded)

`gsd-sdk query todo.match-phase 123` returned **all 9** pending todos at a uniform score of 0.6,
matching on the keywords "phase", "122", "contrast" — that is noise, not signal, so these were
triaged by reading rather than by score.

| Todo | Why not folded |
|---|---|
| `.planning/todos/pending/forge-job-list-column-clips-card-rows.md` | Layout clipping inside a 280px master column (`122-FOLLOW-UPS.md` D1). Visual defect, not an accessibility violation; traced to pre-phase markup |
| `.planning/todos/pending/forge-analytics-visual-polish.md` | Saturated selected-row fill and single-series chart slab (D2/D3). Byte-identical to the pre-phase tree; aesthetic, not WCAG |
| `.planning/todos/pending/kg-answer-sync-glxy02-test-flake.md` | `KnowledgeGraph.test.tsx` fails ~17% of runs; owned by the concurrent phase-190 workstream, async-timing shaped |
| `.planning/todos/pending/unbounded-analytics-scans-timeout.md` | Four unbounded Convex queries time out server-side. Performance, not accessibility — and 122 deliberately used it as the live proving ground for the tile's unavailable/error states |

</deferred>

---

*Phase: 123-Accessibility Remediation*
*Context gathered: 2026-08-20*
