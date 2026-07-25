# Requirements

**No active milestone.** v11.0 (Skills Command Center — Full Lifecycle & Launch) shipped 2026-07-25 and is archived at [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22 requirements complete across Phases 97–100).

Run `/gsd-new-milestone` to define the next milestone's requirements here.

## Post-v11.0 queued follow-ups (not yet a milestone)

Operator-confirmed order (2026-07-25):

1. **Fix mangled skill display names** — `generateDisplayName()` strips a category-style prefix at seed time (agent-browser → "Browser"), stored as overrides; regenerate full names + migrate stored overrides.
2. **Ástríðr bridge coverage** — bridge the 10 Claude Code skills currently missing from Ástríðr (`frontend-design`, `skill-creator` + 8 project/vault); cross-repo (astridr-repo bridge config + docker-compose + `claude_code_bridge.py`). Root cause verified 2026-07-25 (see `milestones/v11.0-MILESTONE-AUDIT.md`).
3. **Chat command-center + telemetry redesign** — 2-column HUD with system-vitals gauges / LLM meters / reactive aura (mockup approved).
