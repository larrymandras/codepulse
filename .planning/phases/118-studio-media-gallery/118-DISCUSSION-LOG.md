# Phase 118: Studio Media Gallery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-13
**Phase:** 118-studio-media-gallery
**Areas discussed:** Thumbnail transport, Ingest trigger, Generator coverage, Backfill vs greenfield, Soft-delete semantics

---

## Thumbnail transport

| Option | Description | Selected |
|--------|-------------|----------|
| Convex storage + proving plan | Keep the doc's design, but the first plan is a blocking upload→getUrl→200-with-bytes round-trip; hard ≤200KB webp cap; fall back to static serve if it fails | ✓ |
| Static serve from media-vault | No blobs in Convex; a local static origin serves `.thumbs\`, row stores a relative path. Needs a tailnet-reachable second origin and an honest broken state | |
| Data-URI in the row | ≤32KB base64 webp inlined on the row. No storage subsystem; fat rows against the ~1 MiB doc limit and ~6 MB per grid query | |

**User's choice:** Convex storage + proving plan (→ D-01)
**Notes:** Chosen with the 0-blob finding on the table. The proving round-trip is blocking precisely because the mechanism is unproven rather than known-broken — the fallback must be selected from probe evidence before UI work, not discovered during it.

---

## Full-size originals in the browser

| Option | Description | Selected |
|--------|-------------|----------|
| Thumbs only + copy-path | Detail panel shows thumb + full recipe + copy-path; viewing the original is a local action. No second-origin dependency | ✓ |
| Lightbox from a local origin | Full-size preview served from a local static origin. Best browsing; makes that origin load-bearing for core UX | |
| Open-in-new-tab via file:// | Row carries absPath, click tries file://. Browsers block file:// from an http origin, so it degrades to copy-path with extra steps | |

**User's choice:** Thumbs only + copy-path (→ D-02)

---

## Ingest trigger — what runs the watcher

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled task + /studio-sync | Single-repo like 116/117/119. No AC-power condition, run-hidden.vbs launch. Manual path gives the gate a fast route | ✓ |
| Fold into the Forge daemon | Already host-resident and polling Convex; no new task to forget. Makes Studio cross-repo, and the daemon's 08-05 death went unnoticed for 3 days | |
| Manual /studio-sync only | No automation; smallest surface, nothing falsely claims to be watching. Cron-generated media would never appear unaided | |

**User's choice:** Scheduled task + /studio-sync (→ D-04)
**Notes:** The two guards (battery, hidden-window) were locked into the decision itself rather than left to execution, since both have already caused silent failures in this environment.

---

## Ingest trigger — row identity

| Option | Description | Selected |
|--------|-------------|----------|
| Content SHA-256 | Keyed purely on bytes, per `hooks/idempotency.mjs`'s rule. Survives rename, trash\ round-trip, G:\ mirror. Costs one read per file, mtime-gated | ✓ |
| absPath | Cheapest; but rename/move creates a phantom row, and the trash\ flow moves files by design | |
| absPath + size + mtime | No file reads; still duplicates on rename, and a backup restore rewrites mtime | |

**User's choice:** Content SHA-256 (→ D-05)

---

## Ingest trigger — media with no sidecar

| Option | Description | Selected |
|--------|-------------|----------|
| Ingest with provenance absent | Row created; provenance fields render "No provenance recorded" rather than blank or guessed (117 D-03) | ✓ |
| Skip it entirely | Gallery stays 100% provenance-complete; files silently vanish from a directory you're looking at | |
| Quarantine list | A separate needs-provenance lane. Most correct, most build — probably its own phase | |

**User's choice:** Ingest with provenance absent (→ D-07)

---

## Generator coverage — which backends

| Option | Description | Selected |
|--------|-------------|----------|
| Higgsfield CLI | Live and paid-up (ultra, 3537 credits); covers 4 of 8 media skills | ✓ |
| One direct-API recipe | A genuinely different code path from a CLI wrapper; donor is `caught_on_camera/src/ai/veo.ts` | ✓ |
| Ástríðr as generator | Cross-repo; the doc already seeded it to SEED-028 for astridr v29 | ✓ (initially) |
| OpenArt | CLI not on PATH; MCP exposes only authenticate. Needs an install + auth mid-phase | ✓ |

**User's choice:** all four — then narrowed by the follow-up below.
**Notes:** Selecting all four made the phase's close date depend on another repo's unstarted milestone, which was material enough to warrant a clarifying question rather than an assumption.

### Follow-up — blocking vs deferred

| Option | Description | Selected |
|--------|-------------|----------|
| OpenArt in, Ástríðr deferred | Gate = Higgsfield + direct-API + OpenArt, all proven in-phase; Ástríðr stays SEED-028/v29 but this phase writes the sidecar contract she implements against | ✓ |
| All four blocking | Opens astridr v29 work inside this phase; Studio's close owned by another repo — the pattern that left BSC-01 PARTIAL for a milestone | |
| Higgsfield + direct-API only | The doc's original gate; leaves two of four backends writing no provenance | |

**User's choice:** OpenArt in, Ástríðr deferred (→ D-09, D-10)

---

## Generator coverage — who writes the sidecar

| Option | Description | Selected |
|--------|-------------|----------|
| One /studio-generate wrapper | Reads the recipe card, calls the backend, writes media + sidecar. The 8 existing skills untouched; contract lives in one place | ✓ |
| Retrofit each generator skill | The doc's literal design. 8 skills edited, 8 drift points, cron-driven ones need headless re-testing | |
| Wrapper now, retrofit top 2 later | Wrapper this phase; retrofit informed by which skills show missing provenance | |

**User's choice:** One /studio-generate wrapper (→ D-11)

---

## Generator coverage — recipe cards

| Option | Description | Selected |
|--------|-------------|----------|
| Only reachable models | Cards only for models proven end-to-end in-phase. A card for an unrun model is an untested claim in an authoritative-looking table | ✓ |
| Seed from the Higgsfield model list | Broader library day one; mostly transcription rather than verification, with `enabled` as the only real/aspirational divider | |
| Defer recipe cards entirely | Smallest phase; guts "copy recipe", which the doc calls the point of the detail panel | |

**User's choice:** Only reachable models (→ D-12)

---

## Backfill vs greenfield

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — greenfield | Vault starts empty; 100% provenance-bearing from day one. Backfill becomes a clean follow-up | ✓ |
| The 48 Agent images | 16 MB, bounded, gives the grid real content — but the first thing you'd ever see in Studio is 48 rows of the degraded state | |
| Sweep all generator outputs | Most complete; output locations for 4 skills are currently unknown and unbounded in size | |

**User's choice:** Nothing — greenfield (→ D-13)

---

## Backup task

| Option | Description | Selected |
|--------|-------------|----------|
| In-phase, /MIR as specced | The doc's gate requires it; /MIR is safe because trash\ gives deletion a 30-day local grace. Same two scheduled-task guards | ✓ |
| In-phase, /E not /MIR | G: becomes append-only — nothing deleted locally can be lost, but G: grows forever and stops being a mirror | |
| Defer the backup task | media-vault is the only place originals exist; unbacked is one disk from total loss | |

**User's choice:** In-phase, /MIR as specced (→ D-14)

---

## Nav placement

| Option | Description | Selected |
|--------|-------------|----------|
| COMMAND, beside Galdr and Bifröst | Keeps the Seiðr suite together; zero new nav structure | ✓ |
| New MEDIA group | The doc's "own slot"; a one-item group reads as unfinished against groups of 5+ | |

**User's choice:** COMMAND (→ D-16)

---

## Soft-delete semantics

Raised by Claude at discussion close as an unsettled seam: the doc's gate says "deleting moves the file to trash and hides the row", but the browser cannot touch the filesystem.

| Option | Description | Selected |
|--------|-------------|----------|
| Mutation flags, watcher moves | Mutation sets deletedAt (row hides instantly); next watcher cycle moves the file to trash\. One host actor, reusing the scanner | ✓ |
| Command queue, daemon executes | Reuses the proven forgeCommands pattern with real acknowledgement; pulls Forge into a single-repo phase to build a channel for one verb | |
| No file move at all | Simplest; contradicts the gate, and /MIR keeps backing up media you believe you deleted | |

**User's choice:** Mutation flags, watcher moves (→ D-08)

### Follow-up — the pending state

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden from grid, visible in a Trash view | Trash filter + Restore makes the 30-day grace real and usable, and gives the janitor's window a purpose | ✓ |
| Hidden everywhere, no Trash view | Less to build; the grace period exists but is invisible, so in practice it would never be used | |

**User's choice:** Hidden from grid, visible in a Trash view (→ D-08)

---

## Claude's Discretion

Presented as a block at discussion close and not contested:

- **ffmpeg for both stills and video** — already on PATH, covers ≤200 KB webp encoding and video poster frames; no `sharp`/`jimp` added.
- **`media`/`mediaStyles`/`mediaModels` exempt from `RETENTION_DAYS`** — third application of 116 D-13's curated-not-firehose reasoning (→ D-03).
- **Ingest route bearer-gated, fail-closed, no CORS/OPTIONS** — 116 D-04 + 119 D-03/D-04 precedent (→ D-15).
- **Duplicate hash is an idempotent no-op, never a second row** (→ D-06).
- **Thumb blob deleted with the file at janitor time, not at soft-delete** — so Restore stays whole (→ D-08).
- Masonry/filter/star UX detail left to the design doc's §4.3 list; no existing masonry component to reuse.

## Deferred Ideas

- Backfill of `G:\My Drive\Agent images` (48 files / 16 MB) and digital-art-factory Drive output.
- A sweep for where `caught-on-camera`, `cryptidvlog`, `ugc-factory`, `youtube-engine` write.
- Ástríðr as a sidecar-writing generator — `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md`, v29.
- Retrofitting the 8 existing media skills to write their own sidecars.
- A quarantine / needs-provenance lane.
- In-browser full-size lightbox.
- Drag-reorder / manual curation UX in the gallery.

### Reviewed Todos (not folded)

- `111-devtools-issues-panel-entry-unexamined.md` (score 0.6) — matched only on generic keywords "plan"/"phase"; belongs to Phase 111's devtools surface.
- `llm-analytics-rollup-migration-cr01.md` (score 0.2) — matched on "phase"; unrelated analytics rollup work.
