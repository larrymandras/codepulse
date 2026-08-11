---
phase: 113
slug: debt-sweep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 113 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `113-RESEARCH.md` § Validation Architecture (:323-338).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom), Playwright for e2e |
| **Config file** | `vitest.config.ts` (`globals: true` at :14 — load-bearing for D-08, see below) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | **37.98s** — measured 2026-08-11, not estimated (298 files passed, 3958 tests, 193 todo, 0 failures) |
| **Type check** | `npx tsc --noEmit` (exit 0 at last measurement) |

**No `--repeat` flag exists** on the installed Vitest (confirmed by research via a known-invalid-flag control). DEBT-06's soak is therefore a shell loop.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched test file>`
- **After every plan wave:** `npx vitest run` (full suite, ~38s)
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` exit 0
- **Max feedback latency:** 40 seconds

---

## Per-Task Verification Map

*Populated by the planner — tasks do not exist yet at VALIDATION.md creation time.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DEBT-05 / 06 / 07 | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Observable Outcomes and Their Controls

**This section is the heart of the contract.** Per this project's verification rules, every check below asserts a real observable — never a proxy signal (flag, counter, log line) — and every check is paired with a control that proves it could have failed.

### DEBT-05 — prune safety

- **Observable:** After a simulated partial/transient scan (plugin sub-source deliberately made to fail), the live `skills` table's plugin-origin **row count is unchanged**, read via `listSkillOrigins`/`listSkills`. Not a mutation return value, not a log line, not a counter.
- **Control (required):** Run the identical simulated-partial-scan input against the **pre-fix / guard-omitted** path and confirm the plugin rows **do** get deleted — i.e. reproduce the 185→131→185 shape on unguarded logic first. A guard that has never been shown to be load-bearing is not validated.
- **Regression test to add:** `convex/__tests__/skillSync.test.ts` already holds the inverse shapes (`REGRESSION: a declared-but-empty origin… prunes all its rows`, `backward-compat: omitting scannedOrigins reproduces the legacy… result`). Add the missing assertion: an origin **not declared** in `scannedOrigins`, absent from incoming, but previously fully present, **survives**.
- **Backward-compat observable:** `native`/`bridge` are producers we do not control and will keep sending the legacy shape. Assert explicitly that a legacy-shape snapshot does **not** become permanently unprunable — a guard that silently freezes astridr's 410 rows forever is a regression wearing a fix's clothes.

### DEBT-05 — frontend companion (D-17)

- **Observable:** The Skills page's "Global" chip **count** and filtered **list** actually include plugin-originated skills, asserted by Testing-Library query on rendered output — not on a mocked origin list.
- **Control (required):** Render a plugin-origin skill **before** the frontend fix and confirm it is **absent** from the Global results (reproducing the regression), then confirm presence after. Verified coupling sites: `src/pages/Skills.tsx:132`, `:148`; `src/lib/skills.ts:69`, `:125`, `:131`, `:165`; `src/components/skills/SkillLifecycleMenu.tsx:88`; `src/components/OriginBadge.tsx:6`. `src/lib/skillVault.ts:12` is safe by design (maps anything else → global) and needs no change.

### DEBT-06 — flake capture

- **Observable:** The literal rendered `textContent` of the brain-pill label, via the existing assertion `expect(labelBefore).toBe("anthropic-sonnet-5")` (`src/pages/Chat.test.tsx:585-586`), **unchanged**. Per D-11: no widened `waitFor`, and no reshaping the assertion to read source data instead of rendered text — that is a mask wearing a different hat.
- **Control (already executed):** A deliberately-mismatched expected value produced `Expected: "DELIBERATE_CONTROL_MISMATCH_9x7q2"` / `Received: "anthropic-sonnet-5"`, proving the assertion can catch a real mismatch and that Vitest retains the actual text. File restored byte-exact.
- **Instrumentation acceptance (D-08 as amended):** The first captured DOM dump must come from a **deliberate control** and be **non-empty**. An empty dump is a bug in the instrumentation, never evidence the DOM was empty at test time. Capture at the query site — a global `onTestFailed` hook always fires after Testing Library's auto-`cleanup()` and would capture an empty body.
- **Soak observable:** "0 failures across N full-suite runs" as a **real per-iteration count**, not one loosely-read exit code. Each iteration's pass/fail appends to a log so a failure at iteration 23 of 30 is not overwritten by iteration 30's success. Budget: **30 iterations (~19 min), then 50 more (~32 min) only if tier 1 is clean.** Stop immediately on reproduction.
- **Exit bar (D-10):** If it does not reproduce within budget, ship the instrumentation and close as **GUARDED** — and amend DEBT-06's wording in `REQUIREMENTS.md` to match what was delivered. A guarded close must not be recorded as "root-caused".

### DEBT-07 — reproducible checkout

- **Observable:** A `git clone` into a temp dir followed by the checked-in preflight script exits 0, **and each individual check is independently visible** (files present, `docker compose config --quiet` exit code, key-name parity between `.example` and the real env file) — not one aggregate boolean.
- **Control (required):** Deliberately break one thing in the temp clone (rename `docker-compose.yml`, or drop one key from a copy) and confirm the preflight reports **that specific failure**. A preflight never shown to fail is not a check.
- **Secret-exposure checkpoint:** Before the first commit, review staged content to confirm no literal secret value appears — covering `INSTANCE_SECRET` (`docker-compose.yml:89`, per D-18), `admin-key.txt`, and `selfhosted.envfile`. Operator checkpoint, explicitly a plan task.
- **Ordering constraint:** `.gitignore` must exist **before** any `git add`. D-15's measured bulk (`backups/` 22 GB, `migration/` 1.5 GB, `rebuild/` 721 MB) means a premature `git add -A` would stage ~24 GB.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — Vitest, jsdom, and `convex/__tests__/skillSync.test.ts` are all in place. No framework install needed.

- [ ] No new test framework required
- [ ] `convex/__tests__/skillSync.test.ts` — extend with the DEBT-05 survival regression (file exists)
- [ ] DEBT-07's preflight script is itself a new checked-in artifact in the *separate* repo, not in codepulse

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Staged-content secret review before first commit | DEBT-07 / D-18 | Judgment call on what constitutes a secret; not automatable within this phase's scope | `git diff --cached` on the initial commit; confirm no literal value for `INSTANCE_SECRET`, admin key, or env values |
| Skills page visual confirmation after the origin migration | DEBT-05 / D-17 | Automated tests assert counts; a human confirms the tab renders as expected | Load the Skills page, confirm the Global tab count includes plugin skills and drag-and-drop works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 40s
- [ ] Every observable above is paired with an executed control
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
