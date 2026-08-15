---
phase: 118-studio-media-gallery
plan: 13
subsystem: infra
tags: [fal, direct-api, queue-poll, hooks, secrets, provenance, skills]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery (plan 12)
    provides: "docs/studio-sidecar-contract.md, the /studio-generate wrapper skill with its 'Backend legs' structure, upsertModelCard + detectCredentialValue, and the higgsfield leg this one is deliberately shaped against"
  - phase: 118-studio-media-gallery (plan 07/08)
    provides: "hooks/studioWatch.mjs — the watcher that ingested this leg's asset, and the <homedir>/.claude/skills/studio/.env tier-2 convention resolveFalConfig matches"
provides:
  - "hooks/studioFal.mjs — a from-scratch fal.ai queue/poll/fetch/stream client"
  - "hooks/__tests__/studioFal.test.mjs — 35 control-paired tests, no network"
  - "118-D09-EVIDENCE.md § '## LEG: fal' — D-09's SECOND leg PROVEN"
  - "one mediaModels recipe card, fal-ai/flux/schnell, for the model actually run (D-12)"
  - "~/.claude/skills/studio-generate/SKILL.md — the fal leg as a sibling section (D-11), host-side"
affects: ["118-14 (openart leg is the third and last)", "118-15 (e2e now has three rows to assert against)"]

tech-stack:
  added: []
  patterns:
    - "a bound proven by a CONTROL PAIR — timeout-at-max AND success-on-the-last-permitted-attempt — because a one-sided bound test passes identically against an off-by-one that gives up early"
    - "a retry policy asserting BOTH call counts in one test, since a policy that retries everything passes a 500-only test perfectly"
    - "walking a paginated listing and matching client-side instead of trusting a filter parameter, after measuring that the unknown parameter is silently dropped"
    - "an anti-stub assertion paired with a control confirming the same pattern DOES find the marker in the stub it was derived from"

key-files:
  created:
    - hooks/studioFal.mjs
    - hooks/__tests__/studioFal.test.mjs
  modified:
    - .planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md
    - C:\Users\mandr\.claude\skills\studio-generate\SKILL.md (host-side, not repo-tracked)

key-decisions:
  - "The auth header is `Authorization: Key <token>`, NOT `Bearer`. Verified against fal.ai's own queue documentation and then live (HTTP 200). Every other authenticated call in this repo uses Bearer, so the house habit is the wrong answer here and would have produced a 401 indistinguishable from a bad key. The plan explicitly said 'verify it; do not assume Bearer' and it was right to."
  - "The model id was found by WALKING all 15 pages / 1,450 endpoints of fal's listing and matching client-side, not by using the API's find mode. Measured: passing `model_id=<id>` is SILENTLY IGNORED — a two-id request returned all 100 items of page one. An unknown query parameter that is dropped rather than rejected turns a find into an unfiltered list, and every id you ask about then appears to exist."
  - "The plan's Task 2 acceptance criterion — `git status --porcelain` shows zero modifications under the eight media skill directories — was REPLACED, not transcribed, for the second time in this phase. Plan 118-12 already mutation-proved it blind (`~/.claude/.gitignore:72` ignores `skills/`; appending a byte inside one leaves `git status` EMPTY). Substituted the same SHA-256 content manifest, self-tested first."
  - "The sidecar contract needed ZERO edits. Recorded explicitly because 'no change needed' is this plan's most informative possible result: it is the evidence that the contract is not CLI-shaped, which is D-09's entire stated purpose."
  - "This leg ABSORBS shared step 3 (download into the vault). The result URL is only known after the poll completes and `downloadResult` already has to stream those bytes; a second `curl` would be a redundant round trip over the same CDN object. The adjustment is in the SKILL, not the contract, and the SKILL's 'Backend legs' preamble was corrected in the same pass because its 'steps 1/3/4/5 are shared' claim went stale the moment this leg landed."
  - "Cost is stated as a PUBLISHED RATE, not a per-call quote. fal's models API carries no pricing field at all — every metadata key was enumerated. There is no equivalent of Higgsfield's `generate cost`, so unlike the higgsfield leg the figure could not be confirmed against the provider before spending."

requirements-completed: [D-09, D-11, D-12]

duration: ~70min
completed: 2026-08-15
---

# Phase 118 Plan 13: D-09's fal.ai Direct-API Leg Summary

**D-09's second backend is proven end to end for $0.003: one `fal-ai/flux/schnell` generation landed
in the vault with its sidecar, ingested ~44 seconds later, and renders at `/studio` in a three-card
grid carrying exactly ONE "No provenance recorded" badge — beside a from-scratch queue/poll client
whose bounds are each mutation-proven, and one honest recipe card. The finding that matters: the
sidecar contract needed ZERO edits to accept a non-CLI generator.**

## Performance

- **Duration:** ~70 min · **Tasks:** 3/3 · **Commits:** 2 (+ this metadata commit)
- **Spent:** $0.003 — one 1024x1024 image at fal's $0.003/megapixel published rate

## Task Commits

1. **Task 1 — the from-scratch queue/poll client + 35 tests** — `feat(118-13)`
2. **Task 2 — the fal leg wired into `/studio-generate`** — host-side only, nothing repo-tracked to commit
3. **Task 3 — D-09 fal leg evidence + the second recipe card** — `docs(118-13)`

`git show --stat HEAD` was read after every commit. Each landed exactly the files it names; the
evidence commit's single deletion is the leg's own status-table row flipping from `not yet run` to
`PROVEN`, and nothing from a concurrent session was swept in.

## The API contract, read from the provider

Source: <https://fal.ai/docs/documentation/model-apis/inference/queue>, fetched 2026-08-15.
**Context7 MCP was NOT available in this session** — its tools are not in the loaded MCP surface — so
a documentation fetch was used instead, and that substitution is stated rather than left implicit.

Two things the house habit gets wrong, both quoted into the module header so the next reader does
not have to re-derive them:

- **`Authorization: Key <token>`, not `Bearer`.** Confirmed live at HTTP 200 against fal's models
  endpoint. A `Bearer` header here returns a 401 that reads exactly like a bad key.
- **Submit hands back `request_id`, `response_url`, `status_url`, `cancel_url`, `queue_position`,
  and those URLs are used as given** rather than rebuilt from a template. Reconstructing a URL is how
  a version drift becomes a confident 404 against a job that is running fine.

Input schema transcribed from fal's own OpenAPI expansion (`expand=openapi-3.0`, schema
`FluxSchnellInput`): `prompt` is the only required field; `image_size` defaults to `landscape_4_3`
and its enum includes `square_hd`; `output_format` defaults to `jpeg`.

## The donor is a stub, confirmed by reading it

`veo.ts:73` and `:107` each throw an unimplemented-marker `Error`, and `_pollFalQueue` at `:128` is a
stub whose queue/poll cycle survives only as commented-out intent. Nothing was ported. Only the
`withRetry` shape (`{maxAttempts, baseDelayMs, backoffFactor}`) and the `FAL_KEY` naming were reused.

A test greps `hooks/studioFal.mjs` for both markers and requires zero hits, **with `veo.ts` as the
control proving the same patterns do find them where they exist**. The control runs FIRST in the
test body — a zero from a pattern never shown to match anything is a claim about the pattern.

That assertion is why the module header paraphrases the markers instead of quoting them, and the
header says so in as many words, so a future reader does not read the paraphrase as evasion.

## Mutation proofs

Every load-bearing bound. Each broken → confirmed RED → restored, with the restore proven by the
file's SHA-256 (`f6ae838a2ed10754…`, full digest compared in-session) matching before and after every
single one. The digest is abbreviated here on purpose: a full 64-character hex string trips
`detectCredentialValue`'s rule C, which would put a permanent known-benign hit in this file's own
disclosure scan for no gain.

| # | mutation | RED evidence |
|---|---|---|
| M1 | remove the poll attempt bound (unbounded loop) | 2 red — `POLL_TIMEOUT` never returned; the budget caught it instead, which is what proves the attempt bound was producing it |
| M2 | off-by-one: `attempt >= maxAttempts - 1` | 3 red, incl. the **control**: `expected { ok: false } to match object { ok: true, status: 'COMPLETED' }` |
| M3 | `isTransient` always returns true | 2 red — `expected "vi.fn()" to be called 1 times, but got 3 times`, i.e. a 401 retried three times |
| M4 | drop the trailing separator from the `gen\` path check | 1 red — the `gen-evil\` prefix collision passed the guard |

**M2 is the one that matters most.** It is the control half of the poll-bound pair, and it is the
only thing that catches a bound which gives up one attempt early — a defect a timeout-only test
passes happily.

**M4 is the one I would not have thought to write without stating the threat.** `startsWith(genDir)`
without the separator lets `…\gen-evil\a.png` through, and the failure surfaces far downstream as
`Cannot read properties of undefined` rather than as a refusal.

## Verification

- `npx vitest run hooks/__tests__/studioFal.test.mjs` — **35 passed**, all injecting `fetchImpl`;
  no network, and nothing points at the real `media-vault`.
- Full `npx vitest run` — **4566 → 4601 passed | 0 failed | 197 todo** (331 files passed, 17 skipped,
  348 total). The +35 delta is exactly this plan's tests; zero regressions.
- `npx tsc --noEmit` — exit 0 after every task and every mutation restore.
- `hooks/studioFal.mjs` has no shebang and every `import` specifier is `node:`-prefixed, asserted by
  test rather than by eye.

## D-09: the fal leg, PROVEN

Full log: `118-D09-EVIDENCE.md` § `## LEG: fal`. Headline facts:

- **Model `fal-ai/flux/schnell`**, read off fal's own listing — **15 pages, 1,450 endpoints** walked
  and matched client-side. **Control:** `fal-ai/definitely-not-a-real-model-9x7q2` is **NOT FOUND**
  across the same 1,450, so a PRESENT verdict carries information.
- **Ingest dated by a pre-sync read.** `media:list` returned **2 rows at 17:59:55 UTC** with the fal
  asset absent; the cycle at 18:00:03 reported `scanned=3 rehashed=1 ingested=1 duplicates=2
  refused=0`, exit 0. That empty-of-this-row read is what dates the ingest to this sync rather than
  to an earlier unattended `StudioWatch` fire.
- **Thumbnail measured, not read from a field:** the blob was fetched over HTTP and its bytes
  counted — **16,196 bytes**, `image/webp`, under the 204,800-byte D-02 cap. The 998,230-byte
  original never entered Convex.
- Rendered at `/studio` (auth-disabled server, port 5181, stopped afterwards — `:5181` now returns
  **000** while `:5173` still returns **200**): **3 cards, exactly 1 `No provenance recorded`
  badge**, **0 console errors**. Chips agree: `All 3`, `Image 3`, `Missing Provenance 1`,
  `STYLES (0)`, `MODELS (2)`.

### The shape difference — this leg's actual purpose

Stated concretely rather than asserted, because "two backends work" is not what D-09 asks for:
transport is `fetch` vs a spawned subprocess; **this client owns the poll loop** where the CLI's
`--wait` does its own waiting; completion is HTTP status parsing across N `status_url` GETs vs a
process exit plus a terminal status in JSON stdout; failure handling is an explicit bounded retry
with a transient/non-transient split vs whatever the CLI's exit code says; auth is an env var and a
`Key` header vs an OAuth PKCE session in a local file with **no env var at all**; and params are a
JSON request body vs command-line flags.

### Did the contract need to change? NO — and that is the finding

`docs/studio-sidecar-contract.md` took **zero** edits. Every field this leg emits already existed
with the right wire type, §9 already named fal.ai and `FAL_KEY` as the one leg needing a provider
variable, and the `params`-must-be-a-JSON-string rule turned out to be **backend-independent** rather
than an artifact of parsing CLI output. **The contract is not CLI-shaped**, and this is the evidence
rather than the assertion.

## D-12: exactly two cards, both for models actually run

```
npx convex run internal.media.upsertModelCard '<json>' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

`FLAGS USED: ["--env-file"]` · `--push present? false` · `--prod present? false` — printed at
invocation, so the claim is checkable rather than asserted.

```
1st run -> { "created": true,  "modelId": "pd7rdwwgcg9pj1hbhp2et17g1h8cgcky", "ok": true }
2nd run -> { "created": false, "modelId": "pd7rdwwgcg9pj1hbhp2et17g1h8cgcky", "ok": true }
```

`TOTAL 2` — `z_image | higgsfield | 2,208 chars` and `fal-ai/flux/schnell | fal | 3,328 chars`. Zero
cards for unrun models (T-118-38); `docsUrl` deliberately absent on both rather than a guessed URL.

The card was **not pre-screened** against a local re-implementation of `detectCredentialValue` — the
deployed guard accepting it IS the verdict, since a local copy of the regexes could diverge and green
a card the real guard would refuse. Both stored cards were then pulled back **out of Convex** and
scanned: **CLEAN**, three known-positive controls tripping first. `FAL_KEY` appears as a bare NAME.

## D-11: the eight media skills, provably untouched

Same substituted criterion as plan 12, for the same reason — the plan repeated the blind
`git status --porcelain` check. The manifest tool was **self-tested first** (a one-byte change moves
the digest; restoring returns the original digest), then run before and after every write this plan
made. `diff` of the two manifests is **empty**: all eight identical, file counts
10/1/1/3/2/57/349/23, matching plan 12's table exactly.

## Disclosure scan (run LAST, after every write)

Three known-positive controls trip first; a clean result is meaningless without them.

| artifact | result |
|---|---|
| `hooks/studioFal.mjs` | **CLEAN** |
| `hooks/__tests__/studioFal.test.mjs` | **CLEAN** |
| `~/.claude/skills/studio-generate/SKILL.md` | **CLEAN** |
| the stored `z_image` `recipeMd` (pulled from Convex) | **CLEAN** |
| the stored `fal-ai/flux/schnell` `recipeMd` (pulled from Convex) | **CLEAN** |
| `118-D09-EVIDENCE.md` | 1 hit (`:234`) |
| `118-13-SUMMARY.md` (this file) | **CLEAN** |

**One finding, and it is the same one plan 12 already classified** — the plan-12 control file's
47-character timestamped name tripping rule C, at the same line as before. This plan's ~200 new lines
added **zero** new hits: the fal asset's basename is 33 characters, deliberately under the
40-character threshold, and the new section describes rather than quotes anything key-shaped.

The test file's `FAKE_KEY` is keyboard-mashed, was never a real credential, and is short enough that
no rule fires on it.

## Deviations from Plan

**1. [Rule 1 — Defective criterion, second occurrence] Task 2's `git status --porcelain` check**
- Identical to plan 12's finding and replaced the same way. Flagged again here because the plan text
  still carried it: the criterion was authored before 118-12 measured it, and nothing propagated the
  correction back into 118-13's and 118-14's plan files.
- **Carry-forward:** `118-14-PLAN.md` should be assumed to carry the same blind criterion. Check
  before executing it rather than transcribing.

**2. [Scope] Task 2 produced no repo-tracked change**
- `~/.claude/skills/studio-generate/SKILL.md` is host-side and gitignored, and the contract needed no
  edit, so Task 2 has no commit of its own. Stated rather than left as a silent gap in the commit
  list.

**3. [Rule 1 — Stale doc] the SKILL's "Backend legs" preamble**
- It asserted that steps 1, 3, 4 and 5 are shared by every leg. True when written; false the moment
  this leg absorbed step 3. Corrected in the same pass rather than left for a reader to trip over.

No Rule 4 architectural checkpoint was raised.

## Known Stubs

None. The OpenArt leg in the skill remains labelled "Not yet built" with its owning plan number,
which is the honest state of `118-14`, not placeholder data. No card exists for it.

## Threat Flags

None new. T-118-04 is addressed at four layers (no default at any tier, exit 2 before any request is
constructed, no key in any error path — asserted against a captured message and stack — and no key
sent to the CDN host). T-118-41 (financial DoS) has two independent bounds, both mutation-proven.
T-118-42 (retrying a 401) is asserted with both call counts in one test. T-118-06 (path traversal)
refuses with zero filesystem writes, mutation-proven. T-118-22 (buffering a large result) is
asserted by proving `arrayBuffer` and `text` are never called on the asset response. T-118-43
(shipping a stub) has its `veo.ts` control. T-118-10's `--push`/`--prod` prohibition was enforced and
audited at invocation. T-118-38 is closed by the two-row cross-check.

## Issues Encountered

- **`npx convex run <fn> "$(cat card.json)"` silently truncated a pretty-printed JSON file to `{`**,
  producing `SyntaxError: JSON5: invalid end of input at 1:2`. The `npx` `.cmd` shim mangles a
  multi-line argument on Windows. Minifying the JSON to a single line fixed it. Worth knowing for
  `118-14`, which seeds a third card the same way.
- Command substitution was control-verified before use, because the card's `recipeMd` contains
  backticks and dollar-parens: a file containing those literals arrived at `argv` **unexecuted**.
- A bash heredoc carrying the evidence section failed with `unexpected EOF while looking for
  matching '` — mixed quoting. Written with the Write tool and appended by a short node script
  instead, per the standing rule to prefer Write over shell heredocs for multi-line content.
- `TaskStop` on the backgrounded dev server did **not** kill Vite: the command was piped through
  `tail`, so stopping the task left the server listening. `:5181` still returned 200 afterwards and
  the process had to be found by port and stopped explicitly. Verified down (`000`) with `:5173`
  at `200` as the control that the real server was unaffected.
- Bash mangled `--env-file C:\Users\...` into `C:Usersmandr...`; forward slashes fixed it, per the
  standing Windows-path rule.

## User Setup Required

None outstanding. `FAL_KEY` was added by Larry to `C:\Users\mandr\.claude\skills\studio\.env` during
this plan and was verified present by a boolean probe through the real resolver, with a bogus
variable as the control. The value was never read, printed, or requested.

## Next Phase Readiness

- **`118-14` (OpenArt MCP) is the third and last leg.** It must re-read the OpenArt balance via
  `openart_account_get` and refuse honestly if it is below the quoted cost — 7 credits against a
  10-credit floor at last measurement.
- Assume `118-14-PLAN.md` carries the same blind `git status --porcelain` criterion; the manifest
  script is in this session's scratchpad and is self-testing.
- **`118-15`'s `e2e/studio.spec.ts` now has three rows** to assert against — two with complete
  provenance from two different providers, one without — plus two `mediaModels` cards. The
  onboarding-modal dismissal (`Escape` before the grid is clickable) is still required.
- The vault holds three media files and two sidecars. Any test assuming an empty vault or
  `scanned=0` is wrong.

## Self-Check: PASSED

- FOUND: `hooks/studioFal.mjs` (575 lines, no shebang, `node:` imports only)
- FOUND: `hooks/__tests__/studioFal.test.mjs` (35 tests, all green)
- FOUND: `118-D09-EVIDENCE.md` § `## LEG: fal`, and the leg's status-table row reads **PROVEN**
- FOUND: `C:\Users\mandr\media-vault\gen\studio_falflux_a1_20260815T175919.png` + its `.json`
- FOUND: `mediaModels` TOTAL 2, including `fal-ai/flux/schnell`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — **NOT** touched by this plan

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-15*
