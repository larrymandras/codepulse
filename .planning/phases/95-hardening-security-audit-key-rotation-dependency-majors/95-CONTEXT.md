# Phase 95: Hardening — Security Audit, Key Rotation, Dependency Majors - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The platform's security posture, secrets, and major dependencies end up current and verified: the `/cso` code-security audit runs against the repo with every confirmed finding remediated (HARD-01), the Forge/Ástríðr ingest-key rotation is closed out with live proof (HARD-02), TypeScript 5.9→6 lands green (HARD-03), and the react-day-picker CI-red PR is resolved (HARD-04). Audit/cleanup work only — no new feature surfaces, no new schema shared with Phases 93/94. Eval pipeline (93) and trace waterfall (94) are complete and out of scope.

**Scoping updates discovered during discussion (both change the requirement shape as written 2026-07-04):**
1. **HARD-02 is already substantially done.** Memory `forge-deployment-tidy-whale-981` records that on 2026-07-05 (during Phase 93 execution) both `FORGE_INGEST_API_KEY` (48 chars) and `ASTRIDR_INGEST_API_KEY` (43 chars) on prod `tidy-whale-981` were verified as real secrets, with astridr-repo's `.env` matching exactly. The placeholder `<new-strong-secret>` referenced in the requirement text is retired. What remains is the live round-trip proof and the Forge-daemon-side env check.
2. **react-day-picker has zero consumers.** It is imported only by the shadcn primitive `src/components/ui/calendar.tsx`, and nothing in `src/` imports that Calendar component — it is a dead primitive.

</domain>

<decisions>
## Implementation Decisions

### HARD-02: key rotation → verify + close out (D-01..D-03)
- **D-01: No new rotation.** The 2026-07-05 verification stands. HARD-02 becomes a verification + documentation close-out, not a rotation. If the HARD-01 audit surfaces secret-exposure evidence (keys in git history, logs, committed files), that is new information to escalate — but the default plan does not rotate.
- **D-02: Round-trip proof = real emitters.** Start the Forge daemon and Ástríðr; each POSTs organically with its configured key; confirm fresh rows land in prod Convex tables (`tidy-whale-981`). Synthetic curl alone does not close it — matches the Phase 93 D-04 / Phase 94 D-05 live-E2E bar. Also explicitly confirm the Forge **daemon's** local env matches (the 07-05 check covered the Ástríðr side).
- **D-03: Update the records.** REQUIREMENTS.md HARD-02 wording, and the `forge-deployment-tidy-whale-981` memory file, updated to reflect the verified close-out.

### HARD-01: /cso audit scope & remediation (D-04..D-07)
- **D-04: Scope = CodePulse repo only** — `src/` + `convex/` + build/config surfaces. Ástríðr-side seams are out of scope here (own repo, own phase cadence); any cross-repo observations become astridr follow-up notes, not phase work.
- **D-05: Remediation flow = inventory → confirm → fix.** The audit produces a confirmed-findings inventory (file:line evidence, zero-false-positive precision bar per the requirement and standing user preference); the operator reviews and approves the fix list; then all approved findings are remediated in one pass. Any deferral is explicit and recorded — "no open confirmed findings" means fixed or operator-approved-deferred with rationale.
- **D-06: Supplement /cso with `npm audit` + GitHub secret scanning** (`run_secret_scanning`). Dependency CVEs are a natural fit since the phase already does dependency majors; the secret scan doubles as HARD-02 close-out evidence. NOT the full multi-agent /sec-audit workflow.
- **D-07: Durable audit record = committed `95-SECURITY-AUDIT.md`** in the phase directory: confirmed findings with file:line, per-finding remediation status, a "what was dropped and why" precision note, plus the npm-audit and secret-scan results. Follows the Phase 94 security-verification doc pattern.

### HARD-04: react-day-picker → delete, don't migrate (D-08)
- **D-08: Delete `src/components/ui/calendar.tsx` and drop `react-day-picker` from package.json.** The primitive has zero consumers; migrating it maintains dead code. This resolves the CI-red PR #49 at the root. Update HARD-04's wording in REQUIREMENTS.md to reflect this resolution, and clean up the `origin/dependabot/npm_and_yarn/react-day-picker-10.0.1` branch. If a calendar surface is ever needed, `npx shadcn add calendar` re-adds it on current react-day-picker.

### HARD-03 + folded majors: execution (D-09..D-11)
- **D-09: TypeScript 6 = fresh bump to 6.0.3 on a new branch off master**, NOT a rebase of the stale dependabot branch (it holds only a package.json/lockfile bump — nothing to preserve). Mine PR #50's red CI logs as the ready-made list of known breakages to fix. Green bar per success criterion: `tsc --noEmit` + full Vitest suite + `vite build`, all zero-error.
- **D-10: Fold in ALL four other pending dependabot majors** — `diff@8`, `js-yaml@5`, `jsdom@29` (dev/test-side), `react-easy-crop@6` (runtime). Each bump lands as its own commit, verified independently (tsc + vitest + build); react-easy-crop additionally gets a manual check of its consuming UI surface. REQUIREMENTS.md gets a note under HARD-03 recording the folded scope. Corresponding dependabot branches cleaned up as each lands.
- **D-11: Ordering = majors first, audit last.** All dependency changes (D-08/09/10) land before /cso + npm audit + secret scan run, so the audit certifies the code state the phase actually ships. HARD-02 verification is independent (needs the live stack) and slots anywhere.

### Claude's Discretion
- Exact branch/PR mechanics for the majors work (one hardening branch vs per-bump branches; whether to close/comment the old dependabot PRs).
- How to structure the /cso run and triage presentation (as long as D-05's inventory→confirm→fix gate is honored).
- Whether jsdom 29 requires vitest-environment config changes; any transitive-dep fallout handling.
- Where HARD-02's round-trip evidence is recorded (95-SECURITY-AUDIT.md vs a separate verification note).
- Whether the phase ends with a prod Convex redeploy (note: STATE.md "Operator Next Steps" still lists a pending Phase-93 redeploy — coordinate rather than duplicate).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scoping
- `.planning/REQUIREMENTS.md` — HARD-01..04 definitions and success criteria; this phase updates HARD-02/03/04 wording per D-03/D-08/D-10
- `.planning/ROADMAP.md` — Phase 95 entry, 4 success criteria
- `.planning/STATE.md` — "Phase 95 note" on dependabot branches (superseded in part by D-09: fresh bump, mine CI logs) and pending Phase-93 operator close-out steps

### HARD-02 (key rotation close-out)
- `C:/Users/mandr/.claude/projects/C--Users-mandr-codepulse/memory/forge-deployment-tidy-whale-981.md` — the 2026-07-05 rotation verification record, `.site` vs `.cloud` host rules, rotation procedure; MUST be updated at close-out (D-03)
- `docs/forge-deploy-checklist.md` — OPS-01 rotation/verification checklist (Phase 82-02)

### HARD-01 (audit)
- `C:/Users/mandr/.claude/skills/cso/SKILL.md` — the /cso skill (single-pass, confidence-gated, zero-false-positive bar); invoked via the Skill tool, not reimplemented
- `convex/http.ts` — the bearer-authed httpAction surface (`/ingest`, `/runtime-ingest`, `/forge-ingest` family) that is the highest-value audit target

### HARD-03/04 + folded majors
- GitHub PR #50 (typescript 6.0.x, closed 2026-07-04) — red CI logs = known-breakage list for D-09
- GitHub PR #49 (react-day-picker 10, closed 2026-07-04) — closed by deletion per D-08, no migration
- Remote branches `origin/dependabot/npm_and_yarn/{typescript-6.0.3, react-day-picker-10.0.1, diff-8.0.3, js-yaml-5.2.1, jsdom-29.1.1, react-easy-crop-6.0.2}` — version targets + cleanup list for D-10
- `src/components/ui/calendar.tsx` — the file to DELETE (D-08); verified sole react-day-picker import site with zero consumers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/cso` skill installed and listed in available skills — HARD-01 is an invocation + triage + remediation flow, not new tooling
- GitHub MCP `run_secret_scanning` available for the D-06 secret scan; `gh`/MCP for pulling PR #49/#50 CI logs
- Verification harness is the existing scripts: `npx tsc --noEmit`, `npx vitest run`, `npm run build` — the per-bump green bar (D-09/D-10)
- Phase 94's committed security-verification doc — the pattern `95-SECURITY-AUDIT.md` follows (D-07)

### Established Patterns
- Zero-false-positive findings bar (file:line evidence, drop-if-unsubstantiated) — global standing rule, restated in HARD-01
- Live-E2E completion bar (Phase 93 D-04 / Phase 94 D-05): convex-test/CI green alone does not close a phase — carried into D-02's real-emitter round trip
- Inventory → confirm → fix-in-one-pass is the operator's standing bug-fix pattern — D-05 applies it to audit remediation
- Atomic per-change commits with verification — one commit per dependency bump (D-10)

### Integration Points
- Current versions (verified 2026-07-06): typescript ^5.9.3 → 6.0.3; react-day-picker ^9.14.0 (→ deleted); react 19.2.7, vite ^8.1.2, convex ^1.42.0, vitest ^4.1.9 unchanged
- Forge daemon (separate forge dir, ephemeral loopback ports) and Ástríðr (astridr-repo, Docker) are the two real emitters for D-02; prod Convex = `tidy-whale-981` (`.convex.site` for httpActions)
- Note: war-room containers still run the pre-94 image (PROJECT.md known follow-up) — don't confuse their untraced/stale emissions with HARD-02 evidence

</code_context>

<specifics>
## Specific Ideas

- The phase's spirit is "close things out honestly": HARD-02 was resolved mid-Phase-93 and the records should say so rather than re-performing work; HARD-04 is best satisfied by deleting dead code rather than migrating it. Requirement wording follows reality, with the change recorded.
- The audit certifies the shipped state — that's why majors land first (D-11).
- Precision over volume in the audit: a short list of confirmed, evidenced findings beats a long speculative one; the "what I dropped and why" line is part of the deliverable (D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Ástríðr-side security audit** — cross-repo ingest-seam review deliberately excluded from HARD-01 (D-04); belongs to astridr-repo's own hardening cadence. Any observations from this phase's audit get noted as astridr follow-ups, not fixed here.
- **Calendar surface** — if a date-picker UI is ever needed, re-add via `npx shadcn add calendar` (current react-day-picker); no primitive kept warm.

</deferred>

---

*Phase: 95-Hardening — Security Audit, Key Rotation, Dependency Majors*
*Context gathered: 2026-07-06*
