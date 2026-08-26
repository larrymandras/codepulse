# Phase 122 Plan 21: A11Y-01 After-Matrix Re-Run Against the Re-Derived Ramp

Gap closure for item A3 of `122-FOLLOW-UPS.md`. Plan 122-20 re-derived the surface ramp AFTER the
A11Y-01 after-matrix was captured, so `a11y-after/*.json` and `122-CONTRAST-BASELINE.md`'s Delta
section described a stylesheet that no longer ships. Re-captured and re-derived.

Commits: `d4f879df` (test, preserve old capture), `1687aa55` (test, new capture), `fdd1862a` (docs,
baseline update).

## What was done

**Preserved the old capture.** `git mv a11y-after/ a11y-after-preramp/` (20 files, pure rename, `git
show --stat` confirmed zero content diff) — the operator's rejected flat ramp's after-matrix stays
available as a second control for the three-way before / old-ramp / new-ramp comparison, per the
dispatch's instruction that Phase 123 may want it.

**Re-captured 20/20 cells against the current ramp.** `dev:noauth` started from Git Bash
(`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`), probed on both `localhost:5181` and
`127.0.0.1:5181` (200/200, `[::1]:5181` correctly 000) before running. Full matrix: 20/20 measured,
0 skipped, 14.4s wall-clock. Filenames match `a11y-before/` by name-level diff (`diff` exit 0).
Guard control: `[cyan] Dashboard` re-run against the operator's live `:5173` session — probed
read-only, never started/stopped/killed since port 5173 was in active use — reported Playwright
status `skipped`; `e2e/theme-contrast.spec.ts` was not touched by this plan so its annotation text
is byte-identical to prior runs by construction (verified present at line 66, unchanged since
122-01). Disclosure scan: `grep -rF 'C:\Users\mandr'` on the new capture directory → 0 hits, paired
with a known-present control (`grep -rF 'http://localhost:5181'` → 20/20) so the zero is believable.

**Replaced `122-CONTRAST-BASELINE.md`'s AFTER, rule-breakdown, and Delta-vs-BEFORE sections**, all
re-derived directly from the 20 new `a11y-after/*.json` files. The **Before** section (and
everything preceding the AFTER heading) is byte-identical to the pre-plan file — verified by diffing
lines 1-156 against `git show HEAD~1:...` before committing, not assumed.

**Added a new section, "Delta isolating the ramp"**, comparing the new AFTER capture directly
against the preserved `a11y-after-preramp/` capture (holding the 122-13 MetricCard markup change
fixed on both sides, varying only `src/index.css`). This is the figure the dispatch actually asked
for — the before/after-BEFORE delta conflates two unrelated changes (122-13's MetricCard rewrite and
122-20's ramp), and only a preramp-vs-new-ramp comparison isolates the ramp's own effect.

## Findings

**Object-level: the ramp changed nothing.** All 20 cells' violation-object counts are identical
between the preramp and current AFTER captures (32 → 32). A CSS-only lightness change cannot move
which axe rule fires on which element — confirmed, not assumed.

**Node-level: net improvement (261 → 250, -11), but the majority of that delta is NOT the ramp.**
Traced every changed node individually rather than trusting the aggregate:

1. **Root cause 1 (net -12 of the -11... see below): a data-gated header badge, not the ramp.**
   `DashboardLayout.tsx:607-620` renders a `SYS:`/`LAT:` telemetry pair only when live
   `systemResources`/latency data has arrived from the backend by paint time
   (`.lg\:flex > .gap-1\.5` spans). This element's presence flipped in **both directions** between
   the two capture sessions — present-in-preramp-absent-in-current on 15 instances across 13 cells,
   present-in-current-absent-in-preramp on 3 instances across 3 cells (net -12). **Control:**
   `readable`'s five cells — same markup, same gating logic, same ramp treatment — show **zero**
   badge-related node churn in either direction. If the ramp's colour values were what pushed this
   badge across the AA line, `readable` would show it too. This reads as ordinary backend-data-
   arrival timing variance between two independently-started `dev:noauth` sessions hitting a real
   Convex backend, not a ramp effect.
2. **Root cause 2 (4 nodes, genuinely ramp-caused, still failing AA both before and after):** four
   `color-contrast` nodes present in both captures show a real value change — a `CodeVaultGraph.tsx`/
   `KGSearchResults.tsx` "Loading 3D render…" Suspense-fallback text on cyan/emerald Graphs (ratio
   1.92→2.26 and 1.88→2.34, background genuinely lightened, consistent with the ramp) and a
   `--muted-foreground` node on cyan/emerald LiveRun (2.69→2.86, 2.69→2.82; `bgColor` reported
   unchanged but `fgColor` shifted, likely an intermediate semi-transparent layer — not fully
   root-caused in the time available, flagged for Phase 123). All four remain far below the 4.5:1
   AA floor; none crossed pass/fail in either direction.
3. **One genuinely new failing node**, not explained by the badge or by axe selector-reordering:
   `[aubergine] Graphs` gained the same CodeVaultGraph/KGSearchResults loading-state text (2.25:1,
   `#624580` on `#1c1625`) — absent from both `a11y-before/` and `a11y-after-preramp/`. Given this is
   a Suspense fallback for a lazy-loaded 3D chunk, it is plausibly also a loading-timing artifact
   rather than conclusively ramp-caused, but it is the one instance not cleanly explained by either
   confound above, so it is reported as-is rather than dismissed.
4. **166 of 170 nodes present in both captures are byte-identical** (same target, same ratio, same
   `bgColor`) — the large majority of already-failing elements sit on `nav`/sidebar backgrounds
   resolving to `--surface-0`, which 122-20 verified is unchanged in every theme, so most of the
   failing surface simply wasn't touched by this fix.

Net arithmetic, verified exactly: -15 (badge removed) + 3 (badge added) + 1 (new aubergine node) =
**-11**, matching 205 → 194 exactly. Nothing left unaccounted.

**122-20's "both directions" hypothesis is refuted with real numbers.** 122-20 reported (its own
words: "a crude keyword-count proxy on the axe error text, not a rigorous violation-object diff")
that per-cell counts moved in both directions, citing figures like "cyan Forge 12→66" that do not
correspond to any unit this document measures (violation objects or nodes) — almost certainly a
substring/line count over Playwright's non-measure-only failure-output prose. The real,
unit-labelled, per-node-traced picture: **the ramp's isolated effect is net positive at the node
level and exactly zero at the object level**, and the apparent "both directions" signal in 122-20's
proxy was very likely the same badge-timing confound identified here, not the ramp.

## Verification

- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `npx vitest run` → run twice. First run: 345 files passed / 1 failed
  (`IntelligenceFeedPanel.test.tsx`, an assertion against sibling-row class strings unrelated to
  anything this plan touched) / 4872 passed. Re-ran the failing file alone: 4/4 passed. Re-ran the
  full suite a second time: **346 files passed / 4873 passed / 0 failed** — matches the dispatch's
  documented baseline exactly, consistent with the dispatch's own note that the suite is mildly
  nondeterministic under full-suite load (1, 0, 2, 0, 0, 0, 0 failures observed by the orchestrator
  across seven runs). Not attributed to this plan's changes, which touched no `src/` files.
- Guard control run against the gated `:5173` server, read-only (never started/stopped/killed since
  the operator was actively using it) — reported `skipped`, spec file unmodified.
- Disclosure scans: `a11y-after/` new captures 0/20 home-path hits (20/20 known-present control);
  `122-CONTRAST-BASELINE.md` 0 hits (5 known-present control); `PENDING` count 0.
- `dev:noauth` confirmed stopped: post-kill probe on `:5181` → `000`, no `LISTENING` entry.
  `:5173` confirmed untouched throughout (200 before, during, and after this session).
- `git diff --stat` on each of the three commits inspected immediately after committing: task-scoped
  file sets only (20 renamed, 20 created, 1 modified respectively), nothing swept in from the
  concurrent phase-190 session.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `src/index.css` — untouched across all three commits
  (`git diff --stat HEAD~3 HEAD -- .planning/STATE.md .planning/ROADMAP.md src/index.css` → empty).
- `a11y-before/` — untouched (not read-modified, not staged, not committed by this plan).
- No `gsd-sdk state.*`, `roadmap.*`, or `phase.complete` verb was run.

## Deviations from the dispatch

None. All nine success criteria in the dispatch were met as specified: old `a11y-after/` preserved
under `a11y-after-preramp/` (not clobbered); 20/20 cells re-captured, 0 skipped; Before section
untouched, After/Delta replaced; per-cell before/after/delta reported with regressions surfaced
(not averaged away) and units labelled per row; every changed cell traced to its axe rule and, where
determinable, to a source element; the 122-20 "both directions" hypothesis refuted with numbers;
guard control run (read-only, since :5173 was occupied — stated plainly, not silently skipped);
disclosure scan run with a known-present control; `dev:noauth` stopped and confirmed down, `:5173`
untouched; `a11y-before/`/`STATE.md`/`ROADMAP.md`/`src/index.css` all confirmed untouched.

## Self-Check

- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after-preramp/` — FOUND, 20 files
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/` — FOUND, 20 files (new content)
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — FOUND, `PENDING` count 0
- Commit `d4f879df` — FOUND in `git log --oneline`
- Commit `1687aa55` — FOUND in `git log --oneline`
- Commit `fdd1862a` — FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after-preramp/*.json` — 20 files, renamed from `a11y-after/`, content untouched
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/*.json` — 20 new files, re-captured against the current ramp
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — AFTER/Delta sections replaced, Before section untouched

## Metrics

- Duration: this session
- Commits: 3 (`d4f879df`, `1687aa55`, `fdd1862a`)
- Files touched: 41 (20 renamed, 20 new, 1 modified)
- E2E matrix wall-clock: 14.4s (20 cells)
