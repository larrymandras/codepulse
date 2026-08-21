# Phase 124: Shell & Information Architecture - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the app **chrome** — the shell header and the sidebar — with the Borealis Console
3-zone 48px header and a 232px 4-domain sidebar. Presentation only: **every route keeps its
URL**, and a route-list diff taken before and after must be identical.

This phase owns the APP layer. It does **not** touch `PageHeader` (the PAGE layer, already
adopted by 46 of 47 non-test pages — see 122's D-17), and it does **not** build the Signal
Horizon (SIGNAL-01, Phase 125). 124 builds the header the horizon will later attach to.

**Requirements:** SHELL-01 (3-zone header), SHELL-02 (4-domain sidebar regroup).

</domain>

<decisions>
## Implementation Decisions

### Sidebar regroup (SHELL-02)

- **D-01: The 44-item mapping is locked here, in full, and the planner transcribes it.**
  Not derived at plan time, not left to interpretation. The complete table is in
  `<the_44_row_map>` below. Locking it is what gives success criterion 3 ("a route-list diff
  before and after is identical") an exact expected value to assert against instead of a
  judgement call.

- **D-02: GRAPHS (7 items) splits by intent, it does not move as a block.**
  The four **visualisation** surfaces — Graphs Hub, Loom, KG Explorer, Workspace Map — answer
  *"what is happening"* and go to **Observe**. The three **inventory** surfaces — Tool Galaxy,
  MCP Inventory, Capabilities — answer *"what is installed"* and go to **System**. Rejected:
  moving all 7 into Observe, which would put 20 of 44 items (nearly half the sidebar) into one
  domain; and all 7 into System, which buries KG Explorer and Workspace Map — surfaces you
  actually browse — under a maintenance heading.

- **D-03: ACTIVITY (7 items) goes mostly to Agents; Automation goes to System.**
  Briefings, Ideation, Dreaming, War Room, Meeting Bot and WhatsApp are Ástríðr-authored output
  or her channels, so they belong with the agents that produce them; this also grows Agents from
  5 to 11, which it needed. Automation (schedules and crons) is plumbing and goes to System.

- **D-04: System is the health-plus-inventory domain, and Settings does NOT move into it.**
  System = Config, Tools, Infrastructure, Security, Self-Healing, plus D-02's and D-03's
  arrivals. Settings **stays footer-pinned** (`DashboardLayout.tsx:238-262`). Two reasons, and
  both are about not reopening solved work: the sketch's §8 explicitly keeps the footer inside
  the flex column, and POLISH-06 already fixed the 900px Settings/AGENTS collision that the
  footer placement is part of. Moving Settings into the nav would put that geometry back in play
  for a purely semantic gain.

- **D-05: The duplicate `Analytics` label is disambiguated, and the palette claim is measured.**
  `label: "Analytics"` is the only duplicated label in the registry (`uniq -d` over
  `navRegistry.ts` returns exactly one). The regroup makes it visible — `/analytics` lands in
  Observe and `/hr/analytics` in Agents, so two rows would read identically under different
  headings. Rename both (e.g. "Analytics" / "Agent Analytics"); this is a **label** change, so
  SHELL-02's no-route-change rule holds.
  **Rider:** `CommandPalette.tsx:66` renders nav items as `<CommandItem key={to} …>` with **no
  `value` prop**, so cmdk falls back to rendered text content — identical for both items, which
  is the duplicate-value shape that causes double-highlight and an ArrowDown loop. That is a
  reading of the code, **not a measurement**. The plan must **reproduce the behaviour before the
  rename and again after**, so the fix is proven rather than assumed. If the repro shows no
  defect, say so and drop the palette half — do not report a fix for something never observed
  failing.

### Header height and the Phase 120 overflow fix (SHELL-01)

- **D-06: Hard 48px, but GATED ON A MEASUREMENT — not asserted from the spec.**
  Today's header is `min-h-14 flex-wrap gap-y-1` (`DashboardLayout.tsx:551`), deliberately
  changed **from** a fixed `h-14` by POLISH-06 (plan 120-07). That change is control-proven
  load-bearing: at a 900px viewport the three zones' combined min-content width measured
  **981px against 660px available**, and because the header itself carries no `overflow-hidden`
  the excess rendered *past* its box and was silently clipped by a distant ancestor — the
  right-zone controls were unreachable, not merely ugly. `120-GEOMETRY-EVIDENCE.md` holds the
  revert-and-refail control.
  **Therefore:** build the consolidated 3-zone header first, then **re-run that same
  measurement** (combined min-content width of the three zones vs available width) at the
  narrowest supported viewport. Adopt a hard `h-12` **only if it clears with margin**. If it
  does not clear, the wrap stays and the phase says so plainly rather than shipping the spec's
  number over a defect. The consolidation in D-07 is what is expected to make it clear — but
  "expected to" is a hypothesis, and this decision exists to stop it being treated as a result.

- **D-07: The right zone keeps six items; only the settings-shaped controls move into `⋯`.**
  Today it holds ten (eight controls plus two dividers): E-Stop, brain badge, notification bell,
  privacy shield, theme switcher, CRT toggle, ambient audio, user menu
  (`DashboardLayout.tsx:602-618`).
  **Stays visible:** brain badge, system chip, notification bell, E-STOP, `⋯`, user menu.
  **Moves into `⋯`:** theme, privacy, ambient audio, CRT.
  [Amended 2026-08-21, during Phase 124 UI-SPEC verification: "help" struck from the `⋯` list above. No Help control exists anywhere in the app today (`grep -niE "help|circlehelp" src/layouts/DashboardLayout.tsx` returns zero matches); building one is net-new UI outside a presentation-only regroup and is deferred pending its own scoping (what it opens -- a shortcuts sheet, docs, a tour -- is unanswered).]
  Rationale: active brain and unread alerts are live state worth a glance, and the user menu is
  the Settings entry point that D-04 just declined to move into the nav. Rejected: the strict
  sketch reading (chip + E-STOP + `⋯` only), which buries all three one click deep; and folding
  brain and alerts into the system chip, which couples three things that may need to change
  independently.

- **D-08: The "Astridr Runtime Telemetry" pill dies; SYS/LAT relocate rather than disappear.**
  The pill (`DashboardLayout.tsx:563-566`) is kill-list shape twice over — a decorative pulse dot
  and cyan used as wallpaper — and POLISH-01 already banned both patterns, so its survival is an
  oversight this phase corrects, not a new decision. The breadcrumb takes its place. SYS/LAT
  (`:570-585`) are **real data**, so they move (into the `⋯` menu, or onto the Dashboard where
  the instrument cluster lives) rather than being deleted. Deleting real numbers to satisfy a
  layout is not a simplification.

- **D-09: Below `md`, the header is hamburger + E-STOP + `⋯`; the command bar hides.**
  The centred command bar hides below `md` exactly as today's search box does
  (`hidden md:flex`), ⌘K still works, and the command bar is reachable from `⋯`. The hamburger
  replaces the breadcrumb. This mirrors today's breakpoint behaviour deliberately, so the
  existing mobile drawer (`DashboardLayout.tsx:509-520`) and its hamburger keep working
  unchanged. 375px must not clip.

### Live data in the shell: badges and the system chip

- **D-10: Count badges on Inbox and Alerts only.**
  The two that mean *"something is waiting for you"*. Both have real backing
  (`convex/inbox.ts:168 listByProfile`, `convex/alerts.ts:109 countBySeverity`). Rejected: adding
  Tasks and Forge, whose counts are *activity* rather than demands on the operator — and badges
  on everything is how count badges stop meaning anything.

- **D-11: The system chip is composed client-side; no new backend.**
  **There is no health aggregate to read.** `convex/health.ts` exports only `detectStaleSessions`
  and `detectStaleAgents` (both `internalMutation`) plus a `healthCheck` **httpAction** — no
  public query. So Nominal / Attention / Critical is derived on the client from
  `alerts.countBySeverity` plus `useConvex().connectionState()`: critical or error alerts →
  Critical, warnings → Attention, disconnected → its own offline state, otherwise Nominal. This
  reuses the query D-10 already needs and follows 122's D-16 precedent of binding a shell
  indicator to `connectionState()`. Rejected: a new derived Convex query — real backend work in a
  phase scoped as presentation-only.

- **D-12: A badge renders NOTHING until its query resolves, and never a number on failure.**
  `undefined` → render no badge at all; absence correctly reads as "nothing waiting", and the
  badge *appearing* is itself the signal. Query error → a dimmed neutral dot with an accessible
  label. A `0` that actually means "not loaded yet" is precisely the fabricated-confidence defect
  POLISH-04 exists to prevent, and 122's TOKEN-04 six-state law already forbids it elsewhere.

- **D-13: Every shell subscription gets its own boundary AND the unbounded query gets bounded.**
  Both halves are required. Phase 121 established that a `useQuery` throw unmounts the React
  tree; at *page* level that blanks one page, but in the **shell** it blanks the entire app on
  every route. So: each shell-level subscription is wrapped in its own `SectionErrorBoundary`,
  following the precedent already in this file (`<SectionErrorBoundary name="Active Brain">`,
  `DashboardLayout.tsx:606`) — **and** `countBySeverity`'s unbounded `.collect()` over
  unacknowledged alerts is capped or index-bounded in this phase. The boundary stops the
  blanking; bounding stops the timeout that triggers it. Shipping only the boundary means relying
  on the net.

### Sidebar behaviour and the breadcrumb

- **D-14: Per-domain collapse AND the existing rail collapse both survive; the rail wins.**
  Per-domain collapse is the new interaction SHELL-02 requires. The existing whole-sidebar
  collapse to a 48px icon rail (`sidebarCollapsed`, `DashboardLayout.tsx:353-359`/`:489`) stays
  and **overrides** it: at 48px, domain headers render as icon dividers and per-domain state is
  held but not shown, so restoring the rail restores the domain state. Nothing in use today is
  removed.

- **D-15: Domain state persists to `localStorage["codepulse-nav-domains"]`; all four open by default.**
  One key holding four booleans, matching the existing `codepulse-sidebar-collapsed` pattern
  **including its `try`/`catch` fallback** (`:353-359`). All four domains start open so nothing is
  hidden on the first load after the regroup — 44 items across 4 groups is browsable, and hiding
  30+ of them behind a click is hostile to someone who has not yet learned the new grouping.

- **D-16: The breadcrumb is derived from the registry, with a per-route override for detail routes.**
  Default: domain + label read from `navRegistry.ts`, so all 44 mapped routes are free and stay
  correct automatically whenever the map changes. **Six param routes have no registry entry** —
  `/sessions/:id`, `/quality/:profileId`, `/war-room/:roomId`, `/hr/roster/:agentId`,
  `/hr/onboarding/:catalogId`, `/hr/teams/:teamId` — and these supply their own trail via a small
  hook or route handle (e.g. "Agents / Roster / Hildr"). Rejected: every route declaring its own
  breadcrumb, which would maintain the domain name in two places and let them drift — exactly what
  the single-registry design exists to prevent.

- **D-17: The 240px → 232px change is asserted in a test, and the 900px geometry is re-measured.**
  `DashboardLayout.test.tsx:194` currently holds `test.todo("sidebar width is 240px (w-60) when
  expanded")` — an abandoned assertion. Implement it at the new 232px value. Separately, re-run
  POLISH-06's 900px Settings/sidebar geometry check rather than inferring that 8px narrower must
  be safe because a wider sidebar already survived. The inference is probably right; it is still
  an inference, and POLISH-06 is the requirement that would silently regress.

### Claude's Discretion

- **An operator visual checkpoint before close.** Phases 122 and 123 both used one (123's D-18
  surfaced two real defects beyond the question it asked). 124 is the most visual phase of the
  milestone and touches every route's chrome, so the planner should include a blocking operator
  checkpoint by default unless there is a reason not to.
- **How the before/after route-list diff for success criterion 3 is produced.** The requirement
  is that it be identical; the mechanism (a test asserting the sorted `to` set against a frozen
  fixture, a script diffing `navItems` across the change, or both) is the planner's call. It must
  compare the **route set**, not the group structure, since the group structure is precisely what
  changes.
- Within-domain item ordering. D-01 locks *which* domain each item belongs to, not the order
  inside it. Existing deliberate adjacencies documented in `navRegistry.ts` comments — the
  Seiðr Suite grouping of Skills/Galdr/Bifröst/Studio, and Loom's placement — should be preserved
  where the domain assignment allows.

</decisions>

<the_44_row_map>
## The locked mapping (SHELL-02, D-01)

Derived live from `src/lib/navRegistry.ts` on 2026-08-20: 44 items across 5 groups today
(COMMAND 12, GRAPHS 7, AGENTS 5, OBSERVE 13, ACTIVITY 7). Every row below keeps its current
`to` value — **no URL changes**.

| # | Label | Route (`to`) | Today | → Domain |
|---|---|---|---|---|
| 1 | Chat | `/chat` | COMMAND | **Command** |
| 2 | Live Run | `/live-run` | COMMAND | **Command** |
| 3 | Inbox | `/inbox` | COMMAND | **Command** |
| 4 | Tasks | `/tasks` | COMMAND | **Command** |
| 5 | Skills | `/skills` | COMMAND | **Command** |
| 6 | Galdr | `/galdr` | COMMAND | **Command** |
| 7 | Bifröst | `/bifrost` | COMMAND | **Command** |
| 8 | Studio | `/studio` | COMMAND | **Command** |
| 9 | Reminders | `/reminders` | COMMAND | **Command** |
| 10 | Doc Review | `/doc-comments` | COMMAND | **Command** |
| 11 | Forge | `/forge` | COMMAND | **Command** |
| 12 | Dashboard | `/` | OBSERVE | **Observe** |
| 13 | Hive | `/hive` | OBSERVE | **Observe** |
| 14 | Executions | `/executions` | OBSERVE | **Observe** |
| 15 | Build | `/build` | OBSERVE | **Observe** |
| 16 | Analytics *(renamed per D-05)* | `/analytics` | OBSERVE | **Observe** |
| 17 | Alerts | `/alerts` | OBSERVE | **Observe** |
| 18 | Quality | `/quality` | OBSERVE | **Observe** |
| 19 | Memory | `/memory` | OBSERVE | **Observe** |
| 20 | Insights | `/insights` | OBSERVE | **Observe** |
| 21 | Graphs Hub | `/graphs` | GRAPHS | **Observe** |
| 22 | Loom | `/loom` | GRAPHS | **Observe** |
| 23 | KG Explorer | `/knowledge-graph` | GRAPHS | **Observe** |
| 24 | Workspace Map | `/workspace-map` | GRAPHS | **Observe** |
| 25 | Roster | `/hr/roster` | AGENTS | **Agents** |
| 26 | Catalog | `/hr/catalog` | AGENTS | **Agents** |
| 27 | Onboarding | `/hr/onboarding` | AGENTS | **Agents** |
| 28 | Teams | `/hr/teams` | AGENTS | **Agents** |
| 29 | Agent Analytics *(renamed per D-05)* | `/hr/analytics` | AGENTS | **Agents** |
| 30 | Briefings | `/briefings` | ACTIVITY | **Agents** |
| 31 | Ideation | `/ideation` | ACTIVITY | **Agents** |
| 32 | Dreaming | `/dreaming` | ACTIVITY | **Agents** |
| 33 | War Room | `/war-room` | ACTIVITY | **Agents** |
| 34 | Meeting Bot | `/meeting-bot` | ACTIVITY | **Agents** |
| 35 | WhatsApp | `/channels/whatsapp` | ACTIVITY | **Agents** |
| 36 | Config | `/config` | COMMAND | **System** |
| 37 | Tools | `/tools` | OBSERVE | **System** |
| 38 | Infrastructure | `/infrastructure` | OBSERVE | **System** |
| 39 | Security | `/security` | OBSERVE | **System** |
| 40 | Self-Healing | `/self-healing` | OBSERVE | **System** |
| 41 | Tool Galaxy | `/tool-galaxy` | GRAPHS | **System** |
| 42 | MCP Inventory | `/mcp-inventory` | GRAPHS | **System** |
| 43 | Capabilities | `/capabilities` | GRAPHS | **System** |
| 44 | Automation | `/automation` | ACTIVITY | **System** |

**Totals: Command 11 · Observe 13 · Agents 11 · System 9 = 44.**
Settings is deliberately absent from this table — it stays footer-pinned (D-04).

</the_44_row_map>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design law (this is decided, not open)
- `.claude/skills/sketch-findings-codepulse/references/shell-and-dashboard.md` — the validated
  Borealis decisions. **§7** is this phase's header contract (48px, 3 zones, E-STOP min-width
  96px never wrapping, `⋯` contents); **§8** is the sidebar contract (232px, 4 collapsible
  domains, 2px cyan left rail + 6% tint, count badges instead of pulse dots, sentence-case 13px
  items, footer inside the flex column). §6 (quiet badge law) governs the count badges. Its
  "What to Avoid" list is the kill list D-08 applies.
- `.claude/skills/sketch-findings-codepulse/SKILL.md` — the direction summary and the CSS
  patterns, including the active-nav-rail rule this phase implements.
- `.planning/sketches/001-dashboard-quiet-control-room/index.html` — the **working interactive
  mockup** of the winning variant. Open it in a browser; the shell, header zones and E-Stop flow
  all work. It answers layout questions faster than prose.
- `html-out/ui-premium-redesign-comparison.html` — the 3-model proposals and the approved verdict.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — SHELL-01 and SHELL-02 verbatim (lines 51-52).
- `.planning/ROADMAP.md` §"Phase 124: Shell & Information Architecture" — goal, dependencies,
  and the three success criteria. Criterion 3 is the route-diff constraint.

### The evidence D-06 and D-17 rest on — read before touching header or sidebar geometry
- `.planning/phases/120-polish-verified-defects/120-GEOMETRY-EVIDENCE.md` — POLISH-06's
  measurement (981px min-content vs 660px available at 900px) and the revert-and-refail control
  proving the `min-h-14` + `flex-wrap` change is load-bearing. **D-06 exists because of this
  file.**
- `src/layouts/DashboardLayout.tsx:528-551` — the in-code comment recording that measurement.

### Prior-phase decisions this phase inherits
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTEXT.md` — **D-17**
  (`PageHeader` is the PAGE layer, 124 owns APP chrome — the explicit hand-off to this phase),
  **D-16** (binding a shell indicator to `useConvex().connectionState()`, the precedent D-11
  follows), **D-19** (the shared state module), **D-09/D-10** (motion tokens the header and rail
  transitions must use).
- `.planning/phases/123-accessibility-remediation/123-CLOSEOUT.md` — the D-18 operator visual
  checkpoint format, and the record of the nav `placeholder` capability that was removed (so the
  new sidebar must not reintroduce an unmeasured disabled style).

### Code this phase modifies or reads
- `src/lib/navRegistry.ts` — the single source of nav truth (`iconComponents`, `navGroups`,
  `navItems`). SHELL-02 is fundamentally a rewrite of `navGroups` here.
- `src/layouts/DashboardLayout.tsx` — the shell. Header at `:551-620`, desktop sidebar `:489`,
  mobile drawer `:509-520`, footer-pinned Settings `:238-262`, collapse state `:353-359`/`:495`.
- `src/components/CommandPalette.tsx:59-70` — the other `navRegistry` consumer; D-05's rider.
- `src/components/PageHeader.tsx` — **do not modify.** The page layer, per 122 D-17.
- `convex/alerts.ts:109` (`countBySeverity`), `convex/inbox.ts:168` (`listByProfile`),
  `convex/health.ts` (no public query — the finding behind D-11).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `navRegistry.ts` already separates `navGroups` (grouped) from `navItems` (flat, deduped by
  `to`). The flat list is what `CommandPalette` consumes, so a pure regroup of `navGroups`
  leaves the palette's route set untouched by construction — this is most of why criterion 3 is
  achievable.
- `SectionErrorBoundary` is already used inside the header (`:606`), so D-13's per-subscription
  boundary is an existing pattern, not a new one.
- `StatusBadge` (built by 122's D-07) is the quiet-badge primitive; the sidebar count badges
  should read from the same vocabulary rather than hand-rolling a pill.
- `EStopButton.tsx` already satisfies POLISH-02's fixed geometry; §7's `min-width: 96px` should
  be checked against it rather than re-implemented.

### Established patterns
- Shell preferences persist to `localStorage` with a `JSON.parse` inside `try`/`catch` and a
  literal default (`codepulse-sidebar-collapsed`, `codepulse-crt`). D-15 follows it exactly.
- Heavy header children are `lazy()`-loaded with a `Suspense` fallback sized to the control
  (`ThemeSwitcher`, `CommandPalette`) for DEBT-03's entry-chunk budget. Moving controls into a
  `⋯` menu is an opportunity to extend that, not to regress it.
- Theme is a `data-theme` attribute on `<html>`; all colour comes from CSS vars. The 2px cyan
  rail and 6% tint must read `--primary`, never a literal.

### Integration points
- `navGroups` → `DashboardLayout`'s `<nav>` (`:229-236`) and, via `navItems`, → `CommandPalette`.
  Those are the only two consumers; the registry was extracted at Phase 96's WR-02 precisely to
  keep them from importing each other.
- The header sits between the sidebar `<aside>` and `<main>` inside a
  `flex-1 flex flex-col overflow-hidden` column (`:528`) — that ancestor's `overflow-hidden` is
  what silently clipped the overflow POLISH-06 found, so it is load-bearing context for D-06.
- Phase 125's Signal Horizon attaches directly under this header (2px, full shell width). The
  header markup should leave that slot clean rather than absorbing the border into itself.

</code_context>

<specifics>
## Specific Ideas

- The interactive mockup at `.planning/sketches/001-dashboard-quiet-control-room/index.html` is
  the reference implementation of the shell — its `grid-template-columns: 232px 1fr` →
  topbar(48px) → horizon(2px) → scrollable canvas structure is the target layout, and it is
  working code rather than a description.
- The system chip's three words are fixed by the sketch: **Nominal / Attention / Critical**.
  D-11 defines what drives them; the vocabulary itself is not open.
- E-STOP keeps mono type, outline crimson at rest, filled when armed, and never wraps.

</specifics>

<deferred>
## Deferred Ideas

- **The Signal Horizon** (2px aurora line under the header, event packets, crimson on E-Stop arm,
  ~2.6s dawn disarm) is **SIGNAL-01, Phase 125**. 124 builds the header it attaches to and leaves
  the slot clean. Explicitly out of scope here.
- **The Pulse ECG hero** and **Ástríðr's serif voice** — SIGNAL-02 / SIGNAL-03, Phase 125.
- **SYS/LAT's final home.** D-08 decides they relocate rather than die; whether they land in the
  `⋯` menu or on the Dashboard's instrument cluster is deferred to the plan, and the Dashboard
  option may be better sequenced with Phase 125's hero work.

### Reviewed todos (not folded)
- `a11y-02-widened-scan-42-route-backlog.md` — the todo matcher scored it 0.6 against this phase
  on the keywords "route, phase". It is a 96-object / 966-node accessibility backlog across 42
  routes with 7 of 8 rule categories un-triaged, and its own `trigger_when` says it needs a phase
  scoped to accessibility remediation. Not this phase. **However:** a new header and sidebar are
  a11y surface, so 124's own work must not add to that backlog — the criterion routes must stay
  at 0 violations.
- `forge-job-list-column-clips-card-rows.md`, `forge-analytics-visual-polish.md`,
  `forge-loading-div-aria-prohibited-attr.md` — Forge-page-internal, below the chrome layer this
  phase owns.
- `unbounded-analytics-scans-timeout.md` — related in kind to D-13's bounding work but scoped to
  four `.collect()` queries on `/analytics`, not the shell. D-13 bounds only
  `alerts.countBySeverity`, because that one is about to run on every route.
- `vitest-suite-nondeterministic-one-random-failure-per-run.md`,
  `kg-answer-sync-glxy02-test-flake.md` — test-infrastructure flakes, unrelated to chrome.
- `ideationrow-text-white-raw-palette-class.md` — page-level token debt.

**Closed during this discussion, outside the phase:** `forgepage-pageheader-adoption.md` was
still in `pending/` and `REQUIREMENTS.md` still read TOKEN-05 as Partial, but the work shipped in
123-06 (`ForgePage.tsx:154`). Verified against live code and corrected in commit `4f1e386`, kept
deliberately out of 124's scope as bookkeeping.

</deferred>

---

*Phase: 124-shell-information-architecture*
*Context gathered: 2026-08-20*
