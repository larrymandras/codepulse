# Phase 77: CI & Production Hardening — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 12 (1 ingestAuth.ts source + 8 handler files + 1 test file + 2 new CI files)
**Analogs found:** 10 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/ingestAuth.ts` | utility/auth | request-response | itself (current shape) | self-refactor |
| `convex/ingest.ts` | httpAction handler | request-response | `convex/hrIngest.ts` | exact |
| `convex/runtimeIngest.ts` | httpAction handler | request-response | `convex/hrIngest.ts` | exact |
| `convex/hrIngest.ts` | httpAction handler | request-response | `convex/scan.ts` | exact |
| `convex/configVersionIngest.ts` | httpAction handler | request-response | `convex/scan.ts` | exact |
| `convex/otelLogs.ts` | httpAction handler | request-response | `convex/otelMetrics.ts` | exact |
| `convex/otelMetrics.ts` | httpAction handler | request-response | `convex/otelLogs.ts` | exact |
| `convex/scan.ts` | httpAction handler | request-response | `convex/hrIngest.ts` | exact |
| `convex/v6Ingest.ts` | httpAction handler (6 actions) | request-response | `convex/hrIngest.ts` | exact |
| `convex/__tests__/ingestAuth.test.ts` | test | — | itself (existing file, expand) | self-extend |
| `.github/workflows/gitleaks-scan.yml` | CI workflow | — | `astridr-repo/.github/workflows/gitleaks-scan.yml` | exact (adapt 3 lines) |
| `.gitleaks.toml` | CI config | — | `astridr-repo/.gitleaks.toml` | role-match (adapt paths) |

---

## Pattern Assignments

### `convex/ingestAuth.ts` (utility/auth — self-refactor)

**Current shape** (all 39 lines, read in full):

**`_env` access pattern** (lines 9-10):
```typescript
// Convex does not include @types/node — access process.env via globalThis cast.
const _env: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};
```

**Current `corsHeaders` definition to replace** (lines 12-16):
```typescript
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": _env.CODEPULSE_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
```

**`unauthorizedResponse()` — spreads `corsHeaders`, must be updated** (lines 33-38):
```typescript
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}
```

**Target shape after refactor:**
- Delete the `corsHeaders` export constant.
- Add exported `parseAllowlist(raw: string | undefined): Set<string> | null` (pure, testable directly).
- Add module-level `const _allowlist = parseAllowlist(_env.CODEPULSE_ALLOWED_ORIGIN);` (computed once at init).
- Add exported `getCorsHeaders(request: Request): Record<string, string>` that matches `request.headers.get("Origin")` against `_allowlist`.
- Update `unauthorizedResponse()`: either add a `request: Request` parameter and call `getCorsHeaders(request)`, OR replace the spread with a minimal fixed header set (no ACAO — a 401 doesn't require it and the request was already rejected). **Recommended: minimal fixed headers (simpler, no parameter threading).**

**`validateIngestAuth` is unchanged** (lines 23-28 — do not touch):
```typescript
export function validateIngestAuth(request: Request): boolean {
  const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
  if (!expectedKey) return true;
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```

---

### `convex/ingest.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 4):
```typescript
// Before:
import { corsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
// After:
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

**OPTIONS preflight — line 14** (3 occurrences of this pattern across the file):
```typescript
// Before:
return new Response(null, { status: 204, headers: corsHeaders });
// After:
return new Response(null, { status: 204, headers: getCorsHeaders(request) });
```

**Success response — line 366**:
```typescript
// Before:
return new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "Content-Type": "application/json", ...corsHeaders },
});
// After:
return new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
});
```

**Error response — line 371**:
```typescript
// Before:
return new Response(JSON.stringify({ error: e.message }), {
  status: 400,
  headers: { "Content-Type": "application/json", ...corsHeaders },
});
// After:
return new Response(JSON.stringify({ error: e.message }), {
  status: 400,
  headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
});
```

**Total `corsHeaders` → `getCorsHeaders(request)` replacements in `ingest.ts`: 4**
(lines 14, 367, 372 — note import on line 4 also changes)

---

### `convex/runtimeIngest.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern as `ingest.ts`.

**All `corsHeaders` usages** (lines 16, 963, 968):
- Line 16: OPTIONS 204 preflight — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 963: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 968: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 4** (3 usages + import)

---

### `convex/hrIngest.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern.

**All `corsHeaders` usages** (lines 7, 19, 43, 49):
- Line 7: OPTIONS 204 — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 19: validation 400 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 43: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 49: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 5** (4 usages + import)

---

### `convex/configVersionIngest.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern.

**All `corsHeaders` usages** (lines 12, 33, 47, 53):
- Line 12: OPTIONS 204 — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 33: validation 400 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 47: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 53: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 5** (4 usages + import)

---

### `convex/otelLogs.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern.

**All `corsHeaders` usages** (lines 62, 73, 124, 132):
- Line 62: OPTIONS 204 — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 73: 415 unsupported content type — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 124: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 132: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 5** (4 usages + import)

---

### `convex/otelMetrics.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern.

**All `corsHeaders` usages** (lines 39, 49, 105, 113):
- Line 39: OPTIONS 204 — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 49: 415 unsupported content type — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 105: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 113: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 5** (4 usages + import)

---

### `convex/scan.ts` (httpAction handler — CORS call sites)

**Import line to update** (line 3): same pattern.

**All `corsHeaders` usages** (lines 12, 25, 31):
- Line 12: OPTIONS 204 — `headers: corsHeaders` → `headers: getCorsHeaders(request)`
- Line 25: success 200 — `...corsHeaders` → `...getCorsHeaders(request)`
- Line 31: error 400 — `...corsHeaders` → `...getCorsHeaders(request)`

**Total replacements: 4** (3 usages + import)

---

### `convex/v6Ingest.ts` (6 httpAction handlers — CORS call sites)

**Import line to update** (line 3): same pattern.

This file contains 6 separate `httpAction` exports. Each follows the identical pattern:
- `if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });`
- One or more validation 400 responses with `...corsHeaders`
- A success 200 response with `...corsHeaders`
- A catch-block 400 response with `...corsHeaders`

**Handlers and their OPTIONS lines:**
- `preflightIngest` — OPTIONS at line 10; validation 400 at line 28; success 200 at line 40; error 400 at line 46
- `dreamingIngest` — OPTIONS at line 56; multiple validation 400s; success 200 at line 118; error 400 at line 122
- `advisorIngest` — OPTIONS at line 135; validation 400 at line 148; success 200 at line 165; error 400 at line 170
- `importIngest` — OPTIONS at line 183; validation 400 at line 196; success 200 at line 210; error 400 at line 215
- `startupIngest` — OPTIONS at line 229; validation 400 at line 237; success 200 at line 242; error 400 at line (after 261)
- `authAliasIngest` — OPTIONS at line 274; validation 400 at line 287; success 200 at line 298; error 400 at line (after 306)

**Mechanical replacement:** Every `corsHeaders` (after the import on line 3) → `getCorsHeaders(request)`. The `request` binding is always in scope as the second parameter of `httpAction(async (ctx, request) => { ... })`.

**Total replacements in v6Ingest.ts: ~25+** (1 import + many spreads across 6 handlers)

---

### `convex/__tests__/ingestAuth.test.ts` (test — expand existing)

**Current test file shape** (62 lines, read in full):

**Import line to update** (line 2):
```typescript
// Before:
import { validateIngestAuth, corsHeaders } from "../ingestAuth";
// After:
import { validateIngestAuth, parseAllowlist, getCorsHeaders } from "../ingestAuth";
// (remove corsHeaders import; add the two new exported functions)
```

**Existing test structure to follow** (lines 10-62):
```typescript
describe("ingestAuth (CPHLTH-02)", () => {
  it("rejects request without Authorization header", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const req = new Request("http://localhost/ingest", { method: "POST" });
    expect(validateIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });
  // ... 4 more validateIngestAuth tests
  it("CORS headers include POST in allowed methods", () => {
    expect(corsHeaders["Access-Control-Allow-Methods"]).toContain("POST");
  });
  it("CORS headers include Authorization in allowed headers", () => {
    expect(corsHeaders["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});
```

**Last two tests (lines 55-62) test `corsHeaders` directly — update them** to test the new exports instead:
```typescript
// Replace the two corsHeaders property tests with getCorsHeaders equivalents:
it("CORS headers include POST in allowed methods (dev fallback)", () => {
  const req = new Request("http://localhost/ingest");
  const headers = getCorsHeaders(req);
  expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
});
it("CORS headers include Authorization in allowed headers (dev fallback)", () => {
  const req = new Request("http://localhost/ingest");
  const headers = getCorsHeaders(req);
  expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
});
```

**New `describe` block to add — test `parseAllowlist` directly** (avoids module-cache problem — do NOT use `vi.stubEnv` for allowlist tests):
```typescript
describe("parseAllowlist + getCorsHeaders — CORS allowlist (OPS-01)", () => {
  it("echoes matched origin as ACAO when allowlist is configured", () => {
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "https://example.com" },
    });
    // Call getCorsHeaders with the allowlist injected via the pure path
    // (see note below on test strategy)
  });
});
```

**CRITICAL TEST STRATEGY NOTE:** `_allowlist` is a module-level constant computed once at import time from `_env.CODEPULSE_ALLOWED_ORIGIN`. `vi.stubEnv` patches `process.env` but `_env` is a snapshot — subsequent stubs do not update `_allowlist`. **Solution:** Export `parseAllowlist` as a pure function and test it directly with raw string inputs. Optionally export a `getCorsHeadersFromAllowlist(request: Request, allowlist: Set<string> | null)` testable helper (the module-level `getCorsHeaders` becomes a thin wrapper calling it with `_allowlist`). This keeps all logic testable without module-cache tricks.

**Test cases to add for OPS-01 (6 tests):**
1. `parseAllowlist` with comma-separated list → returns Set with both entries
2. `parseAllowlist` with surrounding whitespace → trims correctly
3. `parseAllowlist(undefined)` → returns `null` (dev fallback signal)
4. Matched origin → ACAO header echoes that exact origin
5. Unmatched origin → ACAO header absent
6. No Origin header + allowlist set → ACAO header absent

---

### `.github/workflows/gitleaks-scan.yml` (new CI workflow)

**Analog:** `C:\Users\mandr\astridr-repo\.github\workflows\gitleaks-scan.yml` (137 lines, read in full)

**Copy verbatim, then apply exactly 3 diffs:**

**Diff 1 — branch target** (line 5 in template):
```yaml
# Before (Ástríðr template):
    branches: [main]
# After (CodePulse):
    branches: [master]
```

**Diff 2 — repo field in notify payload** (line 89 in template):
```yaml
# Before (Ástríðr template):
              --arg repo "astridr" \
# After (CodePulse):
              --arg repo "codepulse" \
```

**Diff 3 — no change needed to workflow name** ("Gitleaks Secret Scan" is already generic).

**Preserve verbatim:**
- `fetch-depth: 0` (mandatory for full history scan — D-02)
- `gitleaks/gitleaks-action@v3` with `continue-on-error: true`
- `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (no `GITLEAKS_LICENSE` — personal repo)
- `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: "true"`
- The 3-state classify step (lines 36-67): `secret_found` / `scan_error` / `clean`
- The `CODEPULSE_INGEST_URL` env var (line 16): already points to `https://tidy-whale-981.convex.site` — correct for CodePulse
- `permissions: { contents: read, pull-requests: read }` (lines 8-13)
- `actions/checkout@v6` (matches template; differs from `ci.yml` which uses v4 — this is intentional, do not downgrade)

**Key structural pattern** (the classify step logic to preserve exactly, lines 39-67 of template):
```bash
OUTCOME="${{ steps.gitleaks.outcome }}"
if [ "$OUTCOME" = "success" ]; then
  echo "result=clean" >> "$GITHUB_OUTPUT"
  exit 0
fi
FINDINGS=0
while IFS= read -r f; do
  n=$(jq '[.runs[]?.results[]?] | length' "$f" 2>/dev/null || echo 0)
  FINDINGS=$((FINDINGS + ${n:-0}))
done < <(find . -name '*.sarif' 2>/dev/null)
if [ "${FINDINGS:-0}" -gt 0 ]; then
  echo "result=secret_found" >> "$GITHUB_OUTPUT"
else
  echo "result=scan_error" >> "$GITHUB_OUTPUT"
fi
```

---

### `.gitleaks.toml` (new CI config)

**Analog:** `C:\Users\mandr\astridr-repo\.gitleaks.toml` (26 lines, read in full)

**Mirror structure, adapt for CodePulse:**

```toml
title = "codepulse gitleaks config"    # was: "astridr gitleaks config"

[extend]
useDefault = true                       # keep — inherits 100+ detection rules

[allowlist]
description = "Known safe placeholder values in .env.example and test files"
paths = [
    '''.env\.example''',               # keep — has commented-out placeholder values
    '''convex/__tests__/''',           # CodePulse equivalent of Ástríðr's tests/unit/ paths
    '''\.planning/phases/.*/.*-RESEARCH\.md''',  # keep — planning docs may contain example tokens
]
regexes = [
    # Populated by baseline scan results only.
    # Do NOT copy Ástríðr's regexes — they are Ástríðr-specific test fixtures
    # (Supabase demo JWTs, sk-ant keys, Slack tokens, LiveKit keys, etc.)
    # that have no counterpart in CodePulse history.
]
```

**Key difference from Ástríðr template:** Drop all 10 `regexes` entries from Ástríðr's toml. Those allowlist Ástríðr's specific test fixture values. Run baseline scan first; add CodePulse-specific false-positive regexes only if the baseline scan finds them.

---

## Shared Patterns

### CORS Import Change (applies to all 8 handler files)

**Source:** `convex/ingestAuth.ts` (after refactor)
**Apply to:** All 8 handler files (`ingest.ts`, `runtimeIngest.ts`, `hrIngest.ts`, `configVersionIngest.ts`, `otelLogs.ts`, `otelMetrics.ts`, `scan.ts`, `v6Ingest.ts`)

Every handler currently has:
```typescript
import { corsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
```
Change to:
```typescript
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

### CORS Usage Replacement (all 8 handler files)

Two patterns appear in every handler, repeated at every response site:

**Pattern A — OPTIONS preflight (every handler has exactly one):**
```typescript
// Before:
return new Response(null, { status: 204, headers: corsHeaders });
// After:
return new Response(null, { status: 204, headers: getCorsHeaders(request) });
```

**Pattern B — all other responses (200, 400, 415 spread):**
```typescript
// Before:
{ status: NNN, headers: { "Content-Type": "application/json", ...corsHeaders } }
// After:
{ status: NNN, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
```

The `request` binding is always the second parameter of `httpAction(async (ctx, request) => { ... })` and is always in scope at every response site.

### `unauthorizedResponse()` Special Case

**Source:** `convex/ingestAuth.ts` line 33-38
**Apply to:** `ingestAuth.ts` only

`unauthorizedResponse()` has no `request` parameter. Two valid options (planner chooses):
- **Option A (simpler):** Replace `...corsHeaders` spread with minimal fixed headers — no ACAO (a 401 rejection does not require cross-origin headers; the browser will see the 401 status regardless):
  ```typescript
  export function unauthorizedResponse(): Response {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  ```
- **Option B (consistent):** Add `request: Request` parameter and call `getCorsHeaders(request)`. Requires updating all 9 call sites (`return unauthorizedResponse();` → `return unauthorizedResponse(request);`).

Option A is recommended — fewer changes, correct behavior (401 doesn't negotiate CORS).

---

## Call-Site Count Verification

RESEARCH claimed 8 handler files. Verified from live code:

| File | OPTIONS usages | Other `...corsHeaders` usages | Total `corsHeaders` refs (excl. import) |
|------|---------------|------------------------------|----------------------------------------|
| `ingest.ts` | 1 (line 14) | 2 (lines 367, 372) | 3 |
| `runtimeIngest.ts` | 1 (line 16) | 2 (lines 963, 968) | 3 |
| `hrIngest.ts` | 1 (line 7) | 3 (lines 19, 43, 49) | 4 |
| `configVersionIngest.ts` | 1 (line 12) | 3 (lines 33, 47, 53) | 4 |
| `otelLogs.ts` | 1 (line 62) | 3 (lines 73, 124, 132) | 4 |
| `otelMetrics.ts` | 1 (line 39) | 3 (lines 49, 105, 113) | 4 |
| `scan.ts` | 1 (line 12) | 2 (lines 25, 31) | 3 |
| `v6Ingest.ts` | 6 (one per handler) | ~20+ (6 handlers × 3-4 each) | ~26 |
| `ingestAuth.ts` | — | 1 (line 36 in `unauthorizedResponse`) | 1 |
| **Total** | **13** | **~39** | **~52** |

**8 handler files confirmed correct.** `v6Ingest.ts` counts as 1 file containing 6 httpAction handlers. The file has the highest change density.

---

## No Analog Found

Files with no close match in the CodePulse codebase (use Ástríðr template directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/gitleaks-scan.yml` | CI workflow | — | No existing gitleaks workflow in CodePulse; Ástríðr analog is the template |
| `.gitleaks.toml` | CI config | — | No gitleaks config in CodePulse; Ástríðr analog is the structural template |
| `docs/DEPLOY.md` | documentation | — | No DEPLOY.md exists; planner authors from scratch using D-08 decisions |
| `.planning/REQUIREMENTS.md` (edit) | documentation | — | Single-line OPS-03 N/A annotation; no pattern needed |

---

## Metadata

**Analog search scope:** `convex/` (all handler files), `convex/__tests__/`, `astridr-repo/.github/workflows/`, `astridr-repo/` root
**Files read:** 13 (9 convex source files + 1 test file + 2 Ástríðr template files + context/research)
**Pattern extraction date:** 2026-06-10
