# Phase 95 — Security Audit (HARD-01)

**Audit date:** 2026-07-07 · **Tier:** `/cso` fast (8/10 confidence threshold) · **Scope:** CodePulse repo only — `src/` + `convex/` + build/config (D-04). Ástríðr-side seams out of scope (cross-repo observations recorded as follow-up notes, not findings).
**Auditor doctrine:** zero false positives over coverage — every finding carries `file:line` + a quote + a concrete reachable exploit; unsubstantiated candidates dropped.
**Raw output (gitignored):** `.audits/security/2026-07-07-151957.{json,md}`.

---

## Verdict: **SHIP** — all findings remediated

No HIGH/CRITICAL findings. The shipped tree (settled by Plans 01/02, per D-11 ordering) is sound. `npm audit` = **0 vulnerabilities**; no committed secrets; every ingest handler enforces auth. Four LOW findings, all `file:line`-evidenced — **all four were operator-approved for fix and remediated in one pass (Task 3)**; **every finding is resolved (none left outstanding)**. Green bar after remediation: `tsc --noEmit` 0 · `vitest run` 164 files / 1644 tests · `vite build` 0. This is AI-assisted first-pass detection, not a substitute for a professional pentest; stakes here are moderate (internal single-operator dashboard).

---

## Confirmed Findings

### CSO-95-01 — `validateIngestAuth` fails OPEN when `ASTRIDR_INGEST_API_KEY` is unset  ·  LOW · confidence 9 · **FIXED (fail-closed, operator-approved)**

> **Remediation (Task 3):** `convex/ingestAuth.ts` now fails closed — `if (!expectedKey) return _env.ASTRIDR_INGEST_ALLOW_ANON === "true"`, symmetric with `validateForgeIngestAuth`. The dev anon path requires an explicit `ASTRIDR_INGEST_ALLOW_ANON=true` opt-in. Tests updated (`convex/__tests__/ingestAuth.test.ts`): fail-closed-when-unset + allow-anon-opt-in. Green bar passes.

- **Evidence** — `convex/ingestAuth.ts:72-77`:
  ```ts
  export function validateIngestAuth(request: Request): boolean {
    const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
    if (!expectedKey) return true; // Skip auth in dev when no key configured
    ...
  }
  ```
- **Asymmetry** — the Forge validator fails **CLOSED** for the same missing-key case (`convex/ingestAuth.ts:88-97`: `if (!expectedKey) return _env.FORGE_INGEST_ALLOW_ANON === "true"`).
- **Blast radius** — `validateIngestAuth` gates the entire `/ingest` + `/runtime-ingest` family (~17 write endpoints incl. `/hr-ingest`, `/api/ingest/agent-config-version`, `/war-room-ingest`, `/runtime-ingest`). Auth is genuinely *enforced* per-handler (confirmed `convex/runtimeIngest.ts:22` → `unauthorizedResponse()`); the weakness is only in the validator's unset-key branch.
- **Exploit path** — if `ASTRIDR_INGEST_API_KEY` is ever unset/emptied in prod, any internet party POSTs arbitrary events → dashboard poisoning + `configChanges` audit-trail tampering; via `runtimeIngest → processTaskQualityEvent` (`convex/evalScores.ts`) it can also trigger eval-judge LLM calls (cost amplification) *if* an LLM key is set.
- **Current mitigation** — `ASTRIDR_INGEST_API_KEY` is set on prod (43 chars, verified 2026-07-05 and re-confirmed this session via `convex env list`).
- **Fix options (operator decision):** (A) fail-closed like Forge (explicit `*_ALLOW_ANON=true` opt-in for dev); (B) prod boot assertion that the key is set; (C) accept-mitigated + record in the Accepted Risks Log.

### CSO-95-02 — `insightsChat.ask` is a public, unauthenticated action that makes billed LLM calls  ·  LOW · confidence 9 · **FIXED (auth gate added)**

> **Remediation (Task 3):** `convex/insightsChat.ts` `ask` now calls `ctx.auth.getUserIdentity()` and returns an "Authentication required" block before any LLM call when the caller is unauthenticated (Clerk is configured in prod). Closes the unauthenticated cost-amplification path. The 5 exposed tools remain read-only.

- **Evidence** — `convex/insightsChat.ts:246` (public `action`, no auth gate) → `callLLM(question)` (`:252`) → `fetch(\`${baseUrl}/chat/completions\`, { Authorization: \`Bearer ${apiKey}\` })` (`:222-226`, key from `OPENAI_API_KEY`). No `ctx.auth.getUserIdentity()` check anywhere in the file.
- **Exploit path** — the Convex deployment URL is public (`VITE_CONVEX_URL` in the frontend bundle). Any party can call `api.insightsChat.ask({question})` → 1 + N tool-round-trip OpenAI completions billed to `OPENAI_API_KEY` = cost amplification (the never-dropped class).
- **Current mitigation** — `OPENAI_API_KEY` is **not set** in prod, so `ask` no-ops (`convex/insightsChat.ts:192-194` returns a "not set" error before any call). The path goes live the moment the key is added to enable the Insights Chat feature.
- **Fix** — gate `ask` on `ctx.auth.getUserIdentity()` before `callLLM` (Clerk is already configured — `CLERK_JWT_ISSUER_DOMAIN` is set in prod), and/or add a per-caller rate/spend cap. The 5 exposed tools are all read-only (no mutations/raw DB), so the *only* risk is spend, not data tampering.

### CSO-95-03 — `.gitignore` ignores only `.env.local`, not bare `.env` / `.env.*`  ·  LOW · confidence 8 · **FIXED**

> **Remediation (Task 3):** `.gitignore` now ignores `.env` + `.env.*` with a `!.env.example` negation. Verified: `.env`/`.env.local`/`.env.production` ignored, `.env.example` still tracked.

- **Evidence** — `.gitignore:3` is `.env.local`; grep for `\.env` returns only that line. `.env.example` is (correctly) tracked; no other `.env*` is tracked.
- **Exploit path** — a developer who creates `.env` or `.env.production` with real secrets is not protected → `git add .` commits it → secrets pushed to GitHub.
- **Current mitigation** — the `gitleaks` CI scan catches known key patterns, the `env-file-guard` hook blocks edits, and no such file is currently tracked.
- **Fix** — broaden `.gitignore` to `.env` and `.env.*` with a `!.env.example` negation.

### CSO-95-04 — GitHub Actions pinned to mutable major tags, not commit SHAs  ·  LOW · confidence 8 · **FIXED (SHA-pinned)**

> **Remediation (Task 3):** both workflows now pin to full commit SHAs with a version comment — `actions/checkout@9c091bb…21b7c # v7`, `actions/setup-node@48b55a01… # v6`, `gitleaks/gitleaks-action@e0c47f4f… # v3`.

- **Evidence** — `.github/workflows/ci.yml:12-13` (`actions/checkout@v7`, `actions/setup-node@v6`); `.github/workflows/gitleaks-scan.yml:23,28` (`actions/checkout@v7`, `gitleaks/gitleaks-action@v3`).
- **Exploit path** — a compromised or force-moved tag executes attacker code in CI with the job's `GITHUB_TOKEN`.
- **Note** — reported because CI findings are never auto-dropped; it's a standard-practice tradeoff. The `gitleaks` workflow otherwise follows least-privilege (`permissions: contents: read, pull-requests: read`).
- **Fix** — pin to full commit SHAs (with a version comment) + Dependabot. Low priority for a single-maintainer repo.

---

## Surface Map

- **HTTP actions:** ~30 routes (`convex/http.ts`). Two auth families + one expected-open:
  - **fail-OPEN-when-unset** (`validateIngestAuth`): `/ingest`, `/runtime-ingest`, `/scan`, `/v1/metrics`, `/v1/logs`, `/preflight-ingest`, `/dreaming-ingest`, `/advisor-ingest`, `/import-ingest`, `/startup-ingest`, `/auth-alias-ingest`, `/war-room-ingest`, `/meeting-bot-ingest`, `/transcript-ingest`, `/mission-control-ingest`, `/hr-ingest`, `/api/ingest/agent-config-version`.
  - **fail-CLOSED** (`validateForgeIngestAuth`): `/forge-ingest`, `/forge-log-ingest`, `/forge-file-ingest`, `/forge-commands-claim`, `/forge-commands-ack`.
  - **no-auth (expected):** `GET /health` (liveness).
- **Auth coverage:** every ingest handler references a validator and returns `unauthorizedResponse()` on failure (confirmed `runtimeIngest.ts:22`). No endpoint is missing the auth call entirely.
- **Public LLM-calling action:** `insightsChat.ask` (see CSO-95-02). Exposes 5 read-only tools only.
- **Auth provider:** Clerk configured in prod (`CLERK_JWT_ISSUER_DOMAIN` set) — gates the frontend UI; public Convex actions bypass it.

## Supply Chain

- **`npm audit`:** 0 vulnerabilities (prod-only and full). Recorded 2026-07-07.
- **Lockfile:** `package-lock.json` present + committed; TS 6.0.3 tree settled by Plan 01.
- **Secret scanning:** `gitleaks/gitleaks-action@v3` runs in CI (least-privilege perms, three-state classification: clean / secret_found / scan_error). Repo grep for `sk-…`/`ghp_…`/`xoxb-`/`AKIA…`/`PRIVATE KEY` = **0 matches**. No `.env*` tracked except `.env.example`.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Ástríðr / external client → CodePulse ingest httpActions | Untrusted server-to-server writes via bearer-authed `/ingest`, `/runtime-ingest` family (fail-open-when-unset) and `/forge-*` family (fail-closed) |
| Browser → CodePulse httpActions (CORS) | Cross-origin reads gated by `CODEPULSE_ALLOWED_ORIGIN` allowlist (dev fallback = `*`) |
| Any internet client → public Convex actions/queries | The deployment URL is public; `insightsChat.ask` (LLM spend) + read-only telemetry queries are reachable without Clerk |
| npm registry → dependency tree | Supply-chain surface (`npm audit` = 0) |
| GitHub Actions → repo/CI | `GITHUB_TOKEN`-scoped workflows; actions pinned to major tags |

## Threat Register (STRIDE)

| ID | Category | Component | Disposition | Notes |
|----|----------|-----------|-------------|-------|
| CSO-95-01 | Spoofing/Tampering | `validateIngestAuth` (ingestAuth.ts:72-84) | **fixed** | Now fail-closed, symmetric with Forge (operator-approved). |
| CSO-95-02 | Cost-amplification (LLM) | `insightsChat.ask` (insightsChat.ts:246) | **fixed** | `getUserIdentity()` gate added before the LLM call. |
| CSO-95-03 | Info disclosure | `.gitignore` | **fixed** | `.env` + `.env.*` ignored, `!.env.example`. |
| CSO-95-04 | Tampering (supply/CI) | GH Actions tags | **fixed** | SHA-pinned in both workflows. |
| — | Info disclosure | CORS `*` fallback (ingestAuth.ts:44-46) | **accept** | Dev fallback; prod-MITIGATED (`CODEPULSE_ALLOWED_ORIGIN` set). |
| — | Vulnerable components | dependency tree | accept | `npm audit` = 0 vulns. |

## Accepted Risks Log

- **CORS `Access-Control-Allow-Origin: "*"` dev fallback** (`convex/ingestAuth.ts:44-46`) — fires only when `CODEPULSE_ALLOWED_ORIGIN` is unset; prod has it set (21 chars, confirmed). Accepted as a documented dev convenience.
- **CSO-95-01 disposition:** operator chose **fix — fail closed** (not accept); remediated in Task 3. No residual accepted risk for the ingest-auth path beyond the CORS fallback above.

## Security Audit Trail

- 2026-07-07 — `/cso` fast-tier audit over `src/`+`convex/`+build/config; `npm audit` (0); gitleaks CI reviewed; env presence checked (masked — no secret values materialized). Inventory produced (Task 1). Operator approved all four fixes (Task 2). Remediated in one pass (Task 3): `ingestAuth.ts` fail-closed, `insightsChat.ask` auth gate, `.gitignore` broadened, CI actions SHA-pinned. Green bar re-run green (tsc 0 / vitest 164 files / build 0).

## Sign-Off

- **Inventory (Task 1):** complete — 4 confirmed LOW findings, verdict SHIP.
- **Operator dispositions (Task 2):** complete — operator approved all four fixes (CSO-95-01 fail-closed; CSO-95-02/03/04 fix).
- **Remediation (Task 3):** complete — all four fixed; every finding resolved; green bar passes. **HARD-01 resolved.**

---

## What I dropped and why

Dropped 4 candidates for zero-false-positive precision: (1) `GET /health` unauthenticated — intentional liveness, no data; (2) CORS `*` fallback — prod-mitigated dev fallback (moved to Accepted Risks, not a finding); (3) public read-only telemetry queries — by-design for an internal single-operator dashboard (read-only, no PII/secrets, Clerk-gated UI); (4) the `gitleaks` workflow's unauthenticated `/runtime-ingest` notification curl (`gitleaks-scan.yml:83`) — 401s in prod and fails non-fatally, a functional/observability bug not a vuln (though it corroborates CSO-95-01: the author assumed unauthenticated ingest works).
