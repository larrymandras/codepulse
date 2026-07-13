# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v4.0 — CodePulse Operational Excellence

**Shipped:** 2026-04-14
**Phases:** 8 | **Plans:** 37 | **Timeline:** 39 days

### What Was Built
- Paperclip design language across 15 dashboard pages (shadcn/ui New York, oklch, zero border-radius)
- Bidirectional WebSocket telemetry with Ástríðr (real-time push + command sending)
- Command center UI: Unified Inbox, Command Palette (Cmd+K), Agent Chat with Generative UI Blocks, Live Run with Flow DAG, Insights Chat
- Task management: 6-column Kanban, Ideation Findings, Config Editor, Cron visual builder
- Data pipeline: time-series aggregation, retention policies, cursor-based pagination across 7 domains
- Alert routing: configurable rules (static + compound), Discord/Slack webhooks, full lifecycle management
- Intelligence layer: cost forecasting, LLM session briefings, z-score anomaly detection, memory quality metrics
- Command catalog: live WebSocket-driven registry on Capabilities page

### What Worked
- Wave-based parallel execution with worktrees — multiple plans executing simultaneously saved significant time
- Phase verification with automated must-have truth tables caught real issues before they compounded
- Human UAT as a formal step ensured visual/interaction quality that automated tests can't verify
- Phase-scoped code review caught warnings early (null guards, unsafe casts) before they became bugs
- Cross-repo phase design (Ástríðr infra phases as prerequisites) kept dependencies explicit

### What Was Inefficient
- REQUIREMENTS.md traceability table was never updated during phase execution — all 26 requirements showed as "Pending" even though phases verified them. The checkbox/status updates should happen at phase completion, not just in VERIFICATION.md
- Phase-to-requirement mapping in REQUIREMENTS.md was wrong (DP mapped to Phase 3 instead of Phase 5, ALR to Phase 4 instead of Phase 6). Initial roadmap creation didn't align requirement IDs with actual phase scope
- INFRA-01 through INFRA-05 were referenced in ROADMAP but never defined in REQUIREMENTS.md — orphaned requirement IDs across repos
- Some SUMMARY.md one-liner fields were empty or contained raw task descriptions instead of proper one-liners, making automated accomplishment extraction unreliable

### Patterns Established
- MetricCard + EntityRow as universal UI patterns — every data surface uses the same components
- SectionErrorBoundary for widget-level error isolation — prevents one broken widget from taking down a page
- Convex .paginate() with cursor-based LoadMoreButton as the standard pagination pattern
- Phase VERIFICATION.md with must-have truth tables as the quality gate pattern
- WebSocket event subscription pattern via useAstridrWS() context hook

### Key Lessons
1. **Update requirements traceability at phase completion, not just at milestone end.** Stale checkboxes create false anxiety about readiness.
2. **Map requirements to phases after phase scope is finalized, not during initial roadmap creation.** Phase names don't always match requirement categories.
3. **SUMMARY.md one-liner fields need enforcement.** Empty or malformed one-liners break automated milestone summarization.
4. **Test files should cover the golden path AND edge cases before marking phase complete.** The pre-existing Inbox keyboard nav test failure persisted across multiple phases because it wasn't in any phase's scope.

### Cost Observations
- Model mix: primarily Sonnet for execution, Opus for orchestration and verification
- Worktree parallelism: most waves ran 2-4 agents simultaneously
- Notable: 1M+ context window models (Opus 4.6) enabled richer subagent prompts with cross-phase awareness

---

## Milestone: v5.0 — Advanced Visualization & Integrations

**Shipped:** 2026-05-25
**Phases:** 12 (59–70) | **Plans:** 23 | **Timeline:** 10 days
**Volume:** 267 commits, 668 files changed (+76,219 / −3,401). Project total ~66,600 LOC, 50+ Convex tables, 15 dashboard pages. 10/10 requirements complete.

### What Was Built
- Multi-provider gateway observability across 7 providers (quota, routing, comparison views)
- Cost intelligence: `billingType` modeling and an SDK spend guard
- External integrations: email digest delivery (Resend), PagerDuty Events API v2, GitHub Actions workflow dispatch
- Advanced visualizations: context-window growth/shrink animation, per-agent/per-tool token sunburst, call-graph rendering with dagre
- v5.0 schema foundation (Phase 59): callGraphEdges, emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog; llmMetrics extended with agentId/by_agent index
- Operations page (Rubric-inspired): agent heartbeat grid, cron calendar, React Flow pipeline diagram

### What Worked
- Cross-repo telemetry contract held up — Ástríðr emitters and CodePulse ingest stayed in sync as both sides added event types
- Schema-foundation-first phase (59) established all new tables/indexes before feature phases consumed them, avoiding mid-stream migrations
- Phase-scoped code review continued to catch real bugs pre-merge (cross-session edge collision, backfill infinite loop)

### What Was Inefficient
- **Milestone bookkeeping ran out of context.** The wrap-up session hit context exhaustion at 76% (2026-05-25), leaving `STATE.md` uncommitted and this retrospective unwritten for ~10 days, plus a partial branch/worktree mess. Bookkeeping (STATE reset, retrospective, tag, branch cleanup) should be a discrete low-context step, not the tail of an exhausted feature session.
- **Silent "No data" widgets.** A systematic audit found 7 dashboard widgets permanently empty due to broken data paths (missing write paths, table mismatches, wrong event filters) — none caught by build/type checks because the pipelines compiled fine. End-to-end data-path verification per widget is required, not just "build passes."
- **Recurring httpAction↔Clerk auth friction.** Multiple fixes (`internalMutation` for httpAction-invoked mutations; ingest `requireAuth` removal) addressed the same root pattern across the milestone.

### Patterns Established
- `internalMutation` for any mutation called from an httpAction (httpActions lack Clerk identity) — public `mutation` only for client-facing calls
- Schema-foundation phase precedes feature phases within a milestone
- `null`→`undefined` sanitizer at every ingest boundary (Convex `v.optional()` rejects `null`)
- dagre for call-graph layout; force/animation viz isolated behind `SectionErrorBoundary`

### Key Lessons
1. **Do milestone bookkeeping as a discrete, early step.** Don't let STATE reset / retrospective / tagging / branch cleanup fall off the end of a context-exhausted session — it cost ~10 days of stale state here.
2. **Verify every telemetry widget's full data path, not just compilation.** A passing build with green types still shipped 7 silently-empty widgets.
3. **Codify the httpAction auth boundary once.** The `internalMutation`-from-httpAction pattern recurred enough to be a standing rule, not a per-incident fix.

### Cost Observations
- Heaviest spend was in cross-repo integration debugging (telemetry pipeline audits), not feature implementation
- External-integration phases (PagerDuty, GitHub Actions, Resend) were cheap to build but required live-credential verification outside the test suite

---

## Milestone: v9.0 — Readability & Experience

**Shipped:** 2026-06-29
**Phases:** 5 (88-92) | **Plans:** 30 | **Timeline:** 7 days (222 commits, +33,655 / −3,495)

> *(v7.0 and v8.0 milestone retrospectives were not recorded at their closes; this section resumes the living retrospective at v9.0.)*

### What Was Built
- **Analytics Rollup (88):** ingest-time rollups (`analyticsRollup.ts` + shared `lib/sankeyClassify.ts`), idempotent dedup, prod historical backfill, all `.take()` caps removed — analytics now O(buckets), permanently under Convex 16 MiB/exec.
- **Readable Themes (89):** fully token-driven theming (~77 hex sites → `var(--token)`, canvas via `useThemeColors()`), WCAG-AA readable theme, Midnight Aubergine editorial skin, no-flash persisted switcher honoring `prefers-reduced-motion`, axe-clean across 4 themes × 5 surfaces.
- **Agent/War Room (90):** real roster identity, bounded listing, genuine operator LiveKit Join, per-room deep-links + `seq`-ordered transcripts.
- **3D Memory Galaxy (91):** opt-in lazy `react-force-graph-3d` mode on `CodeVaultGraph`, ~4,038 nodes ≥30 FPS, clean WebGL disposal, theme-aware.
- **Voice Command Palette (92):** local openWakeWord ONNX wake-word, Web Speech STT, streamed reply + persona TTS, safe-by-default OFF toggle.

### What Worked
- **Atomic-deploy discipline on Convex rollups (88):** landing dedup + ingest-time increments + cron branch removal in one wave avoided a double-count transition window (Pitfall 1) — co-locating the change was the only safe path under per-deploy atomicity.
- **Token-first theming (89):** routing canvas graphs through a single `useThemeColors()` resolver (module-level, MutationObserver-reactive) made theme-awareness fall out for free downstream — Phase 91's 3D node colors reused it with zero new work.
- **Lazy-chunk isolation as a verified gate (91):** a build-manifest chunk check (SC#2) proved three.js never enters the 2D bundle — a machine-checkable contract, not a hope.

### What Was Inefficient
- **Cross-repo gate declared but not closed before execution (90):** the "confirm `POST /api/war-room` ingest + `warRooms` population" gate was flagged at scoping but skipped; the feature was GREEN in `convex-test`/jsdom yet had never run end-to-end live. Running it surfaced **five layered integration gaps** (LiveKit profile/workers down, Convex fns committed-not-deployed, astridr never POSTing to ingest, transcripts never streamed, two CodePulse bugs) — all fixable, but caught 2-3 days late.
- **Stale milestone audit blocked the clean narrative (meta):** the 2026-06-26 audit ran mid-flight (`gaps_found`, 90/91 unbuilt) and was never refreshed after they shipped, so close-out had to reconcile audit-vs-reality by hand.
- **Verification-artifact inconsistency:** Phases 88 & 90 shipped without a formal `VERIFICATION.md` (relied on Nyquist VALIDATION + operator sign-off); 89 & 92 verification flags stayed `human_needed` after sign-off.

### Patterns Established
- **"Live-integration gate" must be an executed checklist, not a scoping note** — for any cross-repo feature, run the create→ingest→render path against the live stack *before* declaring build plans done.
- **RED-scaffold pattern for not-yet-built Convex modules** — `@vite-ignore` dynamic import + loose local type lets dependent tests RED cleanly without breaking Vite transform or `tsc`.
- **Operator manual-gate sign-off** for perceptual/GPU criteria axe/jsdom can't assert (canvas legibility, ≥30 FPS, WebGL no-leak, two-way audio) — documented in VALIDATION, signed off by date.

### Key Lessons
- A feature that is "all tests green" but has **never run live** is not done — `convex-test`/jsdom cannot catch a stopped Docker profile, an undeployed function, or a missing cross-repo emitter.
- **Refresh the milestone audit at close** if phases shipped after it ran — a stale `gaps_found` audit costs a manual reconciliation and muddies the archived record.
- **Keep one verification artifact shape per phase** — mixing VERIFICATION.md, VALIDATION.md, and operator sign-offs makes the close-out audit ambiguous about what's actually been checked.

### Cost Observations
- Heaviest spend was again cross-repo **live**-integration debugging (Phase 90's five gaps), not feature code — mirrors the v5.0 observation.
- 3D (91) and voice (92) were bounded, single-surface phases that closed fast once their lazy-load / worker-pipeline architecture was fixed up front.

---

## Milestone: v10.0 — Eval & Trace Observability + Hardening

**Shipped:** 2026-07-07
**Phases:** 3 (93-95) | **Plans:** 15 | **Timeline:** 2026-07-05 → 2026-07-07

### What Was Built
- Eval pipeline (Phase 93): `evalScores` table + idempotent `task_quality` ingest + Ástríðr mirror, nightly 4-dimension LLM-as-judge `internalAction`, per-persona quality KPI grid + window-mean regression detection
- Native trace waterfall (Phase 94): `traceId` grouping on `llmMetrics` threaded from an Ástríðr per-turn contextvar through all 3 providers → Gantt `TraceWaterfall` on SessionDetail, replacing the dead `LangfuseTraceLink`
- Hardening (Phase 95): TS 6.0.3 green (one tsconfig fix) + react-day-picker deleted + 4 folded majors verified; Forge/Ástríðr ingest keys verified via live round-trip (no rotation); `/cso` audit SHIP with 4 LOW findings all remediated

### What Worked
- **Live verification caught what tests couldn't.** Phase 93 fixed "FIVE production gaps no test suite had caught," found only by running the real cross-repo path. Same in 95 — the Forge round-trip surfaced a checklist host bug + a daemon startup crash that green CI never would.
- **Fail-closed-by-symmetry.** The `/cso` headline finding was fixed by making `validateIngestAuth` mirror the already-correct fail-closed Forge path — a known-good local pattern beat inventing a new one.
- **Zero-false-positive audit bar held.** `/cso` produced 4 confirmed findings + 4 explicitly-dropped candidates with rationale; no cry-wolf triage churn.

### What Was Inefficient
- **A "verification" task ballooned into cross-repo debugging.** HARD-02 was scoped verify-not-rotate, but an honest close required finding an unlisted Forge daemon repo, fixing a SQLite-migration FK crash, and a `.cloud`/`.site` config trap. Real work hid behind a checkbox.
- **Watched the wrong tables first.** Initially queried `jobs`/`workspaces` (the daemon's *local* SQLite names) instead of the Convex `forgeJobs`/`forgeWorkspaces` — led to a wrong "Forge never worked" read before the schema check corrected it.

### Patterns Established
- **Verify the emitter side by its actual sink** — confirm rows land in the correct destination table, filtered by post-test timestamp + emitter identity, not by "the POST returned 200."
- **SQLite table-rebuild migrations must disable FKs for the run** (`foreign_keys=OFF` + `foreign_key_check` after) — `legacy_alter_table=ON` does not prevent FK-ref rewrite on `RENAME` in modern SQLite (3.51.x).
- **Cross-check GSD counters against git ground truth at close** — the SDK undercounted again (phases 2→3, plans 12→15).

### Key Lessons
- A stale mid-flight `MILESTONE-AUDIT.md` reports false `gaps_found`; trust the per-phase `VERIFICATION.md` + `REQUIREMENTS.md` checkboxes as current truth and note the staleness explicitly.
- "Fix all the loose ends" is where the real bugs live — the durability + FK fixes shipped to a *different* repo entirely (forge).

### Cost Observations
- Model mix: orchestration on Opus; the one autonomous executor (95-01) routed to Sonnet
- Sessions: 1 long execute-phase → verify → milestone close
- Notable: the orchestrator/subagent split kept the noisy green-bar output (184 test files) out of main context; most of the phase ran inline because `/cso` needs the Skill tool and the operator gates needed live interaction

### Addendum — Phase 96: UI Deep-Dive Cleanup (completed 2026-07-13, appended post-ship)

**What was built:** Full-app UI truth/consistency sweep from an audit (F1–F10 / D-01–D-11): CONSOLE cluster dissolved; CommandPalette + sidebar single-sourced from `navRegistry` (~15 routes of drift killed); fabricated telemetry/trust signals removed; orphan pages deleted with redirects; dead UI stubs removed; one `<PageHeader>` everywhere; mobile master-detail collapse; both HITL approval consumers gated on the server ack boolean against the live-verified Ástríðr contract. 13 plans / 28 tasks in one day.

**What worked:**
- **Live UAT caught what green tests + a passed verification missed** — again. The pre-gap verification passed 12/12 must-haves, yet the live Telegram/dashboard race exposed InboxCard's false-success and Chat's dead `run.block` subscription. The gap-closure loop (UAT → 96-13 plan → re-verify 16/16) closed both same-day.
- **Cross-repo diagnosis at UAT time paid forward:** the three root-caused backend gaps became astridr Phase 178.1 with file:line evidence already in hand — discuss/plan/execute ran the same day on the strength of that diagnosis.
- **Delta-scoped re-review:** the gap-closure code review scoped to 96-13's 5 files instead of re-reviewing 63 — same gate, fraction of the cost.

**What was inefficient:** `phase.complete` miscounted a third consecutive time (claimed `roadmap_updated` while writing nothing; left counters at 0). Ground-truth diff before commit remains mandatory.

**Key lesson:** when one consumer of a shared contract gets a fix (ApprovalBlock's ack gating in 96-03), grep for every sibling consumer (InboxCard) before closing — the UAT found the miss, but the sweep-all-instances rule would have caught it at build time.

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v4.0 | 39 days | 8 | Wave-based parallel execution, formal verification gates, human UAT |
| v5.0 | 10 days | 12 | Multi-provider gateway, external integrations, advanced viz; milestone bookkeeping deferred (context-exhaustion lesson) |
| v9.0 | 7 days | 5 | Token-first theming, lazy-chunk build gates, operator manual-gates; live-integration gate lesson (cross-repo features must run live before "done") *(v7/v8 retros not recorded)* |

### Cumulative Quality

| Milestone | Tests | Pass Rate | Key Metric |
|-----------|-------|-----------|------------|
| v4.0 | 268+ | 99.6% (1 pre-existing failure) | 311 files, +43,759 lines |
| v5.0 | 445+ | green at ship | 668 files, +76,219 / −3,401 |
| v9.0 | 88: 47/47 · 92: 83/83 Nyquist; 91 verifier 10/10 | green at ship | 277 files, +33,655 / −3,495; ~86,100 LOC |

### Top Lessons (Verified Across Milestones)

1. Update traceability tables at phase completion, not milestone end
2. SUMMARY.md one-liners need enforcement for automated extraction
3. Do milestone bookkeeping (STATE reset, retrospective, tag, branch/worktree cleanup) as a discrete early step — never at the tail of a context-exhausted session
4. Verify every telemetry widget's full data path end-to-end; a green build can still ship silently-empty widgets
5. (v9.0) Cross-repo features must be exercised against the **live** stack before "done" — `convex-test`/jsdom green ≠ working; a declared integration gate must be an executed checklist, not a scoping note
6. (v9.0) Refresh the milestone audit at close if phases shipped after it ran — a stale `gaps_found` snapshot forces manual reconciliation
