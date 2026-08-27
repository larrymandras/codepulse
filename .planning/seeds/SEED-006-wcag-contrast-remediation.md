---
id: SEED-006
status: shipped # 2026-08-27 — Phase 128: this seed's OWN declared scope (the 4-theme x 5-page / 20-cell matrix its body names) fully remediated by v15.0 Phases 122/123 — see 128-SEED-RECONCILIATION.md Finding 2.
absorbed: 2026-08-27
absorbed_by: [A11Y-03, A11Y-04, A11Y-05]
planted: 2026-08-10
planted_during: v13.x (188.4 validation-audit follow-on)
trigger_when: "Any milestone with UI/design capacity. NOT urgent-blocking — nothing regressed; these violations have been live the whole time and were merely invisible. Do it before any accessibility claim is made about CodePulse externally."
scope: Medium-Large (unmeasured — sizing is task 1)
origin: ".planning/todos/pending/2026-08-10-theme-contrast-tests-passed-vacuously-behind-clerk-gate.md (astridr-repo), part 2. Part 1 (stop the vacuous pass) shipped as codepulse fee96b5d."
---

> **Dual status, 2026-08-27 (Phase 128).** `shipped` covers this seed's OWN declared scope — the
> `e2e/theme-contrast.spec.ts` 4-theme x 5-page (20-cell) matrix its body names — fully
> remediated by v15.0 Phase 122 (measure) and Phase 123 (fix): 0 violations across all 20
> criterion cells. `absorbed_by: [A11Y-03, A11Y-04, A11Y-05]` covers the wider-app remainder this
> seed's own "measure everything, size the fix" instruction implied but v15.0 never actually
> measured — Phase 122 sampled only 5 of 47 route files, and the other 42 are v16.0's A11Y-03/04/05
> backlog. See `128-SEED-RECONCILIATION.md` Finding 2.

# SEED-006: WCAG-AA contrast remediation across the theme system

`e2e/theme-contrast.spec.ts` runs axe-core with `wcag2a`/`wcag2aa` over 4 themes x 5 pages.
All 20 tests were passing **vacuously** behind the Clerk auth gate — they were measuring the
sign-in screen, which has almost no content and therefore almost no contrast to violate. Against
the keyless server the same suite reports **20 failed / 18 passed**.

`fee96b5d` closed the honesty half: the spec now skips rather than asserting when the gate is up,
so it can no longer report green against a page it never rendered. **This seed is the other half —
actually fixing the violations.**

## What is known

- **234 violations on `[cyan] Dashboard` alone.** Verbatim sample from a live keyless run:

  > Element has insufficient color contrast of 3.51 (foreground `#067082`, background `#060608`,
  > font size 9.0pt (12px), font weight bold). Expected contrast ratio of 4.5:1

  `relatedNodes` pointed at the real rendered sidebar
  (`<aside class="hidden md:flex w-60 … bg-sidebar dark:bg-[var(--glass-bg)]">`).

- **234 is ONE CELL of a 4x5 matrix, not the total.** The true total is unmeasured. Do not plan
  against 234.

- These are **pre-existing** and were not caused by 188.4 — that phase removed the screen that was
  hiding them.

## Shape of the work

1. **Measure first.** Run the full `theme-contrast.spec.ts` against `dev:noauth` (5181) and build
   the real per-theme/per-page violation table. Everything else is sized off that.
2. **Expect the fix to be token-level, not per-component.** The sample above is a theme token
   (`#067082` on `#060608`) rendering across the shared app shell, so one token correction likely
   clears violations on every page at once. Group by token before grouping by page.
3. **The `readable` theme is the natural control** — if it also fails, the problem is structural
   (opacity/glass layering) rather than palette choice.
4. **Re-run per theme as tokens change**, since a single token edit moves many cells of the matrix
   simultaneously and per-page counts will not fall independently.

## Constraint carried from the todo

Run this spec **only against `dev:noauth` on 5181**. Against the gated server it now skips (it used
to lie), so a gated run can never be a regression floor for accessibility.

## Related

- codepulse `fee96b5d` — part 1, the gate check
- astridr-repo `.planning/todos/pending/2026-08-10-theme-contrast-tests-passed-vacuously-behind-clerk-gate.md`
- astridr-repo `.planning/todos/pending/2026-08-10-playwright-clerk-auth-fixture.md` — same
  "green behind an auth gate is not evidence" class; both were filed the same day
- `188.4-03-SUMMARY.md` ORCHESTRATOR ADDENDUM — the original measurement
