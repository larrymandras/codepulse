# Phase 122 Plan 12: VitalsRail Health Dot + HeroStatsBar Dead Class Summary

Closed the two fabrication-class residues `120-FABRICATION-INVENTORY.md` assigned to this phase --
`VitalsRail.tsx:253`'s fabricated always-green Convex dot (D-16) and `HeroStatsBar.tsx:127`'s dead
runtime-interpolated Tailwind class -- plus an operator-added amendment (2026-08-19): tokenizing
`DashboardLayout.tsx:189`'s app-wide health dot, the same defect shape one layer up.

## Tasks completed

1. **Bind the Convex dot to the reactive connection state** -- imported `useConvexConnectionState`
   from `convex/react` (a subscription) instead of the one-shot `connectionState()` snapshot
   CORRECTION-2 rejects. Bound both the Convex dot and swept the rest of the file's raw palette
   classes (Astridr sibling dot, `statusDot()` container-health helper, alerts banner) onto the
   status tokens -- this file was deliberately excluded from every corpus sweep specifically so this
   plan could touch it exactly once (confirmed via `122-16-PLAN.md:95`, which already documents this
   plan's effect: "plan 122-12 (wave 4) rewired its Convex dot and swept its colour"). Wrote
   `VitalsRail.test.tsx` (none existed), 5 tests including a reactivity proof.
   `src/components/chat/VitalsRail.tsx`, `src/components/chat/VitalsRail.test.tsx`.
2. **Tokenize `DashboardLayout.tsx`'s app-wide health dot (operator-added scope, 2026-08-19)** -- a
   pure token conversion: `bg-green-500`/`bg-yellow-500` -> `bg-(--status-ok)`/`bg-(--status-warn)`.
   Data source (`useConvexConnectionState().isWebSocketConnected` -> `isConnected` -> `dotColor`)
   confirmed byte-identical by diff; no test file added (none existed, plan says not to assume one).
   `src/layouts/DashboardLayout.tsx`.
3. **Remove the dead interpolated class and bring `HeroStatsBar` under the token layer** -- fixed
   `text-${hc.bg.replace('bg-', '')}` (dead: Tailwind's static extractor cannot see a
   template-literal class name) by adding a real, statically-extractable `hc.text` field to
   `healthConfig` (option b -- the `currentColor` shadow now has a real colour to inherit).
   Tokenized `healthConfig`'s bg/text/ring, `bg-[#09090b]`/`border-[#27272a]` ->
   `bg-background`/`border-border`, the gradient's `to-[#fca5a5]` -> `to-(--status-error)`,
   `text-white` (x2) -> `text-foreground`, and removed `glow-card` +
   `shadow-[var(--glow-xs)]`/`hover:shadow-[var(--glow-sm)]` per "depth is shadow, never glow",
   replaced with a plain `shadow-lg`. Left `:141`'s `AnimatedNumber` arithmetic, and the "System
   Load"/"LIVE / 5H WINDOW" labels, untouched (Phase 125 SIGNAL-02's assigned residue). Wrote
   `HeroStatsBar.test.tsx` (none existed), 8 tests.
   `src/components/HeroStatsBar.tsx`, `src/components/HeroStatsBar.test.tsx`.

## Key decisions

- **Task 1's file-wide colour sweep, not just the two dots.** The plan's action text says "sweep its
  other colour classes onto the token layer too -- this file is excluded from every sweep slice
  specifically so it is touched exactly once," and `122-10-SUMMARY.md:98-103` independently confirms
  `VitalsRail.tsx:177`'s `bg-gray-500` (the `statusDot()` helper) was left for this plan by name. So
  the sweep covered all 7 raw-palette-class lines the file had, not only D-16's two named dots.
- **`statusDot()`'s `exited` case -> `bg-muted-foreground`, not a status token.** No dedicated
  neutral/idle status token exists in the token layer; `bg-muted-foreground` is the established
  app-wide idiom for exactly this case (`AgentNode.tsx:83`'s `statusDot[data.status] ??
  "bg-muted-foreground"` fallback), reused rather than inventing a new token.
- **HeroStatsBar's dead-class fix chose option (b): a real static class, not a silent drop.** The
  `shadow-[0_0_8px_currentColor]` beside the dead class depends on `currentColor`; dropping both
  would have left a visibly uncoloured dot with a phantom shadow rule. Adding `hc.text` as a literal
  string field (`"text-(--status-ok)"` etc.) makes the class discoverable by Tailwind's file-text
  scanner even though it's assembled via template-literal concatenation at the render site -- the
  scanner only needs the full class string to appear as a literal substring SOMEWHERE in the module,
  which the `healthConfig` object literal now provides.
- **HeroStatsBar's gradient bar: only the hex-bracket literal converted, `from-orange-900/50` and
  `via-primary` left alone.** The plan's own acceptance-criteria regex (`-\[#[0-9a-fA-F]{3,8}\]`)
  catches `to-[#fca5a5]` regardless of which div it sits in, so it was converted (to
  `to-(--status-error)`, the closest existing status token). `from-orange-900/50` is a raw Tailwind
  palette utility, not hex, and is not named by the plan's truths ("hardcoded hex surfaces and
  glow-card decoration") or its acceptance criteria -- left as-is rather than making an
  unrequested design call on a bar Phase 125's SIGNAL-02 is slated to replace wholesale with a
  Pulse ECG canvas hero. `shadow-[0_0_20px_rgba(249,115,22,0.6)]` (a raw rgba glow on the bar fill,
  not `glow-card`) is likewise untested by any criterion and left untouched for the same reason.
- **Dead `KpiDef.color` fields (`HeroStatsBar.tsx:53,76,84`) left unfixed, logged not fixed.** These
  are plain JS string properties (`"#60a5fa"` etc.) set on each `KpiDef` object but never read --
  `MetricCard`'s actual prop interface has no `color` field at all (confirmed by reading
  `MetricCard.tsx:53-64`), so nothing consumes them. This is a genuinely different defect class from
  the plan's target (a dead JS property, not a CSS/Tailwind class never shipping to the token
  layer), it is not named in `120-FABRICATION-INVENTORY.md` or this plan's `must_haves`/acceptance
  criteria, and fixing it would require either deleting the fields or wiring a new `color` prop into
  `MetricCard` (an architectural change to a shared component outside `files_modified`). Logged here
  per the scope-boundary discipline rather than fixed.

## Deviations from Plan

None requiring Rule 1-4 action. The DashboardLayout.tsx amendment was pre-authorized by the
operator in the plan's own `<scope_amendment>` block before execution began, not discovered
mid-task, so it is not logged as a deviation.

### Comment self-containment fix (not a deviation, a correction made before commit)

While drafting the CORRECTION-2 comment in `VitalsRail.tsx`, the first draft included the literal
substring `useConvex()` to explain why that snapshot form was rejected -- `git grep -cF 'useConvex()'
-- src/components/chat/VitalsRail.tsx` returned 1 (my own comment), which would have failed the
plan's own acceptance criterion requiring that count be 0. Reworded the comment to describe the
snapshot accessor without reproducing its exact call syntax; re-ran the grep, confirmed 0. Caught
before commit, not after -- no commit in this plan's history ever contained the failing count.

## Mutation proofs

- **`VitalsRail.test.tsx`:** reverted the Convex dot to an unconditional `bg-(--status-ok)` class
  (the pre-fix fabricated shape) -- 3 of 5 tests failed for the right reason, including the
  REACTIVITY PROOF test (`expected 'w-2 h-2 rounded-full bg-(--status-ok)' to contain
  '--status-error'`). Restored; 5/5 green.
- **`HeroStatsBar.test.tsx`:** mutated `healthConfig.green.text` to the wrong token
  (`"text-(--status-error)"`) -- the green-tier test failed for the right reason (`expected false to
  be true` on the `text-(--status-ok)` substring check). Restored; 8/8 green. File diffed
  byte-identical against a pre-mutation backup after restoration.
- **Separately proven: the dead-class defect itself is invisible to a jsdom render test.** Reverting
  `${hc.text}` back to the ORIGINAL dead interpolation (`text-${hc.bg.replace('bg-', '')}`)
  produced an IDENTICAL rendered class string in jsdom (both evaluate to `"text-(--status-ok)"` at
  runtime) and did NOT fail a single one of the 8 `HeroStatsBar.test.tsx` tests -- jsdom has no
  concept of Tailwind's static file-text extraction, so a runtime-correct-but-statically-invisible
  string is indistinguishable from a real one in a component test. This is exactly why the plan
  mandates a build-based positive check as the acceptance criterion for this specific defect,
  documented below.

## Built-stylesheet positive check (HeroStatsBar's dead-class fix)

`npm run build` -> exit 0. Two files in `dist/assets/`: `index-DPcVRI42.css` (260 KB, the real
Tailwind bundle) and `style-DtxX27Jz.css` (15 KB, unrelated). All probes against the former.

Tailwind v4 emits comma-joined selectors AND escapes parens in the compiled selector
(`.bg-\(--status-ok\)\/30{...}`) -- a naive `grep -c '\.bg-background{'` (requiring an immediate
`{`) false-zeroed exactly as `122-12-PLAN.md`'s measurement-discipline section warned; corrected to
`grep -cF` on the bare literal substring including its one backslash.

| probe | pattern (grep -F) | count | meaning |
|---|---|---|---|
| known-present control | `bg-\(--status-ok\)` | 1 | already-shipped token class, proves the probe isn't universally broken |
| target | `text-\(--status-ok\)` | 1 | the fixed dead class -- now compiles |
| target | `text-\(--status-warn\)` | 1 | same, yellow tier |
| target | `text-\(--status-error\)` | 1 | same, red tier |
| known-invalid control | `text-\(--nonsense-9x7q2\)` | 0 | proves the probe discriminates, doesn't match everything |
| replacement | `shadow-lg` (via `.shadow-lg{`) | 1 | glow-card's replacement compiled |
| replacement | `bg-background` (bare substring) | 1 | found only after correcting for comma-joined selectors |
| replacement | `border-border` (bare substring) | 1 | same correction |
| replacement | `to-\(--status-error\)` | 1 | gradient hex-stop swap compiled |

## Scope controls (SIGNAL-02, Phase 125)

`git grep -cF 'AnimatedNumber' -- src/components/HeroStatsBar.tsx`: **before 2, after 2** (import +
JSX call site, both lines byte-identical in `git diff`).
`git grep -cF 'System Load' -- src/components/HeroStatsBar.tsx`: **before 1, after 1**.
`git diff -- src/components/HeroStatsBar.tsx` confirms the `<AnimatedNumber value={...
errorRate * 2 ...} />` line and its `style={{ width: ... }}` sibling are unchanged; only the
surrounding `className` strings differ.

## Self-Check

- `test -f src/components/chat/VitalsRail.test.tsx` -> FOUND
- `test -f src/components/HeroStatsBar.test.tsx` -> FOUND
- `git log --oneline -3` -> `ef155099` (HeroStatsBar), `746e060a` (DashboardLayout), `eb56c65b`
  (VitalsRail) all present in history
- `npx tsc --noEmit` -> exit 0 (run after each task and again after all three)
- `npm run build` -> exit 0
- `npx vitest run` -> 344 files passed | 17 skipped (361), 4842 tests passed | 197 todo (5039), 0
  failing -- baseline was 342/4829/0 before this plan; delta of +2 files / +13 tests matches the two
  new test files' 5 + 8 tests exactly
- `git grep -cF 'useConvexConnectionState' -- src/components/chat/VitalsRail.tsx` -> 2
- `git grep -cF 'useConvex()' -- src/components/chat/VitalsRail.tsx` -> 0 (git grep exit 1)
- `git grep -cE 'rounded-full bg-(green|red|emerald)-[0-9]+' -- src/components/chat/VitalsRail.tsx`
  -> 0 (git grep exit 1)
- `git grep -cF 'text-${' -- src/components/HeroStatsBar.tsx` -> 0 (git grep exit 1)
- `git grep -cF 'glow-card' -- src/components/HeroStatsBar.tsx` -> 0 (git grep exit 1)
- `git grep -cE -- '-\[#[0-9a-fA-F]{3,8}\]' src/components/HeroStatsBar.tsx` -> 0 (git grep exit 1)
- `git grep -cF 'text-white' -- src/components/HeroStatsBar.tsx` -> 0 (git grep exit 1)
- `git show 746e060a -- src/layouts/DashboardLayout.tsx` -> 1 file changed, 1 insertion(+),
  1 deletion(-); the only changed line is `dotColor`'s two class literals -- `isConnected`/
  `useConvexConnectionState` lines are unchanged context, confirmed by reading the diff
- No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/index.css` -- `git show
  --stat` on all three commits (`eb56c65b`, `746e060a`, `ef155099`) confirms none of those three
  paths appear
- `git show --stat` on each of the three commits lists only the files this summary names -- no
  files from a concurrent session were swept in
- One transient failure observed in `IntelligenceFeedPanel`-adjacent tests on a single full-suite
  run (not this plan's files, unrelated to this plan's `git status`, which showed only this plan's
  own uncommitted files at the time); a second full run immediately after was clean (344/4842/0).
  Not attributed to this plan's changes.

## Self-Check: PASSED
