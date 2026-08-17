# Phase 118: Studio Media Gallery - Research

**Researched:** 2026-08-13
**Domain:** Local-filesystem media ingest pipeline (Node watcher + ffmpeg) + Convex file storage +
React masonry gallery, all inside an existing self-hosted-Convex/CodePulse repo with three
established sibling phases (116/117/119) to match conventions against.
**Confidence:** MEDIUM-HIGH overall. HIGH on everything grounded in this repo's own code
(auth pattern, retention pattern, scheduled-task pattern, schema conventions). MEDIUM on the
Convex-storage round-trip mechanics (grounded in official docs + this backend's own config, but
D-01's proof has not yet run). LOW, and flagged as a workability concern, on OpenArt's
programmatic surface — see the dedicated section below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-16 — research targets these, not alternatives)

- **D-01:** Thumbnails go to Convex file storage per the design doc, but the phase's FIRST plan is
  a BLOCKING proving round-trip (`generateUploadUrl` → upload → `getUrl` → HTTP 200 non-zero body,
  paired with the known-null orphaned-`avatars` control). If it fails, the fallback is a local
  static origin serving `media-vault\.thumbs\` with the row carrying a relative path, decided
  from the probe result before any UI work.
- **D-02:** Hard ≤200KB webp cap; browser never loads the original. Detail panel shows thumb +
  recipe + copy-path; opening the original is a local action. No lightbox.
- **D-03:** `media`, `mediaStyles`, `mediaModels` are EXEMPT from `RETENTION_DAYS` (curated
  libraries, not a firehose). Growth is bounded by the D-08 janitor, not by age. Do NOT add these
  keys to `RETENTION_DAYS`.
- **D-04:** Windows scheduled task every 5 minutes + manual `/studio-sync`. No AC-power condition;
  launch via `run-hidden.vbs`, never `-WindowStyle Hidden`.
- **D-05:** Row identity is the file's content SHA-256 — never path/process-local. `mtime` may
  gate whether to re-hash; never part of the key.
- **D-06:** A duplicate hash is an idempotent no-op, never a second row.
- **D-07:** A file with no sidecar is ingested with provenance explicitly ABSENT — renders "No
  provenance recorded", never blank/inferred. Never silently skipped.
- **D-08:** Soft-delete is mutation-flags-then-watcher-moves. `deletedAt` set by the browser
  mutation (row leaves grid immediately, no host round-trip needed); next watcher cycle moves the
  file `gen\` → `trash\`. Trash view offers Restore (clears `deletedAt`; watcher moves file back).
  30-day janitor deletes file AND thumb blob together (blob NOT deleted at soft-delete time, so
  Restore stays whole).
- **D-09:** Three backends proven end-to-end before close: Higgsfield CLI, one direct-API recipe,
  OpenArt. Higgsfield live today; direct-API path proves the sidecar contract isn't CLI-shaped;
  OpenArt needs local install + auth as an in-phase task.
- **D-10:** Ástríðr-as-generator is DEFERRED to astridr SEED-028 / v29. This phase writes the
  sidecar contract doc she implements against later.
- **D-11:** One new `/studio-generate` wrapper skill owns sidecar writing. The eight existing
  media skills are NOT touched; media from them lands without a sidecar (defined D-07 behavior).
- **D-12:** `mediaModels.recipeMd` cards exist ONLY for models proven end-to-end this phase. Keys
  stay in `.env`/1Password; `recipeMd` references key NAMES only.
- **D-13:** Greenfield — nothing backfilled. `media-vault` starts empty.
- **D-14:** `MediaVaultBackup` ships in-phase, nightly `robocopy ... /MIR /R:2 /W:5`. Same two
  scheduled-task guards as D-04.
- **D-15:** Ingest route is bearer-gated, fail-closed, no CORS, no OPTIONS partner. Watcher is an
  agent/CLI caller; browser reads through Convex subscriptions only.
- **D-16:** `/studio` lands in the COMMAND nav group, beside Galdr and Bifröst.

### Claude's Discretion (confirmed with Larry, recorded so downstream agents do not re-litigate)

- ffmpeg for both stills and video — one already-present dependency; do not add `sharp`/`jimp`.
- Retention exemption wording/placement follows the D-13 (Phase 116) comment block verbatim in
  style.
- Masonry/filter/star UX detail: fully specified now by `118-UI-SPEC.md` (approved, revision 1).
  Treat the UI-SPEC as authoritative over this discretion note wherever the two might diverge.

### Deferred Ideas (OUT OF SCOPE)

- Backfill of pre-existing media (`G:\My Drive\Agent images`, digital-art-factory Drive output).
- A sweep for other generators' (caught-on-camera/cryptidvlog/ugc-factory/youtube-engine) output
  locations — its own investigation.
- Ástríðr as a sidecar-writing generator (SEED-028, v29).
- Retrofitting the eight existing media skills to write their own sidecars.
- A quarantine/"needs provenance" lane.
- In-browser full-size lightbox.
- Drag-reorder / manual curation UX.
</user_constraints>

## Decision -> Research Support Map

No REQ-IDs exist for this phase (CONTEXT.md is explicit: D-01..D-16 are the acceptance-bearing
units). This table plays the role `<phase_requirements>` would for a REQ-ID phase.

| Decision | Research support in this document |
|---|---|
| D-01 | "D-01: Convex file storage round-trip" — exact upload contract, why the orphaned-avatars null is best explained as unmigrated storage (not a broken mechanism), and the concrete fallback architecture (a second local static server; Convex cannot reach the host filesystem). |
| D-02 | "ffmpeg webp encoding" — concrete invocations + a bounded quality/scale search loop to *guarantee*, not hope for, the cap. |
| D-03 | "Retention exemption" — exact comment-block precedent and the `RETENTION_DAYS`-typo trap CONTEXT.md names. |
| D-04, D-14 | "Windows scheduled tasks" — a complete, already-proven-on-this-machine exemplar (`install-workspace-scan-task.ps1` + `run-workspace-scan.ps1`) satisfying both locked guards, plus `run-hidden.vbs`'s confirmed location. |
| D-05, D-06, D-07 | "The host-side watcher" — the `.mjs` house conventions, `buildIdempotencyKey`'s exact content-only-key rule, and the 4,096-read-limit trap for a naive collect-then-insert watcher. |
| D-08 | "Retention exemption" + "Don't Hand-Roll" — `forge.ts`'s proven blob-first-then-row delete ordering, and the anti-pattern (`sweepForgeFileRecords`'s unbatched `.collect()`) to avoid copying. |
| D-09, D-11, D-12 | "The three generator backends" — Higgsfield CLI's exact `--wait --json` contract; `veo.ts`'s TRUE state (unimplemented stub, shape-only donor); the OpenArt workability concern (dedicated section, LOW confidence, needs an in-phase discovery task). |
| D-10 | Confirmed out of scope; no research needed beyond citing the seed doc, done in CONTEXT.md already. |
| D-13 | No research needed — a pure scoping decision. |
| D-15 | "The bearer-gated ingest route" — `validateLoomAuth`/`loomHttp.ts` as the literal pattern to copy, plus the internalMutation-vs-public-mutation split this phase needs that its sibling phases didn't (star/soft-delete ARE browser-called). |
| D-16 | "`/studio` page construction" — exact `navRegistry.ts` insertion point and icon slot, confirmed unclaimed. |

## Summary

Studio is a three-part build: (1) a Convex schema + bearer-gated ingest surface that is a close
structural copy of Phase 119's Loom (`loomHttp.ts` / `validateLoomAuth` / `internalMutation`
writes), with one real difference — star/soft-delete are *browser*-called and must stay `mutation`,
not `internalMutation`; (2) a host-side Node watcher that joins the `hooks/*.mjs` family
(`ingestPost.mjs`'s POST-with-bearer helper, `loom-emit.mjs`'s fail-loud CLI shape,
`idempotency.mjs`'s content-only-key rule) plus two new Windows scheduled tasks that must copy
`scripts/install-workspace-scan-task.ps1` almost verbatim — that script is a complete, already
machine-proven exemplar of both D-04/D-14 guards (no AC-power condition,
`run-hidden.vbs`-via-`wscript.exe` launch) and even anticipates a PowerShell footgun
(`$x = if(){@()}` unrolling) this phase's own watcher wrapper should avoid; (3) a `/studio` React
page that is fully specified by the approved `118-UI-SPEC.md` and needs no new npm dependency —
CSS-columns masonry, composed entirely from already-installed shadcn primitives.

The one genuinely open technical question is D-01: whether `generateUploadUrl` → upload → `getUrl`
actually round-trips bytes on this self-hosted backend. Official Convex docs plus this backend's
own `docker-compose.yml` config resolve *most* of the uncertainty — the mechanism is real and its
URL contract is well-documented — but the CONTEXT.md pre-flight finding (both real `avatars`
storage IDs resolve to `null`) is very plausibly explained by an incomplete cloud→self-hosted
migration of the storage *volume* (the DB rows carrying `imageStorageId` migrated; the referenced
blobs in `_storage`/`/convex/data/storage/files` did not), which is a different failure mode than
"the mechanism doesn't work" and would mean today's proof round-trip *succeeds*. This document
lays out both branches concretely, including the fallback's real architectural cost (Convex runs
inside a Docker container with no access to the host `media-vault` directory, so "serve
`.thumbs\` locally" means standing up a second tiny static file server, not a Convex change) —
so whichever way the D-01 probe lands, the very next task is already plannable.

The second open item is a genuine workability concern about D-09/D-12's OpenArt leg: extensive
search found no OpenArt CLI product and no npm package (`openart`, `openart-cli`, `@openart/cli`
all 404 on the npm registry) — only a hosted MCP server (`https://mcp.openart.ai/mcp`, OAuth,
"zero API keys") that authenticates interactively through an MCP-capable client. This directly
conflicts with "install + auth" as a literal headless CLI task. It is flagged, not resolved here,
because D-09 is locked and the resolution is a planning-time choice among several real options
(see below) — not a research verdict.

**Primary recommendation:** Build Studio as Loom's schema/HTTP/watcher shape plus Galdr/Bifröst's
page shape, verbatim where the pattern already exists in this repo, and treat D-01 and the OpenArt
leg as the two items needing a discovery/proof task before the rest of the plan can be written
around their outcome.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Media generation (Higgsfield/OpenArt/direct-API) | External service / local CLI | — | Runs outside CodePulse entirely; CodePulse never calls a generator API. |
| Sidecar + file writing | Host filesystem (`/studio-generate` skill) | — | The skill writes bytes to `media-vault\gen\`; this is agent/CLI-tier, not Convex. |
| Thumbnail encoding (ffmpeg) | Host filesystem (watcher) | — | Runs on the host at ingest time, before anything reaches Convex. |
| Ingest (file -> `media` row) | API/Backend (Convex `internalMutation` via bearer HTTP route) | Host (watcher process) | The watcher is the CLIENT; Convex is the system of record. Matches Loom's shape exactly. |
| Thumbnail bytes storage | Database/Storage (Convex `_storage`) or CDN/Static (fallback local server) | — | D-01 branch-dependent; see dedicated section. |
| Gallery browse/filter/search | Browser/Client (React, `useQuery` subscriptions) | API/Backend (Convex queries) | Read-only from the browser's perspective; all state lives in Convex. |
| Star toggle / soft-delete | Browser/Client triggers | API/Backend (Convex **public** `mutation`, NOT `internalMutation`) | Unlike ingest, these ARE legitimately browser-initiated — the one place this phase's auth shape diverges from Loom/Galdr's "agent-only write" pattern. |
| Soft-delete file move (`gen\`->`trash\`) | Host filesystem (watcher, next cycle) | — | The Convex mutation only flags `deletedAt`; the watcher performs the actual file move, matching D-08. |
| 30-day permanent delete (janitor) | API/Backend (Convex `internalMutation`, batch-capped) | Host filesystem (file deletion, same or paired step) | Must delete the Convex thumb blob AND the host `trash\` file; the row-only half is Convex-tier, the file-only half needs either the watcher or an action with host access. |
| Nightly `G:\` backup | Host filesystem (`robocopy` scheduled task) | — | Never touches Convex at all. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| ffmpeg | 9.0-full (Gyan.FFmpeg, WinGet) | Still→webp encode, video→poster-frame→webp encode | `[VERIFIED: ffmpeg -version output]` — already on PATH, confirmed 2026-08-13. No new dependency; explicitly mandated by CONTEXT.md discretion note ("do not add sharp or jimp"). |
| Convex (`_storage` API) | matches this repo's existing `convex` devDependency | Bounded thumbnail blob storage (D-01 primary branch) | `[VERIFIED: convex/avatars.ts:63-85]` — the only prior art in this repo, already reviewed line-by-line. |
| Node.js (built-in `fs`/`crypto`/`fetch`) | matches this repo's Node version (used by `hooks/*.mjs`) | Watcher: directory scan, SHA-256 hashing, HTTP POST | `[VERIFIED: hooks/idempotency.mjs, hooks/loom-emit.mjs]` — zero new npm dependency, matching the existing `.mjs` family's house convention of no third-party deps. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `higgsfield` CLI | live install (`~/AppData/Roaming/npm/higgsfield[.cmd]`) | Generator backend #1 | `[VERIFIED: higgsfield account status → ultra plan, 3537.27 credits, 2026-08-13]`. Already on PATH. |
| `~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts` | n/a (donor file, not a package) | Generator backend #2 shape donor (direct-API) | `[VERIFIED: file read 2026-08-13]` — **the generation calls are UNIMPLEMENTED stubs that `throw`** (see Common Pitfalls). Use for the queue/poll/retry SHAPE only; the actual HTTP calls must be written fresh against whichever provider is chosen (fal.ai, Google AI Studio, or Kie — design doc §4.3 names all three as candidates). |
| OpenArt | none found | Generator backend #3 | **See "OpenArt workability concern" below before planning this leg — do not assume a CLI exists.** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| CSS-columns masonry (UI-SPEC's choice) | A JS masonry library (`react-masonry-css`, `masonic`) | Forbidden by CONTEXT.md discretion note; CSS-columns needs no dependency and is sufficient for the UI-SPEC's accepted column-major reading-order tradeoff. |
| ffmpeg fixed-quality webp | `cwebp` (Google's own encoder) | `cwebp` gives more direct size-target control (`-size` flag) but is a SECOND binary not currently on PATH; ffmpeg's `libwebp` encoder plus a quality/scale search loop achieves the same bound with the one dependency already installed. Not recommended — stick with ffmpeg per CONTEXT.md discretion. |
| Convex file storage (D-01 primary) | A local static file server (D-01 fallback) | Only if the D-01 proof round-trip fails; see dedicated section for the real cost of this branch. |

**Installation:** No `npm install` needed for this phase's core mechanism (ffmpeg, Convex storage,
and Node built-ins are all already present). `higgsfield` CLI is already installed. OpenArt's
install path is unresolved — see below.

**Version verification:** `ffmpeg -version` → `9.0-full_build-www.gyan.dev` (run 2026-08-13).
`higgsfield version` was not re-run separately but `higgsfield account status` succeeded, which
requires a working installed binary. `npm view openart / openart-cli / @openart/cli version` all
returned `404 Not Found` (run 2026-08-13) — see below.

## Package Legitimacy Audit

No new npm packages are recommended by this research (ffmpeg is a system binary already on PATH;
Convex, Node built-ins, and shadcn primitives are all already dependencies of this repo). The one
candidate package name that came up — `openart` / `openart-cli` / `@openart/cli` — was checked and
does **not exist** on the npm registry (three separate `404 Not Found` responses, 2026-08-13). It
is not recommended for installation under any of those names; if a real OpenArt CLI is discovered
during planning under a different name, it must go through this same audit before being added to
a plan.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `openart` | npm | n/a — does not exist | n/a | n/a | not run (404 before slopcheck needed) | REMOVED — do not add to any plan |
| `openart-cli` | npm | n/a — does not exist | n/a | n/a | not run | REMOVED |
| `@openart/cli` | npm | n/a — does not exist | n/a | n/a | not run | REMOVED |

**Packages removed due to a hallucination/non-existence finding:** `openart`, `openart-cli`,
`@openart/cli` — none exist on the npm registry; the design doc's "OpenArt MCP/CLI" phrase should
not be read as implying a real CLI product exists at any of these names.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
 Generators (Higgsfield CLI / direct-API script / OpenArt)
        |  writes file + sidecar JSON
        v
 C:\Users\mandr\media-vault\{gen,refs,styles}\   <-- host filesystem, NOT Convex
        |
        |  every 5 min (scheduled task) OR on-demand (/studio-sync)
        v
 hooks/studioWatch.mjs  (new watcher, joins the .mjs family)
   1. scan dir for new/changed files (mtime gates re-hash)
   2. SHA-256 each candidate -> row identity (D-05)
   3. pair with sidecar JSON if present, else mark provenance ABSENT (D-07)
   4. skip if hash already known (D-06, idempotent no-op)
   5. ffmpeg -> bounded webp thumbnail (still, or video poster-frame)
        |
        |  POST bearer-gated ingest route (D-15, no CORS, no OPTIONS)
        v
 convex/studioHttp.ts  (httpAction, validateStudioAuth FIRST, before any db access)
        |
        |  ctx.runMutation(internal.media.*)  <-- internalMutation, browser can't call it
        v
 Convex: generateUploadUrl (internalMutation wrapping ctx.storage.generateUploadUrl)
        |
        |  watcher does the RAW PUT/POST directly to the returned Convex-owned URL
        |  (this is Convex's own storage endpoint, not a codepulse http.ts route --
        |  no separate bearer needed, the URL itself is a one-time signed token)
        v
 Convex _storage  (or: local static server, D-01 fallback branch)
        |
        |  watcher POSTs {storageId, sidecar} to the commit route
        v
 convex/media.ts: ingestMedia (internalMutation) -> `media` table row
        |
        |  useQuery(api.media.list) subscription
        v
 src/pages/Studio.tsx  (masonry grid, filters, detail Sheet)
        |
        |  star / soft-delete -- these ARE public `mutation`s, called directly
        v
 Convex: media.toggleStar / media.softDelete  (browser-callable, no bearer route needed --
                                                Convex client auth boundary applies as-is)
        |
        |  deletedAt set -> next watcher cycle moves file gen\ -> trash\
        v
 (30 days later) janitor internalMutation: batch-capped, deletes thumb blob THEN row,
 paired with a host-side delete of the trash\ file
```

### Recommended Project Structure

```
media-vault\                          # NEW, host filesystem, outside the repo
├── gen\                              # generator outputs
├── refs\                             # reference images
├── styles\                           # style preview images
├── trash\                            # soft-deleted, 30-day grace
├── .thumbs\                          # ONLY if D-01 falls back to local static origin
└── *.json                            # sidecar per media file

convex\
├── schema.ts                         # + media, mediaStyles, mediaModels tables
├── media.ts                          # queries + public mutations (star/softDelete/restore)
│                                      #   + internalMutation writes (ingest, janitor, storage)
├── studioHttp.ts                     # NEW — bearer-gated ingest route, Loom's exact shape
├── ingestAuth.ts                     # + validateStudioAuth (4th member of the family)
├── http.ts                           # + one route registration, no OPTIONS partner
└── retention.ts                      # + D-03 exemption comment block (no new RETENTION_DAYS key)

hooks\
├── studioWatch.mjs                   # NEW — the watcher, joins ingestPost.mjs/loom-emit.mjs
└── __tests__\studioWatch.test.mjs    # NEW, matching existing .mjs test convention

scripts\
├── install-studio-watch-task.ps1     # NEW — copy install-workspace-scan-task.ps1 almost verbatim
├── run-studio-watch.ps1              # NEW — copy run-workspace-scan.ps1's wrapper shape
└── install-media-vault-backup-task.ps1  # NEW — D-14's robocopy task, same two guards

src\
├── pages\Studio.tsx                  # NEW — per 118-UI-SPEC.md
└── lib\navRegistry.ts                # + images icon, + /studio COMMAND entry

~/.claude/skills\
└── studio-generate\SKILL.md          # NEW — D-11's sidecar-writing wrapper
```

### Pattern 1: Bearer-gated agent-only HTTP route (D-15)

**What:** A dedicated `validate<X>Auth` function in `convex/ingestAuth.ts`, fail-closed (missing
key => refuse unless an explicit `*_ALLOW_ANON=true` opt-in), checked as the FIRST statement in
the httpAction handler before any `ctx.db`/`ctx.runMutation` call. No CORS headers, no OPTIONS
route registered for it in `http.ts`.
**When to use:** Any route whose only legitimate caller is a host-side script/agent, never the
browser.
**Example (the literal Phase 119 precedent to copy structurally):**
```typescript
// Source: convex/ingestAuth.ts:149-156 (validateLoomAuth) — copy this shape for validateStudioAuth
export function validateLoomAuth(request: Request): boolean {
  const expectedKey = _env.LOOM_API_KEY;
  if (!expectedKey) {
    return _env.LOOM_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```
```typescript
// Source: convex/loomHttp.ts:37-38 — auth check is the FIRST executable statement
export const loomEventPostHandler = async (ctx: any, request: Request) => {
  if (!validateLoomAuth(request)) return unauthorizedResponse();
  // ... only now touch the body/db
```

### Pattern 2: `internalMutation` for writes that must not be browser-callable

**What:** Any Convex write reached only through a bearer-gated HTTP route (never directly by the
frontend `api.` client) is declared `internalMutation`, not `mutation` — a plain `mutation` lands
in the public, credential-less `api.` namespace that any holder of the shipped `VITE_CONVEX_URL`
can call from devtools.
**When to use:** Ingest, the janitor's permanent delete, and (per D-01) the storage
`generateUploadUrl` wrapper. **NOT** star toggle or soft-delete — those are legitimately
browser-initiated per the UI-SPEC's card overlay and Sheet footer, and must stay `mutation` so
`useMutation(api.media.toggleStar)` works. This is the one place Studio's auth shape genuinely
differs from Loom's (Loom has no browser-writable surface at all).
**Example:**
```typescript
// Source: convex/loom.ts:140-167 — the exact rationale to restate for media.ts's ingest path
export const upsertPipeline = internalMutation({
  args: { /* ... */ },
  handler: async (ctx, args) => upsertPipelineHandler(ctx, args, Date.now()),
});
```

### Pattern 3: D-01 — the Convex file-storage round-trip contract

`[CITED: docs.convex.dev/file-storage/upload-files, docs.convex.dev/file-storage/serve-files]`
(WebSearch-verified against the official Convex docs, 2026-08-13; MEDIUM confidence — no Context7
MCP tool was available in this session to fetch primary-source docs, and the search summary is a
paraphrase, not a byte-exact quote).

Three-step contract, unchanged for self-hosted deployments:
1. A **mutation** calls `ctx.storage.generateUploadUrl()` and returns a URL. That URL is bound to
   `CONVEX_SITE_ORIGIN` — on this backend `[VERIFIED: convex-selfhost/docker-compose.yml:91-92]`
   that resolves to `https://lmofficenew.tail5bb6b3.ts.net:8443` externally, or `127.0.0.1:3211`
   locally on the machine running the backend (port 3211 is explicitly the HTTP-actions port —
   `[VERIFIED: hooks/loom-emit.mjs:37-38]`'s own comment: `"Self-hosted Convex HTTP-ACTIONS port.
   NOT 3210, which is the backend API"`). It is a one-time-use signed capability URL, expiring in
   1 hour — it does not need a separate bearer header from CodePulse's own auth scheme.
2. The CALLER (here: the watcher, not the browser) POSTs the raw file bytes directly to that URL,
   `Content-Type` set to the actual mime type. The response body is JSON: `{"storageId": "..."}`.
3. The `storageId` is saved into the `media` row (`thumbStorageId` field, per the design doc's
   schema). Reading it back later goes through `ctx.storage.getUrl(storageId)` — a **query**,
   available on `QueryCtx` — which returns an absolute URL under the same site origin, or `null`
   if no blob exists under that ID in THIS backend's storage table.

**Why the orphaned `avatars.imageStorageId` values most plausibly return `null` (a hypothesis, not
re-verified here — CONTEXT.md's own measurement is the ground truth for the null itself):** those
IDs were almost certainly created against the retired CLOUD deployment (`tidy-whale-981`, frozen
2026-07-15 — `[CITED: CLAUDE.md's "Self-Hosted Convex" section / memory convex-topology-all-local]`).
A storage ID is only meaningful within the deployment that minted it; migrating the DATABASE rows
(which carry the ID as an opaque string) does not migrate the STORAGE VOLUME's blobs. That is a
plain "the referenced object was never here" condition, not evidence the
generateUploadUrl/upload/getUrl mechanism itself is broken on this backend. **This is exactly why
D-01's blocking proof is still necessary and correctly scoped as a fresh round-trip** (mint a new
ID on THIS backend, upload to it, read it back) — CONTEXT.md's pre-flight table is right that
nothing already proves the mechanism works; this section just explains why the failure signature
observed does not by itself argue it's broken.

### Pattern 4: D-01 fallback — what "local static origin" actually costs

If the round-trip proof fails, CONTEXT.md's fallback is "a local static origin serving
`media-vault\.thumbs\` with the row carrying a relative path." **This is a materially bigger lift
than it sounds**, and should be planned as its own task rather than a one-line pivot:

- The self-hosted Convex backend runs **inside a Docker container** — `[VERIFIED:
  convex-selfhost/docker-compose.yml]` shows `backend` as a `docker compose` service. The
  container has no access to `C:\Users\mandr\media-vault\` on the host unless that directory is
  bind-mounted into the container via a `volumes:` entry — a change to `convex-selfhost/`
  (a separate, private, machine-critical repo governed by CLAUDE.md's "no mass mutation of the
  live instance" rules) that this phase should NOT casually make.
- The realistic fallback is therefore a SEPARATE lightweight process: a small Node
  `http.createServer` (or Vite's `configureServer` middleware, since Vite is already the dev
  server for this repo) that serves `media-vault\.thumbs\` on a fixed local port, using only
  built-in `node:http`/`node:fs` — matching the existing `.mjs` family's zero-third-party-dependency
  convention. That process needs its own always-running lifecycle (a third scheduled task, or
  folded into the existing CodePulse autostart supervisor documented in memory
  `codepulse-autostart-task.md`) — this is new operational surface, not a config flag.
- The row's `thumbnailUrl` field should be resolved the SAME WAY regardless of which branch wins
  — the UI-SPEC already specifies this neutrality ("the row exposes one resolved field,
  `thumbnailUrl`... the UI treats identically whether it resolved from Convex file storage or the
  local-static-origin fallback" — `118-UI-SPEC.md:321-324`). That means the CONVEX QUERY that
  serves gallery rows, not the React component, is where the branch should be resolved: on the
  primary branch it's `ctx.storage.getUrl(thumbStorageId)`; on the fallback branch it's a plain
  string concatenation of the local server's base URL + the row's stored relative path. Only one
  of `thumbStorageId` / a relative-path field would be populated per row depending on which branch
  ingest was running under at write time.

### Anti-Patterns to Avoid

- **Unbatched `.collect()` + per-item delete in one mutation (the janitor's #1 risk):**
  `convex/forge.ts`'s `sweepForgeFileRecords` — `[VERIFIED: convex/forge.ts:1826-1874]` — does
  exactly this (`ctx.db.query("forgeArtifacts").collect()` with no cap, then deletes in a loop) and
  is a LIVE, already-shipped example of the shape that dies at Convex's ~4,096-read ceiling once
  the table is large enough. This repo has already hit this exact defect twice: Phase 115's inline
  workspace-directory prune (`[CITED: .planning/STATE.md:1012's own account]` — 4,912 inserts
  failed, 100 succeeded, isolated by a payload-size control after two wrong diagnoses), and
  `convex/graphSnapshots.ts:193-219`, inert only because its cron is currently disabled. **Do not
  copy `sweepForgeFileRecords`'s shape for the D-08 janitor** — copy `retention.ts`'s
  `pruneBatchV3` instead (batch-capped at 200, cursor-seeked, self-rescheduling via
  `ctx.scheduler.runAfter`).
- **Reaching for `-q:v` on the ffmpeg webp encoder:** `[CITED: 2webp.com/guides/ffmpeg-flags-for-webp,
  WebSearch 2026-08-13]` — `-q:v` is the mjpeg-era flag and is silently ignored/wrong for
  `libwebp`; the correct flag is `-quality 0-100`.
- **Treating `veo.ts` as a working reference implementation:** it is a shape donor only — see
  Common Pitfalls below.
- **Assuming OpenArt has a CLI to install:** see the dedicated workability-concern section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Masonry/variable-height grid | A JS masonry library or manual layout math | CSS multi-column (`columns-N gap-4` + `break-inside-avoid`) | Already fully specified in `118-UI-SPEC.md`; zero new dependency; CONTEXT.md forbids adding one. |
| Bearer-token auth check | A new ad-hoc auth helper | A 4th `validate<X>Auth` function in `convex/ingestAuth.ts`, structurally identical to the existing three | The file's own docstring says as much: "Fourth member of the same family, structurally identical to the three above." |
| Content-addressed dedup | Path/mtime/process-derived keys | SHA-256 of file bytes, per `hooks/idempotency.mjs`'s documented rationale | That module's own docstring: "a dedup key must derive purely from payload content" — the same failure mode (dual hook wiring, or here, a rescan) defeats any process-local key. |
| Batch-capped background deletes | A fresh cron/mutation design | Copy `retention.ts`'s `pruneBatchV3` shape (batch size 200, cursor-seeked via `by_creation_time`, self-rescheduling, `MAX_BATCHES_PER_NIGHT` ceiling) | This repo has paid for this design twice already (the 2026-07-21/22 tombstone incident, and the 2026-07-29/30 head-rescan SystemTimeout) — reinventing it risks re-discovering both. |
| Scheduled-task registration with the battery/launcher guards | A new PowerShell script written from scratch | Copy `scripts/install-workspace-scan-task.ps1` (and its wrapper `run-workspace-scan.ps1`) near-verbatim, renaming task/paths | It is a complete, self-testing (`-SelfTest`), already machine-verified exemplar of both D-04/D-14 guards, including a control-paired read-back verification and a documented PowerShell footgun to avoid. |
| Video poster frame extraction | A dedicated thumbnailing library | `ffmpeg -i in.mp4 -vf "thumbnail,scale=..." -frames:v 1 -c:v libwebp -quality N out.webp` | `[CITED: ffmpeg-micro.com/blog, transloadit.com/devtips, WebSearch 2026-08-13]` — one ffmpeg invocation does frame-select + scale + encode; ffmpeg is already the mandated dependency. |

**Key insight:** every non-UI piece of this phase (auth, retention, scheduled tasks, watcher
POSTing, batch-capped deletes) already has a shipped, working precedent in this exact repo from
Phases 108-119. The engineering risk in this phase is almost entirely in the two areas that do
NOT have a precedent: the Convex storage round-trip (never yet exercised on this backend) and the
OpenArt backend (no confirmed programmatic surface at all).

## Common Pitfalls

### Pitfall 1: Treating `veo.ts` as a working direct-API generator

**What goes wrong:** Wiring `/studio-generate`'s direct-API leg by importing or lightly adapting
`~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts` as-is.
**Why it happens:** CONTEXT.md correctly calls it "a real direct-API generation path" as a donor
for the sidecar-contract SHAPE — true — but a shallow read could mistake that for "a working
generator."
**How to avoid:** `[VERIFIED: file read 2026-08-13]` — `generateClip()` and `extendClip()` both
`throw new Error('... not implemented — TODO: ...')` unconditionally; `_pollFalQueue()` is also an
unimplemented stub. The file is genuinely useful for its retry wrapper (`withRetry`), its typed
interfaces, and its documented queue/poll/fetch STEPS (all as TODO comments) — but the actual
fal.ai (or Google AI Studio / Kie, per the design doc's other named candidates) HTTP calls must be
written fresh for D-09's proof round.
**Warning signs:** A plan task that says "adapt veo.ts" without also saying "implement the actual
HTTP calls" will silently produce a generator that throws on first real use.

### Pitfall 2: The janitor dying at the Convex 4,096-read ceiling

**What goes wrong:** A `media` janitor mutation that does
`ctx.db.query("media").withIndex(...).collect()` (or even `.take(large_N)`) and then loops
deleting rows + calling `ctx.storage.delete()` in the same mutation invocation.
**Why it happens:** The 16,000-*document-write* ceiling documented in Convex's own limits page (and
repeated in this repo's comments) is NOT the binding constraint — `ctx.db.delete()` counts as a
READ against a separate ~4,096-read-per-mutation ceiling, and (per this repo's own Phase 115
finding) a query issued after N inserts/deletes in the SAME mutation must additionally merge that
transaction's own pending write set at roughly N extra reads. Every value of a naive batch cap
fails identically once the table is big enough — bisecting the cap wastes time; the fix is
structural (a smaller, explicitly bounded batch scheduled via `ctx.scheduler`, matching
`pruneBatchV3`).
**How to avoid:** Copy `retention.ts`'s cursor-seeked, self-rescheduling batch shape (cap ~200)
rather than writing a fresh collect-and-loop janitor. Do the blob delete and the row delete for
each item within the SAME small batch, blob first (per `forge.ts`'s proven ordering), and keep
the batch size well under any observed failure threshold — this repo's own Phase 115 evidence puts
the practical ceiling around a few hundred write-plus-read operations per mutation when a query
follows inserts/deletes in the same transaction.
**Warning signs:** A `SystemTimeout` or an inline "unexpected throw" from the janitor mutation
with no other error context, especially if it correlates with table size rather than with any
particular row's content.

### Pitfall 3: ffmpeg's `-q:v` doing nothing for webp, and no size guarantee from a single-pass encode

**What goes wrong:** A single fixed-quality ffmpeg invocation is trusted to "usually" land under
200KB, and D-02's cap is treated as a soft target rather than the hard bug-if-violated rule
CONTEXT.md states it as.
**Why it happens:** JPEG-era muscle memory reaches for `-q:v`; `libwebp`'s actual quality knob is
`-quality 0-100` `[CITED: 2webp.com/guides/ffmpeg-flags-for-webp]`. Neither flag GUARANTEES an
output size — webp quality settings target visual quality, not a byte budget.
**How to avoid:** Encode inside a bounded loop: start at a reasonable quality/scale (e.g.
`-quality 80`, longest edge capped to ~1024px), check the output file size, and if over 200KB
step down quality and/or scale and re-encode — capped at a small fixed number of iterations (e.g.
5) with a hard floor. If the floor is reached and the file is STILL over cap (pathological input),
refuse to upload rather than upload an oversized thumbnail — this matches D-02's own framing
("a full-size upload is a bug, not a tuning issue").
**Warning signs:** Any `media` row whose thumbnail exceeds 200KB in production is itself the
warning sign; this should be asserted in the D-01/D-02 gate, not discovered later by an operator
noticing `db.sqlite3` growth (which is already at 7.1GB per CONTEXT.md's pre-flight table).

### Pitfall 4: Assuming star/soft-delete need the same bearer-gated route as ingest

**What goes wrong:** Copying Loom's/Galdr's "everything goes through one bearer-gated HTTP route,
`internalMutation` underneath" shape wholesale for `media.ts`.
**Why it happens:** Every sibling phase (116/117/119) this phase is told to match conventions
against has NO browser-writable surface at all — their entire write paths are agent/CLI-only.
Studio is different: the UI-SPEC's card star overlay and Sheet footer buttons are real, immediate,
browser-initiated actions (`onClick={stopPropagation→toggle}`, no confirmation dialog, per
`118-UI-SPEC.md`'s Destructive Confirmation section).
**How to avoid:** Split `convex/media.ts` deliberately: `ingestMedia`, the storage
`generateUploadUrl` wrapper, and the janitor's permanent-delete are `internalMutation` (reached
only via the bearer-gated `studioHttp.ts` route or a cron); `toggleStar`, `softDelete` (sets
`deletedAt`), and `restore` (clears `deletedAt`) are plain `mutation`, callable directly via
`useMutation(api.media.toggleStar)` etc. from `Studio.tsx`. This is explicitly a LOWER-trust
surface than ingest (flip a boolean / set a timestamp on an existing row vs. create new
provenance-bearing content), matching the single-operator threat model CLAUDE.md already
documents for this backend.
**Warning signs:** A plan task that puts star/delete behind `studioHttp.ts` will make the UI-SPEC's
"single-click, no host round-trip" card interactions either impossible (browser can't call
`internalMutation`) or require inventing a whole second bearer-auth flow inside the browser, which
nothing in this repo does anywhere else.

## OpenArt workability concern (D-09/D-12) — read before planning this leg

**This is not a re-litigation of D-09 — D-09 is locked, and OpenArt stays one of the three proof
targets. This section is about HOW, because the literal task CONTEXT.md names — "install the
OpenArt CLI" — may not correspond to a real product.**

Evidence gathered 2026-08-13:
- `where openart` on this machine: `INFO: Could not find files for the given pattern(s).`
  `[VERIFIED]` — matches CONTEXT.md's own pre-flight finding.
- `npm view openart / openart-cli / @openart/cli version`: all three return `404 Not Found` from
  the npm registry. `[VERIFIED]`
- WebSearch for "OpenArt CLI install" and "openart.ai API generate image REST endpoint" both
  surface only `[MEDIUM confidence, WebSearch, cross-checked across 3 queries]` a **hosted MCP
  server** at `https://mcp.openart.ai/mcp` — connected via OAuth from an MCP-capable client
  (Claude, ChatGPT, Cursor Settings -> Connectors), explicitly marketed as "zero API keys" and
  "no npm installation as a package." This matches CONTEXT.md's own finding that the in-session
  OpenArt MCP surface exposes only `authenticate`/`complete_authentication`.
- One later, less authoritative search result (a 2026 review-site article, not OpenArt's own
  docs) claims OpenArt now also offers "API access for developers" to "integrate AI image
  generation into client dashboards" — but no documentation URL, endpoint, or auth scheme was
  found for it. `[ASSUMED — LOW confidence, single non-authoritative source, contradicts the
  clearer MCP-only signal from OpenArt's own `/mcp` marketing page]`.

**What this means for planning D-09's OpenArt leg — options, not a recommendation:**
1. Spend a short in-phase discovery task confirming or refuting the claimed developer API
   (check for `docs.openart.ai` or similar directly, since this research pass did not find a
   working link) before writing any automation task against it.
2. If no headless API exists, treat OpenArt's proof round as an INTERACTIVE MCP session (generate
   one asset via the MCP connector inside a Claude Code session with OpenArt authenticated),
   then hand-place the resulting file + a hand-authored sidecar JSON into `media-vault\gen\` — this
   still satisfies D-07's provenance model and D-09's "proven end-to-end" bar without requiring
   `/studio-generate` to drive OpenArt unattended. The `mediaModels.recipeMd` card for this model
   would then honestly document "run via the OpenArt MCP connector in an interactive session,
   then drop the output + sidecar manually" rather than a CLI invocation — which is a legitimate
   recipe-card shape, just a different one than Higgsfield's.
3. If Larry has an OpenArt subscription tier that DOES expose a documented API, the correct next
   step is checking OpenArt's own account/developer settings directly (not further web search),
   since no public documentation URL surfaced in this pass.

## Code Examples

### Watcher's POST-with-bearer call (copy `ingestPost.mjs`'s contract, or emit fail-loud like `loom-emit.mjs`)

```javascript
// Source: hooks/ingestPost.mjs:31-73 — never throws, returns {ok, status}. Good for the
// SessionStart-awaited scan path. loom-emit.mjs's fail-LOUD shape (exit codes 0/2/3/4, see
// hooks/loom-emit.mjs:79-82) is the better model for studioWatch.mjs's scheduled-task
// invocation, since a silently-swallowed ingest failure is worse here than a visible non-zero
// exit the wrapper script's $ExitMeanings table can log.
```

### Scheduled task registration satisfying both D-04 guards

```powershell
# Source: scripts/install-workspace-scan-task.ps1:162-172 — the load-bearing settings block.
# AllowStartIfOnBatteries / DontStopIfGoingOnBatteries are MANDATORY.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
              -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew

# Source: scripts/install-workspace-scan-task.ps1:155-158 — launcher, NEVER -WindowStyle Hidden.
$argStr = '//B //Nologo "' + $HiddenVbs + '" C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe ' +
          '-NoProfile -ExecutionPolicy Bypass -File "' + $WrapperPath + '"'
$action = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument $argStr
```
`run-hidden.vbs` confirmed present at `C:\Users\mandr\scripts\run-hidden.vbs` AND
`C:\Users\mandr\.claude\scripts\run-hidden.vbs` `[VERIFIED: 2026-08-13 filesystem probe]`.

### ffmpeg still -> bounded webp (illustrative shape; exact quality/scale steps are a plan-time tuning task)

```bash
# Source: pattern synthesized from 2webp.com/guides/ffmpeg-flags-for-webp (WebSearch 2026-08-13).
# -quality NOT -q:v for libwebp. Loop (pseudocode) until size<=200KB or floor reached:
ffmpeg -y -i "$SRC" -vf "scale='min(1024,iw)':-1" -c:v libwebp -quality 80 "$OUT"
# check `stat -c%s "$OUT"` (or PowerShell (Get-Item).Length); step quality/scale down and re-encode if over cap.
```

### ffmpeg video -> poster-frame -> bounded webp

```bash
# Source: pattern synthesized from ffmpeg-micro.com/blog/extract-frames-from-video-ffmpeg,
# transloadit.com/devtips/extract-thumbnails-from-videos-in-browsers-with-ffmpeg-wasm (WebSearch
# 2026-08-13).
ffmpeg -y -i "$SRC" -vf "thumbnail,scale='min(1024,iw)':-1" -frames:v 1 -c:v libwebp -quality 80 "$OUT"
```

### Higgsfield CLI's one-shot generate+wait contract

```bash
# Source: ~/.claude/skills/higgsfield-generate/SKILL.md:87,109-113 (verified present on this
# machine 2026-08-13) — the exact invocation shape /studio-generate's Higgsfield leg should use.
higgsfield generate create <model_id> --prompt "..." --wait --json
# --wait blocks until terminal status and prints the final job object (with result URL) as JSON;
# --json makes it machine-parseable for /studio-generate to download + write the sidecar.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| N/A — this is new-build code, not a migration | N/A | N/A | N/A |

**Deprecated/outdated:** None identified specific to this phase's stack; ffmpeg 9.0-full and the
Convex self-hosted backend are both current as installed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The orphaned `avatars.imageStorageId` nulls are explained by an unmigrated storage volume (cloud->self-hosted), not a broken `generateUploadUrl`/`getUrl` mechanism on this backend. | Pattern 3 (D-01) | If wrong and the mechanism itself is broken, D-01's blocking proof will correctly catch it before any UI work — low risk, since the proof round is explicitly designed to be neutral to this hypothesis. Stated only to explain WHY the observed null does not by itself argue against attempting the round-trip. |
| A2 | `generateUploadUrl()`'s returned URL is reachable directly from the watcher process running on the same host, without needing to go through the tailnet hostname. | Pattern 3 (D-01) | If the backend's `CONVEX_SITE_ORIGIN` config only resolves externally (via Tailscale), the watcher may need to use `127.0.0.1:3211` explicitly rather than trusting the URL Convex returns verbatim — this needs to be checked live during the D-01 proof task, not assumed at plan-write time. |
| A3 | OpenArt has no headless/API-key-based generation surface at all beyond the OAuth-gated MCP connector. | OpenArt workability concern | A 2026 review-site source claims a developer API exists; if a real one is found during planning, the CLI-install framing of D-09's OpenArt leg becomes viable after all and this concern is moot. |
| A4 | A single Node `http.createServer` process (or Vite middleware) is an acceptable, house-convention-matching shape for the D-01 fallback's local static server, rather than modifying `convex-selfhost/docker-compose.yml` to bind-mount `media-vault`. | Pattern 4 (D-01 fallback) | If Larry prefers the compose bind-mount instead, that changes which repo/task owns this piece and adds a `convex-selfhost` change that CLAUDE.md's operational rules treat with extra caution — worth confirming at plan time if D-01's primary branch fails. |
| A5 | The practical per-mutation read ceiling that bit Phase 115 (~4,096, degraded further by same-transaction query-after-write) applies the same way to a delete-heavy janitor mutation as it did to Phase 115's insert-heavy one. | Pitfall 2 | If the janitor's actual failure threshold differs materially, a batch size of 200 (matching `pruneBatchV3`) is still a large safety margin either way — low risk. |

**If this table is empty:** N/A — see rows above.

## Open Questions

> **All three RESOLVED at plan-phase close (2026-08-13)** — annotated per question below.
> Questions 1 and 2 are resolved *procedurally*: each is owned by a dedicated blocking discovery
> plan whose evidence artifact is cross-checked against `118-CONTEXT.md` by an automated
> consistency check, so the answer is measured before anything depends on it rather than assumed
> now. Question 3 is resolved *substantively* by a CONTEXT.md `AMENDMENT`.

1. **Does D-01's round-trip actually succeed on this backend?**
   **(RESOLVED — deferred to measurement by design.)** Owned by `118-01-PLAN.md`, the phase's sole
   wave-1 BLOCKING plan. Nothing else is built until it writes `118-D01-EVIDENCE.md` with a
   `BRANCH:` line, and the fallback transport (a second static file server, since self-hosted
   Convex runs in Docker with no host-dir access) is planned as real work rather than a one-line
   pivot. No further research could have substituted for running it.
   - What we know: the mechanism and URL contract are well-documented and this backend's
     `CONVEX_SITE_ORIGIN`/`CONVEX_CLOUD_ORIGIN` config looks correctly set (docker-compose.yml).
   - What's unclear: whether anything else about this specific self-hosted deployment (network
     path from the watcher, container storage volume health, etc.) prevents the round-trip in
     practice — CONTEXT.md is explicit that nothing has verified it end-to-end yet.
   - Recommendation: this is precisely why D-01 is the phase's first BLOCKING plan; no further
     research can substitute for running it.

2. **Does a real OpenArt developer API exist beyond the MCP connector?**
   **(RESOLVED — owned by `118-02-PLAN.md`, a wave-2 time-boxed discovery probe.)** The
   orchestrator independently confirmed no installable CLI exists: npm `openart` / `openart-cli` /
   `@openart/cli` all 404 (control: `convex` → 200); PyPI `openart` returns 200 but is an
   unrelated abandoned placeholder (v0.0.2, empty description) while `openart-cli` / `openart-api`
   404 (control: `requests` → 200); not on PATH (control: `higgsfield` resolves). Per the D-09
   AMENDMENT in CONTEXT.md, `118-02` authenticates the hosted MCP and enumerates the tools that
   appear **post-auth**, writing a `THIRD_LEG:` measurement that `118-14` Task 1 mechanically
   asserts against before any third-leg code is written. If no real generation tools appear, the
   leg swaps to a second direct-API provider.
   - What we know: no CLI, no npm package, and the clearest/most authoritative source (OpenArt's
     own `/mcp` marketing page) describes MCP-only, OAuth, zero-API-keys access.
   - What's unclear: one lower-quality 2026 source claims a separate developer API exists with no
     confirmable documentation link.
   - Recommendation: a short discovery task at plan time (check OpenArt's account/developer
     settings directly) before committing to either the "install a CLI" framing or the
     "interactive MCP session, hand-placed sidecar" framing.

3. **Which direct-API provider (fal.ai / Google AI Studio / Kie) does D-09's second proof target?**
   **(RESOLVED — locked to fal.ai, confirmed with Larry; see the D-09 AMENDMENT in
   `118-CONTEXT.md`.)** Caveat now recorded in CONTEXT.md's corrected pre-flight row: `veo.ts:73`
   and `:107` are literal `throw new Error('… not implemented')`, so it is a **shape** donor
   (retry wrapper, env-key naming, cost accounting, queue/poll design) and the leg is a
   write-from-scratch implementation task, not a port. Owned by `118-13-PLAN.md`. Requires
   `FAL_KEY`, which stays in `.env`/1Password per D-12.
   - What we know: the design doc names all three as candidates; `veo.ts` is shaped around fal.ai
     specifically (`FAL_VEO_ENDPOINT`) but is unimplemented.
   - What's unclear: CONTEXT.md doesn't lock a specific provider for this leg.
   - Recommendation: plan-time choice, likely fal.ai given `veo.ts`'s existing shape/env-var
     naming convention (`env.FAL_KEY`) reduces net-new code versus starting from zero against a
     different provider.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| ffmpeg | D-02 thumbnail/poster-frame encoding | Yes `[VERIFIED]` | `9.0-full_build-www.gyan.dev` | — |
| Node.js | Watcher, all `.mjs` scripts | Yes `[VERIFIED: existing hooks/*.mjs run in this repo]` | matches repo's existing Node baseline | — |
| `higgsfield` CLI | D-09 backend #1 | Yes `[VERIFIED: higgsfield account status succeeded]` | installed via WinGet-adjacent npm global install | — |
| OpenArt CLI/API | D-09 backend #3 | No `[VERIFIED: not on PATH, no npm package]` | — | Interactive MCP connector session (see workability-concern section) — no headless fallback confirmed |
| `run-hidden.vbs` | D-04/D-14 scheduled-task launcher | Yes `[VERIFIED: two copies found on disk]` | n/a (VBScript, no versioning) | — |
| Convex self-hosted backend | D-01, all ingest/read paths | Yes, running `[CITED: convex-selfhost/README.md, this session's earlier reads]` | current per `convex-selfhost/docker-compose.yml` | — |
| `G:\` (Google Drive mount) | D-14 backup target | Not verified this session — CONTEXT.md's pre-flight table lists `G:\My Drive\media-vault` as "absent — nothing half-built to reconcile," implying the `G:\` drive itself is reachable (other backup content, e.g. `G:\My Drive\Agent images`, is referenced elsewhere in CONTEXT.md as an existing candidate) | — | If unreachable at plan/execute time, `robocopy` will fail loudly (non-zero exit) rather than silently — no additional fallback needed beyond noticing the failure. |

**Missing dependencies with no fallback:** OpenArt's headless generation path — no confirmed
fallback beyond the interactive-MCP-session workaround described above, which is a process change,
not a technical fallback.

**Missing dependencies with fallback:** None beyond the above (all fully technical dependencies —
ffmpeg, Node, Higgsfield, run-hidden.vbs, Convex backend — are confirmed present).

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.9 (unit, `convex/**/*.test.ts` and `hooks/__tests__/*.test.mjs`) + Playwright 1.61.1 (E2E, `e2e/*.spec.ts`) |
| Config file | `vite.config.ts` (Vitest config lives inside it, per this repo's existing convention) / `playwright.config.ts` |
| Quick run command | `npx vitest run <specific-file>` |
| Full suite command | `npm test` (Vitest) and `npm run test:e2e:noauth` (Playwright, Clerk-disabled — required since `/studio` has no auth-gated behavior to test) |

### Phase Requirements -> Test Map

No REQ-IDs exist for this phase; rows are keyed by decision ID instead, matching the
Decision -> Research Support Map above.

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| D-01 | Upload round-trip returns HTTP 200 + non-zero body; paired control (orphaned avatars ID still resolves null in the same run) | integration (live-stack proof, not unit-mockable — matches Phase 116's 116-05 blocking-deploy-wave shape) | manual/scripted probe against the running backend, captured as a plan evidence artifact (e.g. `118-D01-EVIDENCE.md`), not a CI-run test | Wave 0 |
| D-05, D-06 | Content-hash dedup: rescanning an unchanged vault produces zero writes; a renamed/moved file with unchanged bytes still dedups | unit | `npx vitest run hooks/__tests__/studioWatch.test.mjs` | Wave 0 |
| D-07 | A file with no sidecar renders "No provenance recorded", never blank/inferred — the card-badge + Sheet-field control pair per CONTEXT.md's `<specifics>` | unit (Convex query logic) + component test (React rendering) | `npx vitest run convex/media.test.ts` and `npx vitest run src/pages/Studio.test.tsx` | Wave 0 |
| D-08 | Soft-delete: mutation sets `deletedAt` and hides the row immediately; watcher moves file `gen\`->`trash\` on next cycle; Restore reverses both; 30-day janitor deletes blob+row+file together | unit (mutation logic, janitor batch logic) + integration (watcher file-move, needs a real filesystem fixture dir) | `npx vitest run convex/media.test.ts` (mutation halves) + `npx vitest run hooks/__tests__/studioWatch.test.mjs` (file-move halves) | Wave 0 |
| D-15 | Unauthenticated POST to the ingest route 401s BEFORE touching the db; no OPTIONS/CORS response | unit (mirrors `convex/loomHttp.ts`'s own test pattern, if one exists — check `convex/loom*.test.ts`) | `npx vitest run convex/studioHttp.test.ts` | Wave 0 |
| D-16 | `/studio` reachable from the COMMAND nav group; a real click-through, not just a route existing | E2E | `npx playwright test e2e/studio.spec.ts --project=chromium` (or the `test:e2e:noauth` variant, matching `e2e/galdr.spec.ts`/`e2e/bifrost.spec.ts`/`e2e/loom.spec.ts`'s established pattern) | Wave 0 |
| D-02 | Every thumbnail in a produced `media` row is <=200KB; the browser never requests the original file | unit (encoder-loop logic) + a manual/scripted assertion against real encoded output during the D-09 proof rounds | `npx vitest run hooks/__tests__/studioWatch.test.mjs` (encoder logic) + evidence artifact from the live proof | Wave 0 |
| D-09 | One asset from each of 3 backends appears in the gallery with correct, complete provenance within one watcher cycle | integration (live-stack, per-generator proof rounds) | manual/scripted, captured as plan evidence, matching the design doc's own gate language | Wave 0 |

### Sampling Rate

- **Per task commit:** the single file's Vitest run (`npx vitest run <file>`).
- **Per wave merge:** `npm test` (full Vitest suite) — this repo's baseline is currently ~310
  files / ~4,100+ tests passing; a regression in that count is itself a signal, per this repo's
  own established convention of quoting before/after suite totals in plan summaries.
- **Phase gate:** full Vitest suite green + `npx playwright test e2e/studio.spec.ts` green +
  `npx tsc --noEmit` clean, before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `hooks/__tests__/studioWatch.test.mjs` — covers D-05/D-06 (hashing/dedup), D-07 (sidecar
      pairing/absence), D-02 (encoder-loop cap logic), D-08 (file-move halves).
- [ ] `convex/media.test.ts` — covers D-03 (no RETENTION_DAYS key, exemption comment present),
      D-07 (query-side provenance rendering), D-08 (mutation halves: softDelete/restore/janitor
      batch shape), the `internalMutation`-vs-`mutation` split from Pitfall 4.
- [ ] `convex/studioHttp.test.ts` — covers D-15 (fail-closed auth, no CORS/OPTIONS), mirroring
      whatever test pattern exists (or doesn't) for `loomHttp.ts` — check at plan time.
- [ ] `e2e/studio.spec.ts` — covers D-16 (nav reachability) plus a control-paired D-07 rendering
      assertion (a complete-recipe card next to a no-provenance card in the same grid view, per
      CONTEXT.md's `<specifics>` control-pair requirement) and a D-08 control pair (soft-deleted
      row absent from Gallery, present in Trash, Restore brings it back).
- [ ] Framework install: none needed — Vitest and Playwright are both already configured and used
      throughout this repo.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so treated as enabled per the
framework default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Yes, for the ingest route only | Bearer-token comparison, fail-closed, matching `validateLoomAuth`/`validateGaldrAuth` (D-15). |
| V3 Session Management | No | No session concept in this phase; browser reads/writes go through the existing Convex client connection, unauthenticated by design on this single-operator, tailnet-bounded instance (per CLAUDE.md's SEED-008 decision). |
| V4 Access Control | Partially | The `internalMutation`/`mutation` split (Pitfall 4) IS the access-control boundary for this phase — enforced at the Convex function-declaration level, not at request time. |
| V5 Input Validation | Yes | Convex's `v.*` schema validators on every mutation/query arg (already this repo's universal convention); sidecar JSON parsed defensively (D-07: malformed/absent sidecar is a defined state, never a thrown error that skips the file). |
| V6 Cryptography | Yes, narrowly | SHA-256 for content-addressed dedup (D-05) — Node's built-in `crypto` module, never hand-rolled. Not used for any security/secrecy purpose, only identity/dedup. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Unauthenticated write to the ingest route (creates fabricated provenance-bearing rows) | Spoofing / Tampering | D-15's fail-closed bearer check, first statement in the handler, before any db access — matches `loomHttp.ts`'s proven shape. |
| A public (non-`internal`) mutation reachable from devtools with the shipped `VITE_CONVEX_URL` | Elevation of Privilege | The `internalMutation`/`mutation` split from Pitfall 4 — ingest/janitor/storage-URL-generation are `internalMutation`; only star/soft-delete/restore are public, and those are low-stakes single-operator actions by design. |
| Oversized/malicious file smuggled through as a "thumbnail" (blob discipline breach) | Tampering / Denial of Service | D-02's hard ≤200KB cap enforced by the encoder loop BEFORE any upload is attempted — refuse rather than upload oversized, consistent with `db.sqlite3` already sitting at 7.1GB per CONTEXT.md's pre-flight table. |
| Secret leakage via `mediaModels.recipeMd` | Information Disclosure | D-12: `recipeMd` references key NAMES only, never values; keys live in `.env`/1Password exclusively — same rule as every other generator-key surface in this repo. |
| A rendered `recipeMd` (agent-authored free text) executing as HTML | Tampering (stored XSS) | UI-SPEC already mandates plain `<pre>`/`font-mono` rendering, never `dangerouslySetInnerHTML` — identical reasoning to Galdr's prompt-body XSS note. |

## Sources

### Primary (HIGH confidence)

- `convex/avatars.ts:63-85` — the only existing `ctx.storage` round-trip in this repo.
- `convex/ingestAuth.ts:100-167`, `convex/loomHttp.ts`, `convex/loom.ts:100-167` — the exact
  bearer-auth + `internalMutation` pattern to copy for D-15.
- `convex/retention.ts` (full file read) — `RETENTION_DAYS`, `PRUNE_PREDICATES`, `pruneBatchV3`,
  and the Phase 116 D-13 exemption comment block D-03 must match in style.
- `convex/forge.ts:1790-1874` — the proven blob-first-then-row-delete ordering, and the
  unbatched-`.collect()` anti-pattern to avoid.
- `hooks/idempotency.mjs`, `hooks/ingestPost.mjs`, `hooks/loom-emit.mjs` — the `.mjs` house
  conventions the watcher must join.
- `scripts/install-workspace-scan-task.ps1`, `scripts/run-workspace-scan.ps1` — a complete,
  machine-proven exemplar of D-04/D-14's scheduled-task guards.
- `src/lib/navRegistry.ts:85-140` — confirmed `images` icon slot unclaimed, COMMAND group
  insertion point next to Bifröst.
- `convex-selfhost/README.md`, `convex-selfhost/docker-compose.yml` — self-hosted topology, ports,
  `CONVEX_CLOUD_ORIGIN`/`CONVEX_SITE_ORIGIN` values, and the container-isolation fact behind the
  D-01 fallback's real cost.
- `~/.claude/skills/higgsfield-generate/SKILL.md`, live `higgsfield account status`/`--help`
  output — the exact CLI contract for D-09's Higgsfield leg.
- `~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts` (full file read) — proved
  to be an unimplemented shape-only stub, correcting an implicit assumption in CONTEXT.md.
- `.planning/phases/118-studio-media-gallery/118-CONTEXT.md`, `118-UI-SPEC.md` (approved,
  revision 1) — locked decisions and the full UI contract.
- `docs/proposals/2026-08-07-seidr-suite-design.md` §4.3, §5, §6 (full sections read).
- `.planning/REQUIREMENTS.md` — confirmed no REQ-IDs exist for Phase 118 (not listed anywhere in
  the active v14.0 milestone's categories).

### Secondary (MEDIUM confidence)

- WebSearch, cross-checked against this backend's own docker-compose config: Convex
  `generateUploadUrl`/upload/`getUrl` three-step contract, `CONVEX_SITE_ORIGIN` semantics for
  self-hosted deployments.
- WebSearch, cross-checked across 3 separate queries: OpenArt's MCP-only, OAuth, no-API-key
  programmatic surface.
- WebSearch: ffmpeg `libwebp` `-quality` flag (not `-q:v`), poster-frame extraction invocation
  shape.

### Tertiary (LOW confidence)

- A single 2026 review-site article claiming OpenArt now offers a separate "developer API" beyond
  MCP — no documentation URL found; flagged explicitly in the Assumptions Log and the OpenArt
  workability-concern section, not treated as fact anywhere else in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every core piece (ffmpeg, Convex storage API, Node built-ins, Higgsfield
  CLI) is either already installed and verified live, or is a documented official-source contract.
- Architecture: HIGH for everything with a shipped precedent in this repo (auth, retention,
  scheduled tasks, watcher shape); MEDIUM for the D-01 round-trip specifics (well-documented but
  unproven on this exact backend) and the D-01 fallback's real cost (reasoned from verified facts
  about container isolation, but the fallback itself has never been built here).
- Pitfalls: HIGH — three of four pitfalls are grounded in this repo's own already-occurred
  incidents (the 4,096-read ceiling hit Phase 115 twice; the auth-split issue is a direct read of
  the UI-SPEC's own browser-initiated actions; `veo.ts`'s stub status was confirmed by reading the
  file). MEDIUM for the ffmpeg size-guarantee pitfall (correct per official flag documentation, but
  the exact quality/scale step values need empirical tuning during the D-09 proof rounds).

**Research date:** 2026-08-13
**Valid until:** 2026-08-20 (7 days) — this phase touches a self-hosted backend whose operational
state (storage volume contents, container config) is under active investigation elsewhere in this
project and could change before planning completes; re-verify the D-01 premises if more than a few
days elapse before `/gsd:plan-phase 118` runs.
