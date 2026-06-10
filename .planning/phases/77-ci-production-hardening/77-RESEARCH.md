# Phase 77: CI & Production Hardening — Research

**Researched:** 2026-06-10
**Domain:** GitHub Actions (gitleaks-action), Convex httpAction CORS, vitest
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove OPS-03 from CodePulse Phase 77; mark N/A (satisfied upstream). CodePulse has no `supabase/` directory — nothing to drift-check. Action: mark OPS-03 N/A in REQUIREMENTS.md with pointer to Ástríðr's `supabase-migration-check.yml`.
- **D-02:** Full git history + fail the build on a real finding. `fetch-depth: 0`, `gitleaks/gitleaks-action@v3`.
- **D-03:** Mirror Ástríðr's `gitleaks-scan.yml` as the template — classify step distinguishes `secret_found` (fail) / `scan_error` (neutral) / `clean` (pass). Mirror `.gitleaks.toml` config.
- **D-04:** CodePulse adaptations: trigger on `push`/`pull_request` to `master` (not `main`); `repo: "codepulse"` in the runtime-ingest notify payload; same Convex ingest URL (`https://tidy-whale-981.convex.site/runtime-ingest`); preserve `permissions: { contents: read, pull-requests: read }`.
- **D-05:** Baseline first — run gitleaks over full history before flipping to fail-on-secret. Allowlist false positives in `.gitleaks.toml` or remediate real findings. Only declare green once the enforced run passes.
- **D-06:** Fail-closed origin allowlist. Replace `_env.CODEPULSE_ALLOWED_ORIGIN ?? "*"` with a parsed comma-separated allowlist. Echo `Access-Control-Allow-Origin` ONLY when request `Origin` is in the allowlist; otherwise omit it.
- **D-07:** Dev fallback: when `CODEPULSE_ALLOWED_ORIGIN` is unset (local dev), permissive behavior is acceptable. Production MUST have the env var set (enforced by deploy checklist).
- **D-08:** Set `CODEPULSE_ALLOWED_ORIGIN` in the Convex cloud deployment and write a deploy checklist documenting the value, where to set it, and procedure.

### Claude's Discretion

- Exact allowlist parsing/matching helper shape in `ingestAuth.ts` (D-06) — trim/normalize trailing slashes, case handling.
- Where the deploy checklist lives (e.g., `docs/DEPLOY.md` or `.planning` ops doc) and its exact format (D-08).
- Whether the gitleaks baseline (D-05) is a local run or a first report-only CI run — planner/executor decides based on what's fastest to verify clean.

### Deferred Ideas (OUT OF SCOPE)

- Ingest-auth fail-open hardening (`validateIngestAuth()` returns `true` when no key configured).
- Consolidating gitleaks into `ci.yml` vs a separate workflow file.
- OPS-03 in Ástríðr — already live there, no action needed.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | `CODEPULSE_ALLOWED_ORIGIN` set in Convex cloud deployment; deploy checklist documents it; production CORS correct for non-local origin | CORS allowlist refactor of `convex/ingestAuth.ts`; `npx convex env set` CLI; per-request origin matching pattern |
| OPS-02 | Gitleaks secret-scan CI workflow passes (green) on `master` | Mirror `astridr-repo/.github/workflows/gitleaks-scan.yml`; gitleaks-action@v3 confirmed; baseline-first protocol |
| OPS-03 | Supabase migration-drift CI check passes (green) on `master` | **N/A — resolved upstream.** Mark N/A in REQUIREMENTS.md; pointer to Ástríðr's `supabase-migration-check.yml` |

</phase_requirements>

---

## Summary

Phase 77 has two real deliverables. OPS-03 is a documentation-only task (mark N/A with upstream pointer).

**OPS-02 (Gitleaks):** CodePulse has no `.github/workflows/gitleaks-scan.yml` and no `.gitleaks.toml`. The Ástríðr repo has both, hardened and live. The work is a near-verbatim mirror with three adaptations: `main` → `master` branch target, `repo: "astridr"` → `repo: "codepulse"` in the notify payload, and a CodePulse-appropriate `.gitleaks.toml` allowlist (the Ástríðr one allowlists its own test fixtures — CodePulse needs its own). The gitleaks-action@v3 release (2026-05-30) changed only the Node runtime (20→24) with no input/behavior changes. For a personal (non-org) GitHub repo, `GITLEAKS_LICENSE` is not required — `GITHUB_TOKEN` is sufficient. The key risk is historical commits containing test keys or example values; a local baseline scan must confirm clean before the enforcing workflow is merged. [VERIFIED: github.com/gitleaks/gitleaks-action]

**OPS-01 (CORS):** The `corsHeaders` object in `convex/ingestAuth.ts` is a module-level static constant exported by name and spread into every Response across 8 handler files (ingest.ts, runtimeIngest.ts, hrIngest.ts, configVersionIngest.ts, otelLogs.ts, otelMetrics.ts, scan.ts, v6Ingest.ts). Since the per-request `Origin` header is not available at module initialization time, the static `corsHeaders` export must be replaced by a function that accepts a `Request` and returns a headers object with `Access-Control-Allow-Origin` set only when the request origin matches the allowlist. All 8 callers must be updated. The env var `CODEPULSE_ALLOWED_ORIGIN` is already documented in `.env.example` (commented out) and is set via `npx convex env set CODEPULSE_ALLOWED_ORIGIN 'value'` against the prod deployment. [VERIFIED: codebase grep + docs.convex.dev]

**Primary recommendation:** Author the gitleaks workflow as a separate file (matches Ástríðr, deferred consolidation into ci.yml); refactor `corsHeaders` to a `getCorsHeaders(request: Request)` function and update all 8 call sites in one pass; run baseline scan locally first.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Secret scanning CI | CI (GitHub Actions) | — | Pure CI concern; no runtime code change |
| CORS origin validation | API / Backend (Convex httpAction) | — | Per-request logic; must run server-side before Response is assembled |
| CORS allowlist configuration | API config (Convex env vars) | — | Deployment env var, not frontend config |
| Deploy checklist | Documentation | — | Ops procedure; lives in `docs/` or `.planning/` |
| OPS-03 N/A annotation | Project documentation | — | Single-line edit to REQUIREMENTS.md traceability table |

---

## Standard Stack

### Core (this phase)

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| gitleaks/gitleaks-action | v3 | Secret scanning in CI | Official gitleaks GitHub Action; actively maintained; Node 24 runtime |
| gitleaks (binary, local) | latest | Baseline scan before CI enforces | Same engine as the action; deterministic results |
| vitest | (existing, ~2.x) | Unit tests for CORS allowlist logic | Already the project test runner; `vi.stubEnv` pattern matches existing `ingestAuth.test.ts` |

No new npm packages are needed for this phase. All work is: (a) a new `.yml` + `.toml` file, (b) a refactor of `convex/ingestAuth.ts` + 8 call site updates, (c) Convex env var config, and (d) a docs file.

**Version verification:** `npm view` is irrelevant — gitleaks-action is a GitHub Action (not npm), and vitest/convex are already installed. [VERIFIED: npm registry check confirmed `gitleaks` npm package is unrelated slop — a 1.0.0 package by an unrelated maintainer; the real tool is the GitHub Action `gitleaks/gitleaks-action` and the binary from `github.com/gitleaks/gitleaks`]

---

## Package Legitimacy Audit

No new external packages are installed in this phase. The work is configuration files, a TypeScript refactor, and Convex env var settings. The only external dependency is the GitHub Action `gitleaks/gitleaks-action@v3`, which is not an npm package.

| Dependency | Type | Age | Maintainer | Source | Disposition |
|------------|------|-----|-----------|--------|-------------|
| gitleaks/gitleaks-action@v3 | GitHub Action | Active (v3.0.0 released 2026-05-30) | gitleaks org | github.com/gitleaks/gitleaks-action | Approved — official project action |

**Note on npm `gitleaks` package:** There is an npm package named `gitleaks` (v1.0.0, 2023, by unrelated maintainer `ycjcl868`). This is NOT the gitleaks scanner and must NOT be installed. The scanner is a Go binary downloaded by the GitHub Action automatically; for local runs, install from `github.com/gitleaks/gitleaks` releases. [VERIFIED: npm view gitleaks]

**Packages removed due to slopcheck [SLOP] verdict:** none (no npm packages needed)
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
OPS-02 (CI path):
  git push/PR to master
       |
       v
  [gitleaks-scan.yml]
    checkout (fetch-depth: 0 — full history)
       |
       v
  [gitleaks-action@v3]  ← GITHUB_TOKEN (no GITLEAKS_LICENSE needed — personal repo)
    continue-on-error: true
       |
       v
  [classify step]
    .sarif file present + findings > 0 ?
      YES → result=secret_found
      NO  → action failed but no .sarif → result=scan_error
      action succeeded → result=clean
       |
       v
  [Notify CodePulse Dashboard]
    POST /runtime-ingest { repo: "codepulse", scanResult: result }
       |
       v
  [Enforce step]
    secret_found → exit 1 (blocks merge)
    scan_error   → exit 0 + ::warning (visible but not blocking)
    clean        → exit 0

OPS-01 (runtime path):
  Ástríðr agent → POST /ingest (or /runtime-ingest etc.)
       |
       v
  [Convex httpAction] — reads request.headers.get("Origin")
       |
       v
  [getCorsHeaders(request)]   ← replaces static corsHeaders export
    parse CODEPULSE_ALLOWED_ORIGIN (comma-split, trim)
    origin in allowlist? → echo it as ACAO header
    not in allowlist?    → omit ACAO header (browser blocks)
    env var unset?       → dev fallback (permissive, not "*" in prod)
       |
       v
  Response with correct ACAO (or none)
```

### Recommended File Changes

```
.github/
  workflows/
    ci.yml                          # UNCHANGED
    gitleaks-scan.yml               # NEW — OPS-02
.gitleaks.toml                      # NEW — OPS-02 allowlist
convex/
  ingestAuth.ts                     # EDIT — OPS-01: corsHeaders → getCorsHeaders(request)
  ingest.ts                         # EDIT — update corsHeaders → getCorsHeaders(request)
  runtimeIngest.ts                  # EDIT — update corsHeaders → getCorsHeaders(request)
  hrIngest.ts                       # EDIT — update corsHeaders → getCorsHeaders(request)
  configVersionIngest.ts            # EDIT — update corsHeaders → getCorsHeaders(request)
  otelLogs.ts                       # EDIT — update corsHeaders → getCorsHeaders(request)
  otelMetrics.ts                    # EDIT — update corsHeaders → getCorsHeaders(request)
  scan.ts                           # EDIT — update corsHeaders → getCorsHeaders(request)
  v6Ingest.ts                       # EDIT — update corsHeaders → getCorsHeaders(request)
  __tests__/ingestAuth.test.ts      # EDIT — add allowlist matcher tests
docs/
  DEPLOY.md                         # NEW — OPS-01 deploy checklist (or .planning/ ops doc)
.planning/REQUIREMENTS.md           # EDIT — mark OPS-03 N/A with upstream pointer
```

### Pattern 1: getCorsHeaders(request) — per-request origin matching

**What:** Replace the static `corsHeaders` module-level export with a function that reads the request `Origin` header and matches it against a parsed allowlist.

**When to use:** Any Convex httpAction that currently spreads `corsHeaders`. Replace `corsHeaders` with `getCorsHeaders(request)` at every call site.

**Example:**
```typescript
// Source: derived from CONTEXT.md D-06 + codebase analysis (convex/ingestAuth.ts)
// Convex does not include @types/node — access process.env via globalThis cast.
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

/**
 * Parse CODEPULSE_ALLOWED_ORIGIN into a Set of allowed origins.
 * Comma-separated, trimmed. Empty string treated as unset.
 */
function parseAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null; // unset → dev fallback handled by caller
  const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);
  return origins.length > 0 ? new Set(origins) : null;
}

const _allowlist = parseAllowlist(_env.CODEPULSE_ALLOWED_ORIGIN);

/**
 * Return CORS headers for the given request.
 * Access-Control-Allow-Origin is only echoed when the request Origin
 * is in the configured allowlist. If the env var is unset (dev mode),
 * falls back to permissive "*".
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  let acao: string;

  if (_allowlist === null) {
    // Dev fallback: env var unset — permissive (not reached in prod if checklist followed)
    acao = "*";
  } else if (_allowlist.has(origin)) {
    // Matched — echo the specific origin back
    acao = origin;
  } else {
    // Not in allowlist — omit the header (browsers will block)
    // Return empty string; callers must NOT spread this header if value is ""
    acao = "";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (acao) {
    headers["Access-Control-Allow-Origin"] = acao;
  }
  return headers;
}
```

**Call site update pattern** (same change in all 8 handler files):
```typescript
// Before:
return new Response(null, { status: 204, headers: corsHeaders });
// After:
return new Response(null, { status: 204, headers: getCorsHeaders(request) });

// Before:
{ status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
// After:
{ status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
```

**Note:** `unauthorizedResponse()` also spreads `corsHeaders` but does not receive a `Request`. Two options: (a) accept `request: Request` parameter in `unauthorizedResponse`, or (b) use a minimal fixed header set for 401s (the request was already rejected — no ACAO needed for 401). Option (b) is simpler; option (a) is more consistent. Claude's discretion.

### Pattern 2: gitleaks-scan.yml — CodePulse adaptation of Ástríðr template

**What:** Near-verbatim copy of `astridr-repo/.github/workflows/gitleaks-scan.yml` with three diffs.

**Diffs from Ástríðr template:**
1. `branches: [main]` → `branches: [master]` (matches CodePulse CI convention per `ci.yml`)
2. `repo: "astridr"` → `repo: "codepulse"` in the `jq` notify payload
3. Workflow `name:` → "Gitleaks Secret Scan" (already matches; keep as-is)

**Note on gitleaks-action version:** Ástríðr uses `actions/checkout@v6` — this is correct; v6 was released and is current. [ASSUMED — checkout@v6 was in the template file verbatim; verify against github.com/actions/checkout releases before publishing]

**Note on GITLEAKS_LICENSE:** CodePulse is a personal repo (not an org). `GITLEAKS_LICENSE` is NOT required. Only `GITHUB_TOKEN` is needed. [VERIFIED: github.com/gitleaks/gitleaks-action README]

### Pattern 3: .gitleaks.toml for CodePulse

**What:** Mirror Ástríðr's structure but with CodePulse-specific paths and patterns.

```toml
title = "codepulse gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Known safe placeholder values in .env.example and test files"
paths = [
    '''.env\.example''',
    '''convex/__tests__/''',
    '''\.planning/phases/.*/.*-RESEARCH\.md''',
]
regexes = [
    # Add any specific patterns discovered in the baseline scan here
]
```

The actual `regexes` entries are determined by the baseline scan results. Start with an empty list; populate only if the baseline reveals false positives.

### Pattern 4: Baseline scan procedure (D-05)

```bash
# Option A: Local (recommended — fastest feedback loop)
# Install gitleaks binary from https://github.com/gitleaks/gitleaks/releases
# Then from the CodePulse repo root:
gitleaks git --report-path=baseline-report.json .
# Review baseline-report.json — add false positives to .gitleaks.toml allowlist
# Real secrets: rotate first, then optionally rebase/filter history

# Option B: Report-only CI run (first pass before enforce)
# Set continue-on-error: true on the Enforce step, merge, observe output
# Then remove continue-on-error and merge again once clean
```

Recommended: local scan. The `.env.example` file has commented-out placeholder values and a test JWT prefix (`pk_test_`) — these are the most likely false-positive candidates. Ástríðr's `.gitleaks.toml` allowlists the `.planning/phases/*/RESEARCH.md` path, which is wise to carry forward (planning docs may contain example tokens).

### Anti-Patterns to Avoid

- **Using the npm `gitleaks` package (v1.0.0):** This is an unrelated package, not the gitleaks scanner. Never run `npm install gitleaks`. [VERIFIED: npm registry — wrong package]
- **Setting `GITLEAKS_LICENSE` from a secret for a personal repo:** Not needed; clutters the workflow with an undefined secret that causes confusing "secret not found" warnings.
- **Keeping `corsHeaders` as a static constant after D-06:** The `Origin` header is per-request; a static constant computed at module load time cannot match request origins. If spread unchanged, `ACAO: "*"` leaks into prod.
- **Updating only `ingestAuth.ts` but not the 8 callers:** The `unauthorizedResponse()` function also spreads `corsHeaders` and must be reviewed. Six handler files each call `getCorsHeaders` independently — all must be updated in one pass to avoid an inconsistent state.
- **Omitting `fetch-depth: 0`:** Without it, `actions/checkout` fetches a shallow clone (depth 1). Gitleaks only scans the commits it can see — a shallow clone misses all historical secrets. This setting is mandatory for D-02. [VERIFIED: gitleaks-action README + Ástríðr template uses it]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret detection patterns | Custom regex secret scanner | gitleaks default rules (`useDefault = true`) | 100+ detection patterns maintained by security community; hand-rolled patterns miss common key formats |
| SARIF parse / finding count | Custom jq query to count findings | The pattern from Ástríðr's classify step: `jq '[.runs[]?.results[]?] | length'` | Handles nested SARIF structure; recursive `.sarif` file find guards against path/filename changes |
| Per-origin CORS matching | Roll your own origin store | Simple `Set<string>` parsed from env var | The problem is trivial; complexity lives in the call-site threading, not the matcher itself |

**Key insight:** For secret scanning, the value is in the detection rules, not the runner infrastructure. The 3-state classify pattern is Ástríðr's key contribution — it prevents `scan_error` from being misread as a secret leak, which erodes trust in the CI signal.

---

## Common Pitfalls

### Pitfall 1: `scan_error` misread as secret leak

**What goes wrong:** Without the classify step, a gitleaks-action failure (from a 403 permissions error, rate limit, or network issue) shows as a red check. Reviewers assume a secret was found. They investigate, find nothing, and start ignoring the check.
**Why it happens:** `continue-on-error: true` is needed to allow classification, but without it the raw failure is the terminal state.
**How to avoid:** Mirror the classify step exactly. The SARIF file presence + jq count is the distinguishing signal.
**Warning signs:** Red check with no SARIF artifact in Actions artifacts tab.

### Pitfall 2: Static `corsHeaders` in production echoes `"*"`

**What goes wrong:** If `CODEPULSE_ALLOWED_ORIGIN` is set in Convex prod but `corsHeaders` is still a static export (not a function), the module-level init reads the env var once at deploy time — which is correct. BUT the current code is `_env.CODEPULSE_ALLOWED_ORIGIN ?? "*"` without any per-request matching, so it echoes the full env var value verbatim as ACAO, not selectively per-request origin. A value like `"https://codepulse.example.com"` would work for that one origin, but a comma-separated list like `"https://codepulse.example.com,http://localhost:5173"` would break — the ACAO header cannot contain multiple origins; it must echo exactly the request origin or be absent.
**Why it happens:** ACAO does not accept comma-separated values. Browsers require ACAO to exactly match the request Origin (or be `"*"` for non-credentialed).
**How to avoid:** The `getCorsHeaders(request)` pattern is mandatory. Parse the env var into a Set once at module load; match per-request.
**Warning signs:** CORS errors in browser console even though the origin is in the list.

### Pitfall 3: `unauthorizedResponse()` left with stale static headers

**What goes wrong:** `unauthorizedResponse()` spreads `corsHeaders` (the old static export). After refactoring, if it's not updated, it either: (a) errors because `corsHeaders` was deleted, or (b) uses a zero-origin header object.
**Why it happens:** The function doesn't accept a `Request` argument.
**How to avoid:** Either add a `request: Request` param to `unauthorizedResponse()` and call `getCorsHeaders(request)`, or use a minimal safe headers object (no ACAO). The latter is simpler since a 401 doesn't need ACAO.
**Warning signs:** TypeScript compile error or test failure for `unauthorizedResponse`.

### Pitfall 4: `vi.stubEnv` not effective for `_env` module-level init

**What goes wrong:** The existing `ingestAuth.test.ts` uses `vi.stubEnv("ASTRIDR_INGEST_API_KEY", ...)` which stubs `process.env`. But `_env` is initialized once at module load via `(globalThis as any).process?.env ?? {}`. If vitest evaluates the module before stubbing, `_env` will be stale.
**Why it happens:** ES module top-level initialization runs once. `vi.stubEnv` patches `process.env` at the process level, but since `_env` is a snapshot copy, subsequent `vi.stubEnv` calls don't update it.
**How to avoid for the new allowlist (`_allowlist`):** The `_allowlist` constant is computed at module init from `_env.CODEPULSE_ALLOWED_ORIGIN`. For unit tests of the allowlist matcher, extract the pure parsing logic (`parseAllowlist(raw)`) as a separately testable function — test it directly with raw string inputs, not via env var stubbing. This avoids the module cache problem entirely and produces cleaner tests.
**Warning signs:** Tests pass when run in isolation but fail when run in suite order, or vice versa.

### Pitfall 5: `actions/checkout@v6` vs v4 — action version mismatch

**What goes wrong:** The Ástríðr template uses `actions/checkout@v6`. The existing `ci.yml` uses `actions/checkout@v4`. Using v6 in the new workflow is fine (v6 is current), but the planner should note the mismatch — it's not a bug but may prompt a separate cleanup.
**Why it happens:** `ci.yml` was authored before v6 was released.
**How to avoid:** Use `actions/checkout@v6` in `gitleaks-scan.yml` as the template specifies. Do not downgrade to v4 just to match `ci.yml`. [ASSUMED — checkout@v6 is referenced in the Ástríðr template; confirm it exists at github.com/actions/checkout]

---

## Code Examples

### Existing ingestAuth.test.ts pattern (reference for new tests)

The existing test file at `convex/__tests__/ingestAuth.test.ts` shows the established vitest pattern for this module:
- Uses `vi.stubEnv` + `vi.unstubAllEnvs()` per test
- Uses `new Request(url, { method, headers })` directly — no mocking needed
- Tests are in `describe("ingestAuth (CPHLTH-02)", ...)` block

**New tests to add for OPS-01:**

```typescript
// Source: derived from codebase pattern + D-06 requirements
describe("getCorsHeaders — CORS allowlist (OPS-01)", () => {
  it("echoes matched origin as ACAO when allowlist is configured", () => {
    // Test parseAllowlist + matching directly (avoid module cache issues)
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "https://example.com" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
  });

  it("omits ACAO when origin is not in allowlist", () => {
    const allowlist = parseAllowlist("https://example.com");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "https://evil.com" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("omits ACAO when request has no Origin header and allowlist is set", () => {
    const allowlist = parseAllowlist("https://example.com");
    const req = new Request("https://tidy-whale-981.convex.site/ingest");
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("returns permissive '*' when CODEPULSE_ALLOWED_ORIGIN is unset (dev fallback)", () => {
    const allowlist = parseAllowlist(undefined);
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "http://localhost:5173" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("handles comma-separated list — second origin also matches", () => {
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "http://localhost:5173" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("handles allowlist entries with surrounding whitespace", () => {
    const allowlist = parseAllowlist("  https://example.com , http://localhost:5173  ");
    expect(allowlist?.has("https://example.com")).toBe(true);
    expect(allowlist?.has("http://localhost:5173")).toBe(true);
  });
});
```

**Key insight:** Export `parseAllowlist` and a `getCorsHeadersWithAllowlist(request, allowlist)` as testable units, then make the module-level `getCorsHeaders(request)` a thin wrapper. This sidesteps the `vi.stubEnv` / module-cache problem entirely.

### Convex env var CLI commands

```bash
# Source: docs.convex.dev/production/environment-variables [VERIFIED]

# Set in production deployment
npx convex env set CODEPULSE_ALLOWED_ORIGIN 'https://your-dashboard-origin.com'

# Set multiple origins (comma-separated, no spaces around comma)
npx convex env set CODEPULSE_ALLOWED_ORIGIN 'https://your-dashboard.vercel.app,http://localhost:5173'

# Verify the value was set
npx convex env list

# Targets the deployment specified by CONVEX_DEPLOY_KEY or the active `npx convex dev` context
# For explicit prod targeting:
npx convex env set --prod CODEPULSE_ALLOWED_ORIGIN 'value'
```

### Gitleaks local baseline scan

```bash
# Source: github.com/gitleaks/gitleaks [VERIFIED CLI pattern]

# Full git history scan — outputs JSON report
gitleaks git --report-path=gitleaks-baseline.json .

# With verbose output to see which commits/files are scanned
gitleaks git -v --report-path=gitleaks-baseline.json .

# If findings: review baseline.json, add false positives to .gitleaks.toml
# Real findings: rotate the secret first, then optionally rewrite history
# Then re-run until clean before merging the CI workflow
```

---

## Runtime State Inventory

> Skipped — this is not a rename/refactor/migration phase.

---

## Environment Availability

| Dependency | Required By | Available | Notes | Fallback |
|------------|------------|-----------|-------|----------|
| GitHub Actions (ubuntu-latest) | OPS-02 gitleaks CI | Always available | Cloud-hosted runner | — |
| gitleaks binary (local) | D-05 baseline scan | Must install manually | Download from github.com/gitleaks/gitleaks/releases; not on npm | Use report-only CI run as alternative |
| `npx convex env set` | OPS-01 prod config | Available (convex CLI in project) | Requires `CONVEX_DEPLOY_KEY` or logged-in `npx convex dev` context | Dashboard UI at convex.dev |
| vitest | Unit tests | Already installed | `npx vitest run` per `ci.yml` | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:**
- gitleaks local binary: if not installed, use a report-only first CI run to see findings (D-05 Claude's Discretion)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run convex/__tests__/ingestAuth.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Matched origin → ACAO echoed | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | Exists — expand |
| OPS-01 | Unmatched origin → ACAO omitted | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | Exists — expand |
| OPS-01 | Unset env var → dev fallback `"*"` | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | Exists — expand |
| OPS-01 | Comma-separated list parses correctly | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | Exists — expand |
| OPS-01 | `CODEPULSE_ALLOWED_ORIGIN` set in Convex prod | manual checklist | `npx convex env list` | Manual — deploy checklist |
| OPS-02 | Workflow file exists + valid YAML | CI observable | Push to master / open PR | Wave 0 — create file |
| OPS-02 | Workflow goes green on clean repo | CI observable | Push to master | Wave 0 — create file |
| OPS-02 | secret_found → exit 1 (blocks merge) | manual validation | Introduce test secret, observe | Manual — remove after test |
| OPS-03 | N/A annotation in REQUIREMENTS.md | manual review | Read REQUIREMENTS.md | Single-line edit |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/__tests__/ingestAuth.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full vitest suite green + gitleaks CI green on master before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `convex/__tests__/ingestAuth.test.ts` — add 5-6 allowlist matcher tests (file exists; expand it)
- [ ] `.github/workflows/gitleaks-scan.yml` — create new file (OPS-02)
- [ ] `.gitleaks.toml` — create new file (OPS-02)

*(No new test infrastructure needed — vitest is already installed and configured)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | not changed this phase |
| V3 Session Management | no | not applicable |
| V4 Access Control | yes | CORS origin allowlist (OPS-01); fail-closed = deny by default |
| V5 Input Validation | yes | origin header is untrusted input; parsed against a Set, not evaluated |
| V6 Cryptography | no | not applicable |
| V14 Configuration | yes | secrets in env vars, not source; CODEPULSE_ALLOWED_ORIGIN documented in deploy checklist |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-origin request forgery via CORS wildcard | Elevation of Privilege | Replace `"*"` with per-request origin matching against allowlist (OPS-01) |
| Exposed secrets in git history | Information Disclosure | Gitleaks full-history scan + fail-on-secret CI enforcement (OPS-02) |
| scan_error misread as security incident | Spoofing | 3-state classify pattern distinguishes infra errors from real findings |
| Origin header spoofing (server-to-server) | Spoofing | CORS is a browser enforcement mechanism; for non-browser callers (Ástríðr agent), the origin header can be set arbitrarily. CORS hardening protects browser-based access; API key auth (`validateIngestAuth`) is the server-to-server control. Both layers are independent. |

**Note on threat boundary:** The CORS allowlist protects browser-initiated cross-origin requests. Ástríðr agents are server-side HTTP clients that POST directly without a browser — they are unaffected by CORS. The CORS change is strictly a browser security improvement; the actual ingest auth gate is `validateIngestAuth()` (deferred from this phase). Both should be documented in the deploy checklist so future maintainers understand which control does what. [ASSUMED — standard CORS spec behavior; verify against specific Convex httpAction docs if uncertain]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Static `corsHeaders` object | `getCorsHeaders(request)` per-request function | Browser-correct: ACAO must exactly match request Origin or be absent |
| No secret scanning | gitleaks-action@v3, full history, 3-state classify | CI blocks merge on real secret; scan infra errors surface as warnings, not false alarms |
| Manual CORS origin tracking | Comma-separated `CODEPULSE_ALLOWED_ORIGIN` + deploy checklist | Developer can add/change origins without touching code |

**Deprecated/outdated:**
- `corsHeaders` static export: replaced by `getCorsHeaders(request)` — keep backward compat during transition by exporting both temporarily, or do the call-site update in one atomic commit

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/checkout@v6` is a valid, current version (inferred from Ástríðr template) | Standard Stack, Pitfalls | If v6 doesn't exist, workflow fails to load — easy fix, change to v4 |
| A2 | `--prod` flag is a valid `npx convex env set` option for explicit prod targeting | Code Examples | If not supported, use `CONVEX_DEPLOY_KEY` env var instead; dashboard UI always works |
| A3 | CORS is browser-only enforcement; Ástríðr agents are unaffected by the allowlist change | Security Domain | If Ástríðr agents send `Origin` headers and ACAO is required for non-browser fetch, they could break — verify ingest still works after deploy |

**If this table were empty:** All claims were verified or cited. A1-A3 are the only unverified details.

---

## Open Questions (RESOLVED)

1. **`unauthorizedResponse()` and CORS headers**
   - What we know: it spreads the old static `corsHeaders`; a 401 response
   - What's unclear: does a 401 preflight response need ACAO to be browser-visible, or can it omit it?
   - **RESOLVED:** PATTERNS.md Option A (recommended) — drop ACAO from 401 responses; use minimal fixed headers `{ "Content-Type": "application/json" }`. A 401 does not negotiate CORS. No `request` param added. Locked in 77-01-PLAN.md Task 1.

2. **Exact Convex prod deployment URL**
   - What we know: the ingest URL is `https://tidy-whale-981.convex.site`; the deploy uses `CONVEX_DEPLOY_KEY`
   - What's unclear: the exact value of `CODEPULSE_ALLOWED_ORIGIN` to set (dashboard origin depends on where the frontend is deployed — Vercel? Netlify?)
   - **RESOLVED:** Per CONTEXT D-08 + Claude's Discretion — the deploy checklist (`docs/DEPLOY.md`, 77-03-PLAN.md) documents this as a fill-in ("set to your deployed frontend origin, e.g. Vercel/Netlify URL + localhost dev"), NOT a hardcoded value. The concrete value is an operator deploy-time input, out of scope for the code.

3. **gitleaks binary on Windows (local baseline scan)**
   - What we know: the binary is available from github.com/gitleaks/gitleaks releases for all platforms
   - What's unclear: whether Larry has it installed locally
   - **RESOLVED:** 77-02-PLAN.md Task 2 documents both paths — local binary if available, else the report-only first-`master`-run CI fallback. Executor picks based on availability and records the disposition in the SUMMARY.

---

## Sources

### Primary (HIGH confidence)
- `astridr-repo/.github/workflows/gitleaks-scan.yml` — the exact template; read in full
- `convex/ingestAuth.ts` — current state of CORS (line 12-16) and `validateIngestAuth`
- `convex/__tests__/ingestAuth.test.ts` — existing test pattern; `vi.stubEnv` approach
- `vitest.config.ts` — test runner config; `convex/**/*.test.ts` is included
- docs.convex.dev/production/environment-variables — `npx convex env set` CLI [VERIFIED: WebFetch]
- github.com/gitleaks/gitleaks-action — license requirement (personal repos: no `GITLEAKS_LICENSE` needed); v3.0.0 release notes [VERIFIED: WebFetch]

### Secondary (MEDIUM confidence)
- github.com/gitleaks/gitleaks — CLI commands (`gitleaks git --report-path`), exit codes, full-history scan [VERIFIED: WebFetch]
- `.env.example` — confirms `CODEPULSE_ALLOWED_ORIGIN` is already documented as a Convex server-side env var

### Tertiary (LOW confidence / ASSUMED)
- A1: `actions/checkout@v6` existence (inferred from Ástríðr template file, not independently verified via github.com/actions/checkout releases page)
- A2: `npx convex env set --prod` flag syntax

---

## Metadata

**Confidence breakdown:**
- OPS-02 Gitleaks workflow: HIGH — template is exact, action docs verified, no new packages
- OPS-01 CORS refactor: HIGH — current code is in hand; pattern is standard; 8 call sites confirmed by grep
- Vitest test pattern: HIGH — existing test file shows exact pattern to extend
- `npx convex env set` CLI: HIGH (verified via official docs)
- `actions/checkout@v6` version: MEDIUM (from template, not independently confirmed)

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable stack; gitleaks-action@v3 just released — unlikely to change soon)
