#!/usr/bin/env node
/**
 * Dead-surface ratchet for Convex function exports.
 *
 * Fails when a NEW public Convex export has no caller anywhere in the repo.
 * Known-dead exports live in scripts/dead-surface-baseline.json; the ratchet
 * only complains about entries that are not already in that baseline, and it
 * also complains when a baseline entry has become live or has been deleted
 * (so the baseline cannot silently rot).
 *
 * KNOWN LIMIT: invocations are found by scanning text, so a quoted "mod:fn"
 * sitting in call-argument position anywhere in a tracked file counts as a
 * caller -- including in an example inside a comment. That is the deliberate
 * trade for catching scripts/verify-intake-claim.mjs, which calls Convex
 * through a convexRun("mod:fn", ...) helper rather than by the api.* path.
 *
 * Usage:
 *   node scripts/check-dead-surface.mjs            # check (exit 1 on new dead)
 *   node scripts/check-dead-surface.mjs --list     # print every dead export
 *   node scripts/check-dead-surface.mjs --update   # rewrite the baseline
 *   node scripts/check-dead-surface.mjs --self-test  # prove the check can fail
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE = path.join(ROOT, "scripts", "dead-surface-baseline.json");

const DECL = /^export const ([A-Za-z0-9_]+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction)\(/;

function tracked() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.startsWith("convex/_generated/"))
    .filter((f) => !f.includes("node_modules/"))
    // The baseline lists dead names as quoted strings; scanning it would make
    // every entry vouch for itself.
    .filter((f) => f !== "scripts/dead-surface-baseline.json");
}

/** Every public Convex function, as "module:fnName". */
function declarations(files) {
  const out = [];
  for (const f of files) {
    if (!f.startsWith("convex/") || !f.endsWith(".ts")) continue;
    if (f.includes("/__tests__/") || f.endsWith(".test.ts")) continue;
    const mod = path.basename(f, ".ts");
    const lines = fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = DECL.exec(line);
      if (m) out.push({ key: `${mod}:${m[1]}`, kind: m[2], file: f, line: i + 1, fn: m[1], mod });
    });
  }
  return out;
}

/**
 * Every way this repo actually invokes a Convex function. Each form here was
 * observed in the wild -- do not drop one without checking the repo first.
 */
function invocations(files) {
  const seen = new Set();
  // modules pulled in wholesale by tests: import * as alertMutes from "../alertMutes"
  const starImports = new Map(); // localAlias -> moduleName

  for (const f of files) {
    let src;
    try {
      src = fs.readFileSync(path.join(ROOT, f), "utf8");
    } catch {
      continue;
    }

    // form 1+2: api.mod.fn / internal.mod.fn
    for (const m of src.matchAll(/\b(?:api|internal)\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g)) {
      seen.add(`${m[1]}:${m[2]}`);
    }
    // form 3: npx convex run mod:fn  (lives in docs and scripts)
    for (const m of src.matchAll(/convex run ([A-Za-z0-9_]+):([A-Za-z0-9_]+)/g)) {
      seen.add(`${m[1]}:${m[2]}`);
    }
    // form 5: the name passed as a QUOTED string to a helper, e.g.
    //   convexRun("forge:generateVerificationUploadUrl", "{}")
    // in scripts/verify-intake-claim.mjs. Quotes are required: a docs bullet
    // like `- credentialAudit:byTool` is a mention, not a call, and counting
    // those would turn the whole .planning tree into a fake caller.
    // Anchored to a CALL-ARGUMENT position -- `(` then the quoted name -- not
    // any quoted "word:word" anywhere. The loose version matched this very
    // baseline file's own entries and reported 0 dead of 582, a perfectly
    // circular green.
    for (const m of src.matchAll(/\(\s*["'`]([A-Za-z0-9_]+):([A-Za-z0-9_]+)["'`]/g)) {
      seen.add(`${m[1]}:${m[2]}`);
    }
    // form 4: direct module import in a test, then alias.fn
    //   import * as alertMutes from "../alertMutes";
    //   expect(alertMutes.listActiveMutes)...
    starImports.clear();
    for (const m of src.matchAll(/import\s+\*\s+as\s+([A-Za-z0-9_]+)\s+from\s+["'][^"']*?\/?([A-Za-z0-9_]+)["']/g)) {
      starImports.set(m[1], m[2]);
    }
    for (const [alias, mod] of starImports) {
      const re = new RegExp(`\\b${alias}\\.([A-Za-z0-9_]+)`, "g");
      for (const m of src.matchAll(re)) seen.add(`${mod}:${m[1]}`);
    }
  }
  return seen;
}

function analyse() {
  const files = tracked();
  const decls = declarations(files);
  const live = invocations(files);
  const dead = decls.filter((d) => !live.has(d.key));
  return { decls, dead };
}

const files = tracked();
const { decls, dead } = analyse();
const deadKeys = dead.map((d) => d.key).sort();

if (process.argv.includes("--list")) {
  for (const d of dead.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`${d.kind.padEnd(16)} ${d.file}:${d.line}  ${d.key}`);
  }
  console.log(`\n${dead.length} dead of ${decls.length} exports`);
  process.exit(0);
}

if (process.argv.includes("--update")) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "Convex exports with no caller. Adding a name here is a deliberate 'keep it, I run it by hand' decision -- see CLAUDE.md. Regenerate with: node scripts/check-dead-surface.mjs --update",
        generated: new Date().toISOString().slice(0, 10),
        total_exports: decls.length,
        allowed_dead: deadKeys,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`baseline updated: ${deadKeys.length} allowed-dead of ${decls.length} exports`);
  process.exit(0);
}

if (process.argv.includes("--self-test")) {
  // Prove the check CAN fail: a name that is declared nowhere must not be
  // reported live, and a name in the baseline must be reported dead.
  // Built at runtime, NOT written as a literal: form 5 matches a quoted
  // "mod:fn" in call-argument position, and a literal sentinel here would sit
  // in exactly that position inside this very file -- the scan would then find
  // it and the self-test would report a false negative. It did, once.
  const sentinel = ["__no", "such", "module__"].join("") + ":" + ["__no", "such", "fn__"].join("");
  const fakeLive = invocations(files).has(sentinel);
  const baselineNow = JSON.parse(fs.readFileSync(BASELINE, "utf8")).allowed_dead;
  const ok = !fakeLive && baselineNow.length > 0 && baselineNow.every((k) => deadKeys.includes(k));
  console.log(`self-test: invocation scan rejects unknown name = ${!fakeLive}`);
  console.log(`self-test: every baseline entry still measures as dead = ${baselineNow.every((k) => deadKeys.includes(k))}`);
  process.exit(ok ? 0 : 1);
}

let baseline;
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8")).allowed_dead;
} catch {
  console.error(`No baseline at ${BASELINE}. Create it with --update.`);
  process.exit(1);
}

const allowed = new Set(baseline);
const newlyDead = dead.filter((d) => !allowed.has(d.key));
const declaredKeys = new Set(decls.map((d) => d.key));
const staleBaseline = baseline.filter((k) => !deadKeys.includes(k));

let bad = false;

if (newlyDead.length) {
  bad = true;
  console.error(`\nNEW DEAD SURFACE -- ${newlyDead.length} export(s) with no caller:\n`);
  for (const d of newlyDead.sort((a, b) => a.key.localeCompare(b.key))) {
    console.error(`  ${d.file}:${d.line}  ${d.kind} ${d.key}`);
  }
  console.error(`\nEither wire it to a call site, delete it, or -- if you genuinely run it by`);
  console.error(`hand -- record the decision with: node scripts/check-dead-surface.mjs --update\n`);
}

if (staleBaseline.length) {
  bad = true;
  console.error(`\nSTALE BASELINE -- ${staleBaseline.length} entr(ies) no longer dead or no longer exist:\n`);
  for (const k of staleBaseline) {
    console.error(`  ${k}  (${declaredKeys.has(k) ? "now has a caller" : "export was removed"})`);
  }
  console.error(`\nRefresh with: node scripts/check-dead-surface.mjs --update\n`);
}

if (!bad) {
  console.log(`dead-surface ratchet OK: ${dead.length} dead of ${decls.length} exports, all ${baseline.length} accounted for in the baseline`);
}
process.exit(bad ? 1 : 0);
