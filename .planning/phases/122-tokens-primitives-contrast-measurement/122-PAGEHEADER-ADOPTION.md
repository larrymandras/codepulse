# PageHeader Adoption (D-17/D-18, plan 122-11)

Re-derived from the corpus, not from prose. All four figures below are **FILES** counts:
`ls | wc -l` counts files on disk; `git grep -l ... | wc -l` counts files with at least one
matching line. Neither is an occurrence count.

## Reproduction command

```bash
# Top-level pages: src/pages/*.tsx, excluding *.test.tsx
ls src/pages/*.tsx | grep -v '\.test\.' | wc -l
git grep -lF 'PageHeader' -- 'src/pages/*.tsx' | grep -v '\.test\.' | grep -v '/hr/' | wc -l

# Subdirectory pages: src/pages/*/*.tsx, excluding *.test.tsx
ls src/pages/*/*.tsx | grep -v '\.test\.' | wc -l
git grep -lF 'PageHeader' -- 'src/pages/*/*.tsx' | grep -v '\.test\.' | wc -l

# Which top-level pages don't adopt it
comm -23 \
  <(ls src/pages/*.tsx | grep -v '\.test\.' | sort) \
  <(git grep -lF 'PageHeader' -- 'src/pages/*.tsx' | grep -v '\.test\.' | grep -v '/hr/' | sort)
```

**Methodology note:** the top-level query's pathspec `'src/pages/*.tsx'` crosses directory
boundaries under `git grep` (git pathspec globs, unlike a shell glob, match `/`) -- run without
the `grep -v '/hr/'` filter, it silently double-counts the 5 `hr/` files into the top-level
number too. This was caught live: an unfiltered first pass returned "43 of 42" adopting, an
impossible count that only resolves once the subdirectory files are excluded from the
top-level query.

## Figures, before and after Task 2 (this plan's Analytics + BuildProgress conversion)

| population | denominator (FILES) | adopting BEFORE (FILES) | adopting AFTER (FILES) |
|---|---|---|---|
| top-level (`src/pages/*.tsx`) | 42 | 38 | 40 |
| subdirectory (`src/pages/*/*.tsx`, i.e. `src/pages/hr/`) | 5 | 5 | 5 |
| **combined** (D-24's corrected 47-route population) | **47** | **43** | **45** |

Combined arithmetic: 45 adopting + 2 non-adopting (below) = 47 = the re-derived denominator.

> **Do not propagate "44 of 62."** An earlier figure in this phase's discussion mixed the 20
> `.test.tsx` files into both the numerator and the denominator. It is wrong and is recorded here
> only to say so.

## Named exemption register

One entry per page that does not render `PageHeader`, each with its own reason -- a record a
reviewer can disagree with, not a blessing. This is the `KNOWN_EXEMPT` source plan 122-17's
ratchet consumes for the `PageHeader` bucket.

| page | status | reason |
|---|---|---|
| `src/pages/Chat.tsx:928` | **Exempt** | Full-bleed presence view (`/chat`), not a dashboard page. The `<h1>ÁSTRÍÐR</h1>` at `:928` is an 11px-scale mono brand wordmark (`font-mono font-bold tracking-[0.15em] text-base`) sitting inside a voice/avatar status row (`border-b border-border`, alongside a live listening-state line), not a page title competing with the content below it -- there is no "page" in the dashboard sense for `PageHeader` to head. This is the exemption `122-CONTEXT.md` D-18 predicted as the likely genuine case. |
| `src/pages/ForgePage.tsx:151` | **Deferred, not exempt** | Hand-rolls the identical shape `PageHeader` produces (its own comment says so: "standard CodePulse pattern (BuildProgress.tsx:24)") and is convertible. NOT converted in 122-11: it is outside this plan's `files_modified`, no other wave-4 plan (122-08, 122-12..122-19) owns it either -- 122-08 touched only a motion-duration class at `:175` in the same file, never the header block -- and a straight substitution would double the vertical spacing above the master-detail body (`PageHeader` bakes in `mb-4`; ForgePage's current header carries none, relying entirely on the parent's `space-y-4`). Filed as `.planning/todos/pending/forgepage-pageheader-adoption.md` with the exact conversion and a visual-regression check for a future plan to carry, rather than left silently unconverted. |

## What "every route" means, checkably

47 routes total (42 top-level `src/pages/*.tsx` + 5 `src/pages/hr/*.tsx`, both excluding
`*.test.tsx`). 45 render the shared `PageHeader`. Of the 2 that do not: 1 is a deliberate design
exemption (`Chat.tsx`), 1 is a convertible page with a filed todo and no owning plan
(`ForgePage.tsx`). Re-run the reproduction command above at any later point to check this claim
rather than re-deriving it from scratch or trusting this document's numbers to still be current.
