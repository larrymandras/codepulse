---
phase: 109-per-agent-engine-ui
plan: 09
type: summary
wave: 7
requirements: [ENGINE-03, ENGINE-04, TELE-02]
status: complete
outcome: gate-run-with-one-failure
date: 2026-08-10
---

# 109-09 — Live Evidence Gate

Operator-attended live gate. Executed INLINE in the main session rather than via a `gsd-executor`
subagent: the plan is `autonomous: false` with two blocking human-verify checkpoints and an operator
sign-off, and a relayed authorization is not the operator's own.

Durable record: `109-LIVE-EVIDENCE.md`.

## Result

**7 pass · 1 partial · 1 failed leg.**

| Probe | Claim | Verdict |
|---|---|---|
| A | D-03 `default_profile_id` on the live `swap.catalogue` ack | PASS |
| B | D-05 scoped set writes the override map | PASS |
| C | D-05 scoped restore = absence, with same-payload control | PASS |
| D | ENGINE-04 central claim: no optimistic flip | PASS |
| D | pending suffix clears + toast fires | **FAILED** (dev builds only) |
| D | negative control: nonexistent profile id | PASS |
| E | D-06 pin outranks global, four surfaces + controls | PASS |
| F | honest "Not reported" absent state | **PARTIAL** — not constructible |
| G | D-11 `listGlobal` on the self-hosted instance | PASS |
| H | D-10/D-12 combined history, count, pinned note | PASS |

## Preconditions — both failed at gate open, both fixed and proven

- **Convex self-hosted was stale.** `controlVerbSwaps:listGlobal` did not exist on the deployment
  while its two siblings (`record`, `listByScope`) did — the control proving a deploy gap rather
  than a broken probe. Deployed to `127.0.0.1:3210`, target confirmed with `--dry-run` first so the
  push could not reach the retired cloud deployment.
- **`astridr-agent` was stale.** All three phase-109 symbols probed `False` in-container. Rebuilt on
  `feature/brain-swap` with `COMPOSE_PROFILES=prod,war-room`; all three now probe `True`, with a
  bogus-symbol negative control returning `False` so the probe is proven to discriminate. Only 8
  commits sat above the previous image, four of them 109-01 itself.

Freshness was argued only by in-container symbol probe — never by image timestamp, never by
cross-service image SHA.

## The failure, and why it is stated narrowly

On the dev server the per-profile swap outcome machine never leaves `pending`: the
"· switching to …" suffix never clears and NEITHER toast fires — not the success toast, not the 4 s
"accepted, unconfirmed" warning. The surface permanently claims a completed swap is still in flight.

**Root cause CONFIRMED by mutation test.** `useProfileSwap.ts:143-149` sets
`unmountedRef.current = true` in its unmount cleanup and never resets it to `false` on remount.
StrictMode (`main.tsx:42,50`) double-invokes effects in dev, latching the ref, so both dispatch
continuations dead-end at their `unmountedRef` guard (`:259`, `:294`) before reaching
`setOutcome("confirming")`.

Two controls isolate it:

1. The production build runs the full correct sequence (suffix → label → success toast → suffix
   clears), twice.
2. Adding the single line `unmountedRef.current = false` on the SAME dev server, StrictMode still
   on, also produces the correct sequence.

The mutation was reverted; `git diff` for that file is empty. **No fix was committed by this plan** —
a gate's output is evidence, and the fix belongs in gap closure (plan 109-10).

**What did NOT fail:** ENGINE-04's actual requirement text is about server-confirmed rather than
optimistic updates. On two independently instrumented runs (MutationObserver + WebSocket frame log
on one clock) the base label held its OLD value through the entire in-flight window and changed only
272 ms / 364 ms AFTER the ack and `swap.state` arrived. That property holds.

Scope is dev builds only — but dev is the daily-driver surface here (`CodePulseUI` serves :5173), so
it is real work rather than a footnote.

## Requirement dispositions

- **ENGINE-03 — SATISFIED** (signed).
- **TELE-02 — SATISFIED** (signed).
- **ENGINE-04 — HELD PENDING.** Not signed while a probe for it is failing. Unblocked by 109-10.

Operator sign-off recorded in `109-LIVE-EVIDENCE.md` under explicit in-session authorization.

## Things I got wrong or nearly got wrong, recorded deliberately

- **A suspected defect, investigated and DROPPED.** The confirm modal's "3 profiles have a pinned
  default (Claude Sonnet 5)" looked wrong against only two swap overrides. It is correct:
  `pinnedCount` derives from each profile's CONFIGURED default (`GlobalSwapModal.tsx:389-398`), and
  live `profileConfigs` shows all three at `primary = anthropic/claude-sonnet-5`. Reporting it as a
  defect would have been a false positive against a working feature.
- **A measurement error of my own.** The first attempt at Probe H's pinned-note contrast used a
  selector that grabbed the FIRST `Swap history (…)` button — `consulting`'s, collapsed — and
  reported `rows: 0` for both readings. It contradicted a 17-row reading taken moments earlier,
  which is what exposed it. Redone with a business-scoped selector; the invalid numbers are used
  nowhere.
- **A near-miss on the picker.** I initially read the strong purple row highlight as "current". It
  is cmdk's keyboard cursor, which sat on the first row regardless. The real marker is
  `isCurrent`/`bg-primary/10` (`BrainPickerRow.tsx:192`). Reading the source before trusting the
  pixels is what turned Probe E from a confounded reading into a real one with a moving control.

## Environment left clean

- Live routing returned to baseline: `model_override: null`, `profile_overrides: {}` — identical to
  the pre-probe capture. Every swap this gate dispatched was reverted.
- The `vite preview` on :5199 was shut down; the dev server on :5173 was untouched and is up.
- `astridr-agent` and `convex-backend` healthy, `8181/health` and `3210/version` both 200 at gate
  end as well as gate start.
- Suite state at gate time: `npx tsc --noEmit` exit 0; `npx vitest run` 284 files passed / 17
  skipped, 3736 tests passed / 193 todo.

## Follow-ups

Plan `109-10` (gap closure) covers:

1. The `unmountedRef` reset, with a regression test that spans the StrictMode
   mount→cleanup→remount boundary — a single-mount test passes either way and would not have caught
   this.
2. Probe F: construct a telemetry-less profile and prove the `Not reported` absent state across all
   four surfaces.
3. Re-run Probe D live afterwards and sign ENGINE-04.
