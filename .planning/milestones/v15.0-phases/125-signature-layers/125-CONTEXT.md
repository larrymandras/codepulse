# Phase 125: Signature Layers - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The two moments that make Borealis feel like itself go live on top of the finished token
(122) and shell (124) layers, and Ástríðr's serif voice is trialled on exactly one real
surface:

1. **SIGNAL-01** — the aurora Signal Horizon: a 2px line under the shell header carrying
   event packets, crimson when E-Stop arms, dawn-easing back through amber on disarm.
2. **SIGNAL-02** — the Pulse ECG canvas hero replacing the Dashboard's synthetic
   "SYSTEM LOAD" bar, driven by real events over a 60s window.
3. **SIGNAL-03** — Instrument Serif on Briefings only, with a recorded verdict before any
   app-wide font commit is proposed.

**Not this phase:** the sketch's 6-column instrument cluster, the truth sentence, the
`--density` token, app-wide serif adoption, and every item in Phase 126's defect sweep.

**Four measurements taken during this discussion change what this phase can honestly
promise. Read `<code_context>` §"Findings that bind this phase" before planning — two of
the three ROADMAP success criteria rest on mechanisms that do not exist yet.**

</domain>

<decisions>
## Implementation Decisions

### Signal Horizon — truth source and tokens (SIGNAL-01)

- **D-01: Ástríðr becomes the source of truth for E-Stop armed state, via a new
  `estop_state` telemetry event.** CodePulse cannot observe E-Stop today at all (see
  finding F-1). Rejected alternatives, each considered against the no-fabricated-data law:
  a client-side latch on the WS ack (correct only for the tab that armed it, blind to
  Telegram `/estop`, in-process activation and other tabs, and resets on reload); routing
  state through `/runtime-ingest` into Convex (true source, but a stale `armed` row
  survives an Ástríðr restart that actually cleared the halt, unless the boot path writes a
  disarm); and striking the E-Stop clause from criterion 1 the way SHELL-01's 48px figure
  was amended in 124.
  **This is cross-repo work in `astridr-repo`.** See `<specifics>` for the sequencing
  constraint it creates.

- **D-02: The state is pushed to each client on connect AND on every transition.**
  Push-only deltas would leave a tab opened after the arm — or after a reconnect — painting
  a calm horizon while everything is halted, which is the fabricated-state failure in the
  other direction. The precedent lives in the same file: `commands.catalog` is documented
  as a "CommandRegistry catalog push on connect" (`astridr/engine/ws_telemetry.py:64`). One
  mechanism then covers fresh load, reconnect and transition, with nothing to reconcile.
  Rejected: a separate `estop.status` WS command the shell calls per connect (second code
  path, and the horizon has to wait on a request before it can honestly paint).

- **D-03: `--aurora-a/b/c` derive from the three hue owners, declared once in `:root`.**
  They resolve from `--primary`, `--astridr` and `--status-ok`, so every theme — including
  the light monochrome Paperclip `:root` — gets a correct aurora with no new palette to keep
  in sync, and the horizon literally renders the colour law rather than a fourth palette
  that can drift from it. The sketch's own triad already maps onto that: `--aurora-a
  #14b8a6` (teal ≈ primary), `--aurora-b #6366f1` (indigo ≈ astridr), `--aurora-c #22c55e`
  (green ≈ status-ok) at
  `.claude/skills/sketch-findings-codepulse/sources/themes/default.css:32-34`.
  Rejected: five hand-picked per-theme triads (matches 122's D-03 precedent but invents four
  colour sets nobody has designed); one fixed triad app-wide (puts non-theme hues on every
  screen, which is what aubergine and emerald exist to avoid).

- **D-04: Under `prefers-reduced-motion` and in `readable`, the aurora is STATIC and the
  state colours stay live.** Gradient paints frozen, no drift, no event packets — but warn
  amber, crimson-armed and dashed-offline all still apply instantly. The crimson-when-armed
  signal is functional, not decorative, so hiding the horizon would delete a safety cue from
  exactly the users least able to catch a subtle one elsewhere. `readable` gets the freeze
  for free: `src/index.css:777-780` already carries
  `[data-theme="readable"] *, ::before, ::after { animation: none !important }`.
  Rejected: a plain hairline under those conditions (essentially variant A's horizon, which
  lost the sketch verdict); hiding it entirely.

### Event feed and blip identity (SIGNAL-01, SIGNAL-02)

- **D-05: Split feed — WS drives the shell horizon, one bounded Convex read backfills the
  hero.** The horizon runs on every route, so it subscribes to the Ástríðr WS stream only:
  zero Convex reads added app-wide, arrivals are already per-event, and a dropped socket
  lands in the designed dashed-offline state (sketch §4). The ECG lives on one lazy route,
  so it may take **one** bounded read to draw the trailing 60s on mount, then rides the same
  WS stream live. This is a deliberate avoidance of WR-01's shape — Phase 124 put an
  unbounded `collect()` on an every-route subscription and it is still open in Phase 126.
  Rejected: WS-only on both (hero starts blank on every Dashboard load); Convex-only on both
  (a ≥200-doc read on every route, and it yields a list rather than arrivals); both feeds
  everywhere (two clocks, two identity schemes, and a dedupe rule that double-renders if
  wrong).

- **D-06: One derived `event_type → hue` map, exported from a single module, consumed by
  both surfaces, failing to MACHINE on an unknown type.** Neither feed carries a "who"
  field. `run.*` / `chat.response` / `agent_*` are Ástríðr (violet); `command_execution` /
  `pipe_execution` / `job_lifecycle` / `docker_status` / `health_check` are the machine
  (cyan); error-shaped types are the red down-spike. An unrecognised type still renders — it
  is a real event — but as machine/neutral, because mis-attributing an event to Ástríðr is
  the worse error. Unit-test the map against the live `TOPIC_EVENT_MAP` so a new Ástríðr
  event type cannot silently go uncoloured.
  Rejected: an explicit `origin` field on every Ástríðr emit site (authoritative, but this
  repo's own history says a cross-cutting field reaches one of N call sites and the miss is
  silent); reusing the WS topics wholesale (coarser, and an event in two topics has no
  single answer).

- **D-07: Coalescing is DROP at ≤1 packet per second, using the same rule as
  `useLiveFlash`.** Events arriving inside the window are discarded for animation purposes.
  This satisfies the adopted "≤1 animation per region per second" contract literally, and
  reuses the house behaviour rather than inventing a second one — `src/hooks/useLiveFlash.ts:22-24`
  already hard-drops a re-flash inside 1s. The horizon is ambient texture, not an audit log;
  nothing depends on it being lossless.
  Rejected: merging burst events into one brighter/wider packet (invents a visual quantity
  the sketch never validated, and "brighter" reads as *more important* rather than *more
  numerous*); queue-and-drain at 1/s (under sustained load the horizon shows events from
  minutes ago, turning a live signal into a lagging one).

- **D-08: The ECG's empty-window state splits UNAVAILABLE from IDLE.** Feed down or absent
  → dotted baseline plus italic "no signal yet" at 55% opacity, per the honest-states law
  (sketch §9). Feed healthy but zero events → the sketch's breathing baseline (opacity
  0.5↔0.8, 4s sine), because a quiet system genuinely *is* nominal and "no signal" would be
  the fabrication. This mirrors the six-state contract already in the codebase —
  `MetricCard`'s `state: "unavailable"` is used for exactly this distinction at
  `src/components/HeroStatsBar.tsx:157-163`.
  Rejected: one breathing baseline for every empty case (a dead feed and a calm system
  become visually identical); the honest null always (labels a healthy idle system as having
  no signal, which trains the operator to ignore the phrase).

### Pulse ECG hero — replacement scope (SIGNAL-02)

- **D-09: The whole top card goes. The health dot dies as a duplicate; the memory hit-rate
  relocates.** The ECG canvas becomes the hero. The status dot at
  `src/components/HeroStatsBar.tsx:167-171` is deleted as a *genuine* duplicate — the Signal
  Horizon and the header's Nominal/Attention/Critical chip carry that exact state on every
  page, so the datum still renders, just not twice. The memory hit-rate (`:194-197`) is real
  data and becomes a tile in the existing KPI grid, honouring 124's D-08 rule that real
  numbers relocate rather than die. The KPI grid itself is otherwise untouched.
  Rejected: swapping only the numeral and gradient bar in place (leaves the ECG boxed in a
  card the sketch replaced outright, and keeps the duplicated dot); relocating the health dot
  as well (a redundant health tile under a header already saying the same word).

- **D-10: "The entry-chunk budget holds" must first be given a budget: measure a real
  baseline, then ratchet.** No byte budget exists anywhere in this repo today (finding F-3).
  Record the entry chunk's actual size **before any 125 code lands**, then assert the
  post-change size against it with a stated allowance. Same shape as
  `src/tokenSweep.ratchet.test.ts`, which the repo already runs. Note the inversion the
  measurement produced: the hero is *not* the entry-chunk risk — `Dashboard` is lazy
  (`src/App.tsx:18`) — the **horizon** is, because `DashboardLayout` is a static import
  (`src/App.tsx:4`).
  Rejected: a structural rule only (no new dependency, stays in the lazy chunk) — right
  direction, but the criterion stays prose and the next phase inherits the same unmeasurable
  clause.

- **D-11: The canvas runs `requestAnimationFrame` gated on document visibility and on
  motion preference.** Loop runs while the tab is visible; stops on `document.hidden`; under
  `prefers-reduced-motion` / `readable` it paints one static frame and never loops. Keeps the
  breathing baseline the sketch validated without leaving a loop running behind a hidden tab
  for hours — this repo has prior CPU-drift history on long-lived sessions.
  Rejected: an unconditional loop (throttled but not stopped in background tabs);
  event-driven redraw only (drops the breathing baseline, which is what makes an idle trace
  read as alive rather than frozen).

- **D-12: The hero keeps an eyebrow and one numeral: `PULSE / 60s` plus a 40px thin
  tabular-nums figure showing events in the window.** The removed card carried the
  Dashboard's only headline number; this gives it back with a figure the trace itself
  already contains — measured, not composed, unlike the `100 - errorRate*2` it replaces.
  Typography follows the sketch's hero-numeral role (40px, weight 300, `tabular-nums`,
  letter-spacing -0.02em) and the 11px mono uppercase eyebrow.
  Rejected: trace-only with no numeral (most faithful to the mockup, but the Dashboard's
  numbers then all live below the fold in the KPI grid).

### Serif voice trial (SIGNAL-03)

- **D-13: Briefings is the surface. InsightsChat is rejected, on grounds of speaker
  identity.** `src/pages/InsightsChat.tsx:1-8` states in its own header that it is
  "LLM-powered Q&A over CodePulse operational data … **Distinct from Agent Chat (which sends
  tasks to Ástríðr)**", and it calls `api.insightsChat.ask`, a CodePulse-side action.
  Putting her serif on it would attribute her voice to a different speaker — the same
  category error the colour law bans for `--astridr` ("Ástríðr the entity, and only her").
  It also renders through the shared `ChatBubble`, so the change would leak into Agent Chat,
  and regressing `/chat` is explicitly out of scope (`REQUIREMENTS.md:99`). Briefings
  (`src/pages/Briefings.tsx`, 76 lines, rendering `BriefingFeedItem` over
  `api.briefings.listBriefings`) is persisted long-form prose she actually authored, isolated
  behind one component, and is named first by the requirement and by sketch §3.

- **D-14: Instrument Serif, self-hosted via `@fontsource`, imported inside the Briefings
  module only.** Anyone who never opens Briefings downloads nothing. The trial must exercise
  the *actual* face the sketch validated, because the verdict's whole purpose is to decide
  what an app-wide commit would ship.
  Rejected: adding the family to the global Google Fonts link at `index.html:16` (one line,
  matches how every other font loads — and puts a webfont request on every page load to serve
  one route); Georgia-only (zero bytes, and the sketch names it as the fallback — but then the
  evaluation measures a face that would never ship).

- **D-15: The serif applies in every theme EXCEPT `readable`.** `readable` keeps Geist for
  body prose, matching its existing no-effects guarantee — that theme exists so someone who
  needs plain text can get it, and no one has measured 17px italic serif against a WCAG-AA
  bar. The other four themes all get it, so the trial still runs across every theme anyone
  judging the look would use.
  Rejected: all five themes (changes the reading face in the one theme whose purpose is
  legibility); cyan only (switching theme would silently change who is speaking, contradicting
  the voice being a property of Ástríðr rather than of the palette).

- **D-16: The evaluation is a blocking operator visual checkpoint plus a
  `125-SERIF-TRIAL.md` verdict file, and that file's existence is the gate.** The file
  records the verbatim call — adopt / reject / revisit — with a date and the reasoning. No
  app-wide font change may be *proposed* until it exists. Same shape as 123's D-18 operator
  checkpoint and `123-CRITERION-DECISION.md`.
  Rejected: a blind A/B with embargoed mapping (stronger against novelty bias, but hard to
  keep clean with one observer who knows exactly what changed); adding a rendered-size and
  contrast measurement (more machinery than a question about how her voice should feel needs).

### Decisions added at planning time (2026-08-21), from 125-RESEARCH.md findings

These three were taken by Larry after `125-RESEARCH.md` measured facts that CONTEXT.md and
UI-SPEC.md could not have known when they were written. Each answers a sub-question the
prior artifacts left open — none reverses D-01..D-16.

- **D-17: The Pulse ECG's 40px numeral counts LIVE-WS events over the trailing 60s. The
  Convex backfill draws the trace but does NOT feed the count.** Research established that
  `run.*` and `chat.response` — exactly the event types D-06 colours Ástríðr-violet — are
  emitted through `ConvexHandler.send_live()` (`astridr-repo/astridr/engine/telemetry.py:395-408`),
  which by its own docstring "Does NOT send to Convex HTTP endpoint". So the Convex backfill
  can contain **zero** violet blips by construction, and no dedup mechanism closes that gap.
  Counting only what arrives on the socket makes the numeral exact over one coherent event
  universe that includes violet, and it dissolves the entire backfill↔live identity problem
  that `125-UI-SPEC.md:216-241` spends three paths trying to solve.
  **This SUPERSEDES the UI-SPEC's path (a)/(b)/(c) choice for the numeral** — none of the
  three is taken. UI-SPEC's Reconciliation sequence still governs the TRACE (the backfill
  still draws the trailing 60s of machine-family events); it no longer governs the count.
  **The cost, which must be honoured, not hidden:** for the first 60s after mount the window
  is not yet full. The numeral must render in the `unavailable`/degraded state already
  defined in UI-SPEC's Empty-window states table until it fills — never a partial count
  presented as a complete one. That is the same honesty bar D-12 exists to meet.
  Rejected: UI-SPEC path (a) — a client-generated `event_id` threaded into both transports
  plus a new `runtime_events` schema field; it rides the same Docker rebuild `estop_state`
  already needs, but adds a self-hosted Convex schema deploy AND still misses every pre-mount
  violet event, so it buys exactness only over the machine family. Path (b) — time-partitioned
  watermark merge; research strengthened it (WS and Convex carry the *same* producer float,
  `telemetry.py:214`/`:501`, so there is no clock-skew question for buffered events) but its
  watermark boundary is an identity problem no offset measurement resolves, and it still has
  zero violet backfill coverage. Path (c) — ship no numeral; safest, but surrenders the
  Dashboard's only headline number, which is the whole reason D-12 exists.

- **D-18: The D-10 ratchet's allowance is +2% over the measured baseline.** Baseline measured
  twice, deterministic, at repo HEAD before any 125 code: entry JS `dist/assets/index-CyAqQtIE.js`
  = **583,049 bytes**; entry CSS `dist/assets/index-MiRtUUCk.css` = **237,359 bytes**. A
  percentage rather than a fixed byte figure so ordinary dependency drift does not fail the
  ratchet for reasons unrelated to this phase. **State the estimate honestly in the plan:** the
  Signal Horizon does not exist yet, so 2% (≈11.7 KB on JS) is chosen as drift-tolerant, not
  as a measured fit to a known component size.
  Rejected: a fixed +15 KB raw allowance (a stricter whole-bundle guard, but it fails on
  unrelated dependency bumps and someone ends up re-baselining it); +5 KB (highest signal if
  it passes, likeliest to block execution on a legitimate implementation and become a ratchet
  nobody trusts).

- **D-19: Fix `run.blocks`'s double WS emission upstream in `astridr-repo`, AND keep a
  client-side dedup guard.** `astridr/agent/loop.py:1761-1772` emits `run.blocks` twice for one
  logical tool-call turn — once via `_emit_run_event()` → `send_live()` and once via the
  buffered `.send()` path, which also fans out over WS — and the two call sites can carry
  **different `session_id`s** (`loop.py:606-624`'s override vs. `session.id` verbatim). Under
  D-17 the numeral is live-WS-only, so this double-delivery would overcount every tool-call
  turn by one. The upstream fix rides the same `docker compose up --build` that `estop_state`
  (D-01) already requires, so it costs no additional operator event. The client guard stays
  regardless so CodePulse is not silently dependent on a specific Ástríðr build being deployed.
  Rejected: client-side only plus a filed todo (leaves a known correctness defect live
  upstream, and a "fix it later" footnote is deferred work in a transparency costume);
  upstream only (cleanest data model, but the count then breaks against any Ástríðr build
  predating the fix, with nothing to notice it).

- **D-19-REVISED (2026-08-24, during execution of 125-03): the upstream half of D-19 is
  WITHDRAWN. The client-side dedup guard is now the whole mitigation, not half of it.**
  D-19 as written above is not implementable without data loss, and the option it explicitly
  rejected — client-side only — is the one taken. The reason is a fact D-19 did not have:
  the buffered `.send()` call it told 125-03 to delete is the **sole writer of a live
  persisted consumer**. Measured 2026-08-24, all four links independently re-verified by the
  orchestrator after the executor reported them:
  `convex/runtimeIngest.ts:1375` routes `case "run.blocks"` into
  `ctx.runMutation(api.runBlocks.record)`; `convex/runBlocks.ts:12` is the only
  `ctx.db.insert("run_blocks", …)` in the repo; `src/pages/LiveRun.tsx:70,72` reads that
  table back via `useQuery(api.runBlocks.listSessions)` / `getBySession`; and it is routed
  live at `App.tsx:162` (`/live-run`). The surviving call D-19 named as the keeper
  (`_emit_run_event()` → `send_live()`) reaches Convex through **no path at all** —
  `astridr/engine/telemetry.py:395-399`, docstring: "bypasses batch buffer, WS fan-out only.
  Does NOT send to Convex HTTP endpoint." So executing D-19 as specified would have silently
  and permanently emptied `/live-run`'s history, observable only as an absence.
  This is the D-19 rejection reasoning inverted by evidence: "leaves a known correctness
  defect live upstream" was the right call when the upstream fix was believed free, and the
  wrong one now that its true price is a deleted persistence path.
  **What this does NOT change:** 125-09 already assumed it. `125-09-PLAN.md:150` states
  "`run.blocks` may still arrive twice even after plan 125-03 ships. The client guard stays",
  and its cases (f) doubled-delivery and (g) single-delivery both remain required — the guard
  must still handle either. No 125-09 edit is needed.
  **What this DOES change:** `125-12-PLAN.md:14`'s must_have cites D-01/D-02/**D-19** as the
  three changes riding one rebuild. Only D-01 and D-02 now ride it; the D-19 reference there
  is stale and must not be read as an unmet acceptance criterion at 125-12 execution time.
  **Still open, deliberately not decided here:** whether the WS stream should carry the
  duplicate at all. Any FUTURE WS consumer inherits it, and the only two real fixes both cost
  an astridr change — a `ws=False` option on `send()` so the buffered call skips its fan-out,
  or dropping `_emit_run_event` at the paired sites, which first requires PROVING `send()`'s
  contextvar `session_id` equals `set_run_event_session_id`'s override. Larry chose the
  client-side guard over both on 2026-08-24. Revisit only if a second WS consumer of
  `run.blocks` appears.

- **D-20 (2026-08-24): 125-12's before/after wire control is REPLACED by a malformed-snapshot
  control, because the "before" state was destroyed before it could be captured.**
  125-12's must_have specifies proving the D-02 wire by a before/after contrast on one probe —
  "the horizon stays `unknown` while no emitter is deployed and leaves `unknown` after the
  rebuild". That is no longer observable. The `estop_state` emitter is ALREADY LIVE in the running
  container, shipped incidentally by the concurrent astridr-repo session's Phase 195 rebuild, not
  by any plan of this phase.
  Measured 2026-08-24, with a control at each step: the compose project's `working_dir` is
  `C:\Users\mandr\astridr-repo` (the main checkout, on `feature/brain-swap`); `/app/astridr` is NOT
  among the container's mounts, so it is image-baked and the copy read is the copy that runs; the
  image `sha256:9114482b45cf` was created `13:49:51Z` and the container started `13:50:06Z`, 15
  seconds later, on that same image id. Control on the code itself: `estop_state` occurs 0 times in
  `estop.py` at `86b6282b~1` and 3 times at `86b6282b`; 0 times in `ws_telemetry.py` at
  `eb8f780b~1` and 6 times at `eb8f780b`. The running container shows exactly 3 and 6, and both
  files are byte-identical to `feature/brain-swap`'s tip once CRLF is normalised.
  **Consequences.** (a) `feature/brain-swap` IS production for the agent container — there is no
  separate prod checkout, and merging to `main` would deploy nothing. (b) Nothing astridr-side
  remains unshipped, since D-19's upstream half was withdrawn by D-19-REVISED, so 125-12's rebuild
  is now a NO-OP rather than a delivery. (c) The "no emitter deployed" half of its control cannot
  be recreated without deliberately rebuilding backwards off a pre-125-03 commit, which was
  considered and rejected as disproportionate and risky.
  **The replacement, chosen by Larry on 2026-08-24:** prove on the same observable
  (`data-horizon-state`) that the horizon enters `unknown` on a MALFORMED snapshot and leaves
  `unknown` only on a well-formed one. This tests the same property the original control tested —
  that only a valid snapshot can clear the fail-closed state — and it is still falsifiable, because
  a component that ignored payload validity would pass the well-formed case and fail the malformed
  one. It requires no undeployed emitter and no time travel.
  **What is LOST and must be stated rather than papered over:** the original control would also
  have proven the wire end-to-end from Ástríðr's emitter through the socket to the DOM. The
  replacement proves only the client's handling of snapshot validity. End-to-end delivery is
  therefore NOT established by 125-12 under D-20 and must be carried by 125-13's live E-Stop
  verification, which arms the real E-Stop and watches the real horizon. Do not read a green 125-12
  as evidence that Ástríðr's emitter reaches the browser.

### Claude's Discretion

None — every question in this discussion was answered explicitly. No "you decide" options
were taken.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design law (closed to re-litigation — `REQUIREMENTS.md:16-18`)
- `.claude/skills/sketch-findings-codepulse/references/shell-and-dashboard.md` — the 12
  locked decisions. §4 is the Signal Horizon (aurora resting state, 48px/620ms packets,
  state overrides), §5 is the Pulse ECG hero (60s window, blip colours, `getComputedStyle`),
  §3 is the typography roles incl. Ástríðr's italic serif, §9 the honest-states law, §12 the
  E-Stop signature moment and the ~2.6s dawn disarm.
- `.claude/skills/sketch-findings-codepulse/SKILL.md` — direction summary, motion tokens,
  the aurora/packet CSS patterns, the kill list.
- `.claude/skills/sketch-findings-codepulse/sources/themes/default.css:32-34` — the
  `--aurora-a/b/c` values D-03 derives from.
- `.planning/sketches/001-dashboard-quiet-control-room/index.html` — the working interactive
  mockup. The horizon, the ECG canvas, the E-Stop flow and the disarm easing all run. Open
  it; it answers timing and feel questions faster than prose.
- `html-out/ui-premium-redesign-comparison.html` — the 3-model proposals and the approved
  verdict.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md:58-60` — SIGNAL-01 / SIGNAL-02 / SIGNAL-03 verbatim.
- `.planning/REQUIREMENTS.md:93-101` — Out of Scope, incl. "App-wide serif adoption" and
  "Regressing `/chat`".
- `.planning/ROADMAP.md` §"Phase 125: Signature Layers" — goal, dependencies, the three
  success criteria.
- `.planning/ROADMAP.md:713` — the POLISH-04 residue assignment that gives SIGNAL-02 the
  synthetic System Load figure.

### Prior phase contexts this one depends on
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTEXT.md:448-449` —
  what 122 promised Phase 125 would inherit. Read alongside finding F-2, which measures what
  actually landed.
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTEXT.md:127-147` —
  D-10's motion-token naming rationale (`--duration-*` is not a Tailwind namespace,
  `--ease-*` is).
- `.planning/phases/124-shell-information-architecture/124-CONTEXT.md:372-373` — the header
  leaves the horizon slot clean; the horizon attaches directly beneath it.
- `.planning/phases/124-shell-information-architecture/124-CONTEXT.md:97-103` — D-08's rule
  that real numbers relocate rather than being deleted (D-09 applies it).

### Cross-repo (Ástríðr) — D-01 and D-02
- `astridr-repo/astridr/engine/estop.py:26-63` — `EmergencyStop`, its `is_active` property,
  the corrected list of activation surfaces, and the statement that state is in-memory and
  does not survive a restart.
- `astridr-repo/astridr/engine/ws_telemetry.py:26-86` — `TOPIC_EVENT_MAP`, `VALID_TOPICS`,
  and `_event_matches_topics`. `infrastructure.commands.catalog` (`:64`) is the
  push-on-connect precedent D-02 follows.
- `astridr-repo/astridr/api/ws_commands.py:1055-1066` — the existing
  `estop.activate` / `estop.deactivate` handlers the new emission hooks alongside.
- `astridr-repo/astridr/channels/web.py:1728-1750` — `_LOOPBACK_HOSTS` and
  `_estop_precheck`, i.e. why the HTTP status route is unreachable from a browser.

### Project operating rules
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — deploy must name
  `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; never bulk-write the live
  instance.
- `astridr-repo/CLAUDE.md` — the Ástríðr rebuild rule (`up --build`, never `restart`, and
  the `prod,war-room` profile set).

</canonical_refs>

<code_context>
## Existing Code Insights

### Findings that bind this phase

These were measured during discussion, each with a control or a direct read. **Two of the
three ROADMAP success criteria currently rest on mechanisms that do not exist.**

- **F-1 — CodePulse cannot observe E-Stop at all today.** `grep -ri estop convex/` returns
  0 function hits; there is no `estop` topic in `AstridrWSContext.tsx`'s `TOPIC_EVENT_MAP`
  (`:57-92`); `EStopButton.tsx` fires a WS command and shows a toast, and nothing latches the
  result. Ástríðr *does* expose `GET /api/estop/status`, but `_estop_precheck`
  (`astridr-repo/astridr/channels/web.py:1730-1750`) rejects any caller whose
  `request.client.host` is not in `_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}`
  (`:1728`) **and** requires an `x-astridr-admin-key` header. A browser on the host reaches
  the container through the docker gateway IP, so it gets `403 "loopback only"`; so would
  convex-backend. Baking the admin key into the bundle is the exact thing
  `EStopButton.tsx:11-20` refuses to do. **There is no browser-reachable read path.** D-01
  and D-02 exist to create one.
  Second-order: `estop.py:60-63` records that the state is in-memory and
  `docker restart astridr-agent` clears a halt unconditionally — so any design that caches
  "armed" outside Ástríðr can outlive the halt it describes.

- **F-2 — Two tokens this phase was told it would inherit were never landed.** Phase 122
  shipped `--surface-0..3`, `--hairline`, `--astridr`, the `--status-ok` decouple, and
  `--duration-fast/normal/slow` + `--ease-house` (`src/index.css:47-57`). It did **not**
  ship `--aurora-a/b/c` (0 hits) or `--font-voice` / any serif family (0 hits). Both are
  Phase 125's to create. Note the naming: 122's D-10 deliberately used `--duration-*` and
  `--ease-house`, **not** the sketch's `--dur-1/2/3` / `--ease-out` — the horizon must read
  the names that exist.

- **F-3 — No entry-chunk budget exists to "hold".** There is a convention (DEBT-03
  lazy-loads heavy consumers — `src/layouts/DashboardLayout.tsx:9,24,42`) and comments
  citing it, but nothing anywhere measures or asserts a byte figure. D-10 creates one.
  The risk is also inverted from criterion 2's wording: `Dashboard` is lazy
  (`src/App.tsx:18`) so the ECG lands in the Dashboard chunk, while `DashboardLayout` is a
  static import (`src/App.tsx:4`) so the **horizon** is what lands in the entry chunk.

- **F-4 — 124's deferred SYS/LAT item is already closed, not inherited.** 124 plan 09
  relocated SYS and LAT into the `⋯` menu (`src/layouts/DashboardLayout.tsx:953-984`). D-08's
  "the `⋯` menu, or onto the Dashboard" question is settled; Phase 125 inherits nothing there.

### Reusable Assets
- `src/hooks/useLiveFlash.ts:22-24` — the existing 1s drop-debounce. D-07 reuses this rule;
  the horizon should not invent a second coalescing behaviour.
- `src/components/MetricCard.tsx` + `src/lib/metricState.ts` — the six-state metric contract
  (`state: "unavailable"` et al). D-08's unavailable-vs-idle split should follow it, and D-09's
  relocated memory tile is a plain `MetricCard`.
- `src/hooks/useRecentEvents.ts` → `api.events.listRecentUnified` — the hero's D-05 backfill
  candidate. **Read it before using it:** `convex/events.ts:193-244` `.take()`s
  `max(limit, 100)` from *two* tables, merges, sorts and slices, so it is a ≥200-doc read;
  timestamps are **seconds**, not milliseconds; and it is already 48h range-bound. A 60s
  window needs its own bounded query rather than this one at a larger limit.
- `src/contexts/AstridrWSContext.tsx:454-465` — `subscribeEvent` is a plain per-event-type
  callback registry with **no** client-side topic gate, so a new server-routed event type
  flows through once registered. The client's `TOPIC_EVENT_MAP` (`:58-92`) is used only by
  `subscribe(topic)` and currently mirrors an older server map (it lacks `infrastructure`).
- `src/components/PageHeader.tsx` and `src/components/SectionErrorBoundary.tsx` — the page
  layer this phase renders inside; the ECG hero belongs under the Dashboard's `PageHeader`,
  not replacing it.
- `src/components/BriefingFeedItem.tsx` — the single component D-13/D-14's serif scope
  applies to.

### Established Patterns
- `src/index.css:777-780` — `[data-theme="readable"] *` carries `animation: none !important`.
  Any aurora drift or breathing baseline is suppressed there automatically; D-04 and D-11
  must not rely on that alone for the *canvas*, since a rAF loop is not a CSS animation.
- `src/tokenSweep.ratchet.test.ts` — the house ratchet-test shape D-10 follows, including its
  refusal when `dist/assets/*.css` is absent (`:339`).
- Colour must be read from CSS custom properties via `getComputedStyle`, never hardcoded —
  and per the Tailwind-v4 lesson, computed colours come back as `oklch()`/`oklab()`, so any
  *verification* of rendered colour must rasterise rather than regex-scrape.

### Integration Points
- **Horizon:** between `<header className="min-h-14 …">` (`src/layouts/DashboardLayout.tsx:840`,
  which today carries `border-b border-border`) and `<main>` (`:1001`). 124 left the slot
  clean; decide whether the horizon replaces that `border-b` or sits beneath it.
- **Hero:** `src/pages/Dashboard.tsx:14,68` imports and renders `HeroStatsBar`. D-09's
  removal is confined to `src/components/HeroStatsBar.tsx:161-197` (the top card) plus one
  added KPI entry.
- **Serif:** `src/pages/Briefings.tsx` → `BriefingFeedItem`; the `--font-voice` token is new
  and lands in `src/index.css` alongside `--font-geist` (`:44`).
- **Cross-repo:** `astridr/engine/estop.py` (emit on activate/deactivate),
  `astridr/engine/ws_telemetry.py` (`TOPIC_EVENT_MAP` + the on-connect push), and the
  mirrored client map in `src/contexts/AstridrWSContext.tsx`.

</code_context>

<specifics>
## Specific Ideas

- **The interactive mockup is the reference implementation, not a description.**
  `.planning/sketches/001-dashboard-quiet-control-room/index.html` has a working horizon
  (aurora drift, travelling packets, state overrides), a working ECG canvas, and a working
  E-Stop arm/disarm with the dawn easing. Open it before writing timing code.
- **Fixed by the sketch, not open:** the horizon is 2px at rest and 3px crimson when armed;
  packets are 48px wide over 620ms; the aurora drifts at 90s linear over 300% background-size;
  disarm eases back through amber over ~2.6s; the ECG window is 60s (5min was tried and made
  the trace look empty).
- **Sequencing constraint created by D-01 (flag for the planner, not a decision taken here):**
  the `estop_state` emitter lives in `astridr-repo`, and Ástríðr's package is baked into its
  image — `docker compose up --build` is required, `docker restart` will not deploy it. Per
  `astridr-repo/CLAUDE.md` the profile set is `COMPOSE_PROFILES=prod,war-room`. A rebuild
  recreates containers and destroys the old container's logs, so check the cron calendar
  before firing one. Plan the horizon so its **state layer** can land and be verified against
  a stubbed/simulated `estop_state` before the cross-repo half deploys — otherwise a single
  operator rebuild gates the whole phase.
- **The verdict file is the gate, not a report.** `125-SERIF-TRIAL.md` must exist with a
  dated adopt/reject/revisit call before any app-wide font change is proposed. Its absence
  blocks; its presence does not authorise.

</specifics>

<deferred>
## Deferred Ideas

- **The sketch's 6-column instrument cluster** (`shell-and-dashboard.md` §"HTML Structures"
  — one `<section class="cluster">`, hairline-separated cells, eyebrow → 40px numeral → delta
  chip → 18-bar sparkline). A real part of the design law, but not named by SIGNAL-01/02/03,
  and criterion 2 explicitly scopes the hero to "one component". Its own phase.
- **The truth sentence** (§10 — one plain-language line under the page title answering "does
  anything need me?", rewriting on E-Stop to "I have stopped everything, as you asked"). No
  v15.0 requirement carries it. It would pair naturally with D-01's `estop_state`, which is
  the reason to note it rather than lose it.
- **The `--density` token** (§11, `1 | 0.85` scaling paddings/rows/numerals). Validated in
  the sketch, unassigned in this milestone.
- **App-wide serif adoption.** Explicitly out of scope for v15.0 (`REQUIREMENTS.md:97`), and
  D-16 gates even *proposing* it on the verdict file.
- **A per-event `origin` field on Ástríðr telemetry** (D-06's rejected alternative). It is
  the authoritative answer to blip identity and would retire the derived map — worth revisiting
  if a future phase is already touching every emit site.

### Reviewed Todos (not folded)

`gsd-sdk query todo.match-phase 125` returned 8 matches, all scoring 0.6 on generic keyword
overlap ("phase", "124", "122", "tokens", "page"). None were folded; none are SIGNAL work.

- `inbox-listheldunacked-unbounded-every-route`, `tool-galaxy-getprojectgraph-timeout`,
  `inbox-page-undercounts-held-behind-200-cap`, `alert-rules-engine-rows-overlap`,
  `automation-page-placeholder-cards-and-invalid-expression`,
  `sidebar-4px-horizontal-overflow-separator`, `polish-geometry-spec-measures-cold-page` —
  all seven are named by `.planning/ROADMAP.md` §"Phase 126" as that phase's entire scope.
  Three are Convex-side and deliberately batched to share one operator deploy.
- `forge-analytics-visual-polish` — its own `trigger_when` names "the next Forge- or
  Analytics-touching phase, or a dedicated visual-polish phase". Phase 125 touches neither
  `/forge` nor `/analytics`.
- `ideationrow-text-white-raw-palette-class` — its own `trigger_when` names "any future
  accessibility/token sweep phase that includes raw-palette-class remediation". Not this
  phase's defect class.

**Related but not matched:** `inbox-listheldunacked-unbounded-every-route` is the direct
precedent for D-05's every-route read budget. It is Phase 126's to fix; it is cited here as
the reason the horizon takes no Convex subscription.

</deferred>

---

*Phase: 125-Signature Layers*
*Context gathered: 2026-08-21*
