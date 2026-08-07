# Sketch Wrap-Up Summary

**Date:** 2026-08-07
**Sketches processed:** 1
**Design areas:** Shell & Dashboard
**Skill output:** `./.claude/skills/sketch-findings-codepulse/`

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | dashboard-quiet-control-room | B — Borealis blend | Shell & Dashboard |

## Excluded Sketches

| # | Name | Reason |
|---|------|--------|
| — | — | none |

## Design Direction

"Borealis Console" — calm layered matte graphite (`--surface-0/1/2` + hairlines), color spent only on state under a three-hue law (cyan = machine, violet = Ástríðr, `--status-*` = state with ok decoupled from primary), mono demoted to data, one eyebrow style, Ástríðr's voice in italic serif. Two signature layers: the aurora-textured Signal Horizon on the shell (event packets, crimson when E-Stop arms, ~2.6s dawn disarm) and the Pulse ECG canvas hero on the Dashboard (60s window). Unanimous kill list from the 3-model verdict applies (hover scale, glitch, matrix-bg, CRT-default, nav glow, decorative pulses, filled DONE pills, fabricated data).

Upstream rationale: `html-out/ui-premium-redesign-comparison.html` (Claude Fable 5 / GPT-5.6 Sol / Kimi K3 proposals + verdict, approved 2026-08-07). Before/after visual: `html-out/redesign-before-after.html`.

## Key Decisions

- Layout: 232px 4-domain collapsible sidebar (2px active rail, count badges) · 48px 3-zone header (breadcrumb / command bar / system chip + fixed E-STOP + overflow) · Signal Horizon · 24px-pad canvas.
- Palette: evolved cyan theme tokens in `themes/default.css`; port into `src/index.css` per-theme blocks.
- Typography: Geist sentence case UI · JetBrains Mono data (40px/300/tabular heroes) · one 11px mono eyebrow · serif voice for Ástríðr.
- Motion: 120/200/320ms + `cubic-bezier(0.22,1,0.36,1)`; reduced-motion gated; readable theme effect-free.
- States: "no signal yet" null cells, skeletons shaped like content, quiet badges (only Failed filled), dialogs not toasts for destructive confirms, truth sentence.

## Build Sequencing (decided by Larry, 2026-08-07)

The entire overhaul — **including the unanimous quick-wins — is held for milestone v15.0** after v14.0 (phases 108–113) closes. Nothing is pulled forward into v14.0.
