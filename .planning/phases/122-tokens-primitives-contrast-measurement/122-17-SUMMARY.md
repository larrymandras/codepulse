---
phase: 122-tokens-primitives-contrast-measurement
plan: 17
subsystem: ui
tags: [testing, ratchet, corpus-derivation, tailwind, state-honesty, ci-guard]

# Dependency graph
requires:
  - phase: 122-04
    provides: "sweep-ledgers/122-04-LEDGER.md, the palette/hex/motion/violet conversion record for src/components/ A-E -- KNOWN_EXEMPT provenance + mutation (a)'s regression site"
  - phase: 122-05
    provides: "sweep-ledgers/122-05-LEDGER.md, slice B"
  - phase: 122-06
    provides: "sweep-ledgers/122-06-LEDGER.md, slice C"
  - phase: 122-07
    provides: "sweep-ledgers/122-07-LEDGER.md, slice D"
  - phase: 122-08
    provides: "sweep-ledgers/122-08-LEDGER.md, slice E"
  - phase: 122-10
    provides: "122-TOKEN-LAW.md, the --duration-fast/normal/slow @theme+@utility mechanism this ratchet's positive half asserts against"
  - phase: 122-11
    provides: "122-PAGEHEADER-ADOPTION.md, the PageHeader bucket's KNOWN_EXEMPT provenance (Chat.tsx, ForgePage.tsx)"
  - phase: 122-12
    provides: "VitalsRail.tsx/DashboardLayout.tsx's useConvexConnectionState() Convex dot -- confirmed already live, not a residual violation"
  - phase: 122-14
    provides: "122-STATE-HONESTY-LEDGER.md, the MetricCard render-site state-honesty record"
  - phase: 122-15
    provides: "122-LOADING-LEDGER.md, InlineMetricState/LoadingState primitives this plan's fixes reuse"
  - phase: 122-16
    provides: "122-LOADING-LEDGER-SUBTREES.md, the wave-6 close this plan verifies is actually complete"
provides:
  - "src/tokenSweep.ratchet.test.ts -- a corpus-derived ratchet across six buckets (palette, hex, duration, violet, PageHeader, state honesty) that re-derives its population from src/ on every run via git grep --untracked, proven by two mutations (one reintroducing a known-fixed violation, one in a file on no list anywhere) plus a negative control and a duration false-green proof"
  - "122-RATCHET-EXEMPTIONS.md -- the narrative record behind the ratchet's two KNOWN_EXEMPT entries"
  - "8 real, previously-unswept token-law violations found and fixed across 8 files outside every phase-122 sweep plan's files_modified list"
affects: [ci-guard, wave-7-close, phase-123-baseline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "git grep --untracked, not plain git grep, for any corpus-derived population check -- a brand-new violating file that has not yet been git add-ed is otherwise invisible, which is exactly the 'file nobody wrote down' case such a ratchet exists to catch"
    - "execFileSync with an argv array, not execSync with a shell command string, for any git grep invocation whose pattern contains a backslash -- execSync's string form is re-parsed by cmd.exe on Windows, whose escaping rules mangle a POSIX-correct \\[ into an 'Unmatched [' error"
    - "git grep -n without -o when a comment-line (or any content-shape) filter needs to inspect what precedes the match -- -o prints only the matched substring, defeating any filter that reads the line's own surrounding text"
    - "strip \\r from git's stdout before any per-line regex parse on Windows -- JS regex . does not match \\r, so a trailing CRLF silently breaks an otherwise-correct file:line:content parser on the read path, not the write path"
    - "temp fixture files inside src/, written and deleted within one synchronous try/finally, are the correct disk-safety-compliant way to mutation-test a MULTI-file corpus grep (as opposed to a single-file AST walk, where an in-memory string transform suffices)"

key-files:
  created:
    - src/tokenSweep.ratchet.test.ts
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-RATCHET-EXEMPTIONS.md
  modified:
    - src/lib/eventIcons.ts
    - src/components/ChannelHealthPanel.tsx
    - src/components/CostBreakdownTable.tsx
    - src/components/GovernorDecisionLog.tsx
    - src/components/ModelPricingAdmin.tsx
    - src/components/forge/ForgeMetadataPanel.tsx
    - src/components/kg/KGDetailsPanel.tsx
    - src/components/skills/vault/SkillRecencyView.tsx

key-decisions:
  - "KNOWN_EXEMPT is keyed by file path -> an array of {bucket, reason, ledger, checkedOn} entries, not a flat Set of paths -- a file can be legitimately exempt in one bucket (PageHeader) while still being a real violation in another, and a flat structure could not express that"
  - "The em-dash/loading state-honesty bucket is deliberately narrower than a full em-dash sweep: it matches only an exact quoted \"—\" literal or a bare JSX >—< node, filtered by a trimmed-comment-line check -- catches every real value-slot shape found this session, explicitly does NOT catch an em-dash mixed with other text in the same JSX node, and says so in the header comment rather than shipping a noisier pattern that would cry wolf"
  - "PageHeader population is re-derived via fs.readdirSync against src/pages/ (top-level + one directory deep, excluding dunder-prefixed scaffolding dirs), not via git grep's pathspec glob -- 122-PAGEHEADER-ADOPTION.md's own methodology note records that a git-grep glob crosses directory boundaries unlike a shell ls, and Node fs sidesteps the ambiguity entirely"
  - "8 real violations found while deriving the ratchet's corpus were fixed in a separate, earlier commit (9ceaeb69) rather than folded into KNOWN_EXEMPT -- per the plan's own explicit instruction ('if a file is failing and no ledger records it, that is a REAL miss and the correct response is to fix the file, not to add an entry'), and per the deviation rules' Rule 1 (auto-fix bugs found live)"
  - "Task 1 and Task 2 landed as separate commits on the SAME file (a temporary strip-then-restore of the D-26 section between commits) so the git history shows the ratchet's mechanism and its mutation-proof as two reviewable diffs, matching the plan's per-task commit protocol even though both tasks touch one file"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05]

# Metrics
duration: ~35min (investigation + fixes + ratchet build + mutation proofs; commit span 15:39-15:53 EDT)
completed: 2026-08-19
---

# Phase 122 Plan 17: Corpus-Derived Token Sweep Ratchet Summary

**Shipped `src/tokenSweep.ratchet.test.ts`, a six-bucket ratchet that re-derives its population from `src/` fresh on every run (never a hardcoded file list) and is proven by two mutations -- one reintroducing a known-fixed violation, one in a file on no list anywhere -- plus a negative control and a duration false-green proof; and along the way found and fixed 8 real, previously-unswept token-law violations across 8 files that no phase-122 sweep plan had ever touched.**

## Performance

- **Duration:** ~35 min end to end; the three commits themselves span 15:39:32-15:53:05 EDT (13.5 min)
- **Tasks:** 2 (build the ratchet; prove it with mutations) plus one preliminary fix commit for violations the ratchet's own corpus derivation surfaced
- **Files modified:** 10 (1 new test file, 1 new narrative doc, 8 fixed source files)

## Accomplishments

- Re-derived the true corpus state directly (not from any ledger) before writing a single test: palette, hex, and duration buckets were already 0 corpus-wide; violet had exactly one surviving hit (`src/lib/eventIcons.ts`); the em-dash/loading state-honesty pattern had 9 more, across 7 files no 122-14/15/16 file list had ever named.
- Fixed all 9 found sites using the exact established house conventions from this phase's own ledgers (`InlineMetricState` empty-override, plain `"n/a"` for structurally-inapplicable fields, plain text for footprint-constrained rows, indigo re-hue for a Claude-Code-CLI event category) -- zero new conventions invented, every fix traceable to a sibling precedent named in its commit message.
- Built the ratchet across all six buckets named in `122-CONTEXT.md`'s D-25 table: hardcoded neutral palette, hardcoded hex, motion `duration-NNN` (negative + a positive built-CSS assertion), raw violet/purple/fuchsia, PageHeader adoption, and state honesty (bare `Loading` text + em-dash value slots).
- `KNOWN_EXEMPT` carries exactly two entries, both PageHeader adoption (`Chat.tsx` design exemption, `ForgePage.tsx` deferred-with-filed-todo), each dated and traceable to a named row in `122-PAGEHEADER-ADOPTION.md`; the other five buckets carry zero exemptions by design, recorded explicitly in `122-RATCHET-EXEMPTIONS.md` rather than left as an unexplained gap.
- Proved the ratchet with D-26's two mutations: (a) reintroducing `ActiveTimeChart.tsx`'s real, ledger-recorded `bg-gray-800` as an in-`src/` temp fixture fails the palette bucket; (b) a synthetic violet violation in a file provably absent from every KNOWN_EXEMPT entry and all nine ledger/adoption docs also fails the ratchet -- the exact case an enumerated allowlist test would have passed. Both assert syntactic validity via `ts.transpileModule` before asserting the failure. A negative control confirms the unmutated corpus trips zero of all six buckets. A duration-specific false-green proof strips the built CSS's `@utility`-generated rules and shows the positive half then correctly fails while the negative half (unaffected, corpus-grep-based) still passes -- the exact silent failure D-10-as-written would have produced, made permanently detectable.
- Found and fixed three real bugs in the ratchet's own mechanism while getting it green: (1) `execSync`'s shell-string form was re-parsed by `cmd.exe` on Windows and mangled the hex bucket's `\[` escape into an "Unmatched [" error -- switched to `execFileSync` with an argv array; (2) `-noE` (accidentally including `-o`) printed only the matched substring, defeating the em-dash bucket's own comment-line filter and falsely flagging a JSDoc sentence in `RadialGauge.tsx` as a live violation; (3) a trailing `\r` from git's Windows CRLF output broke the `file:line:content` line parser (JS regex `.` does not match `\r`), fixed by stripping `\r` from `execFileSync`'s stdout before parsing.

## Task Commits

1. **Preliminary fix: token-law violations found by corpus derivation** -- `9ceaeb69` (fix) -- not a plan task, but required before Task 1's acceptance criterion ("passes against the real corpus") could be true
2. **Task 1: Build the corpus-derived ratchet across all six buckets** -- `04451c3f` (feat)
3. **Task 2: Prove the ratchet with D-26's two mutations plus a negative control** -- `093db5f2` (feat)

## Files Created/Modified

- `src/tokenSweep.ratchet.test.ts` -- the ratchet: `filesMatching`/`linesMatching` git-grep helpers, `KNOWN_EXEMPT`, six bucket-violation functions, the duration positive-half CSS reader, grep-helper self-checks, and D-26's mutation/control/false-green tests
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-RATCHET-EXEMPTIONS.md` -- narrative record behind both `KNOWN_EXEMPT` entries, plus the explicit "why zero exemptions" table for the other five buckets
- `src/lib/eventIcons.ts` -- `SubagentStart`'s `text-purple-400` re-hued to `text-indigo-400` (Claude Code hook-event category, not Astridr-owned)
- `src/components/ChannelHealthPanel.tsx`, `src/components/forge/ForgeMetadataPanel.tsx` (6 sites) -- formatter helpers widened to return `string | null`; call sites render `InlineMetricState`
- `src/components/CostBreakdownTable.tsx`, `src/components/GovernorDecisionLog.tsx`, `src/components/ModelPricingAdmin.tsx` -- structurally-inapplicable `"—"` fallbacks converted to `"n/a"` text
- `src/components/kg/KGDetailsPanel.tsx` -- `fmtConfidence`/`fmtDate` dense-inline-row fallbacks converted to plain `"unscored"`/`"unknown"` text (matching `FactsTable.tsx`'s identical pair)
- `src/components/skills/vault/SkillRecencyView.tsx` -- empty heat-band list's bare `"—"` converted to descriptive text

## Decisions Made

See `key-decisions` in frontmatter. The most consequential one operationally: KNOWN_EXEMPT's per-bucket array structure (not a flat exempt-file Set), because a file can legitimately be exempt in one bucket while still being a real violation in another -- the ratchet's own type system enforces that an exemption never silently over-covers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug/Missing enforcement] 8 real token-law violations, unswept by any phase-122 plan**
- **Found during:** Task 1, deriving the ratchet's population fresh from the corpus before writing any bucket logic
- **Issue:** `src/lib/eventIcons.ts` (`SubagentStart: "text-purple-400"`, raw violet), and 7 files carrying a genuine value-slot `"—"` fallback that no sweep ledger (122-04..08 for palette/hex/motion/violet, 122-14/15/16 for state honesty) had ever recorded, because none of these files appeared in any of those plans' `files_modified` lists: `ChannelHealthPanel.tsx`, `CostBreakdownTable.tsx`, `GovernorDecisionLog.tsx`, `ModelPricingAdmin.tsx`, `forge/ForgeMetadataPanel.tsx` (6 sites), `kg/KGDetailsPanel.tsx`, `skills/vault/SkillRecencyView.tsx`.
- **Fix:** Every site converted using the exact established house convention for its shape -- `InlineMetricState` empty-override for formatter-helper dt/dd fields, plain `"n/a"` for a column a sibling boolean field already explains, plain text for a dense fixed-width row (matching `KGAnimateControls.tsx`/`FactsTable.tsx`'s footprint-stability precedent), indigo re-hue for a third-party-tool event category (matching `OriginBadge.tsx`/`DetailActivityTab.tsx`'s precedent). Per the plan's own explicit instruction: "If a file is failing and no ledger records it, that is a REAL miss and the correct response is to fix the file, not to add an entry."
- **Files modified:** the 8 files listed in `key-files.modified` above
- **Verification:** `npx tsc --noEmit` exits 0; full `npx vitest run` -- 345 files / 4858 passed / 0 failed, matching the recorded pre-plan baseline exactly, before the ratchet file itself was added
- **Committed in:** `9ceaeb69`

**2. [Rule 3 - Blocking bug] Three mechanism bugs in the ratchet's own git-grep helpers**
- **Found during:** Task 1, first real `npx vitest run` of the built ratchet
- **Issue:** (a) `execSync`'s shell-string form mangled the hex bucket's `\[` via `cmd.exe` re-parsing; (b) `-noE` (with `-o`) printed only the matched substring, so the comment-line filter saw `"—"` instead of the full line and falsely flagged `RadialGauge.tsx:11`'s JSDoc prose as a live violation; (c) a trailing Windows `\r` broke the `file:line:content` regex parser.
- **Fix:** Switched to `execFileSync` with an argv array; removed `-o`; strip `\r` from stdout before any per-line parse. All three documented inline in the helper functions' own JSDoc comments so the next editor sees the failure mode, not just the fix.
- **Files modified:** `src/tokenSweep.ratchet.test.ts`
- **Verification:** all 15 tests pass after each fix, re-confirmed against a fresh `npm run build`
- **Committed in:** `04451c3f`, `093db5f2`

---

**Total deviations:** 2 auto-fixed groups (8 real corpus violations found and fixed; 3 mechanism bugs in the ratchet itself found and fixed). Both are exactly the class of finding this plan exists to make routine rather than exceptional -- no scope creep, no exemption used as a shortcut.

## Issues Encountered

- `git grep`'s pathspec glob (`'src/pages/*.tsx'`) crosses directory boundaries unlike a shell glob, per `122-PAGEHEADER-ADOPTION.md`'s own recorded gotcha -- sidestepped entirely by deriving the PageHeader bucket's population via `fs.readdirSync` instead of a second `git grep` pathspec.
- Splitting Task 1 and Task 2 into two commits on the same file required a temporary strip-then-restore of the D-26 section (and its now-unused imports) between commits, verified independently green (`tsc` + `vitest`) at each intermediate state before committing, so neither commit's diff misrepresents what was actually tested at that point in history.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- The sweep this phase performed is now permanent: a hardcoded surface, hex, motion literal, raw violet, headerless page, or dishonest placeholder reintroduced anywhere in `src/` fails `npx vitest run` -- including in a file no planning document has ever mentioned, proven live by mutation (b).
- `122-RATCHET-EXEMPTIONS.md` names exactly what to do when `ForgePage.tsx`'s deferred PageHeader conversion eventually lands: remove that `KNOWN_EXEMPT` entry, not leave it as a stale blessing.
- Suite baseline exiting this plan: 346 files / 4873 passed / 0 failed (was 345/4858 entering it; +1 file / +15 tests from the ratchet itself, zero regressions elsewhere). `tsc --noEmit` and `npm run build` both exit 0. Ratchet runtime: ~540ms test execution, ~3.3s including Vite transform/import overhead, ~4.3s wall including node startup -- `122-VALIDATION.md`'s "Unmeasured" unit-suite feedback-latency line can now cite this figure.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

All 10 claimed files found on disk (this SUMMARY.md, the ratchet test file, the exemptions doc,
and the 8 fixed source files). All 3 commit hashes (`9ceaeb69`, `04451c3f`, `093db5f2`) found in
`git log --oneline --all`.
