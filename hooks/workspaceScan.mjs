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
import { fileURLToPath } from "node:url";
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
import { DEPARTMENTS, UNCLASSIFIED, loadWorkspaceConfig } from "./workspaceConfig.mjs";
import {
  REPORT_RELPATH,
  APPROVAL_MARKER_RELPATH,
  canonicalReportHash,
  isDryRunApproved,
  buildApprovalMarkerContents,
} from "./workspaceApproval.mjs";
import { postSnapshot as realPostSnapshot } from "./ingestPost.mjs";

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

  // The rules that DECIDE what is transmitted, carried in the report so the D-12
  // approval can cover them. Widening the allowlist changes which files are shared
  // and is exactly the kind of change that must invalidate an approval — but the
  // report did not carry the allowlist at all until 2026-08-12, so the gate could
  // not see it. Everything here comes from the tracked, public config; no root
  // paths, no filenames.
  const sortedExt = (a) => [...(a ?? [])].map(String).sort();
  const allowlistShape = (al) => ({
    requireNonDotBasename: Boolean(al?.requireNonDotBasename),
    extensions: sortedExt(al?.extensions),
  });
  const byRoot = config?.shareableAllowlist?.byRoot ?? {};
  const classification = {
    excludeDirs: sortedExt(config?.excludeDirs),
    excludeFiles: sortedExt(config?.excludeFiles),
    allowlistDefault: allowlistShape(config?.shareableAllowlist?.default),
    allowlistByRoot: Object.fromEntries(
      Object.keys(byRoot)
        .sort()
        .map((k) => [k, allowlistShape(byRoot[k])])
    ),
  };

  return {
    schemaVersion: 1,
    generatedAt, // epoch seconds; excluded from the hashed view by classificationView()
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
    classification,
    warnings,
  };
}

/**
 * The report view that gets hashed (hooks/workspaceApproval.mjs's canonicalReportHash).
 *
 * D-12 asks a human to approve a CLASSIFICATION before data is transmitted, so this
 * projects the classification and nothing else: the allowlist and exclusions, every
 * root with its department/access/covered flag, the Unclassified set, coverage, and
 * the two fail-closed status flags. It deliberately excludes the FILE INVENTORY —
 * totals, per-root counts, byte sizes, mtimes, the sample, and the volatile warnings
 * derived from them.
 *
 * REWRITTEN 2026-08-12 (plan 115-09). It previously returned the WHOLE report minus
 * `generatedAt`/`reportHash`, which meant the approval hash covered every file count
 * and byte total. Measured on the real tree: three consecutive dry-runs produced file
 * counts 229,178 -> 229,180 -> 229,181 and two distinct hashes, and the first
 * post-approval ingest refused with exit 3 because the tree moved in the seconds
 * between approving and walking. Over the 24 hours between nightly runs a change is
 * certain, so D-05's unattended scheduled task (plan 115-10) would have exited 3
 * EVERY NIGHT, forever. D-12's own text gates "before first ingest"; the old
 * implementation re-gated every run against data no human reviews line by line.
 *
 * The gate is not weakened by this: it still invalidates on every change a reviewer is
 * actually deciding about — a root added or removed, a department changed, the
 * allowlist widened, a root dropping out of coverage. What it no longer does is
 * invalidate because a log file grew. Note the allowlist was not even IN the report
 * before this change, so the old whole-report hash could not see the single most
 * important thing the approval is for.
 *
 * `reportHash` needs no special handling any more: it is simply not one of the fields
 * projected here, so re-reading the written report and re-hashing it reproduces the
 * stored value.
 *
 * @param {object} report - buildDryRunReport() output, or that same object read back off
 *   disk with a `reportHash` field merged in
 * @returns {object}
 */
export function classificationView(report) {
  return {
    schemaVersion: report?.schemaVersion,
    snapshotId: report?.snapshotId,

    // WHAT gets shared vs withheld.
    classification: report?.classification,

    // WHICH roots exist and HOW each is labelled. rootSummary is already sorted
    // by rootId in buildDryRunReport, so this is order-stable. `evidence` is
    // deliberately excluded: it is prose explaining a department, and editing a
    // sentence must not invalidate an approval when the department is unchanged.
    roots: (report?.rootSummary ?? []).map((r) => ({
      rootId: r.rootId,
      department: r.department,
      access: r.access,
      covered: r.covered,
    })),
    unclassifiedRootIds: (report?.unclassifiedRoots ?? []).map((r) => r.rootId).sort(),

    // Whether the picture is COMPLETE. A root silently dropping out of the map
    // is exactly what a human should have to look at again.
    coveredRoots: report?.coverage?.coveredRoots,
    scannedRootsComplete: report?.coverage?.scannedRootsComplete,
    declaredRootCount: report?.coverage?.declaredRootCount,

    localConfigStatus: report?.localConfigStatus,
    accessDerivationOk: report?.accessDerivationOk,
  };
}

/**
 * @deprecated Retained only so the name cannot be reintroduced with the old
 * whole-report semantics by accident. Delegates to classificationView.
 */
export const hashableView = classificationView;

// ---------------------------------------------------------------------------------------
// 115-08 Task 1: runWorkspaceScan — load -> walk -> classify -> report -> GATE -> POST
// ---------------------------------------------------------------------------------------

/**
 * Human-readable dry-run summary: department counts, totals, the Unclassified root list,
 * every warning, the report path/hash, and the exact next command. Logged only in "dry-run"
 * mode. Deliberately prints no absolute host path — everything here comes from `report`,
 * which buildDryRunReport already guarantees is path-free (see its own test coverage).
 */
function logDryRunSummary(logger, report, reportHash) {
  logger.log(`[workspaceScan] dry-run report written to ${REPORT_RELPATH}`);
  logger.log(
    `[workspaceScan] totals: dirs=${report.totals.dirs} files=${report.totals.files} withheldFiles=${report.totals.withheldFiles}`
  );
  for (const dep of Object.keys(report.departmentCounts)) {
    const c = report.departmentCounts[dep];
    logger.log(`[workspaceScan]   ${dep}: dirs=${c.dirs} files=${c.files} bytes=${c.bytes}`);
  }
  if (report.unclassifiedRoots.length > 0) {
    logger.log("[workspaceScan] Unclassified roots:");
    for (const r of report.unclassifiedRoots) {
      logger.log(
        `[workspaceScan]   ${r.rootId}: dirs=${r.dirCount} files=${r.fileCount} withheld=${r.withheldCount}`
      );
    }
  }
  for (const w of report.warnings) {
    logger.log(`[workspaceScan] WARNING: ${w}`);
  }
  logger.log(`[workspaceScan] reportHash: ${reportHash}`);
  logger.log(`[workspaceScan] Next: review ${REPORT_RELPATH}, then run: node hooks/workspaceScan.mjs --approve`);
}

/**
 * The workspace scanner's entry point (D-04/D-05/D-12). `options.mode` is one of
 * `"dry-run" | "approve" | "ingest"` (default `"ingest"`, D-05's on-demand-flag CLI branch
 * below always passes one explicitly). `deps.postSnapshot` defaults to
 * `hooks/ingestPost.mjs`'s `postSnapshot(endpointUrl, ingestKey, body, deps)` — the shared
 * POST-with-bearer helper (D-04) — and MUST remain overridable: that seam is the only way
 * 115-VALIDATION.md's case 5 (an injected spy proving the D-12 gate refuses before any network
 * call) is provable at all. Every real call site (the CLI branch below) omits `deps` entirely
 * and gets identical real fs/os/js-yaml/postSnapshot behavior to before this parameter existed.
 *
 * Mode semantics, each returning rather than throwing/exiting (the CLI branch translates the
 * return value to a process exit code):
 *  - "dry-run": walk the declared roots, build+write the report, log a summary. Never posts.
 *  - "approve": does NOT re-walk. Reads whatever report is CURRENTLY on disk at
 *    REPORT_RELPATH (the one a prior --dry-run wrote and Larry reviewed) and writes an
 *    approval marker for exactly that report's hash. Refuses if no report exists on disk.
 *    Re-walking here would let --approve silently approve a DIFFERENT, unreviewed snapshot of
 *    the filesystem than the one actually shown to Larry — precisely the tampering threat
 *    D-12/T-115-08-02 exists to prevent, so this mode is deliberately NOT "walk then approve
 *    what you just walked". Never posts.
 *  - "ingest": walks the declared roots fresh, builds+writes a NEW report reflecting the
 *    CURRENT filesystem state, then gates: only if that fresh report's hash exactly matches
 *    the most recently approved hash does it POST. Any drift since approval (a file added, a
 *    root re-mapped, D-17's local config changed) produces a different hash and refuses.
 *
 * @param {{ mode?: "dry-run"|"approve"|"ingest", codepulseUrl?: string, ingestKey?: string }} [options]
 * @param {object} [deps]
 * @returns {Promise<{status: string, reportHash?: string, exitCode: number, httpStatus?: number|null}>}
 */
export async function runWorkspaceScan(options = {}, deps = {}) {
  const {
    loadConfig = loadWorkspaceConfig,
    readdirSync: doReaddir = fs.readdirSync,
    statSync: doStat = fs.statSync,
    readFileSync: doReadFile = fs.readFileSync,
    writeFileSync: doWriteFile = fs.writeFileSync,
    existsSync: doExists = fs.existsSync,
    homedir: getHomedir = homedir,
    yamlLoad = load,
    postSnapshot = realPostSnapshot,
    now = () => Math.floor(Date.now() / 1000),
    logger = console,
  } = deps;

  const mode = options.mode ?? "ingest";

  // ── "approve": no walk. Approves whatever report is already on disk. ────────────────────
  if (mode === "approve") {
    if (!doExists(REPORT_RELPATH)) {
      logger.error(
        `[workspaceScan] refusing to approve: no report exists at ${REPORT_RELPATH} — run --dry-run first.`
      );
      return { status: "approve-refused", exitCode: 2 };
    }
    let parsedReport;
    try {
      parsedReport = JSON.parse(doReadFile(REPORT_RELPATH, "utf-8"));
    } catch (err) {
      logger.error(`[workspaceScan] refusing to approve: report at ${REPORT_RELPATH} is unreadable or malformed: ${err.message}`);
      return { status: "approve-refused", exitCode: 2 };
    }
    const approveHash = canonicalReportHash(hashableView(parsedReport));
    const marker = buildApprovalMarkerContents(approveHash, { approvedAt: now() });
    doWriteFile(APPROVAL_MARKER_RELPATH, marker, "utf-8");
    return { status: "approved", reportHash: approveHash, exitCode: 0 };
  }

  // ── "dry-run" and "ingest" both need a fresh config load + walk. ────────────────────────
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(`[workspaceScan] config load failed: ${err.message}`);
    return { status: "config-error", exitCode: 2 };
  }

  const { mounted: mountedSet, ok: mountedOk } = loadMountedSet(config, {
    readFileSync: doReadFile,
    existsSync: doExists,
    homedir: getHomedir,
    yamlLoad,
  });

  const roots = Array.isArray(config?.roots) ? config.roots : [];
  const perRootResults = roots.map((root) => ({
    rootId: root.id,
    ...walkRoot(root, config, { readdirSync: doReaddir, statSync: doStat, mountedSet }),
  }));
  const rollup = rollupRootResults(perRootResults);

  const generatedAt = now();
  const report = buildDryRunReport({ config, rollup, mountedOk, generatedAt });
  const reportHash = canonicalReportHash(hashableView(report));

  // Always write the report — in both "dry-run" and "ingest" modes. D-12's report must be
  // diffable rather than scrollback-only, and after an unattended nightly ingest run the
  // written report is the evidence of what was classified. reportHash is excluded from
  // hashableView (see above), so including it here does not change the hash.
  try {
    doWriteFile(REPORT_RELPATH, JSON.stringify({ ...report, reportHash }, null, 2), "utf-8");
  } catch (err) {
    logger.error(`[workspaceScan] failed to write report to ${REPORT_RELPATH}: ${err.message}`);
    return { status: "config-error", exitCode: 2 };
  }

  if (mode === "dry-run") {
    logDryRunSummary(logger, report, reportHash);
    return { status: "dry-run", reportHash, exitCode: 0 };
  }

  // ── "ingest": THE GATE (D-12), then the single postSnapshot call site. ──────────────────
  // This block must appear in source before any reference to postSnapshot, and there is no
  // code path from here to the postSnapshot call below that bypasses it.
  const approvalRaw = doExists(APPROVAL_MARKER_RELPATH)
    ? doReadFile(APPROVAL_MARKER_RELPATH, "utf-8")
    : null;
  if (!isDryRunApproved(reportHash, approvalRaw)) {
    const markerFirstLine =
      typeof approvalRaw === "string" ? approvalRaw.split(/\r?\n/)[0].trim() : "<absent>";
    // Deliberately no directory path and no report body in this message (T-115-08-03).
    logger.error(
      `[workspaceScan] REFUSED: this report has not been approved, or has changed since approval. ` +
        `Expected hash ${reportHash}, approval marker currently reads "${markerFirstLine}". ` +
        `Run: node hooks/workspaceScan.mjs --dry-run, review the report, then: node hooks/workspaceScan.mjs --approve`
    );
    return { status: "refused", reportHash, exitCode: 3 };
  }

  const snapshot = buildSnapshot({
    config,
    rollup,
    mountedOk,
    dryRunReportHash: reportHash,
    generatedAt: report.generatedAt,
  });
  const resp = await postSnapshot(`${options.codepulseUrl}/workspace-ingest`, options.ingestKey, snapshot);
  return {
    status: resp.ok ? "ingested" : "post-failed",
    httpStatus: resp.status,
    reportHash,
    exitCode: resp.ok ? 0 : 4,
  };
}

// ---------------------------------------------------------------------------------------
// 115-08 Task 1: isDirectRun CLI branch — `node hooks/workspaceScan.mjs [--dry-run|--approve]`
//
// D-05's on-demand flag. Plan 115-10's scheduled task invokes this with no flags (default
// "ingest" mode). No shebang here — same reason as every other module in this file (see the
// module header): Vite/Rolldown's SSR transform (used by this file's own test file) hoists
// import statements above line 1, and a shebang left there breaks parsing.
//
// Exit codes — a hidden scheduled task swallows stdout, so the exit code and 115-10's log
// file are Larry's only unattended signal:
//   0  success (dry-run written, approved, or ingested)
//   2  config/usage error (tracked config missing/malformed, --dry-run + --approve together,
//      approving with no report on disk, no Convex URL resolved for an ingest run)
//   3  D-12 refusal (report unapproved or approval stale)
//   4  POST failed (unreachable backend or a non-2xx response)
//   5  unexpected throw — the .catch() below, so an uncaught error never exits 0
// ---------------------------------------------------------------------------------------

const __workspaceScan_dirname = dirname(fileURLToPath(import.meta.url));
const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("workspaceScan.mjs");

if (isDirectRun) {
  const wantsDryRun = process.argv.includes("--dry-run");
  const wantsApprove = process.argv.includes("--approve");

  if (wantsDryRun && wantsApprove) {
    console.error("[workspaceScan] usage: pass at most one of --dry-run / --approve, not both.");
    process.exit(2);
  }

  const cliMode = wantsDryRun ? "dry-run" : wantsApprove ? "approve" : "ingest";

  // URL/key resolution — same idiom as hooks/scanner.mjs:288-318 (CODEPULSE_URL env first,
  // then a regex-matched .env.local read). Never logs any value read from .env.local; only
  // "ingest" mode requires a resolved URL (dry-run/approve never call postSnapshot at all).
  let url = process.env.CODEPULSE_URL || "";
  if (!url) {
    const envPath = join(__workspaceScan_dirname, "..", ".env.local");
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const siteMatch = content.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
        if (siteMatch) url = siteMatch[1].trim();
        else {
          const viteMatch = content.match(/^VITE_CONVEX_URL\s*=\s*(.+)$/m);
          if (viteMatch) url = viteMatch[1].trim().replace(".convex.cloud", ".convex.site");
        }
      } catch {
        // Unreadable .env.local — fall through; "ingest" mode's own url check below exits 2.
      }
    }
  }

  if (cliMode === "ingest" && !url) {
    console.error("[workspaceScan] no Convex URL resolved — set CODEPULSE_URL or .env.local's CONVEX_SITE_URL.");
    process.exit(2);
  }

  let ingestKey = process.env.ASTRIDR_INGEST_API_KEY || "";
  if (!ingestKey) {
    const envPath = join(__workspaceScan_dirname, "..", ".env.local");
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const m = content.match(/^ASTRIDR_INGEST_API_KEY\s*=\s*(.+)$/m);
        if (m) ingestKey = m[1].trim();
      } catch {
        // Unreadable — proceed unauthenticated; postSnapshot logs its own warning.
      }
    }
  }

  runWorkspaceScan({ mode: cliMode, codepulseUrl: url, ingestKey })
    .then((result) => {
      console.log(`[workspaceScan] ${result.status} (exit ${result.exitCode})`);
      process.exit(result.exitCode);
    })
    .catch((err) => {
      console.error(`[workspaceScan] unexpected error: ${err.message}`);
      process.exit(5);
    });
}
