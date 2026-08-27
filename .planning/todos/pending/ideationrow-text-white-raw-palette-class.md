---
id: TODO-ideationrow-text-white-raw-palette-class
status: pending
planted: 2026-08-20
planted_during: Phase 123 (Accessibility Remediation), plan 123-10 (D-05 status-fill remedy)
trigger_when: Any future accessibility/token sweep phase that includes raw-palette-class remediation. Not this plan's defect class — 123-10 fixes token-pair contrast (bg-(--status-*) text-(--foreground)); this is a raw Tailwind palette class, never a CSS custom property.
scope: Trivial (3 call sites, one file, one substitution each)
source: Read live during 123-10's Task 2 (src/components/IdeationRow.tsx:27-31, SEVERITY_CLASSES), 2026-08-20
resolves_phase: 131
last_reviewed: 2026-08-20
---

# `IdeationRow.tsx`'s `SEVERITY_CLASSES` uses raw `text-white` instead of a token

## The violation

`src/components/IdeationRow.tsx:28,29,31`:

```
critical: "bg-(--status-error) text-white",
high:     "bg-(--status-error)/70 text-white",
low:      "bg-(--status-ok) text-white",
```

`text-white` is a raw Tailwind palette class, not a CSS custom property. `CLAUDE.md`'s Styling
section is explicit: "All accents/status/glow read from CSS vars — never hardcode hex" and the
theme is token-driven with a runtime switcher (`ThemeSwitcher.tsx`) across four dark themes plus
a light `:root`. A hardcoded `text-white` does not participate in that system — it will not repaint
correctly if a future theme's `--status-error`/`--status-ok` fill is light rather than dark (e.g.
the light `:root` "Paperclip" palette), and it was never measured for contrast the way this same
file's `medium` entry (line 30, `bg-(--status-warn) text-(--foreground)`) was.

`:30` (`medium`) was the one CONTRAST-defective entry in this map — measured and remedied in this
same plan (123-10, D-05) to `text-(--primary-foreground)`. Lines 28/29/31 are a *different* defect
class: a hardcoded palette class rather than a token, whether or not its contrast happens to pass
today.

## Why it is not fixed here

123-10's scope is the token-pair status-fill contrast defect (D-05), measured via
`e2e/contrast-isolation.spec.ts`'s status-fill matrix. `text-white` is not a token at all, so there
is nothing for that matrix to measure it against, and Phase 122's token/palette sweeps (which did
cover raw-palette-class violations as their own bucket) did not reach this file. Filed rather than
swept as a side effect, per 123-10's threat register (T-123-29).

## Suggested fix

Replace `text-white` at all three sites with a measured token — likely `text-(--primary-foreground)`
(123-10 measured it clearing 4.5:1 against `--status-error` and `--status-ok` in all four dark
themes: worst-case 5.45:1 on `--status-error`, 9.85:1 on `--status-ok` — see
`e2e/.artifacts/123-isolation-pass2.json`, `family: "status-fill"` rows). The `/70` opacity modifier
on `high`'s background (`bg-(--status-error)/70`) was NOT covered by 123-10's status-fill matrix
(which measured flat, non-alpha backgrounds only) — re-measure that specific composited pairing
before assuming the flat-background figure transfers, and check it against the light `:root`
palette too, which none of 123-10's four (dark-only) themes covered.
