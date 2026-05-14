# Phase 03: Design Token Refresh - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Evolve CodePulse's dark theme from pure monochromatic grayscale OKLCH to a subtle colored palette with per-category accent hues and radial gradient card backgrounds. All 15 existing pages must render without visual regression. Light theme is untouched. The Paperclip identity (zero border-radius, shadcn/ui New York, Geist font) is preserved.

</domain>

<decisions>
## Implementation Decisions

### Color Warmth Level
- **D-01:** Dark theme base tokens get a "whisper tint" — `oklch(0.160 0.012 260)` background (cool blue, barely perceptible). Card surface `oklch(0.195 0.014 260)`, border `oklch(1 0 0 / 8%)`, muted-foreground `oklch(0.65 0.02 256)`. Matches Claude OS values exactly.
- **D-02:** Light theme (:root tokens) stays completely untouched — pure monochromatic. Light theme refresh is a future phase if needed.

### Category Accent Mapping
- **D-03:** Five accent hue tokens, standard mapping:
  - `--accent-cost: oklch(0.70 0.15 80)` (amber)
  - `--accent-health: oklch(0.70 0.15 142)` (green)
  - `--accent-activity: oklch(0.70 0.12 230)` (blue)
  - `--accent-memory: oklch(0.70 0.12 290)` (violet)
  - `--accent-alerts: oklch(0.70 0.18 27)` (red)
- **D-04:** Accents overlap with existing status colors: health ≈ status-ok (142°), alerts ≈ status-error (27°), cost ≈ status-warn (85°). This is intentional — reinforces semantic meaning.

### Accent Application Pattern
- **D-05:** Radial gradient fill on cards — `radial-gradient(120% 60% at 0% 50%, ${accent}10, transparent 55%)`. Subtle glow from left edge. Applied via `data-accent` attribute or utility class.
- **D-06:** `.lift-on-hover` utility class — `translateY(-2px)` with CSS transition. Applied to interactive cards.

### Migration Strategy
- **D-07:** Additive approach — new accent tokens added alongside existing ones in `index.css`. Base dark tokens (background/card/border/muted-foreground) swapped to whisper tint in one pass. Components opt into accents via `data-accent` attribute or className. Existing components unchanged until explicitly touched.
- **D-08:** Accent tokens also defined in `:root` (light mode) at lower chroma for components that render in both modes, but light theme base tokens are NOT changed.

### Claude's Discretion
- Exact chroma values for accent tokens may be tuned during implementation if they look too strong/weak against the whisper-tint background
- The `data-accent` attribute name and CSS utility class naming convention
- Whether to add a `.accent-glow` compound class or use individual `[data-accent="cost"]` selectors

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/index.css` — Current token definitions (`:root` and `.dark` blocks), glass tokens, effort tier tokens, animations
- `.planning/REQUIREMENTS-v5.md` — DT-01 through DT-06 requirements for this phase

### Claude OS Reference (source patterns)
- `C:\Users\mandr\Downloads\claude-operating-system-main\claude-operating-system-main\src\styles.css` — Claude OS dark theme tokens, `.lift-on-hover`, `.dream-stars`, `.modal-glass` utilities
- `C:\Users\mandr\Downloads\claude-operating-system-main\claude-operating-system-main\src\components\stat-card.tsx` — Tone-based StatCard coloring pattern
- `C:\Users\mandr\Downloads\claude-operating-system-main\claude-operating-system-main\src\components\usage-panel.tsx` — Radial gradient background on ServiceRow

### Existing Components to Update
- `src/components/MetricCard.tsx` — AnimatedNumber, ThresholdConfig, thresholdColor utility
- `src/components/HeroStatsBar.tsx` — KPI tiles with hardcoded color strings
- `src/components/GlassPanel.tsx` — Glass token consumer, entry animation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **MetricCard** (`src/components/MetricCard.tsx`): Already has AnimatedNumber with spring animation, ThresholdConfig with ok/warn/error, thresholdColor utility returning CSS custom property values. Can be extended with accent gradient background.
- **HeroStatsBar** (`src/components/HeroStatsBar.tsx`): Has KpiDef interface with color, sparkline, threshold, onClick. Currently uses hardcoded hex colors (#60a5fa, #f87171). Migrate to accent tokens.
- **GlassPanel** (`src/components/GlassPanel.tsx`): Uses `--glass-bg`, `--glass-border`, `--glass-blur` tokens. Motion entry animation. Can inherit accent gradient.
- **Sparkline** (`src/components/Sparkline.tsx`): SVG-based, memo-optimized. Uses stroke prop. Can adopt accent color.

### Established Patterns
- **OKLCH everywhere**: All tokens are OKLCH. No hex or HSL. New tokens must follow this convention.
- **CSS custom properties**: Components consume tokens via `var(--token-name)`. Not Tailwind theme colors.
- **Phase comments**: Token groups are commented with phase numbers (e.g., `/* Phase 63 design tokens */`, `/* Phase 093: Effort tier */`). New tokens should follow this pattern.
- **Dark-mode overrides**: `.dark {}` block overrides `:root` values. Same property names, different values.
- **prefers-reduced-motion**: Existing animations respect `@media (prefers-reduced-motion: reduce)`. New transitions must too.

### Integration Points
- `src/index.css` `.dark {}` block — primary edit target for base token swap and new accent definitions
- Every component using hardcoded colors (grep for `#[0-9a-fA-F]`, `rgb(`, `oklch(` inline) — candidates for accent token migration
- `tailwind.config` doesn't exist — Tailwind v4 config is inline in `index.css` via `@theme`

</code_context>

<specifics>
## Specific Ideas

- Claude OS's exact background value `oklch(0.16 0.012 260)` was chosen as the target — user explicitly selected it
- Radial gradient pattern from Claude OS's usage-panel.tsx: `radial-gradient(120% 60% at 0% 50%, ${brand}10, transparent 55%)`
- `.lift-on-hover` from Claude OS: `transform: translateY(-2px)` on hover with CSS transition
- Three-layer status pill pattern from Claude OS: `bg-{color}/10 text-{color} border-{color}/20` (for Phase 04, but token foundation laid here)

</specifics>

<deferred>
## Deferred Ideas

- Light theme color warmth refresh — separate phase if ever needed
- Ambient CSS animations (drift, starfield, pulse) — Phase 04+ or dedicated animation phase
- Component-level accent assignment system (mapping page→accent automatically) — can emerge naturally as components adopt accents

</deferred>

---

*Phase: 03-Design Token Refresh*
*Context gathered: 2026-05-14*
