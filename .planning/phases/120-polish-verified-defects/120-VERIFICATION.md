---
phase: 120-polish-verified-defects
verified: 2026-08-17T19:30:00Z
status: human_needed
score: 6/6 truths automated-verified, 2 items outstanding for human eyes
overrides_applied: 0
human_verification:
  - test: "With dev:noauth running, drag a task card to the 'running' or 'cancelled' column and confirm the resulting confirm surface is a themed shadcn AlertDialog (not a browser-native window.confirm or a toast), that it does not auto-dismiss, and that Cancel leaves the task unmoved. Repeat for a war-room delete (confirm the delete dialog is themed and Cancel leaves the room present)."
    expected: "Both confirms render as in-app themed dialogs consistent with the app's data-theme blocks, wait indefinitely, and Cancel performs no mutation."
    why_human: "jsdom tests (both dialogs' Cancel-zero-times and no-timeout assertions, plus a break-and-refail control) prove the GATE LOGIC is correct, but no rendered-in-browser check was ever performed — 120-03's own SUMMARY reports this attended check as NOT PERFORMED ('no live browser session available to this executor'), and the only signal recorded since is a bare 'approved' from the operator with no specific observation, explicitly logged in 120-GEOMETRY-EVIDENCE.md as folded into Task 4's checkpoint 'as outstanding, not performed.'"
  - test: "With dev:noauth running, open /executions and a Forge job list/detail view and visually confirm that only Failed/failed rows render with a solid colour fill (everything else is text+outline), and that an auth_failed Forge badge is still obviously distinct in colour from a failed badge."
    expected: "Only the Failed/failed badge is filled; auth_failed reads amber/warn-toned text+border, visually distinct from the red-filled failed badge."
    why_human: "The quiet-fill law and the SC#4 paired-control are proven by jsdom class-string assertions (grep-verified in this report: StatusBadge.tsx and ForgeStatusBadge.tsx both match the D-16 fill law exactly), but no rendered-in-browser colour check was performed. 120-04's own SUMMARY reports this as 'NOT PERFORMED, needs a human pass' and recommends it explicitly. Same bare 'approved' from the operator, same 'outstanding, not performed' logging in 120-GEOMETRY-EVIDENCE.md."
---

# Phase 120: Polish & Verified Defects Verification Report

**Phase Goal:** Remove decoration and fix verified honesty/layout defects (POLISH-01..06) without
rebuilding, retokenizing, or refactoring, so Phase 122's contrast measurement and visual-regression
baseline start from a clean, decoration-free surface.

**Verified:** 2026-08-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POLISH-01: no live hit for `hover:scale-[1.01]`, `glitch-text`, `matrix-bg`, `nav-active-shadow`, `nav-hover-shadow` anywhere in `src/`, with CRT toggle, `--accent`, and D-01-sanctioned survivors (`glow-card`, `crt-scanline-bar`) intact | ✓ VERIFIED | Re-ran the exact CRITERION-1 AGGREGATE gate myself: all five fixed-string counts return 0 across `src/`. Controls both non-zero and exact: `crt-scanline-bar` → `src/index.css:2`, `src/layouts/DashboardLayout.tsx:1` (3 across 2 files, matches the plan's pre-measured expectation exactly); `glow-card` → 38 occurrences across 24 files (exact match). CRT toggle's `localStorage.getItem("codepulse-crt") ?? "false"` still present (`DashboardLayout.tsx:399,408`); `--accent` untouched; scrollbar rules fully removed (`grep -c 'scrollbar-thumb' src/index.css` → 0); search pill uses `bg-accent` count 2 in the file (down from 3, matching D-05 scope) |
| 2 | POLISH-02: E-Stop control holds fixed geometry and never wraps/reflows at any viewport width | ✓ VERIFIED | `src/components/EStopButton.tsx` carries `shrink-0` (button + icon) and `whitespace-nowrap` (label), each justified by the measured mechanism recorded in `120-GEOMETRY-EVIDENCE.md`. Proven by an in-page (real Chromium, not jsdom) Playwright spec (`e2e/polish-geometry.spec.ts`) measuring `getBoundingClientRect()` and text-node `Range().getClientRects()` at 360/640/900/1440/2560px, plus a revert-and-refail control. All nine pre-existing behavioural tests pass unedited; spot-run confirms 10/10 passing now |
| 3 | POLISH-03: a destructive/command-dispatching action is confirmed in a themed dialog, never a toast or `window.confirm` | ✓ VERIFIED (logic) / see human_verification | `git grep -c 'window.confirm' -- src/` → 0. `MoveToActionConfirmDialog.tsx` and `DeleteWarRoomDialog.tsx` exist, both controlled `AlertDialog`s with no `setTimeout`/`duration:`/`autoFocus` (grep-confirmed), no internal mutation. Both test files pass (7 tests each, spot-run confirmed 6 files / 73 tests green). Break-and-refail control run and recorded. **Rendered-in-browser confirmation that the dialog is themed (not a native modal) was never performed** — see human_verification |
| 4 | POLISH-04: no surface asserts a figure with no emitter behind it | ⚠ PARTIAL (by design, correctly disclosed) | `HeroStatsBar.tsx`'s Integrations row is fully deleted (`grep -c` for `LINEAR`/`VERCEL`/`Integrations row simulation`/`bg-emerald-500/80` all 0; confirmed live). Three residues remain, all named and owned per the phase's own D-08 rule: `HeroStatsBar.tsx:141`'s synthetic "System Load" (owner SIGNAL-02/Phase 125, confirmed present at line 141), `HeroStatsBar.tsx:127`'s dead `text-${...}` interpolated class (owner Phase 122, confirmed present), and `VitalsRail.tsx:253`'s hardcoded `bg-green-500` "Convex" dot (owner Phase 122, confirmed present — its sibling "Ástríðr" dot at :248 IS correctly state-derived, proving the pattern was known and simply not applied here). Per the verification standard's explicit instruction, this is recorded as PARTIAL, not clean |
| 5 | POLISH-05: status badges follow the quiet law (only Failed filled) and the four-word spine vocabulary | ✓ VERIFIED (logic) / see human_verification | Read both `StatusBadge.tsx` and `ForgeStatusBadge.tsx` in full: `error`/`failed` are the only filled entries in each; `ok`/`warn`/`info` (shared) and the other 8 Forge entries are quiet text+border with no `bg-*` fill. `completed`→SUCCEEDED/Succeeded, `stopped`→Cancelled applied; `auth_failed` kept distinct (`--status-warn` vs `--status-error`, SC#4 paired-control test present). No hardcoded hex/rgba in either file. `120-BADGE-INVENTORY.md` hands Phase 122 a re-derived 22-consumer propagation table. **Rendered-in-browser colour check was never performed** — see human_verification |
| 6 | POLISH-06: sidebar and Settings no longer collide at 900px | ✓ VERIFIED | Root cause was NOT Settings.tsx (the plan's own top guess) but the shared `<header>` in `DashboardLayout.tsx`, correctly found by widening the measurement probe per the plan's own fallback instruction and disclosed as a deviation. Fix (`h-14`→`min-h-14`, `flex-wrap`, `gap-y-1`) confirmed present at `DashboardLayout.tsx:586`. Proven by in-page Playwright measurement (`document.body`-wide overflow walk) plus a revert-and-refail control (reverted: 256px overflow / 15 culprits; restored: 0 culprits, byte-identical diff confirmed). Sidebar `w-60` unchanged; no literal `900` breakpoint introduced; `Settings.tsx` untouched (`git diff --stat` empty for that file) |

**Score:** 6/6 truths have solid automated/live evidence; 2 of those (POLISH-03, POLISH-05) still need
a rendered-in-browser human pass before their visual claims are fully closed. POLISH-04 is
intentionally partial by design (D-08), not a gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/HeroStatsBar.tsx` | Hero with fabricated Integrations strip removed, KPI grid intact | ✓ VERIFIED | Comment `{/* KPI grid */}` and `grid-cols-2 md:grid-cols-4` present at :161-162; Integrations block gone |
| `.planning/.../120-SWEEP-EVIDENCE.md` | 120-01's residue attribution | ✓ VERIFIED | 147 lines, non-empty |
| `.planning/.../120-SHELL-EVIDENCE.md` | 120-02's judgment-call record | ✓ VERIFIED | 97 lines, non-empty |
| `.planning/.../120-SANCTIONED-PATTERNS.md` | D-13 sanctioned GlobalSwapModal undo | ✓ VERIFIED | 55 lines, non-empty |
| `.planning/.../120-BADGE-INVENTORY.md` | D-17 work-list for Phase 122 | ✓ VERIFIED | 201 lines, all 4 sections present |
| `.planning/.../120-FABRICATION-INVENTORY.md` | D-08 inventory: fixed/recorded/dropped | ✓ VERIFIED | 238 lines, all 6 sections present, SIGNAL-02 named |
| `.planning/.../120-PULSE-TRIAGE.md` | Full animate-pulse census | ✓ VERIFIED | 266 lines, all 5 sections present |
| `.planning/.../120-GEOMETRY-EVIDENCE.md` | BEFORE/AFTER/control/corrections/attended | ✓ VERIFIED | 492 lines, all sections present including honest "approved-without-detail" disclosure |
| `src/lib/prefersReducedMotion.ts` | jsdom-safe reduced-motion predicate | ✓ VERIFIED | Present; uses `matchMedia?.` optional-call form |
| `e2e/polish-geometry.spec.ts` | Permanent geometry regression guard | ✓ VERIFIED | 13,880 bytes, exists, referenced by CRITERION-1 evidence |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/pages/Tasks.tsx` `handleMoveTask` | `MoveToActionConfirmDialog.tsx` | pending-move state opens dialog; `onConfirm` runs `moveColumn` then `dispatch` | ✓ WIRED | `grep -c 'MoveToActionConfirmDialog' Tasks.tsx` = 2 (import + render); confirm-then-dispatch order preserved per SUMMARY diff evidence |
| `src/pages/WarRoom.tsx` `handleDeleteRoom` | `DeleteWarRoomDialog.tsx` | pending-room state opens dialog; `onConfirm` runs `closeWarRoom` then `deleteWarRoom` | ✓ WIRED | `git grep -c 'DeleteWarRoomDialog' WarRoom.tsx` = 2; `closeWarRoom` inner try/catch preserved (confirmed unchanged count) |
| `src/components/IntegrationHealth.tsx` | `convex/integrations.ts healthStatus` | `useIntegrationHealth` — the honest surface that justified deleting the hero row | ✓ WIRED | `healthStatus` present in `convex/integrations.ts`; `IntegrationHealth` still rendered on `Infrastructure.tsx:86` per 120-05's own re-verification |
| `src/layouts/DashboardLayout.tsx` `<EStopButton />` | fixed-geometry classes | `shrink-0`/`whitespace-nowrap` on the button, measured via Playwright | ✓ WIRED | Confirmed present in source and proven load-bearing by revert-and-refail |
| Surviving `animate-pulse` sites | `src/lib/prefersReducedMotion.ts` | `reducedMotion ? "" : "animate-pulse"` gate | ✓ WIRED | 15 of 16 gated via the new helper; 1 (`VoiceControlBar.tsx`) already compliant via a pre-existing `motion/react` mechanism, documented as a deliberate non-duplication |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| POLISH-01 | 120-01, 120-02, 120-03, 120-05, 120-06 | ✓ SATISFIED | CRITERION-1 aggregate re-verified live (all 5 zero, both controls exact) |
| POLISH-02 | 120-07 | ✓ SATISFIED | In-page Playwright measurement + revert-and-refail control |
| POLISH-03 | 120-03 | ? NEEDS HUMAN (logic satisfied) | Gate logic proven by jsdom + break-and-refail; visual theming never rendered-checked |
| POLISH-04 | 120-05 | ⚠ PARTIAL (by design) | Verified defect fixed; 3 residues named and owned by later phases, explicitly disclosed as not fully closed |
| POLISH-05 | 120-04 | ? NEEDS HUMAN (logic satisfied) | Fill law and vocabulary proven by source read + jsdom; visual colour distinctness never rendered-checked |
| POLISH-06 | 120-07 | ✓ SATISFIED | In-page Playwright measurement + revert-and-refail control; root cause corrected from the plan's own guess |

REQUIREMENTS.md's own checkbox list (lines 32-37) and traceability table (lines 108-113) still show
all six POLISH items unchecked / "Pending" — this is a documentation-sync item for the orchestrator's
wrap step, not a code-truth gap; every item above was independently re-verified against the live
codebase rather than against that table.

### Anti-Patterns Found

Scanned all 76 `src/`/`e2e/` files touched in this phase's commit range (`87ffe54f..HEAD`) for
`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`: zero hits. No debt markers introduced.

The three POLISH-04 residues (`HeroStatsBar.tsx:141`, `HeroStatsBar.tsx:127`, `VitalsRail.tsx:253`)
are pre-existing fabrication-class code, not anti-patterns introduced by this phase — they are
correctly left in place per D-08 and recorded with owning phases, not silently fixed or silently
dropped.

### Human Verification Required

### 1. Themed dialog check (POLISH-03)

**Test:** With `dev:noauth` running, drag a task to `running`/`cancelled` and confirm the dialog
that appears is a themed in-app `AlertDialog` (not a browser-native `confirm()` or a toast), that it
persists indefinitely (no auto-dismiss), and that Cancel leaves the task unmoved. Repeat for a war
room delete — confirm the dialog is themed and Cancel leaves the room present.

**Expected:** Both render as styled shadcn `AlertDialog`s consistent with the active `data-theme`,
never expire, and Cancel performs no mutation.

**Why human:** jsdom cannot render CSS/layout, only class-string presence. 120-03's own SUMMARY
states plainly this check was "NOT PERFORMED — no live browser session available to this executor."
The only subsequent signal is a single-word "approved" from the operator with zero specific
observations, which 120-GEOMETRY-EVIDENCE.md itself logs as "outstanding, not performed" rather than
claiming it as an observed pass.

### 2. Badge colour distinctness check (POLISH-05)

**Test:** With `dev:noauth` running, open `/executions` and a Forge job list/detail view. Confirm by
eye that only Failed/failed rows are filled with colour and every other status is text+outline, and
that an `auth_failed` Forge badge remains obviously visually distinct from a `failed` badge.

**Expected:** Only the one filled entry per module reads as a solid colour chip; `auth_failed`'s
amber/warn tone is clearly different from `failed`'s red.

**Why human:** The SC#4 distinctness guarantee and the fill law are both proven only via jsdom
class-string assertions. 120-04's own SUMMARY explicitly flags this as "NOT PERFORMED, needs a
human pass" and names it as a blocker/concern before POLISH-05 is treated as fully verified. Same
bare "approved," same "outstanding, not performed" disclosure in 120-GEOMETRY-EVIDENCE.md.

### Gaps Summary

No BLOCKER-level gaps. All six POLISH requirements have working, tested implementations backed by
either live-browser Playwright measurement (POLISH-02, POLISH-06), exact repo-wide grep controls
(POLISH-01), or jsdom+source-level proof (POLISH-03, POLISH-04, POLISH-05). The phase's own
artifacts are unusually disciplined about disclosing what was NOT proven: two rendered-in-browser
visual checks (dialog theming for POLISH-03, badge colour distinctness for POLISH-05) were folded
into a single end-of-phase human checkpoint that returned a bare "approved" with no specific
observations — which the phase's own evidence file correctly refuses to inflate into "observed and
confirmed." Per the verification standard's explicit instruction, this verifier does the same:
these two items are routed to human_verification rather than credited as passed. POLISH-04's three
named residues are a deliberate, correctly-disclosed partial closure (D-08), not a gap — each has an
owning phase (SIGNAL-02/Phase 125, Phase 122 ×2) already assigned in REQUIREMENTS.md or this phase's
own inventory.

---

_Verified: 2026-08-17_
_Verifier: Claude (gsd-verifier)_
