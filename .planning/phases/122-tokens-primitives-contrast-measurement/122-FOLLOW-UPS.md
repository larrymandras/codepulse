# Phase 122 — Follow-ups for the next phase

Written 2026-08-19, at the 122-19 operator checkpoint. This is the index of everything Phase 122
found and deliberately did **not** fix, plus the two items it must finish itself.

Ordering is by what blocks what, not by severity.

---

## A. BLOCKING — Phase 122 cannot close until these land

### A1. The surface ramp is perceptually flat *(in progress, plan 122-20)*

The operator, on a running server: **"one flat tone for the most part"**. Correct. Measured
adjacent-surface step contrast from the authored hex:

| theme | 0→1 | 1→2 | 2→3 |
|---|---|---|---|
| cyan | 1.042 | 1.064 | 1.083 |
| **emerald** | **1.032** | **1.034** | **1.048** |
| amber | 1.057 | 1.066 | 1.092 |
| readable | 1.089 | 1.067 | 1.109 |
| aubergine | 1.060 | 1.042 | 1.069 |

Reference, measured identically from their own published hex: shadcn zinc **1.123 / 1.189 / 1.426**,
GitHub dark **1.094 / 1.137 / 1.247**. Cyan steps `rgb(5,6,10)` → `rgb(11,13,18)` — about 6/255 in
near-black.

**RESOLVED 2026-08-19 by plan 122-20**, pending operator re-confirmation. All five ramps
re-derived in OKLCH (hue and chroma held, lightness stepped), `--surface-0` unchanged in every
theme. Measured after: cyan 1.140/1.190/1.255, emerald 1.139/1.190/1.265, amber
1.138/1.196/1.260, readable 1.140/1.184/1.264, aubergine 1.138/1.190/1.265 -- every step now
inside the reference band and widening with depth.

Text-contrast cost measured, nothing crossed AA: foreground vs card 18.58->16.97 (cyan),
14.19->13.55 (readable), 14.86->13.85 (aubergine); muted-foreground vs card 7.58->6.93,
5.44->5.20, 5.40->5.04.

**Still not done until the operator re-confirms on a running server.**

### A2. The rendered-result spec's distinctness assertion is vacuous *(in progress, plan 122-20)*

`e2e/theme-rendered-result.spec.ts:269-270` asserts the four sampled surfaces are not
byte-identical (`new Set(...).size === 4`). A one-point difference passes. D-01 requires
"distinguishable depths" — a perceptual property the test never measured. The file already defines
a `channelDistance` helper whose docstring promises a per-call-site threshold rationale, and this
test does not use it.

**RESOLVED 2026-08-19 by plan 122-20.** Replaced with a per-adjacent-pair WCAG contrast floor,
`SURFACE_STEP_CONTRAST_MIN = 1.12`, anchored between shadcn zinc's and GitHub dark's weakest
steps. Mutation-proven live: with the pre-fix ramp swapped back in, 4/4 themes FAIL citing
their real ratios; restored, 4/4 pass. The byte-identity check is retained above it as a
strictly weaker companion, with a comment saying so.

Sibling audit done: the file's other two `channelDistance`/`SEPARATION_THRESHOLD` checks are
already justified. This was the only vacuous instance.

### A3. The after-matrix and delta were measured against the OLD ramp

`a11y-after/*.json` and `122-CONTRAST-BASELINE.md`'s Delta section were captured before A1's fix.
They must be **re-run** once the ramp lands, or the delta describes a stylesheet that no longer
ships. The frozen `a11y-before/` capture stays as-is — it is the control and must not be
regenerated.

---

## B. Carried into Phase 123 (A11Y-02, contrast remediation)

### B1. The sanctioned warn-fill pairing is sub-AA
→ `.planning/todos/pending/warn-fill-foreground-pairing-sub-aa.md`

`bg-(--status-warn) text-(--foreground)` rasterises to **~1.4–1.8:1**. Live at
`IdeationRow.tsx:30`, `InboxCard.tsx:98`, `ScanResultsPanel.tsx:41`; `TaskDetail.tsx:29` inherits.
Found by 122-10 while correcting the Forge badge — it tried to reuse the app's existing idiom and
measured it before adopting. Both sides are already proper tokens, so this is contrast work, not
sweep work. `StatusBadge.tsx:55` carries the corrected form as the control.

Two header comments (`InboxCard.tsx:12`, `ScanResultsPanel.tsx:12`) *document* the defective
pairing and will re-seed it unless corrected alongside the code.

### B2. The contrast violations themselves

Phase 122 measured; it deliberately fixed nothing. `122-CONTRAST-BASELINE.md` is Phase 123's entire
input — per-cell before/after/delta, per-rule breakdown, named-pair ratios, and an enumerated
sampling limit (5 of 47 routes; 42 top-level non-test pages + 5 under `src/pages/hr/`).

**Do not propagate the figure 62** — that is the top-level glob *including* tests. And note git
pathspec globs cross directory boundaries (`src/pages/*.tsx` returns 47, five of them under `hr/`),
unlike shell globs.

---

## C. Known scope limits of the sweep and the ratchet

These are not bugs — they are boundaries that must be *stated* rather than assumed closed, because
the ratchet will report green while they persist.

### C1. Shadows are outside all four sweep buckets
A bare `rgba(...)` inside an arbitrary `shadow-[...]` is not `bg-`/`text-`/`border-` prefixed, so no
bucket matcher and no ratchet bucket can see it. `SwarmTaskNode.tsx` deliberately keeps a violet
state-identity glow (`rgba(139,92,246,0.25)`), consistent with its sibling `failed` shadow. So "no
raw violet remains" is true *of the four buckets*, not of the codebase.
→ filed: `.planning/todos/pending/shadow-rgba-outside-sweep-buckets.md`

### C2. Tailwind scans beyond `src/`, so "clean in src/" ≠ "clean in what ships"
`src/index.css` carries only `@source not "../.planning"`. `scripts/migrate_tokens.py` contains
`bg-gray-950` as a string literal, and Tailwind compiles `.bg-gray-950/50` into the **production
stylesheet** from that build-tooling file. Dead CSS, small, but it means a corpus scope of `src/`
does not equal the shipped surface.
→ filed: `.planning/todos/pending/tailwind-scans-beyond-src.md`

---

## D. Pre-existing UI defects the operator surfaced (NOT caused by Phase 122)

Each was traced before being classified. They are real and worth work; folding them into 122 would
have hidden that 122 did not cause them.

### D1. Forge job-list column clips its card rows
→ `.planning/todos/pending/forge-job-list-column-clips-card-rows.md`
`ForgePage.tsx:175` computes to `position: static; width: 280px` at 1920px — the `md:` override
applies and the 280px master column is intended. Column-level overflow is zero
(`scrollWidth` 279 == `clientWidth` 279); the clipping is card *header rows* inside that width.
`w-[280px]` is present in the pre-phase blob.

### D2. Forge selected row renders as a solid saturated block
→ filed: `.planning/todos/pending/forge-analytics-visual-polish.md`
`ForgeJobList.tsx:225` is `bg-accent border-l-2 border-primary` — **byte-identical** to the
pre-phase blob at `001c1e73:221` — and `--accent` under emerald is `#059669` in **both** trees.
Markup unchanged, token value unchanged. It has always rendered that way; the operator simply
looked at it closely for the first time during this checkpoint.

### D3. Single-series charts render as a full-panel slab
→ same todo as D2. Seen on `/analytics` "LLM BY PROVIDER" with one provider. `LlmProviderPanel`'s
only Phase 122 change was its wrapper, `bg-gray-800/50` → `bg-card/50`, with the opacity modifier
preserved — so the fill was not strengthened by this phase.

### D4. `ForgePage.tsx:151` hand-rolls a page title instead of using `PageHeader`
→ `.planning/todos/pending/forgepage-pageheader-adoption.md`
122-11 declined a blind substitution for a good reason: `PageHeader` bakes in `mb-4` and the
hand-rolled header has none, so converting would double the vertical gap above the master-detail
body — a visual regression on the page D1 already affects, with no visual-check step in that plan
to catch it.

### D5. Four unbounded Convex queries time out server-side
→ `.planning/todos/pending/unbounded-analytics-scans-timeout.md` (pre-dates this phase)
Deliberately used as Phase 122's live proving ground for the unavailable/error states rather than
fixed. `/analytics` now renders honest boundaries naming the failing function and request ID.

---

## E. Verification debt and unanswered decisions

### E1. D-05's human half is structurally unanswerable
`--status-ok` (cyan `#22d3ee`) vs `--primary` (emerald `#10b981`): does the OK badge read as a
second brand colour? Asked three times, never answered — 122-03 named no location, 122-19 named one,
and that location is state-gated behind a live WhatsApp bridge which was offline.

Measured cause: `StatusBadge status="ok"` renders in exactly **one** non-test file app-wide
(`src/pages/WhatsApp.tsx:252` and `:494`, both gated), a scarcity partly created by 122-10
flattening `succeeded`/`completed` to the quietest tier. Control: the same probe finds other
statuses across `BlackboardPanel`, `ExecutionTable`, `IdeationRow`, `JobsPanel`, `RoomListItem`.

**Closed on 122-18's rasterised measurement by operator decision, 2026-08-19.** If a future phase
wants the human judgement, it needs a harness that renders the pairing without a live bridge.

### E2. D-11 (`readable` is effect-free) is only partially answered
The operator reported "only the nav bar items highlight a color" — a colour change, not motion.
D-11 asks about pulse/spin/ease/fade/transition. Whether that highlight carries a transition
duration under `readable` was not checked. Provisional pass; **not a clean one**.

### E3. `CONTEXT.md` D-13's "36 files" matches no measured population
122-13 re-derived five different populations — 32 mention `MetricCard`, 24 render it, 84 render
occurrences, 26 import it, 40 with tests — and **none** is 36. Left unreconciled deliberately, since
122-14's own file list matched the re-derived 24. Worth correcting in CONTEXT.md so it is not
inherited as fact.

### E4. The GLXY-02 test flake
→ `.planning/todos/pending/kg-answer-sync-glxy02-test-flake.md`
`KnowledgeGraph.test.tsx`'s all-on-screen assertion fails ~17% of runs (1 in 6 isolated runs of an
unmodified tree). Pre-existing, owned by the concurrent phase-190 workstream, async-timing shaped.

---

## F. Tooling defects worth remembering

Not project work, but each cost real time this phase and will recur.

- **`gsd-sdk query state.begin-phase`** returned a 4-field payload while writing 8 insertions /
  53 deletions — deleting the whole `stopped_at` narrative and 45 lines of counter provenance.
- **`gsd-sdk query roadmap.update-plan-progress`** returned `{updated: true}` while writing **zero
  bytes**.
- **`gsd-sdk query phase.complete`** must never close this phase: it marks PARTIAL requirements
  Complete. A11Y-01 closes as measurement-only and requires a hand-edit of `REQUIREMENTS.md`.
- All STATE/ROADMAP writes this phase were hand-edited in **both** frontmatter and body copies with
  asserted single-occurrence replaces, verified by `git diff` plus `gsd-state-coherence.ps1`.

### Probe hazards measured this phase (each produced a real false result)
- Tailwind v4 emits **comma-joined selectors** and escapes parens in compiled selectors, so
  `.class{` in built CSS returns a FALSE ZERO.
- **Git pathspec globs cross directory boundaries**, unlike shell globs.
- A pattern beginning with `--` is parsed as an **option** by grep unless `-e` or `--` is used.
- **Hand-escaping backslashes** into a matcher silently returns 0; use the fixed-string flag.
- `grep -c` counts matching **lines** per file and emits a `path:0` row for every file scanned.
- **jsdom cannot see a dead Tailwind class** — 122-12 reverted to a broken `text-${...}`
  interpolation and passed all 8 tests on an identical rendered class string.
- `getComputedStyle` colour strings are `oklch()`/`oklab()` in Tailwind v4; a number-scrape reads
  the **hue angle** as the blue channel. Rasterise instead.
