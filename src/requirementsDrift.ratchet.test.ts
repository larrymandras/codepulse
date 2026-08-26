/**
 * REQUIREMENTS-vs-ROADMAP drift ratchet.
 *
 * WHY THIS IS A TEST AND NOT A NOTE.
 *
 * At milestone v15.0's close (2026-08-26) the planning documents had decayed badly
 * and nobody had noticed:
 *
 *   - 8 requirements still read `Pending` while their phases were marked Complete
 *     in ROADMAP.md — and Phase 126 had been deployed and verified on live data the
 *     day before.
 *   - 3 of 4 `Partial` cells were stale notes describing work that had already landed.
 *   - 6 of 9 carried-forward v14.0 items were wrong: 4 already done, 2 describing
 *     blockers that had since been solved.
 *
 * Every one was resolved by READING THE CODE, which means the information was
 * available the whole time and simply nobody re-derived it. The lesson was written
 * into the retrospective, into CLAUDE.md, and into the vault project note — three
 * places. A rule written down three times has already failed as a rule.
 *
 * So this is the mechanism instead. The specific contradiction that bit us is
 * mechanically detectable: a requirement mapped to a phase that ROADMAP.md marks
 * `Complete` must not still say `Pending`. Two files in the repo disagree, and a
 * test can say so on every `npm test` and every CI run.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not police `Partial`. A Partial with a
 * recorded reason is a legitimate, deliberate disposition (POLISH-04, SIGNAL-01 and
 * JANITOR-02 all were). Forcing those green is the `phase.complete` false-green
 * failure mode in a different costume. Only `Pending`-on-Complete is unambiguous.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const PLANNING = join(REPO_ROOT, ".planning");

/** `| JANITOR-01 | Phase 127 | Complete — ... |` */
const REQ_ROW = /^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|\s*Phase\s+(\d+)\s*\|\s*([A-Za-z]+)/;

/** `| 127. Ack-Aware Retention Janitors | v15.0 | 8/8 | Complete | ... |` */
const PHASE_ROW = /^\|\s*(\d+)\.\s[^|]*\|[^|]*\|[^|]*\|\s*([A-Za-z ]+?)\s*\|/;

function requirementFiles(): string[] {
  const files: string[] = [];
  const live = join(PLANNING, "REQUIREMENTS.md");
  if (existsSync(live)) files.push(live);

  // A milestone close archives the section to milestones/vX.Y-REQUIREMENTS.md.
  // Checking only the live file would make this ratchet pass VACUOUSLY the moment
  // a milestone ships — the exact shape of guard this repo keeps getting bitten by.
  const milestones = join(PLANNING, "milestones");
  if (existsSync(milestones)) {
    for (const name of readdirSync(milestones)) {
      if (name.endsWith("-REQUIREMENTS.md")) files.push(join(milestones, name));
    }
  }
  return files;
}

interface Req {
  id: string;
  phase: number;
  status: string;
  file: string;
}

function collectRequirements(): Req[] {
  const out: Req[] = [];
  for (const f of requirementFiles()) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = REQ_ROW.exec(line.trim());
      if (m) out.push({ id: m[1], phase: Number(m[2]), status: m[3], file: f });
    }
  }
  return out;
}

function collectPhaseStatus(): Map<number, string> {
  const map = new Map<number, string>();
  const roadmap = join(PLANNING, "ROADMAP.md");
  if (!existsSync(roadmap)) return map;
  for (const line of readFileSync(roadmap, "utf8").split("\n")) {
    const m = PHASE_ROW.exec(line.trim());
    if (m) map.set(Number(m[1]), m[2].trim());
  }
  return map;
}

describe("planning drift ratchet — REQUIREMENTS.md must not contradict ROADMAP.md", () => {
  const reqs = collectRequirements();
  const phases = collectPhaseStatus();

  it("the ratchet can actually fire — it found requirements and phase statuses to compare", () => {
    // A guard that examines nothing is indistinguishable from a guard that passes.
    // Both halves of the join must be non-empty or every assertion below is vacuous.
    expect(reqs.length).toBeGreaterThan(0);
    expect(phases.size).toBeGreaterThan(0);

    const joinable = reqs.filter((r) => phases.has(r.phase));
    expect(
      joinable.length,
      `parsed ${reqs.length} requirement rows and ${phases.size} phase rows, but NONE joined — ` +
        `the row formats have probably drifted apart and this ratchet is checking nothing`
    ).toBeGreaterThan(0);
  });

  it("no requirement sits at Pending while its phase is marked Complete", () => {
    const offenders = reqs
      .filter((r) => phases.get(r.phase) === "Complete")
      .filter((r) => r.status.toLowerCase() === "pending")
      .map((r) => `${r.id} (Phase ${r.phase}) is 'Pending' but Phase ${r.phase} is 'Complete'`);

    expect(
      offenders,
      "A requirement cannot be Pending on a phase that shipped. Re-derive its status from the " +
        "CODE and set it to Complete or Partial-with-a-reason. Do NOT mass-flip to Complete — " +
        "that is the phase.complete false-green this repo has been bitten by. Offenders:\n  " +
        offenders.join("\n  ")
    ).toEqual([]);
  });

  it("every requirement's phase exists in the roadmap (no orphan mappings)", () => {
    const orphans = reqs
      .filter((r) => !phases.has(r.phase))
      .map((r) => `${r.id} -> Phase ${r.phase} (no such phase row in ROADMAP.md)`);

    // Archived milestones can predate the current ROADMAP progress-table format, so
    // this is reported as a soft signal rather than a hard gate: it fails only if
    // EVERY requirement is orphaned, which means the parser broke, not the docs.
    expect(
      orphans.length,
      `all ${reqs.length} requirements are orphaned — PHASE_ROW almost certainly stopped ` +
        `matching ROADMAP.md's format:\n  ${orphans.slice(0, 5).join("\n  ")}`
    ).toBeLessThan(reqs.length);
  });
});
