/**
 * tokenSweep.ratchet.test.ts — D-25/D-26 corpus-derived ratchet that makes Phase 122's token
 * sweep permanent.
 *
 * DERIVATION STRATEGY: every bucket below re-derives its own population by running
 * `git grep --untracked` against `src/` AT TEST TIME (via `child_process.execSync`) — no bucket
 * contains a hardcoded list of today's known-clean or known-bad files. `--untracked` is
 * deliberate: without it, `git grep` only searches files already tracked by git, so a brand-new
 * violating file that has not yet been `git add`ed would be invisible to this ratchet even though
 * it is exactly the "file nobody wrote down" case D-25 exists to catch (verified live in this
 * session: an untracked probe file was invisible to a bare `git grep` and visible only with
 * `--untracked`). The only per-file exceptions are `KNOWN_EXEMPT` (below) — a frozen, dated,
 * ledger-traceable record, never a blessing — and test files (`*.test.*`), excluded uniformly
 * across every bucket, stated here rather than left implicit.
 *
 * WHY THIS EXISTS (D-25): Phase 120's third surviving `animate-pulse` site was missed precisely
 * because it appeared in no triage document, and both earlier passes re-checked only the sites
 * already recorded. An enumerated list of known-clean files can only ratify the last fix — it was
 * explicitly rejected for that reason. This file proves its own corpus-derivation by re-deriving
 * the population fresh every run and, in the mutation-b test below, by failing on a violation in a
 * file that appears on no list anywhere in this repo.
 *
 * KNOWN SCOPE LIMITATIONS (stated, not hedged — 122-17-PLAN.md requires each be named explicitly):
 *
 * 1. SHADOWS ARE OUTSIDE EVERY BUCKET. Every bucket pattern requires a `bg-`/`text-`/`border-`/
 *    `from-`/`to-`/`via-` Tailwind class prefix. A bare `rgba(...)` inside an arbitrary
 *    `shadow-[...]` value is not matched by any of them. `SwarmTaskNode.tsx`'s deliberate
 *    `shadow-[0_4px_20px_rgba(139,92,246,0.25)]` violet state-identity glow (commented
 *    `// violet -- state identity color, exempt` in the source, per 122-06-LEDGER.md) survives
 *    this ratchet by construction, not by an exemption entry — there is nothing here that could
 *    see it.
 *
 * 2. TAILWIND'S BUILD SCANS BEYOND `src/`; THIS RATCHET'S CORPUS DOES NOT. `src/index.css` carries
 *    `@source not "../.planning"` (an exclusion, not an inclusion list) — Tailwind's default scan
 *    root is the whole repo minus that one exclusion, so `scripts/migrate_tokens.py`'s string
 *    literals (e.g. `"bg-gray-950/50"`, confirmed present at `scripts/migrate_tokens.py:24` at the
 *    time this file was written) compile into the PRODUCTION stylesheet even though this ratchet
 *    never scans `scripts/`. A corpus scope of `src/` alone is therefore not equal to what ships.
 *
 * 3. `index.html` IS NOT UNDER `src/` AND HOLDS THE WIDEST SURFACE IN THE APP (the pre-paint
 *    theme script, the root `<body>` classes). It is out of this ratchet's declared `-- src`
 *    scope. (Read live at the time this file was written: `index.html` currently carries no
 *    palette/hex/duration/violet literal — but that is a fact about today's corpus, not a
 *    guarantee this ratchet enforces; a regression there would not be caught here.)
 *
 * 4. THE STATE-HONESTY BUCKET (bare `Loading` text, em-dash value-slot placeholders) CANNOT FULLY
 *    DISCRIMINATE by regex alone — narrowed accordingly rather than shipped noisy (122-CONTEXT.md's
 *    own instruction: "a ratchet with false positives gets muted, which is worse than not having
 *    one"). It matches only two precise shapes: a quoted string literal that is *exactly* an em
 *    dash (`"—"`, in any operator position -- `?? "—"`, `: "—"`, a ternary's true branch, a
 *    template-literal interpolation slot) and a bare JSX text node holding *only* an em dash
 *    (`>—<`, no surrounding text). Comment lines (`//`, `/*`, a JSDoc `*` continuation, checked
 *    after trimming leading whitespace) are excluded so prose that merely *mentions* an em dash
 *    -- including this file's own such mentions -- is not flagged; this was verified live against
 *    `src/components/chat/RadialGauge.tsx:11`, a JSDoc sentence quoting `"—"` in prose, which the
 *    comment filter correctly excludes. What this bucket does NOT catch: an em dash rendered
 *    alongside other text in the same JSX text node (e.g. `<span>value: —</span>`) or a value-slot
 *    placeholder using a different character entirely. Narrower-but-honest, per the plan's explicit
 *    instruction, rather than a broader pattern that cries wolf.
 *
 * MECHANISM NOTE: `git grep` exit code 1 means "pattern matched zero files/lines", not an error;
 * `execSync` throws on any non-zero exit, so every helper below treats `e.status === 1` as an
 * empty result and re-throws anything else (verified in 122-RESEARCH.md by running
 * `execSync('git grep -lF "definitely-not-a-real-string-9x7q2" -- src')`, which throws with
 * `status: 1` and empty stdout -- reproduced live below as this file's own zero-match control).
 *
 * MATCHER DISCIPLINE: every pattern below is copied verbatim from the sweep ledgers
 * (`sweep-ledgers/122-04..08-LEDGER.md`) that already proved each one discriminates against a
 * known-positive in this exact repo -- none are hand-re-derived here.
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

const REPO_ROOT = process.cwd();
const PHASE_SLUG = "122-tokens-primitives-contrast-measurement";

/**
 * Resolve the phase directory in BOTH the active and the archived location.
 *
 * This was hardcoded to `.planning/phases/<slug>` and broke the moment milestone
 * v15.0 was closed on 2026-08-26: the close moves phase directories to
 * `.planning/milestones/v15.0-phases/<slug>`, so this suite went red for a reason
 * that had nothing to do with tokens. A milestone close is a NORMAL, recurring
 * event, so resolving both locations is the fix rather than repointing the literal
 * at the archive and waiting for the next close to break it again.
 *
 * Throws with both attempted paths if neither exists — a silently-missing ledger
 * directory would make every assertion below pass VACUOUSLY, which is the failure
 * mode this ratchet exists to prevent.
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
        "tokenSweep ratchet: phase dir " +
          PHASE_SLUG +
          " not found. Tried: " +
          candidates.join(", ")
      );
  }
  return found;
}

const PHASE_DIR = resolvePhaseDir();

// ---------------------------------------------------------------------------
// git grep helpers -- the sole population source for every bucket below.
// ---------------------------------------------------------------------------

/** Runs `git grep -lE <pattern> --untracked -- src`, returning matched file paths (posix-style,
 * forward slashes). Uses `execFileSync` with an argv array rather than a shell command STRING --
 * `execSync`'s template-string form is re-parsed by the OS shell (`cmd.exe` on Windows), whose
 * backslash-escaping rules differ from POSIX and mangled the hex bucket's `\[` (verified live:
 * `(bg|border|text)-\[#` arrived at git as `(bg|border|text)-\\[#`, an "Unmatched [" error) --
 * `execFileSync` passes each argv element directly to the child process with no shell re-parsing,
 * so the pattern string is never re-escaped. Exit code 1 ("no match") is treated as an empty
 * array; any other non-zero exit re-throws, per the mechanism note above. */
function filesMatching(pattern: string): string[] {
  try {
    const out = execFileSync(
      "git",
      ["grep", "--untracked", "-lE", pattern, "--", "src"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    return out
      .replace(/\r/g, "") // git on Windows emits CRLF; JS regex `.` does not match `\r`, so a
      // trailing `\r` per line must be stripped before any downstream regex parsing sees it
      // (verified live below -- `linesMatching`'s row parser threw on exactly this).
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/\\/g, "/"));
  } catch (e: any) {
    if (e.status === 1) return [];
    throw e;
  }
}

interface MatchedLine {
  file: string;
  line: number;
  text: string;
}

/** Same as `filesMatching`, but returns each matching LINE and its full content (`git grep -n`,
 * deliberately WITHOUT `-o`/`--only-matching` -- `-o` would print only the matched substring,
 * which is exactly what the state-honesty comment-line filter needs to NOT have, since it must
 * inspect what precedes the match on the same line to tell prose from a rendered placeholder;
 * verified live: `-noE` (with `-o`) returned `text: "\"—\""` for a JSDoc line, which trivially
 * fails the `startsWith("*")` comment check and would have made this bucket falsely report a
 * live violation on RadialGauge.tsx's own doc comment). */
function linesMatching(pattern: string): MatchedLine[] {
  try {
    const out = execFileSync(
      "git",
      ["grep", "--untracked", "-nE", pattern, "--", "src"],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    return out
      .replace(/\r/g, "") // see filesMatching's identical CRLF note above
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((row) => {
        const m = row.match(/^(.*?):(\d+):(.*)$/);
        if (!m) {
          throw new Error(`linesMatching: could not parse git grep row: ${row}`);
        }
        return { file: m[1].replace(/\\/g, "/"), line: Number(m[2]), text: m[3] };
      });
  } catch (e: any) {
    if (e.status === 1) return [];
    throw e;
  }
}

function isTestFile(path: string): boolean {
  return path.includes(".test.");
}

/** A line whose trimmed content opens with a comment marker -- `//`, `/*`, or a JSDoc `*`
 * continuation -- is prose ABOUT an em dash, not a rendered value-slot placeholder. */
function isCommentLine(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

// ---------------------------------------------------------------------------
// KNOWN_EXEMPT -- a record, not a blessing. Every entry names the path, the bucket it is exempt
// from, why, which ledger row is its provenance, and the date it was checked. An unrecorded
// failing file is a REAL miss and must be fixed, not exempted (122-17-PLAN.md's own instruction --
// followed live in this plan: 8 real violations were found and fixed, not exempted, while
// building this file. See 122-17-SUMMARY.md).
// ---------------------------------------------------------------------------

type Bucket =
  | "palette"
  | "hex"
  | "duration"
  | "violet"
  | "pageheader"
  | "loading"
  | "emdash";

interface ExemptEntry {
  bucket: Bucket;
  reason: string;
  ledger: string;
  checkedOn: string;
}

const KNOWN_EXEMPT: Record<string, ExemptEntry[]> = {
  "src/pages/Chat.tsx": [
    {
      bucket: "pageheader",
      reason:
        "Full-bleed presence view (/chat), not a dashboard page. The <h1>ASTRIDR</h1> at :928 " +
        "is an 11px-scale mono brand wordmark sitting inside a voice/avatar status row, not a " +
        "page title competing with content below -- there is no 'page' in the dashboard sense " +
        "for PageHeader to head. This is the exemption 122-CONTEXT.md D-18 predicted as the " +
        "likely genuine case.",
      ledger: "122-PAGEHEADER-ADOPTION.md, Named exemption register, row 1 (Chat.tsx:928)",
      checkedOn: "2026-08-18",
    },
  ],
};

function isExempt(file: string, bucket: Bucket): boolean {
  return (KNOWN_EXEMPT[file] ?? []).some((e) => e.bucket === bucket);
}

// ---------------------------------------------------------------------------
// Bucket population + violation functions. Each is a thin composition of the grep helpers above
// plus the KNOWN_EXEMPT filter -- no bucket below contains an array/Set literal of `src/...`
// paths standing in for "today's known-clean files".
// ---------------------------------------------------------------------------

const PALETTE_PATTERN =
  "(bg|text|border|from|to|via)-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}";
const HEX_PATTERN = "(bg|border|text)-\\[#";
const DURATION_PATTERN = "duration-[0-9]+";
const VIOLET_PATTERN = "(bg|text|border)-(violet|purple|fuchsia)-[0-9]{2,3}";
const LOADING_PATTERN = ">Loading";
const EMDASH_PATTERN = '"—"|>—<';

function paletteViolations(): string[] {
  return filesMatching(PALETTE_PATTERN)
    .filter((f) => !isTestFile(f))
    .filter((f) => !isExempt(f, "palette"));
}

function hexViolations(): string[] {
  return filesMatching(HEX_PATTERN)
    .filter((f) => !isTestFile(f))
    .filter((f) => !isExempt(f, "hex"));
}

function durationNegativeViolations(): string[] {
  return filesMatching(DURATION_PATTERN)
    .filter((f) => !isTestFile(f))
    .filter((f) => !isExempt(f, "duration"));
}

function violetViolations(): string[] {
  return filesMatching(VIOLET_PATTERN)
    .filter((f) => !isTestFile(f))
    .filter((f) => !isExempt(f, "violet"));
}

/** Population re-derived from the corpus directly (`fs.readdirSync`), never from a written-down
 * route list: every `.tsx` file directly under `src/pages/` plus every `.tsx` file one directory
 * deeper (e.g. `src/pages/hr/`), excluding `*.test.tsx` and dunder-prefixed scaffolding
 * directories (`__tests__`). Mirrors 122-PAGEHEADER-ADOPTION.md's reproduction command, expressed
 * as Node fs calls instead of shell `ls`/`comm` for portability. */
function listPageFiles(): string[] {
  const pagesDir = join(REPO_ROOT, "src/pages");
  const topLevel = readdirSync(pagesDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".tsx") && !d.name.includes(".test."))
    .map((d) => `src/pages/${d.name}`);

  const subdirs = readdirSync(pagesDir, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !d.name.startsWith("__")
  );
  const subFiles = subdirs.flatMap((d) => {
    const subPath = join(pagesDir, d.name);
    return readdirSync(subPath, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith(".tsx") && !f.name.includes(".test."))
      .map((f) => `src/pages/${d.name}/${f.name}`);
  });

  return [...topLevel, ...subFiles];
}

function pageHeaderViolations(): string[] {
  return listPageFiles()
    .filter((p) => !readFileSync(join(REPO_ROOT, p), "utf8").includes("PageHeader"))
    .filter((p) => !isExempt(p, "pageheader"));
}

function bareLoadingViolations(): MatchedLine[] {
  return linesMatching(LOADING_PATTERN)
    .filter((l) => !isTestFile(l.file))
    .filter((l) => !isCommentLine(l.text))
    .filter((l) => !isExempt(l.file, "loading"));
}

function emDashViolations(): MatchedLine[] {
  return linesMatching(EMDASH_PATTERN)
    .filter((l) => !isTestFile(l.file))
    .filter((l) => !isCommentLine(l.text))
    .filter((l) => !isExempt(l.file, "emdash"));
}

// ---------------------------------------------------------------------------
// Duration bucket's POSITIVE half: the built stylesheet must actually contain the three
// @utility-generated rules, not merely be absent of the old duration-NNN classes. D-10's original
// (broken) `@theme`-only mechanism would have made the negative half pass while emitting ZERO CSS
// for the new tokens -- silently, with no build error (122-RESEARCH.md Q1). The mutation-based
// false-green proof below (D-26) makes this failure mode permanently detectable.
// ---------------------------------------------------------------------------

function findDistCssFiles(): string[] {
  const distAssets = join(REPO_ROOT, "dist", "assets");
  if (!existsSync(distAssets)) return [];
  return readdirSync(distAssets)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(distAssets, f));
}

function readCombinedDistCss(): string | null {
  const files = findDistCssFiles();
  if (files.length === 0) return null;
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

function hasAllThreeDurationRules(css: string): boolean {
  return (
    css.includes(".duration-fast{") &&
    css.includes(".duration-normal{") &&
    css.includes(".duration-slow{")
  );
}

/** Simulates the exact false-green D-10-as-written would have produced: the three
 * @utility-generated rules vanish from the build output while every other rule (including any
 * `.duration-NNN` class, which never existed to begin with) is untouched. */
function stripDurationUtilityRules(css: string): string {
  return css
    .replace(/\.duration-fast\{[^}]*\}/g, "")
    .replace(/\.duration-normal\{[^}]*\}/g, "")
    .replace(/\.duration-slow\{[^}]*\}/g, "");
}

const DIST_CSS = readCombinedDistCss();
const DIST_CSS_SKIP_REASON =
  "no dist/assets/*.css found -- run `npm run build` to produce one before trusting this " +
  "bucket's positive half. A skip that says why beats a pass that measured nothing " +
  "(theme-contrast.spec.ts's fee96b5d guard is this repo's own precedent for the idiom).";

// ---------------------------------------------------------------------------
// Grep helper self-checks (T-122-17-B mitigation): prove the helper both treats "no match" as
// empty (not a crash) and actually finds something, BEFORE trusting any bucket's zero below. A
// ratchet that stopped analysing would report the same green as a clean corpus; these two checks
// are what rules that out.
// ---------------------------------------------------------------------------

describe("grep helper self-checks (T-122-17-B)", () => {
  it("filesMatching treats git grep exit code 1 (zero matches) as an empty array, not a crash", () => {
    // Excludes this ratchet's OWN test file: it necessarily documents (and therefore CONTAINS)
    // this exact control string in prose, which would otherwise self-contaminate the probe --
    // verified live: an unfiltered first run of this control returned
    // ["src/tokenSweep.ratchet.test.ts"], not []. Every real bucket above already excludes test
    // files uniformly; this control is held to the same standard.
    const hits = filesMatching("definitely-not-a-real-string-9x7q2").filter(
      (f) => !isTestFile(f)
    );
    expect(hits).toEqual([]);
  });

  it("filesMatching finds a genuinely common pattern (a helper that returns empty for everything would pass every bucket below while proving nothing)", () => {
    const hits = filesMatching("useQuery");
    expect(hits.length).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// The six buckets (D-25). Each `it` re-derives its population fresh via the helpers above.
// ---------------------------------------------------------------------------

describe("D-25 bucket: hardcoded neutral-palette surface classes", () => {
  it("no file outside KNOWN_EXEMPT carries a raw slate/zinc/gray/neutral/stone class (test files excluded)", () => {
    expect(paletteViolations()).toEqual([]);
  });
});

describe("D-25 bucket: hardcoded hex surface literals", () => {
  it("no file outside KNOWN_EXEMPT carries a bg-/border-/text-[#...] literal (test files excluded)", () => {
    expect(hexViolations()).toEqual([]);
  });
});

describe("D-25 bucket: motion tokens (duration)", () => {
  it("no duration-NNN class remains outside KNOWN_EXEMPT (negative half)", () => {
    expect(durationNegativeViolations()).toEqual([]);
  });

  it.skipIf(DIST_CSS === null)(
    "the built stylesheet contains all three .duration-* utility rules (positive half)",
    () => {
      if (DIST_CSS === null) return; // narrowing for TS; skipIf already prevents this branch
      expect(hasAllThreeDurationRules(DIST_CSS)).toBe(true);
    }
  );

  if (DIST_CSS === null) {
    // eslint-disable-next-line no-console
    console.warn(`[D-25 duration positive check] SKIPPED: ${DIST_CSS_SKIP_REASON}`);
  }
});

describe("D-25 bucket: raw violet/purple/fuchsia utilities", () => {
  it("no file outside KNOWN_EXEMPT carries a raw violet/purple/fuchsia class (test files excluded)", () => {
    expect(violetViolations()).toEqual([]);
  });
});

describe("D-25 bucket: PageHeader adoption", () => {
  it("every page under src/pages/ (and one level deeper) outside KNOWN_EXEMPT renders PageHeader", () => {
    expect(pageHeaderViolations()).toEqual([]);
  });
});

describe("D-25 bucket: state honesty -- bare 'Loading' JSX text", () => {
  it("no bare '>Loading' JSX text node remains outside KNOWN_EXEMPT (comment lines excluded)", () => {
    expect(bareLoadingViolations()).toEqual([]);
  });
});

describe("D-25 bucket: state honesty -- em-dash value-slot placeholders", () => {
  it("no quoted \"—\" or bare '>—<' JSX node remains outside KNOWN_EXEMPT (comment/JSDoc lines excluded)", () => {
    expect(emDashViolations()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D-26: two mutation proofs plus a negative control. Mutations are held on disk only as long as
// the single synchronous try/finally block around each write needs them -- never left behind, per
// the precedent's disk-safety discipline and this file's own T-122-17-C mitigation. `git grep`
// cannot see in-memory content across a multi-file corpus (unlike Analytics.structuralGuard's
// single-file AST walk), so a temp fixture file is the mechanism this bucket's design genuinely
// requires -- written inside `src/` (so it is a real corpus member), given a name that could never
// collide with a real component, and deleted in `finally` even if the assertion inside throws.
// ---------------------------------------------------------------------------

const MUTATION_A_REL = "src/components/__ratchet-mutation-fixture-a.tsx";
const MUTATION_A_ABS = join(REPO_ROOT, MUTATION_A_REL);
const MUTATION_B_REL = "src/components/__ratchet-mutation-fixture-b-unlisted.tsx";
const MUTATION_B_ABS = join(REPO_ROOT, MUTATION_B_REL);

function assertSyntacticallyValid(source: string): void {
  // Case C (validity precondition), asserted BEFORE the failure assertion in every mutation test
  // below -- a syntactically invalid mutation produces a parse error that reads exactly like the
  // guard firing, and a red from that proves nothing. Precedent:
  // Analytics.structuralGuard.test.ts's identical use of ts.transpileModule.
  const { diagnostics } = ts.transpileModule(source, {
    fileName: "fixture.tsx",
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  });
  expect(diagnostics ?? []).toEqual([]);
}

describe("D-26 mutation (a): reintroducing a fixed violation fails the ratchet", () => {
  afterAll(() => {
    if (existsSync(MUTATION_A_ABS)) unlinkSync(MUTATION_A_ABS);
  });

  it("reintroducing ActiveTimeChart.tsx's pre-122-04 bg-gray-800 as a temp fixture makes the palette bucket fail", () => {
    const realSource = readFileSync(
      join(REPO_ROOT, "src/components/ActiveTimeChart.tsx"),
      "utf8"
    );
    // Proves there IS a real, converted site to regress -- 122-04-LEDGER.md records this file's
    // bg-gray-800/50 -> bg-card/50 conversion.
    expect(realSource).toContain("bg-card/50");
    const mutated = realSource.replace("bg-card/50", "bg-gray-800/50");

    assertSyntacticallyValid(mutated);

    try {
      writeFileSync(MUTATION_A_ABS, mutated, "utf8");
      expect(paletteViolations()).toContain(MUTATION_A_REL);
    } finally {
      if (existsSync(MUTATION_A_ABS)) unlinkSync(MUTATION_A_ABS);
    }
  });
});

describe("D-26 mutation (b) -- the one that matters: a violation in a file on NO list also fails the ratchet", () => {
  afterAll(() => {
    if (existsSync(MUTATION_B_ABS)) unlinkSync(MUTATION_B_ABS);
  });

  it("the fixture path is provably absent from KNOWN_EXEMPT and from every sweep ledger", () => {
    expect(KNOWN_EXEMPT[MUTATION_B_REL]).toBeUndefined();
    const ledgerPaths = [
      "sweep-ledgers/122-04-LEDGER.md",
      "sweep-ledgers/122-05-LEDGER.md",
      "sweep-ledgers/122-06-LEDGER.md",
      "sweep-ledgers/122-07-LEDGER.md",
      "sweep-ledgers/122-08-LEDGER.md",
      "122-PAGEHEADER-ADOPTION.md",
      "122-LOADING-LEDGER.md",
      "122-LOADING-LEDGER-SUBTREES.md",
      "122-STATE-HONESTY-LEDGER.md",
    ];
    for (const rel of ledgerPaths) {
      const text = readFileSync(join(PHASE_DIR, rel), "utf8");
      expect(text).not.toContain("ratchet-mutation-fixture-b-unlisted");
    }
  });

  it("a synthetic violation in this never-mentioned file fails the ratchet -- an enumerated allowlist test would have passed it", () => {
    const content =
      'export function UnlistedFixture() {\n' +
      '  return <div className="text-purple-400">unlisted</div>;\n' +
      '}\n';

    assertSyntacticallyValid(content);

    try {
      writeFileSync(MUTATION_B_ABS, content, "utf8");
      expect(violetViolations()).toContain(MUTATION_B_REL);
    } finally {
      if (existsSync(MUTATION_B_ABS)) unlinkSync(MUTATION_B_ABS);
    }
  });
});

describe("D-26 negative control: the unmutated real corpus trips zero buckets", () => {
  it("all six buckets are clean with no mutation fixture present (an analyzer that flags everything would fail this)", () => {
    expect(existsSync(MUTATION_A_ABS)).toBe(false);
    expect(existsSync(MUTATION_B_ABS)).toBe(false);
    expect(paletteViolations()).toEqual([]);
    expect(hexViolations()).toEqual([]);
    expect(durationNegativeViolations()).toEqual([]);
    expect(violetViolations()).toEqual([]);
    expect(pageHeaderViolations()).toEqual([]);
    expect(bareLoadingViolations()).toEqual([]);
    expect(emDashViolations()).toEqual([]);
  });
});

describe("D-26 duration false-green proof", () => {
  it.skipIf(DIST_CSS === null)(
    "stripping the @utility duration-* rules from the built-CSS input fails the positive half while the negative half still passes",
    () => {
      if (DIST_CSS === null) return; // narrowing for TS; skipIf already prevents this branch
      expect(hasAllThreeDurationRules(DIST_CSS)).toBe(true); // real build: passes
      const stripped = stripDurationUtilityRules(DIST_CSS);
      expect(hasAllThreeDurationRules(stripped)).toBe(false); // simulated D-10-as-written false-green
      // The negative half is corpus-grep-based and entirely unaffected by this in-memory CSS
      // string mutation -- it must still pass, proving the two halves are independent checks.
      expect(durationNegativeViolations()).toEqual([]);
    }
  );

  if (DIST_CSS === null) {
    // eslint-disable-next-line no-console
    console.warn(`[D-26 duration false-green proof] SKIPPED: ${DIST_CSS_SKIP_REASON}`);
  }
});

// ---------------------------------------------------------------------------
// Final disk-safety sweep (T-122-17-C): defensive only -- every mutation test above already
// cleans up in try/finally and its own afterAll, so this should always find nothing. If it does
// find something, that is itself the finding: report it rather than silently deleting and moving
// on, since a leftover fixture in a shared checkout could otherwise be swept into another
// session's commit.
// ---------------------------------------------------------------------------

afterAll(() => {
  const leftovers = [MUTATION_A_ABS, MUTATION_B_ABS].filter((p) => existsSync(p));
  if (leftovers.length > 0) {
    for (const p of leftovers) unlinkSync(p);
    throw new Error(
      `tokenSweep.ratchet.test.ts: found and removed ${leftovers.length} leftover mutation ` +
        `fixture(s) that should have been cleaned up by their own test: ${leftovers.join(", ")}`
    );
  }
});
