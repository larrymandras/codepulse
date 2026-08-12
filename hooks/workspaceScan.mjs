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
