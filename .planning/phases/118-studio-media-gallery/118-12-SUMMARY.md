---
phase: 118-studio-media-gallery
plan: 12
subsystem: infra
tags: [convex, internal-mutation, higgsfield, cli, skills, provenance, secrets, playwright]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery (plan 06)
    provides: "convex/media.ts's handler/export split and the internalMutation rationale this plan's upsertModelCard extends"
  - phase: 118-studio-media-gallery (plan 07/08)
    provides: "hooks/studioWatch.mjs — readSidecar's shipped naming rule (transcribed, not assumed) and the full ingest cycle that proved this leg"
  - phase: 118-studio-media-gallery (plan 11)
    provides: "MediaDetailSheet's data-present field rows, which render this plan's D-07 field-level pair"
provides:
  - "docs/studio-sidecar-contract.md — the D-10 handoff document astridr SEED-028 implements against"
  - "convex/media.ts: upsertModelCard (internalMutation), upsertModelCardHandler, detectCredentialValue"
  - "~/.claude/skills/studio-generate/SKILL.md — the single sidecar-writing skill (D-11), host-side"
  - "118-D09-EVIDENCE.md with the ## LEG: higgsfield section — D-09's first leg PROVEN"
  - "one mediaModels recipe card, z_image, for the model actually run (D-12)"
affects: ["118-13 (fal.ai leg slots in as a sibling)", "118-14 (openart leg)", "118-15 (e2e)"]

tech-stack:
  added: []
  patterns:
    - "a secrets guard shipped with an ACCEPTANCE control, not only refusal cases — an over-aggressive guard is caught by the same test suite as an absent one"
    - "content-manifest untouched-ness proof for gitignored host directories, where git status is structurally blind"
    - "flag audit printed at invocation (FLAGS USED / --push present? false) so a no-dangerous-flag claim is checkable rather than asserted"

key-files:
  created:
    - docs/studio-sidecar-contract.md
    - .planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md
    - C:\Users\mandr\.claude\skills\studio-generate\SKILL.md (host-side, not repo-tracked)
  modified:
    - convex/media.ts
    - convex/media.test.ts
    - hooks/__tests__/studioWatch.test.mjs
    - C:\Users\mandr\media-vault\README.md (host-side, not repo-tracked)

key-decisions:
  - "The Higgsfield recipe card names NO provider credential variable, contradicting the dispatch's premise that HIGGSFIELD_API_KEY is this leg's key. Measured against the installed binary: the CLI authenticates by OAuth 2.0 PKCE into a local credentials file and contains no HIGGSFIELD_API_KEY and no *_API_KEY of any kind (controls HIGGSFIELD_API_URL and HIGGSFIELD_CREDENTIALS_PATH both present, so the search discriminates). Naming a variable the tool does not read would be a stale claim on the day it was written."
  - "The plan's Task 2 acceptance criterion — `git status --porcelain` shows zero modifications under the eight media skill directories — is structurally blind and was replaced, not transcribed. `~/.claude/.gitignore:72` ignores `skills/`; none of the eight is tracked; and modifying a file inside one leaves `git status` EMPTY (mutation-proven). Substituted a recursive SHA-256 content manifest, itself mutation-proven RED then restored."
  - "The eight skills are the 118-CONTEXT.md D-11 list, not the executor dispatch's list. The dispatch named `openart`, which does not exist as a skill directory; the real eighth is `cryptidvlog`. Enumerated from ~/.claude/skills rather than trusting either list."
  - "Deploy was NOT performed by this plan despite Task 1's action step calling for it — the executor dispatch forbids deploying. Handed to the orchestrator, who deployed at f46a4601 and reported the POSITIVE line `✔ No indexes are deleted by this push`. Verified deployed before use, control-paired (invalid args reach ArgumentValidationError; a bogus name returns Could not find function)."
  - "The card is not pre-screened locally against a re-implementation of detectCredentialValue. The deployed guard accepting the real card IS the acceptance verdict; a local copy of the regexes could diverge and green a card the real guard would refuse."

requirements-completed: [D-09, D-10, D-11, D-12]

duration: ~95min
completed: 2026-08-15
---

# Phase 118 Plan 12: Sidecar Contract, `/studio-generate`, and D-09's Higgsfield Leg Summary

**D-09's first backend is proven end to end for 0.15 real credits: one `z_image` generation landed in the vault with its sidecar, ingested within one watcher cycle, and renders beside a deliberately sidecar-less file whose "No provenance recorded" badge is the ONLY one in a two-card grid — plus the contract document astridr implements against, one wrapper skill owning sidecar writing, and exactly one recipe card whose secrets guard is proven to discriminate rather than refuse everything.**

## Performance

- **Duration:** ~95 min · **Tasks:** 3/3 · **Commits:** 4 (+ this metadata commit)
- **Credits spent:** 0.15 (3537.27 → 3537.12), exactly the approved quote

## Task Commits

1. **Task 1 — contract document + `upsertModelCard` write path** — `63e9f068` (feat)
2. **Task 2 — measured credential facts for the skill** — `4123882e` (docs)
3. **Rule 1 fix — watcher subprocess test isolation** — `f46a4601` (fix)
4. **Task 3 — D-09 higgsfield leg evidence** — (this commit's predecessor, below)

`git show --stat HEAD` was read after every commit. Every commit landed exactly the files it names,
`git diff --diff-filter=D` was empty after each (zero deletions), and nothing from the concurrent
session in this checkout was swept in.

## D-09: the Higgsfield leg, PROVEN

Full log: `118-D09-EVIDENCE.md` § `## LEG: higgsfield`. Headline facts:

- **Model `z_image`**, enumerated from `higgsfield model list --image --json` (30 models), never
  hand-constructed. Quoted 0.15 credits, **charged 0.15** — balance 3537.27 → 3537.12.
- **CLI contract verified against the installed binary's own `--help`**, control-paired twice: an
  unknown subcommand returns `Error: unknown command "…"`, and an unknown slug returns
  `Error: No model with job_type "…"`. Without those controls a `0.15 credits` quote would be
  indistinguishable from a permissive default.
- Asset + sidecar landed in `media-vault\gen\`; `/studio-sync` ingested **2 candidates, 2 ingested,
  0 refused** in 1 second, ~72 s after generation. A `media:list` read at 14:47:01 returned
  `rows: []`, which dates the ingest to this sync rather than to an earlier unattended fire.
- **Thumbnails measured, not read from a field:** 112,548 bytes (109.9 KB) and 266 bytes, both
  `image/webp`, both under the 204,800-byte D-02 cap. The 6,316,863-byte original never entered
  Convex.

### The control pair, in one grid view

| | generated | sidecar-less control |
|---|---|---|
| `hasProvenance` | **true** | **false** |
| prompt / model / provider / project / params / tags | all populated | all `<absent>` |

Rendered at `/studio` (auth-disabled server, port 5181): **2 cards, exactly 1
`No provenance recorded` badge**. One badge across two cards is the discriminating result — a broken
sidecar reader would produce two. The page's own chips agree: `All 2`, `Image 2`,
`Missing Provenance 1`, `STYLES (0)`, `MODELS (1)`. Detail sheet shows `data-present=true` on five
recipe fields and `data-present=false` on `style`, so the pair also holds at field level.

## D-12: exactly one card, for the model actually run

```
npx convex run internal.media.upsertModelCard '<json>' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

`FLAGS USED: ["--env-file"]` · `--push present? false` · `--prod present? false` — printed at
invocation, so the claim is checkable rather than asserted.

```
1st run -> { "created": true,  "modelId": "pd7sq69qcenerpzfgbvc4vct0n8cg3qc", "ok": true }
2nd run -> { "created": false, "modelId": "pd7sq69qcenerpzfgbvc4vct0n8cg3qc", "ok": true }
```

The second run is the **live** idempotency control: same `modelId`, `created:false` — patched, not a
second row.

**Every `mediaModels` row, cross-checked:** TOTAL 1 — `z_image | Z Image | image | higgsfield |
enabled=true | aspect=1:1 | resolution=1024x1024 | docsUrl=<absent> | recipeMd=2208 chars`. Zero
cards for models nobody has run. `docsUrl` is deliberately absent rather than a guessed URL.

The stored card was pulled back out of Convex and scanned (not scanned from local source): **0
findings**, with three known-positive controls tripping first. Uppercase identifiers present:
`HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_URL`, `HIGGSFIELD_CREDENTIALS_PATH`, `MEDIA_VAULT_ROOT` — every
one a bare name, and `HIGGSFIELD_API_KEY` appears only in the sentence saying the CLI does not read it.

## D-11: the eight existing media skills, provably untouched

The plan's criterion for this was **defective**, and was replaced rather than transcribed.

`~/.claude/.gitignore:72` is `skills/`. Of the eight directories, `git ls-files` reports **0 tracked
files each** (positive control: 13 files *are* tracked under `skills/`, and 1,147 repo-wide, so the
probe works). **Mutation proof of the blindness:** appending a byte to
`higgsfield-marketplace-cards/SKILL.md` left `git status --porcelain` **EMPTY**. The plan's green
would have meant nothing.

Substituted a recursive SHA-256 content manifest, itself mutation-proven (the same byte turned it
RED, restore returned it byte-identical). All eight identical before and after every write this plan
made:

| skill | files | manifest before == after |
|---|---|---|
| `higgsfield-generate` | 10 | ✔ |
| `higgsfield-marketplace-cards` | 1 | ✔ |
| `higgsfield-product-photoshoot` | 1 | ✔ |
| `higgsfield-soul-id` | 3 | ✔ |
| `digital-art-factory` | 2 | ✔ |
| `caught-on-camera` | 57 | ✔ |
| `cryptidvlog` | 349 | ✔ |
| `ugc-factory` | 23 | ✔ |

The list is `118-CONTEXT.md` D-11's, not the dispatch's: **there is no `openart` skill directory**
(enumerated from `~/.claude/skills`); the eighth is `cryptidvlog`.

## Mutation proofs (every load-bearing check)

Each broken → confirmed RED → restored → restore proven byte-identical with `diff`.

| # | mutation | RED evidence |
|---|---|---|
| A | `upsertModelCard = internalMutation(` → `mutation(` | `AssertionError: expected '…' to match /export const upsertModelCard = intern…/` |
| B | upsert's `if (existing)` → `if (false && existing)` | `AssertionError: expected { ok: true, …(2) } to deeply equal { ok: true, …(2) }` (patch test) |
| C1 | `detectCredentialValue` always returns `null` | **4** refusal tests red, incl. `promise resolved "{ ok: true, …(2) }" instead of rejecting` |
| C2 | `detectCredentialValue` always returns a rule | **5** red, incl. the acceptance control `expected 'OVER_AGGRESSIVE' to be null` |
| D | strip `studio-sync` from the skill file | `Error: skill missing topics: studio-sync` |
| E | disable `main()`'s `STUDIO_API_KEY` check | `expected +0 to be 2` on both the subprocess and in-process tests |
| F | append a byte inside one of the eight skills | manifest hash changed (and `git status` did **not** — that is finding #10) |
| G | strip `No provenance recorded` from the evidence file | `Error: D-07 control pair not evidenced in the leg section` |

C2 is the one that matters most: it is the acceptance case proving the secrets guard **discriminates**
rather than refusing everything. A guard tested only against refusals passes identically when it is
broken shut.

## Verification

- `npx vitest run convex/media.test.ts` — **35 → 46** tests (+11), all green. (+10 for the plan's
  own coverage, +1 for the known-false-positive test added by the disclosure-scan follow-through
  below; the intermediate 45-test figure recorded before that last test is superseded here.)
- Full `npx vitest run` — **4555 → 4566 passed | 0 failed | 197 todo** (330 files passed, 17
  skipped, 347 total). The +11 delta is exactly this plan's new tests; zero regressions.
- `npx tsc --noEmit` — exit 0 after every task and every mutation restore.
- `npx convex run` reader control-paired before any conclusion was drawn from it: a bogus function
  name errors `Could not find function`, and `agents:listAll` returns **200 rows** through the same
  path — so `media:listModels` returning `[]` beforehand was a genuinely empty table, not a broken
  probe.

## Disclosure scan (run LAST, after every write)

Three known-positive controls trip first; a clean result is meaningless without them.

| artifact | result |
|---|---|
| `~/.claude/skills/studio-generate/SKILL.md` | **CLEAN** |
| `docs/studio-sidecar-contract.md` | **CLEAN** |
| the stored `mediaModels.recipeMd` (pulled from Convex) | **CLEAN** |
| `C:\Users\mandr\media-vault\README.md` | **CLEAN** |
| `hooks/__tests__/studioWatch.test.mjs` | **CLEAN** |
| `118-12-SUMMARY.md` (this file) | **CLEAN** |
| `convex/media.ts` | 2 hits (`:819`, `:830`) |
| `convex/media.test.ts` | 6 hits (`:979`, `:988`, `:989`, `:995`, `:1011`, `:1052`) |
| `118-D09-EVIDENCE.md` | 1 hit (`:234`) |

**9 findings, every one opened and classified individually — zero real credentials.**

- **6 are synthetic guard fixtures** (`media.ts:819`, `media.test.ts:979/988/989/995/1052`). A
  detector cannot be tested without value-shaped input. Every one is keyboard-mashed and was never a
  real credential — not copied from any dotenv file, any provider account, or any live system. The
  test block carries a comment saying so, so a scanner alert resolves in one glance.
- **3 are the same control FILENAME** (`media.ts:830`, `media.test.ts:1011`, `EVIDENCE:234`) — the
  sidecar-less control file's name is 47 characters of key alphabet mixing case (via the `T` date
  separator) and digits, so it trips rule C. Documenting a false positive necessarily reproduces the
  string that causes it, which is why it appears three times. This file describes the filename
  rather than quoting it, which is why this file scans clean.

**The filename hit is why this scan runs last, and why the count is stated from output rather than
predicted.** I predicted the total twice and was wrong both times: the evidence file's hit appeared
only after that file existed, documenting it added two more, and rewriting this section to stop
quoting the literal removed one again. Every number above is read off the final run, not reasoned
to. Rather than note the false positive and move on, it is now recorded in
`detectCredentialValue`'s own doc
comment (with the remedy: shorten or line-break the filename) and pinned by a test carrying a
shorter-filename control, proving it is a length threshold rather than a blanket refusal of anything
file-like. The threshold is deliberately **not** relaxed — a false refusal is recoverable, a
published key is not. The card actually seeded into Convex scans **clean**, as do the skill file and
the contract document. No `.env` file was read, printed, or echoed at any point.

## Deviations from Plan

**1. [Blocked by dispatch] Task 1's deploy step was NOT performed by this plan**
- Task 1's action ends with `npx convex deploy --env-file …`. The executor dispatch forbids
  deploying outright. Reported at the checkpoint instead; the orchestrator deployed from a verified
  clean tree at `f46a4601` and reported `✔ No indexes are deleted by this push` — a positive line,
  not the mere absence of a deletion line.
- Verified deployed before use, control-paired: `internal.media.upsertModelCard '{}'` reaches
  `ArgumentValidationError: Object is missing the required field 'enabled'` and echoes back the exact
  validator shape, while `internal.media.definitelyNotDeployed9x7q2` returns `Could not find function`.

**2. [Rule 1 — Bug] `hooks/__tests__/studioWatch.test.mjs`'s exit-2 test went red on host state**
- **Found during:** the full-suite run at the end of Task 2 (1 failed | 4564 passed).
- **Issue:** `resolveConfig`'s tier 2 reads a skill-local dotenv under `os.homedir()`, and the
  subprocess inherited the operator's real home. `118-07-SUMMARY.md` recorded the dependency in
  writing — "confirmed absent on this machine today" — and that file was created on 2026-08-15, so
  the test began measuring host state instead of `main()`'s enforcement point. Not caused by this
  plan: `git diff --stat hooks/studioWatch.mjs` is empty and neither commit before it touched `hooks/`.
- **Fix:** both subprocess tests now point `HOME`/`USERPROFILE` at an empty temp directory
  (`os.homedir()` honours `USERPROFILE` — measured directly, with the inherited value as the
  control), so the exit-2 case and its exit-0 control differ in exactly one variable.
- **Commit:** `f46a4601`. Non-vacuity mutation-proven (row E above).

**3. [Rule 1 — Stale doc] `media-vault\README.md` documented two behaviours the code does not have**
- It told generators that `params` may be an object because "the watcher serialises it to JSON text",
  and listed `refs` as a sidecar field. Neither holds: `sanitizeSidecar` keeps `params` only when it
  is already a `string` and has no `refs` in its allowlist, and the watcher forwards the sidecar
  verbatim. A generator following the README would have silently lost both fields.
- Corrected in the README and stated explicitly in `docs/studio-sidecar-contract.md` §3. The
  `/studio-generate` skill writes `params` stringified, which is why this plan's own sidecar ingested
  intact — the defect was found by reading the writer, not by losing data.
- Host-side file; not committed. `convex/schema.ts:2472`'s comment carries the same stale claim and
  is left alone as a one-line comment on a correctly-typed field (flagged here, not silently fixed).

**4. [Scope] `hooks/__tests__/studioWatch.test.mjs` is not in the plan's `files_modified`**
- Required by deviation 2. Test-only; `hooks/studioWatch.mjs` itself is byte-identical to HEAD.

No Rule 4 architectural checkpoint was raised. One authentication gate was hit and handled: `/studio`
on :5173 shows a Clerk sign-in wall, so the render evidence was captured on the documented
`dev:noauth` server (`VITE_CLERK_PUBLISHABLE_KEY=` from Git Bash, port 5181, `--host 127.0.0.1`),
which was stopped afterwards — port 5181 now returns `000` while :5173 still returns `200`.

## Known Stubs

None. The `fal.ai` and `OpenArt` sections in the skill are labelled "Not yet built" with their owning
plan numbers, which is the honest state of legs `118-13`/`118-14`, not placeholder data. No card
exists for either.

## Threat Flags

None new. `upsertModelCard` is an `internalMutation` (T-118-02, asserted by test), the secrets
backstop addresses T-118-04 at three layers, the `--push`/`--prod` prohibition (T-118-10) was
enforced and audited at invocation, T-118-38's "card for an unrun model" is closed by the
one-row cross-check, and T-118-39's hand-constructed-identifier risk was closed by reading the slug
list off the CLI and control-pairing every quote.

## Issues Encountered

- `execFileSync("npx"/"npx.cmd", …)` fails on Windows (`ENOENT`, then `EINVAL` — Node ≥18 refuses to
  spawn a `.cmd` shim without `shell: true`), and `shell: true` would re-expand the backticks inside
  `recipeMd`. Resolved by emitting the JSON to a file and invoking the real
  `npx convex run … "$(cat file)"` from bash, after **control-verifying** that bash does not
  re-evaluate the result of a command substitution (a file containing literal backticks and `$()`
  arrived at `argv` unexecuted).
- A mutation-test command was blocked by the env-file-guard hook because my own inline comment text
  contained a dotenv filename; the command touched no such file. Performed the edit with the Edit
  tool rather than reshaping the shell command to evade the guard.
- Playwright resolves from the repo's `node_modules`, not the scratchpad — imported by absolute
  `file://` URL rather than copying a script into the repo.
- A "Welcome to CodePulse" onboarding modal (`div.fixed.inset-0.z-50`) intercepts pointer events on
  first load and had to be dismissed with Escape before the grid was clickable. Worth knowing for
  `118-15`'s `e2e/studio.spec.ts`.

## User Setup Required

None beyond what already exists. Note for Larry: the `HIGGSFIELD_API_KEY` line in the studio dotenv
file is **inert** — the Higgsfield CLI never reads it. It is harmless, but it is not what
authenticates this leg; `higgsfield auth login` is.

## Next Phase Readiness

- `118-13` (fal.ai) and `118-14` (OpenArt MCP) slot in as **sibling sections** under the skill's
  "Backend legs" heading. Steps 1, 3, 4 and 5 of the flow are shared and need no rewrite.
- `118-14` must still re-read the OpenArt balance via `openart_account_get` and refuse honestly if it
  is below the quoted cost — 7 credits against a 10-credit floor at last measurement.
- `118-15`'s `e2e/studio.spec.ts` now has real data to assert against: two rows, one with complete
  provenance and one without, plus one `mediaModels` card. It will need the onboarding-modal dismissal
  noted above.
- The vault is no longer empty. Any future test that assumes `scanned=0` is now wrong.

## Self-Check: PASSED

- FOUND: `docs/studio-sidecar-contract.md`
- FOUND: `.planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md`
- FOUND: `C:\Users\mandr\.claude\skills\studio-generate\SKILL.md`
- FOUND: `C:\Users\mandr\media-vault\gen\studio_lighthouse_a1_20260815T144604.png` + its `.json`
- FOUND: `C:\Users\mandr\media-vault\gen\studio_control-no-sidecar_a1_20260815T144553.png` (no sidecar, by design)
- FOUND: `grep -c "upsertModelCard = internalMutation" convex/media.ts` → 1
- FOUND commits `63e9f068`, `4123882e`, `f46a4601` in `git log --oneline --all`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — **NOT** touched by this plan (verified with a
  control proving the same probe does list the four files that were touched)

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-15*
