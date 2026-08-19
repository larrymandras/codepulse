---
id: TODO-forge-loading-div-aria-prohibited-attr
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — present in every A11Y-01 capture; independently re-flagged by a Codex adversarial review of the phase
trigger_when: Phase 123 (A11Y-02). IMPORTANT — A11Y-02's success criterion is written as "no wcag2a/wcag2aa violations", which does cover this rule, but the phase is framed throughout as CONTRAST remediation. This one is markup, not colour, and will be missed if 123 is planned as a colour-only sweep.
scope: Trivial (one element; add a permitting role, or expose the label through a status element)
source: Measured in all four Forge cells of every A11Y-01 capture, 2026-08-19; src/components/forge/ForgeJobList.tsx:174
resolves_phase: null
last_reviewed: 2026-08-19
---

# Forge's loading container is a roleless `div` carrying `aria-label`

## The violation

axe rule **`aria-prohibited-attr`**, severity **serious**. Measured at **4 objects / 4 nodes**,
one per theme, in the `[*] Forge` cell of every capture. The offending node:

```html
<div class="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading jobs">
```

`aria-label` is not permitted on an element with no role — a generic `div` exposes no accessible
name to assistive technology, so the intended "Loading jobs" announcement is silently dropped.

Source: `src/components/forge/ForgeJobList.tsx:174`.

## Pre-existing, not caused by Phase 122

Verified against the pre-phase tree: the same attribute is at
`001c1e73:src/components/forge/ForgeJobList.tsx:170`. Phase 122 shifted it four lines (slice E's
em-dash work elsewhere in the file) and changed nothing about it.

The frozen `a11y-before/` control records `aria-prohibited-attr` at **4 objects / 4 nodes**, and
every subsequent capture — old-ramp, new-ramp, post-aria-fix — records exactly **4 / 4**. It has
never moved. 122-01's own summary already called it out as "an unrelated markup defect, a
`div aria-label` without a permitting role, not a colour issue".

## Why it is worth a todo despite being pre-existing

An external adversarial review (Codex, 2026-08-19) flagged it as a ship blocker for Phase 122. It
was refuted as a Phase 122 defect on the evidence above — but the underlying defect is real, it is
`serious` severity, and it is the kind of thing that slips between phases: **it is an ARIA failure
sitting inside a matrix everyone reads as "the contrast matrix"**.

`122-CONTRAST-BASELINE.md` already warns that A11Y-02's criterion "is honest about the 5 cells it
covers and silent about the other 42". This is the same blind spot on a different axis — honest
about colour, easy to overlook on rule type.

## Suggested fix

Give the container a role that permits an accessible name and matches its purpose — `role="status"`
(with `aria-live` semantics already implied) is the natural fit for a loading region, and pairs
correctly with the existing `aria-busy="true"`. Alternatively drop `aria-label` and render visible
loading text inside a status element.

**Check the test first:** `src/pages/ForgePage.test.tsx:154` queries this element by its
`aria-label` and its comment documents the dependency, so any change must update that assertion in
the same commit. After the fix, re-run the four Forge cells and confirm `aria-prohibited-attr`
drops from 4/4 to absent — with the frozen `a11y-before/` figure as the control proving the probe
would have seen it.
