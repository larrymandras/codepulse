---
phase: 87
slug: saved-views-temporal-diff
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-23
---

# Phase 87 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 87-01-01 | 01 | 1 | KG-10 | T-87-01/02/03/04 | name length 1..100; exact-match token lookup | unit (tsc) | `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 87-01-02 | 01 | 1 | KG-10 | — | searchQuery excluded from persisted view | unit | `npx vitest run src/hooks/useSavedViews.test.ts` | ❌ W0 | ⬜ pending |
| 87-02-01 | 02 | 2 | KG-10 | — | trash stopPropagation; empty-name no-op | unit | `npx vitest run src/components/kg/KGViewsPopover.test.tsx` | ❌ W0 | ⬜ pending |
| 87-02-02 | 02 | 2 | KG-10 | T-87-05/06/07 | ?view exact-match + silent fallback; ?focus suppressed | unit (tsc + existing) | `npx tsc --noEmit && npx vitest run src/components/kg/KGControls.test.tsx` | ✅ existing | ⬜ pending |
| 87-03-01 | 03 | 3 | KG-11 | T-87-10 | 404 sets error, no throw | unit | `npx vitest run src/hooks/useKgDiff.test.ts` | ❌ W0 | ⬜ pending |
| 87-03-02 | 03 | 3 | KG-11 | T-87-08 | Compare disabled unless From < To | unit (extend) | `npx vitest run src/components/kg/KGControls.test.tsx` | ✅ existing | ⬜ pending |
| 87-03-03 | 03 | 3 | KG-11 | T-87-09 | monotonic token drops stale; Point unchanged | unit (full) | `npx tsc --noEmit && npm test` | ✅ existing | ⬜ pending |
| 87-04-01 | 04 | 4 | KG-11 | T-87-11/12 | frame cap 60; LRU cap 20; client-synth (no endpoint) | unit | `npx vitest run src/hooks/useKgAnimation.test.ts` | ❌ W0 | ⬜ pending |
| 87-04-02 | 04 | 4 | KG-11 | T-87-13 | per-frame error inline, no hard block | unit (full) | `npx tsc --noEmit && npm test` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/useSavedViews.test.ts` — searchQuery exclusion (D-06) + buildShareUrl shape (D-03) [Plan 01]
- [ ] `src/components/kg/KGViewsPopover.test.tsx` — save/load/delete/copy-link/empty-state [Plan 02]
- [ ] `src/hooks/useKgDiff.test.ts` — computeDiff added/removed/changed node sets + independent edge classification (D-10/D-11) + composite-key fallback (Pitfall 6) + 404 degrade (D-08) [Plan 03]
- [ ] `src/hooks/useKgAnimation.test.ts` — frame synthesis from range+interval (D-07) + LRU eviction at 20 (D-09) [Plan 04]

Existing test files extended (not created): `src/components/kg/KGControls.test.tsx` (sub-mode toggle assertions).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Open a `?view=<token>` share link in a fresh tab → restores lens/filters/focus/hops | KG-10 (SC#2) | URL hydration + Convex resolution timing over the live page | Save a view, copy link, open in a new tab, confirm lens + filters + focus + hops are restored; open a bogus `?view=xxx` and confirm silent fallback to default (no error banner) |
| Diff visual treatment over the render layer | KG-11 (SC#3) | Canvas color/alpha distinction is visual | Switch to Temporal → Diff, pick two dates, Compare; confirm green/red/amber/dimmed nodes + DIFF legend |
| Animation scrubbing over render layer | KG-11 (SC#4) | Visual/timing behavior over the force-graph canvas | Switch to Temporal → Animate, set range + interval, Play; observe graph evolution; scrub backward (no re-fetch flicker) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-set (pending execution)
