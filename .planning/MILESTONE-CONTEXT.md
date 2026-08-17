# Milestone Context — v15.0 "Borealis Console" Premium UI Overhaul

**Prepared:** 2026-08-07 (queued while v14.0 executes — consume via `/gsd-new-milestone` AFTER v14.0 closes)
**Decided by:** Larry, 2026-08-07 — variant B "Borealis blend" selected as design winner; ALL work incl. quick-wins held for v15.0 (nothing pulled into v14.0).

## Goal

Make CodePulse look and feel genuinely premium — "Borealis Console": calm layered matte surfaces, color spent only on state, two signature layers (aurora Signal Horizon + Pulse ECG hero), Ástríðr's serif voice — while raising usability (honest states, quiet badges, 3-zone header, 4-domain sidebar).

## Requirements Inputs (read these during requirements definition)

1. **`.claude/skills/sketch-findings-codepulse/`** — the validated design law (12 decisions, CSS patterns, motion tokens, kill list) + winning interactive mockup in `sources/`. Machine-local skill; auto-loads on UI work.
2. **`html-out/ui-premium-redesign-comparison.html`** — the 3-model proposals (Claude Fable 5 / GPT-5.6 Sol / Kimi K3) + approved verdict tab (convergence map = quick-win list; recommended path).
3. **`.planning/sketches/`** — MANIFEST.md (direction), 001 sketch (winner B), WRAP-UP-SUMMARY.md.
4. **`html-out/redesign-before-after.html`** — before/after visual reference.

## Target Features — four pre-shaped phases (Larry's framing, in order)

1. **Quick wins + verified defect fixes** — the unanimous 3-model kill list (remove `hover:scale-[1.01]`, glitch-text, matrix-bg, CRT-by-default, per-item nav glow, decorative pulse dots, cyan scrollbar glow, violet search pill); fixed-geometry E-Stop (never wraps); toast restyle; quiet badge law (only Failed filled); sidebar 900px Settings-collision fix; PLUS the three code-verified defects: delete the fabricated Integrations row (`HeroStatsBar.tsx:161-168`, literal "simulation" comment), destructive confirm out of toasts into a dialog (`Tasks.tsx:144-145`), decouple `--status-ok` from `--primary` (`index.css:139/165` — identical cyan today).
2. **Tokens + primitives** — layered surface tokens (`--surface-0/1/2/3`, `--hairline`) across all 5 themes; three-hue-owner law (cyan = machine, violet = Ástríðr only, `--status-*` = state); motion tokens (120/200/320ms, `cubic-bezier(0.22,1,0.36,1)`); shared primitives: Surface, MetricCard/Tile with explicit states (loading/ready/empty "no signal yet"/stale/unavailable/error), EmptyState, PageHeader contract, skeletons shaped like content; density token (`--density` 1|0.85); mono demoted to data, one eyebrow style.
3. **Shell + IA** — 48px 3-zone header (breadcrumb / command bar / system-chip + E-STOP + overflow menu holding theme/privacy/CRT/audio/help); 232px sidebar regrouped into 4 collapsible domains (Command / Observe / Agents / System) with count badges + 2px active rail (pure `navRegistry.ts` regroup, no route changes); truth sentence on Dashboard.
4. **Signature layers** — aurora-textured Signal Horizon (2px shell line, event packets, crimson when E-Stop arms, ~2.6s dawn disarm; reduced-motion/readable = static/hidden); Pulse ECG canvas hero replacing the synthetic "SYSTEM LOAD" bar (event-driven, 60s window, colors via getComputedStyle from tokens); Ástríðr serif-voice trial on ONE surface first (Briefings or Insights) before app-wide commit.

5. **Analytics rollup migration (CR-01)** — *added 2026-08-17 at Larry's request, at the v14.0 close.* Move `convex/llm.ts`'s `costByModel` (:231), `latencyOverTime` (:308) and `providerBreakdown` (:275) off raw `llmMetrics` and onto the Phase-104 `aggregates` rollups, verifying semantics per query rather than mechanically. Full brief, measured figures and traps: `.planning/todos/pending/llm-analytics-rollup-migration-cr01.md`.

   **Why it belongs in a UI milestone**, rather than riding along arbitrarily: that todo's own `trigger_when` is *"the next Analytics-touching phase"* — and this milestone is one (criterion 5 puts the shared PageHeader on every route; feature 2 mandates six-state metric tiles). More importantly there is a real dependency, not just a theme match: the 2026-08-11 incident was a single `useQuery` **throw unmounting the React tree**, blanking all of `/analytics` including charts whose data was intact. A tile cannot render an honest `unavailable` state if the throw kills the tree before it renders — so the six-state tile contract is not actually deliverable on `/analytics` until this is fixed. Sequence it **with or before** the Analytics honest-states work; it is not a tail-end cleanup.

   **Read before scoping — three things that are easy to get wrong:**
   - This is a **latency/load** problem, **not** runaway growth. An earlier diagnosis said these reads "grow without bound" and was *corrected* in `c4a53541`: the 30-day `llmMetrics` window held 5,274 rows, *under* the 8000 cap and *down* from ~7,080. The table is keep-forever; the 30-day **read** is a sliding window. Conflating those overstates the risk.
   - `by_timestamp` with a `gte` bound returns from the **oldest** end, so a naive `.take(N)` on a "last 30 days" view keeps the *oldest* N rows and silently drops the newest — the opposite of what every one of these surfaces wants. Use `.order("desc")` and reverse for display; `providerBreakdown`'s existing cap has this exact characteristic and should be checked while in there.
   - `convex/llm.ts:214` `costByProvider` is **dead code** — zero callers in `src/`, yet still a public unbounded `query`. Either delete it or fold it into the migration; removing a public endpoint deserves a deliberate decision rather than a drive-by.

## Constraints & Decisions

- Keep the token-driven multi-theme architecture (`data-theme` attr, 5 themes); enhance, don't replace. `readable` stays effect-free; everything gated on `prefers-reduced-motion`.
- shadcn/Radix/Tailwind-4/Lucide only; no new UI frameworks. Entry-chunk discipline holds (canvas hero is one component, no Recharts).
- Prefer upgrading shared primitives/layout over per-page rewrites (200+ components inherit).
- The `/chat` presence page is the in-repo north star; its easing is the house easing. Do not regress it.
- Working reference implementation of the whole direction: `.planning/sketches/001-dashboard-quiet-control-room/index.html` (interactive; implementers should open it).
- GPT-5.6 Sol's contracts adopted: six-state metric tiles, freshness labels, unified status vocabulary (Running/Succeeded/Failed/Cancelled), event-coalescing budget (≤1 animation per region per second), visual regression across all 5 themes at 1600×900 + reduced-motion.

## Success Criteria (milestone level)

1. Dashboard at 1600×900 matches the Borealis mockup's structure and law (spot-diff against `sketch-variant-b.png`).
2. Arming E-Stop turns the Signal Horizon crimson on every page; disarm eases back through amber (~2.6s); confirm is a dialog, not a toast.
3. Zero instances remain of: `hover:scale-[1.01]`, glitch-text, matrix-bg, `nav-active-shadow`/`nav-hover-shadow`, fabricated Integrations row, `--status-ok` == `--primary`, bare "Loading…" text, "—" rendered as a confident metric value.
4. All 5 themes render the new tokens; `readable` keeps its no-effects guarantee; `prefers-reduced-motion` verified.
5. Every route uses the shared PageHeader; Executions uses the quiet-badge table pattern.
