# Phase 122 Plan 10 — Badge Law (D-07 tier assignment)

Built the shared `StatusBadge` primitive Phase 120's D-16 deferred to this phase, and re-keyed
emphasis to operational severity per D-07's four-tier table. This document is the per-entry
record Task 1 requires; Tasks 2/3 implement it.

## §0 — Inventory re-check (re-run vs `120-BADGE-INVENTORY.md`)

Re-ran the inventory's own derivation command from repo root:

```
rg --no-heading -n "from [\"'][^\"']*\bStatusBadge[\"']" src
```

23 lines returned (22 real consumers + `StatusBadge.test.tsx`, excluded per the inventory's own
convention). Diffed the 22-file set (sorted, `StatusBadge.tsx`'s own test excluded on both sides)
against `120-BADGE-INVENTORY.md` §2's list: **`diff` reports zero lines — the two sets are
byte-identical.** No consumer was added, removed, or renamed in the day since the inventory was
produced. The six vocabularies and the two calling conventions (legacy-word lookup vs. direct
semantic literal + custom label) are unchanged from §2's analysis.

## §1 — Tier definitions (D-07)

Four tiers, orthogonal to the existing `semantic` colour axis — a mode can carry a colour without
carrying an outcome's emphasis:

| Tier | Visual treatment | Reserved for |
|---|---|---|
| **Strong** | Filled (opaque bg + contrasting fg) | Conditions demanding operator action |
| **Quiet but unmistakable** | Coloured text + low-opacity border, no bg fill (Phase 120's original "quiet" style) | In-progress / awaiting states |
| **Quietest** | Flat neutral (`bg-muted text-muted-foreground`), no colour, no border | Administrative / inactive / terminal-success states |
| **Mode** | Separate visual grammar — dashed border, quiet-weight, never filled regardless of `semantic` | Execution modes (strict/adaptive/standard/filler) |

## §2 — `StatusBadge.tsx` `legacyMap` (23 entries, six vocabularies)

| State | Vocabulary | Old law (Phase 120) | New tier | Changed? | Reason |
|---|---|---|---|---|---|
| `queued` | job/execution | quiet (idle, flat) | **Quiet** | Yes (shape) | D-07 names `queued` directly. Semantic is `idle` (no hue), so "unmistakable" is carried by adding a border — was flat `bg-muted`, now bordered-neutral. |
| `running` | job/execution | quiet (warn) | Quiet | No | D-07 names `running` directly. Byte-identical class. |
| `completed` | job/execution | quiet (ok) | **Quietest** | **Yes** | D-07 names `succeeded, completed` in Quietest. Drops the green quiet-border treatment for the flat administrative look. |
| `failed` | job/execution | strong (filled, `bg-(--status-error) text-white`) | Strong | Value only | D-07 names `failed` directly. Was already filled; now uses the `--status-error-fill`/`-on-fill` pair per Task 2's action text ("the Strong tier is where the token layer's pair belongs"), giving the shared component the same fill Forge now uses. |
| `cancelled` | job/execution | quiet (warn) | Quiet | No | Not named by D-07; nearest analog is `stopping` (Quiet). Minimal-change default: byte-identical class. |
| `timed_out` | job/execution | quiet (warn) | Quiet | No | Not named; minimal-change default, byte-identical. |
| `strict` | execution mode | **strong** (filled, `error`) | **Mode** | **Yes — D-07's headline defect** | The mis-mapping this whole plan exists to fix: a MODE rendered like a failure. Moves to the dashed-border mode grammar. |
| `adaptive` | execution mode | quiet (warn) | Mode | Yes (shape) | Was already quiet-looking; now explicitly mode-grammar (dashed) so it can never drift back toward an outcome tier by future edit. |
| `standard` | execution mode | quiet (ok) | Mode | Yes (shape) | Same reasoning as `adaptive`. |
| `filler` | execution mode | quiet (warn) | Mode | Yes (shape) | Plan's own action text: "Separate visual grammar: execution modes -- strict / adaptive / standard (and `filler`)." |
| `stalled` | execution mode (block) but an OUTCOME | strong (filled, error) | **Strong** | No (already filled) | D-07's Strong list names `stalled` explicitly, despite living in the "Execution modes (v6.0)" comment block — it is a run OUTCOME (the run stalled), not a mode. **Unreached by any live call site**: `ExecutionTable.tsx:186-188` renders `modeData.stalledAt` as inline text, never as a `StatusBadge` status word, and `modeData.mode` (the only field actually passed to `StatusBadge`) is typed to `strict/adaptive/standard/filler` only. Kept correct for whichever caller resolves this entry. |
| `live` | voice call | quiet (ok) | Quiet | No | Not named; unchanged, byte-identical. |
| `ended` | voice call | quietest (idle, flat) | Quietest | No | Matches "inactive administrative states" — was already flat, unchanged. |
| `joining` | voice call | quiet (warn) | Quiet | No | In-progress state, parallels `running`/`stopping`; unchanged, byte-identical. |
| `active` | roster | quiet (ok) | Quiet | No | Not named; unchanged, byte-identical. |
| `pending` | roster | quiet (warn) | Quiet | No | Awaiting state, parallels `queued`; unchanged, byte-identical. |
| `idle` | roster | quietest (idle, flat) | Quietest | No | Matches "inactive administrative states"; unchanged, byte-identical. |
| `deregistered` | roster | **strong** (filled, error) | **Quietest** | **Yes — discovered beyond D-07's two named cases** | D-07's Strong list does **not** include `deregistered`. `120-BADGE-INVENTORY.md` §4 already frames it as "an administrative removal unrelated to any run's result" — this is precisely the Quietest bucket's "inactive administrative states" category. Under the old law it rendered filled purely as a side effect of sharing the `error` semantic with genuine failures; under the tier law that coincidence is corrected. |
| `claimed` | swarm task | quiet (warn) | Quiet | No | In-progress/awaiting; unchanged, byte-identical. |
| `verifying` | swarm task | quiet (ok) | Quiet | No | In-progress; unchanged, byte-identical. |
| `done` | swarm task | quiet (ok) | **Quietest** | **Yes** | Conceptually a terminal success, parallel to job `completed` — same Quietest treatment. Tier and vocabulary are orthogonal: `done` and `completed` now share a TIER while keeping DIFFERENT LABELS ("DONE" vs "SUCCEEDED"), which is exactly what the D-15 exceptions register requires and does not conflict with it. |
| `verify_rejected` | swarm task | strong (filled, error) | Strong | Value only | D-07 names "rejected verification" directly. Was already filled; now uses the new fill tokens (same value-only change as `failed`). |
| `regression` | quality (EVAL-03) | strong (filled, error) | Strong | Value only | D-07 names `regression` directly. Was already filled; now uses the new fill tokens. |

**Direct-semantic-literal callers** (`CronJobList`, `FactsTable`, `WhatsApp`, `Security`, `Dreaming`,
`Memory` — bypass `legacyMap`, pass `"ok"`/`"error"`/`"warn"`/`"idle"` + a custom `label`): an
unmapped semantic now defaults its tier from the semantic itself — `error` → Strong, `idle` → Quietest,
`ok`/`warn`/`info` → Quiet, anything unrecognised → Quietest (preserves the pre-existing
"unknown status renders the flat `bg-muted` fallback, never crashes" behaviour exactly). This
means every `"error"` direct literal (e.g. Security.tsx's BLOCKED chip) now renders with the same
`--status-error-fill`/`-on-fill` pair as `failed` — a deliberate consequence of having one Strong
treatment for the whole app rather than two different red fills coexisting.

## §3 — `ForgeStatusBadge.tsx` `STATUS_MAP` (8 entries + fallback)

| State | Old law | New tier | Changed? | Reason |
|---|---|---|---|---|
| `queued` | quiet (zinc-700/zinc-400) | Quiet | Value only | D-07 names `queued`. Detokenized: `border-zinc-700 text-zinc-400` → `border-border text-muted-foreground` (TOKEN-01, corpus census). |
| `running` | quiet (info token) | Quiet | No | D-07 names `running`. Already token-driven, unchanged. |
| `completed` | quiet (ok token) | **Quietest** | **Yes** | Parallels shared `completed`. `border-[var(--status-ok)]/40 text-[var(--status-ok)]` → `text-muted-foreground` flat. |
| `failed` | strong (`bg-red-900/60 text-[var(--status-error)]`, sub-AA) | Strong | **Value — the plan's headline fix** | D-06 locks the filled treatment; the pairing corrects to `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`. Measured §5. |
| `stopped` | quiet (zinc-600/zinc-500) | Quiet | Value only | Parallels shared `cancelled`. Detokenized: `border-zinc-600 text-zinc-500` → `border-border text-muted-foreground`. |
| `auth_failed` | quiet (warn token) | **Strong** | **Yes — D-07's second headline case** | Moves from quiet to Strong per D-07/T-122-10-A. Background reuses `bg-(--status-warn)` — the app's existing sanctioned solid-warn-fill idiom (`IdeationRow.tsx:30`, `InboxCard.tsx:98`, `ScanResultsPanel.tsx:41`, `TaskDetail.tsx:29`), NOT the error-fill pair — SC#4 requires `auth_failed` stay visually distinct from `failed`, and both being "Strong" no longer means both being the same colour: colour still comes from `semantic` (warn vs error), only fill-vs-quiet comes from tier. **Foreground corrected during measurement (§8):** those four files' own `text-(--foreground)` pairing was tried first and REJECTED — rasterises to ~1.4-1.8:1 (light text on a bright amber fill), far below AA. Shipped foreground is `text-[var(--primary-foreground)]` (a dark near-black token already used app-wide for text on a saturated/bright fill), measured 10.69-11.47:1. |
| `pending` | quiet (zinc-700 border, primary text) | Quiet | Value only | Parallels shared roster/job `pending`/`queued`. Detokenized: `border-zinc-700` → `border-border`; `text-primary` already token-driven, kept. |
| `stopping_pending` | quiet (warn token) | Quiet | No | D-07 names `stopping` directly. Already token-driven, unchanged. |
| `expired` | quiet (zinc-800/zinc-600, faintest) | **Quietest** | Yes (shape) | Distinct terminal state per §4's exceptions register; "administrative/inactive" fits Quietest. Detokenized AND flattened: `border-zinc-800 text-zinc-600` → `text-muted-foreground` (no border — the flattest treatment in the file, matching its pre-existing "faintest of all" intent). |
| unknown-status fallback | quiet (zinc-700/zinc-400) | Quiet | Value only | Graceful-degradation neutral chip. Detokenized: `border-zinc-700 text-zinc-400` → `border-border text-muted-foreground`. |

`colorScheme`, `data-status`, `aria-label`, the `animate-spin` condition and every icon choice are
untouched — verified by reading `git diff` (§6), not asserted.

## §4 — `IntakeStatusBadge.tsx` (`ROW_STATUS_MAP`, `SEVERITY_MAP`, `VERDICT_MAP`)

`DestinationBadge` is excluded per `120-BADGE-INVENTORY.md` §3 (already quiet, no status colour at
all — not touched).

| Map | State | Old law | New tier | Changed? | Reason |
|---|---|---|---|---|---|
| `ROW_STATUS_MAP` | `pending` | quiet (zinc bg, primary text) | Quiet | Value only | Parallels Forge/job `pending`. Detokenized: `bg-zinc-800/60` → `bg-muted`; `text-primary` kept (already token-driven). |
| `ROW_STATUS_MAP` | `queued` | quiet (zinc bg/text) | Quiet | Value only | Parallels job `queued`. Detokenized: `bg-zinc-800/60 text-zinc-400` → `border border-border text-muted-foreground bg-transparent` (border added so Quiet is visually distinct from the flat Quietest tier below — same shape decision as the shared component's `queued`). |
| `ROW_STATUS_MAP` | `executing` | quiet (info token) | Quiet | No | Parallels `running`. Already token-driven, unchanged. |
| `ROW_STATUS_MAP` | `failed` | quiet (error token, `/20` fill) | **Strong** | **Yes** | D-07 names `failed` directly — this map's own `failed` state was never given the Strong/filled treatment even though the vocabulary word is identical. `bg-[var(--status-error)]/20 text-[var(--status-error)]` → `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`. |
| `ROW_STATUS_MAP` | `expired` | quiet (zinc/30) | **Quietest** | Yes (shape) | Parallels Forge `expired`. Detokenized and flattened: `bg-zinc-800/30 text-zinc-600` → `bg-muted text-muted-foreground`. |
| `NEUTRAL_FALLBACK` | (all three maps' unmapped case) | quiet (zinc-800/60, zinc-400) | Quietest | Value only | Detokenized and matched to the app-wide unmapped-fallback idiom: `bg-zinc-800/60 text-zinc-400` → `bg-muted text-muted-foreground` (same string `StatusBadge.tsx`'s own fallback now uses). |
| `SEVERITY_MAP` | `error` | quiet (error token, `/20`) | **Strong** | **Yes** | A finding classified `error` severity is the same "needs action" category as `regression`/`reject` — D-07's Strong bucket. `bg-[var(--status-error)]/20 text-[var(--status-error)]` → `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`. |
| `SEVERITY_MAP` | `warning` | quiet (warn token) | Quiet | No | Not named; minimal-change default, byte-identical. |
| `SEVERITY_MAP` | `info` | quiet (info token) | Quiet | No | Not named; minimal-change default, byte-identical — no signal in D-07 to flatten an informational severity below its siblings. |
| `VERDICT_MAP` | `admit` | quiet (ok token) | **Quietest** | **Yes** | "Admit" is a definitive positive terminal outcome — directly analogous to `succeeded`/`completed`/`done`, all Quietest. `bg-[var(--status-ok)]/20 text-[var(--status-ok)]` → `bg-muted text-muted-foreground`. |
| `VERDICT_MAP` | `reject` | quiet (error token) | **Strong** | **Yes** | D-07 names "rejected verification" directly, and `reject` in this vocabulary IS a rejected verification. `bg-[var(--status-error)]/20 text-[var(--status-error)]` → `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`. |
| `VERDICT_MAP` | `error` (process-level, distinct from `reject`) | quiet (**warn** token, despite the "error" key name) | Quiet | No | The map's own original author already keyed this to `warn`, not `error` — a verification-process error is a distinct, lesser condition than a definitive content rejection. Minimal-change default: byte-identical class, left as authored. |

## §5 — Adjudications (Task 1, both required)

**(a) `WebhookStatusBadge.tsx` — dot-plus-text is NOT a badge under this law.**
Verdict: it is a separate, already-acceptable affordance, not a "filled badge." Reasoning: the
badge law's four tiers describe a PILL/CHIP's background-fill-vs-border-vs-flat gradient; a small
saturated dot next to plain `text-muted-foreground` copy has no background fill to grade in the
first place — only the 2px dot carries colour, exactly the same "colour lives in a small fixed
element, not a full-width fill" pattern already established and accepted elsewhere in the quiet
parts of the app (`ReadinessPill`, `ConnectionPopover`). No change made; `WebhookStatusBadge.tsx`
is not in `files_modified` and was not touched.

**(b) `WarRoomTaskCard.tsx:66` — stop routing `task.priority` through `StatusBadge`.**
Verdict: give priority its own grammar, not the mode-grammar carve-out. Reasoning: `priority` is
not a status word in any of the six vocabularies `StatusBadge` serves — the site has always
silently rendered through the `idle` fallback with `status.toUpperCase()` as the label, which is
the exact "unrecognised status renders as if administratively inactive" spoofing risk T-122-10-A
registers. The file already owns a proper priority-colour vocabulary
(`PRIORITY_BORDER`, `critical`/`high` → error, `normal` → warn, `low` → ok) for the card's left
border; Task 2 gives the badge the same three-way colour mapping as a small inline chip instead of
routing it through `StatusBadge`'s `idle` fallback. `StatusBadge` import removed from the file
once no render site uses it.

## §6 — `data-status`/`aria-label` diff (Forge)

`git diff -- src/components/forge/ForgeStatusBadge.tsx` (post-Task-3) touches only `className`
strings inside `STATUS_MAP`. No line containing `data-status`, `aria-label`, `colorScheme`,
`animate-spin`, or an `Icon:` value is present in the diff — confirmed by reading the diff, not by
counting lines. See the plan's Task 3 acceptance criteria; full diff reproduced in
`122-10-SUMMARY.md`.

## §7 — D-15 exceptions register (carried forward verbatim, all labels UNCHANGED)

### `src/components/forge/ForgeStatusBadge.tsx`

| State | Label kept | UNCHANGED? |
|---|---|---|
| `auth_failed` | "Auth Failed" | UNCHANGED |
| `queued` | "Queued" | UNCHANGED |
| `pending` | "Queued…" | UNCHANGED |
| `stopping_pending` | "Stopping…" | UNCHANGED |
| `expired` | "Expired" | UNCHANGED |

### `src/components/StatusBadge.tsx`

| State | Label kept | Vocabulary | UNCHANGED? |
|---|---|---|---|
| `queued` | "QUEUED" | job/execution | UNCHANGED |
| `timed_out` | "TIMEOUT" | job/execution | UNCHANGED |
| `strict`, `adaptive`, `standard`, `filler`, `stalled` | own labels | execution mode | UNCHANGED |
| `live`, `ended`, `joining` | own labels | voice call | UNCHANGED |
| `active`, `pending`, `idle`, `deregistered` | own labels | agent roster | UNCHANGED (label; tier changes for `deregistered`, see §2) |
| `claimed`, `verifying`, `done`, `verify_rejected` | own labels | swarm task | UNCHANGED (labels; tier changes for `done`, see §2) |
| `regression` | "REGRESSION" | quality | UNCHANGED |

`completed` (job) stays "SUCCEEDED" and `done` (swarm) stays "DONE" — the D-15 relabel from Phase
120 is untouched by this plan. Re-keying EMPHASIS (this plan) did not re-key VOCABULARY (Phase
120's job), even where a tier changed alongside an unchanged label (`deregistered`, `done`).

## §8 — Rasterised contrast measurements

Method: Playwright + canvas, same as `122-03`'s own script — colour strings (including
`oklab(... / 0.6)` for the translucent old pairing) handed to `canvas.fillStyle` (a real colour
parser, never a regex), rasterised with `getImageData`, and the OLD pairing's translucent fill
composited over each theme's `--card` via canvas's own alpha blending (card `fillRect` first, then
the badge's own — possibly-alpha — background on top) before computing the WCAG ratio. Known-value
control: `#ffffff → rgb(255,255,255)`, `#000000 → rgb(0,0,0)`, both exact. Known-invalid control:
`fillStyle = "not-a-color-9x7q2"` left the sentinel value in place (did not silently substitute a
guess), confirming the "return null/refuse, don't guess" behaviour the discipline requires.

Class strings measured were rendered from the ACTUAL shipped source (Tailwind's Vite-plugin JIT
scanner only compiles a utility once its literal class string exists somewhere in the module
graph — a throwaway probe file only got scanned once temporarily side-effect-imported from
`main.tsx`; both the scratch file and the import were removed before this plan's commits).

### Forge `failed` — NEW pairing (shipped): `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`

| theme | composited bg | fg | ratio | vs AA (4.5:1) |
|---|---|---|---|---|
| cyan | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| emerald | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| readable | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| aubergine | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |

Identical across all four themes because the fill is opaque — an opaque colour fully covers
whatever is behind it, so `--card` never enters the composite. Matches `122-03`'s own 10.020:1
figure exactly (same token pair, same math).

### Forge `failed` — OLD pairing CONTROL: `bg-red-900/60 text-[var(--status-error)]`

| theme | computed bg (pre-composite) | composited over `--card` | fg | ratio | vs AA (4.5:1) |
|---|---|---|---|---|---|
| cyan | `oklab(0.396 0.127 0.061 / 0.6)` | rgb(82,19,23) | rgb(239,68,68) | **3.811:1** | **FAIL (below)** |
| emerald | `oklab(0.396 0.127 0.061 / 0.6)` | rgb(79,18,30) | rgb(239,68,68) | **3.881:1** | **FAIL (below)** |
| readable | `oklab(0.396 0.127 0.061 / 0.6)` | rgb(87,25,30) | rgb(248,113,113) | 4.857:1 | at/above |
| aubergine | `oklab(0.396 0.127 0.061 / 0.6)` | rgb(88,21,30) | rgb(248,113,113) | 4.927:1 | at/above |

The probe correctly reports a failure on cyan and emerald — proving it CAN report a failure, not
just a pass — and correctly does NOT report one on readable/aubergine, which `120-DESIGN-REVIEW-
HANDOFF.md` and `122-TOKEN-LAW.md` both already record as never sub-AA for this pairing (5.33:1 /
4.768:1-4.851:1 there, page-background-vs-`--card` accounts for the small numeric difference from
those documents' own figures — same shape, same conclusion, independently re-derived here rather
than copied).

### `auth_failed` — measured as due diligence (not required by this plan's acceptance criteria, since only `failed`'s contrast was mandated to be measured)

**First candidate, matching the four other files' existing `bg-(--status-warn) text-(--foreground)` idiom — REJECTED:**

| theme | bg | fg | ratio | vs AA |
|---|---|---|---|---|
| cyan | rgb(234,179,8) | rgb(248,250,252) | 1.833:1 | FAIL |
| emerald | rgb(234,179,8) | rgb(248,250,252) | 1.833:1 | FAIL |
| readable | rgb(251,191,36) | rgb(232,234,240) | 1.388:1 | FAIL |
| aubergine | rgb(251,191,36) | rgb(240,232,220) | 1.374:1 | FAIL |

Light text on a bright amber fill — the classic low-contrast combination. Copying an established
pattern from elsewhere in the app is not a substitute for measuring it in the new context.

**Shipped pairing: `bg-[var(--status-warn)] text-[var(--primary-foreground)]`:**

| theme | bg | fg | ratio | vs AA |
|---|---|---|---|---|
| cyan | rgb(234,179,8) | rgb(4,4,5) | **10.686:1** | PASS |
| emerald | rgb(234,179,8) | rgb(4,4,5) | **10.686:1** | PASS |
| readable | rgb(251,191,36) | rgb(12,17,24) | **11.343:1** | PASS |
| aubergine | rgb(251,191,36) | rgb(18,13,24) | **11.473:1** | PASS |

`--primary-foreground` is a dark near-black token already defined in every theme, used app-wide
for text on a saturated/bright fill (its native pairing is `--primary`, which for `cyan`/`emerald`/
`amber` is itself a bright/saturated colour — the same shape as `--status-warn`).

cyan and emerald share identical numbers in every table above because `--status-warn`,
`--status-error`, and `--primary-foreground` are each declared once on the shared `.dark,
[data-theme="cyan"]` block and inherited by `[data-theme="emerald"]`/`[data-theme="amber"]`
(undeclared in those themes' own blocks) — the same cascade behaviour `122-TOKEN-LAW.md` already
documents for `--status-error` on `amber`.
