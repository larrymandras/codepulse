---
id: SEED-005
status: dormant
planted: 2026-08-07
planted_during: v14.0 (design session in home-dir CWD; phases not yet added — GSD add must run from a codepulse session)
trigger_when: >
  Next codepulse session that runs /gsd-phase add. Add Phases 116-119 alongside
  (or after) the pending 114-115 add from the agentic-os-second-brain workstream.
  All four phases are independent of 109-115 and of each other; order is
  daily-value-first (116 Galdr, 117 Bifrost, 118 Studio, 119 Loom).
scope: Large (four phases; 117 is /gsd-quick-shaped)
origin: >
  Design approved by Larry 2026-08-07 after analyzing the RoboNuggets RUBRIC
  donor zips (rubric, rubric-links, rubric-generations) and cross-checking the
  live codepulse/forge inventory (link hub, media gallery, prompt library are
  clean build slots; workflow telemetry visualizers exist and must not be
  duplicated). Full design: docs/proposals/2026-08-07-seidr-suite-design.md.
  Canonical status: Mandras vault 02-projects/seidr-suite.md.
---

# SEED-005: Seiðr Suite — Galdr / Bifröst / Studio / Loom

Four new CodePulse command surfaces, Convex-spined, agent-as-admin. **No donor
code; no "Rubric" naming.** Read the design doc before planning any phase —
schemas, gates, and constraints are all specified there.

| Phase | Feature | One-liner |
|---|---|---|
| 116 | **Galdr** — prompt library | `prompts`/`promptVersions` tables, Skills-page-style UI at `/galdr`, live-fetch `/galdr` + `/galdr-save` Claude Code skills, send-to-Chat, clipboard fill-in. Forge picker deferred (queued in forge ROADMAP, needs Forge Phase 23). |
| 117 | **Bifröst** — link hub | `links` table, categorized grid at `/bifrost`, command-palette registration, liveness dots from existing Infrastructure probes, `/bifrost-scan` curation skill. |
| 118 | **Studio** — media gallery | `media`/`mediaStyles`/`mediaModels` tables; originals in `C:\Users\mandr\media-vault\` (sidecar JSON provenance contract), bounded ≤200KB thumbs in Convex, watcher ingest, masonry UI at `/studio`, recipe cards spanning Higgsfield MCP / OpenArt / direct APIs / Ástríðr, nightly robocopy backup to `G:\My Drive\media-vault\`. |
| 119 | **Loom** — curated pipelines | `pipelines`/`pipelineRuns` tables, React Flow UI at `/loom` (SwarmGraph stack), per-step docs in-row, `loom-emit.mjs` HTTP step events (Convex subscriptions replace donor's WebSocket layer), `/loom-author` scan skill. Boundary vs Mission Board (111): jobs vs curated definitions — cross-link, don't merge. |

Cross-repo stubs planted 2026-08-07: astridr `SEED-028-seidr-suite-hooks.md`
(v29: galdr_lookup tool, generator sidecar routing, loom emits), forge ROADMAP
"Queued (post-v4.0)" (Galdr prompt-picker in session composer).

Key constraints (detail in design doc §6): thumbs-only in Convex (blob
discipline), API keys never in Convex, v15.0 Borealis holds the UI overhaul —
these phases use current design-system tokens, no overhaul pieces pulled in.
