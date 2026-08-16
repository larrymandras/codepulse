---
phase: 118-studio-media-gallery
plan: 14
status: complete
completed: 2026-08-16
requirements: [D-09, D-11, D-12]
key-files:
  created:
    - hooks/studioThirdLeg.mjs
    - hooks/__tests__/studioThirdLeg.test.mjs
    - scripts/check-118-14-task1.mjs
  modified:
    - .planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md
    - ~/.claude/skills/studio-generate/SKILL.md (host-side, not repo content)
---

# 118-14 — D-09's third leg: OpenArt MCP

**D-09 is CLOSED.** Three backends, three genuinely different code shapes, each proven end to end.
Full evidence with every control pair: `118-D09-EVIDENCE.md` sections `LEG: third — selected shape`
and `LEG: third — the proof`.

## What was built

`hooks/studioThirdLeg.mjs` — the placement and sidecar half of an MCP-driven generation path.
Generation itself is an `mcp__openart__openart_generate_image` call made in-session and completed
with `openart_creation_wait`; there is no headless path to an MCP tool, so a standalone `.mjs`
cannot and must not try to drive one.

**The shape difference is an ABSENCE, which is unusual and is the point.** Leg 1 shells out to a
CLI; leg 2 is our own HTTP queue/poll client with a retry policy and an `Authorization` header.
This module has none of those four things, and a test asserts their absence with `studioFal.mjs` as
the known-positive control proving the patterns match where they exist. If a future edit gives this
module a fetch-based submit and poll loop, leg 3 has collapsed into leg 2 and D-09's intent is
defeated even though its letter still reads as satisfied.

**The sidecar contract needed ZERO edits, for the third time and on the hardest case.** Legs 1 and 2
both had a *program* turning a machine-readable generator response into a sidecar. Here the
provenance arrived as a tool result in a conversation and the contract absorbed it unchanged. The
load-bearing test compares against the sidecar **leg 2 actually produces** — by running `studioFal`'s
own `generate` with a mocked fetch — rather than a hand-written expectation, which would only have
proven the module matches my belief about the contract.

`place()` writes the **sidecar before the media file**, and that order is load-bearing rather than
stylistic: contract section 6 means a media file ingested one cycle ahead of its sidecar loses
provenance permanently, whereas a sidecar with no media is harmless because `.json` is not an
ingested extension. The asymmetry is total, so there is exactly one safe order and the function
enforces it instead of leaving the caller to remember.

## The live proof

| | |
|---|---|
| model / mode | `kling-3-omni` / `text2image`, ids read from `openart_model_list`, never hand-constructed |
| cost | **10 credits**, balance `24000` -> `23990` — delta matches the quote exactly |
| asset | `oa_kling-3-omni_20260816T200405.png`, 1,407,791 bytes, PNG magic `89 50 4E 47 …` |
| ingest | `scanned=4 rehashed=1 ingested=1 duplicates=3 refused=0` |
| row in Convex | `provider=openart`, full prompt verbatim, `params` a **string**, `sizeBytes` byte-identical to disk, `thumbStorageId` present |
| D-07 control pair | the sidecar-less row sits in the **same** `api.media.list` response with `prompt`/`provider` absent |
| D-12 card | `openart-kling-3-omni` created, pulled back **out of** Convex and scanned clean |

`autoEnhancePrompt` was set **false** deliberately: left true, OpenArt may rewrite the prompt
server-side and the sidecar would record a prompt that does not reproduce the image — the exact
copyable-recipe failure the contract exists to prevent. The recipe card now says so.

## Deviations and findings

**1. A defect in this plan's own Task 1 `<automated>` check — the eighth in this phase.** It ends
`if(!e.includes(m[1]))`, a whole-file substring test, and it was blind to the exact case it names.
Mutation-tested: changing the branch string in the evidence file left it **GREEN**, because an
unrelated table cell elsewhere in the same 500-line file still contained the captured substring. Its
regex also captured trailing markdown bold, so `m[1]` was literally `openart-mcp**`. Replaced by
`scripts/check-118-14-task1.mjs`, which anchors on the label, compares whole tokens on both sides
(the two OpenArt branches are prefix-related, so substring cannot separate them), and reads the D09
side only from inside the `## LEG: third` section. Mutation matrix: 5 real failure modes RED, 1
control GREEN.

**2. The module exited 0 having done nothing — the ninth silent pass, and the first signalled by an
exit code rather than a grep.** `main()` was exported but never invoked, so the first real placement
run printed nothing and wrote nothing while returning 0. Caught by reading the output rather than
the exit code, then confirmed with a file-count probe whose control listed the five pre-existing
vault files. Fixed with the house-convention entry-point guard, plus a regression test asserting the
guard exists **and names this file** — a copy-pasted guard naming another module would never fire.
Both mutations RED.

**3. Two assertions in my own new test suite were themselves the whole-file-grep defect**, caught
before landing: `/Authorization/` matched the module's own comment saying it sends none, and a
token-shaped-literal scan matched the markdown backticks around a tool name in a comment. Both now
run over a comment-stripped copy with `studioFal.mjs` as the control proving the stripper leaves real
code behind.

**4. A REAL GAP in `detectCredentialValue`, surfaced but deliberately NOT fixed here.** Rule A's name
pattern is `API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL`, so `FAL_KEY=<value>` and
`ANTHROPIC_KEY=<value>` are **not** caught — `_KEY` alone is not in the alternation. Rule C does not
save it: its bound is exactly 40 unbroken `[A-Za-z0-9_-]` chars, and a realistic fal.ai key shape
`<uuid>:<32-hex>` has a longest unbroken run of 36. So a pasted real `FAL_KEY` value would pass the
guard entirely. This does not contradict the guard's docstring, which calls itself a backstop and
lists "a secret that simply does not look like one" as out of scope — it is worth recording because
`FAL_KEY` is this repo's own primary provider credential, so the most likely paste is the one the
pattern misses. Not fixed because the guard belongs to closed plan `118-12`, and widening a security
predicate mid-plan without its own control pairs is how a guard that refuses legitimate cards ships.
Raised to Larry as a finding.

**5. Two Windows shell traps re-hit and worth the line.** `npx convex run ... --env-file C:\...`
mangles under the Bash tool (backslash eating) and PowerShell strips the JSON argument's embedded
double quotes when passing to the native exe. The combination that works is **bash with a
forward-slash `--env-file` path** and a **minified single-line** JSON argument.

## Self-Check: PASSED

- `npx vitest run hooks/__tests__/studioThirdLeg.test.mjs` — 36 passed
- `npx tsc --noEmit` — exit 0
- full `npx vitest run` — **4651 passed, 0 failed**, 332 files
- `node scripts/check-118-14-task1.mjs` — PASS, whole-token branch agreement
- all EIGHT pre-existing media skills verified untouched (0 of 446 files modified; control:
  `studio-generate` shows 1, so the probe can detect a modification)
- no credential value in the module, its tests, the skill or the card
