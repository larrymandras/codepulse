# Phase 128: Planning Reconciliation - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Every planning artifact — pending todos, seed files, the carried-forward list, and the
phase-close discipline that is supposed to keep them honest — reflects the ACTUAL CODE rather
than the status somebody filed months ago.

This phase writes almost no product code. Its one code deliverable is an extension to
`src/requirementsDrift.ratchet.test.ts`. Everything else is re-derivation against the
repository, recorded with evidence.

**Why it is first:** every other v16.0 phase reports its status into these artifacts. If the
artifacts lie, all 29 later phases inherit the lie. The v15.0 close proved the failure is real
and silent — 8 requirements read `Pending` on shipped phases, 3 of 4 `Partial` cells were stale
notes, and 6 of 9 carried-forward items were wrong.

**Not in scope:** fixing any defect a todo describes. Phase 128 establishes whether a todo is
open, never closes it by fixing it. The fixes belong to Phases 129-148.

</domain>

<decisions>
## Implementation Decisions

### RECON-04 — how to catch a stale `Partial` without forcing Partials green

- **D-01: Freshness stamp, not correctness judgement.** Each `Partial` cell carries a
  re-derivation stamp (date or commit SHA). The ratchet FAILS when that stamp predates the
  completion commit of the phase the requirement maps to. It detects STALENESS and never judges
  whether `Partial` is the right disposition.

- **D-02: This resolves a real conflict, and the conflict must be recorded, not papered over.**
  `src/requirementsDrift.ratchet.test.ts:25-29` explicitly refuses to police `Partial`:

  > *"WHAT IT DELIBERATELY DOES NOT DO: it does not police `Partial`. A Partial with a recorded
  > reason is a legitimate, deliberate disposition (POLISH-04, SIGNAL-01 and JANITOR-02 all
  > were). Forcing those green is the `phase.complete` false-green failure mode in a different
  > costume. Only `Pending`-on-Complete is unambiguous."*

  That argument is CORRECT and is not being overruled. RECON-04 was written without having read
  it. D-01 threads the needle: the existing objection is to forcing a Partial toward Complete;
  a freshness check never asks whether the cell should be Complete, only whether anyone has
  re-derived it since the phase shipped. **The planner must update that comment block in the
  same change** so the file's stated rationale and its behaviour do not diverge — a file whose
  header says it does not do X while doing X is the next session's trap.

- **D-03: Mutation-proof both directions.** Criterion 4 already demands a mutation that turns
  the test red. Pair it with the opposite control: a Partial WITH a fresh stamp must stay green.
  A guard that only ever goes red on command has not been shown to discriminate.

### Scope — the reconciliation already performed during v16.0 scoping

- **D-04: Re-verify independently; do not inherit.** During scoping (commits `89def342`,
  `02e6557e`) the orchestrator dissolved the carried-forward list and tagged all 18 todos with
  `resolves_phase`. Phase 128 RE-DERIVES those claims against the code rather than accepting
  them. Taking the orchestrator's word reproduces precisely the failure this phase exists to
  fix — inherited status that nobody re-checked. The eight "already fixed" claims are the
  load-bearing ones: todos get CLOSED on them.

- **D-05: A re-derivation that disagrees with the scoping claim is a FINDING, not an error to
  quietly correct.** Record the disagreement and its evidence. The orchestrator's sweep was
  fast and single-pass; it is a claim like any other.

### Evidence bar for todos

- **D-06: Same bar to keep a todo open as to close one — `file:line` in live code.** A todo
  staying in `pending/` must cite the code proving the defect is still present. A todo moving
  to `completed/` must cite the code proving it is fixed.

- **D-07: Where a defect is not statically verifiable, say so explicitly.** Visual and timing
  defects (alert-rules row overlap, Forge/Analytics saturated slabs, the flake family) cannot
  be settled by reading code. Those record `requires live measurement — deferred to Phase NNN`
  naming the owning phase. An honest recorded gap, never a silent pass. Do NOT invent a
  static proxy for a visual defect.

### Seed status vocabulary

- **D-08: Introduce `status: absorbed`.** A seed whose content became scoped v16.0 requirements
  reads `absorbed`, with an `absorbed_by:` field naming the requirement IDs. This is distinct
  from both `shipped` (built) and `dormant` (still an unscoped idea), so
  `/gsd-new-milestone`'s seed scan stops re-proposing work that is already on a roadmap.

- **D-09: Mapping, to be re-verified per D-04, not applied on trust:**

  | Seed | Status | Rationale to verify |
  |------|--------|---------------------|
  | SEED-002 Mission Control board | `absorbed` → BOARD-01..03 | |
  | SEED-003 Cache-aware cost | `absorbed` → COST-04..06 | |
  | SEED-004 Lifecycle Cockpit | `absorbed` → COCKPIT-01..06 | |
  | SEED-005 Seiðr Suite | `shipped` | v14.0 Phases 116-119 |
  | SEED-006 WCAG-AA contrast | `shipped` | v15.0 A11Y group |
  | SEED-007 Mission emitter | `shipped` (repair half) + `absorbed_by` BOARD-01/02 | astridr `e435f71a` |
  | SEED-009 App.test lazy route | stays `dormant` | its trigger ("a SECOND occurrence") has still not fired — today's flake is a DIFFERENT test |

  Note SEED-007 is the one needing both fields: one half built, one half scoped.

### Claude's Discretion

- Plan decomposition and wave structure.
- The exact stamp format for D-01 (date vs SHA), provided the ratchet can compare it against
  the phase's completion commit.
- Whether the seed frontmatter change is one plan or folded into the todo sweep.

### Folded Todos

Four todos carry `resolves_phase: 128`, all because they are ALREADY FIXED and what remains is
closing them with evidence (each to be re-verified per D-04):

- `tool-galaxy-getprojectgraph-timeout.md` — `convex/graphSnapshots.ts` chunked blob,
  `GRAPH_CHUNK_READ_CAP = 16`
- `automation-page-placeholder-cards-and-invalid-expression.md` — `convex/automation.ts:147`
  `cronSummary` now index-bounded
- `inbox-listheldunacked-unbounded-every-route.md` — bounded badge count,
  `HELD_COUNT_SCAN_CAP = 2000` at `convex/inbox.ts:278`
- `forge-loading-div-aria-prohibited-attr.md` — `role="status" aria-busy` at
  `src/components/forge/ForgeJobList.tsx:172-175`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The artifact this phase changes
- `src/requirementsDrift.ratchet.test.ts` — the drift ratchet. Read the header comment
  (lines 1-29) BEFORE touching it; it records why `Partial` is deliberately unpoliced, and
  D-01/D-02 depend on understanding that argument rather than overriding it. Note the orphan
  hole already described at `:129`.

### Status sources being reconciled
- `.planning/REQUIREMENTS.md` — the 46 v16.0 requirements, the dissolved carried-forward
  mapping table, and the Traceability table the ratchet parses.
- `.planning/ROADMAP.md` — Phase 128 detail and the per-milestone Progress tables. The ratchet
  parses phase status from these; note each milestone section carries its OWN table and the
  Milestone column is load-bearing.
- `.planning/todos/pending/` (18 files) and `.planning/todos/completed/` (12 files).
- `.planning/seeds/SEED-00{1..9}-*.md` — 9 seeds.

### Evidence for the already-fixed claims (to re-derive, not trust)
- `convex/graphSnapshots.ts`, `convex/automation.ts`, `convex/inbox.ts`,
  `convex/analytics.ts`, `src/components/forge/ForgeJobList.tsx`

### Governing rules
- `CLAUDE.md` "Convex & Frontend Lessons" — especially the `grep -c` counting trap: an
  exact/zero-count acceptance criterion is satisfiable by REWORDING A COMMENT, and three
  Phase 127 executors each did exactly that. Assert on constructs, and pair any count with a
  control that must be non-zero.
- `.planning/HANDOFF-post-v15.0.md` — accurate for the five items it lists; carries file:line
  evidence for each.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/requirementsDrift.ratchet.test.ts` already has the parsing machinery D-01 needs:
  `REQ_ROW` (`:39`) reads `| ID | Phase N | Status`, `PHASE_ROW` (`:42`) reads the ROADMAP
  Progress rows, and `collectRequirements()` / `collectPhaseStatus()` (`:68`, `:79`) build both
  sides. The freshness check is a third comparison over data already collected, not a new
  parser.
- `requirementFiles()` (`:44`) already resolves requirement files across the live and archived
  locations — relevant because a milestone close MOVES phase dirs, which has broken
  path-hardcoding tests before (`tokenSweep.ratchet.test.ts`).

### Established Patterns
- Ratchets in this repo pin known violations in an allowlist with a per-entry reason and assert
  the allowlist does not OVER-claim (`convex/boundedReads.ratchet.test.ts:152` — an entry for a
  file that no longer violates is stale and fails). Mirror that shape if D-01 needs to
  grandfather existing Partials.
- Guards assert on the RECORDED value, never on a value that would look identical either way.

### Integration Points
- `npm test` runs this file on every run and in CI, so a too-strict D-01 blocks all 29 later
  phases. Grandfathering existing Partials is likely required; decide it deliberately and
  record it.
- The traceability table is currently 46 rows all reading `Pending` with zero `Partial` cells,
  so D-01 has NO live positive case yet. Its must-pass control has to be constructed, and the
  test must be shown to go red on a genuine stale Partial rather than merely passing vacuously
  against a table containing none.

</code_context>

<specifics>
## Specific Ideas

- The operator's framing for the whole milestone is "everything remaining, so I can move onto
  the next phase/build". Phase 128 serves that by making "what is remaining" a question the
  repository can answer truthfully — the scoping sweep found 8 of 18 todos and 3 of 7 seeds
  already shipped but still filed as open.
- Orchestration for v16.0: lane agents build, the ORCHESTRATOR alone commits and owns STATE.md.
  Plans for this phase should not instruct an executor to write STATE.md.

</specifics>

<deferred>
## Deferred Ideas

- **Fixing any defect a todo describes.** Phase 128 establishes open-vs-closed only. The fixes
  are Phases 129-148, and each still-open todo already carries `resolves_phase` naming its owner.
- **The orphan-requirement hole** described at `requirementsDrift.ratchet.test.ts:129` — a
  requirement mapped to a phase absent from ROADMAP escapes the Pending-on-Complete check. Real,
  already recorded in-file, and NOT this phase's scope unless the D-01 work touches that code
  path anyway. Considered and deliberately left.
- **Deciding the public-repo posture** — GATE-02, Phase 138.
- **`phase-state.json`'s `missing: []` carrying no signal** — GATE-01, Phase 138. Related to
  this phase's theme (a gate that cannot fire), but a different artifact.

### Reviewed Todos (not folded)

`gsd-sdk query todo.match-phase 128` returned every todo at score 0.6 on the keywords
"todo, status, pending, phase" — words that appear in every todo file by construction. For a
phase whose subject IS todos, that matcher carries no signal and its output was not used.
Scope-based mapping (committed `02e6557e`) is authoritative: the 4 todos above fold in; the
other 14 are reviewed and stay in `pending/`, each requiring D-06 evidence and each already
tagged with the phase that owns its fix.

</deferred>

---

*Phase: 128-planning-reconciliation*
*Context gathered: 2026-08-27*
