# Phase 95: Hardening — Security Audit, Key Rotation, Dependency Majors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 95-Hardening — Security Audit, Key Rotation, Dependency Majors
**Areas discussed:** HARD-02 reality check, CSO audit scope & remediation policy, react-day-picker: migrate vs delete, Dependency majors approach

---

## HARD-02 reality check

Pre-discussion finding: memory `forge-deployment-tidy-whale-981` records that both ingest keys were verified rotated to real secrets on 2026-07-05 (during Phase 93) — one day after the requirement was written. The requirement's "placeholder" premise is stale.

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + close out (Recommended) | No new rotation; live ingest round-trip on both endpoints, confirm Forge daemon local env, update REQUIREMENTS/memory | ✓ |
| Fresh rotation anyway | Rotate both keys again (defense-in-depth), full OPS-01 procedure | |
| Conditional on audit | Verify-only unless /cso finds secret-exposure evidence | |

**User's choice:** Verify + close out

| Option | Description | Selected |
|--------|-------------|----------|
| Real emitters (Recommended) | Forge daemon + Ástríðr POST organically with configured keys; fresh rows land in prod Convex — matches Phase 93/94 live-E2E bar | ✓ |
| Synthetic curl POST | curl each endpoint with the real key; proves key only, not running configs | |
| Both | Curl smoke check then real-emitter confirmation | |

**User's choice:** Real emitters
**Notes:** Escalation to fresh rotation remains available if the audit surfaces exposure evidence, but is not the default plan.

---

## CSO audit scope & remediation policy

| Option | Description | Selected |
|--------|-------------|----------|
| CodePulse repo only (Recommended) | src/ + convex/ + build/config; matches requirement wording; Ástríðr has its own cadence | ✓ |
| Include cross-repo ingest seams | Also audit Ástríðr-side handling of shared secrets | |
| You decide | Claude picks scope during planning | |

**User's choice:** CodePulse repo only

| Option | Description | Selected |
|--------|-------------|----------|
| Inventory → confirm → fix (Recommended) | Confirmed-findings inventory with file:line; operator approves fix list; remediate all approved in one pass; deferrals explicit | ✓ |
| Fix all confirmed automatically | No approval gate | |
| Severity-gated | Auto-fix high/critical, present medium/low | |

**User's choice:** Inventory → confirm → fix

| Option | Description | Selected |
|--------|-------------|----------|
| /cso + npm audit + secret scan (Recommended) | Add dependency-CVE scan and GitHub secret scanning as cheap structured supplements | ✓ |
| /cso only | Single skill pass, no supplements | |
| Full /sec-audit workflow | Deep multi-agent security workflow | |

**User's choice:** /cso + npm audit + secret scan

| Option | Description | Selected |
|--------|-------------|----------|
| Committed phase artifact (Recommended) | 95-SECURITY-AUDIT.md: findings with file:line, remediation status, dropped-and-why, scanner results | ✓ |
| Ephemeral — fixes only | Findings live in conversation + commit messages | |
| You decide | Claude picks format | |

**User's choice:** Committed phase artifact

---

## react-day-picker: migrate vs delete

Pre-discussion finding: react-day-picker@9.14.0 is imported only by `src/components/ui/calendar.tsx`, and nothing imports that Calendar component — a dead shadcn primitive.

| Option | Description | Selected |
|--------|-------------|----------|
| Delete primitive + drop dep (Recommended) | Remove calendar.tsx + the dep; CI-red problem disappears at root; re-add via `npx shadcn add calendar` if ever needed; HARD-04 wording updated | ✓ |
| Migrate to v10 anyway | Fix the CI-red bump, keep the primitive current | |
| You decide | Claude picks after checking why the PR was red | |

**User's choice:** Delete primitive + drop dep

---

## Dependency majors approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh bump, mine PR #50 CI logs (Recommended) | Clean bump to 6.0.3 off master; use PR #50's red CI as the known-breakage list; dependabot branch holds no manual work | ✓ |
| Rebase the dependabot branch | Reuse origin/dependabot/.../typescript-6.0.3 per STATE.md note | |
| You decide | Claude picks after inspecting branch + logs | |

**User's choice:** Fresh bump, mine PR #50 CI logs

| Option | Description | Selected |
|--------|-------------|----------|
| Fold in all four (Recommended) | diff 8, js-yaml 5, jsdom 29, react-easy-crop 6 — one verified commit each; react-easy-crop gets manual UI check; REQUIREMENTS.md noted | ✓ |
| Dev-side only | Fold diff/js-yaml/jsdom, defer react-easy-crop | |
| Strictly HARD-03/04 | Only TS 6 + day-picker resolution | |

**User's choice:** Fold in all four

| Option | Description | Selected |
|--------|-------------|----------|
| Majors first, audit last (Recommended) | Audit certifies the post-migration state the phase ships; HARD-02 slots anywhere | ✓ |
| Audit first | Known remediation scope early; audited code isn't final state | |
| No preference | Planner sequences by dependency analysis | |

**User's choice:** Majors first, audit last

---

## Claude's Discretion

- Branch/PR mechanics for the majors work (one hardening branch vs per-bump; closing old dependabot PRs)
- /cso run structure and triage presentation (within the inventory→confirm→fix gate)
- jsdom 29 vitest-environment config fallout handling
- Where HARD-02's round-trip evidence is recorded
- Whether the phase ends with a prod Convex redeploy (coordinate with the pending Phase-93 close-out redeploy)

## Deferred Ideas

- Ástríðr-side security audit — belongs to astridr-repo's own hardening cadence; observations become astridr follow-up notes
- Calendar surface — re-add via `npx shadcn add calendar` if a date-picker UI is ever needed
