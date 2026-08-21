# Phase 125: Signature Layers - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 12 (6 net-new, 4 modified in `codepulse/`, 4 modified/net-new in `astridr-repo/`)
**Analogs found:** 12 / 12 (every file has at least a role-match; two net-new files have no exact
precedent and are flagged explicitly rather than forced)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/SignalHorizon.tsx` (net-new) | component (shell chrome, safety-state) | event-driven (WS) | `src/layouts/DashboardLayout.tsx`'s `SystemChip()` (:219-247) | role-match (fail-closed WS-derived state chip); no canvas/gradient precedent exists for the drift/packet visuals |
| `src/components/PulseEcgHero.tsx` (net-new) | component (canvas hero) | event-driven (WS) + one bounded read | `src/components/voice/AvatarAura.tsx` | exact (canvas + rAF + visibility-gate + reduced-motion + theme-token-via-probe, all four load-bearing patterns present) |
| `src/lib/eventHue.ts` (net-new) | utility (derived lookup) | transform | `src/lib/metricState.ts` | role-match (single exported table/vocabulary consumed by ≥2 components, tokens-only, one comment per non-obvious mapping) |
| `convex/runtimeEvents.ts` or similar (net-new query) | service (Convex query) | CRUD (bounded read) | `convex/events.ts`'s `listRecentUnified` (:193-244) | exact (same file, same `runtime_events` table, same `by_timestamp` index — just narrower and single-table) |
| `convex/runtimeEvents.test.ts` (net-new) | test | — | `convex/events.test.ts` (harness) | role-match (fake `db.query().withIndex()` constraint-applying store, `._handler` convention — table is `events`+aggregates there, not a direct precedent for a plain bounded query, but the harness shape is what to reuse) |
| `src/entryChunk.ratchet.test.ts` (net-new) | test (build-artifact ratchet) | batch | `src/tokenSweep.ratchet.test.ts` (:305-341, :390-401) | exact — named directly by CONTEXT.md D-10 |
| `src/pages/Briefings.test.tsx` or `BriefingFeedItem.test.tsx` addition (net-new source-shape test) | test | — | `src/App.test.tsx:229-283` (DEBT-03 guard) | exact — named directly by RESEARCH.md |
| `src/index.css` (modified) | config (design tokens) | — | itself, existing `:theme{}` block (:43-58) and per-theme `--primary`/`--astridr`/`--status-ok` re-declarations | exact (same file, same pattern) |
| `src/components/HeroStatsBar.tsx` (modified) | component (KPI grid) | CRUD (Convex queries) | itself | exact (same file; only the top card and one KPI entry change) |
| `src/contexts/AstridrWSContext.tsx` (modified) | provider/context | event-driven (WS) | itself; `TOPIC_EVENT_MAP` (:58-95) | exact (same file; add `infrastructure`/`security` entries as needed — see Concerns) |
| `src/components/BriefingFeedItem.tsx` (modified) | component (presentational) | — | itself | exact (same file; scope narrows to `:49-50,62`) |
| `astridr-repo/astridr/engine/estop.py` (`activate()`/`deactivate()`, modified) | service (domain method) | event-driven (telemetry emit) | itself — `activate()`'s existing `security_event` send (:150-159) | exact (same method, same file, sibling call to add) |
| `astridr-repo/astridr/engine/ws_telemetry.py` (`create_ws_router`, modified) | route/service (WS router) | pub-sub (on-connect push) | itself — `commands.catalog` push-on-connect block (:178-192) | exact (same function, named precedent) |
| `astridr-repo/astridr/engine/bootstrap/wiring.py` (`_setup_ws_telemetry`, modified) | config (DI wiring) | — | itself (:370-376 signature, :930-933 call site) | exact (already accepts `estop: Any`, just needs threading to `create_ws_router(...)`) |
| `astridr-repo/astridr/agent/loop.py` (`run.blocks` double-emit, modified) | service (agent loop) | event-driven | itself (:1761-1772, :606-624) | exact (fix is local to the two call sites already identified) |

---

## Pattern Assignments

### `src/components/SignalHorizon.tsx` (component, event-driven WS)

**Analog:** `src/layouts/DashboardLayout.tsx`'s `SystemChip()` (:219-247), rendered inline in the
same file at `:916-921` inside its own `SectionErrorBoundary`.

**Why this is the closest match, and why it's imperfect:** `SystemChip` is the only existing
component in this codebase that (a) derives a small safety/status-adjacent visual from a
transport-connectivity flag plus a data subscription, (b) explicitly orders "offline beats every
data-derived state" (exactly D-01/D-02's fail-closed contract), and (c) renders inline in
`DashboardLayout.tsx` at the same structural level the horizon needs (header-adjacent chrome, not
a page component). It has **no** analog for the aurora gradient/packet-travel CSS or the 5-state
machine's *timeout*-driven transition (SystemChip has no freshness-timeout state) — that part of
the horizon is genuinely novel to this codebase and should be built from the UI-SPEC's own CSS
(§"Signal Horizon Contract") and sketch, not forced through an existing pattern.

**Fail-closed resolution order** (`DashboardLayout.tsx:223-246`, copy the *shape*, not the states):
```typescript
function SystemChip() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const counts = useQuery(api.alerts.countBySeverity);

  // Resolution order, exactly (T-124-08-01). Offline wins over every
  // alert-derived state: once the socket is down the alert counts are stale
  // by definition, so reporting "Nominal" from them would be a confident
  // claim about data that is not arriving.
  if (!isWebSocketConnected) {
    return <StatusBadge status="idle" tier="quietest" label="Offline" />;
  }
  if (counts == null) return null; // D-12's undefined-preserving rule
  if (counts.critical > 0 || counts.error > 0) {
    return <StatusBadge status="error" tier="strong" label="Critical" />;
  }
  if (counts.warning > 0) {
    return <StatusBadge status="warn" tier="quiet" label="Attention" />;
  }
  return <StatusBadge status="ok" tier="quiet" label="Nominal" />;
}
```
Map this to the horizon's 5-state priority list (critical > warn > unknown > offline > resting)
from `125-UI-SPEC.md:161-170` — same idiom (an ordered if-chain, first match wins, never a
fallthrough to "calm").

**WS subscription pattern** — `subscribeEvent` idiom (D-02's mechanism), copy from
`src/components/brains/BrainFallbackNotice.tsx:36-53` (the simplest existing consumer — a single
event type, register on mount, cleanup on unmount):
```typescript
const { subscribeEvent } = useAstridrWS();
useEffect(() => {
  const unsubscribe = subscribeEvent("estop_state", (event) => {
    // handle
  });
  return () => unsubscribe();
}, [subscribeEvent]);
```

**Boundary wrapping** — wrap the horizon in `SectionErrorBoundary` exactly as `SystemChip` is
(`DashboardLayout.tsx:916-921`), so a throw inside the horizon's WS handler cannot blank the
whole layout:
```tsx
<SectionErrorBoundary name="System status" fallback={<BadgeUnavailableDot label="System status unavailable" />}>
  <SystemChip />
</SectionErrorBoundary>
```

**Offline/WS-status source:** `AstridrWSContext.tsx:30` — `export type WSStatus = "connected" | "reconnecting" | "disconnected"`, read via `useAstridrWS().status`. This is separate from `useConvexConnectionState()` above (that hook is Convex's own socket, not Ástríðr's) — the horizon must read the **Ástríðr** WS status, not the Convex one.

**Coalescing (D-07):** copy `src/hooks/useLiveFlash.ts` verbatim (11 lines, the whole hook):
```typescript
export function useLiveFlash<T extends HTMLElement = HTMLDivElement>() {
  const flashRef = useRef<T>(null);
  const lastFlashRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback(() => {
    const el = flashRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastFlashRef.current < 1000) return; // debounce: 1s
    lastFlashRef.current = now;
    el.classList.remove("live-update-flash");
    void el.offsetWidth; // Force reflow to restart animation
    el.classList.add("live-update-flash");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      el?.classList.remove("live-update-flash");
    }, 620);
  }, []);

  return { flashRef, triggerFlash };
}
```
The horizon's per-packet coalescing needs the identical `now - last < 1000` drop-gate (per event
type/region), not a rebuild.

---

### `src/components/PulseEcgHero.tsx` (component, canvas hero)

**Analog:** `src/components/voice/AvatarAura.tsx` (full file, 627 lines) — **exact match**, all
four load-bearing patterns the ECG needs are present and already working in this codebase:

**1. Canvas + DPR-aware sizing** (`AvatarAura.tsx:260-283`):
```typescript
useEffect(() => {
  const canvas = canvasRef.current;
  const container = containerRef.current;
  if (!canvas || !container) return;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const { width, height } = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  };
  resize();
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }
  window.addEventListener("resize", resize);
  return () => window.removeEventListener("resize", resize);
}, []);
```

**2. rAF loop gated on `document.hidden` + reduced-motion one-shot** (`AvatarAura.tsx:181-183,
299-301, 480-501, 540-548, 569-578`) — this is the exact shape D-11 specifies:
```typescript
const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// inside the draw-loop effect:
const reduced = prefersReducedMotion();
if (reduced) {
  render(0); // one static frame, no loop
  return () => { /* cleanup */ };
}
const loop = (now: number) => {
  raf = requestAnimationFrame(loop);
  if (now - lastDraw < FRAME_MS) return; // fps throttle, optional for ECG
  lastDraw = now;
  if (typeof document !== "undefined" && document.hidden) return; // pause when hidden
  render(now / 16.67);
};
raf = requestAnimationFrame(loop);
return () => { if (raf) cancelAnimationFrame(raf); };
```
Note: `readable` theme freeze is **not** covered by this pattern alone (UI-SPEC:210 — "the gate
must be explicit JS", not the CSS `animation:none` blanket) — the ECG's rAF gate must also check
`document.documentElement.dataset.theme === "readable"`, which `AvatarAura.tsx` does not need to
because its `readable` freeze isn't specified there; add that check explicitly.

**3. Theme-color-via-probe** (`AvatarAura.tsx:239-257`) — reads a CSS custom property into a ref,
refreshed on theme change via `MutationObserver`:
```typescript
useEffect(() => {
  const readColor = () => {
    const probe = probeRef.current;
    if (!probe) return;
    const m = getComputedStyle(probe).color.match(/(\d+(?:\.\d+)?)/g);
    if (m && m.length >= 3) colorRef.current = [+m[0], +m[1], +m[2]];
  };
  readColor();
  const obs = new MutationObserver(readColor);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  return () => obs.disconnect();
}, []);
```
**Correction per RESEARCH.md R-4:** the ECG does **not** need this rgb-normalization probe trick
— Chromium's `fillStyle` accepts `oklch()`/`oklab()` strings directly (verified via
`getImageData` pixel readback, not just string echo). Read `getComputedStyle(document.documentElement).getPropertyValue('--primary')` (etc.) straight into `ctx.fillStyle`. Do
**not** port `AvatarAura`'s probe-and-regex-match technique — it's solving a problem (rgb
normalization) that R-4 proved doesn't exist for this repo's canvas engine. Do keep
`AvatarAura`'s underlying idea (re-resolve on theme change via `MutationObserver`), just without
the regex.

**4. Instrumented dbg bag pattern (OPTIONAL, not required):** `AvatarAura.tsx:95-157` is a
permanent, ungated `window.__avatarAuraDebug` counter bag for diagnosing "loop stalled vs. mouth
inert vs. draw issued but not landing". Not needed for the ECG's simpler idle/live/unavailable
three states, but flagged in case QA on this component turns out to need the same class of
mount/unmount-imbalance diagnosis this repo has hit before on canvas components.

**Empty-window states** — reuse `MetricCard`'s `state` contract via `src/lib/metricState.ts`
(read in full):
```typescript
export type MetricState = "loading" | "ready" | "empty" | "stale" | "unavailable" | "error";
export const METRIC_STATE_COPY: Record<MetricState, MetricStateEntry> = {
  // ...
  empty: { label: "no signal yet", icon: CircleSlash, tone: "var(--muted-foreground)" },
  unavailable: { label: "nothing is emitting this metric", icon: Ban, tone: "var(--muted-foreground)" },
  // ...
};
```
D-08's split (feed-down → `unavailable`-shaped dotted+italic "no signal yet"; feed-healthy-zero-events → `empty`-shaped breathing baseline no text) maps directly onto this existing two-state
pair — do not invent new copy or a new state name, reuse these two entries' tone/label.

**KPI-grid relocation target** (D-09's memory hit-rate tile) — `HeroStatsBar.tsx:203-230`'s
existing `MetricCard` mapping is the exact template for the new 9th tile:
```tsx
<MetricCard
  key={kpi.label}
  label={kpi.label}
  value={kpi.value}
  numericValue={kpi.numericValue}
  threshold={kpi.threshold}
  format={kpi.format}
  onClick={kpi.onClick}
  trend={...}
  state={kpi.state}
/>
```
The memory-hit-rate `KpiDef` entry already exists verbatim at `HeroStatsBar.tsx:122-130` — moving
it into the grid's `.slice()` ranges (currently `slice(0,4)` / `slice(4,8)`) is the only change
needed there; do not rewrite the `MetricCard` props shape.

---

### `src/lib/eventHue.ts` (utility, derived lookup)

**Analog:** `src/lib/metricState.ts` (full file, 123 lines) — single exported `Record<K, V>` table
with per-key rationale comments, no class, no state, pure data + one lookup function.

**Pattern to copy** (module doc-comment style, table shape, exhaustiveness discipline):
```typescript
/**
 * eventHue.ts — the shared event_type → hue vocabulary for the Signal
 * Horizon and Pulse ECG (D-06, Phase 125). One module defines what color an
 * Ástríðr event paints so both surfaces render the SAME event identically.
 */
export type EventHue = "astridr" | "machine" | "error";

// D-06: unrecognized type -> "machine" (never "astridr" — mis-attributing an
// event to Ástríðr is the worse error). Unit-test against the live
// TOPIC_EVENT_MAP (AstridrWSContext.tsx:58-95) so a new server event type
// cannot silently go uncoloured.
export function eventTypeToHue(eventType: string): EventHue {
  // ...
}
```
Unit-test shape: import `TOPIC_EVENT_MAP` from `AstridrWSContext.tsx` (it's a module-level
`const`, not exported today — **note for the planner**: exporting it, or duplicating it as a
fixture, is a small decision the plan must make explicitly) and assert every listed event type
resolves to a hue, none throw.

**Consumption sites:** both `SignalHorizon.tsx` (packet `--pk` color) and `PulseEcgHero.tsx` (blip
color) import this one module — same "single source, two consumers" shape `metricState.ts` has
with `MetricCard.tsx` and (per its own doc-comment) `EmptyState`.

---

### `convex/runtimeEvents.ts` (net-new bounded query, service/CRUD)

**Analog:** `convex/events.ts`'s `listRecentUnified` (:193-244) — same file, same `runtime_events`
table, same `by_timestamp` index; the new query is a narrower, single-table variant.

**Pattern to copy (range-bound `.withIndex` AND a hard row cap AND a narrow projection):**
```typescript
const WINDOW_SEC = 60;   // D-17 / sketch-locked; 5min was tried and made the trace look empty
const MAX_ROWS = 500;    // hard cap; a 60s trace cannot legibly draw more

export const listRecentRuntimeWindow = query({
  args: {},              // NO client-supplied window — see the correction note below
  handler: async (ctx) => {
    const nowSec = Date.now() / 1000; // seconds, fractional (RESEARCH R-1)
    const lo = nowSec - WINDOW_SEC;
    const rows = await ctx.db
      .query("runtime_events")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", lo).lte("timestamp", nowSec))
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(MAX_ROWS);
    // Project: the ECG needs hue (from eventType) and x-position (from timestamp).
    // It never reads `data`, which is an arbitrary and potentially large payload.
    return {
      rows: rows.map((r) => ({ _id: r._id, eventType: r.eventType, timestamp: r.timestamp })),
      truncated: rows.length === MAX_ROWS,
    };
  },
});
```

> **CORRECTION (2026-08-21) — the first draft of this block was unsafe and was rewritten.**
> It took `windowSeconds: v.optional(v.float64())` from the caller, used it unclamped as
> `lo = nowSec - windowSec`, and ended in `.collect()`, while its own trailing comment claimed
> it was "bounded by the 60s window itself". Three verified reasons that was wrong:
> 1. **Public Convex queries are client-callable with no credential** on this deployment —
>    `CLAUDE.md` records this as measured 2026-08-11, with a control (a bogus function name
>    returns `Could not find public function`, so the probe discriminated). So `windowSeconds`
>    is attacker-controlled, not app-controlled.
> 2. **An unbounded scan of this exact table is a repeat incident, not a hypothetical.**
>    `convex/events.ts:200-203` says so in a comment on the analog query: *"an unbounded desc
>    scan streams from the very top of the index and dies under memory pressure or index
>    garbage (2026-07-22 incident; same fix as heroStats 2026-07-20)."* `convex/retention.ts:40`
>    records the state that caused it as *"~896k runtime_events"*, and `:43` keeps 14 days of
>    them — so a large `windowSeconds` reaches ~896k rows, each with its full `data` payload.
> 3. **It was strictly weaker than the analog it claimed to copy.** `listRecentUnified` pairs
>    its 48h range bound with a hard `.take(fetchCount)` (`events.ts:213`). The draft dropped
>    that cap and explicitly argued against it. A time bound alone does not survive an event
>    storm; the two bounds are complementary, not alternatives.
>
> Also note the house read budget: a Convex query dies at **4,096 reads**, not the 16,000
> figure the docs suggest (memory `convex-mutation-read-limit-4096`). `.collect()` over a
> firehose table has no defence against that; `.take(500)` does.
>
> `truncated` is returned rather than swallowed, per the house "no silent caps" rule — if the
> cap ever binds, the consumer can say so instead of drawing a quietly incomplete trace.
**Do not reuse `listRecentUnified` at a smaller limit** — it merges two tables (`events` +
`runtime_events`), which pulls in build-time hook telemetry unrelated to Ástríðr runtime activity
(RESEARCH.md R-5). Write a dedicated function in the same file, next to it.

**Projection:** per R-5, select only `_id` (if path (a) is chosen for D-12's numeral),
`eventType`, `timestamp` — explicitly skip `data` (it's `v.any()` and can carry arbitrary
payload bytes; the hue map only needs `eventType`).

---

### `convex/runtimeEvents.test.ts` (test)

**Analog:** `convex/events.test.ts` (harness shape, :24-60+) — the fake `db.query().withIndex()`
constraint-applying store, following the repo's `._handler` convention to call the *actually
registered* mutation/query rather than re-implementing it in the test.

**Caveat:** `events.test.ts`'s existing tests cover `ingest`/`listRecent` (mutation + a different
query), not a plain range-bound query — no test in this file exercises `listRecentUnified` or any
`.withIndex(...).order("desc").take()` shape directly. Treat this file as the **harness pattern**
to reuse (the `withIndex` fake that honors `eq`/`gte`/`lte` constraints, :47-60), not as a
line-for-line template for the new query's own assertions. Also check
`src/components/graph/ForceGraphCanvas.test.tsx`'s `vi.hoisted`/`vi.mock` idiom only if the new
test needs to mock `convex/react`'s `useQuery` client-side rather than test the Convex function
directly — the house convention (per `CLAUDE.md`'s Testing section) is to test Convex functions
via their own harness, not by mocking `useQuery`.

---

### `src/entryChunk.ratchet.test.ts` (build-artifact ratchet test)

**Analog:** `src/tokenSweep.ratchet.test.ts:305-341,390-401` — **exact**, named directly by
CONTEXT.md D-10 and RESEARCH.md R-3.

**Pattern to copy verbatim (the `dist/`-absent skip-with-reason guard):**
```typescript
function findDistCssFiles(): string[] {
  const distAssets = join(REPO_ROOT, "dist", "assets");
  if (!existsSync(distAssets)) return [];
  return readdirSync(distAssets)
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(distAssets, f));
}
// ... resolve to a null sentinel when absent:
const DIST_CSS = readCombinedDistCss(); // null if dist/assets missing
const DIST_CSS_SKIP_REASON =
  "no dist/assets/*.css found -- run `npm run build` to produce one before trusting this " +
  "bucket's positive half. A skip that says why beats a pass that measured nothing.";

describe("D-25 bucket: motion tokens (duration)", () => {
  it.skipIf(DIST_CSS === null)(
    "the built stylesheet contains all three .duration-* utility rules (positive half)",
    () => {
      if (DIST_CSS === null) return; // narrowing for TS; skipIf already prevents this branch
      expect(hasAllThreeDurationRules(DIST_CSS)).toBe(true);
    }
  );
  if (DIST_CSS === null) {
    console.warn(`[D-25 duration positive check] SKIPPED: ${DIST_CSS_SKIP_REASON}`);
  }
});
```
**For D-10 specifically:** resolve "the entry file" the way RESEARCH.md R-3 did — read
`dist/index.html`'s `<script type="module" src="...">` — rather than hardcoding the
`index-*.js` naming convention (a Vite build-hash default, not a contract). Baseline to record
literally in the ratchet: entry JS `583,049` bytes, entry CSS `237,359` bytes (measured 2026-08-21,
`583,049 * 1.02 ≈ 594,710` / `237,359 * 1.02 ≈ 242,106` per D-18's +2% allowance).

---

### Source-shape test for `@fontsource/instrument-serif/400-italic.css` (net-new)

**Analog:** `src/App.test.tsx:229-283`, the `describe('App source shape (DEBT-03 regression guard)')` block — **exact**, named directly by RESEARCH.md.

**Pattern to copy (read source from disk, not via import, so a module-resolution shortcut can't
hide a wrong import):**
```typescript
describe('Briefings source shape (SIGNAL-03 italic-subpath guard)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/components/BriefingFeedItem.tsx'), // or Briefings.tsx, wherever the import lands
    'utf8',
  );

  it('imports the italic subpath, not the bare package root', () => {
    expect(source).toContain('@fontsource/instrument-serif/400-italic.css');
    expect(source).not.toMatch(/import ["']@fontsource\/instrument-serif["'];?\s*$/m);
  });
});
```
This directly encodes RESEARCH.md R-6's "critical, load-bearing correction": the bare package
import ships normal-style only, and the italic design is what D-15's typography contract needs.

---

## Shared Patterns

### Fail-closed WS-derived state (Signal Horizon)
**Source:** `src/layouts/DashboardLayout.tsx:219-247` (`SystemChip`'s resolution order) — also see
`src/components/ConnectionPopover.tsx:54-67` for a second WS-status-consuming component (uptime,
last-event, latency tracking via `useAstridrWS().status`, `subscribeEvent`, `reconnect`).
**Apply to:** `SignalHorizon.tsx`'s 5-state machine — "offline/unknown beats every data-derived
state" is the same discipline, extended with a freshness-timeout SystemChip does not have.

### WS event subscription idiom
**Source:** `src/components/brains/BrainFallbackNotice.tsx:36-53` (simplest single-event-type
consumer); `src/hooks/useCommandCatalog.ts:57-96` (consuming an on-connect push event, the closest
CLIENT-side precedent for consuming `estop_state`'s on-connect snapshot, since `commands.catalog`
is server-side's push-on-connect precedent D-02 already cites).
**Apply to:** `SignalHorizon.tsx` (subscribe `estop_state`), `PulseEcgHero.tsx` (subscribe every
hue-mapped event type via `eventHue.ts`).

### Coalescing / flash-debounce
**Source:** `src/hooks/useLiveFlash.ts:13-34` (whole file, 11 lines of logic).
**Apply to:** Signal Horizon packet coalescing (D-07) — reuse exactly, do not invent a second 1s
drop-gate.

### Canvas + rAF + visibility/reduced-motion gate
**Source:** `src/components/voice/AvatarAura.tsx:181-183,260-397,480-578` (resize effect, reduced-
motion check, gated draw loop, cleanup).
**Apply to:** `PulseEcgHero.tsx` — this is the only canvas+rAF component in the repo and it already
solves DPR sizing, hidden-tab pause, and reduced-motion one-shot correctly and with prior
CPU-drift-history awareness (the exact concern D-11's own rationale cites).

### Six-state metric vocabulary (loading/ready/empty/stale/unavailable/error)
**Source:** `src/lib/metricState.ts` (whole file) + `src/components/MetricCard.tsx:130-296`
(consumption).
**Apply to:** `PulseEcgHero.tsx`'s empty-window states (D-08) — map "feed down" → `unavailable`,
"feed healthy/zero events" → `empty`, reusing `METRIC_STATE_COPY`'s existing label/icon/tone
rather than authoring new copy.

### Convex bounded range query on an existing index
**Source:** `convex/events.ts:193-244` (`listRecentUnified`, esp. the `.withIndex("by_timestamp", (q) => q.gte(...).lte(...))` shape at :210,:217) and its house-lesson comment about the
2026-07-22 unbounded-scan incident (:200-203).
**Apply to:** `convex/runtimeEvents.ts`'s new 60s-window query.

### Ratchet-with-skip-reason for build artifacts
**Source:** `src/tokenSweep.ratchet.test.ts:305-341,390-401`.
**Apply to:** `src/entryChunk.ratchet.test.ts` (D-10).

### Source-shape (read-from-disk) regression guard
**Source:** `src/App.test.tsx:229-283`.
**Apply to:** the italic-subpath import guard (SIGNAL-03) and, if the planner wants one, a guard
that `SignalHorizon.tsx`'s import lives in `DashboardLayout.tsx` (static, entry-chunk) while
`PulseEcgHero.tsx`'s lives inside the lazy `Dashboard` page — encoding F-3's inversion finding as
a test rather than only a comment.

### Cross-repo: telemetry emission from a domain method
**Source:** `astridr-repo/astridr/engine/estop.py:150-159` — `activate()`'s existing
`security_event` send, the exact idiom the new `estop_state` send must follow (verbatim, per the
task's own instruction):
```python
if self._telemetry and hasattr(self._telemetry, "send"):
    await self._telemetry.send(
        "security_event",
        {
            "layer": "estop",
            "severity": "critical",
            "action": "activated",
            "details": {"reason": reason, "initiator": initiator},
        },
    )
```
**Apply to:** a new, additional call in `activate()` (after the existing one, not replacing it) —
`await self._telemetry.send("estop_state", {"armed": True, "reason": reason, "initiator": initiator})`
— and a brand-new call in `deactivate()` (:161-198, which currently has **zero** telemetry calls)
— `await self._telemetry.send("estop_state", {"armed": False, "initiator": initiator})`.

### Cross-repo: on-connect push
**Source:** `astridr-repo/astridr/engine/ws_telemetry.py:178-192` (`commands.catalog` push,
gated on `command_registry is not None`, placed after `register_ws()`/`websocket.accept()` and
before `push_loop()` starts):
```python
if command_registry is not None:
    try:
        catalog = command_registry.to_catalog()
        async with send_lock:
            await websocket.send_json({
                "event_type": "commands.catalog",
                "data": catalog,
            })
        logger.debug("ws_telemetry.catalog_pushed")
    except Exception as exc:
        logger.warning("ws_telemetry.catalog_push_failed", error=str(exc))
```
**Apply to:** add an `estop: Any | None = None` parameter to `create_ws_router()` (:89-95) and a
matching direct-send block reading `estop.is_active`/`estop.reason` (`estop.py:86-92`'s existing
properties), in the identical position (after `register_ws`, before `push_loop`).

### Cross-repo: DI wiring for a new router parameter
**Source:** `astridr-repo/astridr/engine/bootstrap/wiring.py:370-376` (`_setup_ws_telemetry`'s
signature already accepts `estop: Any` as a parameter) and `:930-933` (the `create_ws_router(...)`
call site that must now also pass `estop=estop`):
```python
ws_router = create_ws_router(
    telemetry=telemetry, api_key=ws_api_key, command_dispatcher=command_dispatcher,
    admin_key=ws_admin_key or None, command_registry=_command_registry,
    # ADD: estop=estop,
)
```
No new plumbing needed to get the `estop` instance into scope — it's already a parameter of the
enclosing function.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Signal Horizon's aurora-drift/packet-travel CSS (the `linear-gradient`/`@keyframes aurora-drift`/`@keyframes travel` block itself) | component (visual/CSS) | — | No existing component in this codebase animates a gradient-position drift or spawns/animates traveling absolutely-positioned "packet" elements along a line. `AvatarAura.tsx`'s canvas rings/motes are the closest *conceptual* cousin (additive glow, seeded particle-like motion) but are canvas-drawn, not CSS-keyframe-drawn, so they are not a usable code template for this specific CSS. Build directly from `125-UI-SPEC.md:136-156`'s fixed CSS (it is already exact, sketch-validated) rather than forcing an existing-component analog. |
| `astridr/agent/loop.py`'s `run.blocks` double-emit fix (D-19) | service (bug fix, not a new pattern) | event-driven | Not a "copy this pattern" item — it's a deletion/consolidation of one of the two existing sends at `:1761-1772`, guided by the session-id override at `:606-624`. No analog needed; the fix target is fully specified by RESEARCH.md R-1's own two code excerpts (already reproduced above under `<known_work_surface>` context and the wiring/estop sections). |

## Metadata

**Analog search scope:** `src/components/`, `src/hooks/`, `src/lib/`, `src/contexts/`,
`src/layouts/`, `convex/`, `astridr-repo/astridr/engine/`, `astridr-repo/astridr/agent/`,
`astridr-repo/astridr/engine/bootstrap/` — plus targeted greps for `subscribeEvent`,
`requestAnimationFrame`, `getContext("2d")`/`<canvas` across `src/`.
**Files scanned (read in full or targeted range):** `DashboardLayout.tsx` (chip + header
integration point), `HeroStatsBar.tsx` (whole file), `MetricCard.tsx` (whole file),
`metricState.ts` (whole file), `useLiveFlash.ts` (whole file), `BriefingFeedItem.tsx` (whole
file), `AvatarAura.tsx` (whole file), `ConnectionPopover.tsx` (header), `AstridrWSContext.tsx`
(header + `TOPIC_EVENT_MAP`), `convex/events.ts` (:185-260), `convex/events.test.ts` (header +
harness), `src/tokenSweep.ratchet.test.ts` (:290-409), `src/App.test.tsx` (:220-283),
`src/index.css` (:38-68), `estop.py` (:95-199), `ws_telemetry.py` (:1-200), `wiring.py`
(:368-383, :910-937), `loop.py` (:598-632, :1755-1774).
**Pattern extraction date:** 2026-08-21
