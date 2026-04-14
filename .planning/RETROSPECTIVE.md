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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v4.0 | 39 days | 8 | Wave-based parallel execution, formal verification gates, human UAT |

### Cumulative Quality

| Milestone | Tests | Pass Rate | Key Metric |
|-----------|-------|-----------|------------|
| v4.0 | 268+ | 99.6% (1 pre-existing failure) | 311 files, +43,759 lines |

### Top Lessons (Verified Across Milestones)

1. Update traceability tables at phase completion, not milestone end
2. SUMMARY.md one-liners need enforcement for automated extraction
