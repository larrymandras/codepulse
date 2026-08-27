---
phase: 128-planning-reconciliation
reviewed: 2026-08-27T22:41:26Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/requirementsDrift.ratchet.test.ts
  - src/planningChecks.ratchet.test.ts
  - .github/workflows/ci.yml
  - .planning/phases/128-planning-reconciliation/checks/closed-todos.mjs
  - .planning/phases/128-planning-reconciliation/checks/open-todos.mjs
  - .planning/phases/128-planning-reconciliation/checks/seed-status.mjs
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 128: Code Review Report

**Reviewed:** 2026-08-27T22:41:26Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the git-ancestry freshness logic, shell-safety, temp-fixture cleanup, and the three
`.mjs` planning checkers per the requested focus areas. `execFileSync` is used consistently with
argv arrays everywhere `git`/`node` is invoked — no interpolated value reaches a shell in either
file, confirming the settled claim. Both temp-repo fixtures (`gitIsShallow` real-clone test,
D-03a same-day test) clean up in `finally` blocks on every path, including throws — no leak
found.

One real logic defect was found in `stalePartialOffenders`'s SHA-equality fast path: it uses
strict string equality to detect "stamp equals completion commit," but `completionCommitFor`
always returns a full 40-character SHA while the file's own documented stamp convention
recommends abbreviated (7+ hex char) SHAs — so the single most common "fresh" case (re-deriving
at exactly the phase's own closing commit, stamped the documented way) gets misclassified as
STALE instead of being recognized as equal, because git's `merge-base --is-ancestor` treats a
commit as its own ancestor. This is unguarded by any of the 13 tests in the file, all of which
either use equal-length strings or exercise a genuinely different ancestor commit. It is
currently dormant (0 in-range Partial rows live), so it does not fail today, but it will
misfire the first time anyone stamps a Partial using the documented short-SHA convention at
closing time.

Two lower-severity findings concern the citation-parsing checkers: a permissive regex lets a
citation string traverse outside the repo root, and `seed-status.mjs`'s `absorbed_by`
referential-integrity check uses substring containment rather than exact matching, which can
mis-validate a non-existent ID that happens to be a prefix of a real one.

## Warnings

### WR-01: Abbreviated-SHA stamp equal to the completion commit is misclassified as STALE

**File:** `src/requirementsDrift.ratchet.test.ts:401-414`
**Confidence:** High (mechanism verified empirically against this repo's live git; not exercised
by any of the 13 existing test cases)

```ts
const completionSha = completion.sha;

if (stampSha === completionSha) continue; // fresh: recorded IN the closing commit itself

const stampIsAncestorOfCompletion = oracle.isAncestor(stampSha, completionSha);
if (stampIsAncestorOfCompletion) {
  offenders.push(
    `${r.id} (Phase ${r.phase}): STALE — stamp ${stampSha} is an ancestor of completion ` +
    ...
```

**Issue:** The "equal commit" branch is decided by strict string equality (`stampSha ===
completionSha`). But `completionCommitFor` always resolves via `git log --format=%H`
(`requirementsDrift.ratchet.test.ts:482-483`), which is always a full 40-character SHA:

```ts
["log", "--format=%H", "--reverse", "--follow", "--", ".planning/ROADMAP.md"],
```

while `STAMP_PATTERN` (`requirementsDrift.ratchet.test.ts:138`) explicitly accepts, and the
file's own stamp-syntax documentation (lines 46-48) explicitly recommends, an abbreviated 7+
hex-character SHA — every worked example in the file (`a1b2c3d`, `cccccc1`, `aaaaaa1`, etc.) is
7 characters.

If a Partial cell is stamped the documented way at exactly its phase's completion commit — e.g.
`Partial — X shipped (re-derived a1b2c3d)` where `a1b2c3d` is a 7-char abbreviation of the real
completion commit — `stampSha === completionSha` is `false` (different string lengths/content),
so the check falls through to `oracle.isAncestor(stampSha, completionSha)`. I confirmed directly
against this repository that `git merge-base --is-ancestor` treats a commit (and any valid
abbreviation of it) as its own ancestor:

```
$ git merge-base --is-ancestor 9b2fdf4d 9b2fdf4dbf01ea096a4925ce1e395bc42edbf511; echo $?
0
$ git merge-base --is-ancestor 9b2fdf4d...511 9b2fdf4d...511; echo $?
0
```

So `stampIsAncestorOfCompletion` is `true`, and the row is pushed onto `offenders` with a
"STALE" message — even though it is, by the file's own stated semantics (line 349: "stamp
equals the completion commit -> NOT an offender"), the freshest possible stamp.

None of the 13 tests in this file catch it: the fake-oracle case 3 (`requirementsDrift.ratchet.test.ts:823-828`)
uses a fake `completionCommitFor` that returns the same short string as the stamp
(`"cccccc1"`), so the exact-string-equality path is exercised but the real function's
full-vs-abbreviated asymmetry is not. The real-git D-03a fixture
(`requirementsDrift.ratchet.test.ts:958-1023`) always stamps with `git rev-parse HEAD` (full
SHA) on both sides, so it never produces a short-vs-full pair for the same commit either.

**Concrete failure scenario:** Phase N ships; its ROADMAP.md flip lands in commit `d34dbeef...`
(full SHA). A requirement stays `Partial` and someone re-derives it in the same commit/PR that
closes the phase, stamping it `Partial — reason (re-derived d34dbee)` per the file's documented
convention. `npm test` now reports `d34dbee` STALE and blocks CI, even though it is the
freshest possible stamp for that phase.

**Fix:** Decide equality via mutual ancestry (which is SHA-length-agnostic) instead of, or in
addition to, string equality:

```ts
const stampIsAncestorOfCompletion = oracle.isAncestor(stampSha, completionSha);
const completionIsAncestorOfStamp = oracle.isAncestor(completionSha, stampSha);

if (stampIsAncestorOfCompletion && completionIsAncestorOfStamp) continue; // same commit
if (stampIsAncestorOfCompletion) { /* STALE, as today */ }
if (completionIsAncestorOfStamp) continue; // fresh: re-derived after
// else: unrelated history
```

Add a fake-oracle case (and a real-git case using `git rev-parse --short HEAD` against `git
rev-parse HEAD` for the same commit) so this cannot regress silently again.

---

### WR-02: `seed-status.mjs` validates `absorbed_by` IDs by substring containment, not exact match

**File:** `.planning/phases/128-planning-reconciliation/checks/seed-status.mjs:139-147`
**Confidence:** High on the mechanism (quoted below); Medium on real-world exploitability today
(no current `absorbed_by` value happens to collide against `.planning/REQUIREMENTS.md`, checked
against the live corpus)

```js
for (const id of absorbedBy) {
  if (!reqText.includes(id)) {
    failures.push(
      `${file}: absorbed_by lists "${id}", which does not appear in .planning/REQUIREMENTS.md`
    );
  } else {
    absorbedByResolvedCount += 1;
  }
}
```

**Issue:** `String.prototype.includes` is a raw substring test with no boundary anchoring. A
non-existent (e.g. mistyped) ID that happens to be a strict prefix of a real ID's text will be
reported as "resolved" even though it was never itself written anywhere in
`REQUIREMENTS.md`. Example: if `REQUIREMENTS.md` contains `BOARD-10` but not `BOARD-1`, then
`reqText.includes("BOARD-1")` is `true` (it matches the first 7 characters of `BOARD-10`), so a
seed carrying `absorbed_by: [BOARD-1]` (a typo for `BOARD-01` or a stale reference to a since-
renumbered ID) would silently count as resolved rather than tripping the referential-integrity
failure this checker exists to catch. This is exactly the class of bug this repo's own CLAUDE.md
lessons call out repeatedly (grep/substring checks that pass on the wrong string). Not currently
triggered — I checked the 7 live `absorbed_by` values (`BOARD-01/02/03`, `COST-04/05/06`,
`COCKPIT-01..06`, `A11Y-03/04/05`) against the live requirements table and none collides today —
but the check's guarantee is weaker than its own error message implies, and the failure mode is
silent (a false "resolved", not a false failure).

**Fix:** Anchor the match to the ID's own table-row boundary, e.g. reuse the same row pattern the
other checkers use (`| ID |`) or require a non-identifier character (or string boundary)
immediately after the match:

```js
const idPattern = new RegExp(`(^|[^A-Za-z0-9-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9-]|$)`);
if (!idPattern.test(reqText)) { /* failure, as today */ }
```

---

### WR-03: Citation regex in the `.mjs` checkers permits path traversal outside the repo root

**File:** `.planning/phases/128-planning-reconciliation/checks/closed-todos.mjs:79-86, 143-159`
(also `open-todos.mjs:84, 138`)
**Confidence:** High on the mechanism (regex and file-read behavior confirmed directly); Medium
on practical severity — no content is ever echoed back, only existence/line-count, and exploiting
it meaningfully requires either commit access to this repo or `pull_request` CI running
untrusted contributor content, which is unverifiable from the code alone.

```js
// closed-todos.mjs:79
for (const m of text.matchAll(/([\w./-]+\.(?:ts|tsx|md|mjs)):(\d+)/g)) {
```

```js
// closed-todos.mjs:143-159
for (const { rel, line } of citations) {
  citationsChecked++;
  const abs = join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    deadCitations.push({ file, citation: rel });
    continue;
  }
  ...
  const lineCount = readFileSync(abs, "utf8").split("\n").length;
  if (line < 1 || line > lineCount) {
    outOfRangeCitations.push({ file, citation: `${rel}:${line}`, lineCount });
  }
}
```

**Issue:** The citation character class `[\w./-]+` permits `.` and `/` freely, so a citation
string of the form `../../../../etc/hostname.md:1` (or any real path ending in `.ts`, `.tsx`,
`.md`, or `.mjs`) parses and `join(REPO_ROOT, rel)` resolves outside the repository checkout.
`closed-todos.mjs` runs in CI on every `npm test` (wired via
`src/planningChecks.ratchet.test.ts:129-132`), which runs on `pull_request` per `ci.yml:5-6`.
Two concrete consequences, both reachable by anyone able to add a completed todo with
`closed_by: 128-01` in its frontmatter and a matching citation in its `## Resolution` section:

1. **Arbitrary-file line-count oracle.** If the traversed path exists and ends in a whitelisted
   extension, `readFileSync` succeeds and only its line count is disclosed (in the failure
   message, only when the cited line number is also out of range) — no file content is ever
   printed. This is a narrow but real information-disclosure primitive against files outside the
   checkout on the CI runner (or on any machine running this checker locally).
2. **Uncaught-exception crash instead of a diagnostic.** If the traversed path resolves to a
   *directory* whose name happens to end in one of the whitelisted extensions (e.g. a
   directory literally named `weird.md`, which git can track), `existsSync` returns `true` but
   `readFileSync` throws `EISDIR` uncaught — I confirmed this directly:
   ```
   $ node -e "require('fs').readFileSync('.planning','utf8')"
   threw: EISDIR EISDIR: illegal operation on a directory, read
   ```
   Node's default uncaught-exception handler still exits non-zero (so the CI test does still
   fail, per `runChecker`'s `expect(code).toBe(0)`), but the failure surfaces as a raw stack
   trace rather than the checker's own `FAIL:` diagnostic — inconsistent with the file's stated
   "indeterminacy is loud" design intent (`requirementsDrift.ratchet.test.ts:80-84` states this
   principle for the sibling file; the same spirit applies here).

`open-todos.mjs:84,138` has the identical unbounded citation regex, but only calls `existsSync`
on the resolved path (no `readFileSync`), so it is limited to an existence-probe oracle, not a
line-count or crash primitive.

**Fix:** Reject citations whose resolved path escapes `REPO_ROOT`, e.g.:

```js
import { relative } from "node:path";
const abs = join(REPO_ROOT, rel);
const rp = relative(REPO_ROOT, abs);
if (rp.startsWith("..") || isAbsolute(rp)) {
  deadCitations.push({ file, citation: rel }); // or its own "outside repo" bucket
  continue;
}
```

and wrap the `readFileSync` line-count read in a `try/catch` that reports a citation as
unresolvable rather than letting the process throw uncaught.

## What I dropped and why

- **`completionCommitFor`'s bisect precondition.** The comment at
  `requirementsDrift.ratchet.test.ts:511-516` says the monotonicity precondition is "checked, not
  assumed," but only the two array endpoints are actually checked — the interior is not. A
  ROADMAP.md history that flips Complete → non-Complete → Complete for the same phase (a revert
  and re-close) could make the bisect converge on a different commit than intended. I did not
  report this as a finding: I could not construct a scenario where this is reachable via any
  normal phase-close workflow (ROADMAP.md rows do not get un-completed in this repo's observed
  history), and the file's own real-git correctness test (`requirementsDrift.ratchet.test.ts:616-641`,
  Phase 120) already demonstrates the bisect finds the correct boundary on this repo's actual
  history. Flagging a wording nitpick ("checked" vs. "checked at the boundary only") without a
  reachable exploit would be exactly the speculative-finding noise the precision bar asks me to
  avoid.
- **Shell-injection / `execFileSync` argv discipline.** Confirmed clean across both `.ts` files —
  every `git`/`node` invocation uses an argv array, no `shell: true` anywhere, and every
  interpolated value (`${sha}`, `${rev}`) sits inside a single argv element rather than a
  shell-parsed string. Not reported as a finding because there is nothing to report — this
  matches the already-settled claim in the task context.
- **Temp-repo fixture cleanup.** Both fixtures (`gitIsShallow` real-clone test, D-03a same-day
  test) wrap their git operations in `try { ... } finally { rmSync(tmpDir, ...) }`, so cleanup
  runs on the failure path too. No finding.
- **`ci.yml` / `fetch-depth: 0` interaction with the pinned action SHAs.** I could not verify the
  pinned `actions/checkout` SHA's authenticity or its exact supported-parameter surface from
  within this sandbox (no network access), so I am not asserting anything about it either way
  rather than guessing.
- **Bare `Complete`/`Pending` string matching in `REQ_ROW`/`PHASE_ROW`.** Read through these
  carefully for off-by-one/anchoring bugs; found none worth reporting.

---

_Reviewed: 2026-08-27T22:41:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
