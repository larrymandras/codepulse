# 120-01 Sweep Evidence: `hover:scale-[1.01]` + `transition-transform duration-300`

Plan: `120-01-PLAN.md`. All output below is pasted verbatim from commands run against the working
tree after Tasks 1 and 2 completed, using fixed-string matchers throughout
(`git grep -cF` / `git grep -nF`) per the plan's warning that `hover:scale-[1.01]` contains regex
metacharacters and an unflagged grep silently under-matches.

## Before (measured at plan start, re-derived independently rather than copied from the plan text)

```
$ git grep -cF 'hover:scale-[1.01]' -- src/ | awk -F: '{sum+=$2} END {print sum" occurrences"}'
110 occurrences
$ git grep -cF 'hover:scale-[1.01]' -- src/ | wc -l
38
$ git grep -cF 'transition-transform duration-300' -- src/ | awk -F: '{sum+=$2} END {print sum" occurrences"}'
110 occurrences
$ git grep -cF 'transition-transform duration-300' -- src/ | wc -l
37
$ git grep -cF 'glow-card' -- src/ | awk -F: '{sum+=$2} END {print sum}'
38
```

These match the plan's stated measured population (110/38, 110/37) exactly.

## 1. Residual `hover:scale-[1.01]` count across all of `src/` AFTER this plan

```
$ git grep -cF 'hover:scale-[1.01]' -- src/ | awk -F: '{sum+=$2} END {print "TOTAL: "sum}'
TOTAL: 3
$ git grep -nF 'hover:scale-[1.01]' -- src/
src/components/HeroStatsBar.tsx:124:      <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative group overflow-hidden hover:border-primary/50 transition-colors shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] hover:scale-[1.01] transition-transform duration-300">
src/pages/WarRoom.tsx:296:            className={`w-64 flex-shrink-0 rounded-xl overflow-hidden flex flex-col hover:scale-[1.01] transition-transform duration-300 fixed inset-y-0 left-0 z-50 md:static md:z-auto md:translate-x-0 ${
src/pages/WarRoom.tsx:376:          <GlassPanel className="flex-1 flex flex-col rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
```

**This is NOT zero, and that is correct.** The residue is exactly the 3 occurrences in the two
files this plan deliberately excludes: `src/pages/WarRoom.tsx` (2 — the F8 mobile drawer at
`:296`, plus a second `GlassPanel` at `:376` not named in this plan's `<interfaces>` block but
owned by the same file) and `src/components/HeroStatsBar.tsx` (1, at `:124`). Both files are
outside this plan's `files_modified` by design — `WarRoom.tsx` is owned by plan **120-03** and
`HeroStatsBar.tsx` by plan **120-05**, each of which removes its own occurrences alongside other
work it does in that file. POLISH-01's repo-wide "zero live hits" criterion is closed by those two
plans, not this one. Reporting "zero" here would be a false green.

## 2. `transition-transform duration-300` count AFTER this plan, with survivors named

```
$ git grep -cF 'transition-transform duration-300' -- src/ | awk -F: '{sum+=$2} END {print "TOTAL: "sum}'
TOTAL: 6
$ git grep -nF 'transition-transform duration-300' -- src/
src/components/HeroStatsBar.tsx:124:      <div className="glow-card ... hover:scale-[1.01] transition-transform duration-300">
src/components/hr/CatalogCard.tsx:31:    <div className="bg-card/80 ... hover:-translate-y-1 transition-transform duration-300">
src/components/hr/CatalogCard.tsx:33:        <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">{categoryEmoji(entry.category)}</span>
src/components/hr/TeamCard.tsx:29:    <div className="group bg-card/80 ... hover:-translate-y-1 relative overflow-hidden transition-transform duration-300">
src/pages/WarRoom.tsx:296:            className={`w-64 ... hover:scale-[1.01] transition-transform duration-300 fixed inset-y-0 left-0 z-50 md:static md:z-auto md:translate-x-0 ${
src/pages/WarRoom.tsx:376:          <GlassPanel className="flex-1 flex flex-col rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
```

(Class strings truncated with `...` above only for readability in this table; the raw `git grep`
output used to derive the counts was the unabridged version.)

All 6 surviving sites, with justification:

| Site | Justification |
|---|---|
| `CatalogCard.tsx:31` | Owned by this plan (Task 2). Still animates `hover:-translate-y-1` on the same element — that transform is not on the kill list, so the transition still has a live consumer. |
| `CatalogCard.tsx:33` | Owned by this plan (Task 2, explicitly not touched). `group-hover:scale-110 transition-transform duration-300` on the category emoji — this is a different transform (`scale-110`, not `scale-[1.01]`) and was never on the kill list. |
| `TeamCard.tsx:29` | Owned by this plan (Task 2). Same shape as CatalogCard:31 — animates the surviving `hover:-translate-y-1`. |
| `HeroStatsBar.tsx:124` | NOT this plan. Owned by **120-05**, which removes its own `hover:scale-[1.01]` + `transition-transform duration-300` pair alongside other work in that file. |
| `WarRoom.tsx:296` | NOT this plan. Owned by **120-03**. Load-bearing for the F8 mobile room-list drawer: the template literal toggles `translate-x-0` / `-translate-x-full`, so removing the transition here would make the drawer snap instead of slide. |
| `WarRoom.tsx:376` | NOT this plan. Owned by **120-03**, same file. Not named in this plan's `<interfaces>` block (which only called out `:296`) — recorded here as an additional data point for 120-03, not something this plan judged or altered. |

Within this plan's 36 owned files, `transition-transform duration-300` survives on exactly
`CatalogCard.tsx:31`, `CatalogCard.tsx:33` and `TeamCard.tsx:29` — matching the plan's stated
verification target (CatalogCard:28/30 and TeamCard:26 in the plan's stale 2026-08-17 line
numbers; the content is identical, only the line numbers shifted by the inline D-01 comments this
plan added above each `return (`).

## 3. `glow-card` control count (unchanged, whole `src/`)

```
$ git grep -cF 'glow-card' -- src/ | awk -F: '{sum+=$2} END {print "TOTAL: "sum}'
TOTAL: 38
```

Before: 38. After: 38. **Unchanged.** This is the control proving the sweep was surgical rather
than greedy — D-01 forbids touching `glow-card` (and the co-located `shadow-[var(--glow-*)]` /
`hover:border-primary/50` classes) anywhere in the repo, not just inside this plan's 36 files. A
zero on the scale count with a changed `glow-card` count would have meant D-01 was violated; the
count held.

Scoped control, this plan's 34 Task-1 files only (before value re-derived from `git show HEAD:<file>`
per file, summed):

```
BEFORE total (git show HEAD:<file>, summed across the 34 Task-1 files): 20
AFTER total (git grep -cF 'glow-card' -- <34 Task-1 files>, summed):     20
```

Also unchanged.

## 4. Lines where the rule was ambiguous

**None in Task 1.** Before scripting the per-line transformation, every one of the 34 Task-1
files' `hover:scale-[1.01]`-carrying lines was checked for a competing transform utility
(`translate-`, `rotate-`, `skew-`, `group-hover:scale-`, or a second bare `scale-`) on the same
line:

```
$ git grep -nF 'hover:scale-[1.01]' -- <34 Task-1 files> | grep -E 'translate-|rotate-|skew-|group-hover:scale-'
(no output)
```

Zero hits — every Task-1 line carried `hover:scale-[1.01]` as the only transform utility, so the
per-line rule reduced deterministically to "remove both the scale and the transition" for all 105
occurrences in those 34 files (110 total minus 2 WarRoom + 1 HeroStatsBar + 1 CatalogCard + 1
TeamCard = 105). No line needed a judgment call.

**One near-miss caught and corrected during Task 2, not during the sweep itself:** the first draft
of the D-01 inline comments added above `CatalogCard`'s and `TeamCard`'s `return (` used the literal
string `hover:scale-[1.01]` in the comment prose. That literal string then satisfied
`git grep -cF 'hover:scale-[1.01]'` on both files (count 1 each), which would have made this plan's
own Task 2 acceptance criterion ("returns 0 for both") fail on a comment rather than on live code.
Reworded both comments to describe the change without repeating the literal class token; re-ran the
grep and confirmed 0 for both files. Recorded here because it is exactly the class of false-positive
(and, had it gone the other way, false-negative) that a literal-string grep gate is vulnerable to.

**One stale-plan discrepancy, not a rule ambiguity:** the plan's Task 2 acceptance criteria expected
`git grep -cF 'hover:-translate-y-1' -- CatalogCard.tsx TeamCard.tsx` to return 1 for each file.
`CatalogCard.tsx` actually contains a *second*, unrelated `hover:-translate-y-1` at line 80 (an "add
new" placeholder card, not part of the kill-list sweep, never containing `hover:scale-[1.01]` or
`transition-transform`), so the correct scoped count for that file is 2, not 1. Verified line 80 is
untouched by this plan's diff (`git diff src/components/hr/CatalogCard.tsx` shows no hunk touching
that region) and the edited line (`:31`) still carries `hover:-translate-y-1`. This is a stale
expected-count in the plan, not a defect in the sweep.

## Population reconciliation

```
110 total hover:scale-[1.01] occurrences (measured population)
-  1  CatalogCard.tsx  (Task 2, scale removed)
-  1  TeamCard.tsx     (Task 2, scale removed)
-105  Task 1's 34 files (scale removed, transition removed with it — verified zero co-located
                          transform utility on every one of these lines)
-  3  WarRoom.tsx (2) + HeroStatsBar.tsx (1) — NOT this plan, owned by 120-03 / 120-05
=  0  remainder
```
