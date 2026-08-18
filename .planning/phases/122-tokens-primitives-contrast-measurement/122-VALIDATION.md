---
phase: 122
slug: tokens-primitives-contrast-measurement
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-18
approved: 2026-08-18
---

# Phase 122 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `122-RESEARCH.md` § Validation Architecture (line 571).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest 4.1.9 — `vitest.config.ts`, `environment: 'jsdom'`. Node built-ins (`child_process`) work regardless of jsdom; confirmed by the existing `src/pages/Analytics.structuralGuard.test.ts` precedent. |
| **E2E framework** | Playwright 1.61.1 — `playwright.config.ts`. Two server targets: the Clerk-gated `chromium` project (5173, default) and the manually-started `dev:noauth` server (5181). |
| **Quick run command** | `npx vitest run <touched-file>.test.ts` |
| **Full suite command** | `npx vitest run` |
| **E2E contrast command** | `PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts` (run from Git Bash with `dev:noauth` already up) |
| **Full E2E command** | `npm run test:e2e:noauth` |
| **Estimated runtime** | **Unmeasured.** Wave 0 must record the real figure — no number is asserted here rather than fabricating one. |

**A11Y-01 server requirement:** any *real* contrast measurement must run against `dev:noauth` on 5181. Against the gated 5173 server, `e2e/theme-contrast.spec.ts`'s `fee96b5d` guard calls `test.skip()` — which is correct behaviour (skip beats a vacuous pass) but produces **no measurement**. A green run on the wrong port measures nothing.

---

## Sampling Rate

- **After every task commit:** targeted `npx vitest run <touched-file>.test.ts` for primitive/hook changes; a `git grep -F` spot-check of the exact pattern just swept for the surface/motion/violet/badge sweep tasks.
- **After every plan wave:** full `npx vitest run` (fast — no browser) including the corpus ratchet.
- **Before `/gsd:verify-work`:** full Vitest suite green · `theme-contrast.spec.ts` run against `dev:noauth` (before-baseline diffed, after-measurement captured) · `theme-reduced-motion.spec.ts` green **with its must-differ control** · D-27's rendered-result spec green · `npx tsc --noEmit` clean · `npm run build` exit 0.
- **Max feedback latency:** unit path — to be measured in Wave 0; E2E path is browser-bound and runs at wave boundaries only, not per task.

---

## Per-Requirement Verification Map

Task IDs are assigned by the planner; this map fixes the *behavior → proof* pairing that each task must inherit.

| Requirement | Behavior proved | Test type | Command | Artifact exists? |
|---|---|---|---|---|
| TOKEN-01 | No hardcoded palette class or hex literal remains outside `KNOWN_EXEMPT` | unit (corpus ratchet) | `npx vitest run <ratchet>` | ❌ new (D-25) |
| TOKEN-01 | `--surface-0/1/2/3` render as four **distinct** colours per theme, and body actually paints `--surface-0` | E2E (rasterised) | `npx playwright test e2e/theme-rendered-result.spec.ts -g "distinct surfaces"` | ❌ new (D-27) |
| TOKEN-02 | `--status-ok` perceptibly separated from `--primary` in all 5 themes | E2E (rasterised, named pair) | `... -g "status-ok"` | ❌ new (D-22) |
| TOKEN-02 | Forge `failed` pairing clears 4.5:1 measured **against `--card`**, not the page background | E2E (rasterised, named pair) | `... -g "forge failed"` | ❌ new (D-06) |
| TOKEN-02 | `--astridr` appears only on Ástríðr-owned surfaces; no raw violet elsewhere | unit (corpus ratchet bucket) | same ratchet file | ❌ new (D-08) |
| TOKEN-03 | `grep -rE 'duration-[0-9]' src/` returns zero | unit (corpus ratchet bucket) | same ratchet file | ❌ new (D-09/D-10) |
| TOKEN-03 | No element reports non-zero animation/transition under `prefers-reduced-motion`, **paired with a control run that must show motion** | E2E | `npx playwright test e2e/theme-reduced-motion.spec.ts` | ✅ exists — extend (D-11/D-12) |
| TOKEN-04 | `useMetricState` + tile cover all six states | unit | `npx vitest run src/hooks/useMetricState.test.ts` | ❌ new (D-14) |
| TOKEN-04 | No bare `>Loading` or confident `—` remains outside named exemptions | unit (corpus ratchet bucket) | same ratchet file | ❌ new (D-15) |
| TOKEN-05 | Every route uses `PageHeader` except **named** exemptions | unit (corpus ratchet bucket) | same ratchet file | ❌ new (D-18) |
| A11Y-01 | Full 4×5 matrix measured **before and after**, per-cell JSON committed | E2E (existing spec, run twice) | `npx playwright test e2e/theme-contrast.spec.ts` vs `dev:noauth` | ✅ exists — run-and-record (D-21/D-23) |
| A11Y-01 | The `fee96b5d` skip-not-pass guard still fires after the token rewrite | E2E (guard regression) | run the same spec against gated 5173, confirm `test.skip()` fires | ✅ exists — assert the skip |

---

## Wave 0 Requirements

- [ ] **A11Y-01 "before" capture** — run the 4×5 matrix and commit the per-cell JSON **before any `src/index.css` edit lands** (D-21/D-28). This is the control; without it a token rewrite that worsened contrast is indistinguishable from one that fixed it.
- [ ] **Corpus-derived ratchet test file** (D-25) — does not exist. Structural precedent: `src/pages/Analytics.structuralGuard.test.ts`.
- [ ] **`src/hooks/useMetricState.ts` + test** (D-14) — new.
- [ ] **`e2e/theme-rendered-result.spec.ts`** (D-27) — new; rasterised assertions with the pre-phase git-state control.
- [ ] **Record the unit-suite runtime** so the max-feedback-latency figure above stops being unmeasured.

---

## Control Requirements (phase-specific, non-negotiable)

This phase's decisions mandate controls at three separate points. A measurement without its control is not evidence:

1. **D-12** — the reduced-motion population assertion must be paired with the same page *without* the media override, which **must** show motion. Otherwise a green means "the probe measured nothing".
2. **D-21** — the contrast measurement runs before *and* after the token work; the delta is the finding, not the after-figure.
3. **D-26/D-27** — the ratchet is proven by **two** mutations, and the second is the one that matters: a violation introduced in a file appearing on **no** list must also fail. Both mutations must be **syntactically valid**, so an import/collection error can never be mistaken for a real red.

**Colour measurement law:** never parse computed colour strings. Tailwind v4 emits `oklch()`/`oklab()`, and a regex scrape reads the hue angle as a channel. Rasterise via canvas `getImageData`; `canvas.fillStyle` silently keeps its prior value on unparseable input, so use a sentinel and return `null` rather than a guess.

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|---|---|---|---|
| `emerald`'s hue-separated `--status-ok` reads as a *state* colour, not a second brand colour | TOKEN-02 (D-05) | Perceptual separation within a green-primary theme is a judgement call the AA ratio does not capture | Load `/` under `emerald`, confirm a success badge is not mistaken for a primary action |
| `amber` receives the full token set but stays out of the switcher and out of the contrast matrix | TOKEN-01 (D-04) | An unreachable theme cannot be measured against a rendered page | Confirm `src/index.css` defines the ramp for `amber` and that `ThemeSwitcher` still lists 4 |

---

## Sampling Limit (must be stated in the phase artifact)

A11Y-01 measures **4 themes × 5 pages**. Re-derived 2026-08-18: `src/pages/` holds **42** top-level non-test pages plus **5** in `src/pages/hr/` = **47** (`src/pages/__tests__/` excluded; control — the same glob including tests returns 62). So **5 of ~47 routes are measured** and the unmeasured routes must be **named** in `122-CONTRAST-BASELINE.md`, in this phase's verification, and in Phase 123's scope (D-24). Phase 123's success criterion is "zero violations across every cell A11Y-01 measured" — so an unmeasured route can be broken while 123 reports green. No silent caps.

---

## Validation Sign-Off

Checked items were verified by `gsd-plan-checker` against the 19 plans on 2026-08-18. Unchecked
items are genuinely outstanding and are **not** to be ticked until the thing itself is done.

- [x] All tasks have an automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all ❌ references above
- [x] No watch-mode flags
- [ ] Unit-suite feedback latency measured and recorded — **outstanding**, Wave 0 (`122-01`) records it; the runtime figure above is still marked unmeasured
- [x] Every measurement above ships with its control (see Control Requirements)
- [x] `nyquist_compliant: true` set in frontmatter

`wave_0_complete` stays `false` until `122-01` executes — planning approval is not execution.

**Approval:** approved 2026-08-18 (plan-checker: VERIFICATION PASSED, 19/19 plans)
