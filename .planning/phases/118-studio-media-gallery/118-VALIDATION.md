---
phase: 118
slug: studio-media-gallery
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-13
completed: 2026-08-16
---

# Phase 118 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `118-RESEARCH.md` § Validation Architecture.
> **No REQ-IDs exist for this phase** — rows are keyed by decision ID (`D-01`..`D-16`),
> which are the acceptance-bearing units per `118-CONTEXT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (unit — `convex/**/*.test.ts`, `hooks/__tests__/*.test.mjs`) + Playwright 1.61.1 (E2E — `e2e/*.spec.ts`) |
| **Config file** | `vite.config.ts` (Vitest config lives inside it, per this repo's convention) / `playwright.config.ts` |
| **Quick run command** | `npx vitest run <specific-file>` |
| **Full suite command** | `npm test` (Vitest) + `npm run test:e2e:noauth` (Playwright, Clerk-disabled) |
| **Estimated runtime** | ~90s Vitest full suite; ~20s for a single `e2e/studio.spec.ts` run |

---

## Sampling Rate

- **After every task commit:** `npx vitest run <the file this task touched>`
- **After every plan wave:** `npm test` (full Vitest suite). This repo's baseline is ~310 files /
  ~4,100+ tests passing — **a drop in that count is itself a signal**, per this repo's established
  convention of quoting before/after suite totals in plan summaries.
- **Before `/gsd:verify-work`:** full Vitest suite green **and** `npx playwright test e2e/studio.spec.ts`
  green **and** `npx tsc --noEmit` clean.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is keyed by decision until plans exist, then
extended with `{plan}-{task}` IDs during execution.

| Decision | Plan | Wave | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-01 | 118-01 | 1 | Upload round-trip returns HTTP 200 + non-zero body, **paired with the known-null control** (an orphaned `avatars` storage ID must still resolve `null` in the same run) | — | N/A | integration (live-stack proof, not unit-mockable) | scripted probe against the running backend, captured as `118-D01-EVIDENCE.md` | ✅ exists | ✅ green |
| D-02 | 118-08 | 5 | Every thumbnail in a produced `media` row is ≤200 KB; the browser never requests the original | T-118-03 | Refuse rather than upload oversized — cap enforced **before** any upload is attempted | unit (encoder-loop logic) + live assertion during D-09 proof rounds | `npx vitest run hooks/__tests__/studioWatch.test.mjs` | ✅ exists | ✅ green |
| D-03 | 118-03 | 2 | The three new tables are **absent** from `RETENTION_DAYS` and carry the exemption comment | — | N/A | unit | `npx vitest run convex/media.test.ts` | ✅ exists | ✅ green |
| D-05, D-06 | 118-07, 118-08 | 2, 5 | Content-hash dedup: rescanning an unchanged vault produces **zero writes**; a renamed/moved file with unchanged bytes still dedups | — | N/A | unit | `npx vitest run hooks/__tests__/studioWatch.test.mjs` | ✅ exists | ✅ green |
| D-07 | 118-04, 118-10, 118-11 | 3, 5, 6 | A file with no sidecar renders **"No provenance recorded"** — never blank, never inferred from filename | T-118-05 | Malformed/absent sidecar is a *defined state*, never a thrown error that skips the file | unit (query logic) + component test | `npx vitest run convex/media.test.ts` + `npx vitest run src/pages/Studio.test.tsx` | ✅ exists | ✅ green |
| D-08 | 118-06, 118-11 | 5, 6 | Soft-delete sets `deletedAt` and hides the row immediately; watcher moves `gen\`→`trash\`; Restore reverses both; 30-day janitor deletes blob + row + file **together** | — | N/A | unit (mutation + janitor batch logic) + integration (file-move, real fixture dir) | `npx vitest run convex/media.test.ts` + `npx vitest run hooks/__tests__/studioWatch.test.mjs` | ✅ exists | ✅ green |
| D-09 | 118-12, 118-13, 118-14 | 7, 8, 9 | One asset from **each** proven backend appears in the gallery with complete provenance within one watcher cycle | — | N/A | integration (live-stack, per-generator proof rounds) | scripted, captured as plan evidence | ✅ exists | ✅ green |
| D-15 | 118-05 | 4 | Unauthenticated POST to the ingest route **401s before touching the db**; no OPTIONS/CORS partner | T-118-01 | Fail-closed bearer check as the first statement in the handler | unit | `npx vitest run convex/studioHttp.test.ts` | ✅ exists | ✅ green |
| D-16 | 118-10 | 5 | `/studio` reachable from the COMMAND nav group via a **real click-through**, not a route-exists assertion | — | N/A | E2E | `npx playwright test e2e/studio.spec.ts` | ✅ exists | ✅ green |
| Pitfall 4 | 118-04, 118-05 | 3, 4 | Ingest / janitor / storage-URL functions are `internalMutation`; only star / soft-delete / restore are public `mutation` | T-118-02 | The declaration-level split **is** the access-control boundary | unit | `npx vitest run convex/media.test.ts` | ✅ exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Control-Pair Requirement (non-negotiable)

`118-CONTEXT.md` `<specifics>` and this project's standing rule: **every gate is a control pair.**
A passing assertion that would look identical when the mechanism is broken is not evidence.
Concretely, these three pairs are mandatory and a plan may not substitute a single assertion:

1. **D-01:** successful upload round-trip **paired with** the known-null orphaned `avatars`
   storage ID resolving `null` in the same run.
2. **D-07:** a card with a **complete** recipe rendered **in the same grid view** as a
   sidecar-less file rendering "No provenance recorded".
3. **D-08:** soft-deleted row **absent from Gallery**, **present in Trash**, and **restored** —
   the design doc's own gate stops at the first two.

---

## Wave 0 Requirements

- [x] `hooks/__tests__/studioWatch.test.mjs` — D-05/D-06 (hashing/dedup), D-07 (sidecar pairing +
      absence), D-02 (encoder-loop cap logic), D-08 (file-move halves)
- [x] `convex/media.test.ts` — D-03 (no `RETENTION_DAYS` key + exemption comment present), D-07
      (query-side provenance), D-08 (mutation halves + janitor batch shape), Pitfall 4
      (`internalMutation` vs `mutation` split)
- [x] `convex/studioHttp.test.ts` — D-15 (fail-closed auth, no CORS/OPTIONS). **Donor resolved
      2026-08-13: `convex/workspaceHttp.test.ts`, NOT `loomHttp.ts`** — `convex/loomHttp.ts` exists
      but ships no test file (control: `convex/workspaceHttp.test.ts` exists, so the check
      discriminates). `workspaceHttp.test.ts` demonstrates the control-first auth-gate pattern,
      field validation, and the plain-handler / `httpAction`-wrapped split that makes a Convex http
      route testable under Vitest at all.
- [x] `e2e/studio.spec.ts` — D-16 nav reachability + the control-paired D-07 and D-08 assertions above
- [x] Framework install: **none needed** — Vitest and Playwright are both already configured

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| Convex storage upload round-trip | D-01 | Requires the live self-hosted backend; not unit-mockable. Mirrors Phase 116's `116-05` blocking-deploy wave. | Run the scripted probe against `127.0.0.1:3210`; capture HTTP status, body length, and the paired null-control result into `118-D01-EVIDENCE.md`. |
| Per-backend generation proof rounds | D-09 | Real credits, real external services, non-deterministic output. | For each proven backend: generate → confirm file + sidecar land in `media-vault\gen\` → wait one watcher cycle (or run `/studio-sync`) → confirm the row appears with complete provenance. Capture as plan evidence. |
| Scheduled-task registration | D-04, D-14 | Machine state, not repo state — cannot be asserted by any in-repo test. | After registering: verify **no AC-power condition** is set and the action launches via `run-hidden.vbs`. Then trigger the task and confirm it actually ran (`LastTaskResult` is unreliable — assert on the observable side effect, a real ingest or a `backup.log` line). |
| OpenArt MCP tool enumeration | D-09 amendment | The tool surface only materialises post-authentication. | Authenticate the hosted OpenArt MCP, enumerate the tools that appear, and record whether real generation tools exist. **This outcome gates which third-leg implementation task runs** — resolve it before that task starts. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all ❌ MISSING references above
- [x] No watch-mode flags in any command
- [x] Feedback latency < 90s
- [x] All three mandatory control pairs present in the plans
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** SIGNED OFF 2026-08-16 at plan `118-15` Task 3, after `118-14` closed D-09.

**Measured, not assumed.** Each box above was checked against something:

- *All tasks have an automated verify* — **45 of 45** tasks across all 15 plans carry an
  `<automated>` block. Controls: a `<nonexistent_tag>` probe returns 0/45, so the parser
  discriminates rather than matching everything; and phase 113 returns 24/24, so 45/45 is this
  project's planning standard rather than an artifact of this phase.
- *No 3 consecutive tasks without an automated verify* — the longest consecutive run without one
  is **0**.
- *Wave 0 covers all ❌ MISSING references* — all four files exist:
  `hooks/__tests__/studioWatch.test.mjs`, `convex/media.test.ts`, `convex/studioHttp.test.ts`,
  `e2e/studio.spec.ts`.
- *All three mandatory control pairs* — individually asserted and pointed at in
  `118-GATE-EVIDENCE.md` § Mandatory control pairs, and machine-checked by
  `scripts/check-118-15-task3.mjs` (which fails if any one of D-01 / D-07 / D-08 is not
  individually claimed).

**One honest caveat, recorded rather than smoothed over.** "Has an `<automated>` block" is a
statement about PRESENCE, not about the check being meaningful. This phase found **nine** checks
that passed while blind to the very thing they existed to assert — including two of its own
`<automated>` verifies, and one module that exited 0 having done nothing. So 45/45 is the Nyquist
rule satisfied as written, and it is not a claim that all 45 checks are individually sound. What
supports the roll-up's PROVEN verdicts is the mutation evidence attached to each, not this count.
