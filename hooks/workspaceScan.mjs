// CodePulse Workspace Scanner — filesystem walk, per-directory rollup, snapshot builder,
// and the D-12 dry-run report (Phase 115, plan 115-07).
//
// D-01 (structural, not procedural): the walk must be UNABLE to transmit file contents, not
// merely choose not to. `walkRoot`'s injected `deps` set is exactly
// `{ readdirSync, statSync, mountedSet }` — no read capability is in scope anywhere in this
// function or anything it calls. There is no `readFileSync`, no `readFile`, no
// `createReadStream`, no `openSync` and no bare `fs`/`node:fs` import anywhere in the walk
// path. The donor (`scan.js:149`, `fs.readFileSync(path.join(ROOT, f.rel), 'utf8')`) has no
// analogue here. The ONE legitimate content-read call in this whole module lives inside
// `loadMountedSet`, which reads `docker-compose.yml` — never a file under a scanned root.
//
// D-03: a secret-classified file increments a directory's `withheldCount` and nothing else —
// no basename, no size, no list entry, and it is never even `statSync`'d. The path never
// leaves the host. This deliberately diverges from the donor's `accessOf()`, which ingests
// secrets and merely forces `access: 'claude'`.
//
// D-13: one row per DIRECTORY carrying aggregate counts; no individual filename — secret or
// visible — appears anywhere in the emitted payload. Measured at planning time: 21,029 files
// across just `.claude` (12,152), `.claude-alt` (5,183) and the vault (3,694), before any repo
// roots — a file-per-node graph is neither storable at that shape nor renderable by Phase
// 114's force-graph canvas.
//
// D-06: the walk applies no numeric cap on how deep it descends. The declared `excludeDirs`
// list prunes the pathological trees (node_modules, .git, etc.); a silent truncation by depth
// number would present as a mysteriously incomplete map with no signal that anything was cut.
// The only bound against a filesystem loop (a junction/symlink cycle) is a visited real-path
// (dev:ino) identity set plus a reparse-point skip — "we have been here", not an arbitrary
// number — and any skipped cycle is counted and surfaced in the dry-run report's warnings.
//
// Units: every timestamp in this module (`latestMtime`, `generatedAt`) is epoch **SECONDS**,
// matching `convex/schema.ts`'s `workspaceSnapshots`/`workspaceDirs` convention and this
// project's prior seconds/millis incidents (LESSONS 2026-08-05, 2026-08-08). A millisecond
// value here silently produces 1970 dates and a vacuously-passing cutoff comparison downstream.
//
// No shebang here — same reason as hooks/scanner.mjs and hooks/workspaceConfig.mjs: this file
// is only ever imported (by hooks/workspaceScan.test.mjs, and 115-08's entry point) or run
// directly via `node hooks/workspaceScan.mjs`, and Vite/Rolldown's SSR transform (used by this
// file's own test file) hoists imports above line 1 — a shebang there breaks parsing.

import * as fs from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { load } from "js-yaml";
import {
  normalizeRel,
  isExcludedDir,
  isExcludedFile,
  classifyFile,
  resolveRootDepartment,
  resolveAccess,
  deriveMountedPaths,
} from "./workspaceClassifier.mjs";
import { DEPARTMENTS, UNCLASSIFIED } from "./workspaceConfig.mjs";

// ---------------------------------------------------------------------------------------
// Task 1: the read-incapable walk and the per-directory rollup
// ---------------------------------------------------------------------------------------

/**
 * Walk one declared root, producing one row per directory (D-13). `deps` is REQUIRED — there
 * is no default fallback to real `fs` functions, so a caller cannot accidentally gain read
 * capability by omission; 115-08's entry point supplies the real `readdirSync`/`statSync` and
 * the derived `mountedSet` explicitly on every call.
 *
 * @param {{ id: string, path: string }} root
 * @param {object} config - loaded workspace config (workspaceConfig.mjs's loadWorkspaceConfig output)
 * @param {{ readdirSync: Function, statSync: Function, mountedSet: Set<string> }} deps
 * @returns {{ rows: object[], covered: boolean, statFailures: number, cyclesSkipped: number }}
 */
export function walkRoot(root, config, deps) {
  const { readdirSync, statSync, mountedSet } = deps;

  const rows = [];
  const visited = new Set(); // dev:ino identity of every directory descended into (D-06 cycle guard)
  let anySucceeded = false;
  let anyFailed = false;
  let statFailures = 0;
  let cyclesSkipped = 0;

  const department = resolveRootDepartment(root.id, config);

  function walkDir(absDirPath, relDirPath) {
    let entries;
    try {
      entries = readdirSync(absDirPath, { withFileTypes: true });
    } catch {
      anyFailed = true;
      return;
    }
    anySucceeded = true;

    let fileCount = 0;
    let totalSize = 0;
    let latestMtime = 0;
    let withheldCount = 0;
    const subdirs = [];

    for (const entry of entries) {
      const name = entry.name;

      // Reparse points (symlinks, and on Windows junctions surface the same way through
      // libuv's dirent typing) are skipped outright — never descended, never counted as a
      // file. This is the primary D-06 cycle defense; the visited dev:ino set below is
      // defense in depth for any reparse point that does not present as a symlink dirent.
      if (typeof entry.isSymbolicLink === "function" && entry.isSymbolicLink()) {
        cyclesSkipped++;
        continue;
      }

      if (typeof entry.isDirectory === "function" && entry.isDirectory()) {
        if (isExcludedDir(name, config)) continue;
        subdirs.push({ name, absPath: join(absDirPath, name) });
        continue;
      }

      if (typeof entry.isFile === "function" && entry.isFile()) {
        if (isExcludedFile(name, config)) continue;
        const relPath = relDirPath ? `${relDirPath}/${name}` : name;
        const { isSecret } = classifyFile({ rootId: root.id, relPath, basename: name }, config);

        if (isSecret) {
          // D-03: increment only. No statSync, no basename, no size, no list entry.
          withheldCount++;
          continue;
        }

        const absFilePath = join(absDirPath, name);
        let stat;
        try {
          stat = statSync(absFilePath);
        } catch {
          // Deleted between readdir and stat, or denied — count it, don't abort the directory.
          statFailures++;
          continue;
        }
        fileCount++;
        totalSize += stat.size;
        const mtimeSec = Math.floor(stat.mtimeMs / 1000); // epoch SECONDS
        if (mtimeSec > latestMtime) latestMtime = mtimeSec;
      }
      // Any other dirent type (block/char device, FIFO, socket) is neither a directory nor a
      // file we classify — silently skipped, matching neither fileCount nor withheldCount.
    }

    const normalizedRelPath = normalizeRel(relDirPath || "");
    rows.push({
      rootId: root.id,
      dirPath: normalizedRelPath,
      department,
      access: resolveAccess(absDirPath, mountedSet),
      fileCount,
      totalSize,
      latestMtime,
      withheldCount,
    });

    for (const sub of subdirs) {
      let identityKey;
      try {
        const st = statSync(sub.absPath);
        identityKey = `${st.dev}:${st.ino}`;
      } catch {
        // Cannot identify the subdirectory (deleted/denied between readdir and stat) —
        // skip descending. Not a statFailures case: that counter is file-specific.
        continue;
      }
      if (visited.has(identityKey)) {
        cyclesSkipped++;
        continue;
      }
      visited.add(identityKey);
      const subRel = relDirPath ? `${relDirPath}/${sub.name}` : sub.name;
      walkDir(sub.absPath, subRel);
    }
  }

  // Seed the visited set with the root itself so a junction cycle that loops back to the
  // root is also caught.
  try {
    const rootStat = statSync(root.path);
    visited.add(`${rootStat.dev}:${rootStat.ino}`);
  } catch {
    // Root doesn't exist or can't be identified — walkDir's own readdirSync try/catch below
    // handles the "root path does not exist" contract (covered: false, zero rows, no throw).
  }

  walkDir(root.path, "");

  return {
    rows,
    covered: anySucceeded && !anyFailed,
    statFailures,
    cyclesSkipped,
  };
}

/**
 * Pure aggregation over every declared root's walkRoot() result.
 *
 * @param {Array<{ rootId: string, rows: object[], covered: boolean, statFailures: number, cyclesSkipped: number }>} perRootResults
 */
export function rollupRootResults(perRootResults) {
  const dirs = [];
  let totalFiles = 0;
  let totalWithheldFiles = 0;
  let totalBytes = 0;
  const coveredRoots = [];
  let scannedRootsComplete = true;
  let statFailures = 0;
  let cyclesSkipped = 0;

  for (const { rootId, rows, covered, statFailures: rootStatFailures, cyclesSkipped: rootCyclesSkipped } of perRootResults) {
    if (covered) coveredRoots.push(rootId);
    else scannedRootsComplete = false;

    for (const row of rows) {
      dirs.push(row);
      totalFiles += row.fileCount;
      // Pitfall 1: withheld files never contribute to totalFiles or totalBytes — a byte
      // total is a far higher-resolution side channel than a count.
      totalWithheldFiles += row.withheldCount;
      totalBytes += row.totalSize;
    }
    statFailures += rootStatFailures || 0;
    cyclesSkipped += rootCyclesSkipped || 0;
  }

  return {
    dirs,
    totalDirs: dirs.length,
    totalFiles,
    totalWithheldFiles,
    totalBytes,
    coveredRoots,
    scannedRootsComplete,
    statFailures,
    cyclesSkipped,
  };
}

/**
 * The ONE place in this phase that reads the compose file. `deps.readFileSync`/
 * `deps.existsSync`/`deps.homedir` are injectable for testability; real `node:fs`/`node:os`
 * are the defaults. Fails CLOSED on any missing file, unreadable file, or parse error — never
 * throws.
 *
 * @param {object} config - loaded workspace config; `config.composeFile` is the path to read.
 * @param {{ readFileSync?: Function, existsSync?: Function, homedir?: Function, yamlLoad?: Function }} [deps]
 * @returns {{ mounted: Set<string>, ok: boolean }}
 */
export function loadMountedSet(config, deps = {}) {
  const {
    existsSync = fs.existsSync,
    homedir: getHomedir = homedir,
    yamlLoad = load,
  } = deps;

  if (!config?.composeFile || !existsSync(config.composeFile)) {
    return { mounted: new Set(), ok: false };
  }

  let parsed;
  try {
    // The single legitimate content-read call in this module (D-01's grep gate): reads
    // docker-compose.yml, never anything under a scanned root.
    const doRead = deps.readFileSync ?? fs.readFileSync;
    parsed = yamlLoad(doRead(config.composeFile, "utf-8"));
  } catch {
    // RESEARCH Pitfall 4: any parse throw fails closed, not just a missing file.
    return { mounted: new Set(), ok: false };
  }

  // Fail closed on the access dimension (D-02's philosophy applied here): a parse that
  // succeeds but yields zero mounts is treated identically to `ok: false` by
  // deriveMountedPaths itself — a silent empty result must not be mistaken for "no mounts
  // configured" when the real cause is a parse defect.
  return deriveMountedPaths(parsed, { composeDir: dirname(config.composeFile), homeDir: getHomedir() });
}

/**
 * Pure; assembles the exact wire shape convex/workspace.ts's upsertWorkspaceSnapshot validates
 * and convex/workspaceHttp.ts's POST handler forwards field-by-field.
 *
 * @param {{ config: object, rollup: ReturnType<typeof rollupRootResults>, mountedOk: boolean, dryRunReportHash: string, generatedAt: number }} args
 */
export function buildSnapshot({ config, rollup, mountedOk, dryRunReportHash, generatedAt }) {
  const roots = Array.isArray(config?.roots) ? config.roots : [];
  const unclassifiedRootIds = roots
    .filter((r) => resolveRootDepartment(r.id, config) === UNCLASSIFIED)
    .map((r) => r.id);

  return {
    snapshotId: config.snapshotId,
    generatedAt, // epoch SECONDS
    rootCount: roots.length,
    coveredRoots: rollup.coveredRoots,
    scannedRootsComplete: rollup.scannedRootsComplete,
    unclassifiedRootIds,
    accessDerivationOk: mountedOk,
    localConfigStatus: config.localConfigStatus,
    dryRunReportHash,
    // Explicit key projection (never the walk's row object passed through) — a stray extra
    // key on a row would otherwise be transmitted unnoticed.
    dirs: rollup.dirs.map((d) => ({
      rootId: d.rootId,
      dirPath: d.dirPath,
      department: d.department,
      access: d.access,
      fileCount: d.fileCount,
      totalSize: d.totalSize,
      latestMtime: d.latestMtime,
      withheldCount: d.withheldCount,
    })),
  };
}

// ---------------------------------------------------------------------------------------
// Task 2: the D-12 dry-run report builder
// ---------------------------------------------------------------------------------------

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byRootThenDirPath = (a, b) => cmp(a.rootId, b.rootId) || cmp(a.dirPath, b.dirPath);
const DIR_COUNT_WARNING_THRESHOLD = 5000;
const SAMPLE_LIMIT = 40;

function emptyRootAgg() {
  return { dirCount: 0, fileCount: 0, bytes: 0, withheldCount: 0 };
}

/** Aggregate rollup.dirs rows per rootId. Pure. */
function aggregateByRoot(dirs) {
  const perRoot = new Map();
  for (const row of dirs) {
    const acc = perRoot.get(row.rootId) ?? emptyRootAgg();
    acc.dirCount++;
    acc.fileCount += row.fileCount;
    acc.bytes += row.totalSize;
    acc.withheldCount += row.withheldCount;
    perRoot.set(row.rootId, acc);
  }
  return perRoot;
}

/**
 * Deterministic sample selection (never random — a nondeterministic sample would make the
 * report hash unstable and the D-12 gate would refuse a report Larry legitimately approved):
 * the largest fileCount per root, then the largest withheldCount per root (not already
 * picked), then fill by sorted (rootId, dirPath) up to SAMPLE_LIMIT. Final output is re-sorted
 * by (rootId, dirPath) for a stable emission order.
 */
function buildSample(dirs) {
  const byRoot = new Map();
  for (const row of dirs) {
    if (!byRoot.has(row.rootId)) byRoot.set(row.rootId, []);
    byRoot.get(row.rootId).push(row);
  }
  const rootIds = [...byRoot.keys()].sort();
  const pickedKeys = new Set();
  const picked = [];
  const keyOf = (row) => `${row.rootId}::${row.dirPath}`;

  for (const rootId of rootIds) {
    const rows = [...byRoot.get(rootId)].sort(
      (a, b) => b.fileCount - a.fileCount || cmp(a.dirPath, b.dirPath)
    );
    const top = rows[0];
    if (top && !pickedKeys.has(keyOf(top))) {
      picked.push(top);
      pickedKeys.add(keyOf(top));
    }
  }
  for (const rootId of rootIds) {
    if (picked.length >= SAMPLE_LIMIT) break;
    const rows = [...byRoot.get(rootId)].sort(
      (a, b) => b.withheldCount - a.withheldCount || cmp(a.dirPath, b.dirPath)
    );
    const top = rows[0];
    if (top && !pickedKeys.has(keyOf(top))) {
      picked.push(top);
      pickedKeys.add(keyOf(top));
    }
  }
  const remaining = [...dirs].filter((row) => !pickedKeys.has(keyOf(row))).sort(byRootThenDirPath);
  for (const row of remaining) {
    if (picked.length >= SAMPLE_LIMIT) break;
    picked.push(row);
    pickedKeys.add(keyOf(row));
  }

  return picked
    .slice(0, SAMPLE_LIMIT)
    .sort(byRootThenDirPath)
    .map((row) => ({
      rootId: row.rootId,
      dirPath: row.dirPath,
      department: row.department,
      access: row.access,
      fileCount: row.fileCount,
      withheldCount: row.withheldCount,
      totalSize: row.totalSize,
    }));
}

/**
 * Pure; the four D-12-mandated contents (departmentCounts, totals.withheldFiles,
 * unclassifiedRoots, sample) plus rootSummary/coverage/accessSummary/warnings. Deterministic
 * under repeated calls on the same rollup — every array is sorted by a stable key, and the
 * only per-run-varying field is `generatedAt`, which `hashableView` strips before hashing.
 *
 * @param {{ config: object, rollup: ReturnType<typeof rollupRootResults>, mountedOk: boolean, generatedAt: number }} args
 */
export function buildDryRunReport({ config, rollup, mountedOk, generatedAt }) {
  const roots = Array.isArray(config?.roots) ? config.roots : [];
  const perRootAgg = aggregateByRoot(rollup.dirs);

  const departmentCounts = {};
  for (const dep of DEPARTMENTS) departmentCounts[dep] = { dirs: 0, files: 0, bytes: 0 };
  for (const row of rollup.dirs) {
    const dep = DEPARTMENTS.includes(row.department) ? row.department : UNCLASSIFIED;
    departmentCounts[dep].dirs++;
    departmentCounts[dep].files += row.fileCount;
    departmentCounts[dep].bytes += row.totalSize;
  }

  const totals = {
    dirs: rollup.totalDirs,
    files: rollup.totalFiles,
    bytes: rollup.totalBytes,
    withheldFiles: rollup.totalWithheldFiles,
    statFailures: rollup.statFailures,
    cyclesSkipped: rollup.cyclesSkipped,
  };

  const unclassifiedRoots = roots
    .filter((r) => resolveRootDepartment(r.id, config) === UNCLASSIFIED)
    .map((r) => {
      const acc = perRootAgg.get(r.id) ?? emptyRootAgg();
      return { rootId: r.id, dirCount: acc.dirCount, fileCount: acc.fileCount, bytes: acc.bytes, withheldCount: acc.withheldCount };
    })
    .sort((a, b) => b.fileCount - a.fileCount || cmp(a.rootId, b.rootId));

  const rootSummary = [...roots]
    .sort((a, b) => cmp(a.id, b.id))
    .map((r) => {
      const acc = perRootAgg.get(r.id) ?? emptyRootAgg();
      const rootOwnRow = rollup.dirs.find((d) => d.rootId === r.id && d.dirPath === "");
      return {
        rootId: r.id,
        department: resolveRootDepartment(r.id, config),
        evidence: r.evidence || "",
        covered: rollup.coveredRoots.includes(r.id),
        dirCount: acc.dirCount,
        fileCount: acc.fileCount,
        bytes: acc.bytes,
        withheldCount: acc.withheldCount,
        access: rootOwnRow ? rootOwnRow.access : "local-only",
      };
    });

  const sample = buildSample(rollup.dirs);

  const coverage = {
    coveredRoots: [...rollup.coveredRoots].sort(),
    scannedRootsComplete: rollup.scannedRootsComplete,
    declaredRootCount: roots.length,
  };

  let astridrReachableDirs = 0;
  let localOnlyDirs = 0;
  for (const row of rollup.dirs) {
    if (row.access === "astridr-reachable") astridrReachableDirs++;
    else localOnlyDirs++;
  }
  const accessSummary = { astridrReachableDirs, localOnlyDirs };

  const warnings = [];
  if (!rollup.scannedRootsComplete) {
    warnings.push(
      "Scan incomplete: one or more declared roots failed to fully enumerate (scannedRootsComplete=false)."
    );
  }
  if (!mountedOk) {
    warnings.push(
      "Access derivation failed: docker-compose.yml could not be read or parsed; every directory reports access=local-only (accessDerivationOk=false)."
    );
  }
  if (rollup.statFailures > 0) {
    warnings.push(
      `${rollup.statFailures} file(s) could not be stat'd and were counted as neither visible nor withheld.`
    );
  }
  if (rollup.cyclesSkipped > 0) {
    warnings.push(
      `${rollup.cyclesSkipped} filesystem cycle/reparse-point entr${rollup.cyclesSkipped === 1 ? "y" : "ies"} skipped to bound the walk.`
    );
  }
  if (config?.localConfigStatus !== "merged") {
    warnings.push(
      `Local config status is "${config?.localConfigStatus}", not "merged" — local roots may be missing from this scan (D-17 fail-closed path).`
    );
  }
  if (totals.dirs > DIR_COUNT_WARNING_THRESHOLD) {
    warnings.push(
      `Directory count ${totals.dirs} exceeds ${DIR_COUNT_WARNING_THRESHOLD} — re-check D-11's WORKSPACE_KEEP_VERSIONS/WORKSPACE_DELETE_CAP and MAX_DIRS_PER_INGEST for headroom.`
    );
  }
  if (mountedOk && astridrReachableDirs === 0) {
    warnings.push(
      "accessDerivationOk is true but zero directories resolved astridr-reachable — possible silent compose-parse failure (RESEARCH Pitfall 4)."
    );
  }
  warnings.sort();

  return {
    schemaVersion: 1,
    generatedAt, // epoch seconds; excluded from the hashed view by hashableView()
    snapshotId: config?.snapshotId,
    departmentCounts,
    totals,
    unclassifiedRoots,
    rootSummary,
    sample,
    coverage,
    accessDerivationOk: mountedOk,
    accessSummary,
    localConfigStatus: config?.localConfigStatus,
    warnings,
  };
}

/**
 * The report view that gets hashed (hooks/workspaceApproval.mjs's canonicalReportHash). Strips
 * `generatedAt` — the only wall-clock, per-run-varying field this report carries — so an
 * approval invalidates on CONTENT change only, never merely on the passage of time.
 *
 * @param {object} report - buildDryRunReport() output
 * @returns {object}
 */
export function hashableView(report) {
  const { generatedAt, ...rest } = report;
  return rest;
}
