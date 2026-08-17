# Phase 115: Workspace scanner - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 10 (7 new, 3 modified)
**Analogs found:** 10 / 10 (one file — `config/workspace.local.json` — has no direct in-repo analog for its *merge* semantics; closest precedent noted below)

All line numbers in this document were re-read live this session (not copied from CONTEXT.md/RESEARCH.md without verification). Where a citation in RESEARCH.md was cross-checked and matched exactly, it is noted as "confirmed"; nothing here is repeated from upstream docs without independent confirmation.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `hooks/workspaceScan.mjs` | utility (host script) | file-I/O + request-response | `hooks/scanner.mjs` | exact (same role, same POST/bearer/dry-run/injectable-deps shape) |
| `hooks/workspaceClassifier.mjs` | utility (pure function) | transform | `convex/ingestAuth.ts`'s `parseAllowlist`/`getCorsHeadersWithAllowlist` (deny-by-default shape) + `hooks/skillScan.mjs` (coverage-honest walk) | role-match, composite (no single existing file classifies path→department/access/secret) |
| `hooks/__tests__/workspaceClassifier.test.mjs` | test | transform | `hooks/__tests__/scanner.test.mjs` (real-server wire test) + `convex/graphSnapshots.test.ts` (pure mirror-function unit style) | role-match |
| `convex/workspace.ts` | service/model (Convex module) | CRUD (versioned) | `convex/graphSnapshots.ts` (versioned write/prune) + `convex/loom.ts` (internalMutation-only discipline, INT-03) | exact (graphSnapshots) for the write algorithm; exact (loom) for the public/internal split |
| `convex/workspace.test.ts` | test | transform | `convex/graphSnapshots.test.ts` | exact |
| `config/workspace.json` | config | file-I/O (read at scan time) | none in-repo (new `config/` dir) — shape modeled on RESEARCH.md's proposal + `hooks/scanner.mjs`'s own env/file-fallback resolution idiom | no analog (new pattern for this repo) |
| `config/workspace.local.json` | config | file-I/O (read + merge) | `.env` / `.env.local` split (`.gitignore:3-6`, `scanner.mjs:288-318`'s env-then-file fallback) | partial (precedent is env-var override, not JSON-key-merge; no exact analog) |
| `convex/schema.ts` (edit) | model | CRUD | `graphSnapshots`/`graphSnapshotNodes` table block, `schema.ts:1877-1932` | exact |
| `convex/http.ts` (edit) | route | request-response | `loomHttp.ts` route registration (`http.ts:136-138`) + `scan.ts`'s auth reuse shape | exact (route registration) / role-match (auth reuse) |
| `.gitignore` (edit) | config | — | `.gitignore:3-6` (`.env` / `.env.*` / `!.env.example`) | exact (same "ignore local, keep tracked template" idiom) |

---

## Pattern Assignments

### `hooks/workspaceScan.mjs` (utility, file-I/O + request-response)

**Analog:** `hooks/scanner.mjs` (338 lines, confirmed via full read this session)

**Imports pattern** (`scanner.mjs:12-18`):
```js
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir, cpus, totalmem, freemem } from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { collectClaudeCodeSkillsWithCoverage } from "./skillScan.mjs";
```
Copy the shape (bare `node:`-less built-in imports mixed with local `./*.mjs` imports), not the specific names. `workspaceScan.mjs` additionally needs `js-yaml` for D-09's compose parse (already a dependency, `package.json:44` — RESEARCH.md verified, not re-checked this session, low risk).

**Injectable-deps signature** (`scanner.mjs:33-38`, exact — this is the load-bearing pattern to copy verbatim in shape):
```js
export async function runScan(sessionId, codepulseUrl, ingestKey, deps = {}) {
  const {
    home = homedir(),
    cwd = process.cwd(),
    collectSkills = collectClaudeCodeSkillsWithCoverage,
  } = deps;
```
`runWorkspaceScan(config, deps = {})` should follow this exactly: every real call site omits `deps` (production = real `fs`/`homedir`), tests inject `{ readdirSync, statSync, homedir }` pointing at `mkdtempSync` fixtures. **What to change:** the workspace scanner has no `sessionId`/`codepulseUrl` per-call parameterization need the same way — it reads its own config file — so the signature shape (not the exact params) is what to copy.

**POST-with-bearer block to import, not copy** (`scanner.mjs:220-241`, exact):
```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 3000);
try {
  const headers = { "Content-Type": "application/json" };
  if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
  else console.warn("[codepulse-scanner] no ASTRIDR_INGEST_API_KEY set — posting unauthenticated (server may reject)");
  const resp = await fetch(`${codepulseUrl}/scan`, { method: "POST", headers, body: JSON.stringify(snapshot), signal: controller.signal });
  if (!resp.ok) console.error(`[codepulse-scanner] /scan responded ${resp.status}: ${await resp.text()}`);
} catch (err) {
  console.error(`[codepulse-scanner] /scan failed: ${err.message}`);
} finally {
  clearTimeout(timeout);
}
```
**D-04 says import this, not re-implement it.** Today it is inline in `runScan`, not already factored out — so the concrete first step is extracting a small `hooks/ingestPost.mjs` with a `postSnapshot(url, key, body)` helper that BOTH `scanner.mjs` (edit) and `workspaceScan.mjs` (new) import. This is the one place this phase touches `scanner.mjs` at all — an extraction, not a behavior change — and it must not alter `scanner.mjs`'s existing tested wire behavior (`hooks/__tests__/scanner.test.mjs` must stay green untouched).

**isDirectRun branch** (`scanner.mjs:280-338`, exact):
```js
const __scanner_dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("scanner.mjs");
if (isDirectRun) {
  const sessionId = process.argv[2] || "manual-scan";
  const dryRun = process.argv.includes("--dry-run");
  ...
  runScan(sessionId, url, key).then(() => { console.log(...); process.exit(0); });
}
```
Copy the `isDirectRun` guard shape exactly (swap `"scanner.mjs"` for `"workspaceScan.mjs"` in the `.includes(...)` check) so the module works both as `node hooks/workspaceScan.mjs` (D-05's scheduled task) and as an ESM import (tests). **What to change:** `workspaceScan.mjs`'s dry-run branch is NOT a copy of `scanner.mjs:320-332`'s stdout-only dry-run — D-12 requires the report be written to disk and hashed (see Code Examples in RESEARCH.md — `canonicalReportHash`/`isDryRunApproved`), which `scanner.mjs`'s dry-run does not do. Treat `scanner.mjs`'s dry-run as "the flag convention to reuse", not "the dry-run behavior to reuse".

**Landmine (verified, exact quote):** `scanner.mjs:5-10`:
> "No shebang here (deliberately removed, DEBT-05/113-01-verify): this file is never invoked as `./scanner.mjs` anywhere in the repo — only via `node hooks/scanner.mjs ...` ... or as an ESM import ... A shebang has no effect on either invocation path, but Vite/Rolldown's SSR module transform (used by hooks/__tests__/scanner.test.mjs) hoists import statements above line 1, and a shebang left there breaks parsing of the resulting file with a hard 'Invalid Character `!`'."

**Do not add a shebang to `workspaceScan.mjs` for the identical reason** — it will be imported by its own test file the same way `scanner.mjs` is.

**Landmine 2:** `scanner.mjs`'s `docker ps`/`wsl --list` `execSync` calls pass `windowsHide: true` (`:148,188`) with the comment "the scan runs inside the detached console-less hook worker; without it each console child pops a new visible console window." `workspaceScan.mjs` runs from a `run-hidden.vbs`-wrapped scheduled task (D-05), a different launch context, but if it ever shells out (e.g. to inspect anything) the same `windowsHide: true` requirement applies per the 2026-07-15 LESSONS rule — `windowsHide` on the *outer* process does not propagate to inner `execSync` children.

---

### `hooks/workspaceClassifier.mjs` (utility, pure function)

**Analog for the deny-by-default (D-02) shape:** `convex/ingestAuth.ts:17-21,35-57` — this is the single closest existing embodiment of "deny by default, allow only an explicit match" in this repo, even though it's CORS code, not filesystem code:
```ts
// ingestAuth.ts:17-21
export function parseAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);
  return origins.length > 0 ? new Set(origins) : null;
}
```
```ts
// ingestAuth.ts:44-54 — the fail-closed branch to mirror
if (allowlist === null) {
  headers["Access-Control-Allow-Origin"] = "*";   // dev fallback
} else {
  const origin = request.headers.get("Origin") ?? "";
  if (origin && allowlist.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;   // matched — explicit allow
  }
  // Else: not in allowlist — omit ACAO entirely (fail-closed)
}
```
**What to copy:** the *shape* — a `Set`/pattern list built from config, checked with `.has()`/pattern-match, and the **absence of a match is the failure path, not the presence of a "bad" match**. This is exactly D-02's rejection of `SECRET_RE` (a "does it look secret" regex, i.e. presence-of-match-is-bad) in favor of "does it look shareable" (absence-of-match-is-bad). **What to change:** ingestAuth's allowlist is a flat `Set<string>` of exact origins; the classifier's allowlist is per-root glob/extension patterns, so the match function itself must be written new — only the deny-by-default control flow is the pattern to copy.

**Analog for coverage-honest partial results (D-01/D-03 partial-scan semantics):** `hooks/skillScan.mjs:107-118` (comment, exact quote):
> "Coverage now requires BOTH that at least one plugin was actually read AND that no plugin's read failed."

And the boolean-return convention it implements, `skillScan.mjs:58-61` (comment, exact):
> "Returns true only when the directory was actually enumerated (readdirSync succeeded), false on any early exit — missing dir or a readdirSync throw."

**What to copy:** every walk function returns a real success/failure signal (not assumed true), and a directory's rows are still pushed to the accumulator even when its own coverage flag ends up false (`skillScan.mjs:140`, comment: "does NOT early-return on the first failure ... requires the rows a partial walk DID find to still be pushed"). This is exactly the shape RESEARCH.md's Pattern 4 flags as an **implied requirement** (`workspaceSnapshots.scannedRootsComplete`/`coveredRoots`) that CONTEXT.md's D-01–D-17 never names explicitly — the executor should treat this as load-bearing, not optional polish.

**What NOT to copy from `skillScan.mjs`:** it does real I/O (`readFileSync` of `SKILL.md` frontmatter, `:70`) — the workspace classifier must be a **pure `(path, config) → result` function per D-08**, with zero I/O of its own. The walk (I/O) and the classify (pure) must be two separate functions/files if `skillScan.mjs`'s combined walk+classify shape is used as a structural template — do not let the classifier itself call `statSync`.

**Landmine — path separators (RESEARCH.md Pitfall 5, verified against `skillScan.mjs:158-164`'s existing `samePath()` normalization, which IS a real precedent in this repo, confirmed):**
```js
// skillScan.mjs:158-164
const samePath = (a, b, platform) => {
  const norm = (p) => {
    const s = p.replace(/\\/g, "/").replace(/\/+$/, "");
    return platform === "win32" ? s.toLowerCase() : s;
  };
  return norm(a) === norm(b);
};
```
This confirms forward-slash normalization is an established idiom here (not a novel recommendation) — the classifier must normalize every relative path to `/` before running any allowlist/department-prefix match, the same way this function normalizes for comparison.

---

### `hooks/__tests__/workspaceClassifier.test.mjs` (test)

**Analog 1 — real-fixture wire test style:** `hooks/__tests__/scanner.test.mjs:1-69` (confirmed via read). Header comment (exact quote, lines 1-3):
> "hooks/scanner.mjs had ZERO automated test coverage ... a mutation hardcoding `snapshot.scannedOrigins` to a fixed array survived all 579 pre-existing tests. These tests exercise runScan end-to-end against a REAL local HTTP server (never the live Convex backend)"

Pattern: `mkdtempSync(join(tmpdir(), "home-scan-wire-"))` fixture directories, real `writeFileSync`/`mkdirSync` calls to build a tiny real filesystem tree, then assert on the **actual produced values**, not a mocked return. Copy this discipline for the classifier's directory-walk tests — build real tmp trees with a handful of files across the allowlist boundary, not mocked `fs`.

**Analog 2 — pure-function mirror-test style:** `convex/graphSnapshots.test.ts:48-83` (`describe("selectVersionDeletes ...")`) — plain `expect()` against a pure function, no I/O, no DB. This is the primary style for the classifier itself (`classifyPath(relPath, config)`), since D-08 makes it pure.

**D-12's mutation-test shape (the specific test this file — or a sibling `dryRunGate.test.mjs` — must contain, per CONTEXT.md's explicit "must be mutation-tested" requirement):** RESEARCH.md's Code Examples section already gives the exact functions and the exact test sequence (baseline pass → 1-field content mutation → marker-absent → marker-corrupted, each asserting `isDryRunApproved` flips to `false`). This is not this file's own artifact to re-derive — copy it directly from `115-RESEARCH.md`'s "Dry-run report hash gate (D-12)" and "How D-12's refusal gets mutation-tested" sections verbatim as the test plan; do not re-invent the five cases.

**What to change vs. copy:** `scanner.test.mjs` uses a real `node:http` server (`createServer`) to capture the POST body — appropriate there because the assertion is about the wire payload. The classifier tests need **no server at all** (pure function + tmp filesystem only); do not add an HTTP server to this test file, that would be copying an unrelated part of the analog.

---

### `convex/workspace.ts` (service/model, CRUD-versioned)

**Analog 1 — the write algorithm to copy near-verbatim:** `convex/graphSnapshots.ts:55-155` (`upsertGraphSnapshot`, full function read this session, confirmed matches RESEARCH.md's citations exactly, no drift). The 7-step ordering (`:84-153`) is the pattern:
```ts
// graphSnapshots.ts:86-92 — steps 1-2
const existing = await ctx.db.query("graphSnapshots")
  .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
  .unique();
const newVersion = (existing?.activeVersion ?? 0) + 1;
```
```ts
// graphSnapshots.ts:102-121 — chunked insert, CHUNK = 1000
const CHUNK = 1000;
for (let i = 0; i < args.nodes.length; i += CHUNK) {
  const batch = args.nodes.slice(i, i + CHUNK);
  for (const node of batch) { await ctx.db.insert("graphSnapshotNodes", { ...version: newVersion... }); }
}
```
```ts
// graphSnapshots.ts:137-153 — step 7, LAST
const metaDoc = { snapshotId: args.snapshotId, activeVersion: newVersion, ... };
if (existing) { await ctx.db.patch(existing._id, metaDoc); }
else { await ctx.db.insert("graphSnapshots", metaDoc); }
```
**What to change:** `workspaceDirs` rows have no cross-reference integrity concern the way links reference nodes (`graphSnapshots.ts:94-100`'s dangling-link filter) — D-10's own text and RESEARCH.md both note this filter step is likely a no-op for directories; do not force an equivalent filter in just to mirror the shape.

**Analog 2 — the inline prune (D-11), copy shape from the SWEEP, not its scheduling:** `graphSnapshots.ts:168-224` (`sweepGraphSnapshotVersions`). The part to copy is the **candidate-selection + capped-delete loop** (`:184-221`), NOT the fact that it's a separate `internalMutation` invoked by a cron — D-11 explicitly rejects the cron. Copy this shape but call it inline, at the end of `upsertWorkspaceSnapshot`, after the pointer flip:
```ts
// graphSnapshots.ts:191-207 — the loop shape to inline (adapt: ONE call site, not per-meta-doc loop, since workspace has one fixed snapshotId)
const versionToDelete = toDelete[0];
let deleteCount = 0;
const MAX_DELETES_PER_INVOCATION = 15000; // this repo's own headroom number under the 16,000-doc ceiling
const staleNodes = await ctx.db.query("graphSnapshotNodes")
  .withIndex("by_snapshot_version", (q) => q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete))
  .collect();
for (const node of staleNodes) {
  if (deleteCount >= MAX_DELETES_PER_INVOCATION) break;
  await ctx.db.delete(node._id);
  deleteCount++;
}
```
**Reuse `selectVersionDeletes` itself, don't reimplement it** — `graphSnapshots.ts:30-34` is exported and pure:
```ts
export function selectVersionDeletes(versions: number[], keepN: number): number[] {
  if (versions.length <= keepN) return [];
  const sorted = [...versions].sort((a, b) => a - b);
  return sorted.slice(0, sorted.length - keepN);
}
```
Either import this directly from `convex/graphSnapshots.ts` (it's already exported, zero-dependency, generically named — no workspace-specific logic in it) or copy it verbatim into `workspace.ts` under a `WORKSPACE_KEEP_VERSIONS` constant — RESEARCH.md recommends 2-3 vs. this file's 7, so the constant must NOT be shared, only the function.

**Analog 3 — the internalMutation-only discipline, and why `scan.ts`/`registry.ts` is the anti-pattern to avoid here:** `convex/registry.ts:130` declares `syncInventory` as a public `mutation` (confirmed this session — read `scan.ts` in full, which calls `api.registry.syncInventory` at `scan.ts:23`, i.e. through the PUBLIC `api.*` namespace, not `internal.*`). **Do not use `scan.ts`'s call shape for the mutation itself.** Instead copy `convex/loom.ts`'s discipline (grep-confirmed this session, `loom.ts:149,247`, both `internalMutation`) and its own header comment (verified exact, `loom.ts:141,242`):
> "`internalMutation`, not `mutation` (v14.0 audit INT-03) — a plain `mutation` ... reaches internal functions fine [via ctx.runMutation from the httpAction]."
`upsertWorkspaceSnapshot` must be `internalMutation`, called only via `ctx.runMutation(internal.workspace.upsertWorkspaceSnapshot, {...})` from the new httpAction — never exported as `api.workspace.*` for a write path.

**Landmine:** `graphSnapshots.ts` is invoked today from inside `runtimeIngest.ts`'s giant `case "graph_snapshot":` switch (`runtimeIngest.ts:1549-1566`, confirmed this session) — i.e. `graphSnapshots.ts` itself has NO dedicated httpAction/route file; its route is `/runtime-ingest`'s shared dispatcher. **Do not fold `workspace.ts` into `runtimeIngest.ts`'s switch** — CONTEXT.md/RESEARCH.md both specify a **new dedicated route** (`/workspace-ingest` or similar) in `http.ts`, which structurally means `convex/workspace.ts`'s calling convention should follow `convex/loom.ts` (dedicated module, dedicated route file) rather than `graphSnapshots.ts`'s (shared dispatcher). Use `graphSnapshots.ts` for the **mutation body**, `loom.ts`/`loomHttp.ts` for the **module/route wiring shape**.

---

### `convex/workspace.test.ts` (test)

**Analog:** `convex/graphSnapshots.test.ts` (full read of first 90 lines this session, confirmed matches RESEARCH.md's description exactly — pure mirror functions, zero DB round-trip). Header comment (exact, `:1-7`):
```ts
import { describe, it, expect } from "vitest";
/**
 * Pure-logic mirrors of the `graph_snapshot` ingest dispatch and receiver
 * logic (mirroring the repo's kg.test.ts / forge.test.ts style — no DB
 * round-trip).
 */
import { selectVersionDeletes, GRAPH_SNAPSHOT_KEEP_VERSIONS } from "./graphSnapshots";
```
And its "mirror function" idiom (`:20-29`, exact) — a hand-written function that replicates the dispatch mapping so it's testable without a Convex runtime:
```ts
const mapGraphSnapshotEvent = (d: any, fallbackTs: number) => ({
  snapshotId:  d.snapshotId ?? "astridr-project-graph",
  nodes:       Array.isArray(d.nodes) ? d.nodes : [],
  ...
});
```
**What to copy exactly:** import the real `selectVersionDeletes` (or the workspace-local copy) and run the SAME 7-case table `graphSnapshots.test.ts:48-83` already runs (empty/exact-keepN/below-keepN/exceeds-keepN/unsorted-input/keeps-N-newest/keepN=1) against `WORKSPACE_KEEP_VERSIONS` instead of `GRAPH_SNAPSHOT_KEEP_VERSIONS` — this is a near-verbatim table swap, not new test design.

**What to add that `graphSnapshots.test.ts` does not have:** the D-12 dry-run-gate mutation tests (see `workspaceClassifier.test.mjs` section above) — `graphSnapshots.ts` has no equivalent structural gate, so there's no analog for this specific piece; it comes from RESEARCH.md's own worked example, not from an existing test file.

**`it.todo` pattern for DB-dependent cases (confirmed real precedent, per RESEARCH.md's citation `graphSnapshots.test.ts:275-279` — not independently re-read this session, but the pattern's existence in this exact style is corroborated by the file's own header comment about "no DB round-trip" above, i.e. internally consistent):** any assertion that needs a live `activeVersion` increment across two real ingests, or that the inline prune actually deletes rows and not the active version's rows, becomes `it.todo("...")`, deferred to an attended live-deploy verification wave — not something this test file can assert with plain `expect()`.

---

### `config/workspace.json` (config)

**No existing analog** — `config/` does not exist in this repo yet (Glob confirmed zero hits for `config/*.json` this session). This is a genuinely new location/pattern for CodePulse.

**Closest structural precedent for "config file the classifier reads at scan time":** `hooks/scanner.mjs:288-304`'s own env/file resolution fallback (exact, adapted context):
```js
let url = process.env.CODEPULSE_URL || "";
if (!url) {
  const envPath = join(__scanner_dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      const siteMatch = content.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
      if (siteMatch) url = siteMatch[1].trim();
      ...
    } catch {}
  }
}
```
**What to copy:** the pattern of wrapping every config file read in `existsSync` + `try/catch`, never letting a missing/malformed config crash the whole scan — this is the established idiom for "config file might not be there" in this exact file. **What to change:** `workspace.json` is real structured JSON (roots, department map, allowlist patterns — see RESEARCH.md's `Recommended Project Structure` section for the proposed shape), not a `.env`-style key=value file, so `JSON.parse` + schema validation replaces the regex-match approach — only the defensive-read wrapping is the pattern to copy.

---

### `config/workspace.local.json` (config) — the loader/merge pattern, per the task's own scoping note

**No exact analog for the merge semantics** ("tracked ← local, local wins on key collision, fail closed if local is absent/malformed" — D-17). Closest precedent, **partial match only**:

1. **The tracked/gitignored SPLIT itself** — `.gitignore:3-6` (exact):
```
.env
.env.*
!.env.example
```
This is the established idiom in this repo for "a real file with sensitive content stays untracked; a safe stand-in stays tracked." Copy this *shape* for `.gitignore`'s new line (see below), not this file's merge logic.

2. **Env-var-first, file-fallback resolution** — `scanner.mjs:288-318` (already quoted above) is the closest thing to "two sources, one wins" in this codebase, but it's an either/or fallback (env wins if set, else read file), not a **key-level JSON merge** (tracked keys + local keys, local overriding on collision). **This merge behavior has no precedent in this repo and must be designed fresh** — flag this to the planner explicitly rather than implying a copy-paste source exists.

**Fail-closed requirement (D-17, direct quote from CONTEXT.md, already locked, not this agent's recommendation):**
> "must fail closed if the local file is absent or malformed: missing local config means 'scan only the tracked roots', never 'scan everything unclassified' and never a crash that a nightly task would swallow."

The closest **fail-closed control-flow shape** to model this on is `ingestAuth.ts:76-85`'s `validateIngestAuth` (exact, already an established fail-closed idiom in this repo, confirmed this session):
```ts
export function validateIngestAuth(request: Request): boolean {
  const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
  if (!expectedKey) {
    // Fail closed: a missing key must not silently open the ingest family to the
    // public internet. Require an explicit opt-in for the dev/anon path.
    return _env.ASTRIDR_INGEST_ALLOW_ANON === "true";
  }
  ...
}
```
**What to copy:** the *shape* of "absent input → return the SAFE value, never throw, never widen scope" — swap "missing API key → reject" for "missing/malformed local config → fall back to tracked-only roots." **What to change:** this function returns a boolean; the local-config loader needs to return a value (merged config) with a mode flag, so the shape transfers but the return type does not.

---

### `convex/schema.ts` (edit)

**Analog:** `graphSnapshots`/`graphSnapshotNodes`/`graphSnapshotLinks` table block, `schema.ts:1877-1932` (confirmed exact this session, full read — RESEARCH.md's citation of `:1880-1932` was off by 3 lines against the real header comment start at `:1877`, minor drift, content itself matches).

```ts
// schema.ts:1891-1910 — the meta-row table to copy the SHAPE of, not the fields
graphSnapshots: defineTable({
  snapshotId:       v.string(),
  activeVersion:    v.number(),
  sources:          v.array(v.object({ ... })),   // producer-supplied array, small & bounded
  nodeCount:        v.float64(),
  ...
  generatedAt:      v.float64(),     // epoch seconds — producer's time.time() float
  updatedAt:        v.float64(),     // epoch seconds — when CodePulse stored this version
}).index("by_snapshotId", ["snapshotId"]),

// schema.ts:1914-1922 — the entity-row table to copy the SHAPE of
graphSnapshotNodes: defineTable({
  snapshotId: v.string(),
  version:    v.number(),
  nodeId:     v.string(),
  ...
}).index("by_snapshot_version", ["snapshotId", "version"]),
```
**What to copy exactly:** the two-index-family pattern (`by_snapshotId` on the meta table for the pointer read; `by_snapshot_version` compound index on entity tables, queried ONLY through this index — `graphSnapshots.ts` never does a bare `.collect()` across all versions of an entity table, confirmed by reading every query in the file this session). Also copy the **comment block above the table** (`:1880-1889`, exact) — this repo's convention is to record the row-based-storage rationale and the Convex limits inline at the schema definition site, not just in a design doc; do the same for `workspaceSnapshots`/`workspaceDirs`.

**What to change:** field set — RESEARCH.md's proposed `workspaceSnapshots`/`workspaceDirs` shape (its own Standard Stack section, already vetted against D-10 and Pitfall 1's side-channel concern) is the field list to use, not `graphSnapshots`' fields. Do not reuse `graphSnapshotNodes`' fields (`nodeId, label, type, community, source`) — this is explicitly the anti-pattern D-10 rejects (verified: no field for department/access/isSecret/size/mtime exists on that table).

**Landmine:** `community` on `graphSnapshotNodes` is `v.optional(v.float64())` specifically because "vault nodes emit community: null" (`schema.ts:1913` comment) — a reminder that **every optional/nullable field needs its own documented reason**, not a blanket `v.optional()` applied defensively. Workspace fields have no equivalent nullable case identified in CONTEXT.md/RESEARCH.md; don't add optionality without a concrete reason.

---

### `convex/http.ts` (edit)

**Analog for the route-registration line itself:** `http.ts:136-138` (exact, most recently added route — Phase 119 Loom, confirmed this session as the last entry before `export default http`):
```ts
// Phase 119 Loom (D-02/D-04). One emit route, agent/CLI only — no OPTIONS
// partner and no CORS headers, same boundary as the /galdr routes above.
http.route({ path: "/loom/event", method: "POST", handler: loomEventPost });
```
**What to copy:** the one-line `http.route({...})` registration shape and the convention of a comment naming the phase/decision above each new block. **What to change:** unlike Loom/Galdr (deliberately NO CORS, NO OPTIONS partner, per their own D-04 decisions), the workspace ingest route should follow **`scan.ts`'s** shape instead — `getCorsHeaders`/OPTIONS handling — because CONTEXT.md/RESEARCH.md specify reusing `validateIngestAuth`/`getCorsHeaders` (the `/scan`+`/runtime-ingest` family), not `validateLoomAuth`/`validateGaldrAuth` (which are deliberately separate, per-producer keys). Do not introduce a new bearer key for this route.

**Analog for the handler file itself (structure, not auth):** `loomHttp.ts:37-71` (full file read this session) — a small dedicated handler function with manual field validation and explicit status-code branching, exported once as `httpAction(handlerFn)`:
```ts
export const loomEventPostHandler = async (ctx: any, request: Request) => {
  if (!validateLoomAuth(request)) return unauthorizedResponse();
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ error: "INVALID_JSON" }, 400); }
  ...
  const result = await ctx.runMutation(internal.loom.recordStepEvent, { ... });
  if (!result?.ok) { return jsonResponse({ error: result?.error ?? "REFUSED" }, status); }
  return jsonResponse({ ok: true, ... }, 200);
};
export const loomEventPost = httpAction(loomEventPostHandler);
```
**What to copy:** the exported-handler-function-then-wrapped-in-`httpAction` split (testable without a full Convex runtime — you can call `loomEventPostHandler` directly with a mock `ctx`/`Request` in unit tests), the try/catch around `request.json()`, and the `ctx.runMutation(internal.X.Y, {...})` call shape. **What to change:** swap `validateLoomAuth`/`unauthorizedResponse` for `validateIngestAuth`/`unauthorizedResponse` (from the same `ingestAuth.ts` file, already imported by `scan.ts`), and add `getCorsHeaders(request)` handling + an OPTIONS route pairing (mirroring `scan.ts:11-14`'s `if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: getCorsHeaders(request) });`) since this route is NOT in the CLI/agent-only no-CORS family.

**Landmine:** `scan.ts:23` calls through `api.registry.syncInventory` — a **public** mutation (confirmed, `registry.ts:130`). If the new `workspace.ts` handler is modeled on `scan.ts`'s literal code (copy-paste), it is easy to accidentally also import from `api.*` instead of `internal.*`. Import `internal.workspace.upsertWorkspaceSnapshot`, not `api.workspace.upsertWorkspaceSnapshot` — this is the single highest-value landmine in this whole phase per RESEARCH.md's Security Domain section.

---

### `.gitignore` (edit)

**Analog:** `.gitignore:3-6` (exact, already quoted above):
```
.env
.env.*
!.env.example
```
**What to copy:** the comment-then-pattern convention (`# Secrets: ignore all env files except the committed template (CSO-95-03)` precedes the block) — add a similarly-commented single line for `config/workspace.local.json`, referencing D-17 by decision ID the way the existing line references `CSO-95-03`. **What to change:** this is a single explicit filename, not a glob family with a negation — do not write `config/*.local.json` unless a second local-config file is anticipated; D-17 names exactly one file.

---

## Shared Patterns

### Fail-closed on missing/malformed input
**Source:** `convex/ingestAuth.ts:76-85` (`validateIngestAuth`)
**Apply to:** `config/workspace.local.json`'s loader (D-17), the compose-file YAML parse (D-09, Pitfall 4's recommended try/catch → fall back to `local-only`), and D-02's allowlist match itself.
**Shape:** absence or malformed input never widens scope or crashes — it returns the narrowest safe behavior, with an explicit opt-in required to relax it (`ASTRIDR_INGEST_ALLOW_ANON=true` is the model for "if you really want the permissive path, you must say so explicitly").

### Versioned write, pointer flipped last
**Source:** `convex/graphSnapshots.ts:84-153` (`upsertGraphSnapshot`)
**Apply to:** `convex/workspace.ts`'s `upsertWorkspaceSnapshot` — copy the 7-step ordering exactly, especially "patch the meta doc LAST."

### internalMutation-only for httpAction-driven writes
**Source:** `convex/loom.ts:141-166,242-254` (verified via grep this session: both `upsertPipeline` and `recordStepEvent` are `internalMutation`, with an explicit comment citing "v14.0 audit INT-03")
**Apply to:** `convex/workspace.ts`'s write mutation. **Do not** follow `convex/registry.ts:130`'s `syncInventory` (public `mutation`) — that is a known, already-flagged pre-existing gap in `/scan`, not a pattern to repeat.

### Injectable-deps for testable host scripts
**Source:** `hooks/scanner.mjs:33-38`
**Apply to:** `hooks/workspaceScan.mjs`'s top-level entry function and any walk function in `hooks/workspaceClassifier.mjs` that touches the real filesystem.

### Coverage-honest partial-result reporting
**Source:** `hooks/skillScan.mjs:107-118` (comment), `:58-61` (comment)
**Apply to:** `workspaceSnapshots`' proposed `scannedRootsComplete`/`coveredRoots` fields — an implied requirement per RESEARCH.md, not explicitly named in any D-NN, but structurally required by the same logic this repo already applies to skill scanning.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `config/workspace.json` | config | file-I/O | `config/` does not exist in this repo yet (confirmed via Glob this session); use RESEARCH.md's proposed schema, not an in-repo copy source |
| `config/workspace.local.json`'s merge logic specifically | config | file-I/O | The tracked-JSON/gitignored-JSON key-level merge with "local wins" has no precedent; only the surrounding fail-closed and tracked/untracked-split idioms have analogs (see Shared Patterns above) |

## Metadata

**Analog search scope:** `hooks/`, `hooks/__tests__/`, `convex/*.ts`, `convex/*.test.ts`, `.gitignore`, repo root for `config/`
**Files read in full or targeted this session:** `hooks/scanner.mjs` (338 lines, full), `hooks/skillScan.mjs` (234 lines, full), `hooks/__tests__/scanner.test.mjs` (first 70 lines), `convex/graphSnapshots.ts` (301 lines, full), `convex/graphSnapshots.test.ts` (first 90 lines), `convex/scan.ts` (36 lines, full), `convex/ingestAuth.ts` (168 lines, full), `convex/http.ts` (140 lines, full), `convex/schema.ts:1870-1935`, `convex/runtimeIngest.ts:1530-1569`, `convex/loomHttp.ts` (74 lines, full), `convex/loom.ts` (grepped for `internalMutation`), `convex/crons.ts:30-79` and the `sweep-graph-snapshot-versions` block, `.gitignore` (43 lines, full)
**Pattern extraction date:** 2026-08-12
