---
phase: 99-skill-launch-dispatch
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/lib/skillRun.ts
  - src/lib/profiles.ts
  - src/hooks/useAstridrChat.ts
  - src/components/forge/ForgeLaunchModal.tsx
  - src/components/skills/RunChatPopover.tsx
  - src/components/skills/RunAstridrPopover.tsx
  - src/components/skills/RunTargetChooser.tsx
  - src/components/skills/SkillLaunchProvider.tsx
  - src/components/skills/SkillLifecycleMenu.tsx
  - src/components/skills/QuickDeck.tsx
  - src/components/skills/SkillRow.tsx
  - src/components/skills/SkillCommandPalette.tsx
  - src/components/skills/ColdStorageView.tsx
  - src/components/skills/AllSkillsOverview.tsx
  - src/components/skills/SkillsInCategory.tsx
  - src/pages/Chat.tsx
  - src/pages/Skills.tsx
  - src/pages/Reminders.tsx
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 99: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** standard
**Files Reviewed:** 19 (18 source + ForgeLaunchModal ordering cross-check)
**Status:** issues_found

## Summary

Phase 99 wires three skill-launch paths (Chat auto-send, Ástríðr persona chat, Forge daemon) behind a shared `SkillLaunchProvider`/`useRunLaunch` layer and retires the two dead recording paths (copy-records-launch, passive open-in-chat). The retirement is clean and honest: `QuickDeck.handleCopy`, `SkillRow.handleCopy`, and `SkillCommandPalette.handleCopy` all write to clipboard with zero `recordSkillLaunch` calls (D-13 verified). The shared contracts (`skillRun.ts`, `profiles.ts`) are SSR-safe, validated, and theme-token-driven. `firedRef` correctly guards the auto-send effect against StrictMode double-mount. No direct `fetch()` to the Ástríðr backend exists in any reviewed file — all Ástríðr traffic goes through `sendCommand` (WS, auth handled by `AstridrWSContext`) and all Forge/registry traffic through Convex mutations, so the CLAUDE.md Bearer-header rule has no applicable surface here.

The central concern is the **honesty invariant itself**. The phase's stated contract is "launches recorded exactly once, only on real send/launch — never on copy/failure." Both the Chat/Ástríðr path and the Forge path record on a promise that resolves regardless of whether the send/enqueue actually succeeded — so a server-rejected send and a rejected enqueue both inflate `useCount` with phantom runs. These are the two BLOCKERs below and they defeat the primary goal of the changeset.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Chat/Ástríðr auto-send records a launch on a FAILED send

**File:** `src/pages/Chat.tsx:274-285`
**Confidence:** High.

The auto-send effect treats "the `sendMessage` promise resolved" as "the send succeeded," but `sendMessage` never rejects on failure — it swallows every error path and resolves with `undefined`:

```js
void sendMessage(
  handoff.text,
  handoff.profile ? { profile: handoff.profile } : undefined
).then(async () => {
  await recordSkillLaunch({ name: handoff.skillName });   // fires even on failure
  navigate(location.pathname, { replace: true, state: {} });
});
```

In `useAstridrChat.sendMessage` (`src/hooks/useAstridrChat.ts:99-162`), all three failure paths return/complete normally (resolved promise, not rejected):
- Early guard: `if (!text.trim() || isStreamingRef.current || status !== "connected") return;` (line 100) — a dropped send.
- Server rejection: `if (ack.status !== "ok") { …error bubble…; return; }` (lines 124-136) — the user sees "Error: Command failed" but the launch is still recorded.
- Network throw: the `catch` at lines 151-162 appends an error bubble and does **not** re-throw.

So whenever `status === "connected"` and a handoff is present, `recordSkillLaunch` fires unconditionally, including on a backend-rejected or network-failed send. This directly violates the D-12 comment on the same lines ("confirmed-execution-only recording point … only after the real send resolves") — "resolves" was conflated with "succeeds" — and the phase honesty invariant ("never on failure").

**Fix:** Give `sendMessage` a success signal and gate recording on it. Minimal change: have `sendMessage` return `boolean` (or throw on failure), then:
```js
const sent = await sendMessage(handoff.text, handoff.profile ? { profile: handoff.profile } : undefined);
if (sent) await recordSkillLaunch({ name: handoff.skillName });
else toast.error("Couldn't run — Ástríðr rejected the send.");
navigate(location.pathname, { replace: true, state: {} });
```
In `useAstridrChat.sendMessage`, `return false` at each early/error path and `return true` after `setStreaming(true)`.

### CR-02: Forge Run records a launch BEFORE the enqueue is confirmed (records on failed enqueue)

**File:** `src/components/skills/SkillLaunchProvider.tsx:83-95` + `src/components/forge/ForgeLaunchModal.tsx:195-217`
**Confidence:** High.

The provider wires `recordSkillLaunch` to the modal's `onLaunched` callback:

```js
const handleLaunched = useCallback(
  (_row: ForgeCommandRow) => {
    void recordSkillLaunch({ name: forgeSkillName });   // D-12: "ONLY on confirmed enqueue"
  },
  [recordSkillLaunch, forgeSkillName]
);
```

But `onLaunched` is the **optimistic pre-await** callback — the modal fires it *before* it awaits the mutation (`ForgeLaunchModal.tsx`):

```js
onLaunched(pendingRow);   // line 195 — recordSkillLaunch fires here
onClose();
try {
  await launch({ … });    // line 199 — the actual enqueue; may throw
} catch (err) {
  onLaunchFailed(commandId, message);   // line 214 — provider does NOT record here, but CR already happened
}
```

`enqueueLaunch` is a Convex mutation that can reject (auth, validation, host resolution) — the modal's explicit `try/catch` + `onLaunchFailed` handler proves failure is an expected, reachable state. When it rejects, the optimistic row flips to "failed" **but the launch was already recorded**. This contradicts the provider's own D-12 comment ("record fires ONLY on confirmed enqueue … never on failure/cancel/close") and the phase honesty invariant. `onLaunched` is optimistic paint, not confirmation.

**Fix:** Record on the resolved mutation, not the optimistic callback. Add an `onEnqueueConfirmed(commandId)` callback fired after `await launch(...)` resolves in `ForgeLaunchModal.handleSubmit`, and move `recordSkillLaunch` to it; leave `onLaunched` purely for optimistic paint. (Deduplicate by `commandId` if the confirmed callback can co-fire with reconciliation.)

## Warnings

### WR-01: `run.text` completion leaves `isStreamingRef` stale-true, silently dropping the next send

**File:** `src/hooks/useAstridrChat.ts:188-191`
**Confidence:** Medium (pre-existing; outside the Phase 99 diff, but reachable from the new auto-send path).

Every terminal handler except this one uses the ref-syncing wrapper `setStreaming` (which sets both `isStreamingRef.current` and state). The `run.text` `done` branch uses the raw state setter:

```js
if (done) {
  setIsStreaming(false);          // state only — isStreamingRef.current stays TRUE
  activeSessionRef.current = null;
}
```

`run.completed` (line 307) and `run.error` (line 325) both call `setStreaming(false)`; only `run.text`-done diverges. If a turn ends via `run.text { done: true }` **without** a following `run.completed`, `isStreamingRef.current` remains `true`, and the next `sendMessage` returns early at its line-100 guard — the user clicks Send (the button's `isStreaming` state guard is cleared, so it's enabled) and nothing happens. This becomes newly relevant because CR-01's auto-send also depends on that guard. It is currently masked whenever the backend emits `run.completed` after the final `run.text`; I could not substantiate that ordering guarantee from the reviewed code, hence Medium.

**Fix:** Use the wrapper for consistency: `if (done) { setStreaming(false); activeSessionRef.current = null; }`.

### WR-02: Auto-send `.then()` chain has no rejection handler

**File:** `src/pages/Chat.tsx:279-285`
**Confidence:** High.

```js
void sendMessage(...).then(async () => {
  await recordSkillLaunch({ name: handoff.skillName });
  navigate(location.pathname, { replace: true, state: {} });
});
```

If `recordSkillLaunch` rejects (network/Convex error), the rejection is unhandled (the `void`-ed outer promise has no `.catch`), and the `navigate(...)` that clears the consumed handoff state never runs. `firedRef` prevents a re-fire, so the stale `location.state.autoSend` just lingers (benign on this mount, but it survives across a same-route re-render and is a latent surprise). Fold the fix into CR-01's rewrite, or append `.catch((err) => { console.warn("recordSkillLaunch failed", err); navigate(location.pathname, { replace: true, state: {} }); })`.

## Info

### IN-01: Favorite star uses a fixed `amber-400` Tailwind color, not a theme token

**File:** `src/components/skills/QuickDeck.tsx:82,103` (also `src/components/skills/SkillRow.tsx:98,129`, `src/components/skills/SkillCommandPalette.tsx:114`)
**Confidence:** Medium that it's a deviation; Low that it's a Phase-99 regression.

`fill-amber-400 text-amber-400` is a hard Tailwind color that does not respond to the `data-theme` switcher, unlike the `--primary`/`--status-*` tokens the house style mandates. It is not a raw hex, and it mirrors an established pre-existing convention (favorite = gold star) already present in `SkillRow`/`SkillCommandPalette`; `QuickDeck` (new this phase) copies it. Non-blocking. If tightening: expose an `--favorite` token (or reuse `--status-warn`) so the star tracks the active theme.

---

### What I dropped and why
Dropped a "missing Authorization Bearer header" finding: no reviewed file makes a direct `fetch()` to the Ástríðr backend — Chat/Ástríðr launches go through `sendCommand` (WS, auth owned by `AstridrWSContext`) and Forge/registry through Convex mutations, so the CLAUDE.md Bearer rule has no applicable call site here. Also dropped a StrictMode "double-record" concern (`firedRef` and the single shared Forge modal instance make it unreachable) and the inline `categoryHex()` hex styles in `AllSkillsOverview`/`SkillsInCategory` (data-driven per-category colors via an existing helper, unchanged by this phase, not literal off-palette hex).

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
