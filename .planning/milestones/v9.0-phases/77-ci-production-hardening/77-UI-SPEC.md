# Phase 77: CI & Production Hardening - UI Spec

**Status:** N/A — no UI surface
**Created:** 2026-06-10

## Determination

Phase 77 delivers **no user-facing UI**. It is an infrastructure / production-hardening phase whose deliverables are:

1. A Gitleaks secret-scan GitHub Actions workflow (`.github/workflows/gitleaks-scan.yml` + `.gitleaks.toml`)
2. A Convex CORS code change (`convex/ingestAuth.ts` — fail-closed origin allowlist)
3. A Convex prod env var (`CODEPULSE_ALLOWED_ORIGIN`) + a deploy checklist document

None of these render a screen, component, or interaction. The roadmap reflects this: phases 71–76 carry `UI hint: yes`; Phase 77 does not.

This stub exists only to satisfy the `plan-phase` prerequisite gate honestly. There is no design contract to define.

## UI Requirements

None.

## Components

None.

## Note for the planner

Do not generate UI tasks for this phase. If any deliverable here ever grows a visible surface (e.g. a CI/secret-scan status tile on the dashboard), that is a **separate** UI phase, not this one.

---

*Phase: 77-ci-production-hardening*
*UI-SPEC: N/A (no UI surface)*
