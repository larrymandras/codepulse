# Skills Catalog Unification — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design) — revised post-Codex review
**Scope:** Cross-repo — CodePulse (`~/codepulse`), local Claude Code config (`~/.claude`), Ástríðr (`~/astridr-repo`, verify-only)

## Problem

Skills live in three universes and only one is surfaced in CodePulse:

- **Claude Code (host)** — personal `~/.claude/skills` (~107), plugin-cache skills (`~/.claude/plugins/cache/**/skills/*/SKILL.md`), and per-repo `<repo>/.claude/skills`. **None of these reach CodePulse today** (see "Existing scanner gap").
- **Ástríðr runtime** — already auto-feeds CodePulse via origin-tagged `capability_sync` telemetry at bootstrap (`bridge.py:327`), periodically (`health.py:160`), and on config change (`core.py:765`).

Goal: surface the host Claude Code skills in CodePulse's existing live Skills browser alongside Ástríðr's, and keep both current automatically as skills are added/removed.

## Existing plumbing (confirmed against code)

- `POST /runtime-ingest` (bearer auth via `validateIngestAuth`) accepts `{ eventType, data }`; `eventType:"capability_sync"` → `api.registry.syncFullInventory({ snapshot: data })` (`runtimeIngest.ts:539`).
- `POST /scan` → `api.registry.syncInventory` (`scan.ts:23`).
- `skills` table has optional `origin`, indexed **only `by_name`** (`schema.ts:190`).
- Skill drift surfaces via `NewSkillsBanner`, fed by auto-assigned `skillOverrides` (`skillCategories.ts:77`, `Skills.tsx:224`).

## Findings that reshaped the design (Codex review + verification)

1. **Existing scanner gap.** CodePulse already ships a SessionStart scanner (`hooks/scanner.mjs`, invoked by `codepulse-hook.mjs`) that POSTs a full inventory to `/scan`. But it collects skills only from a `settings.skills` array (`scanner.mjs:229`), which does not exist for directory-based skills — so it captures ~none of the 107. **Therefore we extend the existing scanner/hook, not build new ones.**
2. **`origin:"cc"` is already taken by Ástríðr.** Ástríðr tags its own skills `origin:"cc"` and bridged-in ones `"bridge"` (`bridge.py:130`). The host feeder must use a **distinct origin** or the two erase each other.
3. **All-or-nothing pruning (keystone bug).** Both `syncInventory` (`registry.ts:151`) and `syncFullInventory` (`registry.ts:306`) delete any skill absent from the incoming snapshot, regardless of origin — two feeders would erase each other.
4. **Single-row-by-name + last-writer origin breaks naive origin-scoped pruning.** Skills upsert by `name` only and patch `origin` to the last writer (`registry.ts:274,279`); a shared-name skill flaps and can be wrongly deleted. Resolved by composite identity (below).

## Design

### Component 1 — CodePulse: composite `(name, origin)` identity + origin-scoped pruning (keystone)

Adopt **`(name, origin)` as skill identity**. A skill reported by both host Claude Code and Ástríðr becomes two rows (distinct origins); display may group by name (Component 2).

- Add a `by_name_origin` index (`["name","origin"]`); keep `by_name` for display/grouping queries.
- Upsert looks up by `(name, origin)`; insert sets `origin`.
- **Pruning is per-origin with per-origin incoming sets (essential).** Build a separate incoming-name set *per origin* present in the snapshot, and for each such origin delete only that origin's rows whose name is absent from that origin's set. A single global `incomingSkillNames` set (the current pattern, `registry.ts:120/152/269/307`) is **incorrect** here — a global skill sharing a name with a project skill would wrongly preserve a stale project row. Origins not present in the snapshot are untouched.
- Apply identically to **both** `syncInventory` and `syncFullInventory` so the shared `skills` table stays consistent.
- **Origin normalization at every write boundary.** Normalize missing `origin` → `"unknown"` in *all* skill inserts, not just a one-time cleanup: `syncInventory` (`registry.ts:130`), `importSkills` (`registry.ts:873`), `repairSkillsFromOverrides` (`registry.ts:1000`). Plus a one-time deploy mutation to relabel pre-existing undefined-origin rows.

### Component 1a — Categorization surface stays name-scoped (explicit decision)

The override/category/favorite/launch surface is keyed by **`name`** (`skillOverrides` index `by_skillName`; `getSkillsWithOverrides` joins by name via a name-keyed Map, `skillCategories.ts:85-95`). We **intentionally keep this name-scoped**: a skill of a given name has one category / favorite / display regardless of how many feeders provide it, and the UI groups duplicate-origin rows by name. Consequences, all accepted by design:
- `autoSeedSkill` (`skillCategories.ts:216`) creates one override on first insert of a name; later same-name/other-origin rows reuse it. ✔ desired.
- Edit/favorite/drag-drop mutations stay `skillName`-only (`Skills.tsx:18/82/89/102/141`, `skillCategories.ts:170/192`) — no origin threading needed.
- `recordSkillLaunch` (`registry.ts:632`) updates the first row for a name; acceptable since host-skill usage tracking is a non-goal and Ástríðr drives launches.
- Catalog/summary counts (`registry.ts:717/1031`, `Capabilities.tsx:387`) count rows, so a dual-feeder name counts as 2; the Skills page groups by name for display. Note the row-vs-name distinction in the UI label.

**Tests (Vitest):** (a) a host-origin sync does not delete Ástríðr (`cc`/`bridge`) rows; (b) an Ástríðr sync does not delete host rows; (c) per-repo project pruning is isolated to its own origin; (d) a shared-name skill reported by both feeders yields two stable rows and neither prune deletes the other; (e) single-origin legacy behavior preserved after normalization.

### Component 2 — CodePulse: origin visibility (display)

An `OriginBadge` component already exists (`src/components/OriginBadge.tsx`) but has no styles for the new origins. Extend it with badge styles for `claude-code`, `claude-code:project:*`, and `unknown`, add an origin filter on the Skills page, and group duplicate names for display. Reuse existing `src/components/skills/*` styling. Minimal, additive.

### Component 3 — Extend the existing scanner's skill collection (host feeder)

Enhance `hooks/scanner.mjs` skill collection (reuse the frontmatter parser + walker pattern from `skills-inventory.mjs`) to:
- Walk `~/.claude/skills/*/SKILL.md` and plugin cache `~/.claude/plugins/cache/**/skills/*/SKILL.md` → `origin:"claude-code"`.
- Walk current-repo `<cwd>/.claude/skills/*/SKILL.md` → `origin:"claude-code:project:<repoKey>"`, where `repoKey` is a **stable hash of the canonical repo root path** — realpath-resolved, separators normalized, case-normalized on Windows — so symlinks, drive casing, or a subdirectory cwd don't produce different origins for the same repo. Per-repo pruning is then isolated and sessions in different repos never flap each other.
- Parse `name` + `description` from frontmatter; set `source` to the SKILL.md path.
- Emit these as origin-tagged skills in the snapshot the scanner already POSTs to `/scan`.
- **First-sync fan-out mitigation:** ~120 new skills each triggering `autoSeedSkill` (category + override + `configChanges`) inside one mutation risks Convex write/time limits. Plan to batch inserts and/or move `autoSeedSkill` to a scheduled/background step; validate against limits before shipping.

### Component 4 — SessionStart trigger (already wired)

The existing `codepulse-hook.mjs` SessionStart hook already invokes the scanner non-blocking. Confirm it is installed in `~/.claude/settings.json`; if not, add the hook entry (fire-and-forget, errors swallowed to a log). No new hook framework needed.

### Component 5 — Auth / config

- The existing scanner posts to `/scan` with only `Content-Type` and **no bearer token** (`scanner.mjs:184`), while `/scan` already calls `validateIngestAuth` (`scan.ts:16`). Add `Authorization: Bearer ${ASTRIDR_INGEST_API_KEY}` to the scanner POST.
- **Use the right key resolver:** the server validator expects `ASTRIDR_INGEST_API_KEY` (`ingestAuth.ts:72`), but the existing hook helper reads `CODEPULSE_INGEST_KEY` (`codepulse-hook.mjs:42`) — do not reuse that resolver for the bearer. Read `ASTRIDR_INGEST_API_KEY` from an **untracked** local config (env var or gitignored file). Never committed; **never read or printed by the assistant** (env-guard + no-secrets rule). Value lives in `astridr-repo/.env` as `ASTRIDR_INGEST_API_KEY` and must match CodePulse's Convex deployment env var of the same name.
- Make the feeder **require** the key (refuse to post with an empty key) so it doesn't silently rely on the server's fail-open path when the key is unset.

### Component 6 — Ástríðr: verify-only

Ástríðr already feeds skills with origins (`cc`/`bridge`/`native`/`host`, `bridge.py:119-152`). Work limited to: confirm payload origins after the identity change, and one end-to-end check that an Ástríðr sync no longer wipes host skills and vice-versa.

## Verification (real outcomes)

1. CodePulse Vitest green (composite identity + per-origin pruning) + `npx tsc --noEmit`.
2. Scanner `--dry-run`/manual run payload inspected, then a live session → host skills visible in the Skills page tagged `claude-code`.
3. After a host sync, trigger an Ástríðr `capability_sync` → host skills **survive**; then a new host session → Ástríðr skills **survive** (collision regression test in the real env).
4. First-load behavior checked: confirm no Convex limit errors on the ~120-skill initial sync.

## Known limitations / accepted

- A skill present in both host and Ástríðr appears as two rows (grouped in UI). Honest and simple; accepted over a `providers[]` schema.
- `NewSkillsBanner` shows a large backlog on first load and its `onReview` is currently a no-op (`Skills.tsx:227`) — cosmetic; address only if it proves noisy.
- Deleting a repo leaves its `claude-code:project:<repoKey>` rows until manually cleared — minor staleness, no flapping.

## Non-goals (YAGNI)

- Host skill *usage* tracking (`useCount`/`lastUsedAt`) — needs a separate PostToolUse hook; out of scope.
- A new ingest endpoint — reuses the existing `/scan` channel via the enhanced scanner.
- Retiring `skills-inventory.mjs` — kept as offline catalog; its scan code is reused.
