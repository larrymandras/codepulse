# Phase 03: Design Token Refresh - Discussion Log

**Date:** 2026-05-14
**Participants:** Larry, Claude

## Areas Discussed

### 1. Color Warmth Level

**Question:** How warm should the dark theme feel?
**Options presented:**
1. Whisper tint (~0.012 chroma, hue 260) — match Claude OS
2. Subtle tint (~0.025 chroma) — clearly blue-ish
3. Keep monochromatic — color only via accent tokens

**User selected:** Whisper tint (Recommended)
**Notes:** Exact Claude OS values adopted: background oklch(0.160 0.012 260), card oklch(0.195 0.014 260), border oklch(1 0 0 / 8%), muted-foreground oklch(0.65 0.02 256).

### 2. Category Accent Mapping

**Question 1:** How should category accents appear on cards?
**Options presented:**
1. Radial gradient fill (Claude OS pattern)
2. Border-left strip (3px colored border)
3. Both + icon tint

**User selected:** Radial gradient fill (Recommended)

**Question 2:** Confirm hue assignments for 5 categories
**Options presented:**
1. Standard mapping: cost=amber(80°), health=green(142°), activity=blue(230°), memory=violet(290°), alerts=red(27°)
2. Swap memory/activity
3. Custom mapping

**User selected:** Standard mapping (Recommended)
**Notes:** Overlaps with existing status colors (health≈ok, alerts≈error) are intentional.

### 3. Migration Strategy

**Question:** How to roll out across 15 pages and 150+ components?
**Options presented:**
1. Additive tokens (new tokens alongside existing, components opt-in)
2. Big-bang swap (replace everything at once)
3. Feature flag (toggle between old/new)

**User selected:** Additive tokens (Recommended)
**Notes:** Base dark tokens swapped in one pass, accent tokens are additive. Components opt into accents via data-accent attribute.

### 4. Light Theme Handling

**Question:** What happens to light theme?
**Options presented:**
1. Leave untouched (monochromatic)
2. Matching minimal warmth
3. Full accent set for both modes

**User selected:** Leave untouched (Recommended)
**Notes:** Light theme stays pure monochromatic. Accent tokens defined in :root at lower chroma for dual-mode components, but base tokens unchanged.

## Deferred Ideas

- Light theme warmth refresh
- Ambient CSS animations
- Automatic page→accent mapping system

---

*4 areas discussed, 5 questions asked, all recommended options selected.*
