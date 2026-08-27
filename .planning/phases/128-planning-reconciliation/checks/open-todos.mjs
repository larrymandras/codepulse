#!/usr/bin/env node
// Structural check (128-02, Task 3): every pending todo carries a dated re-derivation with
// resolvable evidence or an explicit deferral (D-06/D-07). Fails only on the files IN SCOPE
// (this plan's thirteen by default, or the files passed as argv). Every other pending todo is
// reported as an ADVISORY line — printed and counted, never fatal — because plan 128-01 owns 5
// other files in the same directory and this checker must not depend on its completion.
//
// Threat register: T-128-04 (a static grep presented as visual-defect proof), T-128-05 (a todo
// silently kept open with no re-derivation), T-128-06 (a checker that parses nothing and reports
// green).
//
// LIMIT (found by the phase-128 adversarial mutation gate -- do not read this checker as
// proving more than it does): the citation test proves a cited path RESOLVES. It does NOT
// prove the citation SUPPORTS the verdict. Every Re-derivation section closes with a
// boilerplate `.planning/REQUIREMENTS.md:NNN` self-citation which always resolves, so breaking
// the real code citation ALONE will not turn this checker red. This cannot be fixed by banning
// planning-internal citations: for `public-repo-exposes-...` the REQUIREMENTS.md line IS the
// evidence, because its claim is an ABSENCE (no public-repo decision has been recorded) and
// the requirement row is the only artifact that can witness it. Separating support from
// bookkeeping needs semantics, not a path rule. The `note:` line in the output makes the weak
// cases visible instead of silent -- today that is exactly one file, `public-repo-exposes-...`.
// (`phase-state-missing-array-...` is NOT weak: CITE_RE covers .json, so its
// phase-state.json:NNN citations count as substantive.)

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo root: checks/ -> 128-planning-reconciliation/ -> phases/ -> .planning/ -> root
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const PENDING_DIR = join(REPO_ROOT, ".planning", "todos", "pending");
const ROADMAP_PATH = join(REPO_ROOT, ".planning", "ROADMAP.md");

// This plan's own 13 files (files_modified in 128-02-PLAN.md) — the default scope when the
// checker is run with no arguments, matching its own <verify> invocation.
const PLAN_128_02_FILES = [
  "a11y-02-widened-scan-42-route-backlog.md",
  "alert-rules-engine-rows-overlap.md",
  "forge-analytics-visual-polish.md",
  "forge-job-list-column-clips-card-rows.md",
  "ideationrow-text-white-raw-palette-class.md",
  "inbox-page-undercounts-held-behind-200-cap.md",
  "kg-answer-sync-glxy02-test-flake.md",
  "phase-state-missing-array-never-encodes-ui-spec.md",
  "polish-geometry-spec-measures-cold-page.md",
  "public-repo-exposes-user-path-and-operational-posture.md",
  "sidebar-4px-horizontal-overflow-separator.md",
  "test-isolation-full-suite-only-failures.md",
  "vitest-suite-nondeterministic-one-random-failure-per-run.md",
];

// Files plan 128-01 owns in the same directory — reported by name in advisory output so a
// reader can tell "not yet re-derived by the sibling plan" from "genuinely unscoped."
const PLAN_128_01_FILES = new Set([
  "automation-page-placeholder-cards-and-invalid-expression.md",
  "forge-loading-div-aria-prohibited-attr.md",
  "inbox-listheldunacked-unbounded-every-route.md",
  "tool-galaxy-getprojectgraph-timeout.md",
  "unbounded-analytics-scans-timeout.md",
]);

const argFiles = process.argv.slice(2);
const scopeSet = new Set(argFiles.length > 0 ? argFiles.map((f) => f.split(/[\\/]/).pop()) : PLAN_128_02_FILES);

// ── Parse ROADMAP.md's Progress table phase numbers — never hardcode the list. ──
if (!existsSync(ROADMAP_PATH)) {
  console.error(`FATAL: ROADMAP.md not found at ${ROADMAP_PATH}`);
  process.exit(1);
}
const roadmapText = readFileSync(ROADMAP_PATH, "utf8");
const roadmapPhases = new Set(
  [...roadmapText.matchAll(/^\|\s*(\d+)\.\s/gm)].map((m) => m[1])
);

// ── Enumerate pending todos. ──
if (!existsSync(PENDING_DIR)) {
  console.error(`FATAL: pending todos dir not found at ${PENDING_DIR}`);
  process.exit(1);
}
const pendingFiles = readdirSync(PENDING_DIR).filter((f) => f.endsWith(".md"));

const DEFER_RE = /REQUIRES LIVE MEASUREMENT — deferred to Phase (\d+)/;
const CITE_RE = /([\w./-]+\.(?:ts|tsx|json|md|mjs)):(\d+)/g;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(text) {
  const m = text.match(FRONTMATTER_RE);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function extractRederivationSection(text) {
  const idx = text.indexOf("## Re-derivation (Phase 128");
  if (idx === -1) return null;
  const rest = text.slice(idx);
  const nextHeading = rest.slice(3).search(/\n## /);
  return nextHeading === -1 ? rest : rest.slice(0, nextHeading + 3);
}

let checked = 0;
let evidenceBacked = 0;
let deferrals = 0;
let failures = 0;
let advisories = 0;
const weakEvidence = [];
const failedFiles = [];

for (const file of pendingFiles) {
  const inScope = scopeSet.has(file);
  const fullPath = join(PENDING_DIR, file);
  const text = readFileSync(fullPath, "utf8");
  const fm = parseFrontmatter(text);

  const problems = [];

  for (const key of ["id", "status", "resolves_phase", "last_reviewed"]) {
    if (!fm[key]) problems.push(`missing frontmatter key '${key}'`);
  }

  if (fm.resolves_phase && !roadmapPhases.has(String(fm.resolves_phase))) {
    problems.push(
      `resolves_phase '${fm.resolves_phase}' has no matching row in ROADMAP.md's Progress table`
    );
  }

  const section = extractRederivationSection(text);
  if (!section) {
    problems.push(`no '## Re-derivation (Phase 128' section`);
  } else {
    const deferMatch = section.match(DEFER_RE);
    const cites = [...section.matchAll(CITE_RE)];
    // WR-03 (phase-128 code review): the citation pattern permits `../`, so confine the
    // resolved path to the checkout. A citation pointing outside this repository cannot be
    // evidence about this repository, so it must not count as resolvable.
    const withinRepo = (rel) => {
      const abs = resolve(REPO_ROOT, rel);
      return abs === REPO_ROOT || abs.startsWith(REPO_ROOT + sep);
    };
    const resolvableCite = cites.find((m) => withinRepo(m[1]) && existsSync(resolve(REPO_ROOT, m[1])));

    const hasValidDeferral = deferMatch && roadmapPhases.has(deferMatch[1]);
    const hasResolvableCite = Boolean(resolvableCite);

    // GAP-2 (phase-128 adversarial gate): a deferral line that IS present but names a phase
    // with no ROADMAP row used to fall through to the citation branch and be silently
    // recounted as "evidence-backed". Fail it explicitly before the either/or test below.
    if (deferMatch && !hasValidDeferral) {
      problems.push(
        `'REQUIRES LIVE MEASUREMENT - deferred to Phase ${deferMatch[1]}' names a phase with ` +
          `no matching row in ROADMAP.md's Progress table`
      );
    }

    if (!hasValidDeferral && !hasResolvableCite) {
      problems.push(
        `'## Re-derivation' section has neither a resolvable path:line citation nor a valid ` +
          `'REQUIRES LIVE MEASUREMENT — deferred to Phase NNN' line`
      );
    } else if (hasValidDeferral) {
      if (inScope) deferrals++;
    } else {
      if (inScope) evidenceBacked++;
      const substantive = cites.filter(
        (m) =>
          withinRepo(m[1]) &&
          existsSync(resolve(REPO_ROOT, m[1])) &&
          m[1] !== ".planning/REQUIREMENTS.md"
      );
      if (inScope && substantive.length === 0) weakEvidence.push(file);
    }
  }

  if (inScope) {
    checked++;
    if (problems.length > 0) {
      failures++;
      failedFiles.push({ file, problems });
    }
  } else {
    advisories++;
    const owner = PLAN_128_01_FILES.has(file) ? "128-01" : "unscoped (neither 128-01 nor 128-02)";
    const status = problems.length === 0 ? "OK" : `ISSUES: ${problems.join("; ")}`;
    console.log(`ADVISORY  ${file}  [owner: ${owner}]  ${status}`);
  }
}

console.log("---");
console.log(`pending todos in .planning/todos/pending/: ${pendingFiles.length}`);
console.log(`roadmap phases parsed from ROADMAP.md: ${roadmapPhases.size}`);
console.log(`checked (in scope): ${checked}`);
console.log(`  evidence-backed: ${evidenceBacked}`);
console.log(`  deferrals: ${deferrals}`);
console.log(`  failed: ${failures}`);
console.log(`advisory (out of scope): ${advisories}`);
if (weakEvidence.length > 0) {
  console.log(
    `  note: ${weakEvidence.length} evidence-backed todo(s) rest ONLY on a ` +
      `.planning/REQUIREMENTS.md self-citation (see LIMIT in this file's header): ` +
      weakEvidence.join(", ")
  );
}

if (pendingFiles.length === 0) {
  console.error("FATAL: pending-todo population is zero — the checker parsed nothing (T-128-06).");
  process.exit(1);
}
if (roadmapPhases.size === 0) {
  console.error("FATAL: roadmap-phase population is zero — the roadmap parser matched nothing (T-128-06).");
  process.exit(1);
}
if (checked === 0) {
  console.error(
    "FATAL: in-scope population is zero - the scope list matched no pending todo (T-128-06). " +
      "A checker that examined nothing must not report success."
  );
  process.exit(1);
}
if (failures > 0) {
  console.error(`FAIL: ${failures} in-scope todo(s) did not satisfy the evidence-or-deferral rule:`);
  for (const { file, problems } of failedFiles) {
    console.error(`  - ${file}: ${problems.join("; ")}`);
  }
  process.exit(1);
}

console.log("PASS");
process.exit(0);
