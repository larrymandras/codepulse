---
phase: 126
slug: page-body-and-convex-read-defect-sweep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 126 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test-infrastructure, coverage and Wave 0 rows are derived from `126-RESEARCH.md`
> §"Validation Architecture", which the orchestrator verified first-hand.
> The Per-Task Verification Map is intentionally unfilled — task IDs do not exist until the
> planner has written the PLAN.md files. The executor fills it as tasks land.
> (Same convention as `125-VALIDATION.md`.)

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit/component) + Playwright **1.61.1** (e2e) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` — both confirmed present at repo root |
| **Quick run command** | `npx vitest run <specific file>` |
| **Full suite command** | `npm test` (Vitest) · `npm run test:e2e` (Playwright) |
| **Estimated runtime** | **Not measured this session — do not quote a figure until it is.** Measure on first wave merge. |

**noauth e2e traps** (from `package.json`'s own `test:e2e:noauth:help` note — inherited by any
spec in this phase that runs noauth): start the noauth server FIRST in its own terminal;
`playwright.config.ts`'s `webServer` is hardcoded to **5173** and **will report itself healthy
while noauth specs target 5181**; issue the empty-string env assignment **from Git Bash, never
PowerShell** (PS 5.1 deletes a var assigned `''`, silently leaving the Clerk gate live).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the file that task touched>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** full Vitest suite green; the e2e specs touched by items 4/6/7
  green; the two-run cold/warm agreement for item 7; PLUS the operator look at the truncation
  markers (see Manual-Only below)
- **Max feedback latency:** per-file runs only; no watch-mode flags anywhere

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(to be filled by the planner/executor — task IDs do not exist yet)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Existing Coverage — including the zeros

| Item | Existing test | Status |
|---|---|---|
| 1. `listHeldUnacked` unbounded (D-03) | `convex/inboxIngest.test.ts` exists; **`convex/inbox.test.ts` does NOT** | **GAP** |
| 2. `/tool-galaxy` chunked blob (D-06-REVISED) | `convex/graphSnapshots.test.ts` | Extend, do not replace |
| 3. Inbox undercount (D-01/D-02) | none for `src/pages/Inbox.tsx` | **GAP** |
| 4. Alert Rules row overlap | `e2e/alerts.spec.ts`; `polish-geometry.spec.ts:495` navigates `/alerts` | Partial — no row-pitch measurement |
| 5. `/automation` | none for `src/pages/Automation.tsx` | **GAP** |
| 6. Sidebar 4px overflow | `e2e/polish-geometry.spec.ts` Block 2 already walks every `<body>` descendant and names the culprit | **Reuse this instrument** |
| 7. Cold-page geometry spec | the spec IS the subject | see below |

**Reference tests to copy for D-03:** `convex/alertsCountBounded.test.ts` (Phase 124's bounded
sibling badge) and `convex/eventsWindow.test.ts` (the 125-02 bounded-read reference).

---

## Wave 0 Requirements

- [ ] `convex/inbox.test.ts` — **must be created**; does not exist, and items 1 and 3 both land in
      that module
- [ ] A component test for `src/pages/Inbox.tsx` covering the D-02 "N of M" / generic-marker branch
- [ ] No framework install needed — both runners and both configs are present

---

## Chunked-Blob Verification (D-06-REVISED) — three properties, each with a failing control

A test asserting only "the page rendered" would not have caught the original defect and must not
be accepted as coverage.

1. **Round-trip fidelity** — rejoin the N chunks; assert the parsed result is deep-equal to what
   was serialized. Assert on the rejoined VALUE, not the absence of a throw.
2. **Read cost** — assert documents read is ~N (chunk count), not 6,591. This is the property that
   actually fixes D-05, and it is invisible to any rendering assertion.
3. **Ordering** — assert reassembly is `seq`-ordered and fails loudly on a gap. Out-of-order
   chunks produce corrupt JSON, not a missing-data error.

Each needs a control that could have come out the other way: a deliberately corrupted,
out-of-order, or gapped chunk set must FAIL. A guard that cannot fire is indistinguishable from
one never violated.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Truncation markers (D-01/D-02) are legible and do not mislead a reader | criterion 2 | D-01/D-02 exist precisely to stop a human misreading two numbers. A passing string-match does not establish that a person reading the tabs is no longer misled. | Open `/inbox` with the sidebar visible. Read the badge and the Held tab together. Confirm the two numbers either agree or the capped one visibly says so — and that the marker is noticeable without being told where to look. |

**Everything else is automatable and must be automated**, including criterion 2's numeric half:
one spec reading BOTH the sidebar badge and the Held tab in a SINGLE page state and asserting they
reconcile. Reading them in separate runs structurally cannot catch a contradiction.

**Precedent for splitting this table honestly — Phase 125-13:** every automated assertion there
passed against a signal a human could not actually see.

---

## Item 7 — verification prescribed by its own todo; do not simplify

`.planning/todos/pending/polish-geometry-spec-measures-cold-page.md` requires: run the spec twice,
cold and warm, and assert the two measurements **agree**. That agreement IS the test — a single
passing run cannot distinguish "the race is fixed" from "the race did not fire this time."

The defect **inverts** a conclusion rather than blurring it: at 375px cold reads 268 (under the 327
available), settled reads 366.2 (39px over). Fix by waiting on `SystemChip` and `BrainHeaderBadge`
actually rendering — **not** a bare timeout. Note the spec's assertion is `culprits.length === 0`,
so it passes correctly today: this is an EVIDENCE defect, and "the test is green" is not a reason
to skip it.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Chunked-blob controls proven to FAIL on corrupted/out-of-order/gapped input
- [ ] Operator look at the truncation markers recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
