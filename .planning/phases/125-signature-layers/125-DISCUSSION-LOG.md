# Phase 125: Signature Layers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 125-Signature Layers
**Areas discussed:** E-Stop truth + aurora tokens, Event feed & blip identity, Hero replacement scope, Serif trial & its verdict

---

## E-Stop truth + aurora tokens

### Q1 — Where should "armed" come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Ástríðr emits estop state | Add an `estop_state` event to Ástríðr's WS telemetry + `TOPIC_EVENT_MAP`, so every tab and page sees arm/disarm regardless of trigger. True source; cross-repo cost. | ✓ |
| Client latch, scope declared | Shell context latches armed on the WS ack. Zero backend work, blind to arms from elsewhere, resets on reload. | |
| Route it through Convex | Ástríðr POSTs state to `/runtime-ingest`; shell reads reactively. Survives reload; adds an operator Convex deploy. | |
| Narrow criterion 1 | Horizon carries only observable states; the E-Stop clause struck, as SHELL-01's 48px figure was in 124. | |

**User's choice:** Ástríðr emits estop state
**Notes:** Chosen over the zero-cost client latch despite this milestone never having done a cross-repo change. Preceded by the F-1 measurement — `GET /api/estop/status` exists but `_estop_precheck` rejects any non-loopback caller *and* demands the admin key, so no browser-reachable read path exists today.

### Q2 — How does a page loaded/reconnected AFTER the arm learn it is armed?

| Option | Description | Selected |
|--------|-------------|----------|
| Push current state on connect | Emit at subscribe time and on every transition; `commands.catalog` is the existing push-on-connect precedent in the same file. | ✓ |
| Client asks on connect | A service-key-readable `estop.status` WS command called once per connect. Second code path; horizon waits on a request. | |
| Convex holds last-known | Transitions written through `/runtime-ingest`. Survives a CodePulse reload with no WS — but a stale `armed` row outlives an Ástríðr restart. | |
| Transitions only | A fresh tab starts calm until the next transition. Cheapest; makes "every page" true only for pages already open. | |

**User's choice:** Push current state on connect
**Notes:** The in-memory-state finding (`estop.py:60-63`) is what made this a real question rather than an implementation detail.

### Q3 — How should the aurora tokens land across themes?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from the 3 hue owners | `--aurora-a/b/c` resolve from `--primary`, `--astridr`, `--status-ok` once in `:root`. Every theme correct for free; the horizon renders the colour law. | ✓ |
| Per-theme triads | One explicit triad in each of the 5 `[data-theme]` blocks, cyan verbatim from the sketch. Matches 122's D-03 — invents four undesigned colour sets. | |
| One fixed triad app-wide | The sketch's teal/indigo/green everywhere. Guaranteed to match the mockup; puts non-theme hues on every screen. | |

**User's choice:** Derive from the 3 hue owners (recommended)
**Notes:** Grounded on the sketch's own triad mapping almost exactly onto the three hue owners — teal ≈ primary, indigo ≈ astridr, green ≈ status-ok.

### Q4 — Horizon under `prefers-reduced-motion` and `readable`?

| Option | Description | Selected |
|--------|-------------|----------|
| Static aurora, state colours live | Frozen gradient, no packets; warn/crimson/offline all still apply. `readable` freezes for free via the existing blanket `animation: none`. | ✓ |
| Plain hairline, state colours live | Flat 2px line that still turns amber and crimson. Essentially variant A's horizon, applied to the accessibility path. | |
| Hidden entirely | No horizon at all. Simplest — deletes the E-Stop crimson from the users least able to catch a subtle cue. | |

**User's choice:** Static aurora, state colours live (recommended)
**Notes:** The deciding argument was that crimson-when-armed is a safety signal, not decoration.

---

## Event feed & blip identity

### Q1 — What feeds the horizon packets and the ECG blips?

| Option | Description | Selected |
|--------|-------------|----------|
| Split: WS for shell, Convex for hero | Horizon on WS only (zero every-route Convex reads, dashed-offline is a designed state); hero takes one bounded read for the trailing 60s, then rides WS. | ✓ |
| WS only, both surfaces | Structurally immune to WR-01; hero starts blank on every Dashboard load. | |
| Convex only, both surfaces | One reactive source with free history; a ≥200-doc read on every route, and arrivals must be diffed out of snapshots. | |
| Both, everywhere | Most robust to either source failing; two clocks, two identity schemes, and a dedupe rule that double-renders if wrong. | |

**User's choice:** Split: WS for shell, Convex for hero (recommended)
**Notes:** Framed against WR-01 — Phase 124 put an unbounded `collect()` on an every-route subscription and it is still open in Phase 126.

### Q2 — How is an event classified machine / Ástríðr / error?

| Option | Description | Selected |
|--------|-------------|----------|
| One derived map, fails to machine | A single exported `event_type → hue` table both surfaces import, unit-tested against the live `TOPIC_EVENT_MAP`; unknown types render as machine rather than being dropped or guessed. | ✓ |
| Ástríðr tags the origin | An explicit `origin` field on telemetry frames, same cross-repo trip as `estop_state`. Authoritative; must reach every emit site, and a miss is silent. | |
| Reuse the existing topics | agents + live-runs → violet, executions + health + infrastructure → cyan, security → red. No new mapping; coarser, and multi-topic events have no single answer. | |

**User's choice:** One derived map, fails to machine (recommended)
**Notes:** The fail-to-machine direction was argued explicitly — mis-attributing an event to Ástríðr is worse than under-attributing it.

### Q3 — How is the ≤1 animation/region/second budget honoured on burst?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop, like useLiveFlash | At most one packet per second; extras discarded. Identical rule to the existing house debounce at `useLiveFlash.ts:22-24`. | ✓ |
| Coalesce into one packet | Burst merges into one packet whose width/brightness encodes count. Invents an unvalidated visual quantity. | |
| Queue and drain at 1/s | Nothing lost; under sustained load the horizon shows events from minutes ago. | |

**User's choice:** Drop, like useLiveFlash (recommended)
**Notes:** Rationale recorded: the horizon is ambient texture, not an audit log.

### Q4 — What does the ECG render when the 60s window is empty?

| Option | Description | Selected |
|--------|-------------|----------|
| Split unavailable from idle | Feed down → dotted baseline + "no signal yet"; feed healthy but quiet → the sketch's breathing baseline. Mirrors `MetricCard`'s existing unavailable-vs-zero split. | ✓ |
| Breathing baseline always | Always looks alive — which makes a dead feed and a calm system visually identical. | |
| Honest null always | Never overclaims — labels a healthy idle system as having no signal. | |

**User's choice:** Split unavailable from idle (recommended)

---

## Hero replacement scope

### Q1 — What exactly does the ECG hero replace?

| Option | Description | Selected |
|--------|-------------|----------|
| Whole card; dot dies as duplicate, memory moves | ECG becomes the hero; the health dot is deleted as a true duplicate of the horizon + system chip; memory hit-rate becomes a KPI tile per D-08. | ✓ |
| Swap the bar only | Canvas replaces numeral + gradient bar in place; card, dot and memory readout stay. Smallest diff; keeps the duplicated dot. | |
| Whole card; both dot and memory move | Nothing real deleted at all; a redundant health tile under a header already saying the same word. | |

**User's choice:** Whole card; dot dies as duplicate, memory moves (recommended)
**Notes:** Preceded by the correction that 124's deferred SYS/LAT item is already closed (`DashboardLayout.tsx:953-984`), so it was not on the table.

### Q2 — What should "the entry-chunk budget holds" mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Measure a baseline, then ratchet | Record the real entry-chunk size before any 125 code lands, assert against it after, with a stated allowance. Same shape as `tokenSweep.ratchet.test.ts`. | ✓ |
| Structural rule only | Assert no new dependency and correct chunk placement; no byte gate, criterion stays prose. | |
| Ratchet the horizon only | Budget the entry chunk, leave the lazy Dashboard chunk unmeasured. A Recharts-sized mistake in the hero would pass unnoticed. | |

**User's choice:** Measure a baseline, then ratchet (recommended)
**Notes:** Question was framed on two measurements: no byte budget exists anywhere in the repo, and the entry-chunk risk is the horizon (static `DashboardLayout` import) rather than the hero (lazy `Dashboard`).

### Q3 — How does the ECG canvas drive its render loop?

| Option | Description | Selected |
|--------|-------------|----------|
| rAF, gated on visibility and motion | Loop while visible; stop on `document.hidden`; one static frame under reduced-motion/readable. | ✓ |
| Continuous rAF always | One loop, no conditionals — runs forever including in throttled background tabs. | |
| Event-driven redraw | Near-zero idle cost; drops the breathing baseline that makes an idle trace read as alive. | |

**User's choice:** rAF, gated on visibility and motion (recommended)
**Notes:** Question cited this repo's prior CPU-drift history on long-lived sessions.

### Q4 — Does the hero keep a numeral?

| Option | Description | Selected |
|--------|-------------|----------|
| Eyebrow + live event rate | `PULSE / 60s` eyebrow plus a 40px thin tabular numeral counting events in the window — a figure the trace already contains. | ✓ |
| Trace only | Pure canvas as the sketch renders it; the Dashboard's numbers all live in the KPI grid below. | |
| Eyebrow + a different figure | Keep a numeral, pick the quantity at plan time from a written shortlist. | |

**User's choice:** Eyebrow + live event rate
**Notes:** The point being that the replacement figure is *measured*, unlike the `100 - errorRate*2` it displaces.

---

## Serif trial & its verdict

### Q1 — Which single surface gets the serif?

| Option | Description | Selected |
|--------|-------------|----------|
| Briefings | Her authored prose, long enough to judge a reading face, isolated behind `BriefingFeedItem`. Named first by the requirement and by sketch §3. | ✓ |
| InsightsChat | Also prose — but it is CodePulse's own LLM answering, not Ástríðr, and it renders through the shared `ChatBubble` that Agent Chat also uses. | |

**User's choice:** Briefings (recommended)
**Notes:** Only two options were offered, because the requirement itself names exactly two candidates. The speaker-identity argument came from `InsightsChat.tsx:1-8`'s own header text.

### Q2 — Which serif, and how does it load?

| Option | Description | Selected |
|--------|-------------|----------|
| Instrument Serif, scoped to the chunk | Self-hosted via `@fontsource`, imported inside the Briefings module; nobody else downloads it. Trials the face that would actually ship. | ✓ |
| Instrument Serif on the global link | Add the family to `index.html:16`. One line — a webfont request on every page load to serve one route. | |
| Georgia only | Zero bytes; the sketch's own fallback. Measures a face an app-wide commit would never ship. | |

**User's choice:** Instrument Serif, scoped to the chunk (recommended)

### Q3 — Does the serif apply in every theme, including `readable`?

| Option | Description | Selected |
|--------|-------------|----------|
| All themes except readable | `readable` keeps Geist for body prose, matching its no-effects guarantee; the other four still run the trial. | ✓ |
| All five themes | One rule, no exceptions — changes the reading face in the theme whose purpose is legibility. | |
| Cyan only | Narrowest blast radius — switching theme would silently change who is speaking. | |

**User's choice:** All themes except readable (recommended)

### Q4 — What form does the recorded evaluation take?

| Option | Description | Selected |
|--------|-------------|----------|
| Operator checkpoint + verdict file | Blocking visual checkpoint on `/briefings`, then `125-SERIF-TRIAL.md` recording a dated adopt/reject/revisit call. Same shape as 123's D-18. | ✓ |
| Blind A/B, then verdict file | Neutral filenames, randomised order, embargoed mapping. Guards against novelty bias; hard to keep clean with one observer who knows what changed. | |
| Checkpoint plus a legibility measurement | Adds measured size/contrast vs Geist body prose. More evidence — more machinery than the question needs. | |

**User's choice:** Operator checkpoint + verdict file (recommended)

---

## Claude's Discretion

None. Every question was answered explicitly; no "you decide" option was taken, and no
question was answered with free text.

## Deferred Ideas

- The sketch's 6-column instrument cluster — real design law, not named by SIGNAL-01/02/03.
- The truth sentence (sketch §10) — no v15.0 requirement carries it; pairs naturally with D-01's `estop_state`.
- The `--density` token (sketch §11) — validated in the sketch, unassigned in this milestone.
- App-wide serif adoption — explicitly out of scope (`REQUIREMENTS.md:97`); D-16 gates even proposing it.
- A per-event `origin` field on Ástríðr telemetry — D-06's rejected alternative, worth revisiting if a future phase already touches every emit site.
