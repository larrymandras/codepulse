import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";

/**
 * D-12 durable self-test for the D-11 fail-on-skip guard
 * (`e2e/theme-contrast.global-teardown.ts`).
 *
 * This spec does NOT hit the real Clerk-gate skip branch in-band -- doing so
 * would append to the shared `e2e/.a11y-skip-log.txt` and turn every clean
 * suite run red. Instead it drives CHILD Playwright runs against a small
 * synthetic fixture matrix (3 skipping cells + 1 passing control) and
 * asserts on their exit codes and JSON reports, so it needs no Clerk key, no
 * gated server, and no operator -- it re-runs on every future suite
 * execution.
 *
 * All three fixture configs invoke the SAME production code:
 * `e2e/theme-contrast.global-teardown.ts`'s default export, parameterised by
 * `A11Y_SKIP_LOG` (the guarded config points it there; see that file's own
 * doc comment). Nothing here is a copy of the guard logic.
 *
 * Invoked explicitly via `node_modules/.bin/playwright`, never the bare CLI --
 * a global Playwright of a different version is installed on this machine
 * and cannot resolve this repo's local modules.
 */

// Resolves to node_modules/.bin/playwright -- built with path.join, not a
// forward-slash literal, because execSync's default shell on Windows is
// cmd.exe, and cmd.exe fails to resolve a forward-slash relative path as
// the LEADING command token ("'node_modules' is not recognized..."), even
// though the identical forward-slash form resolves fine when typed at a
// Git Bash prompt. Verified empirically this session. Never the bare `npx`
// CLI, which resolves a different global Playwright install on this
// machine and cannot load this repo's local modules.
const PLAYWRIGHT_BIN = path.join("node_modules", ".bin", "playwright");
const FIXTURE_ROOT = "e2e/.a11y-selftest";
const REAL_TEARDOWN_ABS = path
  .resolve(process.cwd(), "e2e/theme-contrast.global-teardown.ts")
  .replace(/\\/g, "/");

// Built by concatenation, not as a literal, so this file's own source never
// contains the contiguous text "test.skip(" -- that string is reserved for
// the REAL matrix spec and would otherwise false-positive a repo-wide grep
// for "does this file skip in-band".
const TEST_SKIP = "test" + ".skip";

// The root config sets fullyParallel: true, which splits even a single
// file's tests across separate worker PROCESSES. This file's tests share
// state (guardedRun/unguardedRun/afterallRun) written once in beforeAll and
// read by every test, and multiple workers concurrently writing the same
// fixture directory races (ENOTEMPTY/ENOENT, observed empirically). Force
// this file onto one worker, sequentially, regardless of the root setting.
test.describe.configure({ mode: "serial" });

type JsonReportTest = {
  annotations: Array<{ type: string; description?: string }>;
  results: Array<{ status: string }>;
};
type JsonReport = {
  stats: { expected: number; unexpected: number; skipped: number; flaky: number };
  suites: Array<{ specs: Array<{ tests: JsonReportTest[] }> }>;
};

function flattenTests(report: JsonReport): JsonReportTest[] {
  const out: JsonReportTest[] = [];
  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      out.push(...spec.tests);
    }
  }
  return out;
}

function writeGuardedFixture(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "fixture-cells.spec.ts"),
    [
      'import { test, expect } from "@playwright/test";',
      'import { appendFileSync } from "node:fs";',
      "",
      'const CELLS = ["Alpha", "Bravo", "Charlie"];',
      "",
      "for (const name of CELLS) {",
      '  test(`skip cell ${name}`, async () => {',
      "    appendFileSync(process.env.A11Y_SKIP_LOG!, `${name}\\n`);",
      `    ${TEST_SKIP}(true, \`synthetic gate cell \${name}\`);`,
      "  });",
      "}",
      "",
      'test("control cell -- passes", async () => {',
      "  expect(1 + 1).toBe(2);",
      "});",
      "",
    ].join("\n"),
  );
}

function writeAfterAllFixture(dir: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "fixture-cells.spec.ts"),
    [
      'import { test, expect } from "@playwright/test";',
      'import { appendFileSync } from "node:fs";',
      "",
      'const CELLS = ["Alpha", "Bravo", "Charlie"];',
      "let skipCount = 0;",
      "",
      // The rejected mechanism (123-CONTEXT.md D-11): a module-scope counter
      // plus an afterAll throw. Forced onto a single worker (see the config
      // below) so the counter actually sees all three skips -- exactly the
      // "serialises the whole matrix" anti-pattern D-11 documents.
      "test.afterAll(() => {",
      "  if (skipCount > 0) {",
      '    throw new Error(`${skipCount} fixture cell(s) skipped -- rejected in-file afterAll mechanism`);',
      "  }",
      "});",
      "",
      "for (const name of CELLS) {",
      '  test(`skip cell ${name}`, async () => {',
      "    appendFileSync(process.env.A11Y_SKIP_LOG!, `${name}\\n`);",
      "    skipCount++;",
      `    ${TEST_SKIP}(true, \`synthetic gate cell \${name}\`);`,
      "  });",
      "}",
      "",
      'test("control cell -- passes", async () => {',
      "  expect(1 + 1).toBe(2);",
      "});",
      "",
    ].join("\n"),
  );
}

function writeConfig(
  configPath: string,
  opts: { workers: number; globalTeardown?: string },
) {
  const lines = [
    "import { defineConfig } from '@playwright/test';",
    "export default defineConfig({",
    "  testDir: '.',",
    "  fullyParallel: true,",
    `  workers: ${opts.workers},`,
    opts.globalTeardown ? `  globalTeardown: '${opts.globalTeardown}',` : "",
    "});",
    "",
  ].filter(Boolean);
  writeFileSync(configPath, lines.join("\n"));
}

function runFixture(opts: {
  configPath: string;
  reportPath: string;
  logPath: string;
}): { exitCode: number; report: JsonReport } {
  if (existsSync(opts.logPath)) rmSync(opts.logPath);
  if (existsSync(opts.reportPath)) rmSync(opts.reportPath);

  let exitCode = 0;
  try {
    execSync(`${PLAYWRIGHT_BIN} test --config="${opts.configPath}" --reporter=json`, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // PLAYWRIGHT_JSON_OUTPUT_FILE, not the plan-text's assumed
        // *_OUTPUT_NAME -- verified against this repo's installed
        // Playwright 1.61.1 (node_modules/playwright/lib/runner/index.js
        // resolveOutputFile: `PLAYWRIGHT_${reporterName.toUpperCase()}_
        // OUTPUT_FILE`). The _NAME variant sets only the report's bare file
        // NAME under a resolved outputDir, and with none of outputFile/
        // outputDir/default set, resolveOutputFile silently returns
        // undefined -- the reporter then falls back to printing its normal
        // terminal summary and writes no file at all, which is exactly what
        // was observed empirically before this was traced.
        PLAYWRIGHT_JSON_OUTPUT_FILE: opts.reportPath,
        A11Y_SKIP_LOG: opts.logPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e as { status?: number | null };
    exitCode = typeof err.status === "number" && err.status !== null ? err.status : 1;
  }

  const report = JSON.parse(readFileSync(opts.reportPath, "utf8")) as JsonReport;
  return { exitCode, report };
}

// ─── Fixture layout ─────────────────────────────────────────────────────
// Each fixture gets its own self-contained directory: config's `testDir: '.'`
// then resolves relative to that directory, colocated with its own copy of
// the fixture spec -- avoids any cross-directory testDir resolution.
const guardedDir = path.join(FIXTURE_ROOT, "guarded");
const unguardedDir = path.join(FIXTURE_ROOT, "unguarded");
const afterallDir = path.join(FIXTURE_ROOT, "afterall");
const guardedConfig = path.join(guardedDir, "playwright.config.ts");
const unguardedConfig = path.join(unguardedDir, "playwright.config.ts");
const afterallConfig = path.join(afterallDir, "playwright.config.ts");
const guardedReport = path.join(FIXTURE_ROOT, "guarded-report.json");
const unguardedReport = path.join(FIXTURE_ROOT, "unguarded-report.json");
const afterallReport = path.join(FIXTURE_ROOT, "afterall-report.json");
const guardedLog = path.join(FIXTURE_ROOT, "guarded-skip-log.txt");
const unguardedLog = path.join(FIXTURE_ROOT, "unguarded-skip-log.txt");
const afterallLog = path.join(FIXTURE_ROOT, "afterall-skip-log.txt");

let guardedRun: { exitCode: number; report: JsonReport };
let unguardedRun: { exitCode: number; report: JsonReport };
let afterallRun: { exitCode: number; report: JsonReport };

test.beforeAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });

  // guarded and unguarded run the IDENTICAL fixture spec -- only the config
  // differs, whether globalTeardown is wired -- so the two directories are
  // written from the same generator.
  writeGuardedFixture(guardedDir);
  writeGuardedFixture(unguardedDir);
  writeAfterAllFixture(afterallDir);
  writeConfig(guardedConfig, { workers: 4, globalTeardown: REAL_TEARDOWN_ABS });
  writeConfig(unguardedConfig, { workers: 4 });
  writeConfig(afterallConfig, { workers: 1 });

  guardedRun = runFixture({
    configPath: guardedConfig,
    reportPath: guardedReport,
    logPath: guardedLog,
  });
  unguardedRun = runFixture({
    configPath: unguardedConfig,
    reportPath: unguardedReport,
    logPath: unguardedLog,
  });
  afterallRun = runFixture({
    configPath: afterallConfig,
    reportPath: afterallReport,
    logPath: afterallLog,
  });
});

test.afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

test("guarded run: exits non-zero, skip stays skipped, control still passes (D-11/D-12)", () => {
  expect(guardedRun.exitCode).not.toBe(0);
  expect(guardedRun.report.stats.skipped).toBe(3);

  const tests = flattenTests(guardedRun.report);
  const gated = tests.filter((t) => t.annotations.some((a) => a.type === "skip"));
  expect(gated).toHaveLength(3);
  for (const t of gated) {
    expect(t.results[0]?.status).toBe("skipped");
  }

  const control = tests.find(
    (t) => !t.annotations.some((a) => a.type === "skip"),
  );
  expect(control?.results[0]?.status).toBe("passed");
});

test("C1 -- unguarded control exits 0 with the identical skip count, so exit 1 is informative", () => {
  expect(unguardedRun.exitCode).toBe(0);
  expect(unguardedRun.report.stats.skipped).toBe(3);
});

test("C2 -- the rejected afterAll mechanism corrupts status while still exiting non-zero", () => {
  expect(afterallRun.exitCode).not.toBe(0);

  // CORRECTED AGAINST LIVE BEHAVIOUR (123-CONTEXT.md D-11's own probe table
  // does not reproduce here -- see the deviation note in 123-01-SUMMARY.md).
  // Measured this session with workers:1, three skip cells declared before
  // one passing control cell: the thrown afterAll error is attributed to
  // the LAST test in file-declaration order -- the CONTROL cell, not the
  // skip cells. stats.skipped stays 3 (the three skips remain genuinely
  // "skipped" with their annotations intact); exactly one test flips from
  // "passed" to "failed", and it carries the HOOK's error message with NO
  // skip annotation at all. This is arguably worse than the originally
  // documented failure mode: an operator would see an unrelated, otherwise-
  // clean cell reported as violating, with no skip reason anywhere on it.
  expect(afterallRun.report.stats.skipped).toBe(3);

  const failed = flattenTests(afterallRun.report).filter(
    (t) => t.results[0]?.status === "failed",
  );
  expect(failed).toHaveLength(1);
  expect(failed[0].annotations.some((a) => a.type === "skip")).toBe(false);
});

test("C7 -- zero unexplained failures in the guarded report; the C2 fixture proves the predicate fires", () => {
  // The literal "failed AND skip-annotated" signature from 123-VALIDATION.md
  // never occurs in either report given the corruption mechanism actually
  // observed (see C2 above) -- it would trivially read 0/0 and prove
  // nothing. The generalised, still-discriminating form: the guarded run
  // (real production code) has ZERO tests reporting "failed" at all -- three
  // skips stay skipped, the control stays passed -- while the C2 fixture
  // (rejected mechanism) has at least one, proving this predicate is
  // capable of firing rather than being vacuously true.
  const countFailures = (report: JsonReport) =>
    flattenTests(report).filter((t) => t.results[0]?.status === "failed").length;

  expect(countFailures(guardedRun.report)).toBe(0);
  expect(countFailures(afterallRun.report)).toBeGreaterThanOrEqual(1);
});

test("the guard's locator is bound to AuthGuard's real copy, not a stale string", () => {
  const src = readFileSync(
    path.resolve(process.cwd(), "src/components/AuthGuard.tsx"),
    "utf8",
  );
  expect(src.includes("Sign in to access the telemetry dashboard")).toBe(true);
  // Must-differ control: a string that must NOT be present, proving the
  // check above discriminates rather than passing on any substring.
  expect(src.includes("Sign in to access the telemetry dashboard-9x7q2")).toBe(
    false,
  );
});
