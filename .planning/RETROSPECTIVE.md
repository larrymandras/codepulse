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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v4.0 | 39 days | 8 | Wave-based parallel execution, formal verification gates, human UAT |
| v5.0 | 10 days | 12 | Multi-provider gateway, external integrations, advanced viz; milestone bookkeeping deferred (context-exhaustion lesson) |

### Cumulative Quality

| Milestone | Tests | Pass Rate | Key Metric |
|-----------|-------|-----------|------------|
| v4.0 | 268+ | 99.6% (1 pre-existing failure) | 311 files, +43,759 lines |
| v5.0 | 445+ | green at ship | 668 files, +76,219 / −3,401 |

### Top Lessons (Verified Across Milestones)

1. Update traceability tables at phase completion, not milestone end
2. SUMMARY.md one-liners need enforcement for automated extraction
3. Do milestone bookkeeping (STATE reset, retrospective, tag, branch/worktree cleanup) as a discrete early step — never at the tail of a context-exhausted session
4. Verify every telemetry widget's full data path end-to-end; a green build can still ship silently-empty widgets
