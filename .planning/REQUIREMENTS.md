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
- [x] **TOKEN-05** — Every route uses the shared `PageHeader` contract, and `EmptyState` is a shared primitive rather than per-page prose. *(`122-11` (D-17/D-18) adopted `PageHeader` across the route set; `EmptyState` shipped as a shared primitive (`src/components/EmptyState.tsx`). **Closed 2026-08-20**: the one known gap — `src/pages/ForgePage.tsx` hand-rolling its title — was converted by Phase 123 plan `123-06` under D-09, and now renders `<PageHeader title="Forge" className="mb-0 shrink-0" actions={…}/>` at `ForgePage.tsx:154`; `mb-0` cancels the baked-in `mb-4` via `cn()`/twMerge, and `ForgePage.tsx`'s `KNOWN_EXEMPT` entry was deleted from `tokenSweep.ratchet.test.ts` in the same change (mutation-proven: reverting the conversion made the ratchet FAIL naming `ForgePage.tsx`). Spacing was inspected at Phase 123's D-18 operator visual checkpoint (`123-CLOSEOUT.md`). Todo `forgepage-pageheader-adoption.md` moved to `todos/completed/`. Re-derived across all 47 non-test `src/pages/**/*.tsx` files 2026-08-20: exactly one file lacks `PageHeader`. `src/pages/Chat.tsx` not using `PageHeader` is intentional, not a gap — Chat is explicitly out of scope for this milestone ("Regressing `/chat`" is listed under Out of Scope above), and it renders no page-header region by design.)*

## Shell & Information Architecture (SHELL)

- [x] **SHELL-01** — A 3-zone header (breadcrumb / command bar / system-chip + E-STOP + overflow menu holding theme, privacy, CRT and audio) replaces today's header on every route. *(Amended 2026-08-21: "help" struck from the overflow list to match the amended D-07 in `124-CONTEXT.md:90` and `124-UI-SPEC.md:247-250,509`. No Help control exists in the app today; building one is net-new UI outside a presentation-only regroup and is deferred pending its own scoping.)* *(Amended again 2026-08-21 on completion: the "48px" figure is struck. 124-10 owned D-06 and settled the header height by measurement -- the three zones' combined min-content EXCEEDS available width at both 375px and 900px (settled re-derivation: 366.2 vs 327, and 720.8 vs 620), so the wrap branch was taken and the header ships at **56px** (`min-h-14 flex-wrap gap-y-1`). Recorded as a ruled deviation on the letter of the requirement, with its intent met. See the matching ROADMAP criterion-1 amendment.)*
- [x] **SHELL-02** — The 232px sidebar is regrouped into 4 collapsible domains (Command / Observe / Agents / System) with count badges and a 2px active rail, delivered as a **pure `navRegistry.ts` regroup with no route changes**. *(Every route keeps its URL; this is presentation only.)*

## Signature Layers (SIGNAL)

The two moments that make the console feel like itself. Deliberately last — they sit on top of the token and shell work.

- [ ] **SIGNAL-01** — The aurora-textured Signal Horizon renders as a 2px shell line carrying event packets, turns crimson on **every page** when E-Stop arms, and eases back through amber over ~2.6s on disarm. Static or hidden under reduced-motion and in `readable`.
- [ ] **SIGNAL-02** — A Pulse ECG canvas hero replaces the synthetic "SYSTEM LOAD" bar, driven by real events over a 60s window, reading its colours from tokens via `getComputedStyle`. One component, no Recharts — the entry-chunk budget holds.
- [ ] **SIGNAL-03** — Ástríðr's serif voice is trialled on **exactly one** surface (Briefings or Insights) and evaluated before any app-wide commit. *(Explicitly not a global font change in this milestone.)*

## Accessibility (A11Y) — SEED-006

Pulled in because this milestone rewrites the palette. Fixing contrast separately would mean touching all 5 themes twice, or worse, choosing new tokens without contrast data and re-baking the violations.

- [x] **A11Y-01** — The true scale of the contrast problem is **measured** across the full 4 themes × 5 pages matrix against the keyless server, and recorded. *(This is sizing, and it is task 1. The known figure — 234 violations on `[cyan] Dashboard` — is ONE CELL of that matrix. The total is unmeasured. **Do not plan against 234.**)* *(Closed 2026-08-20. Measured, re-measured, and recorded in `122-CONTRAST-BASELINE.md`: `122-01` captured the frozen BEFORE control (24 objects/218 nodes; the 234 figure addressed and retired as a comparison point — same violation, a node count from a different measurement point, not the same unit). `122-21` re-captured AFTER against the re-derived ramp once `122-20` fixed it; `122-22` re-captured a second time once `156d5116` closed an `aria-command-name` regression the ramp work's `MetricCard` rewrite had introduced. Current AFTER: 24 objects/209 nodes, an exact object-level match to BEFORE. Two adversarial reviews caught and corrected a node-level noise source (a scan-timing-gated header badge); the baseline now carries an ex-badge column so Phase 123 plans against the stable figure. Sampling limit: **5 of 47 route files measured** (42 top-level non-test pages + 5 under `src/pages/hr/`; do not propagate 62, the top-level glob including tests), re-derived twice and the other 42 enumerated by name in `122-CONTRAST-BASELINE.md`, not assumed unchanged. **Delta direction: flat at the object level** (24 objects both before and after — the phase's token/ramp/aria work moved node counts, not which rules fire) — see the baseline doc for the full per-cell/per-rule breakdown. This is measurement only — the violations themselves are open work, tracked as A11Y-02/Phase 123.)*
- [x] **A11Y-02** — `e2e/theme-contrast.spec.ts` passes against `dev:noauth` with no `wcag2a`/`wcag2aa` violations, across every theme × page cell measured in A11Y-01. *(Closed 2026-08-20. Met **at the 20 criterion cells** the operator held the finish line to at the D-16 mid-phase checkpoint (`123-CRITERION-DECISION.md`, `hold-and-size`) — this is not a claim about all 47 routes; the other 42 are a sized backlog item (`todos/pending/a11y-02-widened-scan-42-route-backlog.md`), deliberately out of this requirement's scope. Command: `PW_BASE_URL=http://localhost:5181 node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=json`, against `dev:noauth`. Committed run (`123-final-report.json`): `stats.expected=21, skipped=0, unexpected=0`, exit 0 — `expect(results.violations).toEqual([])` holds for all 20 criterion cells (Dashboard/LiveRun/Analytics/Forge/Graphs × cyan/emerald/readable/aubergine), 0 objects/0 nodes of any rule id, delta -24 objects/-209 nodes vs. the pre-123 control. `readable` (D-10) clears the identical bar as the other three themes, down from 78/209 pre-123 nodes to 0. Re-confirmed live a second time, post-checkpoint, after landing two operator-authorized fixes the checkpoint surfaced (`49426c16` JobsPanel keyboard-reachability, `ead1b3ed` Forge ScrollArea clipping + `aria-selected`→`aria-current`): `21 passed (16.5s), exit 0`, all 4 LiveRun cells clean including the two themes (`emerald`/`readable`) that had shown a `scrollable-region-focusable` flake in interim runs — full flake history and its resolution in `123-CLOSEOUT.md` §8. Operator visual checkpoint (D-18, `123-CLOSEOUT.md` §12) confirmed active-nav legibility in all 4 themes and that `/forge`'s `PageHeader` conversion did not double its header gap (~39px vs. `/live-run`'s ~57px); the checkpoint's own "badges hard to read" and "column too narrow" findings were real defects (clipping + an independent `aria-allowed-attr` bug, not a contrast failure — measured 14.19–19.20:1), fixed in `ead1b3ed`/`d1326f13`, not left as accepted cosmetic notes. **One named residual within the 20-cell set, not fabricated a fix for**: a single `[readable] LiveRun` `color-contrast` badge measured 4.26:1 in one of five runs of the identical command; the flagged element (`#7c8595` on `#1d2230`) matches neither the current `secondary` nor `muted` token pairing, so it is not currently reproducible — recorded, not silently dropped (`123-CLOSEOUT.md` §8 correction). All seven discriminating controls (C1–C7) recorded with measured, non-pending results (`123-CLOSEOUT.md` §2).)*
- [x] **A11Y-03** — The contrast suite cannot report green against a page it never rendered. *(Closed 2026-08-20, on live evidence against the real Clerk gate — not the durable self-test alone. `123-01` built the mechanism: `test.skip()` stays at `e2e/theme-contrast.spec.ts:66-73` (each gated cell still reports its own `skipped` status, preserving "never rendered" vs. "rendered clean" vs. "violating"), and a `globalTeardown` reading a per-worker `fs` side-channel log makes the **suite** exit non-zero when any cell skipped — proven by the durable self-test `e2e/a11y-gate-guard.spec.ts`, 5/5 passing (C1: an unguarded matrix exits 0 with the same `skipped` count; C2: the rejected `afterAll`-throw mechanism corrupts cell status instead, confirming why the shipped mechanism is `globalTeardown`, not that; C7: the guarded report has 0 failed tests, the C2 fixture has ≥1). **The live half an agent is structurally blocked from producing**: the operator ran the real gated `npm run dev` on `:5173` (Clerk key set, not signed in) against `e2e/theme-contrast.spec.ts`, and the orchestrator re-ran the identical command to capture the exit code the operator's own report omitted — **exit code 1, 20 cells `skipped` (each keeping its own status), 0 `failed`, 1 `passed`** (the non-gated C5 route-table test), `globalTeardown` threw naming all 20 skips. This matches D-11's expected shape exactly and is the opposite of this suite's pre-phase behavior, where the identical gated run exited 0 — the vacuous pass this requirement exists to close. Full verbatim record: `123-CLOSEOUT.md` §12 Part B.)* *(Half of this shipped as `fee96b5d`, which made the spec skip rather than assert when the Clerk gate is up. This requirement is to **verify that guard still holds** after the token rewrite — a suite that passes vacuously is worse than no suite, and this one did exactly that for months.)* *(Reconciled 2026-08-20 per the Stale Docs rule, from `123-CONTEXT.md` D-11 and premise correction 2: `ROADMAP.md`'s criterion 2 required the gated cell to "fail (not skip)", contradicting this line's "the skip **is** the guard". Both are now held by D-11 — `test.skip()` stays at `e2e/theme-contrast.spec.ts:66-73` so the report still distinguishes "never rendered" from "rendered clean", and a `globalTeardown` script reading an `fs` side-channel log that each worker appends to on its skip branch make the **suite** exit non-zero. Verifying the guard therefore means proving the run goes red, not merely that the annotation is still present: a Playwright run of 20 skipped cells exits 0 today, so the skip is honest inside the report and green outside it.)* *(MECHANISM CORRECTED 2026-08-20 at plan time. This line previously named "a file-level skipped-cell counter plus an `afterAll` throw". That mechanism was falsified against this repo's own Playwright 1.61.1: a thrown `test.afterAll` error is attributed to the tests in that hook's scope and OVERWRITES `result.status` from `skipped` to `failed`, leaving `stats.skipped: 0` while each corrupted cell still carries a `type: "skip"` annotation -- destroying the very three-way distinction (never rendered / rendered clean / violating) this criterion exists to preserve. `fullyParallel: true` independently defeats it: a module-scope counter is per worker PROCESS and cannot see sibling workers' skips. Both mechanisms exit 1, so exit code alone cannot tell them apart. See `123-CONTEXT.md` D-11's correction block and `123-RESEARCH.md` Pattern 2 for the measured comparison table.)*

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
| TOKEN-05 | Phase 122 | Complete — ForgePage adopted `PageHeader` in `123-06` (D-09), `ForgePage.tsx:154`; re-derived 2026-08-20, 46/47 non-test pages adopt it and `Chat.tsx` is a documented out-of-scope exclusion |
| A11Y-01 | Phase 122 | Complete |
| A11Y-02 | Phase 123 | Complete — 20 criterion cells (D-16 hold-and-size); 42-route backlog filed separately |
| A11Y-03 | Phase 123 | Complete — live gated-server evidence 2026-08-20, `123-CLOSEOUT.md` §12 |
| SHELL-01 | Phase 124 | Complete |
| SHELL-02 | Phase 124 | Complete |
| SIGNAL-01 | Phase 125 | Partial — the 2px shell line, fail-closed state machine (125-04), event packets and every-route mount (125-08) are built and tested; "turns crimson on every page when E-Stop arms" is proven only against a dev-only simulation stub so far — the real cross-repo `estop_state` emitter's wire-up proof is 125-12's job |
| SIGNAL-02 | Phase 125 | Pending |
| SIGNAL-03 | Phase 125 | Partial — trial built and shipped (125-05, real italic face self-hosted and chunk-isolated); the requirement's own text ("evaluated before any app-wide commit") is not satisfied until 125-10's blocking operator checkpoint records the adopt/reject/revisit verdict |

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
