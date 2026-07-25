# Handoff — Post-v11.0 queued work (3 items)

**Written:** 2026-07-25, at the end of the v11.0 close session (context about to be cleared).
**Status:** v11.0 SHIPPED & tagged (`v11.0`, pushed). No active milestone. These 3 items are queued in operator-confirmed order. None started.

Read `.planning/STATE.md` + `.planning/REQUIREMENTS.md` (stub) + `milestones/v11.0-MILESTONE-AUDIT.md` for context. All Skills-page code is in `codepulse/src/components/skills/`, `src/pages/Skills.tsx`, `src/lib/skills.ts`, `convex/skillCategories.ts`.

---

## ① Fix mangled skill display names  (codepulse only, small)

**Problem:** Many skills render with a prefix stripped — `agent-browser` → "Browser", `deep-research` → "Research", `deploy-to-vercel` → "To Vercel", `geo-schema` → "Schema" — making them hard to identify.

**Root cause (verified):** `convex/skillCategories.ts` `generateDisplayName(skillName, prefix)` strips a leading category-style `prefix` (`normalized.replace(new RegExp(`^${prefix}[-_]?`), "")`) then title-cases the rest. These names are **stored** as `displayName` overrides at seed time (call sites ~line 247 `generateDisplayName(skill.name, prefix)` and ~289), and `getSkillsWithOverrides` returns `override?.displayName ?? skill.name` (~line 103). So the mangled names live in the DB, not just in derivation.

**Fix:**
1. Change `generateDisplayName` to produce the full title-cased name (don't strip the prefix), e.g. `agent-browser` → "Agent Browser", `deep-research` → "Deep Research".
2. Migrate existing stored overrides: regenerate `displayName` for auto-seeded overrides (or clear the auto-generated ones so they fall back to a fresh derivation). This is a **data migration** on the live self-hosted Convex — per repo rules, targeted per-row patches only, NEVER `import --replace-all`. A Convex mutation that walks overrides and rewrites `displayName` is the clean path.
3. Add a unit test for `generateDisplayName` (it's exported).

**Caution:** distinguish user-set overrides from auto-generated ones so a manual rename isn't clobbered (check how seeding tags them).

---

## ② Ástríðr bridge coverage — bridge the 10 missing skills  (cross-repo: astridr-repo + docker + forge)

**Goal (operator's core ask):** Ástríðr must have EVERY skill loaded into Claude Code. A skill is available to Ástríðr iff it has a `cc_<name>` / `[bridge, native]` entry.

**Gap (verified from live DB):** 10 active Claude Code skills have no bridge twin:
- 2 global plugins: `frontend-design`, `skill-creator`
- 8 project/vault: `spike-findings-forge`, `defuddle`, `json-canvas`, `obsidian-bases`, `obsidian-cli`, `obsidian-markdown`, `add-migration`, `home-assistant-manager`
- (0 bridge-only skills exist — nothing unique is at risk.)

**Where the mirror is built:** `astridr-repo/astridr/integrations/claude_code_bridge.py` — `discover_skills()` (~379-527), `import_skill()` (~778-819, imports as `cc_<name>`), `_normalize_install_path()` (~25-38). Bootstrap: `astridr-repo/astridr/engine/bootstrap/bridge.py`. Config: `astridr-repo/config/bridge.yaml`. Scan roots today = global `~/.claude/skills` + `extra_skill_dirs` (only `~/.claude/skills` + `/app/vault/.claude/skills`) + plugins from `~/.claude/plugins/installed_plugins.json`.

**Three root causes + fixes (all verified against live files 2026-07-25):**

1. **Plugins `frontend-design`, `skill-creator`:** their `installPath` is under `.claude-alt/plugins/...`, but `_normalize_install_path()` only matches the marker `"/.claude/"` (confirmed at claude_code_bridge.py line ~33), so `.claude-alt` paths return the raw Windows path → don't resolve in-container (and `.claude-alt` isn't mounted). **Fix:** match `/\.claude(-alt)?/` (or iterate `["/.claude-alt/","/.claude/"]`, longest-first) AND mount the alt plugin cache into the astridr container (docker-compose.yml), or resolve plugin skills from the mounted `claude_home/plugins/cache/...` copy.

2. **5 vault skills** (`defuddle`, `json-canvas`, `obsidian-bases/cli/markdown`): they live in the scanned `/app/vault/.claude/skills` but are Windows **junctions** into `.agents/skills` (confirmed: `defuddle` → `…/Mandras/.agents/skills/defuddle`), which Docker renders as dangling symlinks → unreadable → skipped. **Cheapest fix (5 of 10):** add `/app/vault/.agents/skills` to `extra_skill_dirs` in `bridge.yaml` — the junction targets ARE reachable there in-container.

3. **3 project skills** (`spike-findings-forge`→forge, `add-migration`→claudeclaw-os, `home-assistant-manager`→homeassistant): those repos are neither in `extra_skill_dirs` nor mounted into the astridr container (docker-compose only mounts astridr-repo + codepulse). **Fix:** add each repo's `.claude/skills` to scan roots AND mount the repos; ideally drive the project-scan roots off forge's synced-workspace list (`forge/src/emit/skill-rescan.ts` ~264-274 already uses `listWorkspaces`) so bridge + CodePulse feeder never drift.

**Risks to design around before a broad rollout:**
- **Name collisions:** `discover_skills()` dedups on the BARE name globally and imports as `cc_<name>`; two repos with a same-named skill → first-seen wins, rest silently dropped. Need project/origin-qualified naming (mirror forge's repoKey namespacing).
- **Trust boundary:** `bridge.yaml` `skill_auto_approve: true` → newly-reachable `SKILL.md`s auto-load (they can register tools/commands + enter the system prompt). Keep the `blocked_skills` gate; consider requiring approval for newly-added project scopes.
- Do NOT touch `scan_sibling_skill_dirs` (intentionally off; not part of the 10).

**Verification after fix:** restart the forge daemon (or trigger a lifecycle command → `rescanAndSync`) so the bridge re-imports; re-query the live Convex `getSkillsWithOverrides` and confirm `cc_frontend-design`, `cc_defuddle`, etc. now exist (`[bridge, native]`).

---

## ③ Chat command-center + telemetry redesign  (mockup first, then build)

**Goal:** turn the Chat page (`src/pages/Chat.tsx`) from a presence/voice screen (big aura hero on top, conversation squeezed under it) into a futuristic 2-column HUD command center; also folds in the operator's earlier ask to move the chat output **left + higher** (thread on the left, telemetry rail on the right, aura shrinks to a compact reactive core).

**Approach (worked well for the Skills redesign):** build a throwaway HTML mockup first (write to `html-out/`, open locally — the Claude web Artifact didn't load for this operator), get sign-off, THEN implement. The Skills mockup lived at `html-out/skills-redesign-mockup.html`.

**Telemetry ideas — all backed by REAL Convex tables** (`systemResources`, `dockerContainers`, `llmMetrics`, `mcpServers`, `discoveredTools`): system-vitals radial gauges (CPU/RAM/GPU), a context-fuel gauge (tokens used/max from `llmMetrics`), tokens/sec + TTFT + cost meters, Docker/agent health LEDs, voice round-trip latency, throughput sparklines / EKG strip, "now serving" panel (profile/model/MCP/tools). Signature move: the aura core reacts to real system load. Recharts + React Three Fiber are already in the stack. Chat page has voice-timing complexity — pure layout changes are safe, but verify live (extension may be off; operator drives the browser).

---

## Session context notes (for the fresh session)
- The Skills page was heavily redesigned this session (3-col layout, Command Deck, filter chips, bulk-select, bridge-mirror filter, no-op feedback) — all shipped in v11.0 (Phase 100 folded).
- Operator drives the browser (Claude-in-Chrome extension was NOT connected); for live UI checks, give the operator exact steps and read back screenshots.
- Self-hosted Convex query pattern used this session: `npx convex run --url http://127.0.0.1:3210 --admin-key "$(docker exec convex-backend ./generate_admin_key.sh)" skillCategories:getSkillsWithOverrides` (run from codepulse/; write scratch JSON to an ABSOLUTE path — node reads Windows `/tmp` differently than Git-Bash).
