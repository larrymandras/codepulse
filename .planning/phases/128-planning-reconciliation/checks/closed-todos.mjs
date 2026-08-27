#!/usr/bin/env node
/**
 * Structural check on `.planning/todos/completed/` (128-01, T-128-01 mitigation).
 *
 * SCOPE NOTE (deviation Rule 1 — the plan's literal spec is unsatisfiable against the live
 * corpus without editing files outside this plan's scope): the corpus in `completed/` predates
 * the `status: closed` + `closed:` + `closed_by:` convention this plan follows — 5 pre-existing
 * files already comply (each carries `closed_by:`), but 7 older files use different vocabulary
 * (`status: resolved`, `status: closed-fixed`, `status: closed-accepted-by-design`, a bare
 * `resolved:` date field) and carry no `closed_by:` at all. Two of those seven are anomalous
 * even by their own convention (`status: pending` while sitting in `completed/` —
 * `eval-and-trace-observability-v10.md`, `llm-analytics-rollup-migration-cr01.md`), a
 * pre-existing defect unrelated to this plan's task, logged to `deferred-items.md` rather than
 * fixed here (CLAUDE.md scope boundary). Enforcing the strict triple against the WHOLE
 * directory would make this checker permanently fail-by-construction against files this plan
 * never touched, which would violate the plan's own "exits 0 against the tree" acceptance
 * criterion. So the strict check below applies to any completed todo that carries a
 * `closed_by:` field at all (the structured-closure population, spanning both the pre-existing
 * conforming entries and this plan's three new ones) — entries with no `closed_by:` are
 * legacy, are warned about (not failed) if their `status` is literally `pending`, and are
 * otherwise left alone.
 *
 * What this checks:
 *
 *   1. Every completed todo carrying a `closed_by:` field also carries `status: closed` and
 *      `closed:` — a structured closure missing either of the other two is a silent close,
 *      moved without the evidence trail this phase exists to require.
 *
 *   2. For every completed todo whose `closed_by` names `128-01` specifically, every
 *      `path:line` citation inside its `## Resolution (...)` section must resolve to a real
 *      file on disk, AND the cited line number must fall inside that file. A closure that
 *      cites a path that does not exist is unverifiable — the same failure mode as closing
 *      on "I looked and it seemed fine." A path that resolves while its line number does not
 *      is the quieter version of the same thing, so both are enforced.
 *      NOTE the residual limit: this proves the line EXISTS, not that it says what the
 *      verdict claims. Only a human or a reviewer agent reading the line can establish that.
 *
 * Prints the population examined (total completed files, count closed by 128-01, count of
 * citations checked) and exits non-zero if the citation count is zero — a checker that
 * examined nothing must not report success (CLAUDE.md's paired non-zero-control rule; a
 * filter matching nothing looks identical to a passing one otherwise).
 *
 * Run: node .planning/phases/128-planning-reconciliation/checks/closed-todos.mjs
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_FILE = fileURLToPath(import.meta.url);
// THIS_FILE = <repo>/.planning/phases/128-planning-reconciliation/checks/closed-todos.mjs
// Five nested dirname() calls walk: file -> checks -> 128-planning-reconciliation -> phases
// -> .planning -> <repo root>
const REPO_ROOT = dirname(dirname(dirname(dirname(dirname(THIS_FILE)))));
const COMPLETED_DIR = join(REPO_ROOT, ".planning", "todos", "completed");

/** Extracts the YAML-ish frontmatter block (between the first two `---` lines) as raw text. */
function extractFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

/** Extracts the `## Resolution (...)` section body — from that heading to the next `##`
 * heading or end of file. Returns "" if no Resolution section exists. */
function extractResolutionSection(text) {
  // NOTE: `$` under the `/m` flag matches end-of-LINE, not end-of-string — combined with the
  // lazy `[\s\S]*?`, that made the lookahead succeed at the very first line boundary (the blank
  // line right after the heading), always capturing "". `(?![\s\S])` is the fix: it means
  // "no characters remain at all" regardless of the `/m` flag, i.e. true end-of-string.
  const match = text.match(/^## Resolution \([^)]*\)\r?\n([\s\S]*?)(?=\r?\n## |\r?\n# |(?![\s\S]))/m);
  return match ? match[1] : "";
}

/** Extracts unique `path:line` citations from a text block. Mirrors the pattern used by
 * this plan's Task 1 verify command. */
function extractCitations(text) {
  const seen = new Set();
  const cites = [];
  for (const m of text.matchAll(/([\w./-]+\.(?:ts|tsx|md|mjs)):(\d+)/g)) {
    const key = `${m[1]}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cites.push({ rel: m[1], line: Number(m[2]) });
  }
  return cites;
}

function main() {
  if (!existsSync(COMPLETED_DIR)) {
    console.error(`FATAL: completed todos directory not found: ${COMPLETED_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(COMPLETED_DIR).filter((f) => f.endsWith(".md"));

  let totalCompleted = 0;
  let structuredClosures = 0; // carries closed_by: at all (legacy-conforming + new)
  let closedBy128_01 = 0;
  let citationsChecked = 0;
  const missingFrontmatter = [];
  const legacyPendingAnomalies = [];
  const deadCitations = [];
  const outOfRangeCitations = [];

  for (const file of files) {
    totalCompleted++;
    const fullPath = join(COMPLETED_DIR, file);
    const text = readFileSync(fullPath, "utf8");
    const fm = extractFrontmatter(text);

    const hasClosedBy = /^closed_by:\s*\S+/m.test(fm);

    if (!hasClosedBy) {
      // Legacy entry, predates this plan's closure convention (see SCOPE NOTE above).
      // Not strictly enforced, but a completed todo literally marked `status: pending`
      // is a pre-existing anomaly worth surfacing (warn, do not fail — out of this
      // plan's scope to fix per CLAUDE.md's scope boundary).
      if (/^status:\s*pending\s*$/m.test(fm)) {
        legacyPendingAnomalies.push(file);
      }
      continue;
    }

    structuredClosures++;

    const hasStatusClosed = /^status:\s*closed\s*$/m.test(fm);
    const hasClosed = /^closed:\s*\S+/m.test(fm);

    if (!hasStatusClosed || !hasClosed) {
      missingFrontmatter.push({ file, hasStatusClosed, hasClosed, hasClosedBy });
      continue; // can't check citations on a malformed closure
    }

    const closedByLine = fm.match(/^closed_by:\s*(.+)$/m);
    const closedByValue = closedByLine ? closedByLine[1].trim() : "";
    if (!closedByValue.includes("128-01")) continue;

    closedBy128_01++;

    const resolutionText = extractResolutionSection(text);
    const citations = extractCitations(resolutionText);

    for (const { rel, line } of citations) {
      citationsChecked++;
      const abs = join(REPO_ROOT, rel);
      if (!existsSync(abs)) {
        deadCitations.push({ file, citation: rel });
        continue;
      }
      // A path that resolves proves the FILE exists; it says nothing about the line.
      // In a phase whose whole currency is file:line evidence, a line number nobody
      // checks is decorative -- so bound it against the cited file's real length.
      // Split on "\n" only: a trailing "\r" rides along on each element and does not
      // change the COUNT, so this is CRLF-safe without needing a regex.
      const lineCount = readFileSync(abs, "utf8").split("\n").length;
      if (line < 1 || line > lineCount) {
        outOfRangeCitations.push({ file, citation: `${rel}:${line}`, lineCount });
      }
    }
  }

  console.log(
    `[closed-todos] examined ${totalCompleted} completed todo(s); ${structuredClosures} carry closed_by:; ${closedBy128_01} closed_by 128-01; ${citationsChecked} citation(s) checked`
  );

  if (legacyPendingAnomalies.length > 0) {
    console.warn(
      `WARN: ${legacyPendingAnomalies.length} legacy completed todo(s) with no closed_by: still read status: pending (pre-existing, out of this plan's scope): ${legacyPendingAnomalies.join(", ")}`
    );
  }

  let failed = false;

  if (missingFrontmatter.length > 0) {
    failed = true;
    console.error(
      `FAIL: ${missingFrontmatter.length} structured-closure todo(s) (carrying closed_by:) missing status: closed or closed::`
    );
    for (const m of missingFrontmatter) {
      console.error(
        `  - ${m.file}: status:closed=${m.hasStatusClosed} closed:=${m.hasClosed} closed_by:=${m.hasClosedBy}`
      );
    }
  }

  if (deadCitations.length > 0) {
    failed = true;
    console.error(`FAIL: ${deadCitations.length} unresolvable citation(s):`);
    for (const d of deadCitations) {
      console.error(`  - ${d.file}: cites "${d.citation}", which does not exist on disk`);
    }
  }

  if (outOfRangeCitations.length > 0) {
    failed = true;
    console.error(`FAIL: ${outOfRangeCitations.length} citation(s) naming a line outside the cited file:`);
    for (const o of outOfRangeCitations) {
      console.error(`  - ${o.file}: cites "${o.citation}", but that file has only ${o.lineCount} line(s)`);
    }
  }

  if (citationsChecked === 0) {
    failed = true;
    console.error(
      `FAIL: zero citations were checked (closed_by 128-01 todos: ${closedBy128_01}) — a checker that examined nothing must not report success (CLAUDE.md's paired non-zero-control rule).`
    );
  }

  if (failed) {
    process.exit(1);
  }

  console.log("[closed-todos] OK");
}

main();
