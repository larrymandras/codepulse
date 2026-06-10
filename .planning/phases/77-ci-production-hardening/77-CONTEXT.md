# Phase 77: CI & Production Hardening - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Make CodePulse's production deployment safe and its CI trustworthy:
1. **OPS-01 (CORS):** Production CORS uses a correct, fail-closed origin allowlist, with `CODEPULSE_ALLOWED_ORIGIN` set in the Convex cloud deployment and a documented deploy checklist.
2. **OPS-02 (Gitleaks):** A secret-scan CI workflow exists and runs green on `master`, failing the build on a real secret.
3. **OPS-03 (Supabase drift):** ❌ **Removed from this phase — N/A for CodePulse.** Resolved below.

**Reality vs. roadmap framing:** The roadmap said "green up" existing Gitleaks/Supabase CI. Ground-truth investigation found neither workflow exists in CodePulse, and CodePulse has no Supabase schema at all. The phase is therefore **author + harden**, not "fix red CI" — and OPS-03 drops out.

### In scope
- Author a Gitleaks secret-scan workflow on `master` (full git history, fail-on-secret), mirroring Ástríðr's proven workflow
- Harden production CORS to a fail-closed origin allowlist in `convex/ingestAuth.ts`
- Set `CODEPULSE_ALLOWED_ORIGIN` in Convex prod + write a deploy checklist (CORS value + procedure)
- Baseline pass: confirm git history is clean of secrets (allowlist or remediate any historical findings)

### Out of scope (deferred / other repos)
- **OPS-03 Supabase migration-drift** — structurally an Ástríðr concern; already implemented and live there (`supabase-migration-check.yml`). Not added to CodePulse.
- **Ingest-auth fail-open hardening** — `validateIngestAuth()` returning `true` when no key is configured (dev default) is the same fail-open class as the CORS `"*"`, but it's not in OPS-01/02/03. Deferred (Larry confirmed: do not fold in).

</domain>

<decisions>
## Implementation Decisions

### OPS-03 — Supabase migration-drift (resolved: drop from CodePulse)
- **D-01:** **Remove OPS-03 from CodePulse Phase 77; mark N/A (satisfied upstream).** Investigation confirmed the Ástríðr repo (`C:\Users\mandr\astridr-repo`) owns the real Supabase schema (`supabase/migrations/`, ~8+ migrations) and already runs `.github/workflows/supabase-migration-check.yml` (daily cron + `workflow_dispatch`, Supabase CLI, posts results to the CodePulse dashboard via `runtime-ingest`). CodePulse has **no `supabase/` directory** — its only Supabase touchpoint is `convex/supabase.ts`, which writes/reads a `supabaseHealth` *Convex* table polling Ástríðr's health. There is nothing in CodePulse to drift-check. **Action:** mark OPS-03 N/A in REQUIREMENTS.md with a pointer to the Ástríðr workflow.

### OPS-02 — Gitleaks secret scan
- **D-02:** **Full git history + fail the build** on a real finding. `fetch-depth: 0`, `gitleaks/gitleaks-action@v3`.
- **D-03:** **Mirror Ástríðr's `gitleaks-scan.yml`** (`C:\Users\mandr\astridr-repo\.github\workflows\gitleaks-scan.yml`) as the template — it already implements D-02 plus a robust **classify step** distinguishing `secret_found` (fail loud, `exit 1`) from `scan_error` (infra/permissions → neutral/warning, never mislabeled as a leak) from `clean`. Also mirror Ástríðr's `.gitleaks.toml` config.
- **D-04:** CodePulse adaptations to the template: trigger on `push`/`pull_request` to **`master`** (Ástríðr uses `main`); set `repo: "codepulse"` in the `runtime-ingest` notify payload; keep the same Convex ingest URL (`https://tidy-whale-981.convex.site/runtime-ingest`); preserve `permissions: { contents: read, pull-requests: read }`.
- **D-05:** **Baseline first.** Before flipping to fail-on-secret, run gitleaks over full history (locally or a first report-only run) to confirm it's clean. Any historical findings get allowlisted in `.gitleaks.toml` (false positives) or remediated/rotated (real). Only declare green once the enforced run passes.

### OPS-01 — Production CORS hardening
- **D-06:** **Fail-closed origin allowlist.** Replace `convex/ingestAuth.ts:13` `_env.CODEPULSE_ALLOWED_ORIGIN ?? "*"` with a parsed **comma-separated allowlist** (prod dashboard origin + localhost dev origin). Echo `Access-Control-Allow-Origin` only when the request `Origin` is in the allowlist; otherwise omit/deny it. No blanket `"*"` in production.
- **D-07:** Preserve a sane **dev fallback**: when `CODEPULSE_ALLOWED_ORIGIN` is unset (local dev), the permissive behavior is acceptable — but production MUST have the env var set (the deploy checklist enforces this).
- **D-08:** Set `CODEPULSE_ALLOWED_ORIGIN` in the **Convex cloud deployment** and write a **deploy checklist** documenting the value, where to set it (Convex env vars), and the procedure — so a developer can configure CORS for a non-local origin without guessing (OPS-01 success criterion #4).

### Claude's Discretion
- Exact allowlist parsing/matching helper shape in `ingestAuth.ts` (D-06) — trim/normalize trailing slashes, case handling.
- Where the deploy checklist lives (e.g. `docs/DEPLOY.md` or a `.planning` ops doc) and its exact format (D-08).
- Whether the Gitleaks baseline (D-05) is a local run or a first report-only CI run — planner/executor decides based on what's fastest to verify clean.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 77: CI & Production Hardening" — goal + success criteria (note: OPS-03 success criteria #2 is resolved as N/A here)
- `.planning/REQUIREMENTS.md` §"Production Hardening (OPS) — Phase 77" (OPS-01..03; OPS-03 to be marked N/A with upstream pointer)

### Reusable templates (Ástríðr repo — mirror these)
- `C:\Users\mandr\astridr-repo\.github\workflows\gitleaks-scan.yml` — **the template for OPS-02.** Full-history scan + classify (secret_found/scan_error/clean) + enforce + CodePulse notify. Adapt main→master, repo→codepulse.
- `C:\Users\mandr\astridr-repo\.gitleaks.toml` — gitleaks config to mirror/adapt for CodePulse.
- `C:\Users\mandr\astridr-repo\.github\workflows\supabase-migration-check.yml` — **proof OPS-03 already lives upstream.** Reference only; do not duplicate into CodePulse.

### CodePulse code touchpoints
- `convex/ingestAuth.ts` — the CORS source of truth (`corsHeaders`, `CODEPULSE_ALLOWED_ORIGIN ?? "*"` at L13); also `validateIngestAuth()` (deferred fail-open hardening lives here)
- `.github/workflows/ci.yml` — existing CI (tsc + vite build + vitest); the new Gitleaks workflow is a separate file, not a job added here unless the planner prefers consolidation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Ástríðr `gitleaks-scan.yml`** — drop-in template; the classify/enforce logic is already hardened against the "scan errored ≠ secret found" false-positive trap.
- **`convex/ingestAuth.ts` `corsHeaders`** — single shared CORS object imported by all ingest handlers (`ingest.ts`, `hrIngest.ts`, `configVersionIngest.ts`, `otelLogs.ts`); hardening one file fixes CORS everywhere.
- **`runtime-ingest` endpoint** (`https://tidy-whale-981.convex.site/runtime-ingest`) — CodePulse already receives GitHub workflow-run telemetry; the new Gitleaks workflow posts to it (repo: "codepulse") so scan results surface on the dashboard.

### Established Patterns
- All ingest CORS flows through `corsHeaders` in one file — no scattered ACAO headers to chase.
- CI targets `master` branch (per `ci.yml`); the Gitleaks workflow must match.
- Deploy is Convex-based: `npm run deploy` = `npx convex deploy && npx vite build`. Env vars (incl. `CODEPULSE_ALLOWED_ORIGIN`) are Convex deployment env vars.

### Integration Points
- **New file:** `.github/workflows/gitleaks-scan.yml` (+ `.gitleaks.toml`) in CodePulse.
- **Edit:** `convex/ingestAuth.ts` — allowlist parsing + matched-origin ACAO (D-06).
- **Config:** `CODEPULSE_ALLOWED_ORIGIN` env var in Convex prod (D-08).
- **New doc:** deploy checklist (D-08).
- **REQUIREMENTS.md:** mark OPS-03 N/A with upstream pointer (D-01).

</code_context>

<specifics>
## Specific Ideas

- The Gitleaks classify step's three-state result (`secret_found` → fail, `scan_error` → neutral/warn, `clean` → pass) is the key design Larry's "full history + fail build" choice depends on — don't collapse `scan_error` into a red "failing" check (it would read as a leaked secret and erode trust). Mirror it exactly.
- Fail-closed CORS means an unmatched origin gets **no** ACAO header (browser blocks it), not `"*"`.

</specifics>

<deferred>
## Deferred Ideas

- **Ingest-auth fail-open hardening** — `validateIngestAuth()` returns `true` when `ASTRIDR_INGEST_API_KEY` is unset; in production that's fail-open. Same class as the CORS `"*"`. Larry explicitly chose NOT to fold this into Phase 77. Candidate for a future security-hardening phase.
- **Consolidating Gitleaks into `ci.yml`** vs a separate workflow file — defaulting to a separate file (matches Ástríðr); revisit if workflow sprawl becomes an issue.
- **OPS-03 in Ástríðr** — already implemented and live there; no action needed, noted only so the N/A decision is traceable.

</deferred>

---

*Phase: 77-ci-production-hardening*
*Context gathered: 2026-06-10*
