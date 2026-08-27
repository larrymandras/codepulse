/**
 * planningChecks.ratchet.test.ts — runs Phase 128's planning-integrity checkers as part of
 * `npm test`, so they stop being scripts that only fire when a human remembers to invoke them.
 *
 * WHY THIS EXISTS. Phase 128 built three checkers under its `checks/` directory
 * (`closed-todos.mjs`, `open-todos.mjs`, `seed-status.mjs`). Phase 128's own adversarial
 * mutation gate established that NOTHING ran them: `vitest related` returned "No test files
 * found" because the unit project's globs are `src/**`, `convex/**`, `hooks/**` and cover no
 * part of `.planning/**`, and `.github/workflows/ci.yml` referenced none of them. Every guard
 * they implement — a closure citing a file that does not exist, a todo kept open with no
 * re-derivation, a `resolves_phase` pointing at a phase with no ROADMAP row, a seed whose
 * `absorbed_by` names a requirement ID that was never written, a seed silently reverted to
 * `dormant` after being absorbed — was therefore enforced only by someone choosing to run it.
 *
 * WHAT THIS FILE CATCHES: a regression in the PLANNING DATA. If a future phase breaks a
 * citation, dangles an `absorbed_by`, reverts an absorbed seed to `dormant`, or points a todo
 * at a phase that does not exist, `npm test` now goes red at the commit that did it instead of
 * whenever someone next runs the script by hand. That is the failure this file is for, and it
 * is the common one.
 *
 * KNOWN SCOPE LIMITATIONS (stated, not hedged — the repo convention, and the honest position):
 *
 * 1. THIS DOES NOT CATCH A NEUTERED CHECKER. Asserting a checker exits 0 on good data cannot
 *    detect a checker that can no longer go red. Phase 128's mutation gate demonstrated this
 *    concretely: flipping `process.exit(1)` to `process.exit(0)` on a failure branch of any of
 *    the three scripts produces a fully silent pass on a real, live defect — and this file
 *    would still be green, because good data produces exit 0 either way. Closing that would
 *    require each checker to be runnable against a fixture root, which they are not (they
 *    derive their own repo root from their own path). The one red-direction assertion that IS
 *    available without that refactor is exercised below (`open-todos.mjs` accepts an argv
 *    scope list, so a scope matching nothing must trip its zero-population guard). The other
 *    two scripts take no arguments and get no red-direction coverage here. That asymmetry is
 *    real; it is recorded rather than papered over.
 *
 * 2. GREEN HERE IS NOT "THE PLANNING DOCS ARE TRUE". These checkers are structural. They prove
 *    a cited path resolves and a cited line exists — never that the cited line says what the
 *    verdict claims. `open-todos.mjs`'s own header carries the sharper version of this: every
 *    Re-derivation section closes with a boilerplate `.planning/REQUIREMENTS.md:NNN`
 *    self-citation that always resolves, so breaking the real code citation alone does not go
 *    red there. Separating supporting evidence from bookkeeping needs semantics, not a path
 *    rule.
 *
 * 3. THE CHECKER SET IS DISCOVERED, NOT ENUMERATED. This file globs `checks/*.mjs` rather than
 *    listing three filenames, so a fourth checker added later is picked up automatically. The
 *    trade is that a checker DELETED later silently reduces coverage — which is why the count
 *    assertion below has a floor rather than only checking "each found script passes".
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const PHASE_SLUG = "128-planning-reconciliation";

/**
 * Resolve the phase directory in BOTH the active and the archived location.
 *
 * Mirrors `tokenSweep.ratchet.test.ts`'s helper deliberately. A milestone close moves
 * `.planning/phases/<slug>` to `.planning/milestones/vX.Y-phases/<slug>`; that is a NORMAL
 * recurring event, and hardcoding the active path is what sent the token ratchet red for a
 * reason unrelated to tokens when v15.0 closed.
 *
 * Throws with every attempted path if none exists. A silently-missing checks directory would
 * make this whole file pass VACUOUSLY, which is precisely the shape of failure it exists to
 * prevent.
 */
function resolvePhaseDir(): string {
  const candidates = [
    join(REPO_ROOT, ".planning/phases", PHASE_SLUG),
    ...(existsSync(join(REPO_ROOT, ".planning/milestones"))
      ? readdirSync(join(REPO_ROOT, ".planning/milestones"))
          .filter((d) => d.endsWith("-phases"))
          .map((d) => join(REPO_ROOT, ".planning/milestones", d, PHASE_SLUG))
      : []),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "planningChecks ratchet: phase dir " +
        PHASE_SLUG +
        " not found. Tried: " +
        candidates.join(", ")
    );
  }
  return found;
}

const CHECKS_DIR = join(resolvePhaseDir(), "checks");

function checkerScripts(): string[] {
  if (!existsSync(CHECKS_DIR)) {
    throw new Error(`planningChecks ratchet: checks dir not found at ${CHECKS_DIR}`);
  }
  return readdirSync(CHECKS_DIR)
    .filter((f) => f.endsWith(".mjs"))
    .sort();
}

/** Runs a checker and returns its exit code plus combined output. Never throws on non-zero. */
function runChecker(script: string, args: string[] = []): { code: number; output: string } {
  try {
    const output = execFileSync("node", [join(CHECKS_DIR, script), ...args], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

const SCRIPTS = checkerScripts();

describe("Phase 128 planning-integrity checkers", () => {
  it("discovers the checker population (non-zero control)", () => {
    // A floor, not an equality: a fourth checker is welcome, a deleted one is not silent.
    // Without this, a checks dir emptied by a bad merge would make every test below vacuous
    // by producing zero `it.each` cases rather than a failure.
    expect(SCRIPTS.length).toBeGreaterThanOrEqual(3);
    expect(SCRIPTS).toContain("closed-todos.mjs");
    expect(SCRIPTS).toContain("open-todos.mjs");
    expect(SCRIPTS).toContain("seed-status.mjs");
  });

  it.each(SCRIPTS)("%s passes against the live .planning tree", (script) => {
    const { code, output } = runChecker(script);
    expect(code, `${script} failed:\n${output}`).toBe(0);
  });

  /**
   * The single red-direction assertion available without refactoring the checkers to accept a
   * fixture root (see limitation 1 in this file's header). `open-todos.mjs` takes an argv scope
   * list; a scope matching no pending todo drives its in-scope population to zero, which must
   * be FATAL rather than a green "checked (in scope): 0 ... PASS".
   *
   * This case is not hypothetical: before Phase 128's mutation gate, that exact invocation
   * printed PASS and exited 0. Keeping it here means a future edit that removes the guard is
   * caught by the suite rather than by the next adversarial review.
   */
  it("open-todos.mjs fails loudly when its in-scope population is empty", () => {
    const { code, output } = runChecker("open-todos.mjs", ["no-such-todo-file-xyz.md"]);
    expect(code, `expected non-zero exit, got ${code}. Output:\n${output}`).not.toBe(0);
    expect(output).toMatch(/in-scope population is zero/i);
  });
});
