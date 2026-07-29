---
phase: 103
slug: brain-swap-control-surface
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
validated: 2026-07-28
---

# Phase 103 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `103-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 (jsdom) + Playwright (E2E) |
| **Config file** | `vitest.config.ts` / Playwright config (existing, unchanged) |
| **Quick run command** | `npx vitest run src/components/brains src/lib/brainsApi.test.ts` |
| **Full suite command** | `npm test` then `npm run test:e2e` |
| **Estimated runtime** | ~15s quick · ~90s full Vitest · E2E separate |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the touched test file>`
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green, including `npm run test:e2e`
- **Max feedback latency:** 15 seconds (quick), 90 seconds (full)

---

## The BSC-05 Honesty Boundary (governs every row below)

This phase is **stub-backed on the per-profile axis and live on the global axis**
(CONTEXT.md `<blocker_reframing>`, corrected 2026-07-28). Validation must respect that split.

**Provable this phase — per-profile axis, against the stub:**
- Contract TypeScript shapes are internally consistent; the stub conforms (compile-time + runtime conformance test).
- All client-side logic: scope-selector reset (D-08), pending-never-optimistic (D-15), partial-failure row rendering (D-12), pinned-default overwrite count (D-11), revert restoring prior state incl. pin status, expensive/unknown-tier inline confirm, stub-data indicator visibility (D-16).
- "Mixed brains" badge computation, given a fixture with ≥2 distinct engine values.

**Provable this phase — global axis, FOR REAL (do not stub):**
- `swap.set` / `swap.catalogue` / `swap.state` exercised against the running stack. BSC-05's original wording is satisfiable here and **must** be satisfied. Endpoint-exists ≠ integration-works (Phase 90 lesson) — drive it end-to-end.

> **UPDATE 2026-07-28 (103-08-T2, live verification actually performed) — this half was only
> PARTIALLY satisfied, not fully closed as originally hoped.** See "Live Global-Axis Verification
> (103-08-T2)" below for the complete, honest breakdown: the catalogue read and the D-15 confirm
> gate ARE genuinely live-verified; the dispatch → readback → persistence → revert leg is NOT
> verified, because two real defects (found during this same live session and left open — not
> per-profile-axis limitations) swallow the one command that actually works and never request a
> state snapshot. **BSC-05's global half is not marked satisfied.**

**NOT provable this phase — deferred to the follow-on gate (astridr Phase 184.1):**
- That a real `gateway.model.set` exists, accepts the contract payload, and changes the resolved model for the next real turn.
- That per-profile active-engine telemetry flows from a real astridr process into the new Convex table.
- That CLI subscription brains are reachable / healthy / quota-tracked through a real CLI Gateway.
- Any observed interaction between the per-profile mechanism and the live Phase-185/186 global override.

These four remain **unchanged and still deferred** — nothing in 103-08 touched the per-profile axis's
live-integration status. It stays contract-first / stub-backed, exactly as designed.

> **A green stub suite must never be reported as "BSC-05 verified."** Stub tests prove contract
> conformance and UI honesty. They do not prove live per-profile integration. **Nor is a partial
> live global-axis verification "BSC-05 verified" — see below for exactly what was and was not
> proven.**

---

## Live Global-Axis Verification (103-08-T2)

> Performed 2026-07-28 by the coordinator directly against the running stack (Ástríðr WS at
> `ws://127.0.0.1:8181/ws/telemetry`, CodePulse dev server on `:5173` **without**
> `VITE_BRAINS_STUB=true`) — a genuine live checkpoint, not a stub run. Four real defects were found
> and fixed in the same session (authorized fix rounds); two more were found and deliberately left
> open as gaps for a future gap-closure cycle. Results below are recorded exactly as observed —
> nothing softened, nothing worked around by weakening an assertion.

### Per-step results (Task 2's `<how-to-verify>` steps 1-7)

| Step | What it checks | Result | Evidence |
|------|-----------------|--------|----------|
| 1 | Badge renders, no STUB chip | ✅ PASS | `aria-label="Active brain: No brain reported"`, exactly one such button in the tree, 0 console errors |
| 2 | Real catalogue loads (~300+ entries), grouped, no truncation, no STUB banner | ✅ PASS | Switching scope to "All profiles" sends a real `{"type":"swap.catalogue","target":"brain","request_id":...}` frame and returns **331 live engines** (Claude Opus 4.8, Sonnet 5, Haiku 4.5, Fable 5, Ai21/Jamba, …), grouped under "API" |
| 3 | Confirm modal lists every affected profile `current → new`, flags pinned-default count | Not independently re-verified this session (already unit-covered — see Per-Task Verification Map row for `GlobalSwapModal.test.tsx`) | — |
| 4a | The `swap.set` dispatch actually reaches Ástríðr and changes the live global brain | ✅ PASS (operator-observed) | Operator confirmed a real "All profiles → Claude Haiku 4.5" swap on the live stack; Control Center `BrainControl` (the pre-existing `swap.state`-wired surface) subsequently read `claude-haiku-4-5-20251001`. The write leg genuinely works. |
| 4b | Confirming updates **the badge** from the `swap.state` readback (not the ack) | ❌ FAIL | With the swap demonstrably in force, `BrainHeaderBadge` still read "No brain reported" — defect #6. The modal also never reported the successful `swap.set` at all, showing only the deferred axis's failures — defect #5. |
| 5 | Summary toast offers "Revert global swap"; Revert returns the badge to the prior engine | ❌ NOT VERIFIED | Not exercisable as specified: the modal's result surface never acknowledged the successful swap, so the revert affordance was never presented against a confirmed prior state. Operator reverted manually via Control Center instead. |
| 6 | (Same as 5 — click Revert, confirm badge reverts) | ❌ NOT VERIFIED | See above |
| 7 | Composer pill renders in the composer without displacing the send affordance at narrow width | ⚠️ Layout not re-verified; **content is wrong** | Pill rendered correctly but displayed `Auto` while the live global brain was `claude-haiku-4-5-20251001` — a third disagreeing surface. See defect #6. |

**D-15 confirm gate — genuinely verified and holds:** selecting an engine in "All profiles" scope
dispatches **zero** WS frames until "Swap all profiles to {X}" is explicitly clicked. No premature
mutation of live process state occurred at any point during this session.

**Honest summary:** the global axis's **read** path (catalogue), its **friction gate** (D-15, no
dispatch before explicit confirm), and its **write** path (`swap.set` genuinely changes the live
brain) are all live-verified. The **readback/revert** leg is explicitly **NOT verified** — not
because it was skipped, but because two real defects (below) make a successful swap invisible to
every surface this phase built.

### ⚠ Headline finding — three surfaces, three answers

With a single global override (`claude-haiku-4-5-20251001`) genuinely in force on the live stack,
the operator observed three brain surfaces simultaneously reporting three different states:

| Surface | Origin | Displayed | Correct? |
|---|---|---|---|
| Control Center `BrainControl` | pre-existing (Phase 185/186) | `claude-haiku-4-5-20251001` | ✅ correct — reads `swap.state` |
| `BrainHeaderBadge` (dashboard-wide) | **this phase, 103-06** | `No brain reported` | ❌ defect #6 — subscribes but never requests a snapshot |
| Chat composer pill | **this phase, 103-07** | `Auto` | ❌ defect #6 — reads the 184.1-deferred `brainsApi.getDefaultProfileId()` seam |

This is precisely the failure mode BSC-01 exists to eliminate — *"stale config read presented as
live state"* — and as shipped, **this phase added two more disagreeing voices to a surface that
previously had one correct answer.** The pre-existing component is the only one that is right.

This reframes the gap-closure target. The fix is not two independent patches: it is **one honest
resolution order that every brain surface reads from**, so a single live global override cannot
render three different ways. The composer pill is a genuinely distinct third code path and must be
covered explicitly — a fix scoped only to the badge would leave it wrong.

### Defects found and FIXED during this session (already committed — not part of a future gap-closure cycle)

1. **`BrainHeaderBadge` aria-hidden-focus violation (WCAG 4.1.2)** — an invisible second `BrainPicker`
   mount (`opacity-0`/`pointer-events-none` inside `aria-hidden="true"`) left a real, focusable
   trigger button inside an aria-hidden container. Fixed: `BrainPicker` gained a real
   `trigger`/`open`/`onOpenChange`/`onPendingChange` composition API (`593ce212`); the relay +
   `MutationObserver` were deleted (`fa3c974d`).
2. **`BrainHeaderBadge` was blind to the global axis entirely** — with no per-profile telemetry ever
   written (184.1 not shipped), the badge showed "No brain reported" even while a real global brain
   was active. Fixed: added a `swap.state`-subscribing fallback, clearly labelled `(global)` /
   "Global" chip, never overriding an honest "Mixed brains" per-profile reading (`895c2796`,
   `BrainHeaderBadge.tsx:71-91`).
3. **`registerBrainsWsSender` was never called anywhere in the app.** `liveSendCommand` stayed `null`
   forever, so every live per-profile/global-catalogue call silently failed
   ("Ástríðr WS sender not registered") and `getCatalogue()` swallowed the error into `[]`.
   `VITE_BRAINS_STUB` masked this from the entire test suite. Fixed: `BrainsWsRegistrar`, a headless
   component registering `useAstridrWS().sendCommand` on mount inside `AstridrWSProvider`
   (`2e42e5c8`, `src/App.tsx`, `src/components/brains/BrainsWsRegistrar.tsx`).
4. **`BrainPicker` fetched ONE scope-independent catalogue from the deferred per-profile seam** —
   opening the picker in "All profiles" scope sent zero WS frames and listed nothing live. Fixed:
   the catalogue source is now scope-aware — `profile` scope still uses `brainsApi.getCatalogue()`
   (stub-backed, unchanged), `global` scope now reads the live `swap.catalogue` command directly,
   normalized into the picker's `CatalogueEntry` shape (`220aeb84`,
   `src/components/brains/BrainPicker.tsx`).

### Defects found and NOT fixed — recorded as open gaps for a future gap-closure cycle (`/gsd-plan-phase 103 --gaps`)

5. **`GlobalSwapModal` violates `103-CONTRACT.md` §8 and inverts its own honesty contract.**
   §8 states plainly: *"'All profiles' scope in the Phase 103 UI dispatches the existing live
   `swap.set` (global axis), not N `gateway.model.set` calls."* But `GlobalSwapModal.tsx:159-169`
   DOES fan out N `gateway.model.set` calls for global scope (the 184.1-deferred per-profile
   command) — on a real live swap this produces per-row `union_tag_invalid` failure text for every
   profile, always. Worse: `GlobalSwapModal.tsx:154` fires the real, working global `swap.set` with
   `.catch(() => {})` and **discards its result entirely** — only the deferred axis's guaranteed
   failures populate the modal's result rows (`GlobalSwapModal.tsx:172-187`). The modal therefore
   reports failure for the axis that is deferred by design and says nothing about the one command
   that actually works. This directly contradicts BSC-01/BSC-04's "server-confirmed status"
   requirement and is why verification steps 4-6 above could not be completed.
6. **Every brain surface this phase built is blind to an already-active global override.**
   Two distinct code paths, one shared consequence — see the headline finding above.

   **6a — `BrainHeaderBadge` never requests a state snapshot.** `swap.state` (subscribed at
   `BrainHeaderBadge.tsx:83`, added by defect-fix #2 above) is a *change* event, not a snapshot — it
   only fires when a swap happens *while the page is open*. Current state must be requested on mount
   with `swap.get_state`, exactly as `Chat.tsx:309` already does for its own Control Center surface.
   `useGlobalEngineFallback` (`BrainHeaderBadge.tsx:71-91`) only subscribes; it never sends
   `swap.get_state`. Evidence: on a fresh load of the live stack, **zero** `swap.state` frames
   arrived and the badge read "No brain reported" while `claude-haiku-4-5-20251001` was in force.

   **6b — the Chat composer pill reads the deferred per-profile seam.** `BrainComposerPill`
   (`src/pages/Chat.tsx`, added by 103-07) scopes to `brainsApi.getDefaultProfileId()`, which routes
   through the 184.1-deferred per-profile adapter and therefore cannot observe the global axis at
   all. It displayed `Auto` against the same live Haiku override. This path was **not** covered by
   defect-fix #2 and would survive a badge-only fix.

   **Gap-closure guidance:** resolve 6a and 6b together via one shared source of truth for
   "what brain is actually running" (snapshot on mount + subscribe to changes), consumed by the
   badge, the composer pill, and `BrainControl` alike. Fixing them independently reproduces the
   three-way disagreement in a new shape.

### Noted, not this phase's problem — do not fix here

7. The app's WS keepalive sends `{"type":"ping"}`, which Ástríðr's tagged-union command validator
   rejects with an error ack every time (pre-existing, unrelated to brain-swap). Worth a separate
   ticket in astridr-repo; explicitly out of scope for this phase.

---

## Gap-Closure Live Re-Verification (103-13-T1, 2026-07-29)

> Re-runs steps 4b/5/6 of the 103-08-T2 checkpoint above, after gap-closure Plans 103-09..103-12
> (and, mid-run, 103-14) fixed the six defects that blocked it. This section is ADDED alongside the
> 103-08-T2 table above — nothing in that table was edited, deleted, or softened. Where this run's
> result differs from 103-08-T2's, both are shown so the before/after is legible.

### Run conditions (record verbatim — these are deviations from the operator's normal environment)

- **Driver:** the orchestrator, via Playwright headless Chromium. The Claude-in-Chrome extension was
  not connected for this run. Operator Larry explicitly chose "I drive in Chrome, you review" and
  reviewed the resulting observation table — this was **not** a human at the keyboard clicking
  through the UI live, and that is recorded plainly rather than implied otherwise.
- **Port:** CodePulse dev server ran on **:5174**, not :5173 — the pre-existing autostart instance
  (`CodePulseUI` scheduled task) already held :5173. Started from Git Bash with
  `VITE_BRAINS_STUB=false`.
- **Auth:** Clerk was **disabled** for this run (`VITE_CLERK_PUBLISHABLE_KEY=` empty, set via Git
  Bash — per the repo's own PS 5.1 empty-env-var-deletes lesson, PowerShell was not used for this).
  Without this, the sign-in gate blocks the dashboard entirely (observed: STUB/GLOBAL badge counts
  both read 0 while the gate was up). This matches the repo's own documented e2e guard ("run e2e
  without `VITE_CLERK_PUBLISHABLE_KEY`") and is orthogonal to brain-data provenance, but it is a real
  deviation from the operator's normal signed-in browsing environment and is recorded as such.
- **Backends:** Ástríðr live throughout at `ws://127.0.0.1:8181/ws/telemetry`; Convex at
  `ws://127.0.0.1:3210`, both genuinely live (not stubbed) for the whole run.

### Per-observation results (Task 1's twelve observations — OBS 12 was added live, see below)

| Obs | What it checks | Result | Evidence |
|-----|-----------------|--------|----------|
| 1 | Pre-flight: genuinely live, not stubbed | ✅ PASS | Badge STUB-chip count = 0; picker stub-banner ("Running on stub brain data") count = 0. |
| 2 | Global override state before page load | ✅ PASS | No override was in force at start: `swap.get_state` ack returned `{"status":"ok","model_override":null,"model_source":null}`. Driver then SET one (Claude Haiku 4.5) and reloaded, per the plan's own step 2 instruction. |
| 3 | Three surfaces agree with one override in force | ✅ PASS — the 2026-07-28 three-way disagreement did **not** reproduce | Header badge: `aria-label="Active brain: claude-haiku-4-5-20251001 (global)"`, text "claude-haiku-4-5-20251001 \| GLOBAL", global chip = 1. Chat composer pill: `aria-label="Active brain: claude-haiku-4-5-20251001 (global) — opens the brain picker"`, text "claude-haiku-4-5-20251001 \| GLOBAL". Control Center `BrainControl`: text "BRAIN \| claude-haiku-4-5-20251001". Badge and pill both carry the required "Global" qualifier; `BrainControl` names the same engine but has no Global-chip affordance of its own (pre-existing, not a defect). |
| 4 | Badge updates from the `swap.state` readback (not the ack) | ✅ PASS | `SENT {"type":"swap.set","target":"brain","value":"claude-opus-4-8","restore":false}` → `RECV +22ms {"event_type":"swap.state","data":{"model_override":"claude-opus-4-8","model_source":"voice-swap",...}}`. Badge before = "Active brain: claude-haiku-4-5-20251001 (global)"; after = "Active brain: claude-opus-4-8 (global)". **Method note:** badge reads taken while the result Dialog was open returned "(no badge)" — the modal `aria-hide`s the page. This was a harness artifact, not a product defect; all recorded badge values were re-read with the dialog dismissed. |
| 5 | Modal reports the real `swap.set` outcome, not the deferred axis's failures | ✅ PASS | Verbatim: "Switched to Claude Opus 4.8. / Profiles now governed by the global override: / consulting / business / personal". No per-profile `union_tag_invalid` rows. No 0/N failure reported for a swap that succeeded — the exact §8 violation defect #5 previously produced. |
| 6 | "Done" offers a revert action | ✅ PASS | Toast verbatim: "All profiles switched to Claude Opus 4.8. \| Revert global swap". |
| 7 | Revert renders a real result and the badge returns to the prior engine | ❌ **FAILED on first run**, then **FIXED (Plan 103-14) and RE-VERIFIED PASS** in the same session | **First run (pre-103-14):** dialog did render a real result row — "Global override cleared — profiles are back on their own defaults." + consulting/business/personal — but the badge went to "Active brain: unknown", not back to Haiku 4.5. Frame sent: `{"type":"swap.set","target":"brain","restore":true}`. Root cause: `GlobalSwapModal.runRevert` hardcoded `restore:true`; Ástríðr defines `restore=true` as "clear the override entirely" (`ws_commands.py:233`, handler `:1100-1105`), not "restore to prior" — a client-side gap, not a protocol limit (`{"target": value}` with `restore:false` sets any specific value). **Larry's call:** fix before closing; Plan 103-14 executed live, mid-checkpoint. **Re-verification (post-103-14), same live stack:** baseline no-override → swap to Haiku 4.5 → swap to Opus 4.8 → "Revert global swap". `SENT +96ms {"type":"swap.set","target":"brain","value":"claude-haiku-4-5-20251001","restore":false}` → `RECV +101ms {"event_type":"swap.state","data":{"model_override":"claude-haiku-4-5-20251001",...}}`. Dialog verbatim: "Revert global swap / Reverted to claude-haiku-4-5-20251001. / Profiles still governed by the global override: / consulting / business / personal". Badge after revert = "Active brain: claude-haiku-4-5-20251001 (global)" — restored to the prior engine: **true**. |
| 8 | Confirm modal's per-profile `current → new` list and pinned-default count are accurate | ❌ **FAILED — Larry's explicit disposition: treat as a real defect, do not mark fixed** | Modal verbatim: "Swap all profiles to Claude Opus 4.8? / consulting Auto → Claude Opus 4.8 / business Auto → Claude Opus 4.8 / personal Auto → Claude Opus 4.8 / Cancel / Swap all profiles to Claude Opus 4.8". Lists all 3 real profiles, no pinned-default warning (`pinnedCount = 0`). **Verified against the live self-hosted Convex:** `profiles:listConfigs` → 3 profiles; consulting/business/personal **each** carry `modelPreferences.primary = "anthropic/claude-sonnet-5"` (fallback `"qwen2.5:7b"`) — real pins. `activeEngine:latestByProfile` → exactly ONE row: `{profileId:"unknown", model:"unknown", mode:"inherited", selectionPath:"override"}` — zero rows for consulting/business/personal. **Mechanism:** `BrainPicker.tsx:362-374` derives `currentModelDisplayName`/`mode` from `activeEngines` (`activeEngineSnapshots`), not from `profileConfigs.modelPreferences` — with no per-profile snapshot rows live, every profile renders "Auto" and `pinnedCount` is 0. **Consequence:** the D-11 confirm modal understates what a global swap actually shadows; the affected requirement marker stays unsatisfied for this reason. No fix was made for this defect this cycle. (The stale `profileId:"unknown"` `activeEngineSnapshots` row is the same root cause that makes the badge read "Active brain: unknown" at baseline — related, not separately fixed.) |
| 9 | `/chat` narrow viewport: composer pill must not displace the send affordance | ✅ PASS | At 420×900: send button (`aria-label="Send message"`) visible, `boundingBox {x:339, y:291.66, w:44, h:44}` — fully inside the 420px viewport. Composer pill visible. `document.scrollWidth > clientWidth` = false (no horizontal overflow). |
| 10 | Keyboard-only D-15 confirm gate: zero mutating frames before explicit confirm | ✅ PASS | Typed "haiku" into the cmdk input → rows 331 → 2 ("Claude Haiku 4.5", "~Anthropic/Claude Haiku Latest") → ArrowDown → Enter → confirm modal opened for "~Anthropic/Claude Haiku Latest". Frames sent between the keyboard mark and the confirm click: 2, both read-only `swap.get_state`. Mutating frames pre-confirm = **0**. Whole-run mutating frames = 0 (that script cancelled rather than confirmed). **Method note:** an earlier attempt showed row count unchanged (331) after typing because keyboard focus was still on the scope-toggle button, not the cmdk input — a harness artifact, diagnosed and corrected, not a filter defect; that first reading was discarded. |
| 11 | Stack left clean, intended engine recorded | ✅ PASS | Final live state verified two ways: `swap.get_state` ack `{"status":"ok","model_override":null,"model_source":null}` and the pushed `swap.state` `{"model_override":null,"model_source":null,...}`; UI badge shows no GLOBAL chip. Engine the stack was left on: **no global override (Auto / per-profile defaults)** — the exact pre-checkpoint baseline observed in OBS 2. |
| 12 *(added during the run)* | The UI-reachable clear-to-Auto path (BrainControl's independent "Restore usual brain") | ✅ PASS | **Context:** the orchestrator initially and wrongly claimed 103-14 had removed the only clear-to-Auto path; that claim was disproved live by reading `BrainControl.tsx:217-227` and then verifying against the running stack — recorded here as the correction, not as fact. **Live result:** with no override, "Restore usual brain" is correctly ABSENT (count 0 — nothing to clear). With a Haiku 4.5 global override in force, it is PRESENT (count 1). Clicking it dispatched **exactly one** frame — `{"type":"swap.set","target":"brain","restore":true}` — and `RECV +118ms {"event_type":"swap.state","data":{"model_override":null,...}}`; badge cleared, GLOBAL chip 0. Satisfies `103-CONTRACT.md` §8 (exactly one live command). |

### Additional live fact recorded during the run (settles the per-profile axis honestly)

Ástríðr's accepted command union, read verbatim off a live validation error during this session:
`agent.send_task, chat.send, agent.stop, agent.pause, agent.resume, cron.toggle, cron.trigger, approval.respond, vision.frame_reply, config.update, estop.activate, estop.deactivate, llm_gate.enable, llm_gate.disable, config.get, commands.list, swap.get_state, readiness.get, swap.set, swap.catalogue`.
`models.catalog` is **not** in this union — the per-profile axis the picker's "This profile" scope
dispatches is genuinely unimplemented live (the picker shows "Couldn't load the brain catalogue —
try again in a moment." at that scope). This **confirms** the deferral to astridr Phase 184.1 rather
than contradicting it. `ping` is likewise not in the union (matches the pre-existing item 7 above).
The global axis's catalogue loaded **331 live entries** via `swap.catalogue` this run, matching the
103-08-T2 figure exactly.

### Headline finding, replaced — three surfaces, one answer

The 2026-07-28 headline finding was "three surfaces, three answers" (badge: "No brain reported",
pill: "Auto", `BrainControl`: correct). **This run, that disagreement did not reproduce.** With a
single global override genuinely in force, all three surfaces named the same engine:

| Surface | Origin | Displayed (103-13-T1) | Correct? |
|---|---|---|---|
| Control Center `BrainControl` | pre-existing (Phase 185/186) | `claude-haiku-4-5-20251001` | ✅ correct — unchanged, reads `swap.state` |
| `BrainHeaderBadge` (dashboard-wide) | this phase, fixed by 103-09 | `claude-haiku-4-5-20251001 \| GLOBAL` | ✅ correct — now snapshot-pulls `swap.get_state` on every connect (OBS 2-4) |
| Chat composer pill | this phase, fixed by 103-09 | `claude-haiku-4-5-20251001 \| GLOBAL` | ✅ correct — now reads the same shared resolver as the badge (OBS 3) |

The fix predicted in the 103-08-T2 gap-closure guidance — "one honest resolution order that every
brain surface reads from" (`useResolvedBrain`, shipped in 103-09) — is what closed this. **This does
not mean BSC-01/BSC-04/BSC-05 are now fully satisfied**: OBS 8 above is a real, live-confirmed defect
in a different part of the same honesty chain (the pre-swap confirm modal, not the resolved-state
surfaces), and the per-profile axis remains correctly deferred. See `.planning/REQUIREMENTS.md` for
the restated markers.

---

## Per-Task Verification Map

> Task IDs bound by `gsd-planner` 2026-07-28. No row was dropped and no thirteenth mapping was
> invented. **Two automated commands were re-pointed** at planning time to the file that genuinely
> contains the assertion — flagged inline as `[cmd corrected]`. Research had written both under a
> "same file as above" shorthand that pointed at the wrong test file:
> row 7 (scope-selector reset) lives in the picker, not the modal; row 9 (partial-failure result
> rows) lives in the modal, not the picker. A command pointing at a file that does not hold the
> assertion is a false verification, so the file was corrected rather than the row dropped.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 103-01-T3 | 103-01 | 1 | BSC-05 | T-103-01 | Stub adapter rejects malformed shapes in dev (contract-drift canary, ASVS V5) | unit | `npx vitest run src/lib/brainsApi.test.ts` | ✅ | ✅ passed (2026-07-28) |
| 103-06-T1 | 103-06 | 4 | BSC-01 | T-103-23 | Mixed state never presents one profile's value as the engine | unit | `npx vitest run src/components/brains/BrainHeaderBadge.test.tsx` | ✅ | ✅ passed (2026-07-28) |
| 103-02-T3 | 103-02 | 1 | BSC-01 | T-103-05 | Ingest coalesces snake/camelCase defensively; bounded read | unit (Convex) | `npx vitest run convex/activeEngine.test.ts` | ✅ | ✅ passed (2026-07-28) |
| 103-01-T3 | 103-01 | 1 | BSC-02 | T-103-02 | Command follows the same non-admin auth tier as `swap.set` | unit | `npx vitest run src/lib/brainsApi.test.ts` | ✅ | ✅ passed (2026-07-28) |
| 103-05-T2 | 103-05 | 3 | BSC-02 | T-103-17 | Dispatch validated client-side before leaving the browser | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ✅ | ✅ passed (2026-07-28) |
| 103-04-T2 | 103-04 | 2 | BSC-03 | T-103-12 | Global swap enumerates every affected profile before firing | unit | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` | ✅ | ✅ passed (2026-07-28) |
| 103-05-T2 | 103-05 | 3 | BSC-03 | T-103-21 | Scope resets to "This profile" every open, so global requires a deliberate move | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` `[cmd corrected]` | ✅ | ✅ passed (2026-07-28) |
| 103-05-T2 | 103-05 | 3 | BSC-04 | T-103-18 | Pending never flips the base label; failure drops the suffix, claims nothing | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ✅ | ✅ passed (2026-07-28) |
| 103-04-T2 | 103-04 | 2 | BSC-04 | T-103-14 | Failed rows keep their real unchanged engine; target name absent | unit | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` `[cmd corrected]` | ✅ | ✅ passed (2026-07-28) |
| 103-05-T2 | 103-05 | 3 | BSC-05 | T-103-19 | Stub build cannot masquerade as live (persistent STUB indicators) | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ✅ | ✅ passed (2026-07-28) |
| 103-01-T3 | 103-01 | 1 | BSC-05 | T-103-01 | Stub return shapes match the `103-CONTRACT.md` interface | contract + typecheck | `npx vitest run src/lib/brainsApi.test.ts && npx tsc --noEmit` | ✅ | ✅ passed (2026-07-28) |
| 103-08-T1 | 103-08 | 5 | BSC-02, BSC-04 | T-103-30 | A green stub run is explicitly not live per-profile verification | e2e | `npm run test:e2e -- brain-swap.spec.ts` | ✅ | ✅ passed (2026-07-28) — asserts the accepted/pending state, not a stub-manufactured success toast; see the spec's own D-14 header comment |

**103-08-T2 (live checkpoint, not automated — no row above):** see "Live Global-Axis Verification
(103-08-T2)" section above for the full, honest per-step breakdown. Partial pass: catalogue read +
D-15 confirm gate verified live; dispatch/readback/revert leg not verified (defects #5/#6 open).

**Fixture ownership:** all five mandatory fixtures below are built as real work in **103-01-T2**
(`src/lib/brainsFixtures.ts`), not inline inside a test task.

**Additional plan-level gates not in the map above:**

| Task ID | Plan | Wave | Gate |
|---------|------|------|------|
| 103-02-T2 | 103-02 | 1 | **[BLOCKING]** Convex schema push — must land before any reactive-path claim |
| 103-03-T1 | 103-03 | 2 | `useActiveEngine` never returns `undefined`; no fallback to `modelPreferences` |
| 103-03-T2 | 103-03 | 2 | Health/quota thresholds re-tokenized to `--status-*`; rows never truncate |
| 103-06-T2 | 103-06 | 4 | Badge wrapped in `SectionErrorBoundary` inside `DashboardLayout` |
| 103-07-T1 | 103-07 | 4 | `p.model` stale read deleted from `Settings.tsx`, live value wins when they differ |
| 103-07-T3 | 103-07 | 4 | CLI-to-API fallback surfaced as a warn-toned toast (D-04 honesty) |
| 103-08-T2 | 103-08 | 5 | **Live global-axis verification against the running stack** — BSC-05's satisfiable half |
| 103-08-T3 | 103-08 | 5 | Validation sign-off records what remains unproven |

**Behavior covered per row (research § Phase Requirements → Test Map):**
1. BSC-05/W0 — stub adapter shape validation.
2. BSC-01 — badge + Settings row render the reactive active engine per profile; "Mixed brains" when they disagree.
3. BSC-01 — the active-engine ingest handler writes/dedupes per-profile rows correctly.
4. BSC-02 — stub and live adapters satisfy one identical interface.
5. BSC-02 — picker dispatches the per-profile command via `useCommandDispatch`.
6. BSC-03 — confirm modal lists every affected profile `current → new` and flags the pinned-default overwrite count.
7. BSC-03 — scope selector resets to "This profile" on every open, except the mixed-badge entry exception (UI-SPEC line 144).
8. BSC-04 — pending state never optimistically flips the base label; failed dispatch drops the pending suffix with no error styling on the pill.
9. BSC-04 — partial-failure global swap keeps failed rows on their real unchanged engine.
10. BSC-05 — STUB banner + chip render iff the stub flag is on, never otherwise.
11. BSC-05 — stub return shapes match the `103-CONTRACT.md` interface.
12. E2E — picker open → swap → toast round trip against the stub.

---

## Fixtures That Actually Exercise the Behavior

> A fixture that does not trigger the behavior proves nothing. Each of these is mandatory —
> the corresponding test is invalid without it.

- [x] **Expensive/unknown-tier inline confirm** — catalogue fixture MUST include ≥1 `costTier: "expensive"` and ≥1 `costTier: "unknown"` entry. An all-`"normal"` fixture exercises only the immediate-dispatch path and proves nothing about the confirm expansion (UI-SPEC §3/§11). **Realized by:** `STUB_CATALOGUE` (`src/lib/brainsFixtures.ts`) — `anthropic-opus-4-8` (`costTier: "expensive"`), `antigravity-cli` (`costTier: "unknown"`).
- [x] **Global-swap pinned-default restore** — fixture MUST include ≥2 profiles with at least one *pinned* default and at least one *inherited* value. A uniform fixture cannot distinguish D-11's pin-status-preserving revert from a naive "restore last known model". **Realized by:** `STUB_PROFILE_ENGINES` (`src/lib/brainsFixtures.ts`) — `assistant-default` (`mode: "pinned"`), `consulting` (`mode: "inherited"`).
- [x] **Partial-failure result rows** — the stub's `dispatchSwap` MUST be configurable to fail a subset of profiles (e.g. profileId deny-list). A stub that always succeeds cannot exercise D-12 at all. **Realized by:** `makeStubFailureSet()` (`src/lib/brainsFixtures.ts`), consumed by `createStubBrainsAdapter()` (`src/lib/brainsApi.ts`).
- [x] **Mixed-brains header badge** — seed the active-engine query with ≥2 distinct engine values across profiles simultaneously. A single-profile or all-agree fixture cannot reach the stacked-dot path (UI-SPEC §2, line 120). **Realized by:** `STUB_PROFILE_ENGINES` — three profiles, three distinct engines (`anthropic-sonnet-5` / `claude-cli-sonnet5` / `ollama-llama3`).
- [x] **cmdk duplicate-value regression guard** — include two catalogue entries sharing a display `name` but differing `id`s; assert both stay independently selectable. Guards the known cmdk value-keyed selection defect (duplicate values ⇒ double-highlight + ArrowDown loop). **Realized by:** `STUB_CATALOGUE` — `anthropic-sonnet-5` and `openrouter-sonnet-5-dup`, both named "Sonnet 5", distinct `id`s.

---

## Wave 0 Requirements

- [x] `src/lib/brainsApi.ts` + `src/lib/brainsApi.test.ts` — the D-16 adapter seam and its contract-conformance test
- [x] `convex/activeEngine.ts` (or equivalent) + `convex/activeEngine.test.ts` + a `convex/schema.ts` table addition — the new reactive per-profile table
- [x] `src/hooks/useActiveEngine.ts` — per-profile + mixed-state reactive hook
- [x] `src/components/brains/*.test.tsx` — `BrainPickerRow`, `BrainPicker`, `GlobalSwapModal`, `BrainHeaderBadge`, `BrainFallbackNotice`, `BrainsWsRegistrar`
- [x] `103-CONTRACT.md` — the D-17 deliverable this phase must produce
- [x] `brain-swap.spec.ts` — new Playwright E2E spec against the stub

**Schema-push note (self-hosted Convex):** the new table means TypeScript types come from
`convex/schema.ts`, so `npm run build` and `npx tsc --noEmit` will pass **whether or not the table
exists on the live instance**. That is a false-positive verification state. A schema push
(`npx convex deploy` against the self-hosted instance) must land before any test claims the
reactive path works. Never `import --replace-all`; never bulk-delete on the live instance.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Result (2026-07-28, 103-08-T2) | Result (2026-07-29, 103-13-T1) |
|----------|-------------|------------|-------------------|---------------------------------|---------------------------------|
| Global swap against the running stack | BSC-05 (global axis) | Requires a live astridr process; `swap.set` mutates real process-wide state | With astridr up: open the picker, select `All profiles` scope, pick a different brain, confirm. Assert the `swap.state` push updates the badge, then use "Restore usual brain" to revert. Endpoint-exists ≠ integration-works. | ❌ **NOT VERIFIED** — dispatch/readback/revert leg blocked by open defects #5/#6 (see Live Global-Axis Verification section above). The confirm gate itself (nothing dispatches pre-confirm) IS verified. | ⚠ **PARTIAL PASS** — dispatch → readback → revert leg IS now genuinely live-verified and honest (OBS 4-7, OBS 12): badge/pill/BrainControl update from the readback, the modal reports the real `swap.set` outcome, and both revert paths (GlobalSwapModal's toast action, BrainControl's independent button) restore/clear correctly with a real visible result. Still **not a full pass**: OBS 8 found the pre-swap confirm modal is not honest about per-profile impact (see below) — a real, unfixed defect. See "Gap-Closure Live Re-Verification (103-13-T1)" above. |
| Composer pill placement on `Chat.tsx` | BSC-02 (D-05 corrected) | Visual placement/overlap in the real composer, not assertable in jsdom | Load `/chat`, confirm the pill renders in the composer without displacing the send affordance at narrow widths. | Not independently re-verified this session (last verified in 103-07 execution). | ✅ **VERIFIED** — OBS 9: at 420×900 the send button remains fully inside the viewport (`{x:339, y:291.66, w:44, h:44}`), the pill is visible, `document.scrollWidth > clientWidth` is false. |
| Confirm-modal per-profile accuracy | BSC-01 / BSC-04 (D-11) | Requires real, live `profileConfigs`/`activeEngineSnapshots` data, not assertable against a stub or unit fixture | Trigger an "All profiles" swap; read the confirm dialog's per-profile `current → new` list and pinned-default count against real profile data queried directly from Convex. | Not independently re-verified live this session — relied on unit coverage only (`GlobalSwapModal.test.tsx`). | ❌ **FAILED — OBS 8, real defect, not fixed.** Modal shows all 3 profiles as "Auto" with `pinnedCount=0`; live Convex `profiles:listConfigs` shows all 3 carry a real pinned `modelPreferences.primary`. `BrainPicker.tsx:362-374` reads from `activeEngineSnapshots` (empty for real profiles) instead of `profileConfigs.modelPreferences`. Larry's explicit disposition: leave unfixed, tracked as a defect. |
| Live catalogue scale behavior | BSC-02 | The real catalogue is ~300+ entries; fixtures are small | With astridr up, open the picker and confirm rows wrap without truncation and provider grouping holds — the three UX lessons already learned in `BrainControl.tsx`'s checkpoint rounds. | ✅ **VERIFIED** — live `swap.catalogue` returned 331 real engines, grouped correctly under "API" (Opus 4.8, Sonnet 5, Haiku 4.5, Fable 5, Ai21/Jamba, and others). | ✅ **RE-CONFIRMED** — 331 live entries again this run (see "Additional live fact" above); keyboard search/filter over the same catalogue also verified (OBS 10). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s (quick) / 90s (full)
- [x] Every fixture in "Fixtures That Actually Exercise the Behavior" is realized
- [x] Schema push landed before any reactive-path test is claimed green (103-02-T2, live-deployed and confirmed 2026-07-28)
- [x] Global-axis manual verification **performed** against the running stack (not stubbed) — **partial result, not a pass**: catalogue read + D-15 confirm gate genuinely live-verified; dispatch/readback/revert leg NOT verified, two defects (#5/#6) left open. See "Live Global-Axis Verification (103-08-T2)" above.
- [x] **UPDATE 2026-07-29 (103-13-T1, gap-closure re-verification):** the dispatch → readback → revert leg IS now genuinely live-verified and honest — defects #5 and #6 (and OBS 7's newly-found revert-restores-wrong-thing regression, fixed live mid-session by Plan 103-14) are closed. The catalogue read, D-15 confirm gate, and now the write/readback/revert leg are all live-proven for the global axis, on both the GlobalSwapModal and BrainControl surfaces. **What is still NOT proven:** the D-11 pre-swap confirm modal's per-profile accuracy (OBS 8, real defect, not fixed this cycle — see "Gap-Closure Live Re-Verification (103-13-T1)" above) and the entire per-profile axis (correctly deferred to astridr Phase 184.1 — `models.catalog` confirmed absent from Ástríðr's live accepted command union this session). BSC-05 is therefore still not a full pass; see `.planning/REQUIREMENTS.md` for the exact restated markers.
- [x] `nyquist_compliant: true` set in frontmatter

## Not Closed by This Phase

**Per-profile axis (unchanged, deferred to astridr Phase 184.1 — by design, not a defect):**
1. That a real `gateway.model.set` exists, accepts the contract payload, and changes the resolved model for the next real turn.
2. That per-profile active-engine telemetry flows from a real astridr process into the new Convex table (`activeEngineSnapshots`).
3. That CLI subscription brains are reachable / healthy / quota-tracked through a real CLI Gateway.
4. Any observed interaction between the per-profile mechanism and the live Phase-185/186 global override (`103-CONTRACT.md` §9).

**Global axis (discovered 2026-07-28, open defects — NOT deferred, owned by this phase, feed a gap-closure cycle):**
5. `GlobalSwapModal.tsx:154,159-169` — fans out N deferred `gateway.model.set` calls for global scope (violates `103-CONTRACT.md` §8) and discards the real `swap.set` result via `.catch(() => {})`, so the result rows report failure for the wrong axis.
6. `BrainHeaderBadge.tsx:71-91` — the global fallback only subscribes to `swap.state` (a change event); it never requests `swap.get_state` on mount, so an already-active global override never appears on page load.

> **UPDATE 2026-07-29 (103-13-T1, gap-closure re-verification) — defects #5 and #6 are CLOSED,
> live-confirmed, not just unit-tested.** #5 fixed by Plan 103-12 (`GlobalSwapModal` now awaits and
> reports the real `swap.set` ack + `swap.state` readback; zero `gateway.model.set` calls for global
> scope) — live-confirmed by OBS 5 above (no `union_tag_invalid` rows, no false 0/N failure). #6 fixed
> by Plan 103-09 (`useResolvedBrain` snapshot-pulls `swap.get_state` on every connect, shared by the
> badge and composer pill) — live-confirmed by OBS 2-4 above (the three-way disagreement did not
> reproduce). A seventh defect was found live during this same re-verification and fixed mid-session
> (Plan 103-14: `GlobalSwapModal.runRevert` was clearing the override instead of restoring the prior
> one — see OBS 7's two-part entry above) — closed and re-verified PASS in the same session. **One
> defect remains open and unfixed: OBS 8** (the D-11 confirm modal's per-profile accuracy) — a new
> finding from this session, not one of the original six, and it is explicitly NOT closed by this
> cycle.

**Out-of-scope follow-ups (noted, deliberately not fixed this phase):**
- **Dead `gateway.provider.set_enabled` dispatch** — `src/components/ProviderControls.tsx:188` dispatches a command with zero server-side handlers anywhere in `astridr/` (`103-CONTEXT.md` D-13 correction). Pre-existing bug, out of this phase's scope.
- **Astridr-side registration and implementation of Phase 184.1** against `103-CONTRACT.md` — the per-profile backend itself. Belongs in `astridr-repo`, not CodePulse.
- **WS keepalive `{"type":"ping"}` rejected by Ástríðr's command validator** (found during 103-08-T2 live verification) — pre-existing, unrelated to brain-swap, worth its own astridr-repo ticket.

## What This Phase Does NOT Claim

- **BSC-05 is NOT marked fully satisfied, even after 103-13-T1.** The global axis's read, confirm-gate,
  and now write/readback/revert legs are all genuinely live-verified (both the GlobalSwapModal and
  BrainControl surfaces). The per-profile axis remains stub-backed by design (confirmed this session:
  `models.catalog` is absent from Ástríðr's live accepted command union). And OBS 8 found a real,
  unfixed defect in the D-11 confirm modal's per-profile accuracy — so even the global axis's honesty
  chain has one open gap. See `.planning/REQUIREMENTS.md` for the exact restated markers.
- **No stub run is reported as live per-profile verification** — `e2e/brain-swap.spec.ts`'s own
  header comment and this document both say so explicitly.
- **No partial live global-axis check is reported as a full BSC-05 pass** — the per-step results
  table above (103-08-T2) and the per-observation table above (103-13-T1) each name exactly what
  passed and what did not, with the real defects that block the rest.

**Approval (2026-07-28, superseded in part below):** ~~Conditionally approved with two open defects.~~
Wave 0 delivery, unit-test coverage, the stub round trip, and the global axis's read/confirm-gate
behavior were genuinely verified; the write/readback/revert leg was not.

**UPDATE 2026-07-29 (103-13-T1):** The global axis's write/readback/revert leg is now genuinely
live-verified — defects #5 and #6 (plus the OBS-7 revert-regression found and fixed live this
session, Plan 103-14) are closed. **Still not a full BSC-05 pass:** OBS 8 (D-11 confirm-modal
per-profile accuracy) is a real, live-confirmed, unfixed defect, and the per-profile axis remains
correctly and honestly deferred to astridr Phase 184.1. See `.planning/REQUIREMENTS.md`'s restated
BSC-01/02/04/05 markers for the exact, evidence-cited status of each requirement.
