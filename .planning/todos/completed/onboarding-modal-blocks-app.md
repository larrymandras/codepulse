---
id: onboarding-modal-blocks-app
title: OnboardingGuide modal blocks all clicks (no close button, full-screen)
type: bug
area: ux
priority: medium
status: pending
created: 2026-06-22
discovered_in: phase 84 UAT
resolves_phase:
evidence: src/components/OnboardingGuide.tsx:49
---

## Problem

`OnboardingGuide` renders a full-viewport modal (`fixed inset-0 z-50 bg-black/60
backdrop-blur-sm`, `pointer-events: auto`) on **every route** whenever
`localStorage["codepulse_onboarding_complete"]` is unset (fresh profile, cleared
site data, incognito, or a brand-new browser). It intercepts **all** clicks —
tiles, nav, graph, filter chips — until dismissed.

The only ways to dismiss it are a subtle text "Skip" link or stepping Next →
Next → Next → "Done". There is **no X / close affordance** and **no Escape
handler**, so an operator who doesn't engage the wizard is silently locked out
of the entire app and reads it as "nothing is clickable."

Surfaced during Phase 84 UAT (`/graphs`): operator reported "can't click on
anything." Root cause was this modal, not the Graphs Hub. All hub interactions
work once it is dismissed (verified via Playwright with the flag pre-set).

Evidence: `src/components/OnboardingGuide.tsx:49` (overlay), `:43-46` (dismiss).

## Why it matters

A first-run onboarding modal that fully blocks the app with no obvious exit is a
new-user landmine — the same trap a real operator hits on first visit, in a
fresh browser, or after clearing storage.

## Proposed fix (pick one or combine)

1. Add a visible **X / close** button to the modal card (top-right).
2. Add an **Escape** key handler that dismisses (sets the localStorage flag).
3. Allow **backdrop click** to dismiss.
4. Optionally make it a **dismissible toast / corner card** rather than a full
   click-blocking overlay, or skip it on deep-link routes (e.g. `/graphs`).

## Acceptance criteria

- [ ] A first-time visitor can reach and interact with the page behind the guide
      without completing the wizard.
- [ ] The guide is dismissable via a visible close control AND Escape.
- [ ] The `codepulse_onboarding_complete` localStorage gate still works (no
      re-show after dismissal).
- [ ] Add/extend a test asserting the guide does not trap pointer events when
      dismissed and that Escape/close set the flag.

## Out of scope

Not part of Phase 84 (Graphs Hub). Standalone UX fix to the pre-existing
onboarding component.
