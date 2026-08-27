---
id: TODO-alert-rules-engine-rows-overlap
status: pending
planted: 2026-08-21
planted_during: Phase 124 — operator raised it unprompted during the 124-11 checkpoint ("page still bunches up the text"), with a screenshot of /alerts
trigger_when: Next /alerts- or AlertRulesEngine-touching phase. Purely visual, no data loss, but the rules list is effectively unreadable.
scope: Small (one plan) once root-caused — but it is NOT root-caused, and that needs live DOM measurement first
source: src/components/AlertRulesEngine.tsx:75,108-109,205,218-219,388; observed live on /alerts
resolves_phase: 131
last_reviewed: 2026-08-27
---

# Alert Rules Engine rows overlap and bunch their text

## What was observed (2026-08-21, live, operator screenshot)

In the "Alert Rules Engine" panel on `/alerts`, rule rows collide vertically. Rule names
("High Error Rate", "Long Session Duration", "Many Tool Failures", "Event Backlog",
"Stale Sessions", "Agent Crash Loop") overlap their own condition lines and run into the
adjacent rows. The left column (toggle + severity badge) marches at a visibly **tighter
pitch** than the name/description column beside it, so the two columns are not sharing
row baselines.

One badge also renders truncated as `std-hi` where `STANDARD` is expected — the other
rows in the same column render `STANDARD` in full.

Operator's words, verbatim: **"page still bunches up the text"** — "still" indicating
this predates the sighting.

## NOT caused by Phase 124

`git log --grep="(124-" -- src/components/AlertRulesEngine.tsx` returns **0 commits**.
Last touched by `206a26ff` (Phase 122-04, motion-literal conversion), `8c82e76e` (Phase
89-03, glow/shadow token migration), and an earlier `c9066e4f` UI polish pass.

Phase 124 did touch `src/pages/Alerts.tsx`, but only in `2534d016`, which is purely a
data-flow change — it deletes a duplicate `useQuery` and swaps `counts.critical` for
`displayCounts.critical`. No markup, no classes, no layout. Ruled out by reading the diff.

## NOT ROOT-CAUSED — do not guess

The relevant markup, for whoever picks this up:

- `:75` and `:205` — row containers: `group relative flex items-center gap-4 px-5 py-4
  border-b border-primary/10 transition-colors overflow-hidden`
- `:108-109`, `:218-219` — name is `text-base ... truncate`, condition is
  `text-sm text-muted-foreground truncate mt-0.5`
- `:388` — list container: `flex flex-col max-h-[500px] overflow-y-auto bg-background/30
  custom-scrollbar`

A two-line row inside `py-4` needs roughly 66px; the screenshot's rows sit at roughly
half that pitch. That is consistent with a forced row height somewhere, but **this has
not been measured** and a plausible mechanism that the code does not contain will fit the
screenshot just as well as the real one.

## First step when picked up

Measure the live DOM — `getBoundingClientRect()` on a row, its two text children, and the
left column — before changing a single class. Note the repo has form here: Phase 123's
checkpoint surfaced a Radix `ScrollArea` clipping defect whose viewport wraps children in
a `display:table` div that sizes to CONTENT width, which silently defeats `truncate` /
`min-w-0` / `flex-wrap` at the call site. Worth checking whether an ancestor of this panel
does the same before blaming the row markup.

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06/D-07. The defect is rendered row
geometry (vertical pitch, text overlap) — a property of the browser's box layout at runtime, not
of the class strings — so reading code cannot establish whether it currently reproduces; only a
live DOM measurement can, which is exactly why this todo's own author already declined to guess
at a mechanism. Context only (not evidence of presence or absence): `src/components/AlertRulesEngine.tsx:75,108-109,205,218-219,388`
re-read this session are byte-identical to this todo's own transcription, and no commit since
2026-08-21 touches this component.

**REQUIRES LIVE MEASUREMENT — deferred to Phase 131.** Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 8.
`resolves_phase: 131` confirmed against `.planning/REQUIREMENTS.md:249`
(`FIX-06 | Phase 131 | Pending`).
