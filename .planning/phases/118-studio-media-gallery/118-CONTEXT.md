# Phase 118: Studio Media Gallery - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

**Source of truth:** `docs/proposals/2026-08-07-seidr-suite-design.md` §4.3 (Seiðr Suite,
approved 2026-08-07). No REQ-IDs — the decisions D-01..D-16 below are the acceptance-bearing
units, same convention as Phases 116/117/119.

**Dependencies:** none on other CodePulse phases. The ROADMAP's `Depends on: Phase 117` line is
an auto-generated stub artifact — design doc §5 states 116–119 are mutually independent, and
117 is already COMPLETE regardless. §5 lists this phase's only dependency as "media-vault dir +
backup task", both created **in-phase**.

---

## Pre-flight — every design-doc claim checked before planning

Phases 117 and 119 both established that this document's claims are **claims**: §4.2's
host:port liveness join had no data behind it (117 D-02). One §4.3 claim fails the same way.

| Claim | Status |
|---|---|
| "uploads the thumb to Convex file storage" | ⚠️ **unproven — the path has never carried one byte on this backend.** Measured 2026-08-13 on the live self-hosted instance: `docker exec convex-backend` → `/convex/data/storage/files` contains **0 files** (control: `/convex/data/storage/modules` contains **407**, so the probe discriminates present from absent). Both real `imageStorageId` values on `avatars` resolve to `{"status":"success","value":null}` via `POST /api/query avatars:getImageUrl` (control: `avatars:list` on the same module returns real rows) — they are orphaned cloud-era IDs. The subsystem is *configured*; it has never been *exercised*. See D-01. |
| "ffmpeg poster frame for video" | ✓ **holds.** `ffmpeg 9.0-full` is on PATH (`Gyan.FFmpeg` via WinGet). No `sharp`/`jimp`/`masonry` dependency exists in `package.json`. |
| "Higgsfield MCP … generate one image via Higgsfield" (the gate) | ✓ **reachable, but via CLI, not MCP.** `higgsfield account status` → `mandrasle@gmail.com — ultra plan, 3537.27 credits`. The Higgsfield MCP surface available in-session exposes only `authenticate`/`complete_authentication`. Plan against the CLI. |
| "OpenArt MCP/CLI" | ✗ **CORRECTED 2026-08-13 (plan-phase): there is no OpenArt CLI to install.** The original row said "install + auth is an in-phase task"; that premise does not hold. Measured: npm `openart`, `openart-cli`, `@openart/cli` all **404** (control: `convex` → 200, so the probe discriminates); PyPI `openart` returns 200 but is an unrelated abandoned placeholder (v0.0.2, empty summary/description, `github.com/41337/openart`), while `openart-cli`/`openart-api` 404 (control: `requests` → 200); not on PATH (control: `higgsfield` → `AppData/Roaming/npm/higgsfield`). The only candidate programmatic surface is the hosted OAuth-gated MCP. See the D-09 amendment. |
| "direct API recipe cards (Google AI Studio / Kie / fal)" | ⚠️ **CORRECTED 2026-08-13 (plan-phase): the donor is a STUB, not a working path.** The original row claimed `veo.ts` "is a real direct-API generation path"; it is not. `~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts:73` and `:107` are literal `throw new Error('… not implemented')`, with the fal.ai queue/poll cycle written out only as TODO comments. It remains a useful **shape** donor (retry wrapper, env-key naming, cost accounting, queue/poll design) — but the direct-API leg is write-from-scratch, not port-a-donor. Plan the task accordingly. |
| "Ástríðr-as-generator" | ⚠️ **another repo's unstarted milestone.** The design doc itself routed it to `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md` as a **v29 candidate**. See D-10. |
| media directory `C:\Users\mandr\media-vault\` | ✗ absent — created in-phase, as designed. |
| backup target `G:\My Drive\media-vault` | ✗ absent — nothing half-built to reconcile. |
| "UI in the ACTIVITY nav group" | ✗ **no `ACTIVITY` group exists.** `src/lib/navRegistry.ts` has COMMAND / GRAPHS / AGENTS / OBSERVE. See D-16. |
| Blob discipline is load-bearing | ⚠️ context: `/convex/data/db.sqlite3` is already **7.1 GB**. The 200 KB cap is not decoration. |

---

<domain>
## Phase Boundary

Studio delivers: a `media-vault` directory on disk that generators write media **plus sidecar
JSON** into; a host-side watcher that turns new files into `media` rows with bounded thumbnails;
and a `/studio` gallery in CodePulse that browses, filters, stars, soft-deletes and exposes the
full generation recipe for each item — with `mediaStyles` and `mediaModels` as the supporting
curated tables.

**Not in this phase:** an in-browser full-size viewer or lightbox (D-02); backfill of any
pre-existing media (D-13); Ástríðr as a sidecar-writing generator (D-10); retrofitting the eight
existing media skills (D-11); a quarantine/needs-provenance lane (deferred).

</domain>

<decisions>
## Implementation Decisions

### Thumbnail transport

- **D-01: Thumbnails go to Convex file storage as the design doc says — but the phase's FIRST
  plan is a BLOCKING proving round-trip, and nothing else is built until it passes.** The pre-flight
  table above shows this mechanism has never carried a byte on this backend. The proof is an
  end-to-end `generateUploadUrl` → upload → `getUrl` → **HTTP 200 with a non-zero body** against
  `127.0.0.1:3210`, paired with the known-null control (an orphaned `avatars` storage ID must
  still return `null` in the same run) so a pass discriminates. This mirrors Phase 116's
  `116-05-PLAN.md` blocking-deploy wave.
  **If the round-trip fails, the fallback is a local static origin serving `media-vault\.thumbs\`
  with the row carrying a relative path** — and that fallback must be decided from the probe
  result *before* any UI work, never discovered during it.

  **AMENDMENT 2026-08-14 (plan 118-01, live measurement).** `BRANCH: convex-storage`. The
  control-paired proof round in `118-D01-EVIDENCE.md` PASSED: a freshly minted storage ID
  uploaded 4096 bytes and read back HTTP 200 with 4096 bytes received, while the known-null
  control (`avatars.imageStorageId kg2589rnrbawjb3g2867yjn3c586zngt`) resolved `null` in the
  same run — a discriminating pass, not a proxy signal. The `local-static-origin` fallback is
  **not needed** and no fallback operational surface (second static server, third scheduled
  task) is created by this phase.

  **Schema field this branch selects:** `media.thumbStorageId: v.optional(v.id("_storage"))` is
  the populated field on every row; `media.thumbRelPath: v.optional(v.string())` is declared in
  the schema (so the row shape doesn't have to change if this branch is ever revisited) but is
  always absent — exactly one of the two is populated per row.

  **Origin the watcher must use:** the URL Convex returns **verbatim** from both
  `generateUploadUrl` (for the raw upload POST) and `getImageUrl` (for reading it back) — no
  origin rewrite is needed. On this backend that resolves to the tailnet hostname
  `https://lmofficenew.tail5bb6b3.ts.net`, and it was directly reachable from the host running
  the watcher. `hooks/studioWatch.mjs` may keep a defensive fallback to
  `http://127.0.0.1:3211` (matching `scripts/probe-convex-storage.mjs`'s A2 handling) as cheap
  insurance, but the live measurement shows it will not fire in practice.

- **D-02: Hard ≤200 KB webp cap, and the browser never loads the original.** A full-size upload is
  a bug, not a tuning issue. Originals never enter Convex (design doc §4.3 + §6). The detail panel
  shows the thumb, the full recipe and a **copy-path** button; opening the original is a local
  action. This deliberately avoids making a second HTTP origin load-bearing for core UX.

- **D-03: `media`, `mediaStyles` and `mediaModels` are EXEMPT from `RETENTION_DAYS`.** Direct
  application of Phase 116 D-13 (`convex/retention.ts:126-141`): these are curated libraries, the
  opposite of a firehose, and `pruneBatchV3` deletes by whole-table `_creationTime` cutoff — so a
  calendar rule would delete a starred image for the sole offence of being old. Growth is bounded
  by the janitor (D-08), not by age. **Do not add these keys to `RETENTION_DAYS`** — it would pass
  `retention.test.ts`'s table-existence check while being semantically wrong.

### Ingest

- **D-04: A Windows scheduled task every 5 minutes, plus a manual `/studio-sync`.** Single-repo,
  matching 116/117/119. Two guards are locked with it because both have already cost real time:
  **no AC-power condition** — `DisallowStartIfOnBatteries=true` silently no-ops the entire action
  with no error and unreliable `LastTaskResult` (ClaudeConfigPull went 5+ weeks that way) — and
  **launch via `run-hidden.vbs`, never `-WindowStyle Hidden`**, which pops a persistent Windows
  Terminal window whose close console-kills the task's whole tree. The manual path exists so the
  gate does not have to wait 5 minutes for evidence.

- **D-05: Row identity is the file's content SHA-256.** `hooks/idempotency.mjs` already
  establishes the governing rule for this repo: a dedup key must derive **purely from content**,
  never from anything path- or process-local. A content hash survives rename, the `trash\` move
  and restore (D-08), and the `G:\` mirror round-trip — where `absPath` breaks on the exact
  operation this phase ships, and `path+size+mtime` re-ingests after a backup restore. `mtime` may
  gate *whether* to re-hash; it may not be part of the key.

- **D-06: A duplicate hash is an idempotent no-op, never a second row.** Same shape as 119 D-06's
  refuse-don't-implicit-create. A rescan of an unchanged vault must produce zero writes.

- **D-07: A file with no sidecar is ingested with provenance explicitly ABSENT.** The row is
  created and is visible, star-able and filterable; `prompt`/`model`/`provider`/`style` render as
  **"No provenance recorded"** — never blank, never inferred from the filename. This is 117 D-03's
  rule (a missing signal must not render as a positive one) applied to metadata. Silently skipping
  the file was rejected: a file vanishing from a directory you are looking at is the failure mode
  with no diagnostic.

- **D-08: Soft-delete is mutation-flags-then-watcher-moves, and the grace period is visible.** The
  Convex mutation sets `deletedAt` and the row leaves the default grid immediately — the UI needs
  no host round-trip. The next watcher cycle (≤5 min, or immediately via `/studio-sync`) sees
  `deletedAt` set with the file still in `gen\` and moves it to `trash\`. A **Trash view** filters
  on `deletedAt` and offers **Restore** (clears `deletedAt`; the watcher moves the file back). The
  30-day janitor then deletes the file **and its thumb blob together** — the blob is *not* deleted
  at soft-delete time, precisely so Restore stays whole. A Forge-daemon command queue was
  considered and rejected: it would build a bidirectional command channel for one verb and pull a
  second repo into a deliberately single-repo phase.

### Generators & provenance

- **D-09: Three backends must be proven end-to-end before this phase closes — Higgsfield CLI, one
  direct-API recipe, and OpenArt.** Higgsfield is live today; the direct-API path is a genuinely
  different code shape from a CLI wrapper, which is what proves the sidecar contract is not
  CLI-shaped (donor: `caught_on_camera/src/ai/veo.ts`); OpenArt requires a local CLI install +
  auth, which is an in-phase task, not a dependency on anyone else.

  **AMENDMENT 2026-08-13 (plan-phase, confirmed with Larry).** The decision's *intent* — three
  genuinely different code shapes proven end-to-end — is UNCHANGED and still binding. Two of its
  stated premises were falsified by the pre-flight corrections above, so the mechanisms change:

  1. **OpenArt leg → time-boxed MCP probe with a planned fallback.** There is no CLI to install.
     Plan an **early discovery task**: authenticate the hosted OpenArt MCP and enumerate the tools
     that appear *post-auth* (a pre-auth surface exposing only `authenticate` /
     `complete_authentication` is normal and is not evidence that generation tools are absent —
     that is exactly the false-negative shape this phase's gate standard exists to prevent). If
     real generation tools appear, plan the third leg against **MCP**, which is arguably a better
     third shape than a CLI for proving the sidecar contract is not CLI-shaped. If they do not,
     **swap in a second direct-API provider** and record the swap as a decision amendment. The
     probe outcome must be resolved *before* the third leg's implementation task starts — never
     discovered during it (same rule D-01 applies to the storage round-trip).
  2. **Direct-API leg targets fal.ai.** Not previously locked by this document; now locked.
     `veo.ts`'s TODO comments already spell out fal.ai's queue/poll cycle, endpoints and auth
     header shape, so it is a written recipe rather than a blank page — but see the corrected
     pre-flight row: the code itself throws, so this is an implementation task, not a port.
     Requires `FAL_KEY`, which stays in `.env`/1Password per D-12.

- **D-10: Ástríðr as a generator is DEFERRED to `SEED-028` / astridr v29 — stated so the absence
  reads as a decision.** This phase writes the **sidecar contract document** she will implement
  against, so the deferral is a handoff rather than a gap. Making her blocking would put Studio's
  close date inside another repo's unstarted milestone — the exact pattern that left BSC-01
  PARTIAL for a whole milestone.

- **D-11: One new `/studio-generate` wrapper skill owns sidecar writing; the eight existing media
  skills are NOT touched.** (`higgsfield-generate`, `-marketplace-cards`, `-product-photoshoot`,
  `-soul-id`, `digital-art-factory`, `caught-on-camera`, `cryptidvlog`, `ugc-factory`.) The
  wrapper reads the chosen model's `recipeMd`, calls the backend, then writes media + sidecar — so
  the contract lives in exactly one place and cannot drift eight ways. Media generated by calling
  those skills directly still lands without a sidecar, which is now a **defined** behaviour (D-07),
  not an unhandled case.

- **D-12: `mediaModels.recipeMd` cards exist ONLY for models proven end-to-end in this phase.** A
  card for a model nobody has run is an untested claim sitting in a table that reads as
  authoritative — the same stale-doc shape this project keeps paying for. Seeding cards from the
  Higgsfield model list was rejected: it is transcription, not verification. `enabled` is not a
  substitute for having actually run the thing.
  **Keys stay in `.env`/1Password. `recipeMd` references key NAMES only; Convex stores no keys.**

### Vault & surfaces

- **D-13: Greenfield — nothing is backfilled.** `media-vault` starts empty; only media generated
  after this phase appears. This keeps the gallery 100% provenance-bearing on day one and keeps
  "copy recipe" always working. Candidates that exist and were deliberately left out:
  `G:\My Drive\Agent images` (48 files / 16 MB, hash-named, no sidecars) and the
  digital-art-factory Drive output. Backfill is a clean follow-up once the pipeline is proven.

- **D-14: `MediaVaultBackup` ships in-phase as nightly `robocopy C:\Users\mandr\media-vault
  "G:\My Drive\media-vault" /MIR /R:2 /W:5`.** The design doc's own gate requires it, and
  `media-vault` is the only place originals exist. `/MIR` is correct in this direction **because**
  `trash\` gives deletion a 30-day local grace before the mirror drops it. `backup.log` lives in
  `media-vault\` and is excluded from the mirror. Same two scheduled-task guards as D-04: no
  battery condition, `run-hidden.vbs` launch.

- **D-15: The ingest route is bearer-gated, fail-closed, with no CORS and no OPTIONS partner.**
  Direct precedent: Phase 116's `validateGaldrAuth` and 119 D-03/D-04. The watcher is an
  agent/CLI caller; the browser never calls it and reads through Convex subscriptions instead. An
  unauthenticated POST must 401 **before** touching the db.

- **D-16: `/studio` lands in the COMMAND nav group, beside Galdr and Bifröst.** The design doc's
  "ACTIVITY or own slot" names a group that does not exist. COMMAND is where the other two Seiðr
  surfaces landed and is the same "curated thing you reach for" shape; Loom sits in GRAPHS only
  because it is a React Flow view. A one-item MEDIA group was rejected — every existing group has
  5+ entries.

### Claude's Discretion

Confirmed with Larry at discussion close, recorded so downstream agents do not re-litigate:

- **ffmpeg for both stills and video** — one already-present dependency covers ≤200 KB webp
  encoding *and* video poster frames. Do not add `sharp` or `jimp`.
- Retention exemption wording and placement in `convex/retention.ts` (D-03) follows the D-13
  comment block verbatim in style.
- Masonry/filter/star UX detail is not pre-specified beyond the design doc's §4.3 list; there is
  no existing masonry component in `src/components/` to reuse.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase source of truth
- `docs/proposals/2026-08-07-seidr-suite-design.md` §4.3 — the Studio feature design: filesystem
  layout, schema field lists for `media`/`mediaStyles`/`mediaModels`, UI shape, recipe cards,
  backup command, and the acceptance gate. §6 carries the blob-discipline and secrets constraints.
  **Read §4.3 against the pre-flight table above — one of its claims does not hold.**

### Sibling-phase conventions this phase inherits
- `.planning/phases/116-galdr-prompt-library/116-CONTEXT.md` — `validateGaldrAuth` bearer pattern
  (D-04), retention exemption for curated tables (D-13), blocking-deploy wave shape.
- `.planning/phases/117-bifrost-link-hub/117-CONTEXT.md` — D-02/D-03: a design-doc mechanism that
  did not exist, and the rule that an absent signal must never render as a positive one.
- `.planning/phases/119-loom-curated-pipelines/119-CONTEXT.md` — D-03/D-04 (bearer-gated, no CORS
  for agent/CLI routes), D-06 (refuse, never implicit-create), and the control-pair gate standard.

### Code this phase builds on
- `convex/avatars.ts:63-83` — the only existing `ctx.storage` usage: `generateUploadUrl`,
  `saveImage`, `getImageUrl`. The pattern to copy for D-01, and the source of the orphaned IDs.
- `convex/retention.ts:38-142` — `RETENTION_DAYS` and the D-13 exemption comment that D-03 extends.
- `hooks/idempotency.mjs` — the content-derived-key rule behind D-05, with its own rationale.
- `hooks/scanner.mjs`, `hooks/ingestPost.mjs`, `hooks/codepulse-hook.mjs`, `hooks/loom-emit.mjs` —
  the `.mjs` host-side POSTer family the watcher joins (AbortController + timeout, env-var-first
  URL/key resolution, no shebang per DEBT-05).
- `src/lib/navRegistry.ts:124-138` — the COMMAND group `iconComponents` + `items` seam for D-16.
- `~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts` — direct-API generation
  donor for D-09.
- `~/.claude/skills/higgsfield-generate/SKILL.md` — the `higgsfield` CLI contract for D-09.

### Operational rules that constrain this phase
- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — no mass mutation of the live instance;
  the deploy MUST be `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`
  (a bare deploy can target the retired cloud deployment); public mutations are callable without
  credentials by anything that can route to the host, so a write that must be gated has to be an
  `internalMutation`.
- `e2e/galdr.spec.ts`, `e2e/bifrost.spec.ts`, `e2e/loom.spec.ts`, `e2e/navigation.spec.ts` — the
  reachability-proof pattern the three sibling phases were verified with (a real click-through,
  not a unit test).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`convex/avatars.ts`** — complete `_storage` round-trip (upload URL → save → getUrl) plus
  `AvatarUploader.tsx` / `AgentAvatar.tsx` on the client. The only prior art for D-01.
- **`hooks/*.mjs` family** — 15 modules; `ingestPost.mjs` and `loom-emit.mjs` are the closest
  donors for the watcher's POST half. `hooks/__tests__/` shows how these are unit-tested.
- **`convex/retention.ts`** — `pruneBatchV3` and the batch-capped sweep the janitor should
  resemble rather than reinvent.
- **`src/pages/Galdr.tsx` / `Bifrost.tsx`** — the two most recent card-grid + filter-chip page
  builds in this repo; the closest UX analogues to the masonry gallery.

### Established Patterns
- **Bearer-authed agent HTTP route, no CORS, no OPTIONS** (116/119) — the watcher's ingest route
  follows it exactly.
- **Curated table ⇒ retention-exempt; growth-prone child ⇒ count-bounded inline** (116 D-13 +
  119 D-05) — D-03 is the third application.
- **`navRegistry.ts` is the single nav source**; `DashboardLayout` and `CommandPalette` both
  consume it. Do not add nav entries in `DashboardLayout.tsx`.
- **Lucide icon NAMES, never inline SVG** (117 D-01).
- **Every gate is a control pair** (117, 119) — a passing assertion that would look identical when
  broken is not evidence.

### Integration Points
- `convex/schema.ts` — three new tables after `pipelineRuns` (`:2339`) / `workspaceSnapshots`
  (`:2393`).
- `convex/http.ts` — one new bearer-gated route for the watcher.
- `src/App.tsx` + `src/lib/navRegistry.ts` — `/studio` route + COMMAND nav entry.
- Host filesystem: new `C:\Users\mandr\media-vault\{gen,refs,styles,trash}\`; two new scheduled
  tasks (`StudioWatch`, `MediaVaultBackup`).
- `~/.claude/skills/` — one new `/studio-generate` skill and one `/studio-sync` entry point.

</code_context>

<specifics>
## Specific Ideas

- The gate must be a **control pair**, not a set of independent assertions. Concretely: a
  generated image appears with a **complete** recipe in the same view as a sidecar-less file
  rendering **"No provenance recorded"** — that pair proves the provenance path actually
  discriminates. A single "the image appeared" assertion looks identical when the sidecar reader
  is broken and silently returns nothing.
- Same for the D-01 storage proof: pair the successful upload round-trip with the known-null
  orphaned `avatars` storage ID in the same run.
- Deleting must be shown to move the file to `trash\` **and** to hide the row **and** to be
  restorable — the doc's gate stops at the first two.

</specifics>

<deferred>
## Deferred Ideas

- **Backfill of pre-existing media** — `G:\My Drive\Agent images` (48 files / 16 MB) and the
  digital-art-factory Drive output. Deliberately excluded by D-13; a clean follow-up once the
  ingest pipeline is proven. Requires deciding whether provenance-less rows are acceptable in bulk.
- **A sweep for the other generators' output locations** — where `caught-on-camera`, `cryptidvlog`,
  `ugc-factory` and `youtube-engine` actually write is currently unknown and is its own
  investigation.
- **Ástríðr as a sidecar-writing generator** — `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md`,
  v29 (D-10). This phase hands off the contract.
- **Retrofitting the eight existing media skills to write their own sidecars** — the design doc's
  literal "written by whoever generates" model. D-11 defers it behind the wrapper; the gallery's
  provenance-absent rows will show which skills are worth retrofitting first.
- **A quarantine / "needs provenance" lane** — ingested media held separately until a sidecar is
  attached. Considered and judged its own phase.
- **In-browser full-size lightbox** — requires making a second local origin load-bearing (D-02).
- **Drag-reorder / manual curation UX in the gallery** — not raised as needed.

### Reviewed Todos (not folded)
- `111-devtools-issues-panel-entry-unexamined.md` (score 0.6) — matched only on the generic
  keywords "plan"/"phase"; belongs to Phase 111's devtools surface, not to media.
- `llm-analytics-rollup-migration-cr01.md` (score 0.2) — matched on "phase"; unrelated analytics
  rollup work.

</deferred>

---

*Phase: 118-studio-media-gallery*
*Context gathered: 2026-08-13*
