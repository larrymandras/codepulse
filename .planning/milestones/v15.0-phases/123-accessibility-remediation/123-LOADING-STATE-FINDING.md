# 123-05 Task 1: why a no-alpha token measured 2.68:1

## The controlled measurement

`RunTimeline.tsx:78-87`'s `showThinking` branch only renders while `streaming && blocks.length
=== 0` — a live-agent-run condition this environment has no way to trigger on demand (confirmed
by reading `LiveRun.tsx`: `isLive`/`liveBlocks`/`runDone` come from a live WS/query hook with no
dev/query-param override). So the two-condition control was run by injecting the exact markup
`RunTimeline.tsx:78-87` emits — same class strings, same text, same `cyan`-themed `/live-run` page,
same ancestor background (`document.body` and the real `<main>` both carry unmodified
`bg-background`, per `index.css:554` and `DashboardLayout.tsx:659`) — via the same synthetic-node
technique `e2e/lib/contrast.ts`'s `paintedColorOfClass` already uses in this repo, rather than
depending on live streaming data. This is a documented adaptation of the plan's suggested method,
not a silent substitution: the variable under test (presence/absence of the `animate-pulse` class
on this exact element) is identical either way axe's `color-contrast` check reaches it.

Scratch spec: `e2e/.scratch/loading-state-probe.spec.ts` (run, measured, then deleted — no
leftovers per `git status --porcelain e2e/`).

- **(a) default — `animate-pulse` present**, frozen at Tailwind's default `pulse` keyframe trough
  (`50% { opacity: .5 }`) via a negative `animation-delay` + `animation-play-state: paused` (so the
  axe snapshot lands deterministically on the trough rather than a random point in the 2s cycle).
  Measured computed `opacity: 0.5`. axe `color-contrast`: **fgColor `#4d5561`, bgColor `#05060a`,
  ratio 2.68:1** — FAIL (needs 4.5:1). `#4d5561` is `--muted-foreground`'s `#94a3b8` composited at
  50% alpha over the page background, not a different declared colour — the raw `color` computed
  style is unchanged (`rgb(148, 163, 184)` in both conditions; only axe's *effective*, opacity-aware
  `fgColor` differs).
- **(b) `page.emulateMedia({ reducedMotion: "reduce" })`, `animate-pulse` class genuinely absent**
  from the injected node — mirrors `RunTimeline.tsx:81`'s ternary exactly. Measured computed
  `opacity: 1`. axe `color-contrast`: **fgColor `#94a3b8`, bgColor `#05060a`, ratio 7.89:1** — PASS.

Both ratios quoted to two decimal places, straight from axe's own `data.contrastRatio`, differing
in exactly one variable (the animation).

## Verdict: **confirmed**

`animate-pulse`'s opacity keyframe is the cause. Violation present in (a), absent in (b) — the
`<interfaces>` hypothesis's first branch. A no-alpha token can read 2.68:1 because `animate-pulse`
transiently drives the *element's* opacity to 0.5, which composites the token's full-strength
colour down to a failing effective colour regardless of whether the token itself carries a `/NN`
modifier. This also explains `CodeVaultGraph.tsx`'s 1.93 (measured lower than `/70` alpha alone
predicts: `text-primary/70` static ≈ 3.7-4:1-ish territory per Phase 122's token law, and
`animate-pulse` on top of that compounds toward the ~1.93 floor) — a second, independent factor
(`bg-card/50` on the wrapper, a translucent intermediate layer per `122-21-REMATRIX.md:64`'s
"likely an intermediate semi-transparent layer" note) may also be compounding CodeVaultGraph's case
specifically, but the *animate-pulse* mechanism alone is sufficient to explain and reproduce
RunTimeline's no-alpha 2.68:1 in isolation, so Task 2's remedy targets that mechanism directly.

## Class-level population: text elements carrying `animate-pulse`

Derivation command and unit, run against the live corpus (never `grep -c`, which counts matching
LINES and emits a `path:0` row per scanned file, not occurrences):

```
grep -rlF "animate-pulse" src/ --include="*.tsx" | grep -v '\.test\.tsx' | grep -v "__tests__" | wc -l
  → 39 files   (unit: files)
grep -rhoF "animate-pulse" src/ --include="*.tsx" --exclude="*.test.tsx" | grep -v "__tests__" | wc -l
  → 71 occurrences   (unit: occurrences)
```

That 39/71 is the *whole* `animate-pulse` corpus (dots, skeletons, hover triggers, and text).
Phase 120's `120-PULSE-TRIAGE.md`/`120-VERIFICATION.md` already exhaustively bucketed this same
corpus by D-09/D-10/D-11 shape (42 non-test files at that time; re-derived here at 39 — the
delta is `SessionComparison.tsx`, which dropped out of the corpus entirely: its `:24` site cited
in `120-PULSE-TRIAGE.md` has since been refactored to the shared `<LoadingState>` skeleton
component, verified by `grep -n animate-pulse src/components/LoadingState.tsx` returning nothing
and `src/components/SessionComparison.tsx` no longer appearing in the current file list — a stale
citation, not a live site). Narrowing to the mechanism THIS finding implicates — literal text
content styled with `animate-pulse`, as opposed to skeleton blocks, state dots, or hover triggers —
re-derives Phase 120's "6 loading-text" bucket, corrected for the `SessionComparison.tsx` drop-out,
plus `RunTimeline.tsx` itself (bucketed separately in Phase 120 as `KEEP+GATE`/state+motion-gated,
but it is equally a text element carrying `animate-pulse` and therefore equally in-population for
*this* mechanism, independent of its motion-gating status — motion-gating removes the animation for
`prefers-reduced-motion` users; it does not change what a motion-enabled sighted user's browser
renders at the trough):

| File | Line(s) | Class string | On one of the 5 measured pages? |
|---|---|---|---|
| `src/components/graph/CodeVaultGraph.tsx` | 892 | `text-primary/70 font-mono text-base animate-pulse` | **Yes** — `/graphs`. This plan's Task 2. |
| `src/components/RunTimeline.tsx` | 81 | `text-(--muted-foreground) text-base animate-pulse` (motion-gated) | **Yes** — `/live-run`. This plan's Task 2. |
| `src/components/kg/KGSearchResults.tsx` | 60 | `text-primary/70 font-mono text-base animate-pulse` | No — `/knowledge-graph` |
| `src/pages/KnowledgeGraph.tsx` | 940, 1712, 1752, 1806 (×4) | `text-primary/70 font-mono text-base animate-pulse` | No — `/knowledge-graph` |
| `src/pages/Memory.tsx` | 815 | `text-muted-foreground animate-pulse` | No — `/memory` |
| `src/components/IntegrationHealth.tsx` | 60 | `text-yellow-400 animate-pulse` (hardcoded Tailwind colour, not a token — a distinct, second defect: `text-yellow-400` bypasses this repo's token system entirely) | No — `Infrastructure.tsx`, not routed among the 5 |

## In-scope subset (forced by A11Y-02)

A11Y-02's criterion is `violations.toEqual([])` on the 20 measured cells (5 pages × 4 themes).
Only `CodeVaultGraph.tsx:892` (`/graphs`) and `RunTimeline.tsx:81` (`/live-run`) render on a
measured page — the same two sites `123-05-PLAN.md` names, now confirmed as the entire in-scope
subset by re-deriving the population rather than assuming the plan's original six-node count.
Both are fixed by Task 2.

## Remainder — explicitly deferred, not silently

Five more literal instances of the identical `text-primary/70 ... animate-pulse` mechanism
(`KGSearchResults.tsx`, `KnowledgeGraph.tsx` ×4) plus one instance of the no-alpha
`animate-pulse`-only mechanism (`Memory.tsx`) plus one hardcoded-colour variant
(`IntegrationHealth.tsx`) sit on routes (`/knowledge-graph`, `/memory`, and wherever
`Infrastructure.tsx` is routed) that are **not** among the 5 pages `e2e/theme-contrast.spec.ts`
measures, and are **not** in this plan's `files_modified` (`CodeVaultGraph.tsx`, `RunTimeline.tsx`
only). They are real members of the same defect class this finding confirms, deferred for a named
reason — out of A11Y-02's current measured surface and out of this plan's file scope — not because
they were unmeasured or unknown. Recorded here so a future sweep (extending
`e2e/theme-contrast.spec.ts`'s `PAGES` list, or a dedicated follow-up plan) does not have to
re-discover them.

## Cross-check against `120-SANCTIONED-PATTERNS.md`

Read in full. It records exactly one sanctioned pattern (`GlobalSwapModal.tsx`'s "Revert global
swap" toast action) and it governs POLISH-03's toast-vs-dialog rule for destructive/dispatching
actions — an unrelated concern. **The file contains no rule bearing on the `animate-pulse` text
population measured here.**
