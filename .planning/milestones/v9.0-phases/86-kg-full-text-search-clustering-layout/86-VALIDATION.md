---
phase: 86
slug: kg-full-text-search-clustering-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 86 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Validation Architecture detail lives in `86-RESEARCH.md` (SC#1–SC#4 verification plan).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) |
| **Config file** | `vitest.config.ts` (setup: `src/test/setup.ts` — mocks Recharts/Three/Globe/React Flow/Tone) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npm test` |
| **Type check** | `npx tsc --noEmit` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>` + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite green + manual on-real-data checks below
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | KG-08 / KG-09 | — | — | unit | `npx vitest run` | — | ⬜ pending |

*Planner/Nyquist auditor fills concrete task rows. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing Vitest infrastructure covers unit-testable surfaces (palette mapping, gate predicate `nodes.some(n => n.community != null)`, fetchSearch error-gating, search→focus URL building).

*The d3-force spatial clustering and live-endpoint search are manual-only (see below).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Search returns fact-text/relationship matches distinct from entity-name search (SC#1) | KG-08 | Requires live `/api/kg/search` on Ástríðr | With endpoint live, type a term in the Search lens; confirm results hit fact text + relationship labels, distinct from entity-name results |
| Search graceful-degrade when endpoint absent (SC#2) | KG-08 | Endpoint does not exist yet; tests the designed "not available" state | With endpoint absent (today), confirm Search lens shows info copy (not a stack trace) and entity-name fallback still works |
| Result-click centers subject entity in Entity (ego) lens (D-02) | KG-08 | Visual graph focus behavior | Click a result row; confirm graph centers the subject entity and switches to ego lens |
| Community clustering renders on code/vault graph (SC#3) | KG-09 | Visual d3-force layout + halo color | On real Convex data, confirm co-community nodes are spatially grouped + halo-colored, community legend visible |
| No-regression fallback for graphs without `community` (SC#4) | KG-09 | Visual layout regression check | On a graph with no `community`, confirm existing force-directed layout, legend absent, no layout regression |

*Verification bar (global rule): "done" = observed in the running app on real Convex/Ástríðr data, not assumed.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (or are listed Manual-Only with reason)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
