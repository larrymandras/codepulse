# Requirements

**Active milestone: v16.0 — "Terminal Zero" Full Stack Close-Out** (Phases 128+, started 2026-08-27 via `/gsd-new-milestone`, scoped from a live code sweep rather than from the filed seed/todo statuses).

Prior milestones (requirements archived in full, extract-don't-delete):

- **v15.0 — "Borealis Console" Premium UI Overhaul** shipped 2026-08-26 → [milestones/v15.0-REQUIREMENTS.md](milestones/v15.0-REQUIREMENTS.md). Phases 120–127, 87 plans, **30/30 Complete**.
- **v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** shipped 2026-08-17 → [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md). Phases 108–119, 86 plans, **15/17 satisfied** (MISSION-01 PARTIAL, MISSION-02 reassigned to SEED-007).
- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md) (14/15).
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## v16.0 requirements

**Goal:** drive CodePulse, Forge and the astridr-side dependencies to zero open items, so the
stack can be handed off or left alone.

**Three repositories.** `codepulse`, `C:\Users\mandr\forge`, `C:\Users\mandr\astridr-repo`.
Requirements are tagged with their owning repo where it is not codepulse.

**How this list was built, because it matters:** every item below was verified against the CODE
on 2026-08-27, not carried from the filed statuses. That sweep found **8 of 18 pending todos and
3 of 7 seeds already shipped** but never reconciled — the same decay v15.0's retrospective named
as its top finding — and it found one defect nobody had filed at all (FIX-01).

### RECON — Planning reconciliation

The already-fixed work whose documentation still reads `pending`. This is bookkeeping against
code, not development.

- [ ] **RECON-01**: Every pending todo that is already fixed in code is moved to `completed/`
      with the `file:line` proving it, or is confirmed still-open with evidence. Eight are known
      already-fixed: `/tool-galaxy` timeout, `/automation` stat cards, `inbox.listHeldUnacked`,
      Forge loading-div ARIA, unbounded analytics scans, plus the three seeds below.
- [ ] **RECON-02**: Seed statuses reflect reality — SEED-005 (shipped v14.0), SEED-006 (shipped
      v15.0) and SEED-007's `submittedAt` half (shipped astridr `e435f71a`) are marked shipped
      rather than dormant.
- [ ] **RECON-03**: The "Carried forward from v14.0" list is dissolved — each of its nine items
      is either a v16.0 requirement below or an explicit, dated out-of-scope entry. No item
      survives as an unowned note.
- [ ] **RECON-04**: A phase cannot be marked Complete while any requirement it maps to still
      reads `Pending`. `requirementsDrift.ratchet.test.ts` already catches that one direction;
      extend it to the `Partial`-cell staleness that the v15.0 audit found in 3 of 4 cells.

### FIX — CodePulse defect sweep

- [ ] **FIX-01**: `/` (Dashboard) no longer reads the whole `events` table. `convex/metrics.ts:19`
      does an unbounded `ctx.db.query("events").collect()`, with an unbounded `discoveredTools`
      read beside it. **Found 2026-08-27; not catchable by `boundedReads.ratchet.test.ts`**, which
      by design flags only a range comparison inside a post-read `.filter()` and never a bare
      `.collect()`. Guard must assert on the RECORDED QUERY, not the returned rows.
- [ ] **FIX-02**: The ratchet gains a signature for FIX-01's shape — an unbounded full-table
      `.collect()` with no index range — or the limitation is recorded with the reason it cannot
      be expressed. A ratchet that silently cannot see a live defect class is worse than none.
- [ ] **FIX-03**: `/inbox` tab counts and the sidebar badge agree. Today the page counts off
      `DEFAULT_LIST_ALL_LIMIT` (200) while the badge scans to `HELD_COUNT_SCAN_CAP` (2000), so
      they render contradictory figures on screen simultaneously. Decide what the tab counts
      should MEAN first, then make the read match.
- [ ] **FIX-04**: `IdeationRow`'s `SEVERITY_CLASSES` uses tokens, not raw `text-white` (3 sites,
      `src/components/IdeationRow.tsx:27-31`).
- [ ] **FIX-05**: The sidebar shows no horizontal scrollbar. `DashboardLayout.tsx:544` sets
      `overflow-y-auto` with no `overflow-x` constraint; a 4px overflow produces a visible bar.
- [ ] **FIX-06**: `/alerts` rules list is readable — rows neither overlap nor bunch their text.
      **Not root-caused**; live DOM measurement precedes any fix.
- [ ] **FIX-07**: Forge's job-list column no longer clips its card header rows
      (`src/pages/ForgePage.tsx:175`).
- [ ] **FIX-08**: Forge selected-row and single-series charts read as designed rather than as
      saturated slabs. May be a charting-library config rather than a token change.
- [ ] **FIX-09**: `e2e/polish-geometry.spec.ts` measures a settled page. It currently measures a
      cold one and undercounts header zone 3 — it passes correctly today, so this is urgent as
      EVIDENCE, not as a test.

### A11Y — Accessibility backlog (continues v15.0's A11Y-01/02)

- [ ] **A11Y-03**: The 42-route violation backlog is triaged to source. 96 objects / 966 nodes
      measured 2026-08-20, with **7 of 8 rule categories carrying no `file:line` triage at all**.
      Sizing the un-triaged categories is task 1; do not plan against the object count.
- [ ] **A11Y-04**: Every triaged violation is either fixed or carries a dated, reasoned exception.
- [ ] **A11Y-05**: The contrast/axe suite cannot pass vacuously — it skips rather than asserting
      when it has not rendered a populated page. (v15.0 closed the Clerk-gate half; this extends
      it to the data-not-yet-resolved half found in Phase 123.)

### PRIV — Privacy markup

- [ ] **PRIV-01**: Every element rendering PII is enumerated. **Nobody has ever made this list**,
      and that absence — not effort — is why the markup half was left open at v15.0. Guessing at
      the set would ship a mechanism that looks complete and is not.
- [ ] **PRIV-02**: Those elements carry `data-sensitive`, so `.privacy-demo` blur and
      `.privacy-screenshot` hide (`src/index.css:649-661`) actually reach them. Today exactly ONE
      element in `src/` carries the attribute.
- [ ] **PRIV-03**: `MIN_CONSUMERS` in `dataSensitiveCoverage.ratchet.test.ts` is raised off 1 to
      the real count, and screenshot mode is verified by rasterising a populated page — not by a
      unit test, since jsdom does not resolve CSS custom properties.

### FLAKE — Test determinism

Four separate filings that are ONE family. Treated as one requirement group deliberately.

- [ ] **FLAKE-01**: A reproduction rate exists for the "~1 random test per full run" failure,
      established by a loop rather than a single re-run. Measurement precedes any fix — the known
      instances (`KnowledgeGraph` `GLXY-02`, `JobsPanel`, `App.test` `/memory` lazy-route hang)
      each failed once and went green on identical code.
- [ ] **FLAKE-02**: The mechanism is named and proven, not inferred. The standing hypothesis —
      immediate-assert-after-`await` with no `waitFor`, which is file-wide in
      `KnowledgeGraph.test.tsx` — is **unproven**, and blind-fixing one assertion would relocate
      the failure with no record of why.
- [ ] **FLAKE-03**: A full suite run is deterministic across 10 consecutive iterations, with the
      sequential `--project unit` then `--project browser` invariant preserved.

### GATE — Process integrity

- [ ] **GATE-01**: `phase-state.json`'s `missing: []` either encodes a real UI-SPEC check or stops
      being presented as a verdict. It currently reads green for EVERY phase regardless, so it is
      not a gate — and a guard that cannot fire is indistinguishable from one never violated.
- [ ] **GATE-02**: The public-repo posture is DECIDED and recorded. `codepulse` is public; nobody
      has ever decided what `.planning/` and `CLAUDE.md` should contain. No secrets are exposed,
      so this is a standing decision, not an incident. Sanitizing 272 files is explicitly NOT the
      presumed outcome.
- [ ] **GATE-03**: A disclosure scan runs as the LAST step before any push, with a control string
      that must return non-zero so a probe matching nothing is caught.

### FORGE — Forge v4.0 completion *(repo: `C:\Users\mandr\forge`)*

**Gates COCKPIT-01..04.** Verified 2026-08-27: `forge/.planning/STATE.md` reads
`status: executing`; Phase 21 has 9 plans and 1 summary; Phases 22–26 have no directories.

- [ ] **FORGE-01**: Phase 21 (Foundation — Session Lifecycle & Resume) completes — 8 remaining plans.
- [ ] **FORGE-02**: Phase 22 (Worktree-per-Session) ships.
- [ ] **FORGE-03**: Phase 23 (WS Attach + Stdin Write) ships.
- [ ] **FORGE-04**: Phase 24 (Permission-Relay Research Spike) resolves the relay design.
- [ ] **FORGE-05**: Phase 25 (Session UI) ships.
- [ ] **FORGE-06**: Phase 26 (Permission Relay Implementation) ships — NDJSON → daemon → Convex.
      **This is the dependency SEED-004's Inbox consumes**; nothing in COCKPIT can start before it.

### XREPO — astridr cross-repo *(repo: `C:\Users\mandr\astridr-repo`)*

- [ ] **XREPO-01**: A sub-agent's trace id reaches the terminal emit envelope, plumbed out through
      the `_dispatch` boundary (`delegate_task.py:398`). **Gates BOARD-02.** The contextvar at
      `agent/loop.py:1028` is set inside the sub-agent's own task and reset in a `finally` at
      `:1033`, so it is structurally unreadable from the parent — this is plumbing across the
      sub-agent result type, not a field addition.
- [ ] **XREPO-02**: The deployed `feature/brain-swap` branch no longer carries the retired
      `tidy-whale-981` host as an unconditional CORS origin. `main` already has the correct
      conditional form; port it. A decommissioned Convex subdomain can be re-allocated.
- [ ] **XREPO-03**: MISSION-01 closes — a real background job produces a `subagentJobs` row with
      `finishedAt > submittedAt`. Both halves are already built; this awaits a live row and an
      operator rebuild. **Do not tick it early** — tooling auto-ticked it twice and it was
      reverted twice. The `mission-01-watch` cron notifies but deliberately does not mutate status.

### COST — Cache-aware cost pricing (SEED-003, continues v13.0's COST-01..03)

- [ ] **COST-04**: Cost surfaces distinguish cache-write, cache-read and uncached input tokens at
      their real distinct rates.
- [ ] **COST-05**: A CodePulse cost figure reconciles against a real provider invoice to a stated
      tolerance. Today the surfaces are trustworthy as relative trends only; the error is
      directionally consistent, which is why this was never urgent.
- [ ] **COST-06**: Budget thresholds and alerts are tuned against absolute dollars, now that
      COST-04/05 make that meaningful.

### BOARD — Mission Control jobs board (SEED-002)

- [ ] **BOARD-01**: `/missions` renders live per-mission cards streaming tool/note/result events,
      with per-mission cost, duration and status. Orphan recovery already surfaces honestly as
      FAILED (astridr `_boot_sweep`), and that behaviour is preserved.
- [ ] **BOARD-02**: Tool activity is humanized per mission ("reading Gmail…", "Write index.html").
      **Blocked on XREPO-01** — this is MISSION-02, and the v14.0 note that no job↔tool join key
      exists was correct. A join key existing on ONE side of a join is not a join key.
- [ ] **BOARD-03**: Missions with gated steps surface awaiting-confirm cards that resolve through
      the EXISTING HITL approval-block contract — reuse, do not fork.

### COCKPIT — Project Lifecycle Cockpit (SEED-004)

**COCKPIT-01, -02 and -04 are blocked on FORGE-06.** COCKPIT-03 and -05 are not.

- [ ] **COCKPIT-01**: One unified Inbox surfaces permission prompts, AskUserQuestion gates and UAT
      questions across all Forge sessions, with a composer to start and steer them. *This is the
      zero-terminal threshold.* **Blocked on FORGE-06.**
- [ ] **COCKPIT-02**: A "New Project" wizard bootstraps a project (mkdir, git init, `gh repo
      create`, scaffold, graphify, vault note) and chains into a relayed `/gsd-new-project`
      session whose Q&A lands in the Inbox. **Blocked on COCKPIT-01.**
- [ ] **COCKPIT-03**: A Projects view manages the lifecycle — card grid, Active/Archived/Scrapped
      tiers, search and sort, with per-card vault summary, phase progress, last git activity, disk
      footprint and staleness. **Buildable now**; dispatches existing Forge jobs.
- [ ] **COCKPIT-04**: Ship gates deploy with approval — build → preview URL to Inbox → approve →
      promote. **No un-gated production deploys.** Blocked on COCKPIT-01.
- [ ] **COCKPIT-05**: CodePulse is usable as a cockpit over the tailnet, with a mobile-usable
      Inbox. Phone = full cockpit; Telegram stays alerts-only. **Partially buildable now** — the
      tailnet serving half is independent of COCKPIT-01.
- [ ] **COCKPIT-06**: Destructive lifecycle actions refuse rather than guess. Unpushed commits,
      uncommitted changes or an untracked-secrets hit BLOCK archive/scrap; Purge requires typed
      confirmation and is the only true destroy.

---

## Carried forward from v14.0 — DISSOLVED into v16.0 (2026-08-27)

The nine-item list is retired as a standing section, per RECON-03. Its full audited text with
evidence remains in git history (`.planning/REQUIREMENTS.md` at `9ea8e4df`). Disposition:

| # | Item | Disposition |
|---|------|-------------|
| 1 | MISSION-01 duration + orphan recovery | → **XREPO-03** (built; awaits a live row) |
| 2 | MISSION-02 humanized tool activity | → **BOARD-02**, unblocked by **XREPO-01** |
| 3 | `message_routed` routed but unsurfaced | ✅ **DONE 2026-08-27** (`55ec9001`) — `channelSummary` aggregate + `MessageRoutingSummary.tsx` |
| 4 | `links` retention + unbounded read | ✅ Closed before v16.0 — `bifrost.ts:85` bounded; `links` in `COVERAGE_KEEP_FOREVER` |
| 5 | `llm-analytics-rollup` CR-01 | ✅ Absorbed as v15.0 DEBT-08 |
| 6 | `detectCredentialValue` rule C | ✅ Accepted decision, not open work |
| 7 | Nyquist coverage (117/119) | ✅ Closed 2026-08-26/27 — VALIDATION docs written, Loom coverage landed (`7a782bfa`) |
| 8 | DEBT-06 | ✅ Closed GUARDED — 80 clean soak iterations, cause never identified, disposition recorded |
| 9 | astridr CORS on deployed branch | → **XREPO-02** |

---

## Out of scope for v16.0

- **Rewriting git history to purge the operator's Telegram chat id.** The value remains in
  history including one commit message; removing it breaks every existing clone. Trade considered
  and declined 2026-08-27. Working-tree instances were redacted in `e7f10e3f`.
- **Making Clerk fail-closed app-wide.** Explicitly REJECTED at SEED-008 as disproportionate —
  it is optional by design and the Playwright suite depends on `dev:noauth`. The tailnet is the
  auth boundary; enforcement is the LAN firewall block, which is machine state. Reopen only if
  the backend becomes reachable beyond the tailnet, or the tailnet gains a non-Larry device.
- **Gating only the ~18 destructive mutations.** Also rejected at SEED-008 — breaks the same
  paths, leaves 197 ungated, and reads as an unfinished migration.
- **Sanitizing all 272 `.planning/` files.** Not recommended without a reason better than
  tidiness; GATE-02 decides the posture first.
- **`loom-emit`'s 10s AbortController timeout path.** `TIMEOUT_MS` is a module constant with no
  injection point; exercising it costs a real 10s wait per run.

---

## Traceability

Every v16.0 requirement maps to exactly one phase. 46/46 mapped, zero orphans.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RECON-01 | Phase 128 | Pending |
| RECON-02 | Phase 128 | Pending |
| RECON-03 | Phase 128 | Pending |
| RECON-04 | Phase 128 | Pending |
| FIX-01 | Phase 129 | Pending |
| FIX-02 | Phase 129 | Pending |
| FIX-03 | Phase 130 | Pending |
| FIX-04 | Phase 131 | Pending |
| FIX-05 | Phase 131 | Pending |
| FIX-06 | Phase 131 | Pending |
| FIX-07 | Phase 131 | Pending |
| FIX-08 | Phase 131 | Pending |
| FIX-09 | Phase 132 | Pending |
| A11Y-03 | Phase 133 | Pending |
| A11Y-04 | Phase 134 | Pending |
| A11Y-05 | Phase 134 | Pending |
| PRIV-01 | Phase 135 | Pending |
| PRIV-02 | Phase 135 | Pending |
| PRIV-03 | Phase 135 | Pending |
| FLAKE-01 | Phase 136 | Pending |
| FLAKE-02 | Phase 136 | Pending |
| FLAKE-03 | Phase 137 | Pending |
| GATE-01 | Phase 138 | Pending |
| GATE-02 | Phase 138 | Pending |
| GATE-03 | Phase 138 | Pending |
| COST-04 | Phase 139 | Pending |
| COST-05 | Phase 139 | Pending |
| COST-06 | Phase 139 | Pending |
| COCKPIT-03 | Phase 140 | Pending |
| COCKPIT-06 | Phase 141 | Pending |
| COCKPIT-05 | Phase 142 | Pending |
| XREPO-01 | Phase 143 | Pending |
| XREPO-02 | Phase 144 | Pending |
| XREPO-03 | Phase 145 | Pending |
| BOARD-01 | Phase 146 | Pending |
| BOARD-02 | Phase 147 | Pending |
| BOARD-03 | Phase 148 | Pending |
| FORGE-01 | Phase 149 | Pending |
| FORGE-02 | Phase 150 | Pending |
| FORGE-03 | Phase 151 | Pending |
| FORGE-04 | Phase 152 | Pending |
| FORGE-05 | Phase 153 | Pending |
| FORGE-06 | Phase 154 | Pending |
| COCKPIT-01 | Phase 155 | Pending |
| COCKPIT-02 | Phase 156 | Pending |
| COCKPIT-04 | Phase 157 | Pending |
