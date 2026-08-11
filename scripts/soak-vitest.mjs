#!/usr/bin/env node
/**
 * scripts/soak-vitest.mjs
 *
 * Per-iteration soak runner (113-05, D-09 harness; hardened by the 113-05
 * adversarial-verification fixups). Repeats a shell command N times,
 * recording exactly ONE durable line per iteration to an append-only log —
 * a failure at iteration 23 of 30 can never be overwritten by iteration
 * 30's success (T-113-23). Stops and captures the full output on the first
 * non-PASS outcome (T-113-24/T-113-27's downstream consumer, plan 113-06,
 * relies on this early-stop).
 *
 * Usage:
 *   node scripts/soak-vitest.mjs --iterations <n> --log <path> \
 *     [--command "<shell command>"] [--label <text>] [--timeout <ms>]
 *
 * Default --command is "npx vitest run" (the FULL suite, D-09) — never a
 * bare `vitest` (no `run` subcommand), which enters watch mode and hangs
 * the soak forever (T-113-22). The script refuses at startup if the
 * resolved command names vitest without the run subcommand.
 *
 * Per-iteration log line shape (machine-parseable by 113-06):
 *   <iso> label=<label> iteration=<i>/<n> status=PASS|FAIL|TIMEOUT|ERROR exit=<code> duration_ms=<ms> capture=<path-or-none>
 *
 * status values:
 *   PASS    — exit code 0.
 *   FAIL    — the command ran to completion with a non-zero exit code. The
 *             only status 113-06 may treat as a reproduction.
 *   TIMEOUT — the command exceeded --timeout and was killed (SIGTERM). A
 *             hang is bounded and VISIBLE as its own status rather than
 *             producing silence in the log (defect: a hung iteration
 *             previously wrote NO line at all, since the line was only
 *             appended after spawnSync returned).
 *   ERROR   — the harness itself failed to run the command (e.g. ENOENT,
 *             ENOBUFS/maxBuffer overrun, or any other spawn-level error).
 *             Never a test outcome — must never be counted as a
 *             reproduction of the thing under test.
 * TIMEOUT and ERROR are distinct string tokens from FAIL, so a consumer
 * doing a literal `status=FAIL` match (as 113-06 does) will never conflate
 * a harness malfunction or a hang with a genuine test failure.
 *
 * Failure capture files are RUN-scoped, not index-scoped: the filename
 * embeds this run's start timestamp and label, so a second soak run that
 * happens to fail at the same iteration index writes to a different file
 * and can never clobber a prior run's evidence. The capture is written
 * with the exclusive-create flag ("wx") and the script refuses (FATAL,
 * non-zero exit) rather than silently overwriting if a path collision
 * ever occurs. The capture also records its own label, run-start
 * timestamp, iteration, and status inline, so an orphaned capture file is
 * still attributable to its run without cross-referencing the log.
 *
 * Exit code: 1 if any iteration was FAIL, TIMEOUT, or ERROR; 0 otherwise.
 * Final line printed to stdout:
 *   iterations_run=<n> passed=<n> failed=<n> timed_out=<n> harness_errors=<n>
 * real counts derived from the per-iteration outcomes actually recorded
 * this run, never from a single aggregate boolean.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_TIMEOUT_MS = 300_000; // 5 min — measured full-suite runs are ~37-46s, ~6-8x margin.

function parseArgs(argv) {
  const args = { command: "npx vitest run", label: "", timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--iterations") args.iterations = Number(argv[(i += 1)]);
    else if (a === "--log") args.log = argv[(i += 1)];
    else if (a === "--command") args.command = argv[(i += 1)];
    else if (a === "--label") args.label = argv[(i += 1)];
    else if (a === "--timeout") args.timeoutMs = Number(argv[(i += 1)]);
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
if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
  console.error("FATAL: --timeout <ms> must be a positive number.");
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

// This run's own identity — used both in the header line and to make every
// failure-capture filename unique to THIS run (defect fix: capture paths
// were previously keyed on the iteration index alone, so two runs failing
// at the same index clobbered each other's evidence).
const runStartIso = nowIso();
const safeLabel = (args.label || "run").replace(/[^A-Za-z0-9_-]+/g, "_");
const safeRunId = runStartIso.replace(/[:.]/g, "-");

// Header line, appended (never truncates an existing log — so a tier-2 run
// never erases tier-1's record).
const header = `# ${runStartIso} soak-start label=${args.label} iterations=${args.iterations} timeout_ms=${args.timeoutMs} command=${JSON.stringify(
  args.command
)}\n`;
appendFileSync(logPath, header);

let passed = 0;
let failed = 0;
let timedOut = 0;
let harnessErrors = 0;
let stoppedEarly = false;

for (let i = 1; i <= args.iterations; i += 1) {
  const start = Date.now();
  const result = spawnSync(args.command, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64, // 64 MiB — a full-suite run can produce a lot of output
    timeout: args.timeoutMs,
    killSignal: "SIGTERM",
  });
  const durationMs = Date.now() - start;

  // Determine status. Verified empirically (node -e spawnSync probe,
  // 2026-08-11): a timeout kill sets result.error.code === "ETIMEDOUT"
  // with status=null, signal="SIGTERM"; any other spawn-level failure
  // (ENOENT, ENOBUFS, ...) sets result.error with a different code and
  // status=null; a completed process never sets result.error.
  let status;
  if (result.error && result.error.code === "ETIMEDOUT") {
    status = "TIMEOUT";
  } else if (result.error) {
    status = "ERROR";
  } else if (result.status === 0) {
    status = "PASS";
  } else {
    status = "FAIL";
  }

  const exitField = result.status === null || result.status === undefined ? "null" : String(result.status);
  const iso = nowIso();

  let capturePath = null;
  if (status !== "PASS") {
    // Run-scoped (label + this run's start timestamp), never index-scoped
    // alone — so a second failing run at the same iteration index cannot
    // clobber this run's capture.
    capturePath = `${logPath}.${safeLabel}-${safeRunId}.iteration-${i}.txt`;
    const captureBody = [
      `label: ${args.label}`,
      `run_started: ${runStartIso}`,
      `iteration: ${i}/${args.iterations}`,
      `status: ${status}`,
      `command: ${args.command}`,
      `exit code: ${exitField}`,
      `signal: ${result.signal ?? "(none)"}`,
      `error: ${result.error ? `${result.error.code ?? ""} ${result.error.message ?? String(result.error)}`.trim() : "(none)"}`,
      "",
      "── stdout ──",
      result.stdout ?? "",
      "",
      "── stderr ──",
      result.stderr ?? "",
    ].join("\n");

    if (existsSync(capturePath)) {
      // Should be structurally impossible (run-scoped filename), but never
      // silently overwrite evidence — refuse loudly instead.
      console.error(`FATAL: refusing to overwrite an existing capture file: ${capturePath}`);
      process.exit(3);
    }
    try {
      writeFileSync(capturePath, captureBody, { flag: "wx" });
    } catch (err) {
      if (err && err.code === "EEXIST") {
        console.error(`FATAL: refusing to overwrite an existing capture file: ${capturePath}`);
        process.exit(3);
      }
      throw err;
    }
    console.log(`  Captured full output: ${capturePath}`);
  }

  const captureField = capturePath ?? "(none)";
  const line = `${iso} label=${args.label} iteration=${i}/${args.iterations} status=${status} exit=${exitField} duration_ms=${durationMs} capture=${captureField}\n`;
  // Flush to disk BEFORE starting the next iteration — a crash mid-soak
  // must not lose the record of completed iterations.
  appendFileSync(logPath, line);
  ok(
    status === "PASS",
    `iteration ${i}/${args.iterations}`,
    `status=${status} exit=${exitField} duration_ms=${durationMs}`
  );

  if (status === "PASS") {
    passed += 1;
  } else {
    if (status === "TIMEOUT") timedOut += 1;
    else if (status === "ERROR") harnessErrors += 1;
    else failed += 1;
    stoppedEarly = true;
    break; // Stop immediately on the first non-PASS outcome — do not continue the remaining iterations.
  }
}

const iterationsRun = passed + failed + timedOut + harnessErrors;
console.log(
  `iterations_run=${iterationsRun} passed=${passed} failed=${failed} timed_out=${timedOut} harness_errors=${harnessErrors}${
    stoppedEarly ? " (stopped early)" : ""
  }`
);

process.exit(failed > 0 || timedOut > 0 || harnessErrors > 0 ? 1 : 0);
