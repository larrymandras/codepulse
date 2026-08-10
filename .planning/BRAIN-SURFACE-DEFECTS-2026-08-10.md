# Brain-surface defects — diagnosis handoff (2026-08-10)

Found while verifying the astridr `claude-opus-5` tier promotion
(astridr-repo `feature/brain-swap` @ `ca728d97`, `a486b105`). All four defects are
**CodePulse frontend**; astridr's side is verified working end-to-end.

**Established working (do not re-investigate):** a scoped swap dispatches and resolves.
Backend log at 15:25:09Z:
`control_verb.swap_model path=claude-native target=claude-opus-5 resolved=claude-opus-5 scope=personal`
and the Chat composer pill correctly reads "Active brain: Claude Opus 5". No 400, no
temperature error.

---

## ⚠️ Read first: a concurrent session was editing this repo during diagnosis

Console showed repeated `[vite] hot updated:` for `src/pages/Chat.tsx`,
`GlobalSwapModal.tsx`, `SwapHistoryList.tsx` at 11:41:49 local, and astridr's
git_monitor logged a commit `88f343d4` that is not from this session. Re-check
`git status` / `git log` before assuming any of the line numbers below are current,
and follow the shared-checkout commit discipline (verify staged list, verify
`git show --stat HEAD` after).

---

## Defect 1 — header + LLM STATUS show a stale brain (STRUCTURAL)

**Symptom.** After a `scope=personal` swap to Claude Opus 5, the Chat composer pill
shows "Claude Opus 5" but the top-right header badge and the Control-Center LLM STATUS
panel both still show `claude-sonnet-5`.

**Root cause — two independent contributors.**

(a) STRUCTURAL, confirmed by reading:

| Surface | Call site | Passes profileId? |
|---|---|---|
| Chat composer | `src/pages/Chat.tsx:173` — `useResolvedBrain(profileId)` | yes |
| Header badge | `src/components/brains/BrainHeaderBadge.tsx:60` — `useResolvedBrain()` | **no** |
| LLM STATUS | `src/components/control-center/LlmStatusPanel.tsx:76` — `useResolvedBrain()` | **no** |

In `src/hooks/useResolvedBrain.ts`, `resolveActiveBrain`:
- line 337 gates the per-profile-override rung behind `profileId !== undefined`;
- the fleet-wide branch (lines 367-383) passes only `activeEngines` into
  `deriveMixedState` — **`profileOverrides` is never consulted fleet-wide at all.**

So a per-profile override cannot influence a fleet-wide read even to make it report
`mixed`. Both surfaces fall through to boot-seeded per-profile telemetry, which still
reports sonnet-5 because no turn has yet run on Opus 5.

(b) ENVIRONMENTAL, live at diagnosis time: every `swap.get_state` hydration was failing
(see Defect 4), so even the global axis these two surfaces DO read was never populated.

**Decision needed before coding.** Is a per-profile override supposed to be visible
fleet-wide? Two defensible designs:
- treat an override as a participant in mixed-state derivation, so the fleet read
  becomes `mixed` when one profile is pinned and others are not; or
- leave the resolver alone and relabel these surfaces so "Active brain" does not
  imply "your brain" (the header currently reads as wrong to an operator who just
  swapped their own profile).

Do not just add `profileId` to the two call sites — that would silently redefine a
fleet-wide badge as a personal one.

**Related open work:** Phase 109 signed ENGINE-03 and TELE-02 but held ENGINE-04
pending; `109-10-PLAN.md` exists and is unexecuted. Check whether this is already
in its scope before writing a new plan.

---

## Defect 2 — every brain row renders "unreachable", including the working one

**Symptom.** All picker rows (Claude Opus 5, Claude Sonnet 5, Claude Haiku 4.5, Claude
Fable 5, and the OpenRouter rows) carry accessibility text
`"… — API — unreachable — unlimited quota"`. Sonnet 5 is the active, demonstrably
working brain, so the label is provably wrong — this is not an Opus 5 issue.

**Root cause.** `src/components/brains/BrainPickerRow.tsx:125-135`:

```ts
export function resolveHealthStatus(entry, liveHealth): HealthStatus {
  if (entry.health) return entry.health;
  const data = liveHealth[entry.vendor];
  if (!data) return "unreachable";        // (a) absence rendered as a negative
  if (data.state === "open") return "unreachable";
  ...
}
```

(a) `!data → "unreachable"` conflates "no telemetry for this vendor" with "confirmed
down". There is no `unknown` member in the `HealthStatus` union (line 66). Absence
should render as unknown/neutral, never as a definite negative.

(b) HYPOTHESIS, not yet verified — a vendor-key mismatch makes `!data` permanently
true for Claude rows. astridr's `swap.catalogue` handler emits the Claude tier rows as
`{id, name, vendor: "anthropic"}` with **no `health` field**
(`astridr/api/ws_commands.py` `_handle_swap_catalogue`), so every row takes the
`liveHealth` path. But `config/llm-failover.yaml` names its providers
`anthropic_direct` / `anthropic_advisor` — not `anthropic`. If `useProviderHealth()`
keys by provider name, `liveHealth["anthropic"]` is always `undefined`.
**Check:** dump `useProviderHealth()`'s actual keys and diff them against the `vendor`
values the catalogue emits. Same question applies to the OpenRouter rows, whose
`vendor` is the id prefix (`openai`, `x-ai`, `google`).

Fix (a) regardless of (b) — an absent reading must not display as a negative one.

---

## Defect 3 — coordinate clicks on picker rows silently no-op

**Symptom.** Clicking a row at its visual centre dispatched **nothing** to the backend
(verified: no `control_verb.swap_model` in astridr logs). Clicking the same row via its
accessibility element reference dispatched correctly. Reproducible.

**Where to look.** `src/components/brains/BrainPicker.tsx:537,550` wire
`CommandItem.onSelect` (`onSelect={() => handleActivate(entry)}` /
`onSelect={handleActivate}`). Per the comments at lines 49 and 396, `onSelect` is the
keyboard path (cmdk custom-event dispatch) and mouse clicks are meant to go through
`BrainPickerRow`'s own button. Suspicion: the button does not fill the row's clickable
area, so a click on row padding/wrapper hits neither path.

**Repro without a browser harness:** render the picker and click the row container
(not the inner button) — assert the activate handler fires. Note the existing tests
presumably drive `onSelect` directly, which would never catch this.

Operator impact is real: a click that appears to land does nothing and gives no
feedback.

---

## Defect 4 — chat send did not dispatch; WS command queue full

**Symptom.** Typed "Reply with exactly: ok" into the Chat composer and pressed Enter.
Input cleared, no message rendered, and astridr logged `active_sessions=0` with zero
chat traffic for the whole window.

**Root cause (strong, from console).** Every WS hydration was failing with:

```
Error: Command queue full — too many pending commands while disconnected
  at src/contexts/AstridrWSContext.tsx:375
```

affecting `useResolvedBrain.ts:103` (global override), `:174` (per-profile overrides),
`useProactivePrefs.ts:76`, and `Chat.tsx:387` (strict mode).

Mechanism: repeated Vite HMR reloads (a concurrent session editing Chat.tsx /
GlobalSwapModal.tsx / SwapHistoryList.tsx) remount the hooks; each remount fires its
`status === "connected"` hydration effect; while the socket is mid-reconnect those
commands queue and the bounded queue fills. Once full, every subsequent command —
including a chat send — is rejected.

**Caveat:** I did not capture the send attempt's own error, so "the send failed for
this same reason" is inference from the queue state, not a captured stack. Confirm by
sending a message with the console open on a quiet dev server (no HMR churn).

**Worth fixing regardless of the HMR trigger:** a full queue silently swallows user
input. At minimum the composer should surface a send failure rather than clearing the
input as if the message went out.

---

## Suggested order

1. Defect 4 first — it can mask 1 and 2, and it silently drops user messages.
2. Defect 2(a) — one-line honesty fix, no design decision needed.
3. Defect 3 — self-contained hit-area fix.
4. Defect 1 — needs the design decision above; check `109-10-PLAN.md` first.

## Verification notes

- Reproduce with a quiet dev server (no concurrent editor) so HMR churn does not
  confound the WS state.
- For Defect 1, the decisive check is a scoped swap followed by reading all three
  surfaces plus `docker logs astridr-agent | grep control_verb.swap_model`.
- Do not verify Defect 2 by reading the label alone — pair it with a known-reachable
  vendor as a control, which is what disproved my first (wrong) theory that
  "unreachable" was blocking the click.
