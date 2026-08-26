# Phase 125: Signature Layers - Research

**Researched:** 2026-08-21
**Domain:** Real-time WS telemetry identity/timing (cross-repo), Convex bounded-read query design, Canvas 2D color resolution from CSS custom properties, Vite code-splitting, self-hosted webfont loading
**Confidence:** HIGH on all six priority items (R-1..R-6) — every claim below is either a direct code read with `file:line`, or an empirical probe run in this session (headless Chromium via this repo's own Playwright install, `npm run build`, `npm view`/`slopcheck`).

## Summary

CONTEXT.md and UI-SPEC.md already answered every design question; this document answers the six things the planner cannot resolve from those artifacts alone. The single highest-value finding is in R-1: **the WS telemetry payload cannot carry a Convex `_id` for the majority of events without changing `ConvexHandler`'s non-blocking batched architecture**, and a large, previously-unexamined family of events (`run.*`, `chat.response`, `agent_status_change`, some `approval_request`) **never reaches Convex at all** — they are WS-only by design (`send_live()`). This is stronger and more specific than UI-SPEC's own framing ("unverified, not assumed") and materially changes what "reconciliation" means for D-12's numeral. R-2 confirms the `estop_state` emitter change is a clean, low-risk, single-injection-point change (`EmergencyStop.activate()`/`.deactivate()` in `astridr-repo/astridr/engine/estop.py`) that automatically covers all five activation surfaces, and that the client's `TOPIC_EVENT_MAP` gap UI-SPEC flagged does **not** block the horizon's chosen `subscribeEvent()` mechanism. R-3 and R-6 are now real, measured numbers rather than a method description. R-4 empirically overturns part of the UI-SPEC's own suggested implementation: Chromium's canvas `fillStyle` accepts `oklch()`/`oklab()` strings **directly and correctly** (verified via actual pixel output, not just string echo) — the offscreen-canvas round-trip is unnecessary. R-5 confirms a usable index already exists on `runtime_events` — no schema/index-addition task is needed for the ECG's bounded query.

**Primary recommendation:** Do not let the planner build the D-12 numeral against a WS-carried `_id` — that path doesn't exist today and can't be added without either accepting extra latency on every event or generating a client-side event id at emit time (a specific implementation this research recommends over UI-SPEC's more general "add the id in the emitter" framing). Everything else in this phase is lower-risk and has a concrete, verified answer below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signal Horizon rendering + state machine | Browser / Client | — | Pure CSS/JS in `DashboardLayout.tsx`, no server logic |
| E-Stop truth state (`estop_state`) | API / Backend (Ástríðr) | Browser (consumer) | Ástríðr is the only process that knows the real halt state (D-01); CodePulse/Convex must not originate or cache it as truth |
| Pulse ECG live blips | Browser / Client (WS consumer) | API / Backend (Ástríðr, as producer) | Ástríðr pushes events; the canvas is pure client-side rendering |
| Pulse ECG 60s backfill | Database / Storage (Convex) | API / Backend (Convex query layer) | One bounded read on mount; Convex owns the durable event log for events that reach it |
| event_type → hue map | Browser / Client | — | Pure derived lookup, no server round-trip; unit-tested against the server's `TOPIC_EVENT_MAP` as a fixture, not a live call |
| Serif voice trial | Browser / Client (CSS/font loading) | — | No backend involvement; Briefings' data already exists (`api.briefings.listBriefings`) |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIGNAL-01 | Aurora Signal Horizon: 2px line, event packets, crimson on E-Stop arm, dawn disarm | R-2 (estop_state emitter — the only missing mechanism); R-4 is not needed here (horizon uses CSS custom properties directly, not canvas) |
| SIGNAL-02 | Pulse ECG canvas hero, real events, 60s window, `getComputedStyle`, no Recharts, entry-chunk budget holds | R-1 (event identity/timing — the load-bearing finding), R-3 (entry-chunk baseline), R-4 (canvas color resolution), R-5 (bounded Convex query) |
| SIGNAL-03 | Instrument Serif trialled on Briefings only | R-6 (package verification, italic-subpath import, chunk isolation) |
</phase_requirements>

---

## R-1: WS event payload identity and timing (SIGNAL-02, highest priority)

### The exact payload, read at the source

Two call sites build the WS message dict. Both are in `astridr-repo/astridr/engine/telemetry.py`:

- **Buffered/critical path** — `ConvexHandler.send()`, `telemetry.py:346-353`:
  ```python
  payload = {"event_type": event_type, "data": data, "timestamp": event.timestamp}
  ```
- **Live-only path (never reaches Convex)** — `ConvexHandler.send_live()`, `telemetry.py:395-408`:
  ```python
  payload = {"event_type": event_type, "data": data, "timestamp": time.time()}
  ```

Both payloads carry **exactly three keys**: `event_type`, `data`, `timestamp`. There is no `_id`, no `idempotencyKey`, no id-shaped field of any kind. This matches `AstridrWSContext.tsx:31`'s `Record<string, unknown>` typing and its dispatch code (`:319`, reads only `msg.event_type`) — confirmed from both ends, not assumed from one.

### Timestamp: field name, unit, precision, supplier

- Field name: `timestamp` (not `ts`).
- Unit: seconds (Python `time.time()`).
- Precision: **fractional**, not floored — `TelemetryEvent.timestamp: float = field(default_factory=time.time)` (`telemetry.py:214`), assigned once at `TelemetryEvent` construction inside `send()` (`telemetry.py:335-339`), *before* either the WS push or the Convex buffering happens.
- Supplier: the **Python producer** (Ástríðr's own process clock), not Convex. This same float value is later posted verbatim to `/runtime-ingest` as `evt.timestamp` (`telemetry.py:501`), flows through `runtimeIngest.ts:630` (`const timestamp = evt.timestamp ?? now`) into `api.events.insertEvent`, and is stored as `v.float64()` (`convex/events.ts:252`, schema `convex/schema.ts:11`). **The WS timestamp and the eventually-stored Convex timestamp are the same value**, for any event that goes through the buffered `.send()` path — they are not independently assigned by two different clocks. This is a stronger, more precise finding than UI-SPEC's stated uncertainty ("the live WS timestamp originates in a different process... whose clock offset was not measured") for the buffered-path subset of events: for that subset there is no clock-offset question at all, because it's the same float. `send_live()`'s events (see below) use a *second* `time.time()` call at push time (`telemetry.py:403`) rather than reusing a stored value — but since those events never reach Convex, there's nothing to compare it against.

### Sequencing: WS push vs. Convex write

Read `ConvexHandler.send()` in full (`telemetry.py:319-353`): the buffer-append (or `_send_immediate` for critical events) happens in code *before* the WS fan-out block, but "buffer append" is not "Convex write" — for the common case (non-critical events, the overwhelming majority), the row doesn't reach Convex until the next `_flush_loop` tick, **up to `batch_interval` (5.0s) later** (`telemetry.py:453-459`). So for ordinary events, **the WS message arrives at the browser up to 5 seconds before the corresponding Convex row exists.** For critical events (`_send_immediate`, a short explicit allow-list in `CRITICAL_CONDITIONS`, `telemetry.py:25-67`), the Convex POST is *initiated* synchronously before the WS push line executes, but the code does not capture the Convex response (`_post_to_convex` only checks `resp.status_code`, `telemetry.py:523-546`) — so even here, no `_id` is available to attach to the WS payload even in principle, without restructuring the call.

### A structurally larger finding than UI-SPEC anticipated: most Ástríðr-violet events never reach Convex at all

Grepping `astridr-repo/astridr` for `send_live(` call sites and cross-checking against D-06's hue map:

- `astridr/agent/loop.py:626-635` — `_emit_run_event()`, the general helper for `run.*` events, calls `send_live()` exclusively.
- `astridr/api/ws_commands.py:731,818` — `chat.response` via `send_live()`.
- `astridr/automation/agent_status.py:50-60` — `agent_status_change` via `send_live()`.
- `astridr/engine/bootstrap/wiring.py:920` — `approval_request` (dashboard HITL callback) via `send_live()`.
- `astridr/engine/bootstrap/wiring.py:339,365,606,859` — more `run.*`/`swap.state` via `send_live()`.

**None of these event types are ever posted to `/runtime-ingest`.** `send_live()`'s own docstring says so explicitly (`telemetry.py:395-399`: "Does NOT send to Convex HTTP endpoint"), and grepping the whole file confirms `send_live()` has no Convex-POST branch at all. Per D-06, `run.*` and `chat.response` are exactly the event types colored **Ástríðr-violet**. Consequence: **the ECG's Convex-backed 60s backfill can structurally never contain a single violet blip** — not "might be incomplete", but zero by construction, for every event type in that family. Any violet blips visible in the ECG come exclusively from the live WS stream after mount. This is not a defect to fix in this phase (it may be entirely correct that live-run activity is WS-only, given WS-04's sub-100ms delivery requirement), but the planner needs to know it when writing the reconciliation contract: **the "measured 60s window count" (D-12) is, by construction, missing all pre-mount Ástríðr activity**, independent of whichever dedup mechanism (a/b/c) is chosen. Flagged in Concerns for the Planner below.

### A second, unrelated identity landmine found while tracing this: `run.blocks` is emitted twice over WS

`astridr/agent/loop.py:1761-1772` (and mirrored at `astridr/api/post_turn_pipeline.py:460`, `astridr/api/ws_commands.py:741`, `astridr/engine/bootstrap/wiring.py:578`) emits `run.blocks` **twice** for the same logical tool-call turn — once via `_emit_run_event()` → `send_live()` (WS-only), and once via `self.telemetry.send("run.blocks", {...})` (buffered path, which *also* fans out over WS per `send()`'s own logic, `telemetry.py:346-353`). A connected client therefore receives **two separate WS messages** for one `run.blocks` event. Worse: the two call sites can carry **different `session_id` values** — `_emit_run_event()` honours `set_run_event_session_id()`'s override (`loop.py:606-624`, added for the chat-session-reuse case, 189-19), while the direct `.send()` call at `loop.py:1768-1772` always uses `session.id` verbatim. This is a genuine double-count risk for D-12's numeral that is **independent of the backfill/live dedup question UI-SPEC already covers** — it exists purely on the live WS stream, for one specific event type. Whatever dedup mechanism the planner picks for backfill↔live reconciliation must also account for this same-transport, same-event, double-delivery case, or the numeral will overcount every tool-call turn by one `run.blocks`.

### Confirmed: no unused identity field exists to reuse

`idempotencyKey` (`convex/events.ts:18`, `v.optional(v.string())`, "Phase 88 D-04: producer dedup key") exists **only on the `events` table** (build-time hook events). It is populated by exactly one producer in `astridr-repo` — `langfuse_eval.py:138`, for `task_quality` events, a narrow bespoke path routed to `evalScores.ts`, not the generic runtime path. The **`runtime_events` table** (what actually backs the WS-fed events this phase cares about) has **no idempotency/id field at all** in its schema (`convex/schema.ts:8-18`: `eventType`, `data`, `timestamp`, `critical`, `receivedAt`, `archived` — nothing else), and `insertEvent`'s mutation args (`convex/events.ts:248-260`) don't accept one either. This confirms — with a direct schema read, not the prior session's recollection — the STATE.md note that idempotencyKey "may already supply the stable identity" is **false for this event family**: there is no field to reuse; adding one is a genuine schema change.

### Verdict on UI-SPEC's paths (a) / (b) / (c)

- **(a) — Add a stable id in the Ástríðr emitter.** This is necessary, but UI-SPEC's framing ("once every WS event carries the id Convex already assigns its row") is not implementable as stated: for the buffered path, the Convex `_id` doesn't exist yet at WS-push time (push happens up to 5s before the write). The correct implementation is a **client-generated id at emit time** (e.g. `uuid4()` inside `ConvexHandler.send()`/`send_live()`, or one level up at each call site), threaded into **both** the WS payload (new key, e.g. `event_id`) **and** the Convex insert path (a new field on `runtime_events`, since `idempotencyKey` doesn't exist there — this is itself a schema change, i.e. a Convex deploy against the self-hosted instance per `CLAUDE.md`). This is still cross-repo + schema work, same class as D-01's `estop_state`, but it is a different, more specific shape than "use the id Convex assigns" — flag this correction to the planner explicitly.
- **(b) — Time-partitioned merge.** R-1's timestamp finding actually *strengthens* this path for the buffered-event subset: since the WS timestamp and the eventual Convex-stored timestamp are literally the same float (not two independently-clocked values) for anything going through `.send()`, there is no clock-skew risk for that subset. But UI-SPEC's own identity-boundary objection still holds independent of clock skew (two producer-supplied timestamps can legitimately collide at the watermark), **and** this path still yields zero backfill coverage for the entire `send_live()`-only family (R-1 finding above) regardless of watermark precision — a gap D-05/D-12 should account for explicitly, not something (b) can be tuned to fix.
- **(c) — Ship without the numeral.** Structurally the safest given the above; the trace/blips themselves are unaffected by any of this (R-1's findings are all about *counting*, not about *drawing*).

**Recommendation for the planner:** path (a), implemented as a client-generated `event_id` set once at `TelemetryEvent` construction / `send_live()` call and threaded to both transports, is the only option that produces a correctness guarantee for the events that reach both transports — but the planner must additionally decide, as a separate and explicit decision, how the numeral should represent the `send_live()`-only event family (R-1's "structurally zero backfill coverage" finding), since no dedup mechanism resolves that. This is a genuine architecture question beyond what UI-SPEC anticipated; it is flagged, not resolved, here per the constraint not to re-litigate locked decisions — D-12's own text is a decision about the numeral's existence, not about this specific new sub-question.

---

## R-2: `estop_state` emitter (D-01/D-02, cross-repo)

### F-1 re-confirmed with a second, independent probe

`astridr-repo/astridr/channels/web.py:1781-1795` — `GET /api/estop/status` shares the exact same `_estop_precheck()` (`:1730-1750`) as `/activate`/`/deactivate`: loopback-host check (`_LOOPBACK_HOSTS = {"127.0.0.1","::1","localhost"}`) **and** `x-astridr-admin-key` header via `hmac.compare_digest`. The docstring at `:1783-1786` is explicit about why: "read-only, same precheck... 'probe by mutating' is how the 189-15 session nearly shipped an unauthorized deploy." **F-1's claim is confirmed**, from a second read (the status route itself, not just the activate route referenced in CONTEXT.md).

### Concrete emitter shape

`EmergencyStop.activate()`/`.deactivate()` (`astridr-repo/astridr/engine/estop.py:103-198`) is the single correct injection point, and it is a clean one:

- `activate()` (`:103-159`) already calls `self._telemetry.send("security_event", {"layer": "estop", "severity": "critical", "action": "activated", ...})` at `:150-159` — this is a **different** event type from what D-01 needs. The new `estop_state` emission must be an **additional** `self._telemetry.send("estop_state", {"armed": True, "reason": reason, "initiator": initiator}, ...)` call, not a modification of the existing `security_event` call (that one legitimately stays, for the `security` topic/audit trail).
- `deactivate()` (`:161-198`) has **zero telemetry calls today** — read the full method body, no `self._telemetry.send(...)` anywhere. This is new code, not modified code: D-01/D-02 requires adding a `self._telemetry.send("estop_state", {"armed": False, ...})` call here from scratch.
- Both methods are reached by **all five documented activation surfaces** (loopback HTTP, in-process `estop.activate()`, CodePulse WS command, Telegram/Slack `/estop`, and — per the class's own docstring — nothing else works) because they all ultimately call this same `EmergencyStop` instance's `activate()`/`deactivate()`. Centralizing here, rather than in each surface's handler (e.g. `ws_commands.py:1055-1066`'s `_handle_estop_activate`), automatically covers every surface with one change.

### On-connect push — the exact `commands.catalog` mechanism to copy

`astridr-repo/astridr/engine/ws_telemetry.py:178-192` is the precedent, read in full: `create_ws_router()` takes an optional `command_registry: Any | None = None` parameter; if provided, immediately after `register_ws(q)` and `websocket.accept()` but **before** `push_task = asyncio.create_task(push_loop())` starts, it does a direct `await websocket.send_json({...})` (not through the queue, not subject to topic filtering, since the client hasn't even sent its `subscribe` message yet). `estop_state`'s on-connect push should follow this identical shape: add an `estop: Any | None = None` parameter to `create_ws_router()`, and a matching direct-send block reading `estop.is_active` / `estop.reason` (both existing properties, `estop.py:86-92`).

**Wiring is trivial** — `create_ws_router(...)` is called from exactly one place, `astridr-repo/astridr/engine/bootstrap/wiring.py:930-933`, inside `_setup_ws_telemetry()` (defined at `wiring.py:370`), whose **signature already accepts `estop: Any`** (`wiring.py:375`) and already threads it to other call sites in the same function (`:631-660`). No new plumbing is needed to get the `estop` instance to the `create_ws_router()` call — it's already in scope.

### Client-side: the `TOPIC_EVENT_MAP` gap does not block `subscribeEvent`

CONTEXT.md/UI-SPEC both cite `AstridrWSContext.tsx:58-95` lacking an `infrastructure` entry as a gap. Read in full (`AstridrWSContext.tsx:56-104`, and the dispatch code `:294-343`): this map is **only consulted for `subscribe(topic, cb)` listeners** (`EVENT_TO_TOPICS` lookup at `:329-336`). **`subscribeEvent(eventType, cb)` (`:454-465`, the mechanism UI-SPEC actually specifies for the horizon) bypasses this map entirely** — it's a flat `eventSubsRef` registry keyed on `event_type`, fanned out unconditionally at `:322-326` regardless of topic. So: the client `TOPIC_EVENT_MAP` gap is real (it would matter if something called `subscribe("infrastructure", cb)`), but it **does not block D-01/D-02's chosen mechanism** — a fresh finding, not previously stated in CONTEXT.md/UI-SPEC, worth correcting for the planner so no one spends a task "fixing" a gap that isn't actually load-bearing for this feature.

Server-side, `estop_state` will be delivered even **without** adding it to `TOPIC_EVENT_MAP`/`VALID_TOPICS`: `_event_matches_topics()` (`ws_telemetry.py:78-86`) returns `True` for any event type with no topic mapping ("Unknown event type — deliver if subscribed to any topic (best-effort)"), and the client always subscribes to all five known topics on connect (`AstridrWSContext.tsx:133,288`, `ALL_TOPICS`). Adding `estop_state` to a topic (e.g. `security`) server-side is still the cleaner, precedent-following choice, but it is not structurally required for delivery to work — noted so the planner doesn't treat it as a blocking prerequisite.

---

## R-3: Entry-chunk baseline (D-10)

Measured via `npm run build` (repo HEAD, clean working tree at time of build; ran twice, identical hashes both times — the build is deterministic, so this is a stable baseline, not a one-off sample):

| Asset | Raw size | Gzip |
|---|---|---|
| **Entry JS** — `dist/assets/index-CyAqQtIE.js` | **583,049 bytes (583.04 kB)** | **173.73 kB** |
| **Entry CSS** — `dist/assets/index-MiRtUUCk.css` | **237,359 bytes (237.35 kB)** | **33.93 kB** |
| Lazy Dashboard chunk (for contrast, NOT the ratchet target) — `dist/assets/Dashboard-DPvT852O.js` | 73,110 bytes (73.11 kB) | 18.64 kB |

`dist/index.html:` `<script type="module" crossorigin src="/assets/index-CyAqQtIE.js">` confirms this is genuinely the entry (not inferred from filename convention alone). `Dashboard-DPvT852O.js` exists as a separate chunk, confirming `src/App.tsx:18`'s `lazy(() => import("./pages/Dashboard"))` and F-3's inversion claim: the ECG canvas (inside `Dashboard`) lands in a lazy chunk; the Signal Horizon (inside `DashboardLayout`, statically imported at `src/App.tsx:4`) is what actually contributes to the entry bundle.

**Recommended ratchet shape** (matching `src/tokenSweep.ratchet.test.ts`'s own precedent exactly, not just "similar"): that file's D-25/D-26 CSS-presence buckets (`:305-341`) use `existsSync(dist/assets)` → `null` sentinel → `it.skipIf(DIST_CSS === null)(...)` with a `console.warn(DIST_CSS_SKIP_REASON)` fallback (`:390,398-400,538,551-553`) rather than silently passing. For D-10, resolve "the entry file" the same way this research did — read `dist/index.html`'s `<script type="module" src="...">` — rather than hardcoding the `index-*.js` naming convention (which is a Vite default, not a contract). Record today's 583,049 / 237,359-byte baseline literally in the ratchet as the starting point, with a stated allowance (the plan should pick a percentage or fixed-KB budget; this research does not set that number — it's a planning/product call, not something to derive from evidence).

---

## R-4: Canvas colour resolution from oklch tokens (empirically verified, not assumed)

Ran a live probe in this repo's own Playwright-bundled Chromium (headless, `chromium.launch()`, version reported below) against a real `<canvas>` 2D context — script and full output preserved for reproducibility:

```js
ctx.fillStyle = "oklch(0.7 0.15 200)";
// => ctx.fillStyle reads back "oklch(0.7 0.15 200)" (accepted, not silently rejected)
ctx.fillRect(0,0,10,10);
ctx.getImageData(5,5,1,1).data // => [0, 185, 195, 255] — a real, correctly-converted teal/cyan pixel
```

**Chromium 149.0.7827.55 (this repo's Playwright 1.61.1 bundle) accepts `oklch()` and `oklab()` strings directly in `fillStyle`, and genuinely parses/renders them** — verified by reading back actual pixel bytes via `getImageData`, not just by the string round-tripping (a string could theoretically be accepted and silently ignored; the pixel readback rules that out). The UI-SPEC's suggested offscreen-1×1-canvas round-trip technique **also works** (tested, identical pixel output) but **is not necessary** — passing `getComputedStyle(el).getPropertyValue('--primary')`'s raw `oklch(...)` string straight into `ctx.fillStyle`/`ctx.strokeStyle` works directly in the browser engine this project's tooling targets.

The house lesson about `fillStyle` silently keeping its prior value on unparseable input was also reproduced empirically in the same probe: setting a known-good sentinel (`#00ff00`) then an invalid string (`"not-a-color-at-all"`) left `fillStyle` at `#00ff00` — confirmed, not assumed. **Recommendation:** the plan does not need a conversion helper for the draw path itself, but should still include a one-time startup sanity check (set a sentinel, resolve the real token, assert `fillStyle` changed) so a future CSS-var typo or empty-string token fails loudly instead of silently painting the wrong (or previous) color.

**Scope of this finding:** verified in Chromium only (this project's own test runner's engine). No cross-browser (Safari/WebKit, Firefox) requirement was found stated anywhere in CLAUDE.md, REQUIREMENTS.md, or the UI-SPEC — this app appears to be developed/tested Chromium-first (Playwright default). If Safari support is ever a stated requirement, WebKit's `oklch()` canvas support should be probed separately before relying on this finding there; flagged as an open question below, not assumed either way.

---

## R-5: Bounded 60s Convex backfill query (D-05)

`runtime_events` schema (`convex/schema.ts:8-18`) — the table that actually receives everything posted to `/runtime-ingest` (confirmed at `convex/runtimeIngest.ts:637-643`: **every** event type is unconditionally inserted here via `api.events.insertEvent`, in addition to any type-specific routing like `llm_call`→`llm.recordCall`):

```
runtime_events: defineTable({
  eventType: v.string(), data: v.any(), timestamp: v.float64(),
  critical: v.boolean(), receivedAt: v.float64(), archived: v.optional(v.boolean()),
})
  .index("by_type", ["eventType"])
  .index("by_timestamp", ["timestamp"])
  .index("by_critical", ["critical", "timestamp"])
```

**A usable index already exists: `by_timestamp`.** No schema/index-addition task is needed — this contradicts the "flag if no suitable index exists" caution in the task brief; the good news is a suitable index is already present, so this is a plain query-authoring task, not a schema-deploy task (independent of R-1's event-id finding, which *does* require a schema change if path (a) is chosen).

**Recommended query shape** (a new function, not `listRecentUnified`, per D-05's explicit instruction): bound to `runtime_events` only (not the `events`+`runtime_events` merge `listRecentUnified` does — the build-time `events` table is unrelated hook telemetry, not Ástríðr runtime activity, and none of D-06's hue-mapped event types originate there), range-bound on `timestamp` to `[now - 60, now]` via `.withIndex("by_timestamp", q => q.gte(...).lte(...))`, and project only what D-06/D-12 actually need: `_id` (for R-1's identity work, if path (a) is chosen), `eventType`, `timestamp`. **Do not project `data`** — it's `v.any()` and can carry arbitrary payload bytes (tool arguments, blocks, etc.); the hue map is keyed on `eventType` alone (per D-06's rules, "error-shaped types" are event-type names like `run.error`, not a `data.status` inspection), so `data` isn't needed for coloring and skipping it keeps the read light, consistent with this repo's own house lesson about avoiding unnecessarily large reads.

---

## R-6: `@fontsource/instrument-serif` (SIGNAL-03)

Verified directly against the npm registry and the actual package tarball (not training-data recall):

- **Exists, current version 5.3.0** (`npm view @fontsource/instrument-serif version`), same publisher org as the already-installed `@fontsource-variable/geist` (`repository.url: git+https://github.com/fontsource/font-files.git`).
- **`slopcheck scan --pkg npm @fontsource/instrument-serif` → `"status": "OK"`, zero flags** — package legitimacy gate passed (full audit table below).
- **Ships exactly one weight (400), confirmed by tarball listing**, in two separate style subpaths: `400.css` (normal) and `400-italic.css` (italic) — this contrasts with the variable `@fontsource-variable/geist` already in `package.json:28`, confirming D-14's framing that the self-hosted-import convention differs between the two packages.
- **Critical, load-bearing correction to a naive implementation:** the package's default import (`main: index.css`, what a bare `import "@fontsource/instrument-serif"` pulls in) **contains only the NORMAL `@font-face` declarations** (read directly: `index.css`'s two `@font-face` blocks both have `font-style: normal`). D-15's typography contract needs **italic**. A plan that imports the bare package root will silently get faux/oblique-italic rendering of the normal face (or a fallback to Georgia's italic, depending on font-matching), never the true Instrument Serif italic design. **The Briefings module must import the specific subpath `@fontsource/instrument-serif/400-italic.css`**, not the bare package import.
- Actual byte cost of what a browser downloads for this trial (the italic latin subset, the one a typical English-locale visitor's font-matching will select): `instrument-serif-latin-400-italic.woff2` = 22,128 bytes (≈21.6 KB). Small, in line with D-14's "chunk-scoped, nobody who never opens Briefings downloads it" intent.
- **Chunk isolation confirmed, not assumed:** `Briefings` is already `lazy(() => import("./pages/Briefings"))` (`src/App.tsx:28`), and today's build already produces a separate `Briefings-BUNcHrTx.js` chunk. `BriefingFeedItem` (`src/components/BriefingFeedItem.tsx`) has exactly **one** importer in the whole `src/` tree — `src/pages/Briefings.tsx` itself (`grep` confirms 2 files total: the definition and its one consumer) — so importing the font CSS inside either file cannot leak into any eagerly-loaded chunk, and specifically cannot leak into `/chat`'s `ChatBubble` (a separate, unrelated component tree, per D-13's own reasoning).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource/instrument-serif` | `5.3.0` [VERIFIED: npm registry, `npm view`] | Self-hosted Instrument Serif, italic subpath | Same publisher/convention as the existing `@fontsource-variable/geist`; already the house self-hosting pattern |

No other new runtime dependency is needed — the Signal Horizon is pure CSS/JS on existing tokens, and the Pulse ECG is a native `<canvas>` with no charting library (criterion 2 explicitly excludes Recharts).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource/instrument-serif/400-italic.css` subpath import | bare `@fontsource/instrument-serif` package import | Bare import ships only the normal style — silently wrong for D-15's italic requirement (R-6) |
| Native canvas `fillStyle = oklch(...)` | Offscreen-canvas round-trip conversion (UI-SPEC's suggestion) | Round-trip works but is unnecessary overhead — R-4 shows direct assignment already renders correctly in this project's target engine |

**Installation:**
```bash
npm install @fontsource/instrument-serif
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@fontsource/instrument-serif` | npm | actively maintained (5.2.6→5.3.0 seen in recent version history) | not individually queried; part of the widely-used `fontsource` distribution already in this repo's dependency tree | `github.com/fontsource/font-files` [VERIFIED via `npm view repository.url`] | `[OK]`, zero flags [VERIFIED: `slopcheck scan --pkg npm`] | **Approved** |

**Packages removed due to slopcheck `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none.

Package name provenance note: `@fontsource/instrument-serif` was named directly by this project's own locked decision D-14 (`125-CONTEXT.md`), not sourced by this research session via web search or training recall — its existence, version, content, and legitimacy were independently verified against the live npm registry and the actual tarball in this session (`npm view`, `npm pack --dry-run`/tarball extraction, `slopcheck scan`), which is why it is tagged `[VERIFIED: npm registry]` above rather than `[ASSUMED]`.

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr container (astridr-repo)                          CodePulse browser
────────────────────────────────                          ──────────────────
EmergencyStop.activate()/deactivate()  ─┐
  (estop.py, all 5 activation surfaces) │
                                         ├─► ConvexHandler.send("estop_state", …)
run.* / chat.response events            │        │
  (send_live(), sub-100ms path)  ───────┤        ├─► WS fan-out (telemetry.py:346-353)
                                         │        │        │
command_execution/docker_status/… ──────┤        │        ▼
  (send(), buffered, 5s batch)          │        │   /ws/telemetry  ──────►  AstridrWSContext
                                         │        │   (ws_telemetry.py)          │
                                         │        │   • on-connect push          ├─ subscribeEvent("estop_state")
                                         │        │     (estop_state, new;       │    → Signal Horizon state machine
                                         │        │      commands.catalog        ├─ subscribeEvent(hue-mapped types)
                                         │        │      precedent, :178-192)    │    → Pulse ECG live blips
                                         │        │                             │
                                         │        └─► _flush_loop (5s) ──► POST /runtime-ingest
                                         │                                        │
                                         │                                        ▼
                                         │                              convex/runtimeIngest.ts
                                         │                                        │
                                         │                                        ▼
                                         │                        runtime_events table (by_timestamp index)
                                         │                                        │
                                         │                                        ▼
                                         │                    NEW bounded 60s query (R-5) ──► Pulse ECG backfill
                                         │                                                         on mount
                                         └─ (send_live()-only events: run.*, chat.response, etc.
                                             NEVER reach runtime_events — R-1 finding)
```

### Pattern 1: Fail-closed WS state machine (Signal Horizon)
**What:** the horizon defaults to a visibly non-calm "Unknown" state until a fresh, well-formed `estop_state` snapshot confirms calm — never defaults to calm on absence of information.
**When to use:** any UI surface deriving a safety-relevant state from an async, reconnecting transport.
**Example:** UI-SPEC's own state-machine section (`125-UI-SPEC.md:159-172`) already specifies this fully; no further research needed here — this pattern is implementation-ready as written.

### Pattern 2: Ratchet-with-skip-reason for build-artifact assertions
**What:** a Vitest suite that reads `dist/assets/` at test time, uses a `null`-sentinel when the directory is absent, and `it.skipIf(sentinel === null)` with a `console.warn` explaining why — never a silent pass.
**When to use:** D-10's entry-chunk byte-budget ratchet.
**Example:**
```typescript
// Source: src/tokenSweep.ratchet.test.ts:305-341,390,398-400 (this repo, read directly)
const DIST = existsSync(distAssets) ? /* read */ : null;
it.skipIf(DIST === null)("entry chunk stays under budget", () => { /* ... */ });
if (DIST === null) console.warn("[D-10] SKIPPED: no dist/assets found — run `npm run build` first");
```

### Anti-Patterns to Avoid
- **Assuming Convex's `_id` can be embedded in the WS payload at push time:** for the majority of events (buffered path), the Convex row doesn't exist yet when the WS message is sent — R-1.
- **Regex-scraping `getComputedStyle`'s `oklch()` string for channel values:** this repo's own documented defect class (reads the hue angle as a color channel). R-4 shows the correct approach is to hand the string to `fillStyle` directly, not parse it.
- **Importing the bare `@fontsource/instrument-serif` package root expecting italic:** ships normal-style only — R-6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| oklch → canvas-usable color conversion | A regex/manual color-space converter | Direct `fillStyle = <oklch string>` assignment | R-4: the browser engine already does this correctly; a hand-rolled converter is unverified extra code solving an already-solved problem |
| Coalescing/flash-debounce for the horizon | A second 1s-drop mechanism | `useLiveFlash.ts:22-24`'s existing pattern (`if (now - lastFlashRef.current < 1000) return;`) | D-07 already mandates this; confirmed the exact reusable line |

## Common Pitfalls

### Pitfall 1: Treating "add a stable id" as a small, contained cross-repo change
**What goes wrong:** planning it as "thread the Convex `_id` into the WS payload" as UI-SPEC's own text suggests.
**Why it happens:** the Convex `_id` doesn't exist at WS-push time for buffered events (R-1) — this isn't available to thread through even with unlimited engineering time, without restructuring the non-blocking send path.
**How to avoid:** plan for a client-generated id (set once, at `TelemetryEvent`-construction/`send_live()`-call time) threaded to both transports, plus a new `runtime_events` schema field (since no unused id field exists there — R-1/R-5) to hold it.
**Warning signs:** a task description that says "read the Convex response and forward its `_id`" — that ordering is impossible for the buffered path.

### Pitfall 2: Assuming the ECG's backfill and live streams cover the same event universe
**What goes wrong:** treating a mismatch between backfill count and live count as purely a timing/dedup bug.
**Why it happens:** `run.*`/`chat.response`/`agent_status_change`/some `approval_request` events are WS-only by design (`send_live()`) — R-1. No dedup fix closes this gap; it's not a bug, it's the current architecture.
**How to avoid:** state explicitly in the plan whether the numeral is meant to represent "all events" (impossible to backfill completely) or "events this component can measure" (achievable, but must be labeled honestly per the honest-states law).
**Warning signs:** a QA finding of "the numeral undercounts violet events right after page load" being triaged as a dedup defect rather than the expected, by-design behavior.

### Pitfall 3: `run.blocks` double-delivery inflating the count
**What goes wrong:** the numeral counts one tool-call turn as two events.
**Why it happens:** `run.blocks` is emitted via both `send_live()` and `send()` from the same code block (`loop.py:1761-1772`) — R-1.
**How to avoid:** whatever identity mechanism is chosen for backfill↔live reconciliation must also dedup within the live stream itself for this one event type, not only across the two transports.
**Warning signs:** the numeral incrementing by exactly 2 for a single observed tool call during manual testing.

## Code Examples

### Reading a CSS custom property and painting it directly to canvas (no conversion needed)
```typescript
// Verified empirically this session (headless Chromium 149.0.7827.55,
// this repo's own Playwright 1.61.1 bundle) — see R-4 above for the full probe.
const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
// primary is an oklch()/oklab() string in this Tailwind v4 app.
ctx.fillStyle = primary; // accepted and rendered correctly — no round-trip needed.
```

### Bounded 60s window query shape (D-05/R-5)
```typescript
// New function, NOT listRecentUnified (convex/events.ts:193-244) — see R-5.
// Uses the EXISTING by_timestamp index on runtime_events (convex/schema.ts:17).
export const listRecentRuntimeWindow = query({
  args: { windowSeconds: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const windowSec = args.windowSeconds ?? 60;
    const nowSec = Date.now() / 1000; // matches the existing house convention at events.ts:204
    const lo = nowSec - windowSec;
    return await ctx.db
      .query("runtime_events")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", lo).lte("timestamp", nowSec))
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect(); // bounded by the 60s window itself, not an arbitrary .take() limit
  },
});
```

## State of the Art

Not applicable in the usual sense (no library-version drift involved) — the relevant "state of the art" facts are the empirical/code-read findings above, all dated to this research session (2026-08-21).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | R-4's canvas `oklch()` finding generalizes to Larry's actual runtime browser (not just this session's headless Chromium probe) | R-4 / Canvas color resolution | Low — Chromium/Chrome/Edge share the same Blink canvas implementation as of the tested version; risk is confined to Safari/WebKit, which no project doc requires support for |
| A2 | A percentage/fixed-KB allowance for the D-10 ratchet is a product decision, not derivable from this research | R-3 / Standard Stack | If the planner picks an arbitrarily tight allowance, ordinary dependency drift could fail the ratchet for unrelated reasons; if too loose, it fails to catch real regressions |

**Everything else in R-1 through R-6 is `[VERIFIED]`** — direct code reads with `file:line`, or empirical probes run in this session (headless Chromium, `npm run build`, `npm view`, `slopcheck scan`), not training-data recall.

## Open Questions

1. **Does this app have any stated cross-browser (Safari/WebKit) support requirement?**
   - What we know: R-4's canvas finding is Chromium-verified only; no cross-browser requirement was found in CLAUDE.md, REQUIREMENTS.md, or 125-UI-SPEC.md.
   - What's unclear: whether WebKit's `oklch()` canvas support matches Chromium's (untested this session).
   - Recommendation: if it matters, a 5-minute WebKit probe (same script, `playwright.webkit`) before relying on direct `fillStyle` assignment there; otherwise treat as Chromium-scoped, consistent with the rest of this app's tooling (Playwright's default browser).

2. **What should the D-12 numeral represent, given R-1's `send_live()`-only gap?**
   - What we know: the gap is structural, not a bug; no dedup mechanism closes it.
   - What's unclear: whether the product intent is "count of events this component can see" (achievable, honest) vs. an implicit expectation of "count of all Ástríðr activity" (not achievable without changing `send_live()`'s architecture, out of this phase's scope).
   - Recommendation: the planner/CONTEXT-holder should state this explicitly in the plan or a short addendum, since it's a genuinely new sub-question this research surfaced, not one CONTEXT.md/UI-SPEC already answered.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm build toolchain | R-3 measurement, all frontend work | Yes | (repo's pinned Vite 8.1.3, confirmed via `npm run build`) | — |
| Playwright/Chromium | R-4 probe, e2e tests | Yes | Playwright 1.61.1 / Chromium 149.0.7827.55 | — |
| slopcheck | Package Legitimacy Gate | Yes (installed this session via `pip install slopcheck`) | not queried | pip-installable, no fallback needed |
| `docker compose up --build` against astridr-repo | R-1/R-2's cross-repo emitter work (execution time, not this research) | Not exercised this session (research-only; no builds/deploys performed per task constraints) | — | — |

**Missing dependencies with no fallback:** none identified for research; execution-time Docker rebuild readiness was not probed (out of scope for a research-only task — no `docker compose` command was run, per this task's explicit constraints).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit/component), Playwright 1.61.1 (e2e) |
| Config file | `vitest.config.ts`, `playwright.config.ts` (repo root, confirmed present) |
| Quick run command | `npx vitest run <specific file>` |
| Full suite command | `npm test` (vitest), `npm run test:e2e` (playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIGNAL-01 | Horizon state machine (5 states incl. fail-closed Unknown) transitions correctly on mount/reconnect/timeout/malformed payload | unit (mocked WS context) | `npx vitest run src/components/<NewHorizon>.test.tsx` | ❌ Wave 0 — component doesn't exist yet |
| SIGNAL-01 | Aurora tokens (`--aurora-a/b/c`) resolve correctly in all 5 themes | unit, following R-4's direct-assignment pattern (no regex-scrape — house lesson) | `npx vitest run src/<aurora-token>.test.ts` | ❌ Wave 0 |
| SIGNAL-02 | `event_type → hue` map matches live `TOPIC_EVENT_MAP`, fails on unrecognized type per D-06 | unit | `npx vitest run src/lib/eventHue.test.ts` (or wherever the module lands) | ❌ Wave 0 |
| SIGNAL-02 | Bounded 60s query returns only in-window `runtime_events` rows, uses `by_timestamp` index | unit (Convex test harness, matching `convex/events.test.ts`'s existing pattern) | `npx vitest run convex/<newQuery>.test.ts` | ❌ Wave 0 |
| SIGNAL-02 | Backfill↔live reconciliation: overlap/during-backfill/reconnect/out-of-order/same-second-burst (UI-SPEC's own required test cases, `125-UI-SPEC.md:240`) | integration/unit with a fake WS + fake Convex response | new test file | ❌ Wave 0 |
| SIGNAL-02 | Entry-chunk byte budget ratchet (D-10) | build-artifact ratchet, same shape as `tokenSweep.ratchet.test.ts` | `npx vitest run src/<entryChunk>.ratchet.test.ts` | ❌ Wave 0 — needs `npm run build` to have run first (skip-with-reason pattern, R-3) |
| SIGNAL-02 | Canvas color resolution does not regress to regex-scraping (house anti-pattern) | unit, asserting the code path calls `fillStyle =` directly on the resolved string, not a parser | new test file | ❌ Wave 0 |
| SIGNAL-03 | Italic subpath (`400-italic.css`) is the one imported, not the bare package | unit — source-shape test in the style of `App.test.tsx`'s DEBT-03 guard (`src/App.test.tsx:229-283`, reads source from disk) | new test file | ❌ Wave 0 |
| SIGNAL-03 | `readable` theme override suppresses the serif (D-15) | unit or visual | new test file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new/changed test file(s) above.
- **Per wave merge:** `npm test` (full Vitest suite).
- **Phase gate:** full Vitest suite green, plus the operator visual checkpoint (D-16) and `125-SERIF-TRIAL.md`'s existence, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Horizon component + its state-machine test file (doesn't exist yet — net-new component)
- [ ] `event_type → hue` map module + its `TOPIC_EVENT_MAP`-parity test
- [ ] New bounded Convex query (`convex/<newQuery>.ts`) + its test, following `convex/events.test.ts`'s existing harness pattern
- [ ] Entry-chunk ratchet test file, following `src/tokenSweep.ratchet.test.ts`'s skip-with-reason shape exactly (R-3)
- [ ] Reconciliation test file covering UI-SPEC's five named test cases (overlap, during-backfill, reconnect, out-of-order, same-second burst) — **must also cover the `run.blocks` double-delivery case found in R-1**, which is not one of UI-SPEC's five named cases
- [ ] Cross-repo: `astridr-repo` tests for the new `estop_state` emission in `estop.py`'s `activate()`/`deactivate()` — this repo's own test conventions (`tests/` mirroring `astridr/`) apply; not scoped further here since it's outside this repo

## Security Domain

`security_enforcement` was not found explicitly set to `false` in `.planning/config.json` (not read in detail this session — flagged as unverified rather than assumed); treating as enabled per the default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Indirectly — E-Stop's HTTP/WS surfaces already have their own auth (admin key, loopback), unchanged by this phase | No new auth surface added; `estop_state` is read-only telemetry, not a new mutation path |
| V4 Access Control | Yes — the new `estop_state` WS push must not leak more than `is_active`/`reason`, and must not become a new unauthenticated write path | `estop.py`'s `activate()`/`deactivate()` already gate on their existing surfaces (admin key etc.); the new telemetry call is read-only broadcast of state already computed by an authorized action, not a new access-control decision point |
| V5 Input Validation | Yes — the horizon's WS message handler must treat a malformed `estop_state` payload as "stay Unknown", never throw inside `AstridrWSContext.tsx`'s fan-out (UI-SPEC's own required test case) | Defensive parsing (try/catch or a runtime shape check) around the new `subscribeEvent("estop_state", ...)` handler |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Fabricated/stale "all clear" state (a UI showing calm aurora while E-Stop is actually armed) | Spoofing/Repudiation of state | Fail-closed state machine (UI-SPEC's own Unknown-state design) — this is a genuine safety-relevant threat model already addressed in the locked design, not new to this research |
| Malformed WS payload crashing the fan-out and taking down the whole telemetry pipeline (this repo's own house lesson: a throwing `useQuery` blanks the whole page) | Denial of Service (client-side) | Defensive parsing per V5 above; this is analogous to, though not identical to, the Convex `useQuery`-throw lesson in `CLAUDE.md` |

---

## Sources

### Primary (HIGH confidence — direct code reads, this session)
- `astridr-repo/astridr/engine/telemetry.py` (full file read) — WS payload construction, timestamp assignment, buffered vs. critical vs. live-only send paths
- `astridr-repo/astridr/engine/ws_telemetry.py` (full file read) — `TOPIC_EVENT_MAP`, `_event_matches_topics`, `commands.catalog` on-connect precedent
- `astridr-repo/astridr/engine/estop.py` (full file read) — `EmergencyStop.activate()`/`.deactivate()`, existing telemetry calls, activation surface enumeration
- `astridr-repo/astridr/channels/web.py:1715-1795` — `_estop_precheck`, all three HTTP routes
- `astridr-repo/astridr/agent/loop.py:600-635,1755-1772` — `_emit_run_event`, the `run.blocks` double-emission
- `astridr-repo/astridr/api/ws_commands.py:1030-1090` — E-Stop WS command handlers
- `astridr-repo/astridr/engine/bootstrap/wiring.py:370-936` — `_setup_ws_telemetry`, `create_ws_router` call site, `estop` parameter threading
- `codepulse/convex/events.ts`, `codepulse/convex/schema.ts`, `codepulse/convex/runtimeIngest.ts:630-687` — schema, indexes, idempotencyKey scope
- `codepulse/src/contexts/AstridrWSContext.tsx` (full file read) — `TOPIC_EVENT_MAP`, `subscribeEvent` vs. `subscribe`, dispatch logic
- `codepulse/src/App.tsx`, `codepulse/src/App.test.tsx:121-283`, `codepulse/src/layouts/DashboardLayout.tsx:835-1001`, `codepulse/src/components/HeroStatsBar.tsx:150-200`, `codepulse/src/hooks/useLiveFlash.ts`, `codepulse/src/lib/metricState.ts`, `codepulse/src/components/EStopButton.tsx`, `codepulse/src/tokenSweep.ratchet.test.ts:300-400`
- Empirical: `npm run build` (twice, `codepulse/`), headless Chromium canvas probe (this session, script preserved in scratchpad), `npm view @fontsource/instrument-serif` + tarball extraction, `slopcheck scan --pkg npm @fontsource/instrument-serif`

### Secondary / Tertiary
None used — every claim in R-1 through R-6 was resolved by a direct primary read or an empirical probe; no WebSearch was needed for the priority research items. One general WebSearch (Chrome canvas fillStyle oklch support) returned nothing conclusive and was superseded by the empirical probe.

## Metadata

**Confidence breakdown:**
- R-1 (event identity/timing): HIGH — every claim is a direct code read of the exact function that builds the payload, cross-checked against the consuming client code
- R-2 (estop_state emitter): HIGH — direct reads of the emitter, the WS router, the wiring call site, and the client dispatch logic
- R-3 (entry-chunk baseline): HIGH — measured twice, deterministic build, byte-exact figures
- R-4 (canvas color): HIGH — empirical probe with pixel-level verification, run in this session
- R-5 (bounded query): HIGH — direct schema/index read
- R-6 (fontsource package): HIGH — registry + tarball content + slopcheck, all verified this session

**Research date:** 2026-08-21
**Valid until:** ~14 days for the astridr-repo/codepulse code-shape findings (active development, multiple phases landing daily per STATE.md); the npm package facts (R-6) are stable for ~30 days; the empirical Chromium behavior (R-4) is stable until a Chromium/Playwright version bump.

---

## Concerns for the Planner (not re-litigating any locked D-01..D-16 decision)

None of the findings above contradict a locked decision — D-01 through D-16 answer *what* this phase does, and every correction in R-1 through R-6 is about *how*, at a level of implementation detail CONTEXT.md/UI-SPEC left open or got slightly wrong in their own draft reasoning (which the planner should treat as a draft to correct, per CLAUDE.md's own house rule). Three items are surfaced here explicitly because they need an affirmative planner decision, not because this research disputes anything already decided:

1. **D-12's numeral will structurally under-represent Ástríðr's own (violet) activity, forever, by design of the existing `send_live()` architecture** (R-1). This isn't a bug to fix in this phase — fixing it would mean changing `send_live()`'s "never touches Convex" contract, which exists for a stated reason (sub-100ms delivery, WS-04). The planner should decide and state explicitly whether the numeral's definition is "events this component can measure" (achievable) or should carry a caveat/asterisk — silently shipping it as an unqualified "PULSE / 60s" count risks reintroducing exactly the kind of not-quite-honest metric D-12 exists to replace (POLISH-04's fabricated composite), just with a subtler failure mode.
2. **`run.blocks` is emitted twice over WS from the same code path in `astridr-repo`** (`loop.py:1761-1772`, confirmed live, R-1) — a pre-existing correctness issue in `astridr-repo`, independent of this phase, that will double-count in whatever numeral this phase ships unless explicitly handled. Worth a standalone `astridr-repo` fix/todo regardless of this phase's outcome, but must be accounted for in this phase's reconciliation test cases either way.
3. **D-10 needs a byte-allowance number, and this research deliberately does not supply one** (R-3) — 583,049 bytes (entry JS) / 237,359 bytes (entry CSS) is the measured baseline, but the allowance (percentage, fixed KB, or "must not grow at all") is a product/scope call for the planner, not something derivable from the measurement itself.
