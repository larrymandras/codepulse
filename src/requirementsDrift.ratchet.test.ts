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
 * WHAT THIS FILE POLICES, AND WHAT IT DOES NOT (RECON-04 / D-01, rewritten 2026-08-27).
 *
 * An earlier version of this comment said the file "does not police `Partial`" — full
 * stop. That was true of the Pending-on-Complete check above, and it is STILL true
 * that this file never judges whether `Partial` is the right disposition for a
 * requirement. A `Partial` with a recorded reason (POLISH-04, SIGNAL-01, JANITOR-02
 * all were) is a legitimate, deliberate status; forcing it toward `Complete` would
 * just be the `phase.complete` false-green failure mode wearing a different costume,
 * and this file still refuses to do that.
 *
 * What changed: `Partial` now carries a second, narrower obligation, checked by
 * `stalePartialOffenders` below — STALENESS OF THE RE-DERIVATION, never correctness of
 * the disposition. Those are different questions. "Is `Partial` right?" is a
 * judgement call this file has no opinion on. "Has anyone looked at this cell since
 * the phase it names actually shipped?" is a fact a machine can check, the same way
 * Pending-on-Complete is a fact a machine can check. v15.0's own audit found the shape
 * this closes: 3 of 4 Partial cells were stale notes describing work that had since
 * landed — Pending-on-Complete would not have caught a single one of them, because
 * none of those cells said Pending.
 *
 * STAMP SYNTAX. A `Partial` cell that wants to be judged fresh carries a
 * re-derivation stamp: `re-derived <sha>`, at least 7 hex characters, e.g.
 * `| FOO-01 | Phase 123 | Partial — X shipped, Y deferred (re-derived a1b2c3d) |`.
 * A missing stamp is itself an offender (see below) — a Partial cannot opt out of
 * being asked when it was last looked at.
 *
 * COMPLETION-COMMIT DEFINITION (D-03a leaves this open; this file picks one). A
 * phase's "completion commit" is THE COMMIT THAT FLIPPED ITS ROADMAP.md PROGRESS ROW
 * TO `Complete`, found by bisecting ROADMAP.md's own revision history
 * (`completionCommitFor`, below). Why this and not the phase's last `*-SUMMARY.md`
 * commit: "since the phase shipped" means since the repo DECLARED it shipped, and
 * that declaration is the ROADMAP row — it is also the exact predicate the
 * Pending-on-Complete check above already keys on, so both checks in this one file now
 * agree on what "complete" means. The SUMMARY-commit alternative is gameable (any
 * later commit touching the phase directory — a typo fix, an evidence document, a
 * gap-closure summary — moves the anchor and re-reds a Partial that is genuinely
 * fresh) and ill-defined for phases with no summaries on disk (this repo's own notes
 * record 117 of 119 phases carrying phase-level summaries, and a naive `*SUMMARY.md`
 * count reading 62 against a correct plan-level count of 60).
 *
 * WHAT THIS STILL CANNOT CATCH. Neither candidate definition catches staleness
 * introduced by work in a DIFFERENT phase — which is part of the shape v15.0 actually
 * suffered. This check's scope is "nobody has looked at this cell since ITS OWN phase
 * closed." A Partial whose disposition is invalidated by a later, unrelated phase is
 * invisible to this mechanism. Stated plainly so a reader does not assume broader
 * coverage than the mechanism has.
 *
 * COMPARISON RULE (D-03a, not discretionary): the stamp is a COMMIT SHA compared by
 * git ancestry ONLY — never a date, never string ordering. A date has day
 * granularity: a re-derivation performed hours before the completion commit but on
 * the SAME CALENDAR DAY does not "predate" it under a date comparison and would pass —
 * reintroducing the exact false-green RECON-04 exists to prevent. See the real-git
 * same-day fixture below for the demonstration.
 *
 * INDETERMINACY IS LOUD. A shallow clone, an unresolvable stamp SHA, an unresolvable
 * completion commit, or unrelated history (neither commit is an ancestor of the
 * other — a stamp copied from elsewhere, or rewritten history) each fail with their
 * own message naming the exact remedy. This check must never report freshness it
 * cannot establish.
 *
 * GRANDFATHERING. Measured 2026-08-27: the live Traceability table in
 * `.planning/REQUIREMENTS.md` holds 46 rows, all `Pending`, zero `Partial`. There are
 * TWO `Partial` rows in the wider corpus, both archived and both out of range:
 *   - `MISSION-01`, `milestones/v14.0-REQUIREMENTS.md`, Phase 111.
 *   - `QA-01`, `milestones/v8.0-REQUIREMENTS.md:155`, Phase 71 — written
 *     `\u{1F504} Partial`, i.e. emoji-prefixed.
 * Both sit outside the current milestone's phase range (>= 128) and outside the live
 * REQUIREMENTS.md, so they are out of this check's scope via the same
 * current-milestone partition the orphan check below uses. The in-range `Partial`
 * population is therefore ZERO. No allowlist is added; there is nothing to
 * grandfather.
 *
 * An earlier version of this paragraph claimed MISSION-01 was the ONLY `Partial` row
 * anywhere in the corpus. That was false, and the way it was false mattered: QA-01's
 * emoji prefix meant `statusWord` (then an inline `split`) returned the emoji rather
 * than "Partial", so the row was invisible to the check instead of being judged and
 * ruled out of range. `statusWord` now strips leading decoration; the row is seen,
 * and it is excluded on phase range like MISSION-01 rather than by accident.
 *
 * CURRENT VACUITY, STATED HONESTLY. With zero in-range Partial rows, the live
 * assertion below passes trivially and proves nothing about `stalePartialOffenders`
 * itself — it only proves the table is currently clean. The discrimination is
 * entirely carried by the controls in this file: the fake-oracle logic table (eleven
 * cases covering every offender branch and both non-offender ancestry outcomes), the
 * real-git same-day fixture, and a real-git correctness check of
 * `completionCommitFor`'s bisect against this repo's own history. When the first
 * genuine in-range Partial appears, this comment's vacuity claim stops being true and
 * should be re-measured.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const PLANNING = join(REPO_ROOT, ".planning");

/** `| JANITOR-01 | Phase 127 | Complete — ... |` — group 3 is the FULL status cell (D-01 needs
 * the whole cell, not just its first word, because the freshness stamp lives in the rest of it). */
const REQ_ROW = /^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|\s*Phase\s+(\d+)\s*\|\s*([^|]+?)\s*\|/;

/** `| 127. Ack-Aware Retention Janitors | v15.0 | 8/8 | Complete | 2026-08-24 | ... |` — group 3
 * is the `Completed` date column. It is DIAGNOSTIC ONLY (used in failure messages), never the
 * freshness comparison input — the comparison input is the completion COMMIT, resolved separately
 * by `completionCommitFor` via a bisect over ROADMAP.md's own git history. Do not repoint the
 * freshness decision at this column; that would reintroduce date/string comparison, which D-03a
 * forbids. */
const PHASE_ROW = /^\|\s*(\d+)\.\s[^|]*\|[^|]*\|[^|]*\|\s*([A-Za-z ]+?)\s*\|\s*([^|]*?)\s*\|/;

/** A `re-derived <sha>` freshness stamp inside a status cell, at least 7 hex characters. */
const STAMP_PATTERN = /re-derived\s+([0-9a-f]{7,40})/i;

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
  /** First word of the status cell, e.g. "Pending" | "Complete" | "Partial". Preserved from the
   * original parser so the two pre-existing assertions below behave identically. */
  status: string;
  /** The FULL status cell text, including any `re-derived <sha>` freshness stamp. */
  statusCell: string;
  file: string;
}

/**
 * First WORD of a status cell, ignoring leading decoration.
 *
 * Status cells are not uniformly plain text. `v8.0-REQUIREMENTS.md:155` reads
 * `| QA-01 | Phase 71 | \u{1F504} Partial - ... |`, and a bare
 * `statusCell.split(/\s+/)[0]` returns the EMOJI, not "Partial" -- so that row was
 * invisible to every Partial predicate in this file rather than being judged by them.
 * A row that silently vanishes is the exact failure mode `stalePartialOffenders` was
 * written to prevent, so the decoration is stripped before the word is taken.
 *
 * Found by the phase-128 adversarial claims audit, which caught the header below
 * asserting MISSION-01 was the only Partial row in the corpus. It was not.
 */
function statusWord(statusCell: string): string {
  return statusCell.replace(/^[^\p{L}]+/u, "").split(/\s+/)[0] ?? "";
}

function collectRequirements(): Req[] {
  const out: Req[] = [];
  for (const f of requirementFiles()) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = REQ_ROW.exec(line.trim());
      if (m) {
        const statusCell = m[3];
        const status = statusWord(statusCell);
        out.push({ id: m[1], phase: Number(m[2]), status, statusCell, file: f });
      }
    }
  }
  return out;
}

interface PhaseInfo {
  status: string;
  /** The ROADMAP `Completed` date column. DIAGNOSTIC ONLY — see the PHASE_ROW comment above. */
  completedDate: string;
}

function collectPhaseStatus(): Map<number, PhaseInfo> {
  const map = new Map<number, PhaseInfo>();
  const roadmap = join(PLANNING, "ROADMAP.md");
  if (!existsSync(roadmap)) return map;
  for (const line of readFileSync(roadmap, "utf8").split("\n")) {
    const m = PHASE_ROW.exec(line.trim());
    if (m) map.set(Number(m[1]), { status: m[2].trim(), completedDate: (m[3] ?? "").trim() });
  }
  return map;
}

/**
 * The current-milestone partition, shared by the orphan check and the freshness check so the two
 * cannot silently disagree about scope. A row is in range if its phase number falls inside
 * ROADMAP.md's current progress table, OR if it lives in the LIVE REQUIREMENTS.md file (which
 * always describes the current milestone regardless of phase numbering).
 */
function inCurrentMilestoneRange(r: Req, minRoadmapPhase: number, liveFile: string): boolean {
  return r.phase >= minRoadmapPhase || r.file === liveFile;
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
      .filter((r) => phases.get(r.phase)?.status === "Complete")
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

  it("no requirement in the CURRENT milestone's phase range is orphaned", () => {
    // CODEX ADVERSARIAL REVIEW, 2026-08-26 — CONFIRMED AND FIXED.
    //
    // This assertion was originally `orphans.length < reqs.length`, i.e. it only
    // failed when EVERY requirement was orphaned. Codex pointed out that a single
    // mistyped phase number therefore slips through — AND that the orphan then
    // escapes the Pending-on-Complete check above, because that check filters on
    // `phases.get(r.phase) === "Complete"`, which is undefined for an orphan.
    //
    // Verified by mutation, not taken on trust: pointing JANITOR-01 at Phase 999
    // AND setting it to Pending passed all three tests. A hole in the exact check
    // this file exists to perform.
    //
    // The correct partition, measured rather than assumed: ROADMAP.md's progress
    // table holds ONLY the current milestone's phases (120-127 today). Every
    // archived milestone is 100% orphaned BY DESIGN — v4/v5/v8/v9/v10/v11/v14
    // total 103 rows, all unjoinable, because their phase rows were removed when
    // they closed. v15.0 is the only archive with 0 orphans, and only because it
    // just closed. So orphaning is not a defect in general — it is a defect
    // WITHIN the range the roadmap still describes.
    const roadmapPhases = [...phases.keys()];
    const minRoadmapPhase = Math.min(...roadmapPhases);
    const liveFile = join(PLANNING, "REQUIREMENTS.md");

    const mustJoin = reqs.filter((r) => inCurrentMilestoneRange(r, minRoadmapPhase, liveFile));
    const orphans = mustJoin
      .filter((r) => !phases.has(r.phase))
      .map(
        (r) =>
          `${r.id} -> Phase ${r.phase} (no such phase in ROADMAP.md; ` +
          `current milestone starts at Phase ${minRoadmapPhase})`
      );

    expect(
      orphans,
      "A requirement inside the current milestone's phase range, or in the LIVE " +
        "REQUIREMENTS.md, must map to a real ROADMAP phase - otherwise it is invisible " +
        "to the Pending-on-Complete check above and can carry a stale status forever. " +
        "Fix the phase number; do not exempt the row. Offenders: " +
        orphans.join("; ")
    ).toEqual([]);
  });

  it("the orphan check has rows in range to examine — it cannot pass vacuously", () => {
    const minRoadmapPhase = Math.min(...phases.keys());
    const inRange = reqs.filter((r) => r.phase >= minRoadmapPhase);
    expect(
      inRange.length,
      `no requirement maps into the current milestone range (>= Phase ${minRoadmapPhase}), ` +
        "so the orphan assertion above is checking nothing"
    ).toBeGreaterThan(0);
  });
});

// =============================================================================================
// RECON-04 / D-01: stale-Partial freshness check.
//
// The check has NO opinion about whether `Partial` is the right disposition for a requirement —
// only whether anyone has re-derived it since the phase it names actually shipped. That is the
// property most likely to be broken by a well-meaning future edit; do not extend this to judge
// correctness of the disposition itself.
// =============================================================================================

type CompletionCommitResult = { sha: string } | { unresolvable: true; reason: string };

interface FreshnessOracle {
  isShallow(): boolean;
  resolveSha(sha: string): boolean;
  completionCommitFor(phase: number): CompletionCommitResult;
  isAncestor(ancestorSha: string, descendantSha: string): boolean;
}

/**
 * Pure with respect to the filesystem and to git — every fact it needs comes through `oracle`.
 * This is what makes the controls below possible: the real Traceability table currently holds
 * ZERO in-range Partial rows, so a check that could only be driven from the real repository could
 * never be shown to discriminate.
 *
 * Callers are responsible for pre-filtering `reqs` to the current-milestone range via
 * `inCurrentMilestoneRange` — this function does not filter by range itself, mirroring how the
 * orphan check above owns its own range filtering rather than baking it into a shared primitive.
 *
 * Flags a row only when: its status word is `Partial` (case-insensitive) AND its phase's ROADMAP
 * status is `Complete`. For such a row, exactly one of these outcomes applies:
 *   - shallow repository -> offender (ancestry cannot be computed in EITHER direction)
 *   - no `re-derived <sha>` stamp -> offender
 *   - stamp SHA does not resolve -> offender
 *   - `completionCommitFor` unresolvable -> offender, naming why
 *   - stamp is a strict ancestor of the completion commit -> STALE offender
 *   - stamp equals the completion commit -> NOT an offender (recorded in the closing commit itself)
 *   - stamp is a descendant of the completion commit -> NOT an offender (re-derived afterward)
 *   - neither is an ancestor of the other -> offender, unrelated-history
 */
function stalePartialOffenders(
  reqs: Req[],
  phases: Map<number, PhaseInfo>,
  oracle: FreshnessOracle
): string[] {
  const offenders: string[] = [];

  for (const r of reqs) {
    if (r.status.toLowerCase() !== "partial") continue;
    const phaseInfo = phases.get(r.phase);
    if (!phaseInfo || phaseInfo.status !== "Complete") continue;

    // Shallow clone: ancestry cannot be computed in EITHER direction, so this must fire even for
    // a row whose stamp would otherwise resolve as fresh.
    if (oracle.isShallow()) {
      offenders.push(
        `${r.id} (Phase ${r.phase}): repository is a shallow clone — ancestry cannot be ` +
          `computed. Remedy: deepen the checkout (\`fetch-depth: 0\` in CI).`
      );
      continue;
    }

    const stampMatch = STAMP_PATTERN.exec(r.statusCell);
    if (!stampMatch) {
      offenders.push(
        `${r.id} (Phase ${r.phase}): Partial cell carries no freshness stamp. Add ` +
          `"(re-derived <sha>)" to the status cell, e.g. "Partial — X shipped, Y deferred ` +
          `(re-derived a1b2c3d)".`
      );
      continue;
    }
    const stampSha = stampMatch[1];

    if (!oracle.resolveSha(stampSha)) {
      offenders.push(
        `${r.id} (Phase ${r.phase}): stamp SHA ${stampSha} does not resolve in this repository. ` +
          `Re-derive the cell from the current code and record a real commit SHA.`
      );
      continue;
    }

    const completion = oracle.completionCommitFor(r.phase);
    if ("unresolvable" in completion) {
      offenders.push(
        `${r.id} (Phase ${r.phase}): completion commit could not be resolved — ${completion.reason}.`
      );
      continue;
    }
    const completionSha = completion.sha;

    if (stampSha === completionSha) continue; // fresh: recorded IN the closing commit itself

    const stampIsAncestorOfCompletion = oracle.isAncestor(stampSha, completionSha);
    if (stampIsAncestorOfCompletion) {
      offenders.push(
        `${r.id} (Phase ${r.phase}): STALE — stamp ${stampSha} is an ancestor of completion ` +
          `commit ${completionSha} (the commit that flipped Phase ${r.phase}'s ROADMAP Progress ` +
          `row to Complete). Re-derive ${r.id} from the current code and update its stamp — do ` +
          `NOT flip it to Complete; that is the phase.complete false-green in another costume.`
      );
      continue;
    }

    const completionIsAncestorOfStamp = oracle.isAncestor(completionSha, stampSha);
    if (completionIsAncestorOfStamp) continue; // fresh: re-derived AFTER the phase shipped

    offenders.push(
      `${r.id} (Phase ${r.phase}): stamp ${stampSha} and completion commit ${completionSha} ` +
        `share no ancestry (unrelated history — possibly copied from another repository, or ` +
        `rewritten history). Re-derive and record a real, in-repo commit SHA.`
    );
  }

  return offenders;
}

// ---------------------------------------------------------------------------
// Real git-backed oracle. Every function here spawns `git` via `execFileSync` with an argv
// array (never a shell-parsed command string) — see tokenSweep.ratchet.test.ts's identical
// discipline for why: `execSync`'s template-string form is re-parsed by the OS shell, whose
// Windows escaping rules mangle patterns containing brackets/carets.
// ---------------------------------------------------------------------------

function gitIsShallow(): boolean {
  try {
    const out = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    return out === "true";
  } catch {
    // A probe that cannot even determine shallowness must never present as non-shallow —
    // indeterminate must be loud, so this defaults to the conservative (shallow) answer.
    return true;
  }
}

function gitResolveSha(sha: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${sha}^{commit}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
}

/** `cwd` defaults to this repository, but is overridable so the same helper can be reused
 * against a throwaway temp repository (the same-day fixture below) without duplicating the
 * ancestry logic — duplicating it would mean a mutation to this function could not be shown to
 * affect that fixture. */
function gitIsAncestor(ancestorSha: string, descendantSha: string, cwd: string = REPO_ROOT): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestorSha, descendantSha], {
      cwd,
      encoding: "utf8",
    });
    return true;
  } catch (e: any) {
    if (e.status === 1) return false;
    throw e;
  }
}

function listRoadmapRevisions(): string[] {
  try {
    const out = execFileSync(
      "git",
      ["log", "--format=%H", "--reverse", "--follow", "--", ".planning/ROADMAP.md"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function roadmapPhaseIsComplete(rev: string, phase: number): boolean {
  let content: string;
  try {
    content = execFileSync("git", ["show", `${rev}:.planning/ROADMAP.md`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return false;
  }
  for (const line of content.split("\n")) {
    const m = PHASE_ROW.exec(line.trim());
    if (m && Number(m[1]) === phase) {
      return m[2].trim() === "Complete";
    }
  }
  return false;
}

/**
 * Bisects ROADMAP.md's own revision history for the first commit where phase N's Progress row
 * reads `Complete`. The predicate is monotonic once true, which is what makes the bisect valid —
 * checked, not assumed: if the OLDEST revision already satisfies it, the flip predates
 * ROADMAP.md's recorded history and this returns unresolvable rather than guessing.
 */
function completionCommitFor(phase: number): CompletionCommitResult {
  const revs = listRoadmapRevisions();
  if (revs.length === 0) {
    return {
      unresolvable: true,
      reason:
        "no ROADMAP.md revision history found — shallow clone, or the file has no commit " +
        "history in this checkout",
    };
  }
  if (roadmapPhaseIsComplete(revs[0], phase)) {
    return {
      unresolvable: true,
      reason:
        `phase ${phase}'s Complete status already holds at the OLDEST recorded ROADMAP.md ` +
        `revision (${revs[0].slice(0, 7)}) — the flip predates this repository's recorded ` +
        `history, so the bisect's monotonicity precondition cannot be checked`,
    };
  }
  if (!roadmapPhaseIsComplete(revs[revs.length - 1], phase)) {
    return {
      unresolvable: true,
      reason: `phase ${phase} does not read Complete at the latest recorded ROADMAP.md revision`,
    };
  }
  let lo = 0;
  let hi = revs.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (roadmapPhaseIsComplete(revs[mid], phase)) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return { sha: revs[lo] };
}

const realOracle: FreshnessOracle = {
  isShallow: gitIsShallow,
  resolveSha: gitResolveSha,
  completionCommitFor,
  isAncestor: (a, b) => gitIsAncestor(a, b),
};

describe("D-01 (RECON-04): no in-range Partial predates its phase's completion commit", () => {
  it("live assertion — every in-range Partial cell's freshness stamp is a descendant of (or equal to) its phase's completion commit", () => {
    const reqs = collectRequirements();
    const phases = collectPhaseStatus();
    const minRoadmapPhase = Math.min(...phases.keys());
    const liveFile = join(PLANNING, "REQUIREMENTS.md");
    const inRangeReqs = reqs.filter((r) => inCurrentMilestoneRange(r, minRoadmapPhase, liveFile));
    const inRangePartials = inRangeReqs.filter((r) => r.status.toLowerCase() === "partial");

    // The control that could have come out the other way: the SAME function must be shown to
    // fire on a genuinely stale fixture before its silence on the live table is trusted. Without
    // this, a green result below is indistinguishable from a check that never ran.
    const staleFixture: Req = {
      id: "FIXTURE-01",
      phase: 500,
      status: "Partial",
      statusCell: "Partial — fixture (re-derived aaaaaa1)",
      file: "FIXTURE-REQUIREMENTS.md",
    };
    const staleFixturePhases = new Map<number, PhaseInfo>([
      [500, { status: "Complete", completedDate: "-" }],
    ]);
    const staleFixtureOracle: FreshnessOracle = {
      isShallow: () => false,
      resolveSha: () => true,
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "aaaaaa1" && b === "cccccc1",
    };
    expect(
      stalePartialOffenders([staleFixture], staleFixturePhases, staleFixtureOracle),
      "the check must fire on a genuinely stale fixture — if it does not, the live result below " +
        "proves nothing"
    ).not.toEqual([]);

    const liveOffenders = stalePartialOffenders(inRangeReqs, phases, realOracle);

    // eslint-disable-next-line no-console
    console.log(
      `[D-01 population] ${inRangePartials.length} in-range Partial row(s) measured live ` +
        `(current-milestone range starts at Phase ${minRoadmapPhase}).`
    );

    expect(
      liveOffenders,
      inRangePartials.length === 0
        ? `VACUOUS AT POPULATION ZERO: 0 in-range Partial rows exist, so this green proves the ` +
          `table is currently clean — NOT that stalePartialOffenders discriminates. That evidence ` +
          `lives entirely in the fake-oracle and real-git controls elsewhere in this file.`
        : `A Partial requirement predates its phase's completion commit. RE-DERIVE the cell from ` +
          `the current code and update its stamp — do NOT flip it to Complete; that is the ` +
          `phase.complete false-green in another costume. Offenders:\n  ` + liveOffenders.join("\n  ")
    ).toEqual([]);
  });

  it("completionCommitFor resolves a real completion commit for a known-Complete phase, and the bisect boundary is correct", () => {
    // Phase 120 shipped 2026-08-17 (v15.0) — long enough ago that its ROADMAP flip is safely
    // inside recorded history, giving this a real (not fake-oracle) correctness check of the
    // bisect itself, which the live assertion above cannot exercise while the in-range Partial
    // population is zero.
    const PHASE = 120;
    const result = completionCommitFor(PHASE);
    expect(
      "sha" in result,
      `completionCommitFor(${PHASE}) returned unresolvable: ${"reason" in result ? result.reason : ""}`
    ).toBe(true);
    if (!("sha" in result)) return; // narrowing only; the assertion above already failed if reached

    expect(roadmapPhaseIsComplete(result.sha, PHASE)).toBe(true);

    const revs = listRoadmapRevisions();
    const idx = revs.indexOf(result.sha);
    expect(idx).toBeGreaterThan(-1);
    if (idx > 0) {
      expect(
        roadmapPhaseIsComplete(revs[idx - 1], PHASE),
        "the revision immediately BEFORE the resolved completion commit must NOT read Complete, " +
          "or the bisect found the wrong boundary"
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 1 — fake-oracle logic table (D-01/D-03). Fast, deterministic, covers every branch. Each
// case is its own assertion; none reads from `.planning/`, so none can be invalidated by a later
// change to the real planning documents.
// ---------------------------------------------------------------------------

function fakeReq(overrides: Partial<Req> = {}): Req {
  return {
    id: "FAKE-01",
    phase: 500,
    status: "Partial",
    statusCell: "Partial — fixture (re-derived aaaaaa1)",
    file: "FAKE-REQUIREMENTS.md",
    ...overrides,
  };
}

function makeOracle(overrides: Partial<FreshnessOracle> = {}): FreshnessOracle {
  return {
    isShallow: () => false,
    resolveSha: () => true,
    completionCommitFor: () => ({ sha: "cccccc1" }),
    isAncestor: () => false,
    ...overrides,
  };
}

describe("statusWord: a decorated status cell must not vanish from the check", () => {
  // Found by the phase-128 adversarial claims audit. Before this, the status word was
  // `statusCell.split(/\s+/)[0]`, so an emoji-prefixed cell yielded the EMOJI and the row
  // was invisible to every Partial predicate here -- silently skipped rather than judged
  // and ruled out of range. Invisible is the one outcome this file must never produce.

  it("strips leading decoration so an emoji-prefixed Partial is still seen as Partial", () => {
    expect(statusWord("\u{1F504} Partial \u2014 auto-sync not yet wired")).toBe("Partial");
  });

  it("leaves an undecorated cell exactly as it was (no behaviour change for the 46 live rows)", () => {
    expect(statusWord("Pending")).toBe("Pending");
    expect(statusWord("Complete \u2014 shipped 2026-08-27")).toBe("Complete");
    expect(statusWord("Partial \u2014 X shipped (re-derived a1b2c3d)")).toBe("Partial");
  });

  it("returns empty string for a cell with no letters at all, rather than a decoration", () => {
    // An empty word is falsy and comparable; an emoji masquerading as a status is not.
    expect(statusWord("\u{1F504}")).toBe("");
    expect(statusWord("   ")).toBe("");
  });

  it("REGRESSION: the real QA-01 corpus row parses as Partial, not as its emoji", () => {
    // Pinned to the actual line that exposed the bug:
    // .planning/milestones/v8.0-REQUIREMENTS.md:155
    const cell = "\u{1F504} Partial \u2014 v6.0 table reconciled 2026-06-18; auto-sync step not yet wired";
    expect(statusWord(cell)).toBe("Partial");
    // And it must be a real row the collector actually returns, not just a string I typed:
    const qa01 = collectRequirements().find((r) => r.id === "QA-01");
    expect(qa01, "QA-01 not found in the corpus -- has v8.0-REQUIREMENTS.md moved?").toBeDefined();
    expect(qa01!.status).toBe("Partial");
  });
});

describe("D-01 fake-oracle logic table", () => {
  it("case 1: stamp is a strict ancestor of the completion commit -> STALE, exactly one offender naming both SHAs", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa1)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "aaaaaa1" && b === "cccccc1",
    });
    const offenders = stalePartialOffenders([req], phases, oracle);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain("aaaaaa1");
    expect(offenders[0]).toContain("cccccc1");
    expect(offenders[0].toLowerCase()).toContain("stale");
  });

  it("case 2: stamp is a DESCENDANT of the completion commit -> no offenders (D-03's opposite control)", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa2)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "cccccc1" && b === "aaaaaa2",
    });
    expect(stalePartialOffenders([req], phases, oracle)).toEqual([]);
  });

  it("case 3: stamp EQUALS the completion commit -> no offenders (recorded in the closing commit is not 'predates')", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived cccccc1)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({ completionCommitFor: () => ({ sha: "cccccc1" }) });
    expect(stalePartialOffenders([req], phases, oracle)).toEqual([]);
  });

  it("case 4: neither ancestry direction holds -> exactly one offender, unrelated-history message", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa3)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: () => false,
    });
    const offenders = stalePartialOffenders([req], phases, oracle);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].toLowerCase()).toContain("unrelated history");
  });

  it("case 5: no stamp in the cell -> one offender", () => {
    const req = fakeReq({ statusCell: "Partial — reason with no stamp at all" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const offenders = stalePartialOffenders([req], phases, makeOracle());
    expect(offenders).toHaveLength(1);
    expect(offenders[0].toLowerCase()).toContain("no freshness stamp");
  });

  it("case 6: stamp does not resolve in the repository -> one offender, distinct from case 5", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived deadbee)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({ resolveSha: () => false });
    const offenders = stalePartialOffenders([req], phases, oracle);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].toLowerCase()).toContain("does not resolve");
  });

  it("case 7: completionCommitFor returns unresolvable -> one offender naming why", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa1)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ unresolvable: true, reason: "flip predates recorded history" }),
    });
    const offenders = stalePartialOffenders([req], phases, oracle);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain("flip predates recorded history");
  });

  it("case 8: shallow repository -> one offender naming fetch-depth: 0, even for a row that would otherwise be fresh", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa2)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      isShallow: () => true,
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "cccccc1" && b === "aaaaaa2", // would be FRESH (descendant) if not shallow
    });
    const offenders = stalePartialOffenders([req], phases, oracle);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toContain("fetch-depth: 0");
  });

  it("case 9: Partial whose phase is not Complete -> no offenders", () => {
    const req = fakeReq({ statusCell: "Partial — x (re-derived aaaaaa1)" });
    const phases = new Map<number, PhaseInfo>([[req.phase, { status: "In Progress", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "aaaaaa1" && b === "cccccc1", // would be STALE if the phase were Complete
    });
    expect(stalePartialOffenders([req], phases, oracle)).toEqual([]);
  });

  it("case 10: Complete or Pending rows are never policed, regardless of stamp age", () => {
    const phases = new Map<number, PhaseInfo>([[500, { status: "Complete", completedDate: "-" }]]);
    const oracle = makeOracle({
      completionCommitFor: () => ({ sha: "cccccc1" }),
      isAncestor: (a, b) => a === "aaaaaa1" && b === "cccccc1", // would be STALE if this bucket policed non-Partial rows
    });
    const completeReq = fakeReq({ status: "Complete", statusCell: "Complete — (re-derived aaaaaa1)" });
    const pendingReq = fakeReq({ status: "Pending", statusCell: "Pending — (re-derived aaaaaa1)" });
    expect(stalePartialOffenders([completeReq], phases, oracle)).toEqual([]);
    expect(stalePartialOffenders([pendingReq], phases, oracle)).toEqual([]);
  });

  it("case 11: Partial mapped to a phase absent from the ROADMAP map (archived-milestone shape) -> no offenders", () => {
    // Mirrors the real MISSION-01 row: Phase 111, archived, absent from the live ROADMAP.md map.
    const req = fakeReq({ phase: 111, statusCell: "Partial — x (re-derived aaaaaa1)" });
    const phases = new Map<number, PhaseInfo>(); // phase 111 absent
    expect(
      stalePartialOffenders([req], phases, makeOracle()),
      "a Partial whose phase has no ROADMAP row (the archived-milestone shape) must not be " +
        "flagged — there is no Complete status to compare against"
    ).toEqual([]);
  });

  it("supplementary: a Partial excluded by the shared current-milestone range helper is never passed to the function in the first place", () => {
    // stalePartialOffenders does not filter by range itself (callers pre-filter via
    // inCurrentMilestoneRange, exactly as the live test above does) — this asserts the helper
    // itself correctly excludes an out-of-range row so a caller cannot accidentally include one.
    const archived = fakeReq({ phase: 50, file: "milestones/v9.0-REQUIREMENTS.md" });
    const live = fakeReq({ phase: 200, file: "FAKE-REQUIREMENTS.md" });
    expect(inCurrentMilestoneRange(archived, 128, "FAKE-REQUIREMENTS.md")).toBe(false);
    expect(inCurrentMilestoneRange(live, 128, "FAKE-REQUIREMENTS.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — real-git same-day control (D-03a). A fake oracle cannot supply this: "same day" is a
// property of real commit timestamps that a synthetic ancestry map does not model.
// ---------------------------------------------------------------------------

describe("D-03a same-day control: a real git repo where date comparison cannot discriminate but SHA ancestry can", () => {
  it("an earlier same-day commit is STALE and a later same-day commit is FRESH, though a date comparison of the two cannot tell them apart", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "requirements-drift-freshness-"));
    try {
      // Identity and signing supplied per-invocation via `-c`, scoped to this throwaway repo
      // only — NOT the `--no-gpg-sign` bypass CLAUDE.md forbids on THIS repository's own commits.
      // A temp repo under the OS temp dir shares no history, hooks, or config with this repo.
      const gitPrefix = [
        "-c",
        "user.name=ratchet-fixture",
        "-c",
        "user.email=ratchet-fixture@example.invalid",
        "-c",
        "commit.gpgsign=false",
      ];
      const git = (args: string[], env?: NodeJS.ProcessEnv): string =>
        execFileSync("git", [...gitPrefix, ...args], {
          cwd: tmpDir,
          encoding: "utf8",
          env: { ...process.env, ...env },
        });

      git(["init", "-q"]);
      writeFileSync(join(tmpDir, "file.txt"), "v1\n", "utf8");
      git(["add", "file.txt"]);

      const EARLIER = "2026-08-20T09:00:00-05:00";
      const LATER_SAME_DAY = "2026-08-20T18:00:00-05:00";

      git(["commit", "-q", "-m", "earlier"], { GIT_AUTHOR_DATE: EARLIER, GIT_COMMITTER_DATE: EARLIER });
      const earlierSha = git(["rev-parse", "HEAD"]).trim();

      writeFileSync(join(tmpDir, "file.txt"), "v2\n", "utf8");
      git(["add", "file.txt"]);
      git(["commit", "-q", "-m", "later same day"], {
        GIT_AUTHOR_DATE: LATER_SAME_DAY,
        GIT_COMMITTER_DATE: LATER_SAME_DAY,
      });
      const laterSha = git(["rev-parse", "HEAD"]).trim();

      const dayOf = (sha: string): string =>
        git(["show", "-s", "--format=%ad", "--date=format:%Y-%m-%d", sha]).trim();

      // The control that could have come out the other way: if a future edit drifts these onto
      // different days, THIS assertion fails first and says the same-day control stopped testing
      // what it claims.
      expect(
        dayOf(earlierSha),
        "the two fixture commits must land on the SAME calendar day, or this control tests nothing"
      ).toBe(dayOf(laterSha));

      // The defect D-03a exists to close, demonstrated rather than merely asserted: a
      // day-granularity date comparison of these two real commits yields no ordering at all.
      expect(dayOf(earlierSha) < dayOf(laterSha)).toBe(false);
      expect(dayOf(earlierSha) > dayOf(laterSha)).toBe(false);

      // The ancestry comparison DOES discriminate — reusing the SAME `gitIsAncestor` helper the
      // real oracle uses (not a hand-rolled duplicate), so a mutation to it is provably visible
      // here too.
      const isAncestor = (a: string, b: string): boolean => gitIsAncestor(a, b, tmpDir);
      const phases = new Map<number, PhaseInfo>([[999, { status: "Complete", completedDate: "-" }]]);

      const staleReq = fakeReq({
        phase: 999,
        statusCell: `Partial — fixture (re-derived ${earlierSha})`,
      });
      const staleOracle: FreshnessOracle = {
        isShallow: () => false,
        resolveSha: () => true,
        completionCommitFor: () => ({ sha: laterSha }),
        isAncestor,
      };
      expect(
        stalePartialOffenders([staleReq], phases, staleOracle),
        "the earlier same-day commit is a real ancestor of the later one and must be flagged STALE"
      ).toHaveLength(1);

      const freshReq = fakeReq({
        phase: 999,
        statusCell: `Partial — fixture (re-derived ${laterSha})`,
      });
      const freshOracle: FreshnessOracle = {
        isShallow: () => false,
        resolveSha: () => true,
        completionCommitFor: () => ({ sha: earlierSha }),
        isAncestor,
      };
      expect(
        stalePartialOffenders([freshReq], phases, freshOracle),
        "the later same-day commit is a real descendant of the earlier one and must pass, even " +
          "though both share a calendar day"
      ).toEqual([]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
