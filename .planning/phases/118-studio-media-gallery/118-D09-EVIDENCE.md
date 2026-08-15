# Phase 118 — D-09 per-backend end-to-end proof log

D-09 requires **three genuinely different code shapes proven end to end** before this phase closes:
a CLI wrapper, a direct-API recipe, and OpenArt. One `## LEG:` section per backend, written by the
plan that proved it. A leg with no section here is **unproven**, not "probably fine".

| Leg | Shape | Plan | Status |
|---|---|---|---|
| higgsfield | CLI wrapper | `118-12` | **PROVEN** — see below |
| fal.ai | direct API | `118-13` | not yet run |
| openart | MCP tools in-session | `118-14` | not yet run (capable; balance-gated, see `118-OPENART-EVIDENCE.md`) |

---

## LEG: higgsfield

**Proven 2026-08-15 by plan `118-12`, attended.** Real credits spent with Larry's explicit prior
approval of the model slug and the quoted cost.

### The invocation

Generated through `~/.claude/skills/studio-generate/SKILL.md`'s Higgsfield leg. The concrete
command:

```
higgsfield generate create z_image \
  --prompt "a lone cyan lighthouse on a black basalt shore, long exposure" \
  --aspect_ratio 1:1 --wait --json
```

- **Model slug: `z_image`** (display name "Z Image"), enumerated from
  `higgsfield model list --image --json` — 30 image models returned — never hand-constructed.
- Params schema read from `higgsfield model get z_image`: `prompt` (string, required),
  `aspect_ratio` (`1:1|4:3|3:4|16:9|9:16`, default `1:1`).

**CLI contract verified against the installed binary's own help**, with a control proving the help
output is a real recognition rather than a permissive echo:

```
$ higgsfield generate create --help
Usage:
  higgsfield generate create <job_type> [--param value]... [flags]
Use --wait to block until each job finishes and print the result URL(s).

$ higgsfield definitely-not-a-real-subcommand-9x7q2
Error: unknown command "definitely-not-a-real-subcommand-9x7q2" for "higgsfield"
```

and, for the slug itself:

```
$ higgsfield generate cost z_image --prompt "..."
0.15 credits
$ higgsfield generate cost definitely_not_a_model_9x7q2 --prompt "..."
Error: No model with job_type "definitely_not_a_model_9x7q2".
```

A well-formed rejection from a real API is indistinguishable from an entitlement verdict when the
identifier was guessed; the control is what makes the `0.15 credits` quote evidence.

### The spend

| | |
|---|---|
| Quoted before approval | **0.15 credits** (`higgsfield generate cost z_image`) |
| Balance before | `mandrasle@gmail.com — ultra plan, **3537.27** credits` |
| Balance after | `mandrasle@gmail.com — ultra plan, **3537.12** credits` |
| **Actually charged** | **0.15 credits** — matches the approved quote exactly |

One generation. Nothing was run before Larry's approval.

### The generated asset and its sidecar

```
C:\Users\mandr\media-vault\gen\studio_lighthouse_a1_20260815T144604.png        6,316,863 bytes
C:\Users\mandr\media-vault\gen\studio_lighthouse_a1_20260815T144604.png.json         310 bytes
```

Sidecar written in the **primary** form (media file's full path + `.json`), per
`docs/studio-sidecar-contract.md` §2. Contents verbatim — **no credential value appears, and none
exists to appear: this leg names no provider credential variable at all**:

```json
{
  "prompt": "a lone cyan lighthouse on a black basalt shore, long exposure",
  "model": "z_image",
  "provider": "higgsfield",
  "project": "studio",
  "params": "{\"aspect_ratio\":\"1:1\",\"batch_size\":1,\"height\":2048,\"width\":2048}",
  "tags": ["phase-118", "d-09", "higgsfield-leg"]
}
```

`params` is a **JSON string**, not an object — `convex/studioHttp.ts`'s `sanitizeSidecar` keeps
`params` only when `typeof params === "string"`, and nothing in the pipeline serialises an object
for you. Writing it as an object would have silently dropped the whole field. (`media-vault\README.md`
claimed otherwise and was corrected by this plan.)

### Ingest latency — via `/studio-sync`, ~72 s

| clock (UTC) | event |
|---|---|
| 14:45:53 | sidecar-less control file placed in `gen\` |
| 14:46:04 | generation job created; asset downloaded to `gen\` immediately after |
| 14:47:01 | `media:list` → `{"cap":500,"rows":[]}` — the 5-minute `StudioWatch` task had **not** yet picked it up |
| 14:47:15 | `/studio-sync` (`node hooks/studioWatch.mjs`) run manually |
| 14:47:16 | cycle complete |

```
studioWatch: 2 candidate(s) found in C:\Users\mandr\media-vault
studioWatch: scanned=2 rehashed=2 ingested=2 duplicates=0 refused=0 thumbnailRefused=0 trashMoved=0 trashRestored=0 trashReclaimed=0
WATCHER_EXIT=0    elapsed=1s
```

Both rows appeared within **one** cycle — well inside the ≤5 minute guarantee, and immediately on
the manual path. The 14:47:01 empty read is the control that dates the ingest to this sync rather
than to some earlier unattended fire.

### THE CONTROL PAIR — one grid view, both states

`118-VALIDATION.md` § "Control-Pair Requirement" pair 2. A deliberately sidecar-less file was placed
in `gen\` **before** the sync so both render together rather than needing a second pass. A single
"the image appeared" assertion is explicitly insufficient — it would look identical if the sidecar
reader were broken and silently returning nothing.

**At the data layer** — one `media:list` call, `cap=500`, `rows=2`:

| field | `studio_lighthouse_a1_…png` (generated) | `studio_control-no-sidecar_a1_…png` (control) |
|---|---|---|
| `hasProvenance` | **true** | **false** |
| `prompt` | `"a lone cyan lighthouse on a black basalt shore, long exposure"` | `<absent>` |
| `model` | `z_image` | `<absent>` |
| `provider` | `higgsfield` | `<absent>` |
| `project` | `studio` | `<absent>` |
| `params` | `{"aspect_ratio":"1:1","batch_size":1,"height":2048,"width":2048}` | `<absent>` |
| `tags` | `["phase-118","d-09","higgsfield-leg"]` | `<absent>` |
| `styleId` | `<absent>` (no style slug used; `mediaStyles` is empty) | `<absent>` |
| `sizeBytes` | 6,316,863 | 812 |
| `width×height` | 1024×1024 | 256×256 |
| `kind` / `mediaType` | `gen` / `image` | `gen` / `image` |
| `thumbnailUrl` | present | present |

The control's provenance fields are **absent**, not blank and not inferred — its filename contains
the words `control` and `no-sidecar` and none of that text reached any provenance field.

**At the render layer** — `/studio` on the auth-disabled dev server (`VITE_CLERK_PUBLISHABLE_KEY=`,
port 5181; the ordinary :5173 server has Clerk enabled and shows a sign-in wall):

```
cards rendered                  : 2
"No provenance recorded" badges : 1 ["No provenance recorded"]
grid shows the generated file   : true
grid shows the control file     : true
page errors: none
```

**Exactly one badge across two cards** is the discriminating result: a broken sidecar reader would
produce two. The page's own filter chips agree — `All 2`, `Image 2`, `Missing Provenance 1`,
`STYLES (0)`, `MODELS (1)`.

Detail sheet for the generated asset, D-07 at field level (`data-present` attribute, not a Tailwind
class string):

```
prompt   : data-present=true  | a lone cyan lighthouse on a black basalt shore, long exposure
model    : data-present=true  | z_image
provider : data-present=true  | higgsfield
style    : data-present=false | No provenance recorded
project  : data-present=true  | studio
params   : data-present=true  | {"aspect_ratio":"1:1","batch_size":1,"height":2048,"width":2048}
```

The `style` row rendering the sentinel inside an otherwise-complete recipe is a second, incidental
instance of the same pair — one absent field beside five populated ones, in one panel.

### Thumbnail bytes vs the D-02 cap

Fetched from each row's `thumbnailUrl` and measured, rather than read from a stored field:

| file | HTTP | content-type | thumbnail bytes | vs 200 KB (204,800) cap |
|---|---|---|---|---|
| `studio_lighthouse_a1_…png` | 200 | `image/webp` | **112,548** (109.9 KB) | **PASS** |
| `studio_control-no-sidecar_a1_…png` | 200 | `image/webp` | **266** (0.3 KB) | **PASS** |

The original is 6,316,863 bytes and never entered Convex — a 56× reduction, which is D-02 working
rather than D-02 being untested.

### The recipe card (D-12)

Seeded for the model **actually run**, and only that model:

```
npx convex run internal.media.upsertModelCard '<json>' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

Flag audit, printed at invocation rather than asserted afterwards:
`FLAGS USED: ["--env-file"]` · `--push present? false` · `--prod present? false`. `convex run` is
read-only; `--push` would deploy the working tree first, which in a shared checkout ships another
session's uncommitted work.

```
1st run -> { "created": true,  "modelId": "pd7sq69qcenerpzfgbvc4vct0n8cg3qc", "ok": true }
2nd run -> { "created": false, "modelId": "pd7sq69qcenerpzfgbvc4vct0n8cg3qc", "ok": true }
```

The second run is the live idempotency control: the **same** `modelId` with `created:false` proves
the slug-keyed path **patched** rather than inserting a second card. One row per slug.

**Every row in `mediaModels`, cross-checked against this evidence file:**

| slug | name | type | provider | enabled | aspect | resolution | docsUrl | recipeMd | proven end to end? |
|---|---|---|---|---|---|---|---|---|---|
| `z_image` | Z Image | image | higgsfield | true | 1:1 | 1024×1024 | `<absent>` | 2,208 chars | **YES — this section** |

**TOTAL ROWS: 1.** Cards exist for **zero** models that have not been run. `docsUrl` is deliberately
absent rather than a plausible-looking guessed URL.

The card's `recipeMd` names environment variables **by NAME only**. Scanned as stored (pulled back
out of Convex, not scanned from local source) with three known-positive controls tripping first:
**0 findings**. Every uppercase identifier it contains: `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL`,
`HIGGSFIELD_CREDENTIALS_PATH`, `MEDIA_VAULT_ROOT` — each a bare name with no value, and
`HIGGSFIELD_API_KEY` appears **only** in the sentence stating the CLI does not read it.

That non-obvious fact is itself part of this leg's proof: measured against the installed binary,
the Higgsfield CLI authenticates by **OAuth 2.0 PKCE into a local credentials file**
(`higgsfield auth --help`), and contains **no** `HIGGSFIELD_API_KEY` and no `*_API_KEY` variable of
any kind — with `HIGGSFIELD_API_URL` and `HIGGSFIELD_CREDENTIALS_PATH` both present as controls
proving the search discriminated. Naming `HIGGSFIELD_API_KEY` in this card would have been a stale
claim on the day it was written.

### Cleanup

The sidecar-less control file is **left in place**. It is 812 bytes, is named
`studio_control-no-sidecar_a1_20260815T144553.png`, and is the standing evidence that the D-07 pair
renders — removing it would leave a gallery where the "No provenance recorded" path has no live
example. The generated asset is likewise left in place: it is the evidence.

Nothing was moved to `trash\`; `trashMoved=0 trashRestored=0 trashReclaimed=0` on the proving cycle.
