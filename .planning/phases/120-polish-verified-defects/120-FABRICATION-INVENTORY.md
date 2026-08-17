# 120-05: Fabrication Class Sweep (D-08) — Inventory

Phase 120, Plan 05. Sweeps `src/` for the POLISH-04 defect class — a rendered surface asserting
a state/value with no emitter behind it — beyond the one verified instance (`HeroStatsBar.tsx`'s
Integrations row, fixed by Task 1 of this plan). Every search below was re-run against the live
2026-08-17 checkout, not copied from the plan's pre-measured figures.

## §1 — Searches run

All commands run from the repo root (`C:\Users\mandr\codepulse`), literal output.

1. **`Math.random` in non-test `src/`**
   ```
   git grep -n 'Math\.random' -- 'src/**' | grep -v '\.test\.'
   ```
   **9 hits.** `voice/AvatarAura.tsx:189-192` (particle physics jitter), `lib/audioEngine.ts:97,315,366,493`
   (note/jitter selection for Tone.js synthesis), `pages/ConfigPage.tsx:347` (randomised skeleton
   placeholder widths). None assert a figure.

2. **Comment keywords** (`simulat|mock|demo|fabricat|placeholder|hardcoded|for now`, case-insensitive,
   restricted to actual comment syntax — `//`, `/*`, or `*` continuation lines — to exclude JSX
   `placeholder="..."` attributes, which are a distinct, legitimate pattern searched separately below)
   ```
   git grep -niE 'simulat|mock|demo|fabricat|placeholder|hardcoded|for now' -- src \
     | grep -v -E '\.test\.(ts|tsx)|src/test/|__mocks__' \
     | grep -E '//|/\*|^\s*\*'
   ```
   **99 hits** (the plan's pre-measured "~40" undercounted this — a broader, unfiltered pass across
   all text including JSX `placeholder=` attributes returned 365, and a naive filter that only
   dropped test files and `placeholder=` attributes still returned 210; restricting to comment-syntax
   lines gets to 99). Full triage in §4 — **zero** are live defects. One triage step itself surfaced a
   sweep-methodology finding: the regex matches `demo` as a **substring of unrelated identifiers**
   (`globalOverrideModel` contains `...rideMo...`; `demonstrably` contains `demo`) — recorded in §4 as
   its own dropped family since it is a lesson for whoever re-runs this sweep, not a defect.

3. **Hardcoded display arrays** (a literal array of uppercase string tokens rendered via `.map`,
   the `['GITHUB','LINEAR',...]` shape)
   ```
   git grep -nE "\[\s*['\"][A-Z_]+['\"]\s*,\s*['\"][A-Z_]+['\"]" -- src '*.tsx' | grep -v -E '\.test\.tsx'
   ```
   **1 hit** (excluding the one just fixed, which no longer matches): `reminders/CalendarOverlay.tsx:221`
   `["S","M","T","W","T","F","S"]` — calendar weekday-initial column headers. Static UI labels, not a
   status/health assertion. Dropped (§4).

4. **Status/health indicators with a literal, unconditional colour or state** (the
   `bg-emerald-500/80` shape — `rounded-full bg-<color>-<weight>`)
   ```
   git grep -noE "rounded-full bg-(emerald|green|red|yellow|amber|blue|primary)-[0-9]+(/[0-9]+)?" \
     -- src '*.tsx' | grep -v -E '\.test\.tsx'
   ```
   **17 hits** across 13 files. 16 are legitimate (legends, real-data-gated dots, decorative echoes of
   an adjacent real conditional, empty-state celebration) — triaged individually in §4. **One is a
   live hit**: `src/components/chat/VitalsRail.tsx:253` — recorded in §3.

5. **Numeric literals rendered inside a metric/KPI/tile component**
   ```
   git grep -nE "<(MetricCard|KpiTile|StatTile|KpiCard)[^>]*\bvalue=\{?[0-9]" -- src '*.tsx' | grep -v '\.test\.tsx'
   git grep -n "AnimatedNumber value=" -- src '*.tsx' | grep -v '\.test\.tsx'
   git grep -nE '>[0-9]{1,3}(\.[0-9]+)?%<' -- src '*.tsx' | grep -v '\.test\.tsx'
   ```
   **0 / 2 / 0 hits.** No `MetricCard`/`KpiTile`/`StatTile`/`KpiCard` call site passes a literal numeric
   `value`. `AnimatedNumber value=` has two call sites: `HeroStatsBar.tsx:141` (the already-known
   synthetic System Load — §3) and `MetricCard.tsx:145`, the primitive's own internal wiring
   (`value={numericValue}`, a prop passthrough, not a literal — dropped). No hardcoded `>NN%<` text
   node exists anywhere in `src/`.

6. **`for now`** (temporary-code marker, run as its own search since it did not co-occur with any
   other keyword hit worth separating)
   ```
   git grep -ni "for now" -- src | grep -v -E '\.test\.(ts|tsx)|src/test/'
   ```
   **0 hits.** An empty result is a result — recorded per plan instruction, not omitted.

7. **`d3ReheatSimulation` control** (proves the `simulat` keyword hits are the documented force-graph
   API name, not a fabrication comment)
   ```
   git grep -c "d3ReheatSimulation" -- src
   ```
   **5 hits** (`ForceGraph3D.tsx`, `ForceGraphCanvas.tsx`, plus 3 test files) — confirms the pattern is
   live in this codebase, as the plan's interfaces section predicted.

## §2 — FIXED (unambiguous)

**`src/components/HeroStatsBar.tsx` ~161-170** (pre-edit line numbers; block now deleted).

```
{/* Quick Action Badges (Integrations row simulation) */}
<div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-y border-border/50 py-3">
  <span className="text-xs text-primary uppercase tracking-widest font-mono mr-2">Integrations</span>
  {['GITHUB', 'LINEAR', 'SLACK', 'CONVEX', 'VERCEL'].map((integration) => (
    <div key={integration} ...>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
      <span ...>{integration}</span>
    </div>
  ))}
</div>
```

Asserted: five integrations (GitHub, Linear, Slack, Convex, Vercel) are all healthy — a green dot per
name, on the Dashboard hero, unconditionally.

Why unambiguous — three independent tells, each sufficient alone:
1. A **literal string array** (`['GITHUB','LINEAR','SLACK','CONVEX','VERCEL']`), not a query result.
2. **Unconditional colour** — `bg-emerald-500/80` is a fixed class string, not interpolated from any
   state, prop, or query.
3. A **self-describing comment** naming it "Integrations row simulation" — the code's own author
   flagged it as fake.

Two of the five names (`LINEAR`, `VERCEL`) have no emitter anywhere in the system at all (verified:
`git grep -i linear -- convex/` and `git grep -i vercel -- convex/` both return zero), so even a
"wire it to real data" repair could not cover the row as designed.

Fix: deleted outright (D-07), not rewired. The honest, emitter-backed equivalent already ships at
`/infrastructure` — re-verified live at execution time:
- `convex/integrations.ts:41` — `export const healthStatus = query({...})` exists.
- `src/pages/Infrastructure.tsx:8,86` — imports and renders `<IntegrationHealth />`.

## §3 — RECORDED, deferred to a named phase

| # | Location | Expression | Confidence | False claim | Owner |
|---|----------|-----------|------------|--------------|-------|
| 1 | `HeroStatsBar.tsx` ~141 (pre-edit line; unchanged by this plan) | `<AnimatedNumber value={stats.activeSessions > 0 ? 100 - (stats.errorRate * 2) : 100} .../>` under the "System Load" label, eyebrow "LIVE / 5H WINDOW" | High | Error-rate arithmetic (`100 - errorRate*2`) dressed as a load percentage; reads a confident 100% whenever `activeSessions` is 0, i.e. whenever there is no traffic at all | **SIGNAL-02, Phase 125** — `REQUIREMENTS.md:59`: "A Pulse ECG canvas hero replaces the synthetic 'SYSTEM LOAD' bar" |
| 2 | `HeroStatsBar.tsx` ~127 (pre-edit line; unchanged by this plan) | `` className={`... ${hc.bg} text-${hc.bg.replace('bg-','')}`} `` | High | Not a fabrication — a **dead style**. `text-${...}` is a runtime-interpolated Tailwind class; Tailwind's static extractor cannot see a template-literal class name at build time, so this class never ships in the compiled CSS regardless of `hc.bg`'s value | **Phase 122** (TOKEN-01/02 token-and-CSS-architecture work touches this file's colour system) |
| 3 | `src/components/chat/VitalsRail.tsx:253` | `<span className="w-2 h-2 rounded-full bg-green-500" />` labelled "Convex", inside the same `<Link to="/infrastructure">` block whose **sibling two lines above** (`:250-251`) correctly reads `` className={`... ${disconnected ? "bg-red-500" : "bg-green-500"}`} `` for "Ástríðr" | High | Asserts Convex is connected/healthy unconditionally — no state, prop, or query backs the colour, unlike its own sibling three lines away in the same file, which proves the correct pattern was known and simply not applied to this dot | **Phase 122** — this is a genuinely new POLISH-04-class finding, not one of the two pre-identified by the plan. Not fixed here because no live Convex-connectivity signal exists to bind it to: `convex/integrations.ts healthStatus` has no `convex` key (only `github`/`supabase`/`docker`/`telegram`/`slack`/`email` — verified by reading the file), and no component in this repo calls `useConvex().connectionState()` (verified: `git grep -n "useConvex\b\|connectionState" -- src` returns only unrelated WebRTC/voice matches). Choosing the right signal (a `useConvex()` connection-state hook vs. a heartbeat query vs. reusing page-level query staleness) is a design decision, not a mechanical deletion — D-08's judgment-call rule applies. |

**Handoff, stated plainly:** POLISH-04 is **not fully closed** by this plan. One known figure
(System Load) is intentionally left in place because `SIGNAL-02`/Phase 125 already owns its
replacement and re-deciding an assigned requirement is out of this plan's scope. A second item (the
dead `text-${...}` class) is a real defect but not a fabrication, and belongs to Phase 122. A third,
newly found by this sweep (`VitalsRail.tsx`'s Convex dot), is a genuine instance of the same
fabrication class as the row this plan deleted, deferred to Phase 122 because fixing it requires
choosing a live signal, which this plan is not scoped to design.

## §4 — DROPPED, with the reason (the precision account)

**Family A — negative honesty assertions (comments stating what the code does *not* do).**
The overwhelming majority of the 99 comment-keyword hits. These are prior phases' guarantees, the
opposite of the defect being swept for. Representative sample:
- `CostBreakdownTable.tsx:10` — "counts — never a fabricated $0.00, and never folded into either total."
- `ToolPolicyFeed.tsx:162` — "Unrecognised kind — render only the fields present, nothing fabricated."
- `useArmsProbe.ts:9-10` — "this MUST be a live probe, never a hardcoded claim about another repo's state."
- `useBrainCatalogue.ts:34` — "(never a fabricated empty array); the real array..."
- ~15 more of the form "no hardcoded hex" (`CostBreakdown.tsx:62`, `MetricCard.tsx:68`,
  `ProactiveAlertListener.tsx:27`, `UnpricedModelsNudge.tsx:20`, `BrainPickerRow.tsx:16,115,160`,
  `control-center/BrainControl.tsx:14,78`, `LlmStatusPanel.tsx:10`, `proactiveAlert.ts:38,91`,
  `profiles.ts:14`, `skills.ts:140`, `Galdr.tsx:196`) — these document a styling discipline
  (read colour from a CSS var, not a literal hex), unrelated to data fabrication.
Reporting these as hits would be the exact crying-wolf failure `CLAUDE.md`'s review-precision
section forbids.

**Family B — legitimate "placeholder" UI/UX concepts**, honestly labelled as such, which is the
*opposite* of fabrication (an honest "nothing here yet" is not a false claim):
- `layouts/DashboardLayout.tsx:100` — "Placeholder: not-yet-built route. Render as a disabled,
  non-link" (an honestly-disabled nav item, not a live claim).
- `hr/detail/DetailSecurityTab.tsx:89-95` — renders the literal text "Security scan results will be
  displayed here when security scanning is integrated" — an honest disclosure of unbuilt scope.
- `NotificationChannels.tsx:172`, `pages/MeetingBot.tsx:152`, `BrainPicker.tsx:503` — JSX
  `placeholder="..."` attributes on real `<input>` elements (form hint text), a different language
  construct entirely from a fabricated data value.
- `workspace/AstridrLensEmptyState.tsx`, `lib/navRegistry.ts:107-207`,
  `workspace/WorkspaceMapCanvas.tsx:80-82`, `workspace/WorkspaceMapPanel.tsx:71-74` — components whose
  entire purpose (per their own docstrings) is rendering an *honest* placeholder/empty state gated on
  real probe results, the D-10/D-11 pattern this repo already follows.

**Family C — `simulation` as the d3-force API name**, not a fabrication comment:
`graph/ForceGraph3D.tsx:66`, `graph/ForceGraphCanvas.tsx:34,36,63,86,190`, `lib/skillVault.ts:383`,
`lib/workspaceMapLayout.ts:250,683` — every one refers to d3-force's own `simulation.stop()` /
`cooldownTicks` / `onEngineStop` vocabulary (confirmed live in the codebase — `d3ReheatSimulation`,
§1 search 7, 5 hits). Same shape as the plan's own `d3ReheatSimulation` example.

**Family D — test-mock references inside production-file comments**, describing *test* behaviour, not
app-runtime fabrication: `useForge.ts:164`, `useKgDiff.ts:250`, `useRosterAgents.ts:44`,
`useTtsPlayback.ts:48`, `pages/WarRoom.tsx:62`, `lib/githubTree.ts:4`, `workspace/WorkspaceCoverageStrip.tsx:19`.

**Family E — historical/fixed-bug documentation**, describing a *past* fabrication that has already
been corrected, kept as commit-message-style context:
- `brains/BrainPicker.tsx:113-117` — "Plans 109-03 through 109-06 shipped this function with every
  row hardcoded to `group:"api"...` — D-09/D-13 replace that premise" (documents the fix, not the bug).
- `hooks/useResolvedBrain.ts:267` — "the fabricated-reading class ENGINE-03 exists to remove. Before
  this fix, a scoped read with no..." (same pattern).

**Family F — regex substring collisions**, a sweep-methodology finding rather than a code finding:
`demo` (case-insensitive) matches inside unrelated identifiers. `BrainPicker.tsx:232`'s comment
mentions `globalOverrideModel`, which contains `...rideMo...` → case-insensitively `...ideMo...` does
not itself spell "demo" contiguously, but the actual regex engine match was verified directly
(`sed -n '232p' ... | grep -inE '...'` returns the line) against the substring `rideModel` →
`deMo`(insensitive) inside "OverrideModel". `useAstridrVoice.ts:1928`'s "demonstrably" contains
"demo" the same way. Neither is a defect; both are false matches from a 4-letter keyword against
camelCase identifiers. Worth naming explicitly so a future re-run of this sweep does not re-triage
the same two lines from scratch.

**Family G — decorative/legend/real-data-gated status dots** (16 of the 17 `rounded-full bg-<color>`
hits from §1 search 4; the 17th, `VitalsRail.tsx:253`, is §3's new finding):
- Legend colours, not live status: `components/FileTree.tsx:196,199,202` — a fixed
  Write=green/Edit=yellow/Read=blue legend key, identical for every render regardless of data.
- Decorative echo beside a real conditional: `AlertBanner.tsx:21` — the outer `animate-ping` halo is
  `bg-red-400` unconditionally, but the actual status dot two lines below it
  (`counts.critical > 0 ? "bg-red-500" : "bg-orange-500"`) is correctly conditional; the halo is a
  visual effect on top of the real dot, not an independent claim.
- Real-data-gated, not fabricated: `HeartbeatAlertsPanel.tsx:52` (red dot only renders inside
  `hb.alerts.map()`, i.e. only when a real alert object exists), `RecoveryCommits.tsx:47` (emerald
  circle behind a checkmark, once per real recovered commit in the list), `Memory.tsx:464,570` (real
  `stat.tokenSavingsPercent` / `r.agentId` values in a coloured pill — colour is static, but the
  number is real data, not fabricated), `CompactionTimeline.tsx:51` (amber timeline-node dot, one per
  real `events.map()` entry — a uniform marker colour for a real event, not a health claim).
- Already conditional (correctly excluded from the "unconditional" defect class):
  `TeamStatusCards.tsx:91` (`{team.status === "active" && (...)}`),
  `Settings.tsx:533,538` (`{CONVEX_URL ? (...) : (...)}`).
- Gated empty-state decoration, not a false claim: `pages/Alerts.tsx:209` — the green checkmark
  circle renders only when `filtered.length === 0` (a real "you have zero alerts" state).

**Totals:** 4 findings reported (1 fixed, 3 recorded) versus approximately 126 dropped
(9 `Math.random` + 99 comment-keyword + 1 calendar-array + 16 status-dot + 1 `MetricCard.tsx`
`AnimatedNumber` passthrough), plus 3 zero-hit control searches run and recorded rather than skipped.
A sweep that reported 99 comment hits and called it thoroughness would have buried the one genuinely
new finding (`VitalsRail.tsx`) under 98 honesty guarantees; this account is why it did not.

## §5 — Handoff line

POLISH-04 is not fully closed by Phase 120: the Integrations row is deleted (this plan), but three
known fabrication-class residues remain deliberately unfixed — `HeroStatsBar.tsx`'s synthetic System
Load figure (owner: SIGNAL-02, Phase 125), `HeroStatsBar.tsx`'s dead `text-${...}` colour class
(owner: Phase 122), and `VitalsRail.tsx`'s hardcoded "Connected" Convex status dot (owner: Phase 122)
— each recorded above with its file:line and reasoning so Phase 122's TOKEN-04 work and Phase 125's
SIGNAL-02 work do not have to re-derive them.

## §6 — Residue closeout (120-01 accounting, this file only)

Post-edit counts in `src/components/HeroStatsBar.tsx`, this plan's Task 1:

```
git grep -cF 'hover:scale-[1.01]' -- src/components/HeroStatsBar.tsx   →  0 (no output; git grep -c is silent on zero matches)
git grep -cF 'animate-pulse' -- src/components/HeroStatsBar.tsx        →  0 (no output; git grep -c is silent on zero matches)
```

Both residues are gone. The static `<span className="w-1.5 h-1.5 rounded-full bg-primary" />` dot
survives next to "System Load" (D-09: de-animate, not delete — `grep -c 'rounded-full bg-primary'` on
the file is 1, confirming the dot's classes are intact minus `animate-pulse`).
