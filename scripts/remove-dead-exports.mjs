#!/usr/bin/env node
/**
 * One-shot remover for dead Convex exports.
 *
 * Reads a list of "convex/<mod>.ts:<line>:<mod>:<fn>" targets on stdin (or --list <file>)
 * and deletes each `export const <fn> = query({ ... });` block, plus any
 * doc comment immediately above it.
 *
 * Refuses to write anything unless EVERY target matched exactly once.
 */
import fs from "node:fs";

const listFile = process.argv[process.argv.indexOf("--list") + 1];
const apply = process.argv.includes("--apply");
const targets = fs
  .readFileSync(listFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    // form: convex/mod.ts:LINE:mod:fn
    const parts = l.split(":");
    return { file: parts[0], fn: parts[2] };
  });

// group by file
const byFile = new Map();
for (const t of targets) {
  if (!byFile.has(t.file)) byFile.set(t.file, []);
  byFile.get(t.file).push(t.fn);
}

const errors = [];
const plans = [];

for (const [file, fns] of byFile) {
  const src = fs.readFileSync(file, "utf8");
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  let lines = src.split(/\r?\n/);

  // Mark lines for deletion rather than splicing, so line numbers stay stable.
  const doomed = new Set();

  for (const fn of fns) {
    const startIdxs = [];
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(`^export const ${fn}\\s*=\\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\\(\\{`).test(lines[i])) {
        startIdxs.push(i);
      }
    }
    if (startIdxs.length !== 1) {
      errors.push(`${file}: expected exactly 1 declaration of '${fn}', found ${startIdxs.length}`);
      continue;
    }
    let start = startIdxs[0];

    // find closing `});` at column 0
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === "});") {
        end = i;
        break;
      }
    }
    if (end === -1) {
      errors.push(`${file}: no closing '});' found for '${fn}'`);
      continue;
    }

    // absorb a doc comment directly above (no blank line between)
    let commentStart = start;
    let j = start - 1;
    if (j >= 0 && lines[j].trimEnd().endsWith("*/")) {
      while (j >= 0 && !lines[j].trimStart().startsWith("/*")) j--;
      if (j >= 0) commentStart = j;
    } else {
      while (j >= 0 && lines[j].trimStart().startsWith("//")) {
        commentStart = j;
        j--;
      }
    }

    for (let i = commentStart; i <= end; i++) doomed.add(i);
    // absorb one trailing blank line
    if (end + 1 < lines.length && lines[end + 1].trim() === "") doomed.add(end + 1);
  }

  plans.push({ file, doomed, lines, eol, count: fns.length });
}

if (errors.length) {
  console.error("REFUSING TO WRITE. Unresolved targets:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

let totalLines = 0;
for (const p of plans) {
  const kept = p.lines.filter((_, i) => !p.doomed.has(i));
  totalLines += p.doomed.size;
  console.log(`${p.file}: removing ${p.count} export(s), ${p.doomed.size} lines`);
  if (apply) fs.writeFileSync(p.file, kept.join(p.eol), "utf8");
}
console.log(`\n${apply ? "APPLIED" : "DRY RUN"}: ${targets.length} exports, ${totalLines} lines across ${plans.length} files`);
