# Requirements

**Active milestone: v15.0 — "Borealis Console" Premium UI Overhaul** (Phases 120+, started 2026-08-17 via `/gsd-new-milestone`, consuming the `MILESTONE-CONTEXT.md` prepared 2026-08-07).

Prior milestones (requirements archived in full, extract-don't-delete):

- **v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** shipped 2026-08-17 → [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md). Phases 108–119, 86 plans, **15/17 satisfied** (MISSION-01 PARTIAL, MISSION-02 reassigned to SEED-007).
- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md) (14/15).
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## Design inputs (read these during phase planning — carried from MILESTONE-CONTEXT.md, now consumed)

The design law for this milestone is **already decided and validated**; these are inputs, not open questions. Re-litigating them is out of scope.

1. **`Skill("sketch-findings-codepulse")`** — the validated design law: 12 locked decisions, CSS patterns, motion tokens, the kill list, plus the winning interactive mockup in `sources/`. Auto-loads on UI work.
2. **`.planning/sketches/001-dashboard-quiet-control-room/index.html`** — the working reference implementation of the whole direction. **Open it**; it answers more than prose can.
3. **`html-out/ui-premium-redesign-comparison.html`** — the 3-model proposals (Claude Fable 5 / GPT-5.6 Sol / Kimi K3) plus the approved verdict tab. The convergence map is the quick-win list.
4. **`html-out/redesign-before-after.html`** — before/after visual reference.
5. **`.planning/sketches/MANIFEST.md`** and `WRAP-UP-SUMMARY.md` — direction and wrap-up.

**Decided 2026-08-07 by Larry:** variant B "Borealis blend" is the winner; ALL work including quick-wins was held for v15.0.

---

## Polish & Verified Defects (POLISH)

The unanimous 3-model kill list plus three defects verified in live code. These are the cheapest wins and should land first — they also unblock honest measurement for the token work.

- [x] **POLISH-01** — Operator sees no instance of the banned decoration anywhere in the app: `hover:scale-[1.01]`, glitch-text, matrix-bg, CRT-by-default, per-item nav glow (`nav-active-shadow`/`nav-hover-shadow`), decorative pulse dots, cyan scrollbar glow, violet search pill. *(Unanimous across all three model proposals — the strongest signal in the comparison.)*
- [x] **POLISH-02** — The E-Stop control holds fixed geometry and never wraps or reflows at any viewport width.
- [x] **POLISH-03** — A destructive action is confirmed in a **dialog**, never a toast. *(`Tasks.tsx:144-145` puts a destructive confirm in a toast today — a toast can be missed or auto-dismissed, so it cannot carry a decision.)*
- [~] **POLISH-04 (PARTIAL)** — No surface asserts a figure that has no emitter behind it. *(`HeroStatsBar.tsx:161-168` renders a fabricated Integrations row and carries a literal "simulation" comment. Same honesty rule that governed v14.0's MISSION-03.)*
- [x] **POLISH-05** — Status badges follow the quiet law: only **Failed** renders filled; everything else is quiet. Status vocabulary is unified to Running / Succeeded / Failed / Cancelled.
- [x] **POLISH-06** — The sidebar and Settings no longer collide at 900px.

## Tokens & Primitives (TOKEN)

Where the milestone's leverage is: 200+ components inherit from shared primitives, so upgrading these beats per-page rewrites.

- [x] **TOKEN-01** — All 5 themes define the layered surface tokens (`--surface-0/1/2/3`, `--hairline`), and every surface reads them rather than hardcoded values. *(Closed 2026-08-20. `122-02` built the ramp; `122-20` re-derived it in OKLCH after the operator called the first pass "one flat tone" (step contrast 1.03-1.11 → 1.14-1.27); operator re-confirmed live on `localhost:5173` 2026-08-20, cycling all 4 themes and reading background/card/popover as distinguishable layers in each. Enforced by a mutation-proven perceptual-floor assertion, `e2e/theme-rendered-result.spec.ts` (`SURFACE_STEP_CONTRAST_MIN = 1.12`), 47/47 passing.)*
- [x] **TOKEN-02** — The three-hue-owner law holds app-wide: cyan = machine, violet = Ástríðr **only**, `--status-*` = state. This includes decoupling `--status-ok` from `--primary`. *(Corrected 2026-08-18 during Phase 122 discussion, per the Stale Docs rule: this line previously cited `index.css:139/165`, which is wrong twice over — `:139` is `--card-foreground` and `:165` holds no status token, and the collision is in **three** themes, not one. Measured live: `cyan` `:142`/`:171` both `#06b6d4`; `emerald` `:198`/`:205` both `#10b981`; `amber` `:220`/`:227` both `#f59e0b`. Already decoupled in `readable` (`#5eead4` vs `#34d399`) and `aubergine` (`#c084fc` vs `#34d399`). Note `emerald`'s `--primary` is itself a green, so a single sea-green `--status-ok` cannot satisfy this requirement there — see `122-CONTEXT.md` D-05.)* *(Closed 2026-08-20 by `122-18`'s rasterised measurement: cyan/emerald decoupled from 0.0 distance pre-phase to 80.2/113.5 post-phase; readable/aubergine already decoupled and remain so. `--astridr` exclusivity separately enforced, 47/47 passing.)*
- [x] **TOKEN-03** — Motion is token-driven (120/200/320ms, `cubic-bezier(0.22,1,0.36,1)`), every animation is gated on `prefers-reduced-motion`, and `readable` keeps its no-effects guarantee. *(Closed 2026-08-20. Duration/easing tokens force-generated via `@source inline(...)` after `122-03` found a plain `@theme` declaration emits no utility classes for `--duration-*`. `e2e/theme-reduced-motion.spec.ts`'s D-11/D-12 population-level checks, each paired with a must-show-motion control so a green can't mean "measured nothing": zero non-zero animation/transition durations under `prefers-reduced-motion` (cyan) and under `readable` with no OS override, both with a cyan control confirmed showing real motion. 6/6 passing, re-run live this session.)*
- [x] **TOKEN-04** — A shared metric tile primitive renders **six explicit states** — loading, ready, empty ("no signal yet"), stale, unavailable, error — and no surface shows a bare "Loading…" or renders "—" as a confident metric value. Skeletons are shaped like the content they replace. *(Closed 2026-08-20. `MetricCard.tsx` rewritten to the six-state contract by `122-13` (`fde030a5`); `MetricCard.test.tsx` 17/17 passing. The rewrite's clickable wrapper initially regressed accessibility — WCAG `aria-command-name`, 8 objects/52 nodes, caught by A11Y-01's after-matrix — closed by `122-22` (`156d5116`, an `aria-label`) and confirmed against a real browser: 0/20 capture files now contain the rule.)*
- [~] **TOKEN-05 (PARTIAL)** — Every route uses the shared `PageHeader` contract, and `EmptyState` is a shared primitive rather than per-page prose. *(`122-11` (D-17/D-18) adopted `PageHeader` across the route set; `EmptyState` shipped as a shared primitive. **One known gap, deliberately not force-fixed**: `src/pages/ForgePage.tsx:150-159` still hand-rolls its title in `PageHeader`'s exact shape — `122-11` declined a blind substitution because `PageHeader` bakes in `mb-4` and the hand-rolled header has none, so converting would double the vertical gap above the master-detail body with no visual-check step in that plan to catch a regression. Filed: `todos/pending/forgepage-pageheader-adoption.md`. `src/pages/Chat.tsx` not using `PageHeader` is intentional, not a gap — Chat is explicitly out of scope for this milestone ("Regressing `/chat`" is listed under Out of Scope above), and it renders no page-header region by design.)*

## Shell & Information Architecture (SHELL)

- [ ] **SHELL-01** — A 48px 3-zone header (breadcrumb / command bar / system-chip + E-STOP + overflow menu holding theme, privacy, CRT, audio and help) replaces today's header on every route.
- [ ] **SHELL-02** — The 232px sidebar is regrouped into 4 collapsible domains (Command / Observe / Agents / System) with count badges and a 2px active rail, delivered as a **pure `navRegistry.ts` regroup with no route changes**. *(Every route keeps its URL; this is presentation only.)*

## Signature Layers (SIGNAL)

The two moments that make the console feel like itself. Deliberately last — they sit on top of the token and shell work.

- [ ] **SIGNAL-01** — The aurora-textured Signal Horizon renders as a 2px shell line carrying event packets, turns crimson on **every page** when E-Stop arms, and eases back through amber over ~2.6s on disarm. Static or hidden under reduced-motion and in `readable`.
- [ ] **SIGNAL-02** — A Pulse ECG canvas hero replaces the synthetic "SYSTEM LOAD" bar, driven by real events over a 60s window, reading its colours from tokens via `getComputedStyle`. One component, no Recharts — the entry-chunk budget holds.
- [ ] **SIGNAL-03** — Ástríðr's serif voice is trialled on **exactly one** surface (Briefings or Insights) and evaluated before any app-wide commit. *(Explicitly not a global font change in this milestone.)*

## Accessibility (A11Y) — SEED-006

Pulled in because this milestone rewrites the palette. Fixing contrast separately would mean touching all 5 themes twice, or worse, choosing new tokens without contrast data and re-baking the violations.

- [x] **A11Y-01** — The true scale of the contrast problem is **measured** across the full 4 themes × 5 pages matrix against the keyless server, and recorded. *(This is sizing, and it is task 1. The known figure — 234 violations on `[cyan] Dashboard` — is ONE CELL of that matrix. The total is unmeasured. **Do not plan against 234.**)* *(Closed 2026-08-20. Measured, re-measured, and recorded in `122-CONTRAST-BASELINE.md`: `122-01` captured the frozen BEFORE control (24 objects/218 nodes; the 234 figure addressed and retired as a comparison point — same violation, a node count from a different measurement point, not the same unit). `122-21` re-captured AFTER against the re-derived ramp once `122-20` fixed it; `122-22` re-captured a second time once `156d5116` closed an `aria-command-name` regression the ramp work's `MetricCard` rewrite had introduced. Current AFTER: 24 objects/209 nodes, an exact object-level match to BEFORE. Two adversarial reviews caught and corrected a node-level noise source (a scan-timing-gated header badge); the baseline now carries an ex-badge column so Phase 123 plans against the stable figure. Sampling limit: **5 of 47 route files measured** (42 top-level non-test pages + 5 under `src/pages/hr/`; do not propagate 62, the top-level glob including tests), re-derived twice and the other 42 enumerated by name in `122-CONTRAST-BASELINE.md`, not assumed unchanged. **Delta direction: flat at the object level** (24 objects both before and after — the phase's token/ramp/aria work moved node counts, not which rules fire) — see the baseline doc for the full per-cell/per-rule breakdown. This is measurement only — the violations themselves are open work, tracked as A11Y-02/Phase 123.)*
- [ ] **A11Y-02** — `e2e/theme-contrast.spec.ts` passes against `dev:noauth` with no `wcag2a`/`wcag2aa` violations, across every theme × page cell measured in A11Y-01.
- [ ] **A11Y-03** — The contrast suite cannot report green against a page it never rendered. *(Half of this shipped as `fee96b5d`, which made the spec skip rather than assert when the Clerk gate is up. This requirement is to **verify that guard still holds** after the token rewrite — a suite that passes vacuously is worse than no suite, and this one did exactly that for months.)*

## Analytics Data Path (DEBT)

Numbering continues from v14.0's DEBT-05..07.

- [x] **DEBT-08** — `/analytics` survives a failing query: no single `useQuery` throw can blank the page, and its LLM queries (`costByModel`, `providerBreakdown`) read the `aggregates` rollups rather than raw `llmMetrics`. *(Corrected 2026-08-18 at Phase 121 close, per the Stale Docs rule: this line also listed `latencyOverTime` `:308` as migrating to the rollups. Per `121-CONTEXT.md` D-06 it was DELETED instead -- zero consumers, and no `latency` rollup exists or was added -- together with `costByProvider` `:214`. The deletion SATISFIES this requirement and is not an unmet clause. The `:231`/`:275` line numbers are dropped because both surviving queries moved when the two dead ones were removed.)* **This is a prerequisite for TOKEN-04 on `/analytics`** — a tile cannot render an honest `unavailable` state if the throw unmounts the React tree first. Full brief: `todos/pending/llm-analytics-rollup-migration-cr01.md`.

---

## Milestone-level acceptance (carried from MILESTONE-CONTEXT.md before it was consumed)

These sit **above** the per-requirement checkboxes — they are how the milestone as a whole is judged, and they name the verification method, not just the outcome.

1. **Dashboard at 1600×900 matches the Borealis mockup's structure and law** — spot-diff against `sketch-variant-b.png`, not judged by eye alone.
2. **Arming E-Stop turns the Signal Horizon crimson on every page**; disarm eases back through amber (~2.6s); the confirm is a dialog, not a toast.
3. **Zero instances remain** of: `hover:scale-[1.01]`, glitch-text, matrix-bg, `nav-active-shadow`/`nav-hover-shadow`, the fabricated Integrations row, `--status-ok` == `--primary`, bare "Loading…" text, and "—" rendered as a confident metric value.
4. **All 5 themes render the new tokens**; `readable` keeps its no-effects guarantee; `prefers-reduced-motion` verified.
5. **Every route uses the shared PageHeader**; Executions uses the quiet-badge table pattern.

**Adopted verification contracts** (from GPT-5.6 Sol's proposal, accepted 2026-08-07): six-state metric tiles, freshness labels, unified status vocabulary (Running/Succeeded/Failed/Cancelled), an event-coalescing budget of ≤1 animation per region per second, and **visual regression across all 5 themes at 1600×900 plus reduced-motion**.

---

## Out of Scope (this milestone)

- **Re-litigating the design direction.** Variant B was chosen 2026-08-07 against three model proposals. The 12 locked decisions are inputs.
- **Replacing the theming architecture.** Enhance the `data-theme` + token system; do not swap it. No new UI frameworks — shadcn/Radix/Tailwind-4/Lucide only.
- **Per-page rewrites.** Upgrade shared primitives instead; 200+ components inherit.
- **App-wide serif adoption.** SIGNAL-03 is a one-surface trial, deliberately.
- **Regressing `/chat`.** It is the in-repo north star and its easing is the house easing.
- **SEED-004 Project Lifecycle Cockpit.** Its own trigger defers it past v15.0 and gates it on Forge v4.0 Interactive Sessions (Phases 21–26), which have not shipped.
- **SEED-002 / SEED-007 mission work.** Both gated on the astridr emitter resuming — no join key exists today.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| POLISH-01 | Phase 120 | Complete |
| POLISH-02 | Phase 120 | Complete |
| POLISH-03 | Phase 120 | Complete |
| POLISH-04 | Phase 120 | Partial — 3 fabrication residues assigned to 122/125, see 120-FABRICATION-INVENTORY.md |
| POLISH-05 | Phase 120 | Complete |
| POLISH-06 | Phase 120 | Complete |
| DEBT-08 | Phase 121 | Complete |
| TOKEN-01 | Phase 122 | Complete |
| TOKEN-02 | Phase 122 | Complete |
| TOKEN-03 | Phase 122 | Complete |
| TOKEN-04 | Phase 122 | Complete |
| TOKEN-05 | Phase 122 | Partial — ForgePage.tsx doesn't adopt PageHeader, see `todos/pending/forgepage-pageheader-adoption.md` |
| A11Y-01 | Phase 122 | Complete |
| A11Y-02 | Phase 123 | Pending |
| A11Y-03 | Phase 123 | Pending |
| SHELL-01 | Phase 124 | Pending |
| SHELL-02 | Phase 124 | Pending |
| SIGNAL-01 | Phase 125 | Pending |
| SIGNAL-02 | Phase 125 | Pending |
| SIGNAL-03 | Phase 125 | Pending |

**Coverage: 20/20 v15.0 requirements mapped, 100%. No orphans, no duplicates.**

---

## Carried forward from v14.0 (still open, not scoped into v15.0)

Items 5 (CR-01) and the accessibility half have been **absorbed** into this milestone as DEBT-08 and A11Y-01..03 respectively; the rest stay open.

1. **MISSION-01 duration + orphan recovery** → SEED-007. Blocked on data shape, not effort: no `running` row can arrive. **Do not tick MISSION-01's checkbox** — auto-re-ticked by tooling twice, reverted twice.
2. **MISSION-02 humanized tool activity** → SEED-007. No job↔tool join key exists in astridr.
3. **`message_routed` routed but unsurfaced** — needs its own UI design pass (D-13). *Candidate to fold into SHELL/TOKEN work if capacity allows, but not scoped.*
4. **`links` has no recorded retention decision** — `bifrost.ts:53` does an unbounded `.collect()` on the public `list` query. Low practical risk (operator-curated).
5. ~~`llm-analytics-rollup` CR-01~~ → **absorbed as DEBT-08**.
6. **`detectCredentialValue` rule C** still cannot see a colon-joined token as one run; rule A covers the realistic shape by name, so this is deliberate.
7. **Nyquist coverage partial** — 109/112/113/114 partial, 117/119 have no VALIDATION.md.
8. **DEBT-06 remains latent** — the intermittent `Chat.test.tsx` failure was closed *guarded*, never root-caused; instrumentation ships the next occurrence's diagnosis.
9. **Cross-repo, astridr:** `feature/brain-swap` → `main` divergence; `web.py` on the deployed branch still carries a decommissioned-host CORS default removed on `main`.
