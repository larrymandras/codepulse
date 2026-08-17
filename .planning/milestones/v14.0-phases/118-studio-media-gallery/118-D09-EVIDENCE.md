# Phase 118 — D-09 per-backend end-to-end proof log

D-09 requires **three genuinely different code shapes proven end to end** before this phase closes:
a CLI wrapper, a direct-API recipe, and OpenArt. One `## LEG:` section per backend, written by the
plan that proved it. A leg with no section here is **unproven**, not "probably fine".

| Leg | Shape | Plan | Status |
|---|---|---|---|
| higgsfield | CLI wrapper | `118-12` | **PROVEN** — see below |
| fal.ai | direct API | `118-13` | **PROVEN** — see below |
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

---

## LEG: fal

**Proven 2026-08-15 by plan `118-13`, attended.** Real money spent on Larry's fal.ai account with
his explicit prior approval of the model id and the quoted cost.

### The invocation

```
node hooks/studioFal.mjs \
  --model fal-ai/flux/schnell \
  --prompt "a lone cyan lighthouse on a black basalt shore, long exposure, cold northern light" \
  --params '{"image_size":"square_hd","num_images":1,"output_format":"png"}' \
  --out "C:\Users\mandr\media-vault\gen\studio_falflux_a1_20260815T175919.png"
```

- **Model id `fal-ai/flux/schnell`** (display name `FLUX.1 [schnell]`, `category: text-to-image`,
  `status: active`, `license_type: commercial`) — **read off fal.ai's own listing endpoint**
  (`GET https://api.fal.ai/v1/models`), never hand-constructed. All **15 pages / 1,450 model
  endpoints** were walked and matched client-side.
- **Control:** `fal-ai/definitely-not-a-real-model-9x7q2` came back **NOT FOUND** across the same
  1,450 endpoints, so a "PRESENT" verdict carries information.
- **Why the walk instead of the API's own find mode:** passing `model_id=<id>` was measured to be
  **silently ignored** — a two-id request returned all 100 items of page one ("returned 100 of 2
  requested"). An unknown query parameter that is dropped rather than rejected turns a find into an
  unfiltered list, and every id you ask about then appears to exist. This is the same class of
  false positive as a mis-spelled grep returning zero; it just fails in the opposite direction.
- **Input schema transcribed from fal's own OpenAPI expansion** (`expand=openapi-3.0`,
  schema `FluxSchnellInput`), not guessed: `prompt` (string, the only required field),
  `image_size` (default `landscape_4_3`; the enum includes `square_hd`), `num_images` (1),
  `output_format` (`jpeg`/`png`, default `jpeg`), `num_inference_steps` (4), `guidance_scale` (3.5),
  `acceleration` (`none`), `enable_safety_checker` (true), `seed` (nullable).

### Cost

**$0.003** — $0.003 per megapixel, billed rounded **up** to the nearest megapixel, per fal's pricing
documentation. `square_hd` is 1024x1024 = exactly 1 MP.

Stated as a **published rate, not a per-call quote.** fal's models API carries **no pricing field at
all** — every metadata key was enumerated and checked (`price-ish fields: NONE`). There is no
equivalent of Higgsfield's `generate cost`, so unlike the higgsfield leg this figure could not be
confirmed against the provider before spending, and that limitation is recorded rather than papered
over.

### The API contract, verified against fal's own documentation

Source: <https://fal.ai/docs/documentation/model-apis/inference/queue> (fetched 2026-08-15).
Context7 MCP was **not available in this session** — its tools are not in the loaded MCP surface —
so a documentation fetch was used, and that substitution is stated rather than left implicit.

- Submit: `POST https://queue.fal.run/{model_id}`.
- **Auth header is `Authorization: Key <token>`, NOT `Bearer`.** Every other authenticated call in
  this repo uses Bearer, so the house habit is the wrong answer here and would have produced a 401
  indistinguishable from a bad key. Confirmed live: the models endpoint returned **HTTP 200** to
  `Key <token>`.
- Submit returns `request_id`, `response_url`, `status_url`, `cancel_url`, `queue_position`. The
  client **polls and fetches using the URLs the API hands back**, falling back to the documented
  template only when a field is absent.
- Status values: `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`. Anything else is treated as terminal rather
  than in-flight, so a state fal adds later cannot make the loop poll a dead job to the budget.

### The file, and the sidecar

`C:\Users\mandr\media-vault\gen\studio_falflux_a1_20260815T175919.png` — **998,230 bytes**,
1024x1024 PNG.

Sidecar written to the contract's **primary** form (media path + `.json`), 431 bytes, carrying
`prompt`, `model` (`fal-ai/flux/schnell`), `provider` (`fal`), `project` (`studio`), `params` as a
JSON **string**, and `tags` (`lighthouse`, `phase-118`, `fal-leg`).

No credential value appears in it, and none can: the client returns only the model id, the prompt,
the provider and the params actually sent.

The basename is **33 characters**, deliberately under the 40-character threshold at which
`detectCredentialValue`'s rule C fires — the documented false positive that the plan-12 control
file's 47-character name trips.

### Ingest

| fact | value |
|---|---|
| `media:list` read **before** the sync | **2 rows** at 17:59:55 UTC — the fal asset absent |
| generation completed | ~17:59:19 UTC (the `--out` timestamp) |
| `/studio-sync` cycle | 18:00:03 UTC |
| watcher line | `scanned=3 rehashed=1 ingested=1 duplicates=2 refused=0 thumbnailRefused=0 trashMoved=0 trashRestored=0 trashReclaimed=0`, exit 0 |
| elapsed generation to row | **~44 seconds**, inside one 5-minute cycle |

The pre-sync read is what **dates** the ingest to this cycle rather than to an earlier unattended
`StudioWatch` fire; without it, a row that had been there all along would look identical.

**Thumbnail measured, not read from a field:** the stored blob was fetched over HTTP and its bytes
counted — **16,196 bytes**, `image/webp`, HTTP 200, comfortably under the 204,800-byte D-02 cap. The
998,230-byte original never entered Convex.

### The control pair, in one grid view

Rendered at `/studio` on the auth-disabled dev server (`VITE_CLERK_PUBLISHABLE_KEY=` set from Git
Bash — PowerShell's empty-string assignment *deletes* the variable and falls back to `.env.local` —
port 5181, `--host 127.0.0.1`), stopped afterwards: `:5181` now returns **000** while `:5173` still
returns **200**.

| | fal.ai | higgsfield | sidecar-less control |
|---|---|---|---|
| `hasProvenance` | **true** | **true** | **false** |
| `provider` / `model` | `fal` / `fal-ai/flux/schnell` | `higgsfield` / `z_image` | `<absent>` / `<absent>` |
| `project` | `studio` | `studio` | `<absent>` |
| `prompt` / `params` / `tags` | all populated | all populated | all `<absent>` |
| `sizeBytes` and dims | 998,230 · 1024x1024 | 6,316,863 · 1024x1024 | 812 · 256x256 |

**3 cards, exactly 1 `No provenance recorded` badge.** That ratio is the discriminating result: a
broken sidecar reader would render three badges, and a reader that inferred provenance from the
filename would render zero. "The image appeared" distinguishes neither. The page's own chips agree —
`All 3`, `Image 3`, `Video 0`, `Audio 0`, `Starred 0`, `Missing Provenance 1`, `STYLES (0)`,
`MODELS (2)` — and the two model chips read `fal-ai/flux/schnell` and `z_image`. **0 console
errors.**

### THE SHAPE DIFFERENCE — this leg's actual purpose

D-09 is not "three backends work". It is **three genuinely different code shapes**, because a
contract that only works for one shape is a contract shaped like that one caller. Concretely, this
leg differs from the higgsfield leg at every layer:

| | higgsfield leg | fal.ai leg |
|---|---|---|
| transport | spawn a CLI subprocess | HTTP `fetch` |
| waiting | `--wait` — **the CLI blocks and does its own polling** | **this client owns the poll loop**: submit returns immediately with a request id |
| completion signal | process exit plus a terminal `status` in JSON stdout | HTTP status parsing across N `status_url` GETs until `COMPLETED` |
| failure handling | whatever the CLI's exit code says | explicit bounded retry with a transient/non-transient split; a 401 is never retried |
| result bytes | a `result_url` handed back, downloaded by the shared step 3 | `response_url` then `images[0].url`, **streamed to disk by the client**, absorbing step 3 |
| auth | OAuth 2.0 PKCE session in a local credentials file, **no env var at all** | `FAL_KEY` env var, `Authorization: Key <token>` |
| params | flags on a command line | a JSON request body |

**Did the sidecar contract need to change to accommodate it? NO — zero edits.** That is the finding,
and it is the answer D-09 was asked to produce. Every field this leg emits (`prompt`, `model`,
`provider`, `params`) already existed with the right wire type; section 9 already named fal.ai and
`FAL_KEY` as the one leg needing a provider variable; and the params-must-be-a-JSON-string rule
turned out to be **backend-independent** rather than an artifact of parsing CLI output. The contract
is not CLI-shaped.

The one adjustment landed in `~/.claude/skills/studio-generate/SKILL.md`, not in the contract: this
leg **absorbs shared step 3**, because the result URL is only known after the poll completes and the
client already has to stream those bytes — a second `curl` would be a redundant round trip over the
same CDN object. The "Backend legs" preamble, which had asserted that steps 1/3/4/5 are shared by
every leg, was corrected in the same pass; it went stale the moment this leg landed.

### D-12: the second recipe card

```
npx convex run internal.media.upsertModelCard '<json>' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

`FLAGS USED: ["--env-file"]` · `--push present? false` · `--prod present? false` — printed at
invocation, so the claim is checkable rather than asserted.

Verified deployed **before** use, control-paired: `internal.media.upsertModelCard '{}'` reaches
`ArgumentValidationError: Object is missing the required field 'enabled'` and echoes the exact
validator shape, while `internal.media.definitelyNotDeployed9x7q2` is not found.

```
1st run -> { "created": true,  "modelId": "pd7rdwwgcg9pj1hbhp2et17g1h8cgcky", "ok": true }
2nd run -> { "created": false, "modelId": "pd7rdwwgcg9pj1hbhp2et17g1h8cgcky", "ok": true }
```

The second run is the **live** idempotency control: same `modelId`, `created:false` — patched, not a
second row.

**Every `mediaModels` row, cross-checked. TOTAL 2:**

| slug | name | type | provider | enabled | aspect | resolution | docsUrl | recipeMd |
|---|---|---|---|---|---|---|---|---|
| `z_image` | Z Image | image | higgsfield | true | 1:1 | 1024x1024 | `<absent>` | 2,208 chars |
| `fal-ai/flux/schnell` | FLUX.1 [schnell] (fal.ai) | image | fal | true | 1:1 | 1024x1024 | `<absent>` | 3,328 chars |

**Zero cards for models nobody has run** (T-118-38). `docsUrl` is deliberately absent on both rather
than a guessed URL.

The card was **not pre-screened** against a local re-implementation of `detectCredentialValue`: the
deployed guard accepting it IS the acceptance verdict, since a local copy of the regexes could
diverge and green a card the real guard would refuse. Both stored cards were then pulled back **out
of Convex** and scanned — **CLEAN**, with three known-positive controls tripping first. `FAL_KEY`
appears in the card as a bare NAME only.

### A shell trap worth recording

`npx convex run <fn> "$(cat card.json)"` silently truncated a **pretty-printed** JSON file to a
single `{`, producing `SyntaxError: JSON5: invalid end of input at 1:2`. The `npx` `.cmd` shim
mangles a multi-line argument on Windows. **Minifying the JSON to a single line fixed it** — the
same file, JSON-stringified with no newlines, was accepted verbatim.

Separately control-verified before using command substitution at all, because the card's `recipeMd`
contains backticks and dollar-parens: a file containing those literals arrived at `argv`
**unexecuted**, so bash does not re-evaluate the result of a command substitution.

### Cleanup

The generated asset and its sidecar are **left in place** — they are the evidence. Nothing was moved
to `trash\`; `trashMoved=0 trashRestored=0 trashReclaimed=0` on the proving cycle. The vault now
holds three media files plus two sidecars, and any future test that assumes an empty vault or
`scanned=0` is wrong.

## LEG: third — selected shape

**Written before any implementation code, which is this task's entire purpose.** The branch was a
read, not a discovery: it was measured and fixed in wave 1 by plan `118-02` precisely so wave 9
would not have to find it out by trying.

### 1. The branch, read verbatim

`118-OPENART-EVIDENCE.md` § "Third leg selection" records, as a whole token:

**THIRD_LEG: openart-mcp**

Read as the complete token after the `THIRD_LEG:` label, not as a substring match — the two
authorised OpenArt branches (`openart-mcp` and `openart-mcp-interactive`) are prefix-related, so a
substring test cannot tell them apart. The selected branch is the FORMER: a live in-session MCP
tool invocation. The `-interactive` variant, in which nothing automated writes the sidecar at all,
was NOT selected.

### 2. What that selects

The `openart-mcp` shape: generation happens through MCP tool calls made inside this session, and
`hooks/studioThirdLeg.mjs` implements only the back half — placing the returned asset into
`media-vault\gen\` and writing its sidecar per `docs/studio-sidecar-contract.md`. There is no
HTTP client and no polling loop of our own in the module, because the tools
`mcp__openart__openart_generate_image` / `openart_generate_video` return a `historyId` and the
documented completion path on a text-only host is `mcp__openart__openart_creation_wait(historyId)`.
Model ids are read from `mcp__openart__openart_model_list` and per-mode fields from
`openart_model_form_get`; **no model id is hand-constructed** (the 2026-08-07 rule — a
hand-constructed identifier for an external service cannot distinguish "not entitled" from "no such
name").

### 3. Shape difference, measured against BOTH existing legs

This is the D-09 question that matters, and the answer is not a near-duplicate of either.

| | leg 1 — higgsfield | leg 2 — fal.ai | **leg 3 — openart-mcp** |
|---|---|---|---|
| transport | spawn a CLI subprocess | HTTP `fetch` from our own client | **MCP tool call over the session's connector** |
| who owns the wait | the CLI blocks on `--wait` | **our client owns the poll loop** | **the MCP server owns it**; we call `openart_creation_wait` and re-call on `STILL_RUNNING` |
| completion signal | process exit + terminal `status` in stdout JSON | HTTP status parsed across N `status_url` GETs | a tool RESULT payload with status `COMPLETED` and resource URLs |
| failure handling | the CLI's exit code | explicit bounded retry, transient/non-transient split, 401 never retried | MCP transport errors surface as tool errors — **we write no retry policy at all** |
| auth | OAuth 2.0 PKCE session in a local credentials file | `FAL_KEY` env var, `Authorization: Key <token>` | **OAuth session held by the MCP client** — no credential ever enters our process |
| params | flags on a command line | a JSON request body we construct | tool arguments validated against a server-published form schema |
| what our code does | wrapper + download | submit, poll, stream, sidecar | **placement + sidecar only** |

**Is this a near-duplicate of leg 2?** No, and the distinguishing fact is structural rather than
cosmetic: leg 2's module contains a queue-submit call, a bounded poll loop, a retry policy and an
`Authorization` header, and leg 3's module contains **none of those four**. The module's entire
surface is "given bytes or a URL plus the provenance the tool reported, place the file and write the
sidecar." If a future edit gives `studioThirdLeg.mjs` its own HTTP client and poll loop, that edit
has collapsed leg 3 into leg 2 and defeated D-09's intent — stated here so the collapse is
detectable later rather than arguable.

This is also the strongest available test of the contract's generator-independence: legs 1 and 2
both had a *program* producing the sidecar from a machine-readable generator response. Leg 3's
provenance arrives as an MCP tool result in a conversation, and the sidecar it produces must still
be byte-identical in structure. That is the assertion Task 2's tests carry.

### 4. Environment variable NAMES required

- `MEDIA_VAULT_ROOT` — where the asset and sidecar are written. Already required by the other legs.
- **No provider credential variable exists for this leg.** OpenArt auth is an OAuth session held by
  the MCP client; it is never an env var, never stored in Convex, and never read by our code. This
  is itself a D-12-relevant fact: the third recipe card documents a TOOL INVOCATION — tool name and
  argument shape — and names no key, because there is none to name.

No value for any variable appears anywhere in this section.

### 5. Precondition re-check required before Task 3

`118-OPENART-EVIDENCE.md` recorded plan **Free / 7 credits** against a cheapest-generation floor of
**10** (`kling-3-omni` `text2image`), i.e. capable but not executable. Larry subsequently topped up
(commit `8e4f76ea`, "~24K credits"). **That figure is a commit message, which is a claim, not
evidence** — Task 3 re-reads the balance with `openart_account_get` at the moment of use and
refuses honestly rather than attempting a generation it cannot pay for.

### 6. No implementation file was created in this task

Verified by `git status --porcelain` at task close: the only path touched is this evidence file.

## LEG: third — the proof

Run 2026-08-16, attended, plan `118-14` Task 3. Branch `openart-mcp` exactly as fixed in Task 1.

### Auth — and the control that makes the pre-state meaningful

The OpenArt MCP was installed but **not authenticated** at session start: the registry exposed only
`mcp__openart__authenticate` and `complete_authentication`. That is not an inference from a failed
call — a direct name lookup for all five real tools returned nothing while a name-scoped query still
returned the two bootstrap tools, so the registry probe demonstrably worked and the absence was real.
After Larry completed the browser OAuth, the sixteen real tools appeared **and the two bootstrap
tools disappeared** — a two-sided transition, which is stronger evidence than either half alone.

One flow was lost in between (`complete_authentication` reported no flow in progress despite a
matching `state`); a fresh `authenticate` succeeded. Recorded because the flow evidently does not
survive long, which matters for anyone repeating this.

### Balance, priced BEFORE spending

| | |
|---|---|
| plan / balance before | **Pro**, `24000` credits |
| cheapest config on the account | `kling-3-omni` `text2image`, 1k / 4:3 -> **10 credits** |
| balance after | `23990` |
| **delta** | **exactly 10**, matching the quote |

The wave-1 measurement recorded Free / 7 credits against a 10-credit floor, i.e. capable but not
executable. Commit `8e4f76ea` claimed a top-up to "~24K"; that was a commit message, so it was
re-read with `openart_account_get` at the moment of use rather than trusted. It held.

### The generation

Model id read from `openart_model_list` and param schema from `openart_model_form_get` — **neither
hand-constructed**. Mode `text2image`.

```
imageCount 1 · resolution 1k · resultType single · seriesAmount 4 · aspectRatio 4:3
autoEnhancePrompt FALSE
```

`autoEnhancePrompt` is false deliberately. Left true, OpenArt may rewrite the prompt server-side and
the sidecar would then record a prompt that does not reproduce the image — the exact copyable-recipe
failure contract section 5 exists to prevent. This is now stated in the recipe card so it cannot be
"tidied" back to the default.

`openart_generate_image` -> `historyId thCUxHPUKji4OY1RywRr`, status `PENDING`.
`openart_creation_wait` -> `COMPLETED`, one image resource, 1168x880 png.

### A DEFECT FOUND BY READING THE OUTPUT RATHER THAN THE EXIT CODE

The first placement run **exited 0, printed nothing, and wrote nothing.**
`hooks/studioThirdLeg.mjs` exported `main()` but had no entry-point block, so
`node hooks/studioThirdLeg.mjs --url ...` merely defined its exports and ended. At the shell that
is **indistinguishable from success** — exit 0, no stderr.

It was caught because `main()` prints a JSON result on success and no JSON appeared. Confirmed
before fixing: `0` files matching `oa_*` in the vault, with the five pre-existing vault files
listed as the control proving the probe could see files at all.

Fixed with the house-convention guard (`process.argv[1]` ... `endsWith("studioThirdLeg.mjs")`,
matching `studioFal.mjs:573`), and a regression test now asserts the guard exists **and names this
file** — a copy-pasted guard naming another module would never fire and would reproduce the same
silent no-op. Mutation-proven: deleting the block -> RED; pointing it at `studioFal.mjs` -> RED.

This is the ninth defective-check-or-silent-pass found in this phase, and the first where the
misleading signal was an **exit code** rather than a grep.

### Placement

```
C:\Users\mandr\media-vault\gen\oa_kling-3-omni_20260816T200405.png       1,407,791 bytes
C:\Users\mandr\media-vault\gen\oa_kling-3-omni_20260816T200405.png.json        619 bytes
```

First eight bytes `89 50 4E 47 0D 0A 1A 0A` — a real PNG, not an error page saved under a .png name.

The sidecar as written, with `params` a JSON **string** per contract section 3, `prompt` and the
nested params prompt elided here only for width:

```json
{
  "prompt": "a brass and glass observatory instrument panel, dozens of small illuminated dials in cyan and amber, shallow depth of field, dust motes in a single shaft of light, photoreal, 4:3",
  "model": "kling-3-omni",
  "provider": "openart",
  "project": "studio",
  "params": "{ ...the submitted params object, serialised... }"
}
```

### Ingest

`node hooks/studioWatch.mjs` (the identical path `/studio-sync` and the scheduled task run):

```
studioWatch: 4 candidate(s) found in C:\Users\mandr\media-vault
studioWatch: scanned=4 rehashed=1 ingested=1 duplicates=3 refused=0 thumbnailRefused=0 ...
```

`ingested=1` with `duplicates=3` is the discriminating result: the three pre-existing assets were
correctly recognised as already-ingested, so the 1 is this run's file and not a re-ingest.

### The row, read back OUT of Convex — not off the disk I wrote

`api.media.list` -> 4 rows (cap 500):

| field | value |
|---|---|
| `filename` | `oa_kling-3-omni_20260816T200405.png` |
| `mediaType` / `kind` | `image` / `gen` |
| `provider` / `model` | `openart` / `kling-3-omni` |
| `project` | `studio` |
| `prompt` | the full submitted prompt, verbatim |
| `params` | present, and **`typeof === "string"`** |
| `contentHash` | `f24eb8bf7c8a6013bc7fed8ad69fb1ea9d5c9b87363665431fa844484e86ae46` |
| `sizeBytes` | `1407791` — byte-identical to the file on disk |
| `thumbStorageId` | present |
| `starred` / `deletedAt` | `false` / absent |

### THE D-07 CONTROL PAIR, in the same list, in the same call

`studio_control-no-sidecar_a1_20260815T144553.png` sits in the same `api.media.list` response with
`prompt` **absent** and `provider` **absent** — it renders `No provenance recorded`. A complete
recipe and an empty one, side by side. Without that pair, "the image appeared with a prompt" looks
identical to a sidecar reader that is silently returning nothing for everyone.

### D-12: the third recipe card

`internal.media.upsertModelCard` (an `internalMutation`, invoked attended via `npx convex run` with
the deployment's admin credentials) -> `{"created": true, "modelId": "pd7jd71w0f0dmw11mrkmtk2fes8cjwj1"}`.
Three cards now stored: `z_image`, `fal-ai/flux/schnell`, `openart-kling-3-omni`.

**The card was NOT pre-screened against a local re-implementation of `detectCredentialValue`** — the
deployed guard accepting it IS the acceptance verdict, since a local copy of the regexes could
diverge and green a card the real guard would refuse. It was then pulled back **out of Convex**
(1941 chars) and scanned as a secondary check: rules A, B and C all clean.

The card names **no credential variable**, because this leg has none — it documents the tool
invocation instead. `MEDIA_VAULT_ROOT` appears as a path; `FAL_KEY` does not appear at all.

### A REAL GAP IN `detectCredentialValue`, found by getting a control wrong

The first scan run used `FAL_KEY=abc123def456ghi789` as rule A's known-positive control and it
**did not trip**. The card was fine; the control was wrong — and chasing why exposed a genuine
narrowness in the shipped guard.

Rule A's name pattern is `API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL`. Measured:

| literal | rule A |
|---|---|
| `HIGGSFIELD_API_KEY=hf3x9q2v8m1p0zt4` (the docstring's own example) | caught |
| `OPENART_TOKEN=...` / `MY_SECRET: ...` / `STUDIO_API_KEY=...` | caught |
| **`FAL_KEY=abc123def456ghi789`** | **NOT caught** |
| **`ANTHROPIC_KEY=abc123def456ghi789`** | **NOT caught** |

`_KEY` alone is not in the alternation. Rule C does not save it either: its bound is exactly 40
unbroken `[A-Za-z0-9_-]` characters (39 -> false, 40 -> true), and a realistic fal.ai key shape
`<uuid>:<32-hex>` is 69 chars whose **longest unbroken run is 36**, because the colon and hyphens
break it. So a pasted real `FAL_KEY` value would pass the guard entirely.

This is **not** a contradiction of the guard's docstring, which already says it is a backstop and
lists "a secret that simply does not look like one" as out of scope. It is worth recording because
`FAL_KEY` is this repo's own primary provider credential, so the single most likely paste is the one
the name pattern misses. **Deliberately not fixed here:** the guard belongs to closed plan `118-12`,
and widening a security predicate mid-plan without its own control pairs is how a guard that refuses
legitimate cards gets shipped. Surfaced to Larry as a finding.

### THE SHAPE DIFFERENCE, now measured rather than argued

Task 1 predicted the difference; the run confirms it. Leg 3's module contains **no** queue submit,
**no** poll loop, **no** retry policy and **no** `Authorization` header — asserted by test with
`studioFal.mjs` as the known-positive control proving those patterns do match where they exist.
Generation happened as an MCP tool call in a conversation; the module only placed bytes and wrote
JSON.

**And the sidecar contract needed ZERO edits — for the third time and on the hardest case.** Legs 1
and 2 both had a *program* turning a machine-readable generator response into a sidecar. Here the
provenance arrived as a tool result in a session, and the contract still absorbed it unchanged. The
test asserts this against leg 2's **real** output — by running `studioFal`'s own `generate` with a
mocked fetch — rather than against a hand-written expectation, which would only have proven the
module matches my belief about the contract.

**D-09 CLOSES: three backends, three genuinely different shapes, each proven end to end.**

| leg | shape | credential | proven |
|---|---|---|---|
| higgsfield | CLI subprocess, `--wait` blocks | none (OAuth file) | yes |
| fal.ai | our own HTTP queue/poll client | `FAL_KEY` | yes |
| openart | in-session MCP tool call | none (OAuth in MCP client) | yes, 2026-08-16 |
