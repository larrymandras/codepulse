# Phase 120 Plan 02 — Shell Evidence

Recorded by plan `120-02` (Wave 1). This is the artifact plan 02 owns per `120-CONTEXT.md` —
`120-01` owns `120-SWEEP-EVIDENCE.md`, `120-03` owns `120-SANCTIONED-PATTERNS.md`, `120-05` owns
`120-FABRICATION-INVENTORY.md`. Nothing below was written to those files.

Four items this plan deliberately looked at and left alone, plus the one place a locked decision
(D-04) was knowingly not executed as written.

---

## 1. Nav-icon glow — a third, unnamed nav glow POLISH-01 does not enumerate

- **File:lines:** `src/layouts/DashboardLayout.tsx:152` (desktop nav icon),
  `src/layouts/DashboardLayout.tsx:155` (desktop nav label text-shadow), and
  `src/layouts/DashboardLayout.tsx:290` (mobile/Settings nav icon) — the
  `group-[.is-active]:drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.8)]` /
  `group-hover:drop-shadow-[0_0_5px_oklch(from_var(--primary)_l_c_h_/_0.5)]` pair.
- **Reasoning:** POLISH-01's kill list names the per-item nav glow by class:
  `nav-active-shadow` / `nav-hover-shadow`. Those two classes are fully removed by this plan
  (Task 2A) from both nav renderings. This drop-shadow pair is a *different* mechanism — an
  inline Tailwind utility on the icon and label, not the named classes — decorating the same
  nav items with the same species of glow. D-01 ("enumerated tokens only, no adjacent cleanup")
  keeps it in scope for this plan; it is unremoved by design.
- **Hand-off:** **Phase 124 / SHELL-01**, which rebuilds the nav item and (per D-01's own
  rationale in `120-CONTEXT.md`) is where the 2px active-rail replacement for the removed glow
  classes belongs too.
- **State plainly:** a reviewer who loads the shell after this plan and sees "the nav is quiet
  now" will still see an icon glow flare on hover/active. That is correct per this plan's scope,
  not a miss — but it needs to be on the record so 124 doesn't rediscover it as a new defect.

## 2. Surviving `bg-accent` usages — 2 of 50 repo-wide sites, only 1 fixed by D-05

- **File:lines:** `src/layouts/DashboardLayout.tsx:310` (sidebar-collapse button,
  `hover:bg-accent/50`) and `src/layouts/DashboardLayout.tsx:376` (the `CrtToggle` component's
  own idle-state `hover:bg-accent`).
- **Measured repo-wide figure:** `git grep -oF 'bg-accent' -- src/ | wc -l` → **50** occurrences,
  `git grep -lF 'bg-accent' -- src/ | wc -l` → **29** files. D-05 fixes exactly **one** site (the
  header search pill, now `bg-muted/40 hover:bg-muted/60`). The other **49** are untouched by
  this plan.
- **Reasoning:** D-05 explicitly scopes the fix to the pill — "Do not touch `--accent` in
  `index.css`" and "Leave the two other `bg-accent` usages in this file... alone." Redefining or
  sweeping the token itself is TOKEN-02's job (Phase 122), where violet becomes Ástríðr-exclusive
  across all 5 theme blocks.
- **Hand-off:** **Phase 122 / TOKEN-02.** Re-run the two commands above (`git grep -oF
  'bg-accent' -- src/ | wc -l` and the `-l` variant) rather than re-deriving the list by hand —
  they are reproducible as written.

## 3. `shadow-primary` on the wordmark — dead-but-inert, not enumerated, not removed

- **File:line:** `src/layouts/DashboardLayout.tsx:250` — the `<h1>` wordmark's className still
  carries `shadow-primary`.
- **Reasoning:** `shadow-primary` is a Tailwind `shadow-{color}` utility. Tailwind's
  `box-shadow` utilities only apply a color when paired with a `shadow-{size}` utility (e.g.
  `shadow-md`) on the *same* element — none is present here, so `shadow-primary` emits an unused
  `--tw-shadow-color` CSS custom property and renders nothing. It is not one of POLISH-01's
  enumerated kill-list tokens (`glitch-text`, its `drop-shadow`, `data-text`), so D-01 keeps it;
  D-03 only authorized removing the glow and glitch class, not every class on the element.
- **Hand-off:** **Phase 124.** Record as dead-but-inert: safe to delete whenever that file is
  next touched for the wordmark, but out of this plan's enumerated scope.

## 4. D-04 correction — the Phase-89 suppression range was NOT deleted in full, and that is deliberate

- **What CONTEXT.md's D-04 said:** delete "the Phase-89 `[data-theme="readable"] /
  `[data-theme="aubergine"]` suppression rules (~646-655)" as part of the dead-CSS cleanup,
  alongside `.glitch-text`, `.matrix-bg`, `.nav-active-shadow`, `.nav-hover-shadow`.
- **What was actually done:** that range in the pre-plan file (`src/index.css:646-655`, 836
  lines total before this plan) held **two separate rules**, not one:
  - `[data-theme="readable"] .matrix-bg, [data-theme="aubergine"] .matrix-bg { display: none; }`
    (originally ~647-650) — **deleted**. `.matrix-bg` itself is deleted by this plan (Task 1) and
    its only usage (`DashboardLayout.tsx`'s `<div className="matrix-bg" />`) is deleted (Task
    2C), so this suppression rule is genuinely dead.
  - `[data-theme="readable"] .crt-scanline-bar, [data-theme="aubergine"] .crt-scanline-bar {
    display: none; }` (originally ~652-655, now `src/index.css:549-552`) — **kept**.
- **Why the departure is correct:** `.crt-scanline-bar` has **no base CSS definition anywhere in
  `index.css`** — it is styled entirely inline via Tailwind arbitrary values at
  `src/layouts/DashboardLayout.tsx:514` (`crt-scanline-bar w-full h-[5px] bg-primary/40
  shadow-[var(--glow-md)]`). The CRT feature survives this phase intact (its toggle, event
  plumbing, and default-off `?? "false"` read are all required to survive — see
  `120-CONTEXT.md`'s premise correction #2 and this plan's Task 2F). With the feature alive, this
  suppression rule is the **only** mechanism keeping the CRT scanline bar out of the `readable`
  theme, whose no-effects/accessibility guarantee is an explicit v15.0 requirement
  (`REQUIREMENTS.md:45`, TOKEN-03). Deleting it as D-04 literally instructs would have silently
  regressed that accessibility theme the moment CRT was toggled on.
- **This is the one place in the phase where a locked decision (D-04) was not executed as
  written.** `120-CONTEXT.md`'s own "Corrections added during planning (2026-08-17)" §3
  pre-approves exactly this departure. The comment above the surviving rule in `index.css` was
  rewritten (from "suppress matrix-bg and CRT scanline bar" to "suppress CRT scanline bar") so it
  no longer describes a rule that no longer exists.
- **Verified live (browser, Playwright against `dev:noauth` on port 5181, this plan's
  execution):** with CRT toggled on, `getComputedStyle(.crt-scanline-bar).display` was `"block"`
  under the default theme and `"none"` under `[data-theme="readable"]` — the suppression rule is
  live and effective, not merely present in source.

---

*Phase 120, Plan 02. Written during execution, 2026-08-17.*
