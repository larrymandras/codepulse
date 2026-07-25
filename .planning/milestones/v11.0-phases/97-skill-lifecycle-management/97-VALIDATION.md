---
phase: 97
slug: skill-lifecycle-management
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-17
---

# Phase 97 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Cross-repo phase: `forge` (daemon, primary engineering) + `codepulse` (adapter/report). `skill-intake`'s `--write` path is already complete and tested — no code changes expected there.

---

## Test Infrastructure

| Repo | Framework | Config file | Quick run command | Full suite command | Est. runtime |
|------|-----------|-------------|-------------------|--------------------|--------------|
| **forge** | Vitest | `vitest.config.ts` | `npx vitest run src/process/intake-exec.test.ts src/emit/command-poller.test.ts` | `npm test` | ~10–20s |
| **codepulse** | Vitest | `vite.config.ts` | `npx vitest run convex/forge.test.ts` | `npm test` | ~30–60s |
| skill-intake | pytest | `pyproject.toml` | `uv run pytest tests/ -k admit` | `uv run pytest` | (no changes expected) |

---

## Sampling Rate

- **After every task commit:** Run the changed repo's quick-run command (forge or codepulse, whichever file changed).
- **After every plan wave:** Full suite in whichever repo(s) that wave touched; cross-repo waves need **both** forge's and codepulse's full suites green.
- **Before `/gsd:verify-work`:** Full suite must be green in **both** forge and codepulse.
- **Max feedback latency:** ~60 seconds (codepulse full suite is the ceiling).

---

## Per-Task Verification Map

> Task IDs are assigned during planning. Seeded from RESEARCH.md's requirement→test map; the planner fills exact Task IDs, plan, and wave.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DAEMON-01 | T-97-V12 | `buildAdmitArgs` appends `--write` + conditional `--allow-unrecoverable` for global/project; never for cold | unit | `npx vitest run src/process/intake-exec.test.ts` (forge) | ✅ needs new cases (W0) | ⬜ pending |
| TBD | TBD | TBD | DAEMON-01 | — | `mapExitCodeToResult` classifies exit codes 4–9 (currently only 0–3); refusal reason read from **stdout** not stderr | unit | `npx vitest run src/process/intake-exec.test.ts` (forge) | ✅ needs new cases (W0) | ⬜ pending |
| TBD | TBD | TBD | INTAKE-04 | T-97-V5 | Collision (exit 5) surfaces the actionable D-07 copy pattern; no partial directory left on disk | unit + manual | `npx vitest run convex/forge.test.ts` (codepulse, if adapter lands server-side) + live UAT | ⚠ adapter location TBD (W0) | ⬜ pending |
| TBD | TBD | TBD | INTAKE-03 / DAEMON-03 | — | Rescan snapshot builder produces a valid `registry.syncInventory`-shaped payload (upsert by name+origin, per-origin prune) | unit | new test file (forge) | ❌ module does not exist (W0) | ⬜ pending |
| TBD | TBD | TBD | INTAKE-03 | — | Post-rescan, Skills page reflects new skill with no manual refresh | manual | live UAT (relies on existing reactive `useQuery`) | N/A | ⬜ pending |
| TBD | TBD | TBD | INTAKE-01 / INTAKE-02 | T-97-V5/V12 | Live end-to-end: real file lands on disk at correct scope (global/project/cold) | operator checkpoint | manual round-trip w/ live daemon | N/A | ⬜ pending |
| TBD | TBD | TBD | DAEMON-04 | T-97-V4 | `supportedTypes`/`resolveClaimTypes` advertises `intake` (already shipped — regression guard only) | unit | `npx vitest run src/emit/command-poller.test.ts` (forge) | ✅ shipped | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `forge/src/process/intake-exec.test.ts` — extend with cases for `--write` / `--allow-unrecoverable` argv construction and exit-code-4–9 classification (file exists, needs new `describe` blocks).
- [ ] New forge module + test file for the DAEMON-03 rescan snapshot builder (module does not exist yet — name/location is a plan-phase decision; `skill-intake`'s `report_query.scan()` is ledger-scoped, NOT a full directory walk, so it is insufficient).
- [ ] Decide + scaffold the write-refusal-reason adapter location (daemon-side vs. Convex `ack`-side — RESEARCH Open Question 2) before writing its test.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real file lands on host disk at correct scope | INTAKE-01, INTAKE-02 | Cross-repo, requires a live daemon + real filesystem round-trip; cannot be meaningfully unit-tested | Upload a SKILL.md (and separately a public GitHub URL) via IntakeModal; pick each scope; confirm file exists on host at the expected path and Skills page shows it without refresh |
| Cold-storage install prerequisite | INTAKE-01 | Live host state, not code: `~/.claude/skill-intake.toml` with `[astridr] confirmed = true` is **absent** on `lmofficenew` — every cold install fails exit 6 until created | `checkpoint:human-verify` task: operator creates the marker file before cold-storage installs are exercised |
| Skills page auto-reflects install | INTAKE-03 | Relies on existing Convex `useQuery` reactivity — no new transport to unit-test | After a successful install, observe the Skills page updates with correct origin/scope and no manual refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (rescan module, exit-code cases, adapter location)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
