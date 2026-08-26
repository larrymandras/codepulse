# Phase 122 Plan 10: Badge Law Summary

Built the shared `StatusBadge` primitive Phase 120's D-16 deferred to this phase and re-keyed
emphasis app-wide from "which legacy semantic bucket a word fell into" to a four-tier operational-
severity system (D-07): execution modes get their own visual grammar, `auth_failed` moves from
quiet to filled, and the app's one sub-AA badge (`Forge failed`, 3.81-4.93:1) is corrected to
10.02:1 in every theme via a rasterised measurement whose own control proves it can report a
failure.

## Tasks completed

1. **Re-check the inventory and write the tier assignment** — re-ran the inventory's own consumer
   derivation (byte-identical to `120-BADGE-INVENTORY.md`'s 22 files), assigned every state entry
   across four badge modules to Strong/Quiet/Quietest/Mode, and adjudicated both open items
   (`WebhookStatusBadge` = not a badge under this law; `WarRoomTaskCard`'s `task.priority` = stop
   routing through `StatusBadge`). `122-BADGE-LAW.md`.
2. **Restructure `StatusBadge.tsx` to D-07 severity tiers** — added a `tier` axis orthogonal to
   `semantic`; `strict`/`adaptive`/`standard`/`filler` move to a dashed-border mode grammar;
   `failed`/`regression`/`verify_rejected`/`stalled` move to the new `--status-error-fill` pairing;
   `completed`/`done`/`deregistered` flatten to a quietest tier. `WarRoomTaskCard.tsx` stops
   routing priority through the badge.
3. **Correct the Forge `failed` pairing and bring `IntakeStatusBadge` under the law** — Forge's
   `failed` moves off the sub-AA translucent fill onto the opaque `--status-error-fill`/
   `-on-fill` pair; `auth_failed` moves to Strong; both badge modules' remaining zinc literals are
   detokenized; `IntakeStatusBadge`'s three filled maps re-tier per the law.

## Key decisions

- **`auth_failed`'s foreground was measured and changed mid-plan.** The obvious choice — reusing
  the app's existing `text-(--foreground)` solid-warn-fill idiom (`IdeationRow.tsx`,
  `InboxCard.tsx`, `ScanResultsPanel.tsx`, `TaskDetail.tsx`) — rasterised to 1.37-1.83:1 across all
  four themes, far below AA (light text on a bright amber fill). Corrected to
  `text-[var(--primary-foreground)]`, measuring 10.69-11.47:1. This is the single most consequential
  finding of the plan: an established, seemingly-safe pattern elsewhere in the app was actually
  never contrast-checked in this specific pairing, and copying it would have shipped a second
  sub-AA badge while "fixing" the first.
- **`deregistered` and `done` move tiers beyond the two changes D-07 names explicitly.** D-07's own
  text calls out only `strict` and `auth_failed` as headline changes. Implementing its four-tier
  table literally (not just its two examples) requires `deregistered` (currently filled only as a
  side effect of sharing the `error` semantic with genuine failures) to move to Quietest, and swarm
  `done` to share `completed`'s Quietest tier while keeping its own `DONE` label — tier and
  vocabulary are orthogonal. Recorded in `122-BADGE-LAW.md` §2 as discovered changes, not silently
  folded into "the two named cases."
- **`WarRoomTaskCard.tsx:66`'s pre-existing bug is fixed, not just documented a third time.**
  `task.priority` had always silently rendered through `StatusBadge`'s `idle` fallback (flagged by
  120, flagged again by the inventory, never fixed). It now gets its own small chip reusing the
  card's existing `PRIORITY_BORDER` colour mapping; the now-unused `StatusBadge` import is removed.
- **IntakeStatusBadge's Strong-tier entries were picked by matching D-07's named categories to
  this vocabulary's own words**, not by re-flattening everything: `ROW_STATUS_MAP.failed` (named
  directly), `SEVERITY_MAP.error` (same "needs action" category as `regression`), `VERDICT_MAP.reject`
  (D-07 literally names "rejected verification", and a `reject` verdict is one). `VERDICT_MAP.error`
  (a distinct, lesser, process-level condition, already keyed to `warn` by its own original author)
  was deliberately left unchanged — not every "error"-named key means the same thing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `auth_failed`'s foreground token measured sub-AA, corrected before shipping**
- **Found during:** Task 3, the required rasterised measurement
- **Issue:** The plan's own action text pointed at the app's existing `bg-(--status-warn)
  text-(--foreground)` solid-warn-fill idiom as the reuse target. Measuring it (not required by
  the acceptance criteria, which only mandate measuring `failed` — done anyway per this plan's own
  colour-measurement discipline) found 1.37-1.83:1, four separate below-AA failures across the
  four themes.
- **Fix:** Foreground changed to `text-[var(--primary-foreground)]` (an existing dark-near-black
  token, no new token added). Re-measured: 10.69-11.47:1 in all four themes.
- **Files modified:** `src/components/forge/ForgeStatusBadge.tsx`, `src/components/StatusBadge.tsx`
  (the shared `strongStyles.warn` entry, for consistency and so the direct-semantic-literal calling
  convention can express the same corrected pairing)
- **Commit:** `85b97ec0`

**2. [Rule 1 - Bug] Two stale test literals in `IntakeStatusBadge.test.tsx`**
- **Found during:** Task 3, after re-tiering `ROW_STATUS_MAP.failed` and `VERDICT_MAP.admit`
- **Issue:** `failed uses --status-error, not bg-red-900` asserted the OLD quiet `/20` token;
  `verdict admit uses --status-ok, not bg-green-900` asserted a colour token `admit` no longer
  carries once flattened to Quietest.
- **Fix:** Both assertions rewritten to check the new tier's actual class string, with a comment
  explaining the change; a repo-wide grep for the old literal strings found no other consumer
  asserting on them.
- **Files modified:** `src/components/skills/IntakeStatusBadge.test.tsx`
- **Commit:** `85b97ec0`

**3. [Rule 2 - missing critical functionality] `bg-red-900/60` literal text removed from my own
   explanatory comments**
- **Found during:** Writing `ForgeStatusBadge.tsx`'s header comment
- **Issue:** The task's acceptance criteria include `git grep -cF 'bg-red-900/60' --
  ForgeStatusBadge.tsx` returning 0 — a strict literal check with no comment carve-out. My first
  draft of the historical-context comment quoted the old class string verbatim twice, which would
  have failed that check even though the actual `className` values were already correct.
- **Fix:** Rephrased both comments to describe the old value in prose ("the old translucent dark-
  red bg (60% opacity)") instead of the literal Tailwind class string.
- **Files modified:** `src/components/forge/ForgeStatusBadge.tsx`
- **Commit:** `85b97ec0`

### Out of scope, noted

- **`src/components/chat/VitalsRail.tsx:177`** still has one `bg-gray-500` literal (Docker
  container `exited` status colour). A corpus-wide sweep after Task 3
  (`git grep -lE 'bg-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}|...' -- 'src/**/*.tsx'` excluding
  test files) found exactly this one file remaining. It is not a badge component (not
  `StatusBadge`/`ForgeStatusBadge`/`IntakeStatusBadge`), not in this plan's `files_modified`, and
  `120-FABRICATION-INVENTORY.md`/`122-CONTEXT.md` D-16 assign `VitalsRail.tsx` to a different 122
  concern (the fabricated Convex-health dot) — left untouched. The badge-specific corpus census
  (the three files this plan owns) is closed; the whole-repo neutral-palette census is not this
  plan's scope and has one known remaining site outside it.

## Mutation proofs

- **`StatusBadge.tsx`:** temporarily restored `strict: { semantic: "error", ..., tier: "strong" }`
  (its pre-plan form) — both the "strict is not failed" and "strict renders mode grammar" tests
  went RED (2 of 19). File stayed syntactically valid throughout. Reverted, confirmed 19/19 GREEN.
- **`ForgeStatusBadge.tsx` + `IntakeStatusBadge.tsx`:** temporarily restored `failed`'s old
  translucent class and `reject`'s old quiet-`/20` class — exactly the 4 fill-law tests guarding
  those two entries went RED (of 67 across both files), nothing else. Reverted, confirmed 67/67
  GREEN.

## Rasterised contrast measurements

Full method, per-theme tables, and raw RGB values recorded in `122-BADGE-LAW.md` §8. Summary:

| Pairing | cyan | emerald | readable | aubergine | Verdict |
|---|---|---|---|---|---|
| Forge `failed` — NEW (shipped) | 10.020:1 | 10.020:1 | 10.020:1 | 10.020:1 | PASS all four |
| Forge `failed` — OLD (control) | 3.811:1 | 3.881:1 | 4.857:1 | 4.927:1 | FAILS on cyan/emerald (proves the probe can report a failure); readable/aubergine were never sub-AA, matching `120-DESIGN-REVIEW-HANDOFF.md` |
| `auth_failed` — rejected candidate | 1.833:1 | 1.833:1 | 1.388:1 | 1.374:1 | FAIL all four |
| `auth_failed` — shipped | 10.686:1 | 10.686:1 | 11.343:1 | 11.473:1 | PASS all four |

Method: Playwright + canvas, mirroring `122-03`'s own script — colour strings (including the old
pairing's `oklab(0.396 0.127027 0.0611969 / 0.6)`) handed to `canvas.fillStyle` (a real colour
parser, never a regex), rasterised with `getImageData`, translucent fills composited over each
theme's `--card` via canvas's own alpha blending before computing the ratio. Known-value control
(`#ffffff`/`#000000` round-tripped exactly) and known-invalid control (`fillStyle` left the
sentinel in place rather than silently guessing) both confirmed before trusting any real value.
Measured class strings were rendered from the actual shipped source — Tailwind's Vite-plugin JIT
scanner only compiles a utility class once its literal text exists somewhere in the module graph,
so a throwaway probe component was temporarily side-effect-imported from `main.tsx` to get the
`--primary-foreground`/`--background` candidate utilities compiled, then both the probe file and
the import were deleted before any commit — `git status --short` confirms neither ever entered the
working tree at commit time (verified after Task 3's commit, `git show --stat HEAD` lists only the
six intended files).

## Self-Check

- `test -f .planning/phases/122-tokens-primitives-contrast-measurement/122-BADGE-LAW.md` → FOUND
- `git log --oneline -3` → `85b97ec0`, `b0c32224`, `bc5220cc` all present in history
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `npx vitest run` → 341 files passed | 17 skipped (358), 4823 tests passed | 197 todo (5020), 0
  failing — baseline was 341/4804/0 before this plan; delta of +19 tests matches the sum of new
  tests added across the three touched test files (StatusBadge.test.tsx +12,
  ForgeStatusBadge.test.tsx +4, IntakeStatusBadge.test.tsx +3)
- `git grep -cF 'bg-red-900/60' -- src/components/forge/ForgeStatusBadge.tsx` → 0
- `git grep -cF 'status-error-fill' -- src/components/forge/ForgeStatusBadge.tsx` → 4 (consumed,
  not just declared)
- `git grep -cE 'bg-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}|-\[#' -- src/components/skills/IntakeStatusBadge.tsx` → 0
- `git diff -- src/components/forge/ForgeStatusBadge.tsx | grep -iE "data-status|aria-label|colorScheme|animate-spin|Icon:"` → no output (unchanged, confirmed by reading the diff, not counting)
- No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/index.css` —
  `git show --stat` on all three commits confirms none of those three paths appear

## Self-Check: PASSED
