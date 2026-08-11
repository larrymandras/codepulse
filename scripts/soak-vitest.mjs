#!/usr/bin/env node
/**
 * scripts/soak-vitest.mjs
 *
 * Per-iteration soak runner (113-05, D-09 harness). Repeats a shell command
 * N times, recording exactly ONE durable line per iteration to an
 * append-only log — a failure at iteration 23 of 30 can never be
 * overwritten by iteration 30's success (T-113-23). Stops and captures the
 * full output on the first failure (T-113-24/T-113-27's downstream
 * consumer, plan 113-06, relies on this early-stop).
 *
 * Usage:
 *   node scripts/soak-vitest.mjs --iterations <n> --log <path> \
 *     [--command "<shell command>"] [--label <text>]
 *
 * Default --command is "npx vitest run" (the FULL suite, D-09) — never a
 * bare `vitest` (no `run` subcommand), which enters watch mode and hangs
 * the soak forever (T-113-22). The script refuses at startup if the
 * resolved command names vitest without the run subcommand.
 *
 * Per-iteration log line shape (machine-parseable by 113-06):
 *   <iso> label=<label> iteration=<i>/<n> status=PASS|FAIL exit=<code> duration_ms=<ms>
 *
 * Exit code: 1 if any iteration failed, 0 otherwise. Final line printed to
 * stdout: `iterations_run=<n> passed=<n> failed=<n>` — real counts derived
 * from the per-iteration outcomes actually recorded this run, never from a
 * single aggregate boolean.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = { command: "npx vitest run", label: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--iterations") args.iterations = Number(argv[(i += 1)]);
    else if (a === "--log") args.log = argv[(i += 1)];
    else if (a === "--command") args.command = argv[(i += 1)];
    else if (a === "--label") args.label = argv[(i += 1)];
    else {
      console.error(`FATAL: unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!Number.isInteger(args.iterations) || args.iterations < 1) {
  console.error("FATAL: --iterations <n> is required and must be a positive integer.");
  process.exit(2);
}
if (!args.log) {
  console.error("FATAL: --log <path> is required.");
  process.exit(2);
}

// D-09 / T-113-22 guard: a bare vitest invocation (no `run` subcommand)
// enters watch mode and never exits, hanging the soak indefinitely. Refuse
// it rather than let the first iteration hang forever.
if (/\bvitest\b/.test(args.command) && !/\bvitest\s+run\b/.test(args.command)) {
  console.error(
    `FATAL: --command "${args.command}" invokes vitest without the "run" subcommand — ` +
      `this would enter watch mode and hang every iteration. Use "vitest run ...".`
  );
  process.exit(2);
}

const logPath = resolve(args.log);

/** Mirrors scripts/verify-skills-page.mjs's per-check PASS/FAIL idiom. */
const ok = (cond, label, extra = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  return cond;
};

const nowIso = () => new Date().toISOString();

// Header line, appended (never truncates an existing log — so a tier-2 run
// never erases tier-1's record).
const header = `# ${nowIso()} soak-start label=${args.label} iterations=${args.iterations} command=${JSON.stringify(
  args.command
)}\n`;
appendFileSync(logPath, header);

let passed = 0;
let failed = 0;
let stoppedEarly = false;

for (let i = 1; i <= args.iterations; i += 1) {
  const start = Date.now();
  const result = spawnSync(args.command, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64, // 64 MiB — a full-suite run can produce a lot of output
  });
  const durationMs = Date.now() - start;
  const exitCode = result.status ?? (result.signal ? 128 : 1);
  const status = exitCode === 0 ? "PASS" : "FAIL";
  const iso = nowIso();

  const line = `${iso} label=${args.label} iteration=${i}/${args.iterations} status=${status} exit=${exitCode} duration_ms=${durationMs}\n`;
  // Flush to disk BEFORE starting the next iteration — a crash mid-soak
  // must not lose the record of completed iterations.
  appendFileSync(logPath, line);
  ok(
    status === "PASS",
    `iteration ${i}/${args.iterations}`,
    `exit=${exitCode} duration_ms=${durationMs}`
  );

  if (status === "PASS") {
    passed += 1;
  } else {
    failed += 1;
    const capturePath = `${logPath}.iteration-${i}.txt`;
    const captured = [
      `command: ${args.command}`,
      `exit code: ${exitCode}`,
      `signal: ${result.signal ?? "(none)"}`,
      "",
      "── stdout ──",
      result.stdout ?? "",
      "",
      "── stderr ──",
      result.stderr ?? "",
    ].join("\n");
    writeFileSync(capturePath, captured);
    console.log(`  Captured full output: ${capturePath}`);
    stoppedEarly = true;
    break; // Stop immediately on the first failure — do not continue the remaining iterations.
  }
}

const iterationsRun = passed + failed;
console.log(
  `iterations_run=${iterationsRun} passed=${passed} failed=${failed}${
    stoppedEarly ? " (stopped early on failure)" : ""
  }`
);

process.exit(failed > 0 ? 1 : 0);
