---
phase: 89
slug: readable-themes-editorial-skin-toggle
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-24
validated: 2026-06-26
---

# Phase 89 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 89-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit framework** | Vitest `^4.0.18` (jsdom) |
| **e2e framework** | `@playwright/test ^1.58.2` (chromium) |
| **Config file** | `playwright.config.ts` (e2e) · `vitest` config in repo (unit) |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | unit ~10s · e2e ~60–120s (20 theme×surface axe cases) |

**Wave 0 install:** `npm install --save-dev @axe-core/playwright` (not currently in package.json — required for TH-06).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (unit only, ~10s)
- **After every plan wave:** Run `npm run test:e2e` (full e2e incl. contrast)
- **Before `/gsd:verify-work`:** Full e2e green — zero axe violations across all 20 theme×surface combinations
- **Max feedback latency:** ~10s (unit) per commit; ~120s (e2e) per wave

---

## Per-Task Verification Map

| Req | Behavior | Wave | Test Type | Automated Command | File Exists |
|-----|----------|------|-----------|-------------------|-------------|
| TH-01 | `useThemeColors()` resolves tokens to hex/rgba; re-resolves on `data-theme` mutation | hook | unit | `npx vitest run src/hooks/useThemeColors.test.ts` | ✅ |
| TH-01 | Canvas graphs render theme colors (no hardcoded `#06b6d4`/`#10b981`) — DOM-level via Graphs contrast cases; pixel legibility manual | canvas | visual e2e + token-read assertion | `npm run test:e2e e2e/theme-contrast.spec.ts` | ✅ (DOM) ⬜ canvas→manual |
| TH-02 | Readable Dark WCAG-AA contrast on 5 surfaces; no glow/CRT over text | themes | e2e axe | `npm run test:e2e e2e/theme-contrast.spec.ts` | ✅ |
| TH-03 | Midnight Aubergine WCAG-AA contrast on 5 surfaces; paper-grain + ambient gradient render | themes | e2e axe + visual | `npm run test:e2e e2e/theme-contrast.spec.ts` | ✅ (axe) · grain manual |
| TH-04 | Cyan + Emerald retain WCAG-AA contrast on 5 surfaces | themes | e2e axe | `npm run test:e2e e2e/theme-contrast.spec.ts` | ✅ |
| TH-05 | No FOUC on hard refresh — `data-theme` set before first paint by inline script | switcher | e2e (hard reload, assert attr on domcontentloaded) | `npm run test:e2e e2e/theme-no-fouc.spec.ts` | ✅ |
| TH-05 | `"theme"` key migrated → `"codepulse-theme"` (`light`→`readable`), old key deleted | switcher | unit | `npx vitest run src/components/ThemeSwitcher.test.tsx` | ✅ |
| TH-05 | `prefers-reduced-motion` hides `.matrix-bg`, scanline bar, aubergine pseudo-elements | themes | e2e (`emulateMedia reducedMotion`) | `npm run test:e2e e2e/theme-reduced-motion.spec.ts` | ✅ |
| TH-06 | Zero axe WCAG-AA violations: 4 themes × 5 pages = 20 cases | themes | e2e axe | `npm run test:e2e e2e/theme-contrast.spec.ts` | ✅ (20/20) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `npm install --save-dev @axe-core/playwright` — TH-06 dependency (installed: `@axe-core/playwright ^4.12.1` in package.json)
- [x] `e2e/theme-contrast.spec.ts` — TH-02, TH-03, TH-04, TH-06 (20 cases via `addInitScript` setting `codepulse-theme` before nav) — 20/20 green
- [x] `e2e/theme-no-fouc.spec.ts` — TH-05 pre-paint verification (assert `data-theme` set on `domcontentloaded`) — 2 cases green
- [x] `e2e/theme-reduced-motion.spec.ts` — TH-05 reduced-motion suppression — 2 cases green
- [x] `src/hooks/useThemeColors.test.ts` — TH-01 hook unit tests (mock `getComputedStyle`, assert hex output + MutationObserver re-resolve) — 8 tests green
- [x] `src/components/ThemeSwitcher.test.tsx` — TH-05 key migration unit test — 6 tests green

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas graph node-label contrast | TH-01/TH-06 | axe-core cannot audit `<canvas>` pixels (react-force-graph-2d) | Navigate `/graphs` per theme; visually confirm node/label legibility against background |
| Aubergine paper-grain & ambient gradient look | TH-03 | Subjective rendering quality of SVG turbulence noise | Hard-refresh on aubergine; confirm grain is subtle (opacity ~0.025) and gradients read as warm editorial, not muddy |
| No visible flash on hard refresh | TH-05 | Human-perceptible flicker not fully captured by attr assertion | Hard-refresh (Ctrl+Shift+R) on `readable`/`aubergine`; confirm no cyan flash before settle |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`@axe-core/playwright` + 4 spec/test files) — all present
- [x] No watch-mode flags (use `vitest run`, not `vitest`)
- [x] Feedback latency < 120s (e2e ~11s), < 15s (unit ~2s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-26 — all automated coverage green, no gaps.

---

## Validation Audit 2026-06-26

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Result:** Phase 89 is **Nyquist-compliant**. All 6 requirements (TH-01–TH-06) have automated verification that runs green.

| Suite | Result | Runtime |
|-------|--------|---------|
| `npx vitest run src/hooks/useThemeColors.test.ts src/components/ThemeSwitcher.test.tsx` | 14/14 passed | ~2s |
| `npm run test:e2e e2e/theme-contrast.spec.ts e2e/theme-no-fouc.spec.ts e2e/theme-reduced-motion.spec.ts` | 24/24 passed | ~11s |

All Wave 0 deliverables (4 spec/test files + `@axe-core/playwright`) were created during phase execution — the draft's `❌ W0` markers are now resolved to `✅`. The 3 Manual-Only items (canvas pixel legibility, aubergine grain quality, perceptible FOUC flash) remain genuinely outside automated reach; operator sign-off was recorded 2026-06-24 per 89-07-SUMMARY.md and 89-VERIFICATION.md.
