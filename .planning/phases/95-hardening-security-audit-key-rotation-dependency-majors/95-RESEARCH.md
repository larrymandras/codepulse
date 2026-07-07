# Phase 95: Hardening — Security Audit, Key Rotation, Dependency Majors - Research

**Researched:** 2026-07-07
**Domain:** Dependency-major migration (TypeScript 6), dead-code removal, security audit + secrets close-out
**Confidence:** HIGH (the load-bearing facts are verified from git, the lockfile, live CI logs, and the source tree)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**HARD-02 — key rotation → verify + close out:**
- **D-01: No new rotation.** The 2026-07-05 verification stands. HARD-02 is a verification + documentation close-out, NOT a rotation. Only rotate if the HARD-01 audit surfaces secret-exposure evidence (keys in git history, logs, committed files).
- **D-02: Round-trip proof = real emitters.** Start the Forge daemon AND Ástríðr; each POSTs organically with its configured key; confirm fresh rows land in prod Convex tables (`tidy-whale-981`). Synthetic curl alone does NOT close it. Also explicitly confirm the Forge **daemon's** local env matches (the 07-05 check covered the Ástríðr side only).
- **D-03: Update the records.** REQUIREMENTS.md HARD-02 wording, and the `forge-deployment-tidy-whale-981` memory file, updated to reflect the verified close-out.

**HARD-01 — /cso audit scope & remediation:**
- **D-04: Scope = CodePulse repo only** — `src/` + `convex/` + build/config surfaces. Ástríðr-side seams are OUT of scope; cross-repo observations become astridr follow-up notes, not phase work.
- **D-05: Remediation flow = inventory → confirm → fix.** Audit produces a confirmed-findings inventory (file:line evidence, zero-false-positive bar); operator reviews and approves the fix list; then all approved findings are remediated in one pass. Any deferral is explicit and recorded.
- **D-06: Supplement /cso with `npm audit` + GitHub secret scanning** (`run_secret_scanning`). NOT the full multi-agent /sec-audit workflow.
- **D-07: Durable audit record = committed `95-SECURITY-AUDIT.md`** in the phase directory: confirmed findings with file:line, per-finding remediation status, a "what was dropped and why" precision note, plus npm-audit and secret-scan results. Follows the Phase 94 security-verification doc pattern.

**HARD-04 — react-day-picker → delete, don't migrate:**
- **D-08: Delete `src/components/ui/calendar.tsx` and drop `react-day-picker` from package.json.** Zero consumers. Resolves CI-red PR #49 at the root. Update HARD-04 wording in REQUIREMENTS.md; clean up the `origin/dependabot/npm_and_yarn/react-day-picker-10.0.1` branch. Re-add via `npx shadcn add calendar` if ever needed.

**HARD-03 + folded majors — execution:**
- **D-09: TypeScript 6 = fresh bump to 6.0.3 on a new branch off master**, NOT a rebase of the stale dependabot branch. Mine PR #50's red CI logs as the known-breakage list. Green bar: `tsc --noEmit` + full Vitest suite + `vite build`, all zero-error.
- **D-10: Fold in ALL four other pending dependabot majors** — `diff@8`, `js-yaml@5`, `jsdom@29`, `react-easy-crop@6`. Each bump its own commit, verified independently (tsc + vitest + build); react-easy-crop additionally gets a manual UI check. REQUIREMENTS.md gets a note under HARD-03 recording folded scope. Dependabot branches cleaned up as each lands.
- **D-11: Ordering = majors first, audit last.** All dependency changes (D-08/09/10) land before /cso + npm audit + secret scan run. HARD-02 verification is independent and slots anywhere.

### Claude's Discretion
- Exact branch/PR mechanics for the majors work (one hardening branch vs per-bump branches; whether to close/comment old dependabot PRs).
- How to structure the /cso run and triage presentation (as long as D-05's inventory→confirm→fix gate is honored).
- Whether jsdom 29 requires vitest-environment config changes; any transitive-dep fallout handling.
- Where HARD-02's round-trip evidence is recorded (95-SECURITY-AUDIT.md vs a separate verification note).
- Whether the phase ends with a prod Convex redeploy (note: STATE.md "Operator Next Steps" still lists a pending Phase-93 redeploy — coordinate rather than duplicate).

### Deferred Ideas (OUT OF SCOPE)
- **Ástríðr-side security audit** — cross-repo ingest-seam review deliberately excluded from HARD-01 (D-04). Observations become astridr follow-up notes, not fixed here.
- **Calendar surface** — if a date-picker UI is ever needed, re-add via `npx shadcn add calendar`; no primitive kept warm.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARD-01 | `/cso` audit run; confirmed findings remediated (zero-false-positive, file:line evidence) | `/cso` skill read (single-pass, 8/10 threshold, writes `.audits/security/*`); highest-value surface = `convex/ingestAuth.ts` + `convex/http.ts` ingest family (43 routes); npm audit currently **0 vulnerabilities**; audit runs LAST per D-11 |
| HARD-02 | Forge ingest key rotated / real secret live in Convex env + Forge daemon | Already substantially done (07-05). Remaining = live real-emitter round-trip + **Forge-daemon-side** env check + records update. Env vars + host rules documented below |
| HARD-03 | TS 5.9→6.0.3 green (tsc + full Vitest + build) | **PR #50's 22 CI errors are ONE root cause** — Node globals unresolved under TS 6.0. Single tsconfig-level fix. Full breakage inventory + remediation below. Four "folded" majors (D-10) **already merged to master** |
| HARD-04 | react-day-picker resolved | `calendar.tsx` verified sole importer, **zero consumers**. Delete file + drop dep + `@types`? (none). Cleanup steps below |
</phase_requirements>

## Summary

This is an audit/cleanup phase with a much smaller execution surface than the requirement text implies, because most of the dependency work already landed. Three findings reshape the plan:

1. **The four "folded majors" (D-10) are already merged to master and installed** — `diff@8.0.3`, `js-yaml@5.2.1`, `jsdom@29.1.1`, `react-easy-crop@6.0.2` merged 2026-07-04 (commits `142cc7c`, `ec42253`, `c0c7bac`, `ab2eab4`). Master is **currently green** (`tsc --noEmit` exits 0). So D-10 is not four fresh bumps — it is *retrospective verification* (tsc + vitest + build already pass), plus two cleanup items: the stale `@types/diff@7`/`@types/js-yaml@4` (both now redundant — the runtime packages ship their own types), and deleting the six lingering remote dependabot branches.

2. **The entire TypeScript 6.0.3 migration (HARD-03) is a single-root-cause fix.** PR #50's 22 CI errors are 100% "Node global not found" (14× TS2591 for `process`/`fs`/`path`/`Buffer`, 8× TS2304 for `__dirname`/`global`). There are **zero** API removals, strictness regressions, or code breakages. TS 6.0 stopped auto-including `@types/node`'s ambient globals; the fix is at the tsconfig level (make node globals visible again). Because all 184 test files import `describe/it/expect` explicitly from `vitest`, a `"types"` restriction is low-risk — but must be verified by re-running tsc.

3. **HARD-04 and HARD-01 are both low-effort.** `calendar.tsx` is confirmed dead (sole `react-day-picker` importer, zero consumers of the exported `Calendar`). `npm audit` is already clean (0 vulnerabilities). The `/cso` audit's highest-value target is `convex/ingestAuth.ts`, which contains one genuine (but prod-mitigated) fail-open asymmetry worth surfacing honestly.

**Primary recommendation:** Sequence per D-11. Land HARD-04 (delete) → HARD-03 (TS6 via a single tsconfig change, verify) → verify the already-merged D-10 majors + remove the two redundant `@types` + delete stale branches → run `/cso` + `npm audit` + secret scan and write `95-SECURITY-AUDIT.md`. Do the HARD-02 live round-trip whenever the stack is up. This is 4-6 small commits plus the audit, not a large migration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Type-check / build config (HARD-03) | Build tooling (tsconfig, vite) | — | TS 6 behavior change is resolved in `tsconfig.json`, not in app code |
| Dead UI primitive removal (HARD-04) | Frontend (`src/components/ui/`) | Build (package.json/lockfile) | Delete component + drop dependency |
| Ingest auth / CORS audit (HARD-01) | API / Backend (`convex/`) | Infra/CI (workflows) | Highest-value audit surface is the bearer-authed httpAction ingest family |
| Ingest-key round-trip (HARD-02) | Cross-service (Forge daemon + Ástríðr → prod Convex) | Config/secrets (env) | Verification of live server-to-server auth; not a code change |

## Standard Stack

### Verified current versions (from `package-lock.json` + `git log`)

| Package | Installed now | Target | Status | Source |
|---------|--------------|--------|--------|--------|
| typescript | 5.9.3 | **6.0.3** | Bump needed (HARD-03) | [VERIFIED: package-lock.json] |
| react-day-picker | 9.14.0 | **removed** | Delete (HARD-04, D-08) | [VERIFIED: package-lock.json] |
| diff | **8.0.3** | 8 | ✅ already merged `142cc7c` | [VERIFIED: git log] |
| js-yaml | **5.2.1** | 5 | ✅ already merged `ec42253` | [VERIFIED: git log] |
| jsdom | **29.1.1** | 29 | ✅ already merged `ab2eab4` | [VERIFIED: git log] |
| react-easy-crop | **6.0.2** | 6 | ✅ already merged `c0c7bac` | [VERIFIED: git log] |
| `@types/diff` | 7.0.2 | **remove** | Redundant — `diff@8` ships own types (`libcjs/index.d.ts`) AND major-mismatched | [VERIFIED: node_modules inspect] |
| `@types/js-yaml` | 4.0.9 | **remove** | Redundant — `js-yaml@5` ships own types (`./dist/js-yaml.d.ts`) AND major-mismatched | [VERIFIED: node_modules inspect] |
| convex | 1.42.1 | unchanged | No `typescript` peer constraint (peerDeps: none) | [VERIFIED: node_modules inspect] |
| vite | 8.1.2 | unchanged | Rolldown bundler (migrated `15e60f1`) | [VERIFIED: package.json] |
| vitest | 4.1.9 | unchanged | jsdom peer = `*` (no version pin) → jsdom 29 compatible | [VERIFIED: node_modules inspect] |
| react / react-dom | 19.2.7 | unchanged | — | [VERIFIED: package.json] |

**Installation (HARD-03):**
```bash
npm install --save-dev typescript@6.0.3
npm uninstall @types/diff @types/js-yaml   # both now redundant + major-mismatched
npm uninstall react-day-picker             # HARD-04, after deleting calendar.tsx
```

> **Version-verification note:** These versions are ground-truthed from this repo's own lockfile and git history (authoritative for "what this repo uses"), not from my training data. This repo tracks a version timeline ahead of my January 2026 cutoff (TS 6, js-yaml 5, jsdom 29, vite 8, vitest 4). Do NOT trust training-data recollections of these packages' APIs — the authoritative breaking-change sources for this phase are (a) PR #50's CI logs, mined below, and (b) each package's own CHANGELOG. The planner should have execution agents consult the changelog for `react-easy-crop@6` specifically (the one runtime-facing bump with a UI surface, per D-10).

## Package Legitimacy Audit

> All packages here are pre-existing, mainstream, long-established libraries already present in the committed lockfile (not fresh discoveries). The only *new* install is `typescript@6.0.3` (a first-party Microsoft package). `npm audit` reports **0 vulnerabilities** across the full tree.

| Package | Registry | Maturity | slopcheck | Disposition |
|---------|----------|----------|-----------|-------------|
| typescript@6.0.3 | npm (Microsoft, first-party) | Established | not run (mainstream) | Approved — install |
| diff@8.0.3 | npm (`kpdecker/jsdiff`) | Established | not run (mainstream) | Already merged — verify only |
| js-yaml@5.2.1 | npm (`nodeca/js-yaml`) | Established | not run (mainstream) | Already merged — verify only |
| jsdom@29.1.1 | npm (`jsdom/jsdom`) | Established | not run (mainstream) | Already merged — verify only |
| react-easy-crop@6.0.2 | npm (`ValentinH/react-easy-crop`) | Established | not run (mainstream) | Already merged — verify + UI check |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Note:** slopcheck was not run this session; all listed packages are long-established mainstream libraries already in the committed lockfile with a clean `npm audit`. The single new install is a Microsoft first-party package. Legitimacy risk is negligible; no `checkpoint:human-verify` gate is warranted for these specific packages.

## HARD-03 deep dive — the TypeScript 6.0.3 migration

### The complete breakage inventory (mined from PR #50 CI)

PR #50 (`chore(deps-dev): bump typescript from 5.9.3 to 6.0.3`, closed 2026-07-04) failed CI on the `npx tsc --noEmit` step. Mined via:
```bash
gh pr checks 50                          # → "check fail", "Secret Scan pass"
gh run view 28493109341 --log-failed     # the failing tsc job
```

**Full error histogram — 22 errors, one root cause** [VERIFIED: PR #50 CI run 28493109341]:

| Code | Count | Meaning | Example site |
|------|-------|---------|--------------|
| TS2591 | 14 | "Cannot find name 'process'/'fs'/'path'/'Buffer'. …install `@types/node`…" | `convex/emailDigest.ts(174,20)`, `convex/gatewayQuota.ts(36,21)`, `convex/forgeFileIngest.ts(89,23)` |
| TS2304 | 8 | "Cannot find name '__dirname'/'global'." | `convex/__tests__/providerRegistry.test.ts(13,11)`, `src/hooks/useSavedViews.test.ts(85,27)` |

**There are ZERO other error classes** — no removed-API errors, no `strict`-tightening errors, no `lib` changes, no React-types breakage. `@types/node@26.0.1` IS installed; the compiler still cannot see its ambient globals. Conclusion: TS 6.0 changed automatic ambient-type inclusion — under 5.9 the current tsconfig (which has **no `types` field**, so all `@types/*` auto-load) resolves node globals; under 6.0 it does not.

### Current tsconfig (single flat config)
```jsonc
// tsconfig.json — [VERIFIED: read 2026-07-07]
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "skipLibCheck": true, "allowJs": true,
    "outDir": "dist", "paths": { "@/*": ["./src/*"] }
    // NOTE: no "types" field, no "lib" field
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "convex/**/*.ts"],
  "exclude": ["node_modules"]
}
```
There are no `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.convex.json` — one config covers both `src/` (browser) and `convex/`.

### Recommended remediation (verify empirically — see risk)

**Option A (recommended): add `@types/node` to the `types` array.**
```jsonc
"compilerOptions": { ..., "types": ["node"] }
```
- **Why low-risk here:** All 184 test files import `describe/it/expect/vi` *explicitly* `from 'vitest'` [VERIFIED: grep — 184 files], and `@testing-library/jest-dom` matchers are registered via the setup file, and `@types/react` is module-resolved through `import`. So restricting the `types` array to `["node"]` does not remove any *ambient* globals the code relies on. `[ASSUMED]` that no other ambient-only `@types` package is depended upon — **must be confirmed by running `npx tsc --noEmit` after the change** and iterating if new errors appear (e.g., add `"vite/client"` if `import.meta.env` types break, though those usually come from a `vite-env.d.ts` reference).

**Option B (fallback): apply the existing in-repo workaround per-file.** `convex/ingestAuth.ts:9-10` already dodges this exact issue: `const _env = (globalThis as any).process?.env ?? {}` with the comment *"The Convex tsconfig does not include @types/node."* The five prod files that use bare `process`/`Buffer` without the workaround are the break sites: `convex/emailDigest.ts`, `convex/gatewayQuota.ts`, `convex/auth.config.ts`, `convex/forgeFileIngest.ts`, `src/hooks/useThemeColors.ts` [VERIFIED: grep]. Option B is more invasive (also needs `fs`/`path`/`__dirname` fixes in test files) — prefer A.

**Green bar (D-09), run all three:**
```bash
npx tsc --noEmit        # currently exits 0 on 5.9.3; must stay 0 on 6.0.3
npx vitest run          # full suite (184 test files)
npm run build           # vite build (Rolldown)
```

### Note: CI also runs a Secret Scan step
PR #50's checks show a separate **"Secret Scan"** GitHub Action (passed in 11s). This is relevant to HARD-01/D-06 — the secret scan is already wired into CI, so the phase's `run_secret_scanning` supplement corroborates an existing gate.

## HARD-04 deep dive — react-day-picker deletion

**Verified dead-code chain** [VERIFIED: grep 2026-07-07]:
- `react-day-picker` is imported by exactly one file: `src/components/ui/calendar.tsx:9-13` (`DayPicker`, `getDefaultClassNames`, `type DayButton`).
- `calendar.tsx` exports `Calendar` and `CalendarDayButton`. Grep for `Calendar`/`calendar` across `src/` (excluding `calendar.tsx`) finds **only** unrelated hits: `calendar_read`/`calendar_write` tool-name strings in `ToolsStep.tsx`, and a prose comment in `QualityTrendChart.tsx`. **Zero real consumers of the Calendar component.**
- There is no `@types/react-day-picker` in package.json (the lib ships its own types) — nothing extra to remove.

**Cleanup steps:**
```bash
rm src/components/ui/calendar.tsx
npm uninstall react-day-picker            # removes from package.json + lockfile
git push origin --delete dependabot/npm_and_yarn/react-day-picker-10.0.1
# verify: grep -r "react-day-picker" src convex  → no hits
# verify: npx tsc --noEmit && npx vitest run && npm run build
```
Update HARD-04 wording in `REQUIREMENTS.md` per D-08 (resolved-by-deletion, not migration).

## HARD-02 deep dive — key-rotation close-out

### Current state (already substantially done)
Per memory `forge-deployment-tidy-whale-981` [VERIFIED: read]: on 2026-07-05, both `FORGE_INGEST_API_KEY` (48 chars) and `ASTRIDR_INGEST_API_KEY` (43 chars) on prod `tidy-whale-981` were confirmed as real secrets; astridr-repo's `.env` `ASTRIDR_INGEST_API_KEY` matches the Convex value exactly; astridr's `CONVEX_URL` points at `https://tidy-whale-981.convex.site`. The 07-05 check covered the **Ástríðr side only**.

### Remaining work (D-02)
1. **Confirm the Forge daemon's local env** — the one side NOT yet verified. The daemon needs (from `docs/forge-deploy-checklist.md`) [VERIFIED: read]:
   - `FORGE_INGEST_API_KEY` (must match the Convex value)
   - `CONVEX_FORGE_INGEST_URL` (base; daemon appends `/forge-ingest`)
   - `FORGE_LOG_INGEST_URL` (full path incl. `/forge-log-ingest`)
   - `FORGE_FILE_INGEST_URL` (full path incl. `/forge-file-ingest`)
   - **Host gotcha:** the checklist examples use `.convex.cloud`, but the memory states the daemon must post to the **`.convex.site`** HTTP-actions host. Verify the daemon's URLs target `.site`, not `.cloud`, or ingest 404s/misroutes. The daemon uses **ephemeral loopback ports** (printed in its `[forge] listening on …` banner) and env vars must be set in the *same shell* before `npm run dev` in the **forge dir** (not the codepulse dir).
2. **Live real-emitter round trip** — start the Forge daemon and Ástríðr; each POSTs organically with its configured key; confirm fresh rows land in prod Convex. Synthetic curl does not satisfy D-02.
3. **Update records (D-03)** — `REQUIREMENTS.md` HARD-02 wording + the `forge-deployment-tidy-whale-981` memory file.

### Which Convex tables prove the round trip
The httpAction ingest routes (from `convex/http.ts` [VERIFIED: read]) that the two emitters hit:
- **Forge daemon →** `/forge-ingest` (job-state → jobs/workspaces tables), `/forge-log-ingest` (log chunks), `/forge-file-ingest` (file listings/artifacts). Auth: `validateForgeIngestAuth` (fail-CLOSED).
- **Ástríðr →** `/runtime-ingest` + `/ingest` family (llmMetrics, dockerContainers, sessions, events, etc.). Auth: `validateIngestAuth` (fail-OPEN when key unset — see Security Domain).

**Watch-out (from CONTEXT + STATE):** war-room containers still run the pre-94 image and emit untraced/stale rows — do NOT mistake those for fresh HARD-02 evidence. Filter round-trip evidence by timestamp and by the specific Forge/Ástríðr emitters started for the test.

## Runtime State Inventory

> HARD-02 is a secrets/config verification, so the "live service config" and "secrets" categories are load-bearing here. This phase does NOT rename or migrate stored data.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None requiring migration — no key/collection/user_id is being renamed. Existing Convex rows unaffected. | None |
| Live service config | Prod Convex `tidy-whale-981` env: `FORGE_INGEST_API_KEY`, `ASTRIDR_INGEST_API_KEY`, `CODEPULSE_ALLOWED_ORIGIN`, `FORGE_INGEST_ALLOW_ANON`. Set in the Convex deployment (dashboard/CLI), **not in git**. Verify via `npx convex env list`. | Verify (D-02); do NOT re-set unless audit finds exposure |
| OS-registered state | Forge daemon runs as a local process in the forge dir with ephemeral loopback ports; its env is shell-scoped, not OS-registered. | Confirm daemon shell env (D-02 item 1) |
| Secrets / env vars | Forge daemon process env (`FORGE_INGEST_API_KEY` + 3 URL vars) — the un-verified side. astridr-repo `.env` `ASTRIDR_INGEST_API_KEY` already verified matching (07-05). `.env` files are hook-blocked — never read them; verify by round-trip behavior + `convex env list` char-count, not by printing values. | Confirm Forge daemon env matches; update memory (D-03) |
| Build artifacts | `react-day-picker` in `node_modules` + lockfile becomes stale after `calendar.tsx` deletion; `@types/diff@7` / `@types/js-yaml@4` are stale-major artifacts. | `npm uninstall` each; commit lockfile |

## Common Pitfalls

### Pitfall 1: Treating D-10 as four fresh bumps
**What goes wrong:** Re-bumping `diff`/`js-yaml`/`jsdom`/`react-easy-crop` that are already at target on master creates no-op commits and confusion.
**Why it happens:** CONTEXT.md D-10 was written as if they were "pending," but they merged 2026-07-04 (before context was gathered 07-06).
**How to avoid:** Verify each with `node -e "require('./node_modules/<pkg>/package.json').version"` first. For these four, D-10's "each verified independently (tsc + vitest + build)" is satisfied by confirming the *current* master is green + a manual `react-easy-crop` UI check (`src/components/AvatarUploader.tsx` — the sole consumer via `import Cropper from "react-easy-crop"`). Record the folded-scope note in REQUIREMENTS.md as done.
**Warning sign:** `git diff package.json` shows no change when you try to "bump" one of them.

### Pitfall 2: `"types": ["node"]` silently disabling a needed ambient type
**What goes wrong:** Adding a `types` array turns OFF auto-inclusion of every other `@types/*`; if any ambient (non-imported) global was relied upon, new TS errors appear.
**How to avoid:** After adding `"types": ["node"]`, run the FULL `npx tsc --noEmit` (not a subset) and read every new error. Expand the array (e.g., `["node", "vite/client"]`) only as errors dictate. The 184-file explicit-`vitest`-import pattern makes this low-risk but not zero.
**Warning sign:** New TS2304/TS2582 ("Cannot find name 'describe'") after the tsconfig edit → a global was ambient; add its type package to the array or import it.

### Pitfall 3: `.convex.cloud` vs `.convex.site` for the Forge daemon
**What goes wrong:** Daemon env points at `.cloud` (per the checklist examples) but httpActions live on `.site`; ingest 404s or hangs, the round trip silently produces no rows.
**How to avoid:** Ensure the daemon's `CONVEX_FORGE_INGEST_URL` / `FORGE_LOG_INGEST_URL` / `FORGE_FILE_INGEST_URL` target `https://tidy-whale-981.convex.site`. Reuse the known-good `FORGE_LOG_INGEST_URL` base and swap the path (per memory).
**Warning sign:** Daemon logs a POST but no new row appears in the target Convex table.

### Pitfall 4: Mistaking stale war-room emissions for HARD-02 evidence
**What goes wrong:** War-room containers on the pre-94 image emit untraced/sessionless rows; counting them as "fresh round-trip proof" gives false confidence.
**How to avoid:** Start the specific Forge daemon + Ástríðr for the test, filter evidence by post-test timestamp and emitter identity.

### Pitfall 5: The audit fires on a superset of the shipped code (ordering)
**What goes wrong:** Running `/cso` before the dependency changes certifies code that won't ship (e.g., flags `react-day-picker` supply-chain, or the stale `@types`).
**How to avoid:** Honor D-11 — audit LAST, after HARD-04 delete + HARD-03 + the D-10 cleanup land, so `95-SECURITY-AUDIT.md` certifies the actual shipped tree.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security audit pass | A bespoke grep-based scanner | The `/cso` skill (Skill tool) | Single-pass, confidence-gated, writes `.audits/security/<ts>.{md,json}`, enforces the zero-false-positive doctrine |
| Dependency CVE check | Manual advisory lookup | `npm audit` (already 0 vulns) | Native, authoritative, already clean |
| Secret leak detection | Custom git-history regex | GitHub `run_secret_scanning` (MCP) + the existing CI "Secret Scan" step | Push-protection + historical scan; doubles as HARD-02 evidence (D-06) |
| Node globals under TS 6 | Per-file `globalThis` casts everywhere | tsconfig `types` array | One config line vs touching 20+ files (Option B is the fallback, not default) |

## Code Examples

### Verifying an already-merged major is genuinely at target
```bash
# [VERIFIED pattern used this session]
node -e "console.log(require('./node_modules/react-easy-crop/package.json').version)"  # → 6.0.2
git log --oneline -1 -- package.json | cat
```

### The in-repo TS-6-safe node-global workaround (Option B reference)
```typescript
// convex/ingestAuth.ts:9-10 — existing pattern if Option A proves insufficient
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};
```

### Mining a closed PR's CI failure for a breakage list
```bash
gh pr checks 50
gh run view 28493109341 --log-failed 2>&1 | grep -oE "error TS[0-9]+" | sort | uniq -c
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ambient auto-inclusion of `@types/node` globals | Explicit `types`/import required under TS 6.0 | TS 6.0 (this repo: 6.0.3) | The entire HARD-03 breakage; fixed at tsconfig level |
| `@types/diff`, `@types/js-yaml` DefinitelyTyped stubs | `diff@8` / `js-yaml@5` ship first-party types | These majors | The two `@types/*` become redundant → remove |

**Deprecated/outdated:**
- `@types/diff@7.0.2`, `@types/js-yaml@4.0.9` — redundant (bundled types now) AND major-mismatched with runtime; remove.
- CONTEXT.md's framing of D-10 as "pending" majors — superseded by reality (merged 2026-07-04).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (jsdom environment) |
| Config file | `vitest.config.ts` (`environment: 'jsdom'`, line 13) [VERIFIED] |
| Quick run command | `npx vitest run <file>` (single file) |
| Full suite command | `npx vitest run` (184 test files) |
| Type gate | `npx tsc --noEmit` |
| Build gate | `npm run build` (vite/Rolldown) |
| E2E | `npm run test:e2e` (Playwright) — not required by this phase's green bar |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | Exists? |
|-----|----------|-----------|-------------------|---------|
| HARD-03 | Type-check green on TS 6.0.3 | type-check | `npx tsc --noEmit` | ✅ (currently 0 errors on 5.9.3) |
| HARD-03 | Full unit suite green on TS 6 + jsdom 29 | unit | `npx vitest run` | ✅ existing 184 files |
| HARD-03 | Prod build succeeds | build | `npm run build` | ✅ |
| HARD-04 | No `react-day-picker` references remain | grep + build | `grep -r react-day-picker src convex` (expect none) + `npx tsc --noEmit` | ✅ deletion-verified |
| D-10 | `react-easy-crop@6` UI intact | manual | mount `AvatarUploader.tsx` cropper surface | ⚠️ manual (D-10 requires) |
| HARD-01 | 0 dependency CVEs | audit | `npm audit` | ✅ already 0 |
| HARD-02 | Fresh rows from real emitters | manual/integration | inspect prod Convex tables post-emit | ⚠️ manual live (D-02) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` + the affected `npx vitest run <file>`
- **Per bump (D-09/D-10):** full `npx tsc --noEmit && npx vitest run && npm run build`
- **Phase gate:** full suite green before `/gsd:verify-work`; `/cso` verdict = ship

### Wave 0 Gaps
- None — the existing 184-file Vitest suite + tsc + build cover the automated green bar. No new test files are required; HARD-03/04 are verified by the existing suite passing after the changes. The only non-automatable checks are the `react-easy-crop` UI mount (D-10) and the HARD-02 live round trip (D-02), both inherently manual.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (in this repo) |
|---------------|---------|--------------------------------|
| V2 Authentication | yes | Bearer-token auth on ingest httpActions (`validateIngestAuth`, `validateForgeIngestAuth` in `convex/ingestAuth.ts`) |
| V4 Access Control | yes | Fail-open vs fail-closed asymmetry (finding candidate below) |
| V5 Input Validation | yes | Convex `v.` validators on mutations; ingest envelope parsing |
| V6 Cryptography | no (no crypto authored here) | Secrets are opaque bearer tokens; never hand-rolled |
| V13/API | yes | 43 httpAction routes (`convex/http.ts`); CORS allowlist via `CODEPULSE_ALLOWED_ORIGIN` |
| V14 Config | yes | `FORGE_INGEST_ALLOW_ANON`, CORS wildcard fallback, CI secret-scan |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation | Status in repo |
|---------|--------|---------------------|----------------|
| Unauthenticated ingest write | Tampering / Spoofing | Bearer token required | `/forge-ingest` fails **closed**; `/ingest` + `/runtime-ingest` family fail **OPEN** when `ASTRIDR_INGEST_API_KEY` unset (`ingestAuth.ts:74` `if (!expectedKey) return true`) — mitigated in prod (key set, verified 07-05) |
| CORS wildcard fallback | Info disclosure | Origin allowlist | `getCorsHeaders` falls back to `*` when `CODEPULSE_ALLOWED_ORIGIN` unset (`ingestAuth.ts:44-46`) — fail-open by design for dev; prod requires the env var per checklist |
| Anon opt-in left on in prod | Elevation | `FORGE_INGEST_ALLOW_ANON` unset = fail-closed | Correct default; audit should confirm it's not `"true"` in prod |
| Secrets in git history | Info disclosure | GitHub secret scanning + CI Secret Scan step | Run `run_secret_scanning` (D-06); doubles as HARD-02 evidence |
| Dependency CVE | Vulnerable components | `npm audit` | Currently **0 vulnerabilities** |
| LLM cost amplification | DoS (never auto-dropped by /cso) | Spend caps | Out of this phase's diff, but `/cso` Phase 9 will sweep |

**Highest-value `/cso` audit target (D-04 scope):** `convex/ingestAuth.ts` + `convex/http.ts` (43 routes). The genuine, evidenced finding candidate is the **fail-open/fail-closed asymmetry** (`validateIngestAuth` returns `true` on missing key; `validateForgeIngestAuth` returns `false`). This is *prod-mitigated* (the Ástríðr key is set and verified), so per the zero-false-positive doctrine it should be reported honestly as **confirmed, low-severity, mitigated** with the exploit path ("if `ASTRIDR_INGEST_API_KEY` is ever unset in prod, the entire `/ingest`+`/runtime-ingest` family accepts anonymous writes") and a fix option (make it fail-closed like the Forge path, or add a prod boot assertion) — for operator triage per D-05, not an automatic fix.

### `/cso` output shape (for structuring `95-SECURITY-AUDIT.md`, D-07)
The skill writes `.audits/security/<YYYY-MM-DD>-<HHMMSS>.{md,json}` (create `.audits/`, ensure gitignored). JSON schema: `{findings:[{id,title,severity,confidence,status,file,line,quote,exploit,fix}], surface_summary, supply_chain, filter_stats, dropped, scope, threshold}`. Report sections: **Verdict** (ship/fix-first/block) · **Findings** (each with file:line + quote + exploit + fix) · **Surface map** · **Supply chain** · **"What I dropped and why"** (one line). Mirror the Phase 94 `94-SECURITY.md` structure (Trust Boundaries · Threat Register · Accepted Risks Log · Security Audit Trail · Sign-Off) and append the npm-audit + secret-scan results into `95-SECURITY-AUDIT.md`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `"types": ["node"]` alone fully resolves the 22 TS 6.0 errors without introducing new ones | HARD-03 remediation | Low — must run full `tsc --noEmit` to confirm; fallback is Option B or expanding the array. Empirically de-risked by the single-root-cause histogram + explicit vitest imports |
| A2 | No `@types/react-day-picker` or other rdp-coupled config needs cleanup beyond the file + dep | HARD-04 | Very low — package.json inspected; rdp ships own types |
| A3 | The already-merged D-10 majors have no *runtime* regressions beyond what tsc/vitest catch (esp. `react-easy-crop@6` UI) | D-10 | Medium for react-easy-crop UI — D-10 already mandates a manual UI check of `AvatarUploader.tsx`; honor it |
| A4 | js-yaml 5 / diff 8 / jsdom 29 major changelogs contain no behavior change reachable by this repo's usage | Standard Stack | Low — tsc+vitest green on master is strong evidence; execution agents should still skim `react-easy-crop@6` changelog |
| A5 | The `/cso` fail-open finding is prod-mitigated (ASTRIDR key set) and thus low-severity | Security Domain | Low — verified 07-05 in memory; the audit re-confirms via `convex env list` char-count |

## Open Questions

1. **Does `"types": ["node"]` need companions?**
   - Known: node globals fail; all vitest primitives are explicitly imported (184 files).
   - Unclear: whether any ambient-only `@types` (e.g. a `vite/client` reference for `import.meta.env`) is depended upon.
   - Recommendation: apply Option A, run full `tsc --noEmit`, expand the array only as errors dictate. Treat as a 1-line change + verify loop, not a research blocker.

2. **One hardening branch vs per-bump branches (Claude's discretion, D-09/D-10)?**
   - Recommendation: single `hardening/phase-95` branch off master with atomic per-change commits (TS6 fix; `@types` removal; calendar deletion; audit doc). The four D-10 majors are already on master, so per-bump branches for them are moot — just delete the six stale remote dependabot branches as cleanup.

3. **Does the phase redeploy prod Convex?**
   - STATE.md "Operator Next Steps" already lists a pending Phase-93 Convex redeploy. Recommendation: coordinate — if the operator runs the Phase-93 redeploy, the HARD-02 round-trip can piggyback on the fresh deployment rather than issuing a duplicate `npx convex deploy`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node/npm | all bumps + build | ✓ | (repo builds) | — |
| `gh` CLI | mining PR #50 CI, deleting branches | ✓ | authenticated (used this session) | GitHub MCP |
| GitHub MCP `run_secret_scanning` | HARD-01 D-06 | ✓ | — | CI "Secret Scan" step already runs |
| Forge daemon | HARD-02 D-02 round trip | operator-run | — | none — required for live proof |
| Ástríðr (Docker) | HARD-02 D-02 round trip | operator-run | — | none — required for live proof |
| prod Convex `tidy-whale-981` | HARD-02 evidence | ✓ | live | — |

**Missing dependencies with no fallback:** Forge daemon + Ástríðr must be started by the operator for the D-02 live round trip (inherent to the "real emitters" bar).

## Sources

### Primary (HIGH confidence)
- `package-lock.json`, `git log --oneline -- package.json`, `node_modules/*/package.json` — installed versions, merge commits, bundled-types facts
- `gh run view 28493109341 --log-failed` (PR #50 CI) — the complete 22-error TS 6.0.3 breakage inventory
- `convex/ingestAuth.ts`, `convex/http.ts`, `convex/forgeIngest.ts`, `tsconfig.json`, `vitest.config.ts`, `src/components/ui/calendar.tsx` — read directly
- `docs/forge-deploy-checklist.md`, memory `forge-deployment-tidy-whale-981` — HARD-02 env + host rules
- `C:/Users/mandr/.claude/skills/cso/SKILL.md` — audit mechanics + output schema
- `.planning/phases/95-.../95-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`

### Secondary (MEDIUM confidence)
- `grep` sweeps for import sites (react-day-picker, diff, js-yaml, react-easy-crop, Calendar consumers) — verified but grep can miss dynamic references (none expected in this TS codebase)

### Tertiary (LOW confidence)
- Training-data recollection of pre-6.0 TypeScript / pre-5 js-yaml behavior — explicitly NOT relied upon; superseded by live CI + lockfile evidence

## Metadata

**Confidence breakdown:**
- Standard stack / versions: HIGH — ground-truthed from lockfile + git
- HARD-03 breakage inventory: HIGH — full live CI log, single root cause, exhaustive histogram
- HARD-03 exact tsconfig fix: MEDIUM — direction certain, precise incantation needs a verify loop (A1)
- HARD-04 dead-code chain: HIGH — sole importer + zero consumers verified
- HARD-02 remaining work: HIGH — env vars, host rules, and the one un-verified side (Forge daemon) all identified
- HARD-01 surface + audit mechanics: HIGH — skill read, npm audit clean, fail-open finding evidenced at file:line

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 (stable; the only volatility is if new dependabot PRs land or the operator runs the pending Phase-93 redeploy)
