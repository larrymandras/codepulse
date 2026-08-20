---
phase: 123
slug: accessibility-remediation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-20
---

# Phase 123 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `123-RESEARCH.md` § Validation Architecture, plus the discriminating
> controls added below (the research pass did not supply them).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.61.1 (`@playwright/test`) + axe-core via `@axe-core/playwright` 4.12.1 |
| **Config file** | `playwright.config.ts` — `fullyParallel: true`, `workers: undefined` outside CI, `globalSetup: './e2e/global-setup.ts'` |
| **Quick run command** | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts --grep "\[cyan\] Dashboard"` |
| **Full suite command** | `npm run dev:noauth` in a separate terminal, then `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` |
| **Estimated runtime** | ~12–15s for the current 20-cell matrix (from `122-CONTRAST-BASELINE.md`, **not** re-measured this session — treat as an estimate, not a measurement). The D-16 widened 47×4 scan is ~9.4× that cell count and has never been run; measure it once before relying on any figure. |

**Binary resolution warning (measured this session).** A bare `npx playwright` on this machine can
resolve a **global** Playwright install at `C:\Users\mandr\AppData\Roaming\npm\node_modules\playwright`,
which is a different version from the repo's 1.61.1 and fails to resolve repo-local modules at all.
Any harness-mechanics result must be produced with `node_modules/.bin/playwright` explicitly, or the
version under test is not the version that ships.

---

## Sampling Rate

- **After every task commit:** single-cell quick run (`--grep` one theme×page) after any sweep edit
  touching a shared-chrome file (`src/layouts/DashboardLayout.tsx` above all — it owns 184 of the
  209 measured nodes); full 20-cell run after any edit to `e2e/theme-contrast.spec.ts` itself.
- **After every plan wave:** full current 20-cell matrix — `A11Y_MEASURE_ONLY=1` first (sizing,
  always completes), then unset (the remediation gate).
- **Before `/gsd:verify-work`:** the widened 47×4 scan (D-16) at least once, plus D-18's operator
  visual checkpoint, which is a separate blocking gate that no automated run substitutes for.
- **Max feedback latency:** ~15s (single cell: low seconds).

---

## Per-Requirement Verification Map

Task-level rows are filled by the planner; this is the requirement-level contract the plans must
satisfy.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| A11Y-02 | Zero `wcag2a`/`wcag2aa` violations across every measured cell | e2e (axe) | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` | ✅ `e2e/theme-contrast.spec.ts` |
| A11Y-02 | Rasterised ratio ≥ WCAG threshold for sites axe cannot reach (D-02 pass 2) | e2e (canvas rasterisation) | `npx playwright test e2e/theme-rendered-result.spec.ts` (extend, do not replace) | ⚠️ exists, needs D-03 font-size/weight read |
| A11Y-03 | Suite exits non-zero on any skip **without** corrupting per-cell status | e2e (harness mechanics) | `globalTeardown` + `fs` side-channel per D-11 as corrected | ❌ Wave 0 — new file + `global-setup.ts` edit |
| A11Y-03 | Guard still fires against a genuinely gated server | e2e self-test (D-12 durable half) + operator live evidence | Self-test spec injecting the gated state; operator runs the matrix against `:5173` | ❌ Wave 0 (self-test); operator action not automatable |
| A11Y-03 | Content marker distinguishes shell-only from content-rendered (D-13) | e2e (per-page `<h1>` wait) | Marker column on `PAGES` in `theme-contrast.spec.ts` | ⚠️ `PAGES` exists, marker column does not |

---

## Discriminating Controls (MANDATORY — a green here is vacuous without these)

This phase exists because a suite reported green against pages it never rendered. Every gate below
must therefore be paired with an observation that **would differ if the mechanism were broken**. A
probe that returns the same result whether the property holds or not carries no information, no
matter how green it is.

| # | Gate being trusted | Control that must differ | Verified? |
|---|---|---|---|
| C1 | "The suite fails when cells are skipped" | An **unguarded** run of the same all-skipping matrix must exit **0**. Measured this session: exit 0, `stats.skipped: 3`. Without this, "exit 1" proves nothing — the run might be red for an unrelated reason. | ✅ measured 2026-08-20 |
| C2 | "Cells still read `skipped` after the guard fires" | The **rejected** `test.afterAll` mechanism must be shown to corrupt them. Measured: `stats.skipped: 0`, 3 cells flipped to `failed` while retaining a `type: "skip"` annotation. **Both mechanisms exit 1**, so exit code alone cannot discriminate — this control is the only thing that can. | ✅ measured 2026-08-20 |
| C3 | "The isolation harness measures real contrast" (D-02 pass 2) | A deliberately sub-AA fixture the harness **must flag**, run in the same pass as a known-passing element. A harness that flags nothing is indistinguishable from a compliant corpus. Note the `canvas.fillStyle` trap: it silently retains its previous value on unparseable input, so an unparsed colour reads as the *last* colour. Use a sentinel and return `null` rather than a guess. | ⬜ pending — plan must include it |
| C4 | "The corpus sweep found every `/NN` site" | A known-present string must be returned by the same command that reports the population. The 2026-08-17 precedent: a `-c` based count silently mixed line-counts with file-counts and was wrong twice over. State the unit (occurrences / files) with every figure. Re-derived this session: **176 occurrences, 65 files, 1 test file**. | ✅ re-derived 2026-08-20 |
| C5 | "The widened 47×4 scan actually scanned 47 routes" | Assert the scanned-cell count in the run itself, and confirm 47 ≠ the 62-file top-level glob that includes tests (`122-CONTRAST-BASELINE.md` explicitly warns against propagating 62). A scan that silently enumerates fewer routes reports green for routes it never visited — the phase's own defect, one level up. | ⬜ pending — plan must include it |
| C6 | "Contrast improved" (any before/after colour claim) | Measure the **pre-change** class strings from git in the same page, rasterised the same way. On Phase 120 this control inverted the conclusion. Never regex-scrape `getComputedStyle` — Tailwind v4 emits `oklch()`/`oklab()` and a number-scrape reads the hue angle as a channel. | ⬜ pending — plan must include it |
| C7 | "No cell is misreported" (D-11 regression signature) | Grep the JSON reporter output for any test with `"status": "failed"` whose annotations include `type: "skip"`. Any hit is the `afterAll` defect returning. | ⬜ pending — plan must include it |

---

## Wave 0 Requirements

- [ ] `e2e/theme-contrast.global-teardown.ts` — the fail-on-skip mechanism (D-11 **as corrected**:
      `globalTeardown` + `fs` side-channel, **not** `test.afterAll`).
- [ ] `e2e/global-setup.ts` edit — truncate the skip-log at run start, so a stale log from a
      previous failing run cannot fail the next clean one.
- [ ] A D-12 self-test spec that deterministically injects the gated sign-in state without a live
      Clerk key or gated server.
- [ ] Font-size/weight reader for D-03's large-text threshold in the isolation harness (pass 2).
- [ ] `PAGES` array: per-route marker column (D-13) + widening to all 47 routes (D-16).
- [ ] A deliberately sub-AA fixture for C3, and a gated-route fixture for C1/C2 regression.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| D-18 operator visual checkpoint | A11Y-02 | Judging whether de-emphasis still reads as de-emphasis after `/NN` deletions is a perceptual call no ratio threshold captures. A pairing can clear 4.5:1 and still flatten a visual hierarchy. | Blocking, before phase close. Plan must name the exact routes and themes staged, and the specific question the operator answers — not "does it look right". |
| Live gated-server evidence (D-12 non-durable half) | A11Y-03 | Requires a real Clerk gate up on `:5173`; the durable half is the injected self-test. | Operator runs the matrix against the gated server and confirms non-zero exit with cells still reading `skipped`. |

---

## Validation Sign-Off

Signed off 2026-08-20 after the plan set landed (13 plans, 6 waves). Each box records the evidence
that closed it, so a later reader can re-check rather than trust the tick.

- [x] All tasks have automated verify or a Wave 0 dependency — every plan carries at least one
      `<automated>` block; the tasks without one are the operator-gated steps in `123-09` and
      `123-13` (both `autonomous: false`), covered under Manual-Only Verifications above.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — measured per plan,
      `<task` count vs `<automated>` count. The largest gap in any plan is **2** non-automated
      tasks (`123-09`: 3 tasks / 1 automated; `123-13`: 4 / 2), so the rule holds regardless of
      task ordering. Caveat stated honestly: this bounds continuity **within** each plan; I did not
      measure it across plan boundaries in execution order.
- [x] Wave 0 covers all MISSING references — the Wave 0 list above maps to plans `123-01` and
      `123-02`, both harness-only with no `src/` edits.
- [x] No watch-mode flags — `grep -nE 'vitest --watch|--watch\b|playwright test --ui|npm run test:ui'`
      across all 13 plans returns nothing.
- [x] Every control in the Discriminating Controls table is either measured or assigned to a task —
      C1/C2/C7 → `123-01`; C3/C6 → `123-02`; C4 → `123-08`/`11`/`12`; C5 → `123-03`/`08`.
      Independently confirmed by the plan-checker pass recorded in `123-PLAN-REVIEW.md`, which
      checked that each control can actually differ rather than merely having an owner.
- [~] Feedback latency < 15s — **estimate, not a measurement.** Carried from
      `122-CONTRAST-BASELINE.md`'s 12.2/14.3/14.4s timings for the 20-cell matrix; no live
      `dev:noauth` run was timed this session. The D-16 widened 47×4 scan is ~9.4× that cell count
      and has never been run at all. Measure both before treating either figure as fact.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-20 — with the latency row above standing as an explicit estimate.
