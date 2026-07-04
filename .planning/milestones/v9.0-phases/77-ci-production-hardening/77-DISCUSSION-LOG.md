# Phase 77: CI & Production Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 77-ci-production-hardening
**Areas discussed:** OPS-03 scope (Supabase drift), Gitleaks setup, CORS hardening

---

## Pre-discussion ground-truth findings (codebase scout)

- `.github/workflows/` contains only `ci.yml` (tsc + vite build + vitest). **No Gitleaks workflow, no Supabase-drift workflow** — git history confirms they never existed. OPS-02/OPS-03 are "author," not "fix red."
- **No `supabase/` directory in CodePulse.** Only `convex/supabase.ts` (a `supabaseHealth` Convex table polling Ástríðr's health). Nothing local to drift-check.
- `CODEPULSE_ALLOWED_ORIGIN` already read in `convex/ingestAuth.ts:13` as `?? "*"` (fail-open). OPS-01 = prod config + checklist + tighten fallback.
- Ástríðr repo already has `gitleaks-scan.yml`, `supabase-migration-check.yml`, and `.gitleaks.toml` against the real Supabase schema.

---

## OPS-03 — Supabase migration-drift scope

| Option | Description | Selected |
|--------|-------------|----------|
| Drop from this phase → Ástríðr | Schema lives in Ástríðr; remove OPS-03 from CodePulse, mark N/A | (recommended outcome) |
| Reinterpret as Convex schema-drift | Replace with a Convex codegen/schema-sync CI check | |
| Keep as a Supabase drift check | Add Supabase + migrations to CodePulse | |
| You decide | Investigate Ástríðr CI, then recommend | ✓ |

**User's choice:** "You decide" → investigate Ástríðr CI.
**Notes:** Investigation found Ástríðr already runs `supabase-migration-check.yml` against `supabase/migrations/`. Recommendation = **drop OPS-03 from CodePulse, mark N/A (satisfied upstream)**. Larry confirmed this in the final readiness check ("Confirm + write context").

## Gitleaks setup

| Option | Description | Selected |
|--------|-------------|----------|
| Full history + fail build | gitleaks-action full history, CI fails on finding; baseline first | ✓ |
| Incremental (diff only) | Scan only new commits/PR diff | |
| Full history + report-only | Scan history but don't fail initially | |
| You decide | Run local scan first, then pick strictest green option | |

**User's choice:** Full history + fail build.
**Notes:** Mirror Ástríðr's `gitleaks-scan.yml` (already implements this with a 3-state classify: secret_found→fail, scan_error→neutral, clean→pass). Adapt main→master, repo→codepulse. Baseline pass required before declaring green.

## CORS hardening (OPS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed allowlist | Parsed comma-separated allowlist; ACAO only on matched origin | ✓ |
| Single origin, keep * dev fallback | One prod origin, keep `?? "*"` for dev | |
| You decide | Pick based on number of real origins | |

**User's choice:** Fail-closed allowlist.
**Notes:** Replace `?? "*"` in `convex/ingestAuth.ts` with allowlist parsing (prod + localhost), set `CODEPULSE_ALLOWED_ORIGIN` in Convex prod, write deploy checklist. Unmatched origin → no ACAO header.

---

## Final readiness check

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm + write context | Drop OPS-03, ship OPS-01 + OPS-02, write CONTEXT.md | ✓ |
| Fold in ingest-auth hardening | Also tighten validateIngestAuth() fail-open default | |
| Explore more gray areas | Surface 2-4 more | |

**User's choice:** Confirm + write context.

## Claude's Discretion

- Allowlist parsing/normalization details in `ingestAuth.ts`.
- Deploy checklist location/format.
- Gitleaks baseline as local run vs first report-only CI run.

## Deferred Ideas

- Ingest-auth fail-open hardening (`validateIngestAuth()` dev default) — explicitly NOT folded into Phase 77.
- Consolidating Gitleaks into `ci.yml` vs separate file (defaulting to separate).
- OPS-03 in Ástríðr — already live; noted for traceability only.
