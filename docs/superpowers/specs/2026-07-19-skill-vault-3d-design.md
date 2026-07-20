# Skill Vault — 3D container view (design)

**Date:** 2026-07-19 · **Status:** approved, building · **Surface:** CodePulse Skills page

## Goal

A max-spectacle 3D view, launched from the Skills page, that shows every skill across the
three containers — **Global**, **Project**, **Cold Storage** — with zoom-to-resolve LOD so
it's stunning *and* usable at ~214 skills. Foundation for Phase 98 (move/archive) and Phase 100
(drag lanes) — built view-only now, with a selection model those phases snap into.

## Renderer

`react-force-graph-3d` (already in the stack, powers the Memory Galaxy) driven in a **bespoke
static-layout** way (fixed node positions, physics off) + custom `nodeThreeObject` meshes +
`UnrealBloomPass` glow + `nodeVisibility` for LOD. `three@0.185.0` is hoisted; no new deps.
Reuses the Phase-91 discipline: three confined to a lazy chunk, WebGL disposed on unmount, FPS≥30.

## Container mapping (from `origin`)

- `claude-code` → **Global**
- `claude-code:available` (`DORMANT_ORIGIN`) → **Cold**
- `claude-code:project:<key>` → **Project**
A skill in both Global and Cold (`isShadowing`) appears in both, joined by a faint tether.

## Scene

- **Overview (far):** three luminous vault frames along a gentle arc, each with a label + live
  count. Inside each, category **constellation clusters** (glowing orbs sized by count, colored
  by `categoryHex`) drift softly. Bloom makes them glow. Shadow tethers between vaults.
- **Focused (near):** click a vault/cluster → camera flies in, that vault's individual **skill
  shards** resolve with billboarded labels; the other two dim/recede.
- **Select:** click a shard → detail card (name, description, category, scope/origin, useCount,
  last-used, `/command`, upstream). Background click / "◂ Back" returns to overview.
- **Search-to-highlight:** reuse the Skills search — matching shards pulse, others dim.

## Components (isolated units)

- `lib/skillVault.ts` — pure: `buildVaultModel(skills)` + `computeVaultLayout(model)` → graphData
  (nodes with fixed positions/type/color/container + shadow links). Fully unit-tested, no three.
- `components/skills/vault/SkillVaultScene.tsx` — sole three/react-force-graph-3d importer;
  default-exported for `React.lazy`. Custom meshes, bloom, camera LOD, dispose-on-unmount.
- `components/skills/vault/SkillVaultView.tsx` — orchestrator: state (focusedContainer,
  selectedSkill, search), lazy scene + detail card + legend + controls; resolves theme + reduced-motion.
- `components/skills/vault/SkillVaultDetailCard.tsx` — selection overlay (plain DOM).
- Skills.tsx — a "Vault" toggle that swaps the flat body for `<Suspense><SkillVaultView/></Suspense>`.

## Theme / a11y / perf

Colors from `resolveThemeColors` + `categoryHex` (hex only — Three.js Color drops rgba). The
**readable** theme suppresses bloom/glow; **reduced-motion** freezes drift + camera easing. LOD keeps
only the focused vault's shards visible; hover labels via the lib; full geometry/material/renderer
disposal on unmount.

## Scope

**v1:** view, LOD, hover/detail, search-highlight, shadow tethers. **Later (98/100):**
drag-between-vaults, Tone.js ambient reaction, per-skill usage heat.
