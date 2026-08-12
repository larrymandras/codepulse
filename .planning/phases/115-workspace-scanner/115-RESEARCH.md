# Phase 115: Workspace scanner - Research

**Researched:** 2026-08-12
**Domain:** Host-side Node filesystem scanner + Convex versioned-ingest backend (self-hosted)
**Confidence:** HIGH (all core claims verified against live code, file:line evidence below) / MEDIUM on the D-02/D-06/D-14 concrete proposals (Claude's Discretion items — correct by construction but unvalidated against the real tree until D-12's dry-run runs)

## Summary

This phase has almost no technology-choice risk — every hard problem (versioned writes, bounded
deletes, ingest auth, host-side POST-with-bearer scanning) already has a proven, working precedent
*in this exact repo*, built for a near-identical problem (Phase 83's `graphSnapshots` receiver and
Phase 96/113's `hooks/scanner.mjs`). The work is disciplined adaptation, not invention. All four
"read this precedent" pointers in CONTEXT.md were verified line-for-line against the live files
this session and **all cited line numbers are still accurate — nothing has drifted**.

The one place with real design risk is D-12 (the structural dry-run gate): it has to be a code
path, not a checklist, and it has to be provably capable of refusing. This research proposes a
concrete, mutation-testable shape (hash the dry-run report content, compare to a checked-in
approval marker, block the POST before it ever leaves the host) built from primitives already in
Node's standard library — no new dependency.

The two items requiring the most planner judgment are D-02 (allowlist patterns) and D-06/D-14
(root list + department map), because they encode facts about Larry's filesystem that only he can
fully confirm. This research proposes concrete starting values, backed by direct evidence where it
exists (docker-compose mounts, CLAUDE.md text, actual `C:\Users\mandr\` directory listing) and
explicitly flags where it is guessing from a directory name alone — those guesses must not be
silently trusted; they are exactly what D-12's dry-run report exists to catch before first ingest.

**Primary recommendation:** New `workspace*` tables (not a reuse of `graphSnapshots`), built as a
direct structural copy of `graphSnapshots.ts`'s three-table / version-pointer-last pattern, with the
version-prune step inlined into the SAME ingest mutation (never a cron) at a low `keepN` (recommend
2-3, not 7 — see D-11 below) and a hard, host-side, hash-verified dry-run gate in
`hooks/workspaceScan.mjs` that a mutation test can prove actually blocks a stale/unapproved report.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filesystem walk + classification (department/access/secret) | Host script (Node, `hooks/workspaceScan.mjs`) | — | Only the host has filesystem access; must run outside any browser/server sandbox. Pure `(path, config)` classifier per D-08. |
| Dry-run report generation + approval-hash check (D-12) | Host script | — | The refusal must happen BEFORE the network call is made — a server-side check alone cannot prevent the host from choosing not to call it, but more importantly the design intent is a pre-flight human review gate on the PRODUCER, not a data-quality check on the CONSUMER. |
| Compose-file mount parsing (D-09 `access` derivation) | Host script | — | `astridr-repo/docker-compose.yml` is a file on the host filesystem, not reachable from Convex. Parsed at scan time with `js-yaml` (already a dependency, see Standard Stack). |
| Versioned ingest write + inline prune (D-10/D-11) | Convex `internalMutation` | — | Mirrors `graphSnapshots.upsertGraphSnapshot` — write path never exposed as a public mutation (see Pitfall/Security section on `registry.syncInventory`'s public-mutation gap). |
| Auth + CORS on the new route | Convex `httpAction` (`convex/http.ts`) | — | Reuses `validateIngestAuth`/`getCorsHeaders` from `convex/ingestAuth.ts` — zero new auth surface, per D-04/canonical refs. |
| Snapshot storage (versioned tables) | Convex / self-hosted SQLite | — | `workspaceSnapshots` (meta) + `workspaceDirs` (entity rows), same shape family as `graphSnapshots`/`graphSnapshotNodes`. |
| Scheduled nightly trigger (D-05) | Windows Task Scheduler (host OS) | — | Outside both the browser and Convex tiers entirely; `wscript.exe run-hidden.vbs` launches `node hooks/workspaceScan.mjs`. |
| Map rendering (consumer) | Frontend (React, Phase 114 — OUT OF SCOPE this phase) | Convex query | Not built here; this phase's node/link shape is Phase 114's input contract (D-13 is load-bearing for it). |

## Standard Stack

No new runtime dependency is required. Everything this phase needs is already present:

| Library | Version (installed, verified) | Purpose | Why no new package |
|---------|------|---------|---------------------|
| Node built-ins (`fs`, `path`, `crypto`) | Node runtime (repo targets modern Node via Vite 7 tooling) | Filesystem walk, path joins, dry-run report hashing (D-12) | `fs.readdirSync`/`statSync` only — never `readFileSync` on a scanned file's own contents (D-01's structural constraint) |
| `js-yaml` | `^5.2.1` [VERIFIED: `package.json:44`] | Parse `astridr-repo/docker-compose.yml` for D-09's mount-source derivation | Already a `codepulse` dependency (also used for `@codemirror/lang-yaml` editing) — confirmed via `package.json:23,44` |
| `convex/values` (`v.*`) | Already used throughout `convex/` | Argument validators for the new ingest mutation | Existing pattern (`graphSnapshots.ts:56-83`) |
| Vitest | `^4.1.9` [VERIFIED: `package.json:89`] | Unit tests for the classifier, the dry-run hash gate, and the mirror-tests for the ingest mutation logic | Existing test runner; `hooks/__tests__/*.test.mjs` and `convex/*.test.ts` both already run under it (`package.json:11` `"test": "vitest"`) |

**No `npm install` step is needed for this phase.** Because no new package is introduced, the
Package Legitimacy Audit gate is not applicable — there is nothing to run `slopcheck`/registry
verification against. If a later plan revision decides to add a real YAML/glob library beyond
`js-yaml` (e.g. a dedicated `.gitignore`-style matcher for the allowlist), that package must go
through the full legitimacy gate before being recommended.

## Architectural Responsibility Map — Notes on D-09's actual mount surface

`astridr-repo/docker-compose.yml` defines the bind mounts across **two separate services**, not
one — both are part of "Ástríðr's world" and both must be unioned for `access` derivation:

- **`astridr-agent`** (`docker-compose.yml:320-390`) mounts: vault → `/app/vault` (`:344`),
  `.claude` → `/home/astridr/.claude:ro` (`:345`) and again at `/mnt/host/c/Users/mandr/.claude:ro`
  (`:359`), `.agents` (`:360`), three repos' `.claude\skills` subtrees only (`:369-371`: forge,
  claudeclaw-os, homeassistant), plus `astridr-repo` and `codepulse` themselves as **`:rw`**
  (`:363-364`).
- **`cli-gateway`** (`docker-compose.yml:527-554`) mounts: `.claude` again (`:539`), **`.claude.json`
  itself** (`:540`), **`.claude-alt`** (`:541`), plus `astridr-repo`/`codepulse`/`Mandras` (vault)
  as `:rw` a second time (`:548-550`, different var names — `MANDRAS_VAULT_PATH` here vs.
  `OBSIDIAN_VAULT_PATH` on `astridr-agent`, same physical directory).

**All CONTEXT.md line citations verified exact, no drift**: `:344` ✓ (vault), `:345`/`:359` ✓
(`.claude` mounted twice), `:360` ✓ (`.agents`), `:369-371` ✓ (three repos' skills), `:539-541` ✓
(`.claude`/`.claude.json`/`.claude-alt` on `cli-gateway`).

**Implication for the parser:** loop over **every service's** `volumes:` list in the compose file,
not just `astridr-agent` — hardcoding one service name would silently miss `.claude-alt` and
`.claude.json` (both only appear under `cli-gateway`). This is exactly the "self-correcting" design
D-09 wants: a future mount added to *any* service is picked up automatically as long as the parser
walks the whole document, not a named subset.

**Env-var substitution constraint (do not violate D-01's spirit or the project's `.env` rule):**
Every mount source in this file uses `${VAR:-literal/default/path}` compose syntax. A real Docker
Compose resolves `${VAR}` against the shell/`.env` environment; this scanner **must not** — reading
`astridr-repo/.env` to resolve overrides would violate the project's absolute "never read `.env`
files" rule, even though the values in question here are filesystem paths, not credentials. The
correct approach is to parse the compose file as **static text/YAML** and, for each `${VAR:-default}`
token, take the **literal default** (regex: `\$\{[A-Z_]+:-([^}]+)\}`) rather than attempting live
substitution. This is a deliberate, documented limitation: if Larry has actually overridden one of
these path vars in a real `.env` he never told this scanner about, `access` derivation will silently
use the YAML-declared default instead of his override. Flag this in the config/report, not as a
blocker — it is the same category of acceptable imprecision as "derived, self-correcting, beats a
hand-maintained list that goes stale" (D-09's own rationale), just bounded to "self-correcting when
the compose file's *defaults* change," which is the common case (adding a new mount line).

## Standard Stack — the versioned-write contract to copy (D-10)

Read in full: `convex/graphSnapshots.ts` (301 lines).

**Exact write ordering** (`graphSnapshots.ts:40-155`, `upsertGraphSnapshot`):
1. Read existing meta doc by `snapshotId` via `by_snapshotId` index (`:86-89`).
2. `newVersion = (existing?.activeVersion ?? 0) + 1` (`:92`) — monotonic, never reused.
3. Build a guard set from incoming data (here: dangling-link filter against node ids, `:94-100`) —
   the workspace analogue would be a similar "which directories are legitimate" sanity filter, though
   directories have no cross-reference integrity concern like links do, so this step may be a no-op
   for the workspace case.
4. Insert entity rows for the **new version** in chunks of 1,000 (`:102-121`, `CHUNK = 1000`) —
   **this chunking is required**, not optional convenience: Convex mutations have a per-invocation
   write-count ceiling, and `graphSnapshots.ts:882` (schema comment) documents the concrete number
   that motivated row-based storage in the first place (8,192-element array-field limit; the doc-count
   ceiling that chunking guards against is separate and higher, ~16,000 per the comment at
   `retention.ts` and `graphSnapshots.ts:161` "13,500 rows ... within the 16,000-doc write limit").
5. **LAST**: patch-or-insert the meta doc with the new `activeVersion` pointer (`:137-154`,
   comment: *"Step 7 is last: readers continue to see the complete previous version until the
   pointer flips"*). This is the entire crash-safety guarantee — a mid-scan crash after step 4 but
   before step 5 leaves the OLD version still active and complete; nothing partial is ever visible.

**Index definitions used**: `graphSnapshots` has `.index("by_snapshotId", ["snapshotId"])`
(`schema.ts:1910`); `graphSnapshotNodes`/`graphSnapshotLinks` each have
`.index("by_snapshot_version", ["snapshotId", "version"])` (`schema.ts:1922,1931`). Both entity
tables are queried exclusively through this compound index — never a bare `.collect()` across all
versions.

**Version allocation**: purely `activeVersion + 1` read from the meta doc at ingest time — no
separate counter table, no client-supplied version number (the client/producer never sends a version
at all; `graphSnapshots.ts`'s `upsertGraphSnapshot` args have no `version` field — verified at
`:56-83`).

**Convex limits recorded in this codebase** (`schema.ts:1880-1883`, exact quote): *"Row-based
storage (D-01): a single-blob document would exceed Convex's 8,192-element array-field limit
(~9,000 links worst case) and the ~1 MiB document-size limit. Three tables with versioned entity
rows avoid both limits."* — the workspace design must avoid the same trap: **do not** store a
directory's list of department/access breakdowns, or any per-file detail, as an array field on a
single meta doc; keep it as one row per directory, exactly as `graphSnapshotNodes` does per node.

**Proposed `workspace*` table shape** (Claude's Discretion, within D-10/D-11's constraints):

```ts
// Meta row — one per logical snapshot (a single fixed snapshotId is fine; no
// multi-snapshot need is implied by the design docs, unlike graphSnapshots
// which anticipated multiple producers).
workspaceSnapshots: defineTable({
  snapshotId:        v.string(),   // fixed, e.g. "larry-workspace"
  activeVersion:      v.number(),
  generatedAt:        v.float64(), // host scan time
  receivedAt:         v.float64(), // Convex ingest time
  rootCount:           v.number(),
  unclassifiedRootIds: v.array(v.string()),  // D-14 — small, bounded by root count, safe as an array
  totalDirs:           v.number(),
  totalFiles:          v.number(),
  totalWithheldFiles:  v.number(), // D-03 aggregate — sum of every dir's withheldCount
  totalBytes:          v.float64(),
  dryRunReportHash:    v.string(), // D-12 — the approved report hash this ingest was gated on
}).index("by_snapshotId", ["snapshotId"]),

// Entity rows — one per DIRECTORY (D-13), keyed by (snapshotId, version).
workspaceDirs: defineTable({
  snapshotId:    v.string(),
  version:       v.number(),
  rootId:        v.string(),          // which declared root this dir belongs to (D-06)
  dirPath:       v.string(),          // relative to rootId, "" = the root itself
  department:    v.string(),          // Work | Consulting | Personal | Unclassified (D-07/D-14)
  access:        v.string(),          // "astridr-reachable" | "local-only" (D-09)
  fileCount:     v.number(),          // visible (non-withheld) files directly in this dir
  totalSize:     v.float64(),         // bytes, visible files only (never counts withheld bytes
                                        // if that would let size act as a side-channel — see
                                        // Common Pitfalls)
  latestMtime:   v.float64(),
  withheldCount: v.number(),          // D-03 — secret-classified files, path never transmitted
}).index("by_snapshot_version", ["snapshotId", "version"]),
```

This is deliberately **not** a reuse of `graphSnapshotNodes` — CONTEXT.md's D-10 rationale is
correct and directly verified: `graphSnapshotNodes`'s fixed fields (`nodeId, label, type, community,
source`, `schema.ts:1914-1921`) have no field for `department`/`access`/`isSecret`/`size`/`mtime`,
and repurposing `type`/`source` to encode them would be a lossy, undocumented overload of an
existing contract another consumer (Phase 114's *own* graph tile, and Phase 83-87's `/graphs` hub)
already depends on.

## Standard Stack — the inline batch-capped prune (D-11)

**Confirmed verbatim** — `convex/crons.ts:145-151`:
```
// Phase 83: Graph snapshot version retention (D-03)
// DISABLED 2026-07-14 — times out on self-hosted Convex; see note at archive-stale-events.
// crons.daily(
//   "sweep-graph-snapshot-versions",
//   { hourUTC: 4, minuteUTC: 30 },
//   internal.graphSnapshots.sweepGraphSnapshotVersions,
// );
```
And the shared root-cause comment at `crons.ts:39-44`: *"markStaleArchived, evaluateInternal, and
sweepGraphSnapshotVersions all hit the 15s syscall cap on self-hosted Convex (single node, SQLite,
3.2M docs) and NEVER complete. A failing cron execution retries on its own backoff regardless of
schedule, so throttling does not help — the retry storms starved ingest mutations."* This is a
direct, currently-live defect (not historical) — `sweepGraphSnapshotVersions` (the function itself,
`graphSnapshots.ts:168-224`) still exists and is exported, it is simply never invoked by anything
today.

**The batch-cap idiom to copy** — two live precedents, at two different granularities:
1. `graphSnapshots.ts:190-221`'s sweep: processes **at most one stale version per invocation**, with
   a `MAX_DELETES_PER_INVOCATION = 15000` safety guard under the ~16,000-doc write ceiling
   (`:193`). This is the sweep's OWN batch cap — not directly reusable since D-11 rejects a cron/sweep
   entirely — but the numeric ceiling (headroom under 16,000) is the number that matters.
2. `retention.ts`'s nightly pruner (`pruneBatchV3`, `:185-330`): `BATCH_SIZE = 200`,
   `MAX_BATCHES_PER_NIGHT = 600` (`:145-147`), reschedules itself via `ctx.scheduler.runAfter` when a
   table isn't finished (`:296-306`). **This reschedule mechanism is not available to D-11** — the
   whole point of "inline at ingest" is a single mutation invocation, with no scheduler hop, so there
   is no opportunity to "continue next batch."

**Recommended inline-prune shape for the new ingest mutation** (mirrors `upsertGraphSnapshot`'s
structure exactly, with one appended step):
```ts
export const upsertWorkspaceSnapshot = internalMutation({
  args: { /* ...directory rows, root/department/access summary... */ },
  handler: async (ctx, args) => {
    // 1-6. Same as graphSnapshots: read existing meta, compute newVersion,
    //      chunk-insert workspaceDirs rows for newVersion (CHUNK=1000).
    // 7. LAST: patch-or-insert workspaceSnapshots meta with new activeVersion.
    //    (Ordering identical to graphSnapshots.ts:137 — never move this earlier.)

    // 8. INLINE PRUNE (D-11) — runs in the SAME mutation, no scheduler hop.
    //    Recompute the full version list for this snapshotId from the index
    //    (workspaceDirs is far smaller than graphSnapshotNodes — directory
    //    count, not file count — so a full index read here is expected to
    //    stay well under the 32,000-doc scan ceiling; if the dry-run report
    //    (D-12) shows a directory count that makes this unsafe, THAT is the
    //    signal to lower keepN further before shipping, not to add a sweep).
    const allVersions = /* distinct versions from workspaceDirs.by_snapshot_version */;
    const toDelete = selectVersionDeletes(allVersions, WORKSPACE_KEEP_VERSIONS); // pure fn, copy shape from graphSnapshots.ts:30-34
    if (toDelete.length > 0) {
      const oldestVersion = toDelete[0]; // ONE version per ingest — never more, mirrors the sweep's own per-invocation cap
      const staleDirs = await ctx.db.query("workspaceDirs")
        .withIndex("by_snapshot_version", q => q.eq("snapshotId", args.snapshotId).eq("version", oldestVersion))
        .collect();
      const DELETE_CAP = 4000; // headroom under the ~16,000-doc write ceiling, shared with THIS ingest's own inserts in the same mutation
      for (const doc of staleDirs.slice(0, DELETE_CAP)) await ctx.db.delete(doc._id);
      // If staleDirs.length > DELETE_CAP: leave the remainder for the NEXT
      // ingest to catch (same version, same cap check) — never expand the
      // cap to "finish it this time." This is the never-mass-delete rule.
    }
  },
});
```

**Recommended `WORKSPACE_KEEP_VERSIONS`: 2 or 3, not `graphSnapshots`'s 7.** Rationale: the graph
snapshot's 7-version retention exists for temporal diffing (Phase 87's "Saved Views + Temporal
Diff" feature actually reads old versions). Nothing in this phase's scope (CONTEXT.md's
`<deferred>` explicitly excludes the map view and any Ástríðr-side lens) reads a workspace snapshot
version other than the active one — Phase 114 renders "the map," singular, present tense. Keeping
only 2-3 versions (one rollback buffer past active) minimizes both the steady-state row count and
the size of the one-version delete this inline step performs every night. **Flag for the planner**:
this number should be confirmed once D-12's dry-run report reveals the real directory-node count —
if it's in the low hundreds (plausible for ~10 named roots), even `keepN = 7` would be perfectly
safe; this recommendation is conservative-by-default, not load-bearing.

**Batch-cap number recommended: 4,000 deletes per ingest**, chosen as clear headroom under the same
~16,000-doc ceiling `graphSnapshots.ts:193`'s sweep uses for its own writes, while leaving room in
the SAME mutation invocation for this ingest's own new-version inserts (which happen first, in the
same call) — the two operations share one invocation's write budget, unlike the sweep which had the
whole budget to itself.

## Standard Stack — the host-side scanner precedent (D-04)

Read in full: `hooks/scanner.mjs` (338 lines, confirmed via `wc -l`) and `hooks/skillScan.mjs` (234
lines).

**Helpers `hooks/workspaceScan.mjs` should IMPORT, not copy:**

1. **The POST-with-bearer shape** — `scanner.mjs:220-241` (inside `runScan`):
   ```js
   const headers = { "Content-Type": "application/json" };
   if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
   else console.warn("[codepulse-scanner] no ASTRIDR_INGEST_API_KEY set — posting unauthenticated (server may reject)");
   const resp = await fetch(`${codepulseUrl}/scan`, { method: "POST", headers, body: JSON.stringify(snapshot), signal: controller.signal });
   ```
   with a 3-second `AbortController` timeout (`:221-222`). This exact block (parameterized by URL
   path and payload) is the shape to extract into a small shared helper both `scanner.mjs` and
   `workspaceScan.mjs` import — CONTEXT.md's D-04 says "importing shared helpers ... rather than
   copying them"; today this logic is NOT already factored into a separate module (it's inline in
   `runScan`), so the concrete task is: extract a `postSnapshot(url, key, body)` helper (new small
   file, e.g. `hooks/ingestPost.mjs`) that both scripts import, rather than `workspaceScan.mjs`
   re-implementing the same 20 lines.

2. **The `--dry-run` / `isDirectRun` branch** — `scanner.mjs:280-338`. Two distinct concepts worth
   separating for the workspace scanner:
   - `isDirectRun` (`:282`): `process.argv[1]` check so the module works both as `node
     hooks/scanner.mjs` and as an ESM import — same pattern needed for `workspaceScan.mjs` (D-05's
     scheduled task invokes it directly; tests import it as a module).
   - `--dry-run` (`:286,320-332`): for `scanner.mjs`, dry-run means "print what WOULD be POSTed, don't
     POST." For `workspaceScan.mjs`, dry-run is **the same flag but a much bigger deal** — it's the
     literal mechanism D-12's gate depends on. The gate design in this research (below) reuses this
     exact flag name/convention for continuity, but the workspace scanner's dry-run path additionally
     writes the reviewable report to disk and computes its approval hash — `scanner.mjs`'s dry-run
     path only logs to stdout (`:327-330`), which is NOT sufficient for D-12 (a report that only ever
     exists in a terminal scrollback cannot be diffed/approved later).

3. **The injectable-deps pattern** — `scanner.mjs:33-38`:
   ```js
   export async function runScan(sessionId, codepulseUrl, ingestKey, deps = {}) {
     const { home = homedir(), cwd = process.cwd(), collectSkills = collectClaudeCodeSkillsWithCoverage } = deps;
   ```
   Every real call site omits `deps` and gets true production behavior; tests pass `{ home, cwd }`
   pointing at `mkdtempSync` fixtures. `workspaceScan.mjs`'s equivalent `runWorkspaceScan(...,
   deps = {})` should take injectable `{ roots, config, homedir, readdirSync, statSync }` (or similar)
   so classifier/walk tests never touch the real `C:\Users\mandr\` tree — this is what makes the
   walker safely unit-testable at all (see Validation Architecture).

4. **The no-shebang constraint** — `scanner.mjs:5-10` header comment, verbatim: *"No shebang here
   (deliberately removed ...): this file is never invoked as `./scanner.mjs` anywhere in the repo —
   only via `node hooks/scanner.mjs ...` ... or as an ESM import ... A shebang has no effect on
   either invocation path, but Vite/Rolldown's SSR module transform (used by
   hooks/__tests__/scanner.test.mjs) hoists import statements above line 1, and a shebang left there
   breaks parsing of the resulting file with a hard 'Invalid Character `!`'."* This applies
   identically to `hooks/workspaceScan.mjs`: **do not add a shebang line**, for the same reason.

**`hooks/skillScan.mjs`'s coverage-declaration idea** (`collectClaudeCodeSkillsWithCoverage`,
`skillScan.mjs:173-229`): the function returns `{ skills, coveredOrigins }` where `coveredOrigins`
reflects **only sub-sources that were actually, successfully enumerated** — a partial/failed walk of
one sub-source does not silently mark the whole thing "covered" (`:107-118`'s comment on the
adversarial-gate fix: "Coverage now requires BOTH that at least one plugin was actually read AND
that no plugin's read failed"). This directly informs the workspace snapshot's own completeness
semantics: **`workspaceSnapshots` should carry a `scannedRootsComplete: boolean` (or a per-root
`coveredRoots: string[]` array, same shape as `scannedOrigins`/`scannedOriginsComplete` already on
the `/scan` wire — `scanner.mjs:105-106`)** so a partial walk (e.g. an unmounted vault drive, a
permission-denied subtree) is never silently rendered by Phase 114 as "this is the complete map."
This is a **new field this phase must add** — nothing in D-01 through D-14 currently names it
explicitly, but it is a direct, load-bearing consequence of the precedent CONTEXT.md pointed at, and
should be flagged to the planner as an implied requirement.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  HOST (Windows, C:\Users\mandr)                                      │
│                                                                        │
│  Windows Task Scheduler (nightly, D-05)                              │
│    └─ wscript.exe run-hidden.vbs powershell.exe                      │
│         -File hooks\workspaceScan.mjs                                │
│              │                                                        │
│              ▼                                                        │
│  hooks/workspaceScan.mjs  ── imports ──▶ hooks/scanner.mjs's shared   │
│    │                                       POST/bearer helper (new     │
│    │  1. Read config/workspace.json         extracted module)         │
│    │     (roots, department map, allowlist)                          │
│    │  2. Walk each declared root            (D-06, EXCLUDE_DIRS)      │
│    │     fs.readdirSync/statSync ONLY       (D-01: never readFileSync │
│    │       of a scanned file's contents)     on scanned file bodies)  │
│    │  3. Parse astridr-repo/docker-compose.yml (js-yaml)              │
│    │     → derive access: astridr-reachable | local-only  (D-09)     │
│    │  4. Classify each file: department (D-07/D-14),                  │
│    │     allowlist match → shareable | secret (D-02)                  │
│    │  5. Roll up to per-directory aggregates ONLY (D-13):             │
│    │     fileCount, totalSize, withheldCount, dept/access mix         │
│    │  6. Build dry-run report (counts, withheld total,                │
│    │     Unclassified list, classification sample)                    │
│    │  7. Hash report → compare to checked-in approval marker (D-12)   │
│    │       │                                                          │
│    │       ├─ NO MATCH ──▶ ABORT. No POST is ever attempted.          │
│    │       │                                                          │
│    │       ▼ MATCH                                                    │
│    │  8. POST versioned snapshot (dirs only, no filenames for         │
│    │     secret-classified paths — D-03) to Convex httpAction          │
│    └────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS POST, Bearer ASTRIDR_INGEST_API_KEY
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CONVEX (self-hosted, 127.0.0.1:3210/3211)                           │
│                                                                        │
│  http.ts: new route (e.g. /workspace-ingest), reusing                │
│    validateIngestAuth() + getCorsHeaders() — NO new auth surface      │
│         │                                                              │
│         ▼                                                              │
│  httpAction handler ──▶ ctx.runMutation(internal.workspace.           │
│                            upsertWorkspaceSnapshot, {...})            │
│                            (internalMutation — never public, unlike    │
│                             registry.syncInventory today — see         │
│                             Security section)                          │
│         │                                                              │
│         ▼                                                              │
│  1-6. Insert workspaceDirs rows for newVersion (chunked, 1000/batch)  │
│  7. LAST: patch workspaceSnapshots.activeVersion = newVersion         │
│  8. INLINE PRUNE: delete oldest version's rows if > keepN versions    │
│     exist (batch-capped, ≤4000 deletes, this invocation only)         │
│                                                                        │
│  (Phase 114, NOT this phase, reads workspaceSnapshots/workspaceDirs   │
│   via a query and renders the map — out of scope here.)               │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
hooks/
├── workspaceScan.mjs          # NEW — the scanner entry point (D-04)
├── workspaceClassifier.mjs    # NEW — pure (path, config) → {department, access, isSecret} (D-08)
├── ingestPost.mjs             # NEW (extracted) — shared POST-with-bearer helper, imported by
│                               #   both scanner.mjs and workspaceScan.mjs
├── scanner.mjs                # UNTOUCHED (D-04's explicit constraint)
├── skillScan.mjs               # UNTOUCHED — read for its coverage-declaration pattern only
└── __tests__/
    ├── workspaceScan.test.mjs        # wire-contract tests, mirrors scanner.test.mjs's real-HTTP-server pattern
    ├── workspaceClassifier.test.mjs  # pure classifier tests — the bulk of coverage (D-08)
    └── dryRunGate.test.mjs           # D-12 mutation-tested refusal (see Validation Architecture)

config/
└── workspace.json             # NEW — roots, department map, allowlist patterns (D-08's config location)

convex/
├── workspace.ts                # NEW — upsertWorkspaceSnapshot (internalMutation), getWorkspaceMap query
├── workspace.test.ts            # NEW — pure-logic mirror tests (no DB round-trip), same style as graphSnapshots.test.ts
├── http.ts                      # EDIT — add /workspace-ingest route
└── schema.ts                    # EDIT — add workspaceSnapshots + workspaceDirs tables

scripts/ (outside this repo, C:\Users\mandr\scripts)
└── install-workspace-scan-task.ps1  # NEW — Register-ScheduledTask, modeled on install-preopen-guard.ps1
```

### Pattern 1: Versioned swap-write with pointer-last (copy from `graphSnapshots.ts`)
**What:** Insert all of the new version's rows first; only patch the "active" pointer after every
row is durably written.
**When to use:** Any ingest where a partial write must never be visible to readers.
**Example:** See the D-10 section above — full ordering already quoted.

### Pattern 2: Inline, self-capping prune (adapted from `graphSnapshots.ts`'s sweep + `retention.ts`'s batch idiom)
**What:** Delete only the oldest version's rows, only after the new version's pointer flip has
already succeeded, capped well under Convex's per-mutation write ceiling, inside the SAME mutation
invocation (no scheduler hop, no cron).
**When to use:** Any nightly single-producer table on the self-hosted instance, per CLAUDE.md's
"never bulk-delete on the live instance" rule.
**Example:** See D-11 section above.

### Pattern 3: Injectable-deps pure walker (from `scanner.mjs`)
**What:** A scan function takes real `os.homedir()`/`process.cwd()`/filesystem calls as *default*
parameter values, overridable via a `deps` object, so tests substitute `mkdtempSync` fixtures
without monkeypatching live ESM bindings.
```js
// Source: hooks/scanner.mjs:33-38
export async function runScan(sessionId, codepulseUrl, ingestKey, deps = {}) {
  const {
    home = homedir(),
    cwd = process.cwd(),
    collectSkills = collectClaudeCodeSkillsWithCoverage,
  } = deps;
```
**When to use:** `hooks/workspaceScan.mjs`'s top-level `runWorkspaceScan(config, deps = {})`.

### Pattern 4: Coverage-honest partial-scan reporting (from `skillScan.mjs`)
**What:** A boolean/array field on the emitted snapshot that reflects **actual enumeration success**
per sub-source, never assumed true.
```js
// Source: hooks/skillScan.mjs:107-118 (comment) + :173-229 (implementation)
// "Coverage now requires BOTH that at least one plugin was actually read AND
//  that no plugin's read failed"
```
**When to use:** `workspaceSnapshots`' proposed `scannedRootsComplete`/`coveredRoots` fields.

### Anti-Patterns to Avoid
- **Reusing `graphSnapshotNodes` fields for workspace data** — rejected explicitly by D-10; the
  field set doesn't fit and would silently overload an existing contract another feature depends on.
- **A public `mutation` for the write path** — `convex/registry.ts:130`'s `syncInventory` is
  exactly this anti-pattern today (see Security Domain below); do not repeat it for
  `upsertWorkspaceSnapshot`.
- **A cron-based sweep for version retention** — this is D-11's entire rejected alternative,
  directly falsified by the disabled `sweepGraphSnapshotVersions` cron registration.
- **A secret-shaped regex allowlist/denylist** — D-02's entire rejected alternative; the donor's
  `SECRET_RE` (`scan.js:46`) measurably fails open on 4 real files in Larry's own tree (see D-02
  section).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Versioned snapshot storage with crash-safety | A new bespoke pointer-swap scheme | Copy `graphSnapshots.ts`'s exact ordering | Already solved, already reviewed, already has a documented failure mode (the disabled sweep) to avoid repeating |
| POST-with-bearer + timeout to Convex from a host script | A new fetch wrapper | Extract/reuse `scanner.mjs`'s existing block (helper extraction recommended above) | Identical requirement, already correct (3s `AbortController`, graceful non-fatal failure) |
| YAML parsing for docker-compose | A hand-rolled line-based parser | `js-yaml` (`^5.2.1`, already installed) | Already a dependency; hand-parsing YAML for indentation/anchors (`docker-compose.yml` uses YAML anchors, e.g. `*default-logging` at `:326`) is a well-known correctness trap |
| Ingest auth + CORS | A new bearer-check function | `validateIngestAuth`/`getCorsHeaders` from `convex/ingestAuth.ts` | D-04/canonical refs explicitly require zero new auth surface; the existing functions are fail-closed and already reviewed (CSO-95-01 comment at `ingestAuth.ts:69-71`) |
| Scheduled-task hidden launch | A new hide-the-console trick | `run-hidden.vbs` (826 bytes, verified present) via `wscript.exe //B //Nologo` | The project already burned a real incident (ClaudeConfigPull, 5+ weeks silently not running) discovering `powershell -WindowStyle Hidden` doesn't hide under Windows Terminal; don't re-discover this |

**Key insight:** every piece of infrastructure this phase needs already exists in the repo in a
working, tested form for a structurally identical problem. The risk in this phase is not "will the
technology work" — it is "will the classification rules (D-02/D-06/D-14) actually match Larry's
real filesystem," which is precisely what D-12's dry-run gate is designed to catch before any of
this infrastructure ever transmits a byte.

## Common Pitfalls

### Pitfall 1: `totalSize`/`fileCount` as a side-channel around D-03's secret omission
**What goes wrong:** If a directory's aggregate `totalSize`/`fileCount` includes withheld
(secret-classified) files' bytes, an attacker (or just a curious viewer of the map) could infer the
presence/size of a specific secret file by watching the directory's total shrink/grow when that file
is added/removed, even though its name is never shown.
**Why it happens:** The natural implementation rolls up ALL files in a directory into one total
without separating visible vs. withheld.
**How to avoid:** Keep `fileCount`/`totalSize` scoped to **visible** files only, and `withheldCount`
as a **separate, deliberately coarse** counter (count only, never size) — exactly as CONTEXT.md's
D-03 describes ("a withheld count per directory so the omission is visible ... rather than silent").
Do not add a `withheldBytes` field; a byte total is a far higher-resolution side channel than a
count.
**Warning signs:** A directory's total size changing between two snapshot versions when nothing
"visible" was modified.

### Pitfall 2: Treating `access: astridr-reachable` as "Ástríðr can read the LIVE file," not "this path is under a bind mount"
**What goes wrong:** The derivation (D-09) only proves a *mount* exists — it does not prove the
container process actually has read permission on every file under it, nor that the mount is
currently healthy (a Docker Desktop/WSL hiccup can make a mount empty without changing
`docker-compose.yml`).
**Why it happens:** "Derived from the compose file" sounds authoritative, but the compose file is
declared intent, not runtime truth (same class of gap as the CLAUDE.md LESSON about
`schtasks /query` returning empty from this shell — declared state and live state can diverge).
**How to avoid:** Label the field `access` (not `astridrCanRead` or similar) and document in the
config/report that it reflects **declared bind-mount coverage**, not a live reachability probe. No
live probe is in scope for this phase.
**Warning signs:** None visible from this phase alone — Phase 114's map should not overclaim
liveness either.

### Pitfall 3: The 21,029-file scale number silently balloons if the root list grows without re-checking directory-node count
**What goes wrong:** D-13's rationale for directory-only nodes cites a specific number (21,029 files
across 3 roots) — but this phase's own D-06 discretion item is to propose an EXPANDED root list
(repos, not just `.claude`/`.claude-alt`/vault). Adding ~10 more repo roots (see D-06/D-14 section
below for real candidates found on disk) could add tens of thousands more files and,
correspondingly, hundreds to low-thousands more directories — a number nobody has actually measured
yet.
**Why it happens:** The measured number in CONTEXT.md was taken BEFORE the full root list was
decided; extrapolating "directories are cheap, so any root list is fine" from a partial measurement
is optimistic, not verified.
**How to avoid:** D-12's dry-run report MUST report the actual directory-node count for the
proposed root list before the schema/batch-cap numbers (D-11's `keepN`, `DELETE_CAP`) are treated as
final. This research's D-11 numbers are deliberately conservative for exactly this reason.
**Warning signs:** A dry-run report showing directory-node count in the tens of thousands would
invalidate the "single inline delete is always safe" assumption and require either a smaller
`keepN` or the same inline-cap-and-defer-remainder logic graphSnapshots.ts's sweep already
demonstrates.

### Pitfall 4: `js-yaml`'s default `load()` chokes on unrecognized custom tags, and `docker-compose.yml` uses YAML anchors
**What goes wrong:** `docker-compose.yml:326` uses a `*default-logging` anchor reference (defined
elsewhere in the file via `&default-logging`). Standard `js-yaml.load()` handles anchors/aliases
correctly by default (this is core YAML, not a Docker-specific extension), but if the compose file
ever adds a `!reset`-style custom Compose tag (rare, but Compose does have a couple of nonstandard
tag extensions in some configurations), a naive `load()` call would throw. This has NOT been
observed in this file — flagging as a defensive note, not a confirmed defect.
**Why it happens:** Compose files are "YAML plus a few Docker-specific conventions," and a generic
YAML library only guarantees the "YAML" part.
**How to avoid:** Wrap the `js-yaml.load()` call in a try/catch and treat a parse failure as
"cannot derive access for this run — fall back to `local-only` for everything" (fail closed on the
access dimension, consistent with D-02's fail-closed philosophy for secrets) rather than crashing
the whole scan.
**Warning signs:** A workspace snapshot where every single directory reports `access: local-only`
despite known-mounted roots — that is the signature of a silent compose-parse failure, not a real
change in Ástríðr's world.

### Pitfall 5: Windows path separator mismatches when matching roots against `EXCLUDE_DIRS`/allowlist patterns
**What goes wrong:** The donor `scan.js` builds `rel` paths with forward slashes throughout
(`path.posix`-style joins are implied by its `'/'`-literal logic, e.g. `deptOf`'s
`rel.split('/')[2]`), but this scanner runs on native Windows paths (`path.join` uses `\` by
default). A classifier rule written as `startsWith('shared/')` will never match a Windows-joined
`shared\foo.md` path.
**Why it happens:** Direct line-for-line adaptation of the donor's path logic without normalizing
separators first.
**How to avoid:** Normalize every relative path to forward slashes (`rel.replace(/\\/g, '/')`)
immediately after computing it, before any classification rule runs — same normalization
`hooks/skillScan.mjs:158-164`'s `samePath()` helper already does for a different purpose (comparing
two absolute paths cross-platform), confirming this is an established idiom in this codebase, not a
new invention.
**Warning signs:** A dry-run report showing zero matches for any allowlist pattern that uses a `/`
literal, or every file falling into the same default department.

## Code Examples

### Dry-run report hash gate (D-12) — concrete, mutation-testable shape

```js
// hooks/workspaceScan.mjs (new) — sketch, not final code
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

const APPROVAL_MARKER_PATH = join(__dirname, "workspace-scan.approved-report.sha256");

/** Pure function — the unit under test for D-12's mutation test. */
export function canonicalReportHash(report) {
  // Canonical key order matters — JSON.stringify's own key order is
  // insertion order, so the report builder must construct keys in a fixed
  // order (or sort keys here) so the hash is stable across runs that
  // produce byte-identical DATA but happen to build the object differently.
  const canonical = JSON.stringify(report, Object.keys(report).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/** Pure function — the second unit under test. */
export function isDryRunApproved(reportHash, approvalFileContents) {
  if (!approvalFileContents) return false; // no marker at all → refuse
  return approvalFileContents.trim() === reportHash;
}

// In the real (non-dry-run) run path, BEFORE any fetch() call:
const report = buildDryRunReport(scanResult); // per-department counts, withheld total, Unclassified list, sample
const hash = canonicalReportHash(report);
const approved = existsSync(APPROVAL_MARKER_PATH) ? readFileSync(APPROVAL_MARKER_PATH, "utf8") : null;
if (!isDryRunApproved(hash, approved)) {
  console.error("[workspace-scan] REFUSED: dry-run report has not been approved (or has changed since approval). " +
    "Run `node hooks/workspaceScan.mjs --dry-run` and review, then `--approve` to write the marker.");
  process.exit(1); // no fetch() is ever reached
}
```

**Why this is mutation-testable (per D-12's explicit requirement):** `canonicalReportHash` and
`isDryRunApproved` are both pure functions with zero I/O — a test can (1) construct a report,
approve its hash, assert the gate passes; (2) mutate one field of the report (e.g. change
`withheldCount` by 1) and assert the SAME approval marker now fails; (3) delete/corrupt the marker
file content and assert refusal. This directly satisfies the project's standing rule (LESSONS
2026-07-10: *"a gate which can skip itself must be shown to have evaluated something"*) — the test
suite must include a run where the mutation makes the gate's condition literally impossible to
satisfy, confirming the refusal path is reachable and correct, not merely present in source.

### Chunked insert for the new version (copy shape from `graphSnapshots.ts:102-121`)

```ts
// Source: convex/graphSnapshots.ts:102-121, adapted field names
const CHUNK = 1000;
for (let i = 0; i < args.dirs.length; i += CHUNK) {
  const batch = args.dirs.slice(i, i + CHUNK);
  for (const dir of batch) {
    await ctx.db.insert("workspaceDirs", {
      snapshotId: args.snapshotId,
      version: newVersion,
      rootId: dir.rootId,
      dirPath: dir.dirPath,
      department: dir.department,
      access: dir.access,
      fileCount: dir.fileCount,
      totalSize: dir.totalSize,
      latestMtime: dir.latestMtime,
      withheldCount: dir.withheldCount,
    });
  }
}
```

### Scheduled task registration (D-05) — exact working template found on this machine

`C:\Users\mandr\scripts\install-preopen-guard.ps1` is a live, working, already-elevated-checked
template for exactly this problem (a daily task launched hidden via `run-hidden.vbs`, with the
`DisallowStartIfOnBatteries` trap explicitly avoided). Full file read this session; the load-bearing
block:
```powershell
# Source: C:\Users\mandr\scripts\install-preopen-guard.ps1:39-60 (verified, live precedent)
$argStr = '//B //Nologo "' + $HiddenVbs + '" C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe ' +
          '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '"'
$action    = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument $argStr
$trigger   = New-ScheduledTaskTrigger -Daily -At '02:00'   # nightly, per D-05
$principal = New-ScheduledTaskPrincipal -UserId 'mandr' -LogonType S4U -RunLevel Limited
# DisallowStartIfOnBatteries defaults to $true in New-ScheduledTaskSettingsSet — MUST override:
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
               -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
               -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'CodePulse-WorkspaceScan' -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force `
  -Description 'Nightly workspace scanner (Phase 115) — walks declared roots, POSTs versioned snapshot.'
```
Note `run-hidden.vbs`'s own mechanism (`C:\Users\mandr\scripts\run-hidden.vbs`, read in full, 22
lines): it is a `wscript.exe` (GUI-subsystem, no console ever created) wrapper that runs the given
command via `WScript.Shell.Run(cmd, 0, True)` (window style `0` = hidden, `True` = wait-for-exit) and
propagates the exit code, so `LastTaskResult` still reflects real failures — unlike a raw
`-WindowStyle Hidden` PowerShell invocation.

`fix-hidden-task-launchers.ps1`'s **read-back verification pattern** (`:36-43`) is also directly
reusable for confirming the task registered correctly, since — per this session's environment
constraint — `schtasks /query` returns zero lines from this shell:
```powershell
# Source: C:\Users\mandr\scripts\fix-hidden-task-launchers.ps1:36-43
$t = Get-ScheduledTask -TaskName $name
if ($t.Actions[0].Execute -like '*wscript.exe' -and $t.Actions[0].Arguments -like '*run-hidden.vbs*') {
  Write-Host "PASS $name -> wrapped in run-hidden.vbs" -ForegroundColor Green
}
```
`Get-ScheduledTask` (PowerShell's own cmdlet, not the `schtasks.exe` CLI) is a DIFFERENT code path
from the `schtasks /query` invocation this session confirmed broken — it may or may not share the
same failure. **This must be verified live by Larry** (see Environment Availability below); this
research cannot confirm which read path works from an agent shell.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proposed `WORKSPACE_KEEP_VERSIONS = 2-3` is safe/sufficient | D-11 | Low — this is a config constant, trivially changed later; worst case is either wasted storage (too high) or losing rollback history (too low), neither is a data-loss risk given D-11's inline delete only ever removes ONE old version at a time |
| A2 | Proposed `workspaceDirs` full-index read for prune candidate-selection stays under Convex's ~32,000-doc scan ceiling | D-11 | Medium — if the real directory-node count (unmeasured until D-12's dry-run) is large, this read could itself time out on self-hosted Convex, the exact failure mode that disabled `sweepGraphSnapshotVersions`. Flagged explicitly; the dry-run report is the mitigation. |
| A3 | The vault (`Mandras`) and `.claude`/`.claude-alt` roots should map to "Unclassified" rather than a guessed department | D-14 concrete proposal | Medium — this is a judgment call about Larry's intent, not a technical fact. If he actually wants the vault force-classified by sub-path (closer to the donor's `deptOf()` model), D-14's literal "root→department, not sub-path" reading would need revisiting. Flagged as an Open Question below. |
| A4 | The ~10 additional repo-root candidates found under `C:\Users\mandr\` (see D-06 below) are correctly bucketed Work/Consulting/Personal by name-pattern inference alone | D-06 | High for the ones with direct textual evidence (docker-compose mounts, CLAUDE.md text); LOW-confidence guesses for the rest are explicitly marked as guesses, not asserted as fact, and MUST be confirmed by Larry or left Unclassified pending confirmation. **RESOLVED at planning time by D-16 + D-17: all of them ship as declared roots mapped to Unclassified, and their names live only in the gitignored local config — not in this public repo.** |
| A5 | `js-yaml`'s default anchor/alias handling is sufficient for `docker-compose.yml` with no custom Compose YAML tags | D-09 | Low — no custom tags observed in the read portions of the file; Pitfall 4 documents a fail-closed fallback regardless |
| A6 | Convex's per-mutation write ceiling is close to 16,000 docs (as cited in this repo's own comments) | D-10/D-11 batch-cap numbers | Low — this is [CITED: convex/graphSnapshots.ts:161,193 comments], which is itself this repo's own empirically-derived operating knowledge from a real incident, not raw training-data recall; treated as HIGH confidence for planning purposes but not independently re-verified against current Convex docs this session |

## Open Questions

1. **Should the vault and `.claude`/`.claude-alt` roots be "Unclassified" (this research's
   recommendation) or force-classified by sub-path, closer to the donor's `deptOf()` model?**
   - What we know: D-14 explicitly scopes department assignment to the ROOT level ("Root→department
     assignment is an explicit map"), which structurally cannot express "this subfolder of the vault
     is Work, that one is Personal" without either (a) declaring dozens of narrower roots pointing at
     vault subdirectories, or (b) reintroducing the donor's rejected sub-path `deptOf()` logic that
     CONTEXT.md says D-07/D-14 replace.
   - What's unclear: whether Larry actually wants (a), or is fine with the vault/`.claude`/`.claude-alt`
     showing up as a single honest "Unclassified" group on the map, at least for this phase's first cut.
   - Recommendation: default to Unclassified for phase 115 (matches D-14's stated preference for
     honesty over a guessed default), and treat "narrower vault sub-roots" as a natural v2 follow-up
     once the dry-run report shows Larry how much of the map that leaves unclassified.

2. **What is the actual full Work/Consulting root list?** — **RESOLVED at planning time (D-16 + D-17).**
   - What we knew: the ProtectAll-named repos are near-certain Work (matching "ProtectAll — CTO" in
     Larry's global CLAUDE.md), and one catalog repo is plausibly Work/consulting-adjacent. No
     directory under `C:\Users\mandr\` obviously self-identifies as "Consulting."
   - What was unclear: ~10 further directories could not be bucketed Consulting vs Personal vs Work
     from their names alone. Several read as plausible consulting-client names, but that was a guess
     from directory naming with zero corroborating evidence read this session.
   - **Resolution:** all ~10 ship as *declared* roots mapped to `Unclassified` (D-16) — nothing
     guessed into a real department, nothing invisible. Their actual names are deliberately NOT
     recorded in this file or in the tracked config, because this repo is public (D-17): they live
     only in the gitignored `config/workspace.local.json`. D-12's dry-run report lists them with
     file counts so Larry re-maps the real ones in one local edit before first ingest.

3. **Does `Get-ScheduledTask` (PowerShell cmdlet) succeed from this agent's shell where
   `schtasks /query` (CLI) does not?**
   - What we know: this session's environment note states `schtasks /query` returns zero lines,
     proven broken by a control (also fails to find the known-installed `ConvexNightlyRestart`
     task). `Get-ScheduledTask` is a different code path (WMI/CIM-based, not the legacy `schtasks.exe`
     console tool) and MAY behave differently.
   - What's unclear: untested this session — no scheduled-task creation/read was attempted (would be
     a live, destructive-adjacent operation inappropriate for a research pass).
   - Recommendation: the planner should have the EXECUTOR probe `Get-ScheduledTask -TaskName
     'ConvexNightlyRestart'` (a known-present control, per CLAUDE.md) as the very first step of any
     D-05 task-registration plan step, before trusting its own registration read-back. If that
     control also comes back empty, verification must be delegated to Larry directly (visual check
     in `taskschd.msc`, or a manual `schtasks /query /tn CodePulse-WorkspaceScan` run by him).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Running `hooks/workspaceScan.mjs` | ✓ (implied — repo already runs Vite 7/Node tooling) | not independently re-verified this session | — |
| `js-yaml` | D-09 compose parsing | ✓ | `^5.2.1` [VERIFIED: `package.json:44`] | — |
| `run-hidden.vbs` | D-05 scheduled task | ✓ | 826 bytes, verified present and read in full this session | — |
| Windows Task Scheduler (registration + verification) | D-05 | **UNVERIFIED from this shell** — `schtasks /query` returns zero lines, proven broken by a control | — | `Get-ScheduledTask` cmdlet (untested); ultimately, Larry's own manual confirmation via `taskschd.msc` |
| `astridr-repo/docker-compose.yml` | D-09 | ✓ | read directly this session, lines 320-390 and 527-554 confirmed | — |
| Self-hosted Convex backend (127.0.0.1:3210/3211) | Deploying the new schema/mutation | Not probed this session (research phase does not touch the live backend) | — | — |

**Missing dependencies with no fallback:** None — everything the phase needs is present.

**Missing dependencies with fallback:** Scheduled-task registration verification (fallback: manual
confirmation by Larry, or a different read API than the one confirmed broken).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` [VERIFIED: `package.json:89`] |
| Config file | existing `vitest.config.ts`/`vite.config.ts` (already covers `hooks/__tests__/*.test.mjs` and `convex/*.test.ts` — both patterns already run today, confirmed via `hooks/__tests__/scanner.test.mjs` and `convex/graphSnapshots.test.ts`) |
| Quick run command | `npx vitest run hooks/__tests__/workspaceClassifier.test.mjs` (or the equivalent new file) |
| Full suite command | `npm test` (repo-wide `vitest`) |

### What is unit-testable as a pure function
D-08 is explicit design intent, verified achievable by this research: the classifier
`(path, config) → { department, access, isSecret }` needs **zero I/O** to test — no real
filesystem, no Convex, no network. This mirrors `convex/graphSnapshots.test.ts`'s own established
style exactly: pure-logic "mirror functions" tested with plain `expect()` assertions, zero DB
round-trip (`graphSnapshots.test.ts:1-83` for `selectVersionDeletes`, `:85-140` for the dispatch
mapping). The same style applies directly to:
- `classifyPath(relPath, config)` — department + access + secret, given a loaded `workspace.json`.
- `selectVersionDeletes` (D-11's own version, copy-shaped from `graphSnapshots.ts:30-34`).
- `canonicalReportHash`/`isDryRunApproved` (D-12's gate, shown fully worked above).
- `deriveAccessFromCompose(parsedYaml)` — feed it a small hand-built object shaped like `js-yaml`'s
  parse output (not the real file), assert the resulting path set.

### How D-12's refusal gets mutation-tested
Concretely (see Code Examples above for the functions under test):
1. **Baseline**: build report A, hash it, write the hash to a fixture "approval file", call
   `isDryRunApproved(hash(A), approvalFileContents)` → expect `true`.
2. **Mutation 1 (content drift)**: build report B that differs from A in exactly one field (e.g.
   `withheldCount` +1). Call `isDryRunApproved(hash(B), approvalFileContents /* still A's hash */)`
   → expect `false`. This is the load-bearing assertion: it proves that ANY change to what would be
   transmitted invalidates a stale approval, not just a boolean on/off toggle.
3. **Mutation 2 (marker absent)**: `isDryRunApproved(hash(A), null)` → expect `false`.
4. **Mutation 2 (marker corrupted)**: `isDryRunApproved(hash(A), "not-a-real-hash")` → expect
   `false`.
5. **Control**: confirm the real `workspaceScan.mjs` entry point calls `process.exit(1)` (or throws,
   depending on final shape) BEFORE its `fetch()` call is reached when `isDryRunApproved` returns
   false — this is the one integration-level assertion needed beyond the pure-function unit tests,
   verifiable by injecting a `deps.postSnapshot` spy and asserting it was never called (same
   injectable-deps pattern as `scanner.mjs`'s `collectSkills` override).

### How the versioned-write ordering gets proven (partial-ingest scenario)
`convex-test` is NOT installed in this repo (confirmed — `graphSnapshots.test.ts:4-7`'s own comment:
*"mirrors the processTaskQualityEvent/processSwarmTaskEvent pure-function extraction convention
already used in this file's test suite"* precisely because a real DB round-trip isn't available).
This repo's established pattern for this exact gap is `it.todo(...)` markers for the DB-dependent
cases, deferred to a live-verification wave/plan — see `graphSnapshots.test.ts:275-279` for 5 such
todos (e.g. `"upsertGraphSnapshot re-POST same snapshotId → activeVersion increments to 2, never two
active versions (DB round-trip)"`). The workspace ingest mutation should follow the identical
pattern:
- Pure-logic mirror tests (chunk-size math, dangling-directory guard if any, meta-doc-shape
  computation) — real, runnable, in `convex/workspace.test.ts`.
- `it.todo(...)` markers for anything that genuinely requires a live Convex round-trip (activeVersion
  incrementing correctly across two real ingests; the inline prune actually removing rows and not
  the active version's rows) — deferred to an attended live-deploy verification wave, exactly as
  Phase 83 did.

### What can only be verified by an attended live run
- **The real dry-run report against Larry's actual filesystem** — this is the entire point of D-12;
  no test fixture can substitute for it, by design.
- **D-05's scheduled task actually firing unattended overnight** — Task Scheduler behavior (per this
  project's own `ClaudeConfigPull` 5-week silent-failure precedent) cannot be verified except by
  observing a real overnight run's evidence (a new snapshot version landing in Convex the next
  morning, or a log file the launcher script writes).
- **The compose-file mount parse against the REAL `astridr-repo/docker-compose.yml`** (not a
  fixture) — the pure `deriveAccessFromCompose` function is unit-testable against a hand-built
  fixture, but confirming it correctly parses the actual file (anchors, the two-services-union
  requirement) needs one live run against the real file, ideally as part of the dry-run report
  review itself.
- **Convex schema deploy reaching the live self-hosted backend** — see the next section; `tsc
  --noEmit`/`npm test` passing does NOT prove the schema is live.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | Bearer-token reuse via `validateIngestAuth` — a shared secret, not per-user auth; appropriate for a single-operator self-hosted instance, consistent with every other ingest route in this repo |
| V3 Session Management | No | No session concept in this ingest path |
| V4 Access Control | **Yes — the load-bearing control for this phase** | The write mutation MUST be `internalMutation`, called only from the httpAction after `validateIngestAuth` passes. See below — this repo has a live counter-example. |
| V5 Input Validation | Yes | Convex `v.*` argument validators on the new mutation (same pattern as `graphSnapshots.ts:56-83`); reject malformed root/path strings defensively even though the producer is host-controlled, not user-controlled |
| V6 Cryptography | Minimal | `crypto.createHash("sha256")` for D-12's report-integrity check is an integrity mechanism, not a secrecy one — no key management, no attacker model requiring collision-resistance beyond "detect an unintentional content change" |

### The `internalMutation` question, answered directly

**Yes, the workspace ingest mutation MUST be `internalMutation`, called only from the httpAction.**
Evidence for why this matters, found live in this repo this session:

`convex/graphSnapshots.ts:16` imports `internalMutation` and both its write functions
(`upsertGraphSnapshot`, `sweepGraphSnapshotVersions`) are declared as `internalMutation`
(`:55`, `:168`) — the file's own header comment states the reason explicitly: *"Writers are
internalMutation — called from the /runtime-ingest httpAction which has no Clerk identity (same rule
as forge.appendLogChunk)."*

**But this repo does NOT apply that rule uniformly today.** `convex/scan.ts` — the existing `/scan`
endpoint this phase's design explicitly parallels — calls `api.registry.syncInventory` (`scan.ts:23`),
and `convex/registry.ts:130` confirms `syncInventory` is declared as a **public** `mutation`, not
`internalMutation`. Combined with CLAUDE.md's documented finding (*"Every **public** Convex function
is callable with no credential by anything that can route to the host"*, verified 2026-08-11 in this
repo's own operational notes) and this session's confirmation that `validateIngestAuth` (`scan.ts:17`)
is the ONLY gate in front of `syncInventory` at the httpAction layer — **the bearer check in
`scan.ts` protects the HTTP route, but `api.registry.syncInventory` itself remains directly callable
via an unauthenticated `POST /api/mutation` if a caller can route to the Convex backend at all**,
per the tailnet-is-the-boundary decision (SEED-008, `CLAUDE.md`).

For the new workspace ingest route, follow `graphSnapshots.ts`'s pattern, not `scan.ts`'s:
`upsertWorkspaceSnapshot` should be `internalMutation`, invoked via `ctx.runMutation(internal.workspace.upsertWorkspaceSnapshot, {...})`
from inside the new httpAction, after `validateIngestAuth` passes. This adds a real second layer —
even if the bearer key leaks or the tailnet boundary is ever crossed (CLAUDE.md names this as the
actual reopen condition for the whole "tailnet is the boundary" decision), a caller who reaches the
Convex backend directly still cannot invoke `internal.workspace.upsertWorkspaceSnapshot` — only
Convex's own httpAction dispatch can reach `internal.*` functions. This is strictly better than
`scan.ts`'s existing shape and costs nothing extra to build correctly from the start.

**Note for the planner, not this phase's scope:** `registry.syncInventory` being public is a
pre-existing gap in `/scan`, unrelated to this phase — flagging it here only because CONTEXT.md
pointed at `/scan` as a sibling precedent and the gap is directly relevant to "don't repeat this."
Fixing it is out of scope; do not fold it into this phase's plan.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret file path/content leaves the host in the snapshot payload | Information Disclosure | D-01 (no `readFileSync` of scanned file bodies, structural), D-02 (deny-by-default allowlist), D-03 (secret paths omitted entirely, count-only) |
| Directory size/count used as a side channel to infer a specific withheld file's presence/size | Information Disclosure | Pitfall 1 above — never include withheld-file bytes in `totalSize` |
| Unauthenticated write to the new ingest route | Spoofing / Tampering | `validateIngestAuth` reuse (fail-closed per `ingestAuth.ts:76-85`) + `internalMutation` (defense in depth — see above) |
| A misconfigured allowlist (config drift) silently widens what's transmitted | Tampering | D-12's structural dry-run gate — any config change that alters the report's content invalidates the prior approval hash (proven by mutation test above) |
| Mass-delete / tombstone storm on the self-hosted Convex instance | Denial of Service | D-11's inline, batch-capped, single-old-version-per-ingest prune; CLAUDE.md's explicit "never bulk-delete on the live instance" rule |
| A scheduled task silently never fires (battery/console/elevation gotchas) | Denial of Service (availability of the data pipeline, not a classic security threat, but a real operational risk this project has been burned by twice) | D-05's `run-hidden.vbs` + explicit `-AllowStartIfOnBatteries` per the `install-preopen-guard.ps1` template |

## Sources

### Primary (HIGH confidence — read live, this session)
- `C:\Users\mandr\codepulse\.planning\phases\115-workspace-scanner\115-CONTEXT.md` — full read, all 14 decisions
- `C:\Users\mandr\codepulse\convex\graphSnapshots.ts` — full read (301 lines)
- `C:\Users\mandr\codepulse\convex\graphSnapshots.test.ts` — full read (280 lines)
- `C:\Users\mandr\codepulse\convex\schema.ts:1875-1935` — graphSnapshots table definitions + limit comments
- `C:\Users\mandr\codepulse\convex\crons.ts:1-160` — disabled-cron block, confirmed verbatim
- `C:\Users\mandr\codepulse\convex\retention.ts` — full read (419 lines)
- `C:\Users\mandr\codepulse\convex\ingestAuth.ts` — full read (168 lines)
- `C:\Users\mandr\codepulse\convex\scan.ts` — full read (36 lines)
- `C:\Users\mandr\codepulse\convex\registry.ts:130` — `syncInventory` public-mutation confirmation
- `C:\Users\mandr\codepulse\convex\runtimeIngest.ts:1555` — confirms `internal.graphSnapshots.upsertGraphSnapshot` call site
- `C:\Users\mandr\codepulse\convex\http.ts:1-138` — full route table
- `C:\Users\mandr\codepulse\hooks\scanner.mjs` — full read (338 lines, `wc -l` confirmed)
- `C:\Users\mandr\codepulse\hooks\skillScan.mjs` — full read (234 lines)
- `C:\Users\mandr\codepulse\hooks\__tests__\scanner.test.mjs` — read (test pattern)
- `C:\Users\mandr\scripts\run-hidden.vbs` — full read (22 lines, 826 bytes confirmed)
- `C:\Users\mandr\scripts\install-preopen-guard.ps1` — full read (60 lines, exact template)
- `C:\Users\mandr\scripts\fix-hidden-task-launchers.ps1` — full read (51 lines, readback pattern)
- `C:\Users\mandr\astridr-repo\docker-compose.yml:320-390,525-554` — bind-mount source verification, all CONTEXT.md line citations confirmed exact
- `C:\Users\mandr\Downloads\robonuggets-rubric-second-brain.zip → rubric-second-brain/scan.js` — extracted to scratchpad and read in full (408 lines)
- `C:\Users\mandr\codepulse\package.json` — dependency/script verification (`js-yaml`, `vitest`, `deploy`/`test` scripts)
- `C:\Users\mandr\codepulse\.planning\phases\112-telemetry-coverage-closure\112-RESEARCH.md:162-170` — the `--env-file` deploy-command finding (see below)
- `C:\Users\mandr\codepulse\.planning\config.json` — confirmed no `nyquist_validation`/`security_enforcement` overrides (both default-enabled)
- `C:\Users\mandr\` directory listing (this session, `ls`) — real repo-root candidates for D-06/D-14

### Secondary (MEDIUM confidence)
- `C:\Users\mandr\codepulse\.planning\phases\112-telemetry-coverage-closure\112-07-PLAN.md` (grep hits only, not fully read) — corroborates the `--env-file` deploy form as the currently-enforced pattern in an ACTIVE parallel phase, superseding the plain `npx convex deploy --yes` form in `CLAUDE.md`'s Commands section (see Deploy Reality note below)

### Tertiary (LOW confidence — flagged, not asserted as fact)
- Directory-name-only inference for the ~10 unclassifiable repo roots as Consulting/Personal — explicitly NOT trusted, see Open Question 2 and Assumption A4. (The names themselves are deliberately not recorded in this file; see D-17 — they live only in the gitignored local config, because this repo is public.)

## Convex Deploy Reality — a stale-docs correction

**CLAUDE.md's own Commands section (`CLAUDE.md:18`) says `npx convex deploy --yes` — this is now
inaccurate for the self-hosted instance and should NOT be used verbatim by the planner.**

Evidence: `.planning/phases/112-telemetry-coverage-closure/112-RESEARCH.md:162-170` (dated the same
day, from a currently-active parallel phase, i.e. more current and more specific than the top-level
CLAUDE.md line) states: a credential-handling note recommending
`--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile` over `--admin-key` on the command
line — and, more critically, `112-07-PLAN.md`'s own threat table (grep-confirmed, not fully read)
names an explicit threat: *"Deploy targeting the retired `tidy-whale-981` cloud deployment"* with
mitigation *"Mandatory `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; `npm run
deploy` and bare `npx convex deploy` are forbidden."* `package.json:18`'s own `"deploy"` script is
literally `npx convex deploy && npx vite build` — i.e. the **package.json script itself is one of
the two forbidden forms** per Phase 112's own finding.

**Correct, currently-recommended deploy command for this repo:**
```bash
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```
**For the planner:** the schema/mutation changes in this phase are NOT live until this exact command
is run against the self-hosted backend. `tsc --noEmit` and `npm test` passing prove the CODE is
correct; they prove nothing about whether the schema has reached `127.0.0.1:3210`. Any plan wave
that depends on the new tables/mutation being queryable must include an explicit, attended deploy
step using this exact command, with the deploy output checked for `127.0.0.1:3210` (not
`*.convex.cloud`) and "no indexes deleted" — this is the verification pattern Phases 109/117/119
already use (`109-LIVE-EVIDENCE.md`, `117-VERIFICATION.md`, `119-VERIFICATION.md`, all grep-confirmed
this session using this exact evidence shape).

## Metadata

**Confidence breakdown:**
- Standard stack / versioned-write / inline-prune / auth patterns: HIGH — every claim traces to a
  file:line read live this session, no training-data guessing involved.
- Host-scanner precedent (D-04): HIGH — full files read, exact line numbers confirmed.
- D-09 compose-mount derivation: HIGH on the mount lines themselves (all verified exact, zero
  drift); MEDIUM on the env-var-substitution recommendation (a reasoned design choice, not
  something the donor or existing code already does).
- D-02/D-06/D-14 concrete proposals: MEDIUM — the MECHANISM (deny-by-default, root-level department
  map, Unclassified fallback) is HIGH confidence (directly implements CONTEXT.md's locked
  decisions); the SPECIFIC VALUES proposed (which extensions, which roots, which department) are
  explicitly flagged LOW-to-MEDIUM per item, pending D-12's dry-run validation against the real
  tree — this is by design, not a research gap, since CONTEXT.md itself defers final values to the
  dry-run.
- D-05 scheduled-task shape: HIGH for the registration template (live, working precedent found and
  read in full); LOW for verifiability from this environment (explicitly unverifiable this session,
  flagged as Open Question 3).
- D-12 dry-run gate design: MEDIUM-HIGH — the mechanism is novel to this phase (no existing
  precedent in the repo for a hash-gated approval marker), but built entirely from primitives
  (Node `crypto`, a checked-in text file, pure functions) that are individually well-understood and
  directly mutation-testable, which is the actual bar CONTEXT.md sets for this decision.

**Research date:** 2026-08-12
**Valid until:** 30 days (stable, self-hosted-Convex-specific findings; re-verify if
`graphSnapshots.ts`, `crons.ts`, or `astridr-repo/docker-compose.yml` change before planning
executes, since this research's confidence rests on exact line-number citations against those
files)
