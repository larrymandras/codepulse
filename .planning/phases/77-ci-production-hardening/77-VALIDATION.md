---
phase: 77
slug: ci-production-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed + configured) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run convex/__tests__/ingestAuth.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds (targeted) / full suite per repo |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/__tests__/ingestAuth.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full vitest suite green AND gitleaks CI green on master
- **Max feedback latency:** ~15 seconds (unit) — gitleaks is CI-observable, not local

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 77-CORS-01 | CORS | 1 | OPS-01 | — | `parseAllowlist()` parses comma-separated env into a Set | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ✅ expand | ⬜ pending |
| 77-CORS-02 | CORS | 1 | OPS-01 | — | Matched request Origin → ACAO echoes exact origin | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ✅ expand | ⬜ pending |
| 77-CORS-03 | CORS | 1 | OPS-01 | — | Unmatched Origin → ACAO header omitted (fail-closed) | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ✅ expand | ⬜ pending |
| 77-CORS-04 | CORS | 1 | OPS-01 | — | Unset env var → permissive dev fallback (`"*"`) | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ✅ expand | ⬜ pending |
| 77-GL-01 | Gitleaks | 1 | OPS-02 | — | `gitleaks-scan.yml` exists + valid YAML | CI observable | push/PR to master | ❌ W0 create | ⬜ pending |
| 77-GL-02 | Gitleaks | 1 | OPS-02 | — | Workflow goes green on clean repo (post-baseline) | CI observable | push to master | ❌ W0 create | ⬜ pending |
| 77-GL-03 | Gitleaks | 2 | OPS-02 | — | `secret_found` → `exit 1` (blocks merge) | manual validation | introduce test secret, observe red, revert | manual | ⬜ pending |
| 77-DOC-01 | Docs | 2 | OPS-03 | — | OPS-03 marked N/A in REQUIREMENTS.md w/ upstream pointer | source assertion | grep REQUIREMENTS.md for `N/A` + astridr ref | manual review | ⬜ pending |
| 77-DOC-02 | Docs | 2 | OPS-01 | — | `CODEPULSE_ALLOWED_ORIGIN` set in Convex prod + checklist | manual checklist | `npx convex env list` | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/__tests__/ingestAuth.test.ts` — expand with 4–6 allowlist-matcher tests for `parseAllowlist()` / `getCorsHeaders(request)` (file exists; add cases). Test the pure parse/match functions directly — do NOT rely on `vi.stubEnv` after module init, since the parsed allowlist Set is computed once at import.
- [ ] `.github/workflows/gitleaks-scan.yml` — new file (OPS-02)
- [ ] `.gitleaks.toml` — new file (OPS-02), allowlisting the `.env.example` `pk_test_` Clerk placeholders

*vitest infrastructure already exists — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `secret_found → exit 1` blocks the build | OPS-02 | Requires intentionally introducing a real-looking secret; can't live in the repo | On a throwaway branch, add a fake AWS/API key, push, confirm the Gitleaks check goes red with `exit 1` (not a neutral scan_error), then delete the branch |
| `CODEPULSE_ALLOWED_ORIGIN` set in Convex cloud | OPS-01 | Convex deployment env state is external to the repo | `npx convex env list` shows the var; deploy checklist documents value + procedure |
| Gitleaks baseline clean over full history | OPS-02 | One-time history scan; CI-observable thereafter | Run gitleaks locally over full history; allowlist `.env.example` placeholders or remediate real hits before enabling enforcement |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies (CORS = unit; Gitleaks = CI-observable; deploy/docs = manual checklist by nature)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (ingestAuth.test.ts expansion, gitleaks workflow + config)
- [ ] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [ ] Feedback latency < 15s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

> **Executor note:** `nyquist_compliant` and `wave_0_complete` are intentionally `false` in draft. The substance already satisfies Nyquist (every auto task has an automated verify, no watch-mode, <15s latency). On completing all phase tasks, the executor/verify step flips both frontmatter flags to `true` and checks off the Sign-Off boxes. Do not treat the draft `false` as a coverage failure.
