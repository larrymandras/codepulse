# Phase 122 Plan 22: A11Y-01 Confirmation — aria-command-name Fix Verified Against a Real Browser

Confirms that `156d5116 fix(122-22)` (adding `aria-label={onClick ? label : undefined}` to
`MetricCard.tsx:264`) actually closes the 8 `aria-command-name` violation objects / 52 nodes that
122-21's after-matrix measured, and refreshes `122-CONTRAST-BASELINE.md`'s AFTER/Delta sections
against the current tree.

**Not assumed — measured.** A jsdom `getByRole` unit test already passed before this plan started;
that is a proxy. This confirmation is a real `@axe-core/playwright` run against a real Chromium
browser, hitting a real `dev:noauth` server, for all 20 theme x page cells.

Commits: `9daaba56` (test, preserve pre-aria capture), `84eb3192` (test, new capture),
`d32adf10` (docs, baseline update).

## What was done

**Preserved the pre-fix capture.** `git mv a11y-after/ a11y-after-prearia/` (20 files, `0
insertions(+), 0 deletions(-)`, pure rename verified by the commit's own diffstat) — 122-21's
post-ramp, pre-aria-fix after-matrix (32 objects / 250 nodes) stays available as a control. Three
capture directories now exist and are all preserved: `a11y-before/` (24/218, frozen since 122-01),
`a11y-after-preramp/` (32/261, the operator-rejected flat ramp, preserved by 122-21),
`a11y-after-prearia/` (32/250, the current ramp before the aria fix, preserved by this plan).

**Re-captured 20/20 cells against `156d5116`.** `dev:noauth` started from Git Bash
(`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`), probed on both `localhost:5181` and
`127.0.0.1:5181` (200/200, `[::1]:5181` correctly `000`) before running. Full matrix: 20/20
measured, 0 skipped, 12.2s wall-clock. Filenames match `a11y-before/` by name-level diff.
Disclosure scan: `grep -rF 'C:\Users\mandr'` on the new capture directory and on the updated
baseline doc → 0 hits both times, each paired with a known-present control (`http://localhost:5181`
→ 20/20 in the captures; `DashboardLayout.tsx` → 1 in the doc) so the zeros are believable. Server
stopped and confirmed down (`netstat` shows no LISTENING entry on 5181); `:5173` confirmed live
before, during, and after (`200` on every direct probe I ran).

**Replaced `122-CONTRAST-BASELINE.md`'s AFTER, rule-breakdown, and Delta-vs-BEFORE sections**, all
re-derived directly from the 20 new `a11y-after/*.json` files (Before section verified
byte-identical against `HEAD~1` before staging; Named-pair ratios/Method sections also verified
byte-identical by anchoring the diff on the section heading, not a line number, since the new
content shifted every line number below it).

**Added "Delta isolating the aria fix"** (new `a11y-after/` vs. the preserved
`a11y-after-prearia/`), the mirror of 122-21's ramp-isolation section — this is the comparison the
dispatch actually asked for, since it holds the ramp fixed and varies only the aria-label fix.
Kept 122-21's ramp-isolation section as a historical note (its two source captures are untouched by
this plan).

## Findings

### `aria-command-name` is confirmed absent — not inferred, verified directly

```
$ grep -rl 'aria-command-name' a11y-after/*.json
(no output — 0 of 20 files)
```

Same grep against the preserved pre-fix capture returns the 8 files where it fired
(`[cyan/emerald/readable/aubergine] Dashboard` and `Graphs`). A sample violating node from that
preserved capture:

```html
<div data-testid="metric-card" class="bg-card/60 backdrop-..." role="button" tabindex="0" style="cursor: pointer;">
```

`failureSummary`: "Element does not have text that is visible to screen readers / aria-label
attribute does not exist or is empty / aria-labelledby attribute does not exist... / Element has no
title attribute." No node with this shape exists anywhere in the 20 new files. The fix works.

### Object-level: exact cell-for-cell restoration to BEFORE

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 1 | 1 | 1 | 2 | 1 | **6** |
| emerald | 1 | 1 | 1 | 2 | 1 | **6** |
| readable | 1 | 1 | 1 | 2 | 1 | **6** |
| aubergine | 1 | 1 | 1 | 2 | 1 | **6** |
| **total** | **4** | **4** | **4** | **8** | **4** | **24** |

Identical to the `a11y-before/` table, every cell. **Grand total: 24 violation OBJECTS** (up from
32 at the prearia checkpoint, matching BEFORE exactly). Zero cells regressed, zero cells improved
at the object level — the fix closed exactly the 8-object regression 122-21 measured and moved
nothing else.

### Node-level: 209 nodes now (vs. 218 BEFORE, vs. 250 prearia)

**Grand total: 24 violation objects / 209 NODES.** Per-rule: `color-contrast` 20 objects / 205
nodes, `aria-prohibited-attr` 4/4 (Forge, unrelated markup defect, unchanged since BEFORE),
`aria-command-name` **0/0**.

### Isolating the fix's own effect (new AFTER vs. `a11y-after-prearia`)

Object level: exactly the predicted **-8** (`[Dashboard]`/`[Graphs]` × 4 themes, 1 object each),
zero movement in any other rule, zero new violations introduced.

Node level: -41 raw (250 → 209), traced per element rather than trusted as an aggregate:

1. **-52 nodes, the fix itself, clean.** All 52 `aria-command-name` nodes gone in every one of the
   8 cells that had them; grep confirms zero residue.
2. **+10 nodes, scan-timing noise, NOT caused by this fix.** The same `SYS:`/`LAT:` header badge
   122-21 already identified (`DashboardLayout.tsx:607-620`, gated on live backend data arriving
   before paint) appeared in this capture session on 10 node instances across `[cyan]
   LiveRun/Analytics/Forge/Graphs` and `[emerald] Dashboard/LiveRun/Analytics/Forge/Graphs`, absent
   from the prearia capture. **Control:** `readable`'s five cells show zero badge-node change
   between the two captures — its entire delta is `aria-command-name`, nothing else — which is what
   you'd expect if this is ordinary per-session backend-timing variance rather than anything the fix
   touched (an `aria-label` string cannot move a `color-contrast` count).
3. **-1 node, genuinely new, one item worth flagging for Phase 123.** `[aubergine] LiveRun` gained
   a `color-contrast` node absent from prearia: `.text-\(--muted-foreground\)`, **4.48:1** (needs
   4.5), `#877867` on `#120d18` — 0.02 short of AA. This is the *same element* 122-21's Root Cause 2
   flagged on cyan/emerald LiveRun as "not fully root-caused... flagged for Phase 123" (an
   intermediate semi-transparent layer axe can't attribute to a single CSS rule), now showing on a
   third theme. Not the badge (aubergine LiveRun's badge is present and unchanged in both captures)
   and not attributable to `156d5116` (an `aria-label` string cannot move a contrast ratio).

Arithmetic verified exactly: -52 + 10 + 1 = -41, matching 250 → 209. Nothing left unaccounted.

### Independent corroboration from a concurrent session

Commit `9220ab48` (a concurrent Codex-adversarial-review response, landed between my two `test`
commits without file collision) independently re-measured the same tree and reports the identical
figures: `color-contrast` 20/214 (before) → 20/205 (now), `aria-command-name` 8/52 → absent, object
total returned to 24. Cross-checked, not merely cited — its own diffstat shows it touched only
`122-FOLLOW-UPS.md` and a new todo file, nothing that could have influenced my measurement.

## Deviations from the dispatch

**Guard control not run — stated plainly, not silently skipped.** The dispatch permitted this
explicitly: "If the guard control needs :5173, skip it and say so plainly rather than claiming it
passed." I attempted a read-only Playwright run of the `[cyan] Dashboard` guard cell against the
occupied `:5173` server (the same pattern 122-21 used successfully); this session's own permission
classifier blocked it before execution ("Blocked by classifier"). I did not retry or work around
the block. In its place: `:5173` was probed directly with `curl` multiple times across the session
(before starting `dev:noauth`, immediately after stopping it) and returned `200` every time,
confirming the operator's server was live and undisturbed throughout, though this does not confirm
the `fee96b5d` Clerk-gate annotation text specifically (that file was not touched by this plan, so
it is unchanged by construction, verified by `git diff --stat` showing zero changes to
`e2e/theme-contrast.spec.ts` across all three commits).

No other deviations. Both `a11y-after-preramp/` and `a11y-before/` were left untouched (not
read-modified, not staged, not committed).

## Verification

- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0 (pre-existing chunk-size warning, unrelated to this plan)
- `npx vitest run` → **346 files passed / 4875 passed / 0 failed**, first run, matching the
  dispatch's documented baseline exactly (no re-run needed)
- `grep -rl 'aria-command-name' a11y-after/*.json` → 0 files (rule confirmed absent); same grep
  against `a11y-after-prearia/*.json` → 8 files (control proving the grep discriminates)
- Object/node totals cross-derived two ways each (summing per-file `violationCount`/node arrays,
  and summing the rule-breakdown table) — both agree at every level reported
- Disclosure scans: new `a11y-after/` captures 0/20 home-path hits (20/20 known-present control);
  `122-CONTRAST-BASELINE.md` 0 hits (1 known-present control, `DashboardLayout.tsx`); combined
  post-commit scan across all three commits' diffs → 0 hits (21 known-present control hits)
- `git diff --stat HEAD~3 HEAD -- .planning/STATE.md .planning/ROADMAP.md src/index.css src/` →
  empty (untouched across the whole session)
- Before section of `122-CONTRAST-BASELINE.md` diffed byte-for-byte against `HEAD~1` before
  staging → identical; Named-pair-ratios/Method sections diffed by heading anchor (line numbers
  shifted) → identical
- `git show --stat` on each of the three commits, read immediately after committing → task-scoped
  file sets only (20 renamed, 20 created, 1 modified); a concurrent session's commit (`9220ab48`)
  landed between my two `test` commits with zero file overlap, confirmed by its own diffstat
- `dev:noauth` confirmed stopped: `netstat -ano | grep 5181` → no `LISTENING` entry after kill
- `:5173` confirmed live before, during, and after this session (`200` on every direct probe run)
- No `gsd-sdk state.*`, `roadmap.*`, or `phase.complete` verb was run

## Self-Check

- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after-prearia/` — FOUND, 20 files
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/` — FOUND, 20 files (new content, post-fix)
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before/` — FOUND, 20 files, untouched
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after-preramp/` — FOUND, 20 files, untouched
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — FOUND, AFTER/Delta sections replaced
- Commit `9daaba56` — FOUND in `git log --oneline`
- Commit `84eb3192` — FOUND in `git log --oneline`
- Commit `d32adf10` — FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after-prearia/*.json` — 20 files, renamed from `a11y-after/`, content untouched (pre-fix control)
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/*.json` — 20 new files, re-captured against `156d5116`
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — AFTER/Delta sections replaced, Before/Named-pair-ratios/Method sections untouched
- `src/components/MetricCard.tsx` — read only, not modified by this plan (fix already landed in `156d5116` before this plan started)

## Metrics

- Duration: this session
- Commits: 3 (`9daaba56`, `84eb3192`, `d32adf10`)
- Files touched: 41 (20 renamed, 20 new, 1 modified)
- E2E matrix wall-clock: 12.2s (20 cells)
