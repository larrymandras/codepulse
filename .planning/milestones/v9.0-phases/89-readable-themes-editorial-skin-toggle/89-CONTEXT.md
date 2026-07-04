# Phase 89: Readable Themes & Editorial Skin Toggle

> **Status:** SEED (created 2026-06-22 from the Agent OS mining initiative — see vault `agent-os-mining-initiative.md`). UI phase → run `/gsd-ui-phase 89` (UI-SPEC required) then `/gsd-plan-phase 89`. Requirements (TH-xx) below are proposed, not locked.

## Goal
Give the operator a **theme toggle** with at least one **readability-first** theme, because the shipped **Matrix-Emerald cyberpunk** skin is hard to read in places (low contrast, glow/CRT noise over text, mono-heavy labels). Ship a polished switcher and add a warm **"Midnight Aubergine" editorial** theme as a premium alternative.

## Why
- Direct operator feedback (2026-06-22, Larry): *"the current Matrix-Emerald cyberpunk is difficult to read sometimes."* Readability is the priority; "looking cooler" is secondary.
- The Agent OS pack's `globals.css` demonstrates a distinct, legible, non-AI-slop editorial aesthetic (paper-grain, ambient gradients, real type hierarchy) worth offering as an alternative.
- Pairs with the unfinished **Phase 71** design-token cleanup (standardize on `--status-*`/`--metric-*`/`--info`; fix the `--radius:0` vs `rounded-*` drift; retire Cinzel) — themes should be driven entirely by tokens.

## Proposed Requirements
- **TH-01** — Token-driven theming: all color/contrast/glow values resolve from CSS custom properties so a theme = one token set. No hardcoded severity colors in components (finish the Phase 71 audit as a dependency).
- **TH-02** — A **readability-first theme** meeting WCAG AA contrast for body + secondary text; reduced/disabled CRT-scanline + matrix-grid + heavy glow over text regions; readable (non-mono) body font with mono reserved for code/metrics.
- **TH-03** — **Midnight Aubergine editorial theme** ported as tokens (warm aubergine bg, cream text, gold/emerald/plum accents, paper-grain overlay, ambient radial gradients) — re-implemented from the pack pattern, not copied.
- **TH-04** — Keep **Matrix-Emerald** as a theme option (don't remove what exists); the three coexist behind the toggle.
- **TH-05** — **Theme switcher** in `DashboardLayout` (beyond the current dark/light toggle): persisted to localStorage, applied before first paint (no flash), respects `prefers-reduced-motion` (disables scanline/tick animations).
- **TH-06** — A11y pass: every theme verified for contrast on the highest-traffic surfaces (Dashboard, Live Run, Analytics, Forge, Graphs) via the existing Playwright/axe path.

## Constraints
- shadcn/ui (New York) + Tailwind 4; compose primitives, don't hand-roll. Themes must not fork component markup — tokens only.
- No regression to existing dashboards; the default-on theme can stay Matrix-Emerald (or switch the default to the readable theme — decide in discuss).
- Animations (heartbeat/tick/shimmer) become opt-in per theme + disabled under reduced-motion.

## Open Questions (for ui-phase / discuss-phase)
1. Default theme after this ships — keep Matrix-Emerald, or make the readable theme the new default? (Lean: readable default; cyberpunk opt-in.)
2. Two themes (readable + aubergine) or three (readable + aubergine + keep cyberpunk)? (Lean: three, toggle.)
3. Per-theme vs global animation toggle — one "reduce effects" switch or per-theme baked-in?
4. Does the editorial theme need the bespoke fonts (Bricolage Grotesque, Manrope, Caveat) or approximate with the existing Geist stack to avoid font-loading cost?

## Provenance
Pattern source (re-implement, don't copy): pack `src/app/globals.css` ("Midnight Aubergine" tokens, `body::before` paper-grain, `body::after` ambient gradients, eyebrow/pull-quote/divider primitives, `heartbeat`/`tick` animations). Existing ground truth: `.planning/phases/071-unified-design-system/UI-SPEC.md`, `src/index.css`.
