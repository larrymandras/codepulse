# Seiðr Studio — the media sidecar provenance contract

**Audience:** anyone writing a generator that should appear in CodePulse's `/studio` gallery with
its recipe intact. That includes generators living in *other repositories* — this document is
written so you never have to read CodePulse's code to conform to it.

**Status:** transcribed from the shipped implementation (`hooks/studioWatch.mjs`,
`convex/studioHttp.ts`, `convex/media.ts`) on 2026-08-15, Phase 118 plan `118-12`. Where this
document and a prose comment elsewhere disagree, **the code is the contract** and the divergences
are called out inline below.

**There is no API to call and no library to import.** Conforming to this document is the whole
integration: write two files onto disk in the right place with the right names, and the row
appears. Nothing polls you, nothing authenticates you, and nothing about your process is recorded.

---

## 1. Where media goes

```
C:\Users\mandr\media-vault\        # overridable via the MEDIA_VAULT_ROOT environment variable
├── gen\      # generated outputs      -> row kind "gen"
├── refs\     # reference inputs       -> row kind "ref"
├── styles\   # style preview images   -> row kind "style"
└── trash\    # NOT scanned. Soft-deleted media lands here; see §7.
```

`kind` is derived **only** from which top-level directory the file sits in — never from its name,
never from anything you put in the sidecar. Sub-directories are walked recursively and inherit the
top-level directory's `kind`. Symlinks are never followed, and any path that resolves outside the
vault root is refused.

Only these extensions are ingested (an **allowlist**, not a denylist — anything else, including
your `.json` sidecar and the vault's own `README.md`, is silently not-media and is skipped):

| `mediaType` | extensions |
|---|---|
| `image` | `.png` `.jpg` `.jpeg` `.webp` `.gif` |
| `video` | `.mp4` `.mov` `.webm` `.mkv` |
| `audio` | `.mp3` `.wav` `.m4a` `.flac` |

**Row identity is the file's SHA-256 content hash**, never its path. That means renaming a file, or
moving it to `trash\` and back, does not create a second row — and it also means writing the same
bytes twice under two names produces exactly one row. Re-ingesting a hash already present is an
idempotent zero-write no-op.

**Filename convention** (a convention, not a rule the ingest enforces):
`{project}_{variant}_{attempt}_{ts}.{ext}`.

---

## 2. The sidecar naming rule

Exactly as implemented in `hooks/studioWatch.mjs`'s `readSidecar`:

- **Primary form — the media file's full path plus `.json`.**
  `gen\sunset_v3.png` → `gen\sunset_v3.png.json`.
  Unambiguous even when two files share a stem across extensions. **Write this form.**
- **Accepted fallback — the same directory, the stem plus `.json`.**
  `gen\sunset_v3.png` → `gen\sunset_v3.json`.
  Provided for files placed by hand; a machine generator should not use it.
- **The primary form wins when both exist.** The fallback is not merged in, not consulted, and not
  warned about.

The sidecar must sit in the same directory as its media file. There is no index, no manifest, and
no naming escape hatch.

---

## 3. The sidecar body

A single JSON **object** (not an array, not a bare string, not `null`).

**Every field is optional, and an absent sidecar file is exactly the same state as an empty object
`{}`.** There is no required field and no schema version.

| field | wire type | meaning |
|---|---|---|
| `prompt` | `string` | the prompt text as submitted |
| `model` | `string` | the model identifier as the provider names it (e.g. `gpt_image_2`) |
| `provider` | `string` | the backend (e.g. `higgsfield`, `fal`, `openart`) |
| `style` | `string` | a **slug** into the curated `mediaStyles` table — see below |
| `project` | `string` | free-text project grouping, used by the gallery's filters |
| `params` | `string` | the generation parameters **as a JSON string** — see the warning below |
| `tags` | `string[]` | free-text tags |

**Anything else you put in the object is silently dropped.** The ingest route
(`convex/studioHttp.ts`'s `sanitizeSidecar`) copies exactly the seven fields above, field by field,
and forwards nothing verbatim. A field whose value is the wrong type is dropped individually — it
never fails the whole ingest, because D-07 already makes provenance absence a safe, defined state.

Two consequences worth stating outright, because both look like they should work and do not:

- **`params` MUST be a JSON string, not an object.** `sanitizeSidecar` keeps `params` only when
  `typeof params === "string"`. An object is dropped and the field renders as absent. Serialise it
  yourself: `"params": "{\"aspect_ratio\":\"16:9\",\"resolution\":\"2k\"}"`. (The `media.params`
  schema comment in `convex/schema.ts` and `media-vault\README.md` both describe the watcher as
  serialising an object for you. As of 2026-08-15 neither the watcher nor the route does — the
  watcher forwards `candidate.sidecar` verbatim. The code is the contract.)
- **`refs` is not an ingested field.** `media-vault\README.md` lists it in its example body; it is
  not in `sanitizeSidecar`'s allowlist and there is no `refs` column on the row. It is accepted and
  dropped. Put reference information in `params` or `tags` if you need it to survive.

**`style` is a slug lookup, not free text.** It is resolved against the curated `mediaStyles`
table's `by_slug` index. A slug with no matching row resolves to *no style* on the row — absence,
never an error, and never the raw slug displayed as if it were a style name.

---

## 4. `sidecarStatus` — the three states

`readSidecar` returns exactly one of these per media file, and **never throws on any path**:

| value | when | effect on the row |
|---|---|---|
| `absent` | no sidecar file at either the primary or the fallback path | row created, provenance absent |
| `present` | the sidecar parsed as a plain JSON object | row created, provenance copied per §3 |
| `malformed` | the sidecar exists but does not parse as JSON, **or** parses to a non-object (an array, `null`, a number, a string) | **treated exactly as `absent`** — row created, provenance absent, a warning naming the sidecar path written to stderr |

**`malformed` never skips the file.** This is the load-bearing rule of the whole contract. A file
vanishing from a directory you are looking at is the failure mode with no diagnostic: you see the
file on disk, you do not see it in the gallery, and nothing anywhere tells you why. So a broken
sidecar costs you the provenance and nothing else — the media still ingests, is still visible, is
still star-able, and is still filterable.

---

## 5. What a row with no provenance looks like

The row is created normally. It is visible in the gallery grid, can be starred, can be filtered
(there is a `Missing Provenance` filter chip), can be soft-deleted and restored, and its file path
can be copied.

Its `prompt` / `model` / `provider` / `style` / `project` / `params` fields each render the exact
string:

```
No provenance recorded
```

**Provenance is never inferred from the filename.** A file called
`a-photorealistic-sunset-over-mountains.png` produces a row whose `prompt` is *absent*, not
`"a photorealistic sunset over mountains"`. This is the specific mistake the rule exists to
prevent: a filename-derived prompt is indistinguishable from a real one at the point where someone
copies the recipe and expects it to reproduce the image. Nothing in the ingest path reads the
filename for anything except the `filename` column and the extension classification.

---

## 6. Latency, and the size rules

**Ingest latency: at most 5 minutes.** The `StudioWatch` scheduled task runs a full watch cycle
every 5 minutes. Running `/studio-sync` triggers a cycle immediately.

Write the media file and its sidecar before the cycle you expect to ingest them — a media file that
lands in one cycle and gains its sidecar in the next ingests **without** provenance, because the row
was already created on the first cycle and a duplicate content hash is a zero-write no-op. Write
the sidecar first, or write both, then sync.

**Originals never enter Convex.** Only a webp thumbnail does, hard-capped at **200 KB**, produced by
a bounded ffmpeg quality/scale ladder that *refuses* rather than uploading past the cap. So:

- A 500 MB video in the vault is completely fine. Its original bytes are never uploaded, never
  fetched by the browser, and never counted against any budget here.
- `absPath` is a copy-to-clipboard string in the UI. It is never used as an `<img src>` or an
  `<a href>`; opening the original is a local action.
- Audio files get no thumbnail at all (no ffmpeg invocation, an audio placeholder in the UI) — a
  fabricated waveform would be inventing a signal that does not exist.
- If the thumbnail refuses at the cap, the row still ingests, just without a thumbnail. "Present
  with a gap" always beats "silently absent".

---

## 7. Soft delete, and `trash\`

You do not need to implement any of this, but knowing it prevents surprises:

Deleting from the gallery sets a `deletedAt` timestamp on the row; the row leaves the grid
immediately. The **next watcher cycle** moves the file from `gen\`/`refs\`/`styles\` into `trash\`.
Restoring clears the timestamp and the next cycle moves the file back into the directory its `kind`
implies. After 30 days a janitor deletes the row and its thumbnail blob together, and the watcher
then reclaims the orphaned file from `trash\`.

`trash\` is not scanned for new media. Do not write there.

---

## 8. Worked example

Two files, written together into `C:\Users\mandr\media-vault\gen\`:

`studio_hero_a1_20260815T101500.png` — the media file (an 812 KB PNG).

`studio_hero_a1_20260815T101500.png.json` — the sidecar:

```json
{
  "prompt": "a lone cyan lighthouse on a black basalt shore, long exposure",
  "model": "gpt_image_2",
  "provider": "higgsfield",
  "project": "studio",
  "params": "{\"aspect_ratio\":\"1:1\",\"quality\":\"1080p\"}",
  "tags": ["lighthouse", "phase-118"]
}
```

Within one watcher cycle the gallery shows a row with:

| row field | value |
|---|---|
| `filename` | `studio_hero_a1_20260815T101500.png` |
| `absPath` | `C:\Users\mandr\media-vault\gen\studio_hero_a1_20260815T101500.png` |
| `mediaType` | `image` (from `.png`) |
| `kind` | `gen` (from the directory) |
| `contentHash` | the file's SHA-256 hex |
| `sizeBytes` | `831488` — the **original's** size, not the thumbnail's |
| `prompt` / `model` / `provider` / `project` / `params` / `tags` | copied verbatim from the sidecar |
| `styleId` | absent (no `style` slug was given) |
| `thumbStorageId` | a Convex storage id for the ≤200 KB webp thumbnail |
| `starred` | `false` |
| `deletedAt` | absent |

Omit the sidecar entirely and every row field above still appears **except** the provenance block,
which renders `No provenance recorded` in each of its six fields. That pair — a complete recipe and
an empty one, side by side in the same grid — is how the provenance path is proven to actually
discriminate, rather than being proven by "the image appeared", which looks identical when the
sidecar reader is silently returning nothing.

---

## 9. The reference implementation

`~/.claude/skills/studio-generate/SKILL.md` (host-side, not repo content) is the one skill in this
system that owns sidecar writing. It reads the chosen model's `recipeMd` card from the
`mediaModels` table, calls that backend, downloads the asset into `gen\`, and writes the sidecar
per this document.

**It is deliberately the only one.** The eight pre-existing media skills — `higgsfield-generate`,
`higgsfield-marketplace-cards`, `higgsfield-product-photoshoot`, `higgsfield-soul-id`,
`digital-art-factory`, `caught-on-camera`, `cryptidvlog`, `ugc-factory` — are **not** modified to
write sidecars, so that this contract lives in exactly one place and cannot drift eight ways. Media
produced by calling one of those skills directly still lands in the vault without a sidecar, and
that is a *defined* outcome (§4/§5), not an unhandled case. Do not "fix" it by retrofitting the
eight.

**Credentials are never part of this contract.** A sidecar carries no key, and the `recipeMd` cards
reference environment-variable **names** only — no key value is stored in Convex, in a sidecar, or
in any card.

---

## 10. For Ástríðr (SEED-028)

Seed file: `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md` (v29 candidate).

Ástríðr as a sidecar-writing generator is **deferred**, deliberately and on the record (Phase 118
D-10). It is deferred rather than dropped because making it blocking would have put Studio's close
date inside another repository's unstarted milestone — the pattern that left BSC-01 PARTIAL for a
whole milestone.

This document is the handoff. When SEED-028 is picked up:

- **Conforming to this document is the entire integration.** There is no CodePulse API to call, no
  endpoint to authenticate against, no library to depend on, and no CodePulse code to read. Write
  the media file and its `.json` sidecar into `MEDIA_VAULT_ROOT\gen\` and the row appears within
  five minutes.
- The bearer-gated `/studio/ingest` route exists but is **not** the integration surface — it is the
  watcher's private wire, and reaching it directly would duplicate hashing, thumbnail encoding and
  dedup that already work.
- If Ástríðr writes media from inside a container, the vault path must be a bind mount the host
  watcher can see; the watcher only ever reads the host filesystem.
- The sidecar's `provider` field should be the *generation backend* Ástríðr used, not `astridr`
  itself — put that in `project` or `tags`. Otherwise every row she produces collapses into one
  provider filter regardless of what actually made the image.
