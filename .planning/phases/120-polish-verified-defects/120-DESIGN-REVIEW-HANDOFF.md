# 120 — External Design Review: findings carried to Phases 122 / 123

Source: independent Codex review of Phase 120 (implementation + design), 2026-08-17, plus a
follow-up round after a measurement correction. Recorded here because these are **design inputs
for downstream phases**, not Phase 120 defects — Phase 120 was explicitly forbidden from touching
tokens (D-01, D-05) and from refactoring (D-02, D-16).

Nothing in this file is an open Phase 120 item. The one implementation gap the review found (two
ungated surviving pulses) was fixed inside Phase 120 and is recorded in `120-PULSE-TRIAGE.md` §6.

---

## A correction that matters for anyone reading the numbers

An earlier measurement in this phase reported widespread WCAG AA failures across the badge set,
and the first version of this review reasoned from it and recommended treating the contrast state
as a **release blocker**.

**Those numbers were wrong and the recommendation is withdrawn.** The probe scraped values out of
computed CSS colour strings; Tailwind v4 emits `oklch()`, so it read the **hue angle** as the blue
channel. The tell was an impossible page background of `rgb(0,0,262)`. Re-measured by rasterising
each colour and reading true pixels via `getImageData`.

Corrected, measured live. BEFORE = pre-phase class strings at git `87ffe54f`, AFTER = current
HEAD. WCAG AA small text = 4.5:1. Measured against the page background `rgb(3,7,18)`; badges
usually sit on `--card` (`#0a0a0c`), so treat as accurate to within that difference.

| badge | before | after | |
|---|---|---|---|
| StatusBadge `ok` | 2.43:1 | **8.29:1** | now meets AA |
| StatusBadge `warn` | 1.92:1 | **10.50:1** | now meets AA |
| StatusBadge `info` | 3.68:1 | **5.47:1** | now meets AA |
| Forge `auth_failed` | 7.14:1 | **10.50:1** | meets AA |
| Forge `completed` → `Succeeded` | 8.29:1 | 8.29:1 | meets AA |
| Forge `failed` | 3.92:1 | 3.92:1 | **below AA** |

`readable` and `aubergine` measure higher again: ok 10.47, warn 12.06, info 7.92, failed 5.33.

**The quiet-badge law improved contrast on every badge it touched.** Reviewer's revised position:
"The corrected data makes the quiet-badge law substantially stronger: it reduced noise while
sharply improving contrast… The earlier claims about widespread AA failures and broad release risk
are withdrawn."

---

## Carried item 1 — the one sub-AA badge is the highest-severity one

`Forge failed` measures **3.92:1** on the dark themes (5.33:1 on readable/aubergine), below AA.

- Its class string `bg-red-900/60 text-[var(--status-error)]` is **byte-identical before and after**
  Phase 120. Pre-existing; not a regression.
- It is precisely the badge the quiet law deliberately **exempted** from going quiet, and the fill
  is what costs it the contrast.

Reviewer's judgement after correction: this is **not** a Phase 120 blocker. "It remains a targeted
accessibility item only if the release requires complete WCAG AA compliance."

**The design tension worth carrying:** the highest-severity badge has the weakest accessible
contrast, and the filled treatment is what causes it — the fill is arguably working against the
state it exists to emphasise. This "weakens *filled equals emphasised*" as a universal rule.

**For Phase 122 / 123:** choose whichever treatment best preserves BOTH salience and AA — a
corrected fill/foreground pairing, or high-contrast quiet styling. **Take the final measurement
against the actual `--card` background**, not the page background.

Owner: TOKEN-02 (Phase 122) for the token, Phase 123 for remediation.

---

## Carried item 2 — emphasis is keyed to the legacy semantic bucket, not to severity

`src/components/StatusBadge.tsx:47`:

```ts
strict: { semantic: "error", label: "STRICT" },
```

An execution **mode** is mapped to the `error` semantic, so it renders with the same filled
treatment as an actual failure. **A mode is not an adverse outcome.** Conversely `auth_failed` is
operator-actionable but receives the quiet treatment.

This is a pre-existing mapping Phase 120 did not introduce and could not fix — D-16 forbade
creating the shared primitive where this would be resolved.

**Reviewer's proposal for Phase 122's TOKEN-05,** basing emphasis on operational
severity/actionability rather than on the literal status word:

- **Strong:** failed, authentication failure, regression, rejected verification, stalled.
- **Quiet but unmistakable:** running, queued, stopping.
- **Quietest:** succeeded, completed, inactive administrative states.
- **A separate visual grammar** for execution modes such as strict / adaptive / standard.

"That preserves exception-first scanning without making *everything except Failed* visually
equivalent."

After the contrast correction, concerns about `auth_failed` "now concern relative salience only,
not legibility."

---

## Carried item 3 — the geometry guard's coverage is narrower than it looks

`e2e/polish-geometry.spec.ts:178` runs the body-wide horizontal-overflow assertion **only at
900px**. The 360 and 640px cases measure E-Stop geometry only.

Not a defect and not evidence of one — absence of a test is not a failure. But Phase 124's shell
restructure inherits this spec as its regression guard, and would be better served if the
body-wide overflow check were extended to mobile widths.

Owner: Phase 124.

---

## Endorsed without change

- **The quiet-badge law's direction.** "Dense operational dashboards benefit from reserving strong
  fills for conditions demanding attention. Returning every healthy/in-progress state to a
  saturated fill would recreate visual noise."
- **The vocabulary spine.** `Succeeded` / `Cancelled` are clearer terminal outcomes than raw
  implementation-field names, and retaining `queued`, `pending`, `stopping_pending`, `auth_failed`
  and `expired` avoids asserting false state transitions. The job `completed → Succeeded` vs swarm
  `done → Done` distinction is defensible.
- **The WR-01 fix.** Verified independently: no `unhandledrejection` escapes, no error toast lost,
  no double toast, the inner `closeWarRoom` catch is correctly best-effort, and the page-level test
  is genuinely load-bearing with the necessary success control. "I would not change this fix."
- **Scope honesty.** "Unusually honest and coherent" — the CRT suppressor departure explicit and
  justified, the three fabrication residues named and assigned rather than counted as fixed,
  unperformed visual checks recorded as such, badge propagation beyond the intended surface
  disclosed.
- **No load-bearing class was removed.** The three surviving transform consumers
  (`CatalogCard.tsx:31`, `TeamCard.tsx:29`, `WarRoom.tsx:315`) remain intact; no sizing,
  positioning, pointer, visibility or colour class was removed alongside `animate-pulse`.
- **The header change is mechanically sound.** `min-h-14` lets the header grow rather than overlap
  `<main>`; the parent is a flex column; no absolutely-positioned direct children changed
  containing block.

## Reviewer's own stated limitation

Vitest and Playwright could not be re-run in that session (filesystem policy blocked their
temporary/report writes), so the tests and the committed break-and-refail evidence were evaluated
directly rather than re-executed. The orchestrator ran both suites independently: 336 files /
4692 tests passing, 0 failed; `tsc` 0; `build` 0.
