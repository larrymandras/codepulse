# Phase 123: Accessibility Remediation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `123-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 123-accessibility-remediation
**Areas discussed:** Fix altitude, Non-contrast scope, A11Y-03 guard, Harness trust
**Mode:** default (interactive), 4 questions per area, all 4 areas selected

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fix altitude | How wide the opacity-modifier fix goes | ✓ |
| Non-contrast scope | ARIA and the sub-AA pairings axe cannot see | ✓ |
| A11Y-03 guard | The skip-vs-fail conflict between ROADMAP and REQUIREMENTS | ✓ |
| Harness trust | Badge determinism and the 5-of-47 sampling limit | ✓ |

**User's choice:** all four.

---

## Fix altitude

### Q1 — How wide should the opacity-modifier fix go?

| Option | Description | Selected |
|--------|-------------|----------|
| Class sweep, ratio-gated | Enumerate all `text-*/NN` occurrences, rasterise each pairing, fix only sub-threshold ones | ✓ |
| Flagged sites only | Fix the ~5 elements axe flags in `DashboardLayout.tsx` and stop | |
| Ban the idiom outright | Remove every opacity modifier from text tokens + ratchet grep | |
| Raise the token values | Lift `--muted-foreground`/`--primary` lightness per theme | |

**Notes:** Flagged-sites-only was framed against the 2026-08-18 lesson (fixing the instances a
reviewer handed you is not fixing the class). Raise-the-tokens was framed against 122's palette
freeze and the operator's live approval of the OKLCH ramp the same day. → **D-01**

### Q2 — How do the 174 sites get measured?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: axe-reachable + isolation harness | Real pixels where a route can render it; Playwright isolation + `getImageData` where it cannot; every row labelled by pass | ✓ |
| Analytic composite from token values | Compute ratio from hex + alpha + nearest declared surface | |
| Rendered-only, record the gap | Rasterise only what a route can show; everything else explicitly unmeasured | |
| You decide | Hybrid as default, planner may drop pass 2 | |

**Notes:** The analytic option was shown to be the one that would have missed the measured 4.48:1
node (`.text-(--muted-foreground)`, no opacity modifier), because it has to guess the ancestor and
the app stacks semi-transparent layers between text and the opaque surface. → **D-02**

### Q3 — What threshold does the isolation harness apply?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror axe exactly — 4.5:1 / 3:1 large | Read computed font-size and weight, apply WCAG's own large-text rule | ✓ |
| Hold everything to 4.5:1 | One number, no font introspection, stricter than WCAG | |
| 4.5:1 with a listed exemption set | Frozen enumerated list of large-text sites clearing 3:1 | |

**Notes:** The exemption-set option was framed against the 2026-08-17 lesson on enumerated guard
tests that ratify the last fix. Both currently-flagged shell elements owe 4.5:1 either way
(`:148` is 14px, `:91` is 12px bold), so this decision only affects the wider sweep. → **D-03**

### Q4 — When a site measures sub-AA, what is the remedy?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the modifier; swap token if hierarchy breaks | Default is deleting the `/NN`; never reintroduce alpha | ✓ |
| Step up to the lowest passing alpha | Raise `/60`→`/80` etc. per measured site | |
| Case by case from the ledger | Executor picks per row | |

**Notes:** Step-up rejected because the passing value is a function of that site's composited
background — a scatter of magic numbers with no guard behind them, silently re-broken by any
parent-surface change. → **D-04**

**Continue?** Next area. (Left unasked: plan/wave split, ratchet shape — later covered by D-17 —
and whether `readable` ships first, later covered by D-10.)

---

## Non-contrast scope

**Correction issued before the questions:** `aria-prohibited-attr` is not optional. A11Y-02's
criterion is that `theme-contrast.spec.ts` passes, and the spec asserts
`expect(results.violations).toEqual([])`, so the 4 objects at `ForgeJobList.tsx:174` block
criterion 1 by force. What was genuinely open was the sweep radius and the axe-invisible defects.

### Q1 — Is B1's warn-fill pairing in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in | 3 live sites + 1 inheritor + 2 re-seeding header comments; `StatusBadge.tsx:55` is the control | ✓ |
| Leave it to its todo | Keep 123 bounded to the measured matrix | |
| Fix the comments only | Stop propagation, leave the code | |

**Notes:** ~1.4–1.8:1 is the worst ratio in the codebase and axe never sees it, because those
elements do not render on the 5 measured routes. → **D-05**

### Q2 — How far does the ARIA work sweep?

| Option | Description | Selected |
|--------|-------------|----------|
| Measurement-defined, known sites as a floor | Whatever fires on the scanned route set, plus the 3 named `aria-busy` sites regardless | ✓ |
| The flagged div only | `ForgeJobList.tsx:174`, two-line diff | |
| Real AST census of role-restricted ARIA | Parse JSX properly, fix everything found | |

**Notes:** A `grep` census returning 254 was presented **and disclaimed in the same message** — it
is a line-based filter over multi-line JSX, counting attributes rather than defects. The only
trustworthy figure offered was `aria-busy` in 2 files. → **D-06**

### Q3 — Which pending todos fold in? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| `tailwind-scans-beyond-src` | Tailwind compiles `bg-gray-950/50` into production CSS from `scripts/migrate_tokens.py` | ✓ |
| `shadow-rgba-outside-sweep-buckets` | Bare `rgba()` in `shadow-[...]` is invisible to every bucket and ratchet | ✓ |
| `forgepage-pageheader-adoption` | `/forge` is a measured route carrying 8 of 24 objects | ✓ |
| None of these | Keep to the two already folded | |

**Notes:** Todo matching was done by reading, not by score — `gsd-sdk query todo.match-phase 123`
returned all 9 pending todos at a uniform 0.6 on the keywords "phase", "122", "contrast".
Rider recorded on the third: 122-11 declined the `PageHeader` substitution because it bakes in
`mb-4` the hand-rolled header lacks *and that plan had no visual-check step*, which is what later
forced D-18. → **D-07, D-08, D-09**

### Q4 — Does `readable` get a higher bar?

| Option | Description | Selected |
|--------|-------------|----------|
| Same AA bar as every theme | One threshold, one ledger, one pass/fail | ✓ |
| Hold readable to AAA (7:1) | Make the theme genuinely exceed the others | |
| Same AA bar, but readable ships first | One standard, sequenced early | |

**Notes:** `readable` carries 78 of 209 nodes and is branded "Readable Dark (WCAG-AA)" in
`CLAUDE.md`, but its stated differentiator is effects suppression, not a higher contrast standard.
The ships-first option was flagged as probably non-separable — the failing elements are shared
app-shell chrome, so one fix clears all four themes at once. → **D-10**

**Continue?** Next area. (Left unasked: whether ROADMAP's goal line is corrected on disk, and
what happens to the two header comments beyond the code fix — both resolved in CONTEXT.md's
`<premise_corrections>` and D-05 respectively.)

---

## A11Y-03 guard

**Conflict surfaced before the questions:** `ROADMAP.md:807` requires the gate to make the suite
"fail (not skip)"; `REQUIREMENTS.md:68` says the skip **is** the guard and this phase verifies it
holds. Mechanism decides: `test.skip()` at `theme-contrast.spec.ts:66-73`, and 20 skipped cells
exit 0.

### Q1 — How does the guard get resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the skip, fail the run on any skip | Counter + `afterAll` throw; cell reads `skipped`, suite fails | ✓ |
| Convert the skip to a hard failure | Replace with an assertion | |
| Keep the skip, enforce in CI | Gate on the JSON reporter's skip count | |

**Notes:** The chosen option satisfies both conflicting documents at once and loses no
information. Hard-failure was rejected for destroying the three-way distinction between "never
rendered", "rendered clean", and "violating". → **D-11**

### Q2 — How is the guard proven to still fire?

| Option | Description | Selected |
|--------|-------------|----------|
| In-suite self-test, plus one operator live run | Deterministic injected gate + one real gated `:5173` run | ✓ |
| In-suite self-test only | Fully automated, but proves the guard against a simulation | |
| Operator live run only | Real evidence, but nothing re-checks it afterward | |

**Notes:** The split exists because an agent structurally cannot run the live probe —
`122-CONTRAST-BASELINE.md` records 122's attempt as "blocked by this session's own permission
classifier before it could execute; not run this time, stated plainly rather than claimed", the
same class of block as Phase 121's `npx convex deploy`. → **D-12**

### Q3 — Extend the guard to prove page content rendered?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-page content marker | 5-entry route→marker table; fail (not skip) if absent | ✓ |
| Assert a minimum scanned-element count | Cheap proxy, no table | |
| Record it as a named limit | Leave the guard at shell level, document the hole | |

**Notes:** The current marker is the app **shell**, which renders on all five pages regardless of
whether the page's content does. Phase 121 established this is live, not hypothetical: three real
query timeouts on `/analytics` are routinely caught by `SectionErrorBoundary`. The proxy option
was rejected on the standing rule against asserting proxies. → **D-13**

### Q4 — What happens to `A11Y_MEASURE_ONLY`?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it, but make the run non-green | All cells run, all captures written, run exits non-zero with an explicit message | ✓ |
| Delete the switch | Nothing left that can suppress a failure | |
| Keep as-is | Documented and used correctly through 122 | |

**Notes:** Deletion rejected because 123's own before/after ledger needs a full-matrix capture and
would have to rebuild the capability under another name. → **D-14**

**Continue?** Next area. (Left unasked: whether `networkidle` is a sound pre-scan wait for a live
Convex WebSocket subscription — carried into CONTEXT.md as a discretion item.)

---

## Harness trust

**Reframing offered before the questions:** the ex-badge column exists because 122 compared
*deltas*, where a 21-node swing swamps a 2-node change. 123's target is **zero**, so node-count
reproducibility stops mattering.

### Q1 — How is harness determinism handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the badge; zero-target makes the rest moot | Fix `DashboardLayout.tsx:607-620`, retire the ex-badge column | ✓ |
| Fix the badge AND seed backend state | Remove intermittency as a category | |
| Fix the badge, keep the ex-badge column | Maintain continuity with 122's four captures | |

**Notes:** Seeding rejected as trading a real render for a synthetic one in the suite whose
credibility rests on measuring what ships. Residual rule agreed: any *other* intermittently
failing cell is a real finding, never noise. → **D-15**

### Q2 — Does 123 widen the matrix past 5 routes?

| Option | Description | Selected |
|--------|-------------|----------|
| Widen the scan, hold the criterion at 20 cells, checkpoint to expand | Scan 47×4; A11Y-02 closes against the measured 20; decide mid-phase | ✓ |
| Widen everything — scan and criterion | Close only when all 47 routes are clean | |
| Keep the 5-route matrix | Match A11Y-02's literal wording | |

**Notes:** Cost signal given: 20 cells run in 12.2s, so ~188 cells is minutes. What is not cheap
is fixing what it finds sight-unseen — hence the bounded criterion plus checkpoint. → **D-16**

### Q3 — What guards the fix against regression?

| Option | Description | Selected |
|--------|-------------|----------|
| The widened axe suite IS the ratchet | Measurement ratchet; no `text-*/NN` grep bucket | ✓ |
| Measurement ratchet plus a grep bucket | Also covers unrenderable sites | |
| Grep ratchet only | Reuse the existing `src/tokenSweep.ratchet.test.ts` infrastructure | |

**Notes:** A grep ratchet guards the *spelling*, not the property — the 4.48:1 node has no opacity
modifier at all and would sail straight through. Stated gap accepted: sites that never render
during a scan are guarded only by D-02's ledger. → **D-17**

### Q4 — Does 123 carry an operator visual checkpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| One blocking checkpoint before close | Cycle all 4 themes; check nav hierarchy and `/forge` header spacing by name | ✓ |
| Screenshot pack, no blocking gate | Evidence in the record, nothing blocks | |
| No visual gate — rely on the measurements | Fastest, no dependency on operator availability | |

**Notes:** 122's equivalent checkpoint caught "one flat tone for the most part", which four
automated gates had missed. D-09's fold makes a visual check obligatory rather than optional.
→ **D-18**

---

## Claude's Discretion

Recorded in CONTEXT.md under `<decisions>` → "Claude's Discretion":

- Plan/wave split, and whether the 47-route scan runs before or after the shell fixes.
- Whether `waitForLoadState("networkidle")` is sound for a page fed by a Convex WebSocket
  subscription (WS does not gate `networkidle`).
- Where the new ledger and after-capture live. Recommendation given: a new `123-CONTRAST-RESULT.md`
  and a new capture directory, anchored on 122's frozen `a11y-before/` and current `a11y-after/`;
  never amend 122's artifacts in place.

## Deferred Ideas

- Widening A11Y-02's criterion to all 47 routes — held at D-16's checkpoint rather than committed.
- A JSX-AST census of role-restricted ARIA attributes.
- A `text-*/NN` bucket in `src/tokenSweep.ratchet.test.ts`.
- AAA (7:1) for `readable` — belongs in the theme redesign the operator flagged at 122's close.

## Reviewed todos, not folded

`forge-job-list-column-clips-card-rows` (layout, not WCAG) ·
`forge-analytics-visual-polish` (aesthetic, byte-identical to pre-phase) ·
`kg-answer-sync-glxy02-test-flake` (owned by the phase-190 workstream) ·
`unbounded-analytics-scans-timeout` (performance; deliberately used by 122 as the live proving
ground for the tile's unavailable/error states).

---

*Phase: 123-Accessibility Remediation*
*Logged: 2026-08-20*
