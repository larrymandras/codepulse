import { readFileSync, existsSync } from "node:fs";

/**
 * Playwright globalTeardown — D-11's fail-on-skip mechanism for the contrast
 * matrix (`e2e/theme-contrast.spec.ts`).
 *
 * WHY globalTeardown and not an in-file "runs after all tests" hook:
 * `fullyParallel: true` puts each matrix cell in a separate worker PROCESS,
 * so a module-scope counter cannot see skips recorded by sibling workers.
 * That rejected hook mechanism also corrupts the status of whichever test
 * happens to run last in its scope — Playwright attributes a thrown hook
 * error to that test's own `result.status`, overwriting whatever its real
 * outcome would have been. Which cell that is depends on declaration order
 * and is not always a skip cell: `e2e/a11y-gate-guard.spec.ts` (Task 2)
 * measured a genuinely-passing control cell flip from `"passed"` to
 * `"failed"` this way, with no skip annotation at all — an even harder
 * failure to diagnose than a corrupted skip cell would be, since nothing on
 * the corrupted test hints at why it failed. globalTeardown runs exactly
 * once in the main process after every worker exits and reads an `fs`-based
 * log that every worker appended to, so it aggregates correctly AND leaves
 * every cell's own `result.status` untouched. Verified this session
 * (123-RESEARCH.md § Pattern 2) against this repo's real Playwright install:
 * exit 1, `stats.skipped` intact, zero cells misreported as `"failed"`.
 *
 * The log path defaults to the real matrix's log but is overridable via
 * `A11Y_SKIP_LOG` so `e2e/a11y-gate-guard.spec.ts` (Task 2) can exercise this
 * exact function against an isolated fixture log without ever touching the
 * real matrix's side-channel.
 *
 * The log must be truncated at run start in `e2e/global-setup.ts`, or a stale
 * log from a previous failing run fails the next clean one.
 */
export default function globalTeardown() {
  const logPath = process.env.A11Y_SKIP_LOG || "e2e/.a11y-skip-log.txt";
  const cells = existsSync(logPath)
    ? readFileSync(logPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
    : [];

  if (cells.length > 0) {
    throw new Error(
      `${cells.length} contrast-suite cell(s) were skipped (Clerk gate present) -- suite must ` +
        `fail even though each cell's own result.status stays "skipped": ${cells.join(", ")}`,
    );
  }
}
