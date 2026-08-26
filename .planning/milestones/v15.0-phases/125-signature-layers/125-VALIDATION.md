---
phase: 125
slug: signature-layers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 125 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test-infrastructure and Wave 0 rows are derived from `125-RESEARCH.md` §"Validation Architecture".
> The Per-Task Verification Map is intentionally unfilled — task IDs do not exist until the
> planner has written the PLAN.md files. The executor fills it as tasks land.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/component) + Playwright 1.61.1 / Chromium 149.0.7827.55 (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` (repo root, both confirmed present) |
| **Quick run command** | `npx vitest run <specific file>` |
| **Full suite command** | `npm test` (Vitest) · `npm run test:e2e` (Playwright) |
| **Estimated runtime** | Quick: ~seconds per file. Full Vitest suite: measure on first wave merge — not measured this session, do not quote a figure until it is. |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the file that task touched>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full Vitest suite green, PLUS the D-16 operator visual
  checkpoint on `/briefings`, PLUS `125-SERIF-TRIAL.md` exists with a dated adopt/reject/revisit call
- **Max feedback latency:** per-file runs only; no watch-mode flags anywhere

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(to be filled by the planner/executor — task IDs do not exist yet)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement → Behavior Map (pre-task, from RESEARCH.md)

| Req | Behavior to assert | Test type | Notes / house traps |
|-----|--------------------|-----------|---------------------|
| SIGNAL-01 | Horizon state machine reaches all 5 states, incl. fail-closed Unknown on mount, on reconnect, on freshness timeout, and on malformed payload | unit, mocked WS context | Must assert Unknown is *entered*, not merely that Resting is absent. Pair each with a control that could have shown the other outcome. |
| SIGNAL-01 | `--aurora-a/b/c` resolve correctly in all 5 themes | unit | **Never regex-scrape `getComputedStyle`** — Tailwind v4 emits `oklch()` and a number-scrape reads the hue angle as a channel. Rasterise, or assert the `var()` chain. |
| SIGNAL-01 | Disarm eases through amber over ~2.6s before resting | unit or visual | Assert the amber phase is actually entered, not just that the end state is aurora. |
| SIGNAL-02 | `event_type → hue` map matches live `TOPIC_EVENT_MAP`; unknown type renders as machine, never dropped, never guessed Ástríðr | unit | Mutation check: add a fake event type, confirm the test fails if it silently goes uncoloured. |
| SIGNAL-02 | Bounded 60s query returns only in-window `runtime_events` rows and uses the existing `by_timestamp` index | unit, Convex harness per `convex/events.test.ts` | No schema/index addition needed — `by_timestamp` already exists (R-5). |
| SIGNAL-02 | **D-17:** numeral counts live-WS events only; renders in the degraded state until the 60s window has actually filled | unit | Assert the degraded state during the fill window with a control that shows a full window producing a real count. A numeral that is merely *absent* does not prove the degraded state was entered. |
| SIGNAL-02 | **D-19:** `run.blocks` double-delivery does not double-count, incl. the differing-`session_id` variant | unit | This is same-transport duplication — it is NOT covered by any of UI-SPEC's five named reconciliation cases. Needs its own case. |
| SIGNAL-02 | Trace reconciliation: overlap, during-backfill arrival, reconnect, out-of-order, same-second same-session burst | unit/integration, fake WS + fake Convex | UI-SPEC:240's five cases. Under D-17 these govern the TRACE, not the count. |
| SIGNAL-02 | **D-18:** entry-chunk ratchet holds at baseline +2% (583,049 B JS / 237,359 B CSS) | build-artifact ratchet | Copy `src/tokenSweep.ratchet.test.ts`'s refuse-when-`dist/`-absent shape (`:339`) — a ratchet that silently skips when `dist/` is missing is a guard that cannot fire. |
| SIGNAL-02 | Canvas colour path does not regress to regex-scraping | unit, source-shape assertion | R-4 verified `fillStyle = 'oklch(...)'` works directly (pixel readback, not string echo), so the offscreen round-trip is unnecessary. Sentinel required if any probe is added: `fillStyle` silently keeps its prior value on unparseable input. |
| SIGNAL-02 | rAF loop stops on `document.hidden` and paints one static frame under reduced-motion/`readable` | unit | `readable`'s blanket `animation: none !important` does NOT cover a rAF loop — assert the JS gate explicitly. |
| SIGNAL-03 | The **`/400-italic.css` subpath** is what Briefings imports, not the bare package | unit, source-shape test per `src/App.test.tsx:229-283` | R-6: the bare import ships normal style only, so D-15's italic requirement fails silently without the subpath. |
| SIGNAL-03 | `readable` theme override suppresses the serif; the other four keep it | unit or visual | Implement as a CSS `[data-theme="readable"]` override, not a JS theme check. |

---

## Wave 0 Requirements

- [ ] Signal Horizon component + its state-machine test file (net-new component)
- [ ] `event_type → hue` map module + its `TOPIC_EVENT_MAP`-parity test
- [ ] New bounded 60s Convex query + its test, following `convex/events.test.ts`'s harness
- [ ] Entry-chunk ratchet test file, copying `src/tokenSweep.ratchet.test.ts`'s skip-with-reason shape
- [ ] Reconciliation test file — UI-SPEC's five cases **plus** the D-19 `run.blocks` double-delivery case
- [ ] Cross-repo: `astridr-repo` tests for the new `estop_state` emissions in `estop.py`'s
      `activate()`/`deactivate()`, and for the D-19 `run.blocks` fix. That repo's own
      `tests/` mirroring convention applies.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Serif voice verdict | SIGNAL-03 | D-16 makes this a blocking operator judgement about how Ástríðr's voice *feels* — not measurable | Open `/briefings` in a non-`readable` theme. Record a dated adopt/reject/revisit call plus reasoning in `125-SERIF-TRIAL.md`. Its existence is the gate. |
| E-Stop arm → crimson → disarm dawn-ease, end to end against the real emitter | SIGNAL-01 | Requires the `astridr-repo` rebuild to be deployed; the stubbed path proves the state layer but not the wire | After `COMPOSE_PROFILES=prod,war-room docker compose up --build -d`, arm E-Stop from a surface that is NOT the CodePulse button (Telegram `/estop` or in-process) and confirm the horizon goes crimson in a tab that did not issue the command. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Every guard above has been shown to FAIL under a deliberate mutation
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
