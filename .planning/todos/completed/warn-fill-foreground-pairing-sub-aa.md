---
id: TODO-warn-fill-foreground-pairing-sub-aa
status: closed
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — surfaced by plan 122-10's rasterised contrast measurement while correcting the Forge `failed` badge
trigger_when: Phase 123 (A11Y-02, contrast remediation) — this is squarely that phase's work. Not a 122 defect: 122's sweep buckets are palette classes, hex literals, duration-NNN and raw violet; a sub-AA *token pairing* is contrast, which A11Y-02 owns.
scope: Small (3–4 call sites, one substitution each)
source: Measured 2026-08-19 by rasterised getImageData compositing during plan 122-10; call sites verified live in the working tree
resolves_phase: 123
closed: 2026-08-20
closed_by: 123-10 (D-05, widened at plan time to all 8 sites across 4 files)
last_reviewed: 2026-08-20
---

# The app's sanctioned solid-warn-fill idiom pairs to ~1.4–1.8:1

## What was measured

Plan 122-10 needed a Strong (filled) treatment for `auth_failed`. It first reused the app's
existing solid-warn-fill idiom — `bg-(--status-warn) text-(--foreground)` — because four files
already use it and it looked sanctioned. Rasterised (`getImageData`, compositing the fill over the
real surface, never a `getComputedStyle` string scrape), that pairing measures **~1.4–1.8:1**:
light foreground text on a bright amber fill. AA is 4.5:1.

122-10 rejected it and shipped `text-(--primary-foreground)` instead — a dark near-black token
already used app-wide for text on saturated fills — measured **10.69–11.47:1**. See
`122-BADGE-LAW.md` §8 for the full per-theme table.

## The live call sites (verified in the working tree, 2026-08-19)

```
src/components/IdeationRow.tsx:30       medium: "bg-(--status-warn) text-(--foreground)"
src/components/InboxCard.tsx:98         medium: "bg-(--status-warn) text-(--foreground)"
src/components/ScanResultsPanel.tsx:41  return "bg-(--status-warn) text-(--foreground)"
src/components/TaskDetail.tsx:29        medium: "bg-(--status-warn)"   (no explicit fg — inherits)
```

Control that the probe discriminates: `src/components/StatusBadge.tsx:55` now reads
`bg-(--status-warn) text-(--primary-foreground)` — the corrected form — and does not match the
defective pattern.

`InboxCard.tsx:12` and `ScanResultsPanel.tsx:12` additionally DOCUMENT the defective pairing in
their header comments, so those comments need correcting alongside the code or they will re-seed it.

## Why it is not fixed here

All four files were swept by Phase 122 waves 3 (slices B, C, D) for the four sweep buckets, and are
clean of those. This is a different defect class: both sides of the pairing are already proper
tokens. Fixing it is a contrast judgement, which is A11Y-02's remit, and Phase 122's own contrast
work is measurement only — `122-CONTRAST-BASELINE.md` is explicitly Phase 123's input, and 122
fixes no violations by design.

## Suggested fix

Substitute `text-(--foreground)` -> `text-(--primary-foreground)` at the three explicit sites,
give `TaskDetail.tsx:29` an explicit foreground rather than an inherited one, correct the two
header comments, and re-measure by rasterisation with a before/after control — not by scraping
computed colour strings, which Tailwind v4's `oklch()`/`oklab()` output silently defeats.

## Resolution (123-10, 2026-08-20)

This todo's own count was stale by the time 123-10 executed: a live re-derive found **8** sites
across the class (not 3-4), and the `ok`/`error` backgrounds needed their own measurement rather
than assuming the `warn` remedy transfers (`StatusBadge` has no `ok` entry, and its error remedy
pairs `--status-error-on-fill` with `--status-error-fill`, a different token pair). 123-10 added a
`STATUS_FILL_MATRIX` to `e2e/contrast-isolation.spec.ts` measuring `--foreground`,
`--primary-foreground` and `--status-error-on-fill` against `--status-error`/`--status-warn`/
`--status-ok`/`--status-error-fill` in all four themes (`e2e/.artifacts/123-isolation-pass2.json`,
`family: "status-fill"`). `--primary-foreground` measured clearing 4.5:1 against all three
backgrounds these 8 sites actually use, in every theme (worst cases: 5.45:1 on `--status-error`,
10.69:1 on `--status-warn`, 9.85:1 on `--status-ok`) — so, now traceable to a measurement rather
than a pattern match, all 8 sites were remedied to it:

- `IdeationRow.tsx:30` (medium/warn)
- `InboxCard.tsx:97,98,99` (high/error, medium/warn, low/ok)
- `ScanResultsPanel.tsx:39,41,43` (HIGH/error, MEDIUM/warn, LOW/ok) + its header comment (:10-14)
- `TaskDetail.tsx:67` — the assembled site this todo's own inventory missed (`:29` only holds the
  background half of the pairing in `PRIORITY_COLORS`; the foreground is applied once, at `:67`,
  to all three priorities). One token cleared all three backgrounds, so `:67`'s template was
  changed directly rather than moving the foreground into the `PRIORITY_COLORS` map.

`InboxCard.tsx:12`'s header-comment claim did not hold up on re-read — it is unrelated item-type
documentation, and `RiskBadge` (:95-99) carries no preceding comment at all — so only
`ScanResultsPanel.tsx`'s comment needed correcting.

Full detail: `.planning/phases/123-accessibility-remediation/123-10-SUMMARY.md`.
