# Seiðr Suite — Four Command Surfaces for the Agentic OS

**Date:** 2026-08-07 · **Status:** Design approved (Larry, 2026-08-07) · **Author:** Claude + Larry
**Suite name:** Seiðr (the Norse practice of magic — umbrella for the four features below)

| Feature | Norse name | What it is |
|---|---|---|
| Prompt Library | **Galdr** (chanted spells) | Managed prompt database, usable from every surface |
| Media Gallery | **Studio** | Browse/star/reference AI-generated media with full provenance |
| Curated Pipelines | **Loom** (the Norns' weaving) | Declarative named pipelines with docs + live run animation |
| Link Hub | **Bifröst** (bridge between realms) | Categorized URL hub, agent-curated, palette-searchable |

---

## 1. Context

Donor inspiration: RoboNuggets "RUBRIC" toolkit by Jay E / RoboLabs (CC BY 4.0) — three zips analyzed 2026-08-07 (`robonuggets-rubric`, `robonuggets-rubric-links`, `robonuggets-rubric-generations`). **No donor code ships; no "Rubric" naming anywhere in our code.** We take patterns only:

- **Agent-as-admin**: the user talks, the agent writes the data files, the dashboard just renders.
- **Styles library + per-model recipe cards** (Generations).
- **Declarative pipeline definitions with per-step docs** that can light up live (Flows).
- **Workspace-scan → propose → confirm → write** curation loop (Links).

Prior art (do not re-derive):
- `Mandras/04-research/rubric-toolkit-teardown.md` (2026-06-22) — security audit of this same toolkit; its one "real lift" (docs comment-loop) already shipped as `/doc-comments` (SEED-001, PR #54).
- Overlap inventory (2026-08-07, Explore agent over codepulse + forge): **link hub, media gallery, prompt library are clean build slots** (no tables/pages/components exist); workflow *telemetry* visualizers exist heavily (SwarmGraph, RunTimeline, Gantt, TraceWaterfall, Mission Board = Phase 111) — Loom must complement, not duplicate them.
- Sibling workstream: `Mandras/02-projects/agentic-os-second-brain.md` (Phases 114–115, ARMS workspace map) — same "append to v14" routing, independent scope.

## 2. Decisions (locked 2026-08-07)

1. **Home**: all four features live in CodePulse (new views + Convex tables). No standalone localhost servers — Convex reactivity replaces the donor's WebSocket layer entirely.
2. **Loom scope**: curated pipeline definitions **plus** live run tracking (not presentation-only).
3. **Studio backends**: Higgsfield MCP + OpenArt MCP/CLI + direct API recipe cards (Google AI Studio / Kie / fal) + Ástríðr-as-generator. All write to one media directory with sidecar JSON.
4. **Galdr send targets**: Claude Code sessions via Forge (deferred to Forge v4.0 Phase 23+), CodePulse Chat / Ástríðr (now), clipboard + live-fetch skill (now).
5. **Routing**: append to CodePulse v14 as Phases 116–119 (after the pending 114–115 add). Ástríðr-side work seeds for v29 (nothing inserted into v28). Forge-side work goes in Forge's post-v4.0 queued section.
6. **Media directory**: new `C:\Users\mandr\media-vault\`, nightly mirrored to `G:\My Drive\media-vault\` (robocopy scheduled task). Originals never enter Convex.
7. **Naming**: Norse names as above; ASCII-safe slugs in code (`galdr`, `studio`, `loom`, `bifrost`).

## 3. Architecture — one spine, many mouths

```
                    ┌─────────────────────────────┐
                    │   Convex (self-hosted)      │
                    │  prompts / promptVersions   │
                    │  media / mediaStyles /      │
                    │  mediaModels                │
                    │  pipelines / pipelineRuns   │
                    │  links                      │
                    └──────────┬──────────────────┘
       reads/writes via mutations + HTTP endpoints (existing ingest pattern)
   ┌───────────────┬───────────┼──────────────┬────────────────────┐
   │ CodePulse UI  │ Claude Code│  Ástríðr    │ Forge (post-v4.0)  │
   │ 4 new views   │ /galdr,    │ prompt tool,│ prompt-picker in   │
   │ (render+edit) │ /galdr-save│ generator   │ session composer   │
   │               │ skills     │ routing     │                    │
   └───────────────┴────────────┴─────────────┴────────────────────┘
```

Every surface reads/writes the same tables. The UI renders and does light edits; agents do the heavy authoring (agent-as-admin). Live updates are free via Convex subscriptions.

**Auth note:** browser writes go through the existing Clerk-authed mutation path; agent writes go through the existing bearer-token HTTP ingest pattern (`hooks/*.mjs` precedent). No new auth surface.

## 4. Feature designs

### 4.1 Galdr — Prompt Library (Phase 116)

**Schema** (`convex/schema.ts` additions):
- `prompts`: `title`, `slug` (unique, kebab), `body` (supports `{{variable}}` placeholders), `category`, `tags[]`, `favorite`, `usageCount`, `lastUsedAt`, `archived`, `createdAt`, `updatedAt`.
- `promptVersions`: `promptId`, `body`, `savedAt` — lightweight snapshot appended on every body change (no diffing, no branching).

**UI** (`/galdr`, COMMAND nav group): clone the Skills page UX — searchable/filterable card grid, category chips, favorites float up, usage-count sort. Editor drawer: body editor, variable auto-detection (`{{name}}` → chips), preview with fill-in fields, version history list (restore = new version). "Send" split-button: **Chat** (prefills `/chat` composer via router state) / **Copy** (variable fill-in dialog → clipboard) / **Copy as command** (`/galdr <slug>` string for pasting into any Claude Code session).

**Claude Code integration** (the key creative piece — zero sync, live fetch):
- `~/.claude/skills/galdr/SKILL.md` — `/galdr <slug or search terms>`: fetches the prompt body from a Convex HTTP endpoint (`GET /galdr/prompt?slug=...`, bearer token), fills variables by asking or from args, injects into context, bumps `usageCount`. `/galdr` with no args lists categories + favorites.
- `/galdr-save <title>`: captures a prompt from the current conversation back to the DB (`POST /galdr/prompt`).
- Because it fetches live, both machines and every session see the same library with no export/sync step.

**Ástríðr integration** (→ SEED-028, v29): a `galdr_lookup` tool mirroring the skill, so "use my competitor-analysis prompt on X" works in her chat.

**Forge integration** (→ Forge queued section): prompt-picker in the session composer once Phase 23 (WS attach + stdin write) lands. Galdr does not wait for it.

**Gate:** a prompt saved from a Claude Code session on the desktop is retrievable by `/galdr` in a second session AND appears in the CodePulse UI; sending to Chat produces a real Ástríðr turn; version history shows the edit trail.

### 4.2 Bifröst — Link Hub (Phase 117, small — candidate for /gsd-quick execution)

**Schema:** `links`: `title`, `url`, `description`, `category`, `icon` (lucide icon name — not inline SVG), `pinned`, `order`, `isLocalService` (bool), `createdAt`.

**UI** (`/bifrost`, COMMAND nav group): categorized grid, pinned row on top, quick-add dialog, drag-reorder within category.

**Two upgrades over the donor:**
1. **Command palette**: register links in the existing palette provider (navRegistry pattern) — ⌘K, type, Enter opens the URL.
2. **Liveness dots**: `isLocalService` links get an up/down dot reusing the Infrastructure page's existing probe data (join on host:port; no new probing).

**Curation:** one-time `/bifrost-scan` skill run — scans CLAUDE.md files, docker-compose, package.json scripts, vault notes for URLs; proposes categorized list; on confirm, POSTs to Convex. `/link-add <url>` for one-offs afterward.

**Gate:** palette-open works end-to-end; a localhost link's dot goes red when its service is stopped (control: a known-up service shows green in the same view).

### 4.3 Studio — Media Gallery (Phase 118)

**Filesystem layout** (`C:\Users\mandr\media-vault\`):
```
media-vault\
├── gen\          # generated outputs (flat, naming: {project}_{variant}_{attempt}_{ts}.{ext})
├── refs\         # reference images
├── styles\       # style preview images
├── trash\        # soft-deleted (janitor empties after 30 days)
└── *.json        # sidecar per media file: {prompt, model, provider, style, refs[], params, project}
```
Every generator writes media + sidecar here: Higgsfield MCP flows (download step), OpenArt MCP/CLI, direct-API recipe skills, Ástríðr. The sidecar is the provenance contract — written by whoever generates.

**Ingest:** a watcher script (Node, scheduled task every 5 min + manual `/studio-sync`) scans `media-vault`, and for new files: generates a bounded thumbnail (≤200KB webp; ffmpeg poster frame for video), uploads the thumb to Convex file storage, POSTs a `media` row with sidecar metadata. **Originals never enter Convex** (export-size lesson: a full DB export once peaked ~56GB; thumbs are bounded).

**Schema:**
- `media`: `filename`, `absPath`, `mediaType` (image/video/audio), `kind` (gen/ref/style), `model`, `provider`, `prompt`, `styleId`, `project`, `params`, `starred`, `tags[]`, `sizeBytes`, `width/height/durationSec`, `thumbStorageId`, `deletedAt`, `createdAt`.
- `mediaStyles`: `slug`, `name`, `description`, `prompt`, `previewMediaId`.
- `mediaModels`: `slug`, `name`, `type`, `provider`, `recipeMd` (the curated recipe card — endpoint, params, defaults, gotchas), `docsUrl`, `aspect/resolution/duration`, `enabled`.

**UI** (`/studio`, ACTIVITY or own slot): masonry grid (2–6 columns), filters (type/kind/model/project/starred), search, star toggle, detail panel showing the full recipe (prompt, model, style, refs) with **"copy recipe"** (one click → regenerate anywhere), copy-path, soft delete (sets `deletedAt`; janitor moves file to `trash\`). Collapsible Styles and Models panels rendering the two tables.

**Recipe cards:** `mediaModels.recipeMd` is authored per model spanning all four backends — e.g. "kling-3.0 via Higgsfield MCP: use `generate_video` with …" / "gpt-image via OpenArt CLI: …" / "veo-3.1 direct: POST … with `GOOGLE_AI_STUDIO_KEY`". A `/studio-generate` skill reads the card for the chosen model, generates, writes media + sidecar. Keys stay in `.env`/1Password per existing rules — never in Convex.

**Backup:** scheduled task `MediaVaultBackup`, nightly `robocopy C:\Users\mandr\media-vault "G:\My Drive\media-vault" /MIR /R:2 /W:5` — no battery condition (scheduled-task battery lesson), log to `media-vault\backup.log` excluded from mirror. `/MIR` is correct here because trash\ gives deletion a 30-day grace period locally before the mirror drops it.

**Gate:** generate one image via Higgsfield and one via a direct-API recipe → both appear in the gallery with correct provenance within one watcher cycle; star survives reload from a second machine; deleting moves the file to trash and hides the row; backup task run shows the file mirrored on G:.

### 4.4 Loom — Curated Pipelines (Phase 119)

**Schema:**
- `pipelines`: `slug`, `name`, `description`, `owner` (larry/astridr), `steps[]` (`{id, name, description, icon, docMd}`), `sourceRef` (e.g. `~/.claude/workflows/review-verify`, `astridr cron watch:pulse`, `gsd phase`), `enabled`.
- `pipelineRuns`: `pipelineSlug`, `status`, `startedAt/endedAt`, `currentStep`, `stepEvents[]` (`{stepId, event: start|action|complete|error|warn, text, at}`).

**Per-step docs live IN the row** (`docMd`) — avoids serving files from disk to a cloud UI; the authoring skill copies/refreshes them from source.

**Authoring:** `/loom-author` skill scans `~/.claude/workflows/` (6 saved), Ástríðr's cron registry (via A3's `/api/inventory` once v29 lands; until then the compose/config files), and GSD phase structures; proposes pipeline cards; on confirm, writes rows. Manual authoring in the UI for presentation pipelines.

**Live mode — no WebSocket layer:** a tiny emit helper (`loom-emit.mjs`, same shape as existing `hooks/*.mjs` ingest) POSTs step events to a Convex HTTP endpoint → `pipelineRuns` row updates → UI animates via subscription. Anything that can `node loom-emit.mjs step:complete 2` can drive the view: workflow scripts, skills, Ástríðr crons, GSD executors.

**UI** (`/loom`, GRAPHS nav group): React Flow (SwarmGraph's stack — do NOT hand-roll canvas) horizontal pipeline: agent node → step nodes with icons; click → doc side panel; live run overlays progress/status colors on the same nodes. Run history list per pipeline. **Boundary vs Mission Board (111):** Mission Board = live *jobs* (what is running, telemetry-derived); Loom = curated *pipelines* (what the system is designed to do, definition-first, optionally lit by live runs). Cross-link, don't merge.

**Gate:** one real pipeline (e.g. the `review-verify` saved workflow) authored via the skill renders with per-step docs; a live run driven by real emits animates start→complete on every step; an error event renders distinctly (control: a clean run shows no error styling).

## 5. Phasing & cross-repo stubs

| Phase | Feature | Size | Depends on |
|---|---|---|---|
| 116 | Galdr | M | nothing |
| 117 | Bifröst | S (`/gsd-quick`-shaped) | nothing |
| 118 | Studio | L | media-vault dir + backup task (created in-phase) |
| 119 | Loom | M/L | nothing (Ástríðr cron lens improves after v29 A3) |

Order = daily-value-first. All four are independent of Phases 109–115 and of each other.

**Cross-repo stubs planted with this design:**
- `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md` — v29 candidates: `galdr_lookup` tool; generator routing writes media-vault sidecars; Loom emits from cron/agent runs.
- `forge/.planning/ROADMAP.md` "Queued (post-v4.0)" — Galdr prompt-picker in the session composer (needs Phase 23 stdin write).
- Vault note `Mandras/02-projects/seidr-suite.md` — canonical status.

## 6. Risks & constraints

- **Forge dependency is deferred, not blocking**: "send into a live Claude Code session" waits for Forge Phases 23/26; every other Galdr path works day one.
- **Blob discipline**: only bounded thumbnails enter Convex. The watcher enforces the 200KB cap; a full-size upload is a bug.
- **Concurrent GSD sessions**: the `/gsd-phase add` for 116–119 must run in a codepulse session (vault CWD rule), after or alongside the 114–115 add; STATE.md diff before any commit that touches it (standing lesson).
- **Secrets**: generation API keys stay in `.env` files read by skills; Convex stores no keys; `mediaModels.recipeMd` references key *names* only.
- **Donor license**: patterns only, no code copied; CC BY 4.0 attribution not required for independent reimplementation, but the teardown note credits the source regardless.
