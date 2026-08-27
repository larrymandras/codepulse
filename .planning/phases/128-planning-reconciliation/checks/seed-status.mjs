#!/usr/bin/env node
// checks/seed-status.mjs — Phase 128-03, Task 2.
//
// Structural check on the seed status vocabulary and absorbed_by referential
// integrity. This is a HAND-ROLLED line parser, not a YAML library, because
// these seed files are deliberately NOT strict YAML (SEED-001's trailing `#`
// comment on the `status:` line, SEED-005's copy of the same shape after this
// phase's edit). "Take the first token of each value" is the load-bearing
// rule this file exists to implement.
//
// Vocabulary: {dormant, shipped, absorbed, resolved}.
// absorbed_by referential integrity is checked REGARDLESS of status — a
// shipped seed can carry absorbed_by too (SEED-007's dual-field shape), and
// an ID must resolve against .planning/REQUIREMENTS.md either way.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// checks/ -> 128-planning-reconciliation/ -> phases/ -> .planning/ -> repo root
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SEEDS_DIR = join(REPO_ROOT, ".planning", "seeds");
const REQUIREMENTS_PATH = join(REPO_ROOT, ".planning", "REQUIREMENTS.md");

const VALID_STATUSES = new Set(["dormant", "shipped", "absorbed", "resolved"]);

/** Extract the frontmatter block (between the first two `---` lines). */
function extractFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return null;
  return lines.slice(1, end);
}

/**
 * Parse one frontmatter line into {key, rawValue}. Returns null for blank/
 * non-key lines. Takes the FIRST TOKEN of the value — i.e. everything before
 * an unbracketed ` #` comment marker — so SEED-001/005's trailing evidence
 * comment on the `status:` line cannot corrupt the parsed status.
 */
function parseLine(line) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
  if (!m) return null;
  const key = m[1];
  let value = m[2];
  // Strip a trailing ` # comment` UNLESS the value is a bracketed array
  // (arrays in this corpus never carry a trailing comment, but guard anyway
  // by only stripping when the value does not start with `[`).
  if (!value.trimStart().startsWith("[")) {
    const hashIdx = value.indexOf(" #");
    if (hashIdx !== -1) value = value.slice(0, hashIdx);
  }
  return { key, value: value.trim() };
}

/** Parse a bracketed `[A, B, C]` list into an array of trimmed IDs. */
function parseArray(value) {
  const m = value.match(/^\[(.*)\]$/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function main() {
  const reqText = readFileSync(REQUIREMENTS_PATH, "utf8");

  const seedFiles = readdirSync(SEEDS_DIR)
    .filter((f) => /^SEED-\d+.*\.md$/.test(f))
    .sort();

  if (seedFiles.length === 0) {
    console.error("FAIL: seeds parsed is zero — no SEED-*.md files found in", SEEDS_DIR);
    process.exit(1);
  }

  const failures = [];
  const statusCounts = {};
  let absorbedByResolvedCount = 0;
  let seedsParsed = 0;

  for (const file of seedFiles) {
    const fullPath = join(SEEDS_DIR, file);
    const text = readFileSync(fullPath, "utf8");
    const fmLines = extractFrontmatter(text);
    if (fmLines === null) {
      failures.push(`${file}: no parseable frontmatter block (missing --- delimiters)`);
      continue;
    }

    let status = null;
    let absorbedBy = [];
    for (const line of fmLines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (parsed.key === "status") status = parsed.value;
      if (parsed.key === "absorbed_by") absorbedBy = parseArray(parsed.value);
    }

    seedsParsed += 1;

    if (status === null) {
      failures.push(`${file}: no status: key found in frontmatter`);
      continue;
    }

    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    if (!VALID_STATUSES.has(status)) {
      failures.push(
        `${file}: status "${status}" is outside the vocabulary {dormant, shipped, absorbed, resolved}`
      );
    }

    if (status === "absorbed" && absorbedBy.length === 0) {
      failures.push(`${file}: status: absorbed but no absorbed_by field present`);
    }

    // The reverse coupling, and the one that actually protects this plan's goal
    // (found by the phase-128 adversarial mutation gate). Without it, a seed whose
    // content genuinely became scoped requirements -- absorbed_by naming REAL ids --
    // could be flipped back to `dormant` and this checker still printed OK. `dormant`
    // is exactly what /gsd-new-milestone's seed scan re-proposes as NEW work, so that
    // silent reversion IS the duplicate-planning failure this plan exists to prevent.
    // A seed that names what absorbed it cannot also be awaiting proposal.
    if (status === "dormant" && absorbedBy.length > 0) {
      failures.push(
        `${file}: status: dormant but absorbed_by names ${absorbedBy.length} requirement(s) ` +
          `(${absorbedBy.join(", ")}) - an absorbed seed must not be re-proposable as new work`
      );
    }

    // Referential integrity check applies to EVERY seed carrying absorbed_by,
    // regardless of status (the SEED-007 case: the field appears on a
    // status: shipped seed).
    for (const id of absorbedBy) {
      if (!reqText.includes(id)) {
        failures.push(
          `${file}: absorbed_by lists "${id}", which does not appear in .planning/REQUIREMENTS.md`
        );
      } else {
        absorbedByResolvedCount += 1;
      }
    }
  }

  console.log(`seeds parsed: ${seedsParsed}`);
  console.log("status counts:", JSON.stringify(statusCounts));
  console.log(`absorbed_by IDs resolved: ${absorbedByResolvedCount}`);

  if (seedsParsed === 0) {
    console.error("FAIL: seeds parsed is zero — a referential check that resolved nothing has demonstrated nothing");
    process.exit(1);
  }
  if (absorbedByResolvedCount === 0) {
    console.error("FAIL: resolved absorbed_by IDs is zero — the paired non-zero control never fired");
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error("FAIL:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log("OK — vocabulary valid, absorbed_by referential integrity holds, non-zero controls satisfied.");
  process.exit(0);
}

main();
