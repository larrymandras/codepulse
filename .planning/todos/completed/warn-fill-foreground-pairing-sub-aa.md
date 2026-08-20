---
id: TODO-warn-fill-foreground-pairing-sub-aa
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — surfaced by plan 122-10's rasterised contrast measurement while correcting the Forge `failed` badge
trigger_when: Phase 123 (A11Y-02, contrast remediation) — this is squarely that phase's work. Not a 122 defect: 122's sweep buckets are palette classes, hex literals, duration-NNN and raw violet; a sub-AA *token pairing* is contrast, which A11Y-02 owns.
scope: Small (3–4 call sites, one substitution each)
source: Measured 2026-08-19 by rasterised getImageData compositing during plan 122-10; call sites verified live in the working tree
resolves_phase: null
last_reviewed: 2026-08-19
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
