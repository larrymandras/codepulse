---
phase: 118-studio-media-gallery
plan: 07
subsystem: infra
tags: [node, crypto, sha256, watcher, media-vault, hooks]

requires:
  - phase: 118-01
    provides: "D-01 resolved to BRANCH: convex-storage — the watcher uses Convex's verbatim URL, 127.0.0.1:3211 kept only as a defensive fallback"
provides:
  - "media-vault/{gen,refs,styles,trash} on disk, empty, plus README.md documenting the sidecar naming contract (D-13)"
  - "hooks/studioWatch.mjs: resolveConfig, classifyFile, hashFile, readSidecar, loadCache/saveCache, scanVault, main — the watcher's scan-only core"
  - "hooks/__tests__/studioWatch.test.mjs: 15 control-paired tests covering D-05/D-06/D-07 with 2 mutation-proven RED cases"
affects: [118-08-scheduled-tasks, 118-12-studio-generate-skill, 118-14-openart-leg]

tech-stack:
  added: []
  patterns:
    - "exported pure functions + thin main(), deps-injected fs/clock access (matches hooks/scanner.mjs's convention)"
    - "content-only SHA-256 identity, mtime as a re-hash gate never the key (hooks/idempotency.mjs's governing rule applied to file bytes for the first time in this repo)"

key-files:
  created:
    - hooks/studioWatch.mjs
    - hooks/__tests__/studioWatch.test.mjs
    - C:\Users\mandr\media-vault\README.md (host-side, not repo-tracked)
  modified: []

key-decisions:
  - "Skill-local env file for STUDIO_API_KEY resolved to <homedir>/.claude/skills/studio/.env (not previously pinned by CONTEXT.md/RESEARCH.md) — chosen to match loom-emit.mjs's <skill-name>/.env convention; confirmed absent on this machine today, so the exit-2 default-path subprocess test does not depend on real host state."
  - "Corrected the plan's Test #8 wording (no-filename-inference): asserted the substring check against every candidate field EXCEPT filename/absPath/relPath, since those three structural fields legitimately and necessarily contain the source filename text — asserting the whole object never contains it would fail against a correct implementation."
  - "Corrected the plan's Task 1 automated verify one-liner: the literal shell command in 118-07-PLAN.md mis-escapes Windows backslashes when run through the Bash tool (a false 'missing dir' negative on a path that existed) — ran the equivalent check from a .mjs file instead and it passed. Documented under Deviations."

patterns-established:
  - "Mutation-test-then-revert workflow for a .mjs hooks module: break one rule at a time, run vitest, quote the RED failure text, revert, confirm `git diff` on the module is empty before moving on."

requirements-completed: [D-05, D-06, D-07, D-13]

duration: ~35min
completed: 2026-08-14
---

# Phase 118 Plan 07: Media Vault + Watcher Scan Core Summary

**Created the empty greenfield media-vault directory tree and hooks/studioWatch.mjs's scan-only core — SHA-256 content identity, sidecar tri-state pairing, and an mtime-gated re-hash cache — proven by 15 control-paired tests including two mutation-tested RED cases.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 2 repo files created (`hooks/studioWatch.mjs`, `hooks/__tests__/studioWatch.test.mjs`); 1 host-side file created outside the repo (`media-vault/README.md`)

## Accomplishments

- Created `C:\Users\mandr\media-vault\{gen,refs,styles,trash}` — all four directories exist and
  each contains exactly zero entries, verified by the plan's own check (run from a `.mjs` file
  to avoid a shell-escaping false negative, see Deviations). No `.thumbs` directory, matching
  D-01's `convex-storage` branch resolution (118-01-SUMMARY.md) — the `local-static-origin`
  fallback that would have needed it was never taken. Nothing was copied from
  `G:\My Drive\Agent images` or any other pre-existing media location — the directories were
  created empty by `mkdir` alone, no copy step ran.
- Wrote `media-vault\README.md`, the operator-facing sidecar naming contract:
  - **Primary form:** the media file's full path plus `.json` — `gen\sunset_v3.png` ->
    `gen\sunset_v3.png.json`.
  - **Accepted fallback** for hand-placed files: same directory, stem plus `.json` —
    `gen\sunset_v3.json`. The primary form wins when both exist.
  - **Sidecar body** (every field optional — an empty object and an absent file are the same
    state): `{ prompt, model, provider, style, project, params, refs, tags }`.
- Wrote `hooks/studioWatch.mjs` (357 lines): `resolveConfig`, `classifyFile`, `hashFile`,
  `readSidecar`, `loadCache`/`saveCache`, `scanVault`, and a scan-only `main()`. No shebang, only
  `node:` imports (`fs`, `path`, `crypto`, `os`), matching the `hooks/*.mjs` house convention.
- **Extension allowlist quoted verbatim** (never a denylist, T-118-06/T-118-24):
  ```js
  const EXTENSION_ALLOWLIST = {
    image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
    video: [".mp4", ".mov", ".webm", ".mkv"],
    audio: [".mp3", ".wav", ".m4a", ".flac"],
  };
  ```
  `.json` and `README.md` both classify as `null` (verified in test #10 and #10b).
- **`hashFile` streams** via `createReadStream` + incremental `hash.update(chunk)` on `"data"`
  events, resolving on `"end"` — confirmed it never calls `readFileSync` on media bytes
  (`grep -c readFileSync hooks/studioWatch.mjs` only matches the sidecar/cache JSON reads,
  never inside `hashFile`).
- **`readSidecar` has no `throw` on any path** — every branch (`try`/`catch` around
  `JSON.parse`, the non-object/array check, the absent-file case) returns a value; verified by
  reading all four exit points and by the mutation test (below) that removing the `try`/`catch`
  is exactly what turns a currently-swallowed parse failure into a real crash.
- **`resolveConfig` has no default for `STUDIO_API_KEY`** at any of its three resolution tiers
  (env, skill `.env` file, hardcoded default) — the hardcoded-default tier exists only for
  `CODEPULSE_URL`, matching `loom-emit.mjs`'s rule that a credential never gets a default.
  `main()` is the single enforcement point: it checks presence after resolution and exits 2.
- `grep -c "3210" hooks/studioWatch.mjs` returns **0** — the module never writes the plain
  backend-API port digits, even inside its own comment explaining the HTTP-actions-port choice
  (worded around the digits deliberately so this exact check stays meaningful).
- The mtime cache's doc-comment states explicitly: "THIS IS A PERFORMANCE CACHE, NOT A SOURCE OF
  IDENTITY... Deleting this file must change nothing about scanVault's output except runtime."
- Wrote `hooks/__tests__/studioWatch.test.mjs` (317 lines, 15 tests, all fixtures under
  `os.tmpdir()`) covering every required block: D-05 content identity + rename stability, D-06
  warm/cold rescan + mtime-change re-hash, D-07 absent/present + malformed (both invalid-JSON and
  JSON-array) + no-filename-inference, sidecar precedence, classification (unit-level and
  end-to-end via `scanVault`), and `resolveConfig`/`main()`'s STUDIO_API_KEY no-default behavior
  (including a subprocess-level exit-2-vs-exit-0 control pair).

## Mutation-test proof (both reverted, `git diff hooks/studioWatch.mjs` empty afterward)

**Mutation 1 — `hashFile` including `mtimeMs` in the hash (D-05 violation):**
```
AssertionError: expected 'aafc9fa9c276744a9b45eb76f2f19e0895dc9…' to be '35fcd9de7b0a9258fbe75a418aaa40c25e5f1…'
 ❯ hooks/__tests__/studioWatch.test.mjs:68:16   (test #1)
AssertionError: expected '504df8598958b80e36f1f14f0030c578d81da…' to be 'da3cd4155560f9470f89ef764b671f1c880b5…'
 ❯ hooks/__tests__/studioWatch.test.mjs:154:46  (test #5)
```
2 of 15 tests went RED (tests #1 and #5 — the two that directly assert hash stability across
mtime changes); the other 13 stayed green, which is itself evidence the mutation was narrowly
scoped to the D-05 property and not a wholesale breakage.

**Mutation 2 — `readSidecar` throwing (removed the `try`/`catch`) on malformed JSON (D-07 violation):**
```
SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
 ❯ readSidecar hooks/studioWatch.mjs:188:25
 ❯ scanVault hooks/studioWatch.mjs:300:42
 ❯ hooks/__tests__/studioWatch.test.mjs:186:28  (test #7)
```
1 of 15 tests went RED (test #7 — the malformed-sidecar candidate-count assertion); the crash
inside `scanVault` propagated up and failed the whole `await scanVault(...)` call for that test,
exactly the "file vanishes from a directory you are looking at" failure mode D-07 exists to
prevent.

Both mutations were reverted with `Edit`; `git diff hooks/studioWatch.mjs` printed nothing after
each revert, confirmed before moving on.

## Task Commits

Task 1 created host-side directories only (`C:\Users\mandr\media-vault\...`, outside this repo's
working tree) — nothing to commit to `codepulse`. Tasks 2 and 3 each landed one repo commit:

1. **Task 1: Create the media vault, empty (D-13)** — no repo commit (host filesystem only)
2. **Task 2: hooks/studioWatch.mjs — scan, content hash, sidecar pairing, mtime-gated cache** — `535f4966` (feat)
3. **Task 3: hooks/__tests__/studioWatch.test.mjs — control-paired scan tests** — `1d48017f` (test)

Each commit was verified post-commit with `git show --stat HEAD`; both landed exactly one file
each, no sweep from the concurrent session active in this checkout today.

## Files Created/Modified

- `hooks/studioWatch.mjs` — the watcher's scan core (357 lines)
- `hooks/__tests__/studioWatch.test.mjs` — 15 control-paired tests (317 lines)
- `C:\Users\mandr\media-vault\{gen,refs,styles,trash}\` — empty vault directories (host-side, not
  repo-tracked)
- `C:\Users\mandr\media-vault\README.md` — sidecar naming contract, operator documentation
  (host-side, not repo-tracked)

## Decisions Made

- **`<homedir>/.claude/skills/studio/.env`** chosen as the tier-2 env-file path for
  `resolveConfig`, matching `loom-emit.mjs`'s `<skill-name>/.env` convention. Neither
  `118-CONTEXT.md` nor `118-RESEARCH.md` pins an exact skill directory name for this watcher; a
  later plan (118-12, the `/studio-generate` skill) may want to share this same file for its own
  credential needs, in which case this name should be treated as already locked rather than
  re-decided.
- **Test #8's assertion scope corrected** from "no field anywhere on the candidate" to "no field
  except the three structural path fields" — see Deviations below.
- **Task 1's automated verify command corrected** to run via a `.mjs` file rather than the
  plan's literal inline shell one-liner — see Deviations below.

## Deviations from Plan

**1. [Test-check correction, not a Rule 1-4 deviation] Test #8's literal wording would fail against a correct implementation.**
- **Found during:** Task 3 (writing the sidecar-absence test suite)
- **Issue:** The plan's Test #8 says to assert "no field anywhere on the candidate contains the
  substring `sunset`" for a fixture filename
  `a-photorealistic-sunset-over-mountains.png`. The candidate's own `filename`/`absPath`/
  `relPath` fields legitimately and necessarily contain that text — it's the file's actual name.
  A literal implementation of the check would fail against the CORRECT `scanVault` output for a
  reason unrelated to the property being tested (filename inference into provenance).
- **Fix:** Destructured `filename`/`absPath`/`relPath` out of the candidate before the substring
  check, so the assertion targets exactly the property D-07 cares about — no provenance-bearing
  field (`sidecar`, or any future inferred field) contains text pulled from the name.
- **Files modified:** `hooks/__tests__/studioWatch.test.mjs` (test #8, with an inline comment
  explaining the correction)
- **Verification:** Test passes against the real implementation; would fail if a future change
  added filename-based inference into `sidecar` or any sibling field.
- **Committed in:** `1d48017f` (Task 3 commit)

**2. [Test-check correction] Task 1's literal automated-verify shell command mis-escapes on this platform.**
- **Found during:** Task 1
- **Issue:** The plan's `<automated>` one-liner for Task 1 is a `node -e "..."` string with
  hand-escaped backslashes for the Windows default path. Run verbatim through the Bash tool, the
  backslash-escaping is mangled before Node ever sees it (`missing dir: C:Usersmandrmedia-vault\gen`),
  producing a false "missing directory" negative on a path that in fact existed — the exact
  recurring class this repo's own memory documents (hand-escaped backslashes silently matching/
  parsing nothing).
- **Fix:** Wrote the identical check logic to a `.mjs` scratch file (no shell backslash-escaping
  involved) and ran `node <file>`; it printed `vault created and empty`, confirming the real
  directory state.
- **Files modified:** none in the repo — this only affected how the check was *run*, not any
  committed artifact.
- **Verification:** Re-ran after Tasks 2/3 landed; the four directories remain empty (the plan
  never asks the watcher to write into them, and none of this plan's tests point at the real
  vault).
- **Committed in:** N/A (verification-only correction, no code change)

---

**Total deviations:** 2, both test/verification-check corrections per the plan's own
`<critical_plan_caveat>` instruction to mutation-test and correct defective checks rather than
transcribe them. Neither changed `hooks/studioWatch.mjs`'s actual behavior or scope.
**Impact on plan:** None on delivered functionality — both corrections make the verification
more accurate, not less strict.

## Issues Encountered

None beyond the two check corrections documented above. All 15 new tests passed on first
execution of the corrected suite; no debugging cycle was needed for the watcher module itself.

## Secrets / Disclosure Scan (repo is public)

Ran a fixed-string scan (`grep -F`, paired with a known-positive control that returned 2 hits in
`README.md`, proving the probe discriminates) for `mandr` and for the literal
`C:\Users\mandr` across both new files:

- `hooks/studioWatch.mjs:25` — `DEFAULT_MEDIA_VAULT_ROOT = "C:\\Users\\mandr\\media-vault"`.
  This is the plan-mandated default (118-07-PLAN.md Task 2: "`MEDIA_VAULT_ROOT` (default
  `C:\Users\mandr\media-vault`)") and matches this repo's existing convention of hardcoding
  Larry's personal-machine paths as overridable defaults in a single-operator tool (e.g.
  `CLAUDE.md`'s own `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`
  line, and `hooks/scanner.mjs`'s hardcoded fallback URL). It is a path, not a credential; it is
  overridable via `MEDIA_VAULT_ROOT` env var at tier 1 of `resolveConfig`'s three-tier
  resolution. Flagged here for visibility per the secrets-discipline instruction, not changed.
- `hooks/__tests__/studioWatch.test.mjs:3` — a comment stating the "never point a test at the
  real vault" rule; no actual path usage.
- No credential-shaped strings (`api_key`/`secret`/`token`/`password`/`bearer` followed by a
  quoted value) matched anything beyond the test file's own literal placeholder,
  `"dummy-value-not-real"`, used exactly to prove the exit-2/exit-0 control pair without a real
  key.

No credential value and no unexpected home path were found.

## User Setup Required

None — no external service configuration required. `STUDIO_API_KEY`'s real value is not needed
for this plan (it only needs to be ABSENT or present-as-dummy to exercise the exit-2/exit-0
control pair) and was never read, printed, or guessed.

## Next Phase Readiness

- `hooks/studioWatch.mjs`'s scan core is ready for plan `118-08` to layer the ingest POST
  pipeline on top of `scanVault`'s pure `{ candidates, cache }` output — no re-testing of the
  scan half should be needed.
- The vault directories exist and are provably empty; plan `118-08`'s scheduled task and manual
  `/studio-sync` path both have a real (if currently empty) vault to scan against.
- `resolveConfig`'s `STUDIO_API_KEY` resolution and its skill-local `.env` file path
  (`<homedir>/.claude/skills/studio/.env`) are now the locked convention for `118-12`'s
  `/studio-generate` skill to write credentials into, if it needs the same key.
- Full `npm test` run: **before 4407 passed | 0 failed** (324 test files passed, 17 skipped; 197
  todo — pre-plan baseline per `118-03-SUMMARY.md`) -> **after 4422 passed | 0 failed** (325 test
  files passed, 17 skipped; 197 todo). The delta (+15 tests, +1 file) is exactly this plan's new
  test file; zero regressions elsewhere.

## Self-Check: PASSED

- FOUND: `hooks/studioWatch.mjs`
- FOUND: `hooks/__tests__/studioWatch.test.mjs`
- FOUND: `.planning/phases/118-studio-media-gallery/118-07-SUMMARY.md`
- FOUND: `C:\Users\mandr\media-vault\gen` (and sibling `refs`/`styles`/`trash`)
- FOUND commit `535f4966` (Task 2)
- FOUND commit `1d48017f` (Task 3)
- FOUND commit `cde7aa6e` (this summary)

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
