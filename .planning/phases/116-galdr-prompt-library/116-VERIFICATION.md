---
phase: 116-galdr-prompt-library
verified: 2026-08-10T21:05:00Z
status: passed
score: 3/3 goal clauses verified
overrides_applied: 0
---

# Phase 116: Galdr Prompt Library Verification Report

**Phase Goal:** Galdr is a live, Convex-spined prompt library: a prompt saved from one Claude Code session is fetchable by slug from any other session with every `{{variable}}` filled in before injection, and the same library is browsable, editable and versioned at `/galdr` in CodePulse.
**Verified:** 2026-08-10
**Status:** passed
**Re-verification:** No — initial verification

This phase has no REQ-IDs. Per ROADMAP, the acceptance-bearing units are the 16
locked decisions D-01..D-16 in `116-CONTEXT.md`.

## Goal Achievement

The goal is one sentence with three independently falsifiable clauses. Each was
verified against the live self-hosted backend, not against the plans' own reports.

| # | Goal clause | Status | Evidence |
|---|---|---|---|
| 1 | A prompt saved from one Claude Code session is fetchable by slug from any other session | ✓ VERIFIED | A prompt was saved through the installed skill (`promptId n17z3xgvdmjd4x2kty3ayj1h7s8c7ybt`), then fetched by exact slug from four independent fresh-context agents that loaded `SKILL.md` cold. Live reads: `match.slug = adversarial-plan-review`, `match.variables = ["plan_path"]`. See the proxy caveat below. |
| 2 | …with every `{{variable}}` filled in before injection | ✓ VERIFIED | Refusal observed live: given `/galdr adversarial-plan-review` with no arguments, the agent named the missing `plan_path`, asked for it, and injected nothing. Injection observed live: with `plan_path=…` supplied, the fully substituted body was injected with zero remaining double-brace placeholders. Backed by 16 unit tests and an e2e negative control asserting the URL is still `/galdr` while a variable is unfilled. |
| 3 | The same library is browsable, editable and versioned at `/galdr` in CodePulse | ✓ VERIFIED | Browsable: a live probe of `/galdr` on the running app rendered exactly one prompt card (`SEND_BUTTONS: 1`), matching the one live row. Editable: `e2e/galdr.spec.ts` creates a prompt through the drawer, sends it, and archives it, all against the running app. Versioned: proven live below. |

**Score:** 3/3 clauses verified

## Decision Coverage — D-01..D-16

| # | Decision | Status | Evidence |
|---|---|---|---|
| D-01 | Fail-closed bearer auth on the HTTP surface | ✓ VERIFIED (live) | `GET :3211/galdr/list` → no auth **401**, bogus bearer **401**, real bearer **200**. The bogus-bearer row is the control that rules out a gate merely checking header presence. |
| D-02 | One key authorizes reads and writes | ✓ VERIFIED (live) | The same `GALDR_API_KEY` authorized `list` and `fetch` (reads) and `save` and `bump` (writes) in one round trip. |
| D-03 | Fail loud, never cache | ✓ VERIFIED (live) | Missing key → **exit 2** naming `GALDR_API_KEY`; unroutable URL → **exit 3 at 10.1s** (proving the AbortController, not an OS timeout). After every run the skill dir held only its two authored files — nothing written. |
| D-04 | Agent/CLI only — no CORS, no OPTIONS partner | ✓ VERIFIED (live, control-paired) | `OPTIONS /galdr/list` → **404**; control `OPTIONS /preflight-ingest` (a route that genuinely has an OPTIONS handler) → **204**. An earlier attempt using `/ingest` as control was discarded: it also 404s, so it could not have shown the difference. |
| D-05 | Fuzzy hit lists candidates and stops | ✓ VERIFIED (live) | `/galdr adversarial` → `match: null`, one candidate listed, agent waited. It declined to auto-select even as the **sole** candidate — the case where a model most naturally "helps". |
| D-06 | Slug collision refuses, never overwrites | ✓ VERIFIED (live) | Re-save of the same title → **exit 4** with `existingTitle`, `existingSlug`, `existingUpdatedAt`. Not "Server Error". |
| D-07 | Installs once; reaches the laptop via force-add | ✓ VERIFIED | `.claude/skills/galdr/SKILL.md` and `.claude-alt/skills/galdr/SKILL.md` are the same inode `19140298417277882` — the junction serves one file, not a copy. `git ls-files skills/galdr/` non-empty before commit; `c2140fb` pushed. |
| D-08 | Skill surface capped at three invocations | ✓ VERIFIED | `SKILL.md` contains zero `--recent` / `--favorites`; `--category` appears only in the `save` invocation. Control: `--body-file` and `--title` both present, proving the search finds flag-shaped strings. |
| D-09 | Variables resolve from args first, then ask | ✓ VERIFIED (live) | The `key=value` probe filled from arguments with no question asked. The no-args probe volunteered that it would not infer `plan_path` from the repo despite `.planning/phases/110-convex-durability/` being visible in git status — the rule holding under real temptation. |
| D-10 | Refuse to inject on an unresolved variable | ✓ VERIFIED (live) | See goal clause 2. No placeholder, no empty string, no partial body. |
| D-11 | Copy disabled while any variable is unresolved | ✓ VERIFIED (mutation-tested) | 9 unit tests. Forcing `blocked = false` fails 5 of 9, including the negative control that a disabled action cannot submit. |
| D-12 | Send-to-Chat resolves before it navigates | ✓ VERIFIED (mutation-tested + e2e) | Navigate spy receives `text` with no `{{` and `skillName: "galdr:<slug>"`; unfilled variables produce zero navigate calls. Making every prompt bypass the dialog fails 5 of 7. e2e asserts the URL is still `/galdr` with a variable unfilled, then `/chat` after filling. |
| D-13 | `prompts` exempt from `RETENTION_DAYS` | ✓ VERIFIED (code) | Neither table appears in `RETENTION_DAYS`; `convex/retention.ts:105-120` records why, including a do-not-"fix"-this note. |
| D-14 | Version trail capped newest-20, pruned inline | ✓ VERIFIED (code) | `PROMPT_VERSION_CAP = 20` (`convex/galdr.ts:67`), pruned inline at `:279`. Cap depth not exercised live — see gaps. |
| D-15 | Every body-changing write appends a snapshot; restore appends, never rewinds | ✓ VERIFIED (live) | Throwaway probe: create → 1 version; update → 2 (`v2`, `v1`); restore of `v1` → body becomes `v1` **and count goes to 3**, retaining the pre-restore state. Append-only confirmed; nothing lost. |
| D-16 | Delete is archive; versions retained; no hard delete | ✓ VERIFIED (live, control-paired) | After archiving the probe: absent from `galdr:list`, `lookup` returns `match: null` with 0 candidates, and its 3 versions **survive**. Control: `adversarial-plan-review` still resolves in the same checks, proving they can see a live row. UI-side, `/galdr` did not render the archived probe. |

**Coverage:** 16/16 decisions carry evidence. 14 verified against the live
system, 2 (D-13, D-14) by direct code read.

## Test and Build Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` | 293 files passed, 17 skipped; **3892 passed, 0 failures** |
| `npx playwright test e2e/navigation.spec.ts` | 8/8 |
| `npx playwright test e2e/galdr.spec.ts` | passed, stable across two consecutive full-suite runs |
| `npx convex run galdr:list` | exits 0 against `127.0.0.1:3210` |

## Gaps and caveats — stated, not buried

**1. The cross-session claim rests on a proxy.** Goal clause 1 says "any other
session". It was proven with four independent fresh-context subagents that
loaded `SKILL.md` cold with no hint of the expected behaviour — far stronger
than the author self-testing, but they are the same harness and model with no
separate CLI session boundary. A literal second Claude Code session has not run
`/galdr`. Recorded in `116-07-SUMMARY.md` as a deviation.

**2. 20 pre-existing Playwright failures.** The full e2e suite is 40 tests: 20
pass, 20 fail, all in `theme-contrast.spec.ts`. Proven pre-existing by a control
run with only the Galdr nav entry reverted, which reproduced the identical 20.
Unrelated to this phase, but this is not a green e2e suite and should not be
reported as one.

**3. The e2e suite requires the no-auth server.** A default
`npx playwright test` hits `:5173`, where Clerk is enabled, and every nav-click
test fails on the sign-in gate. The correct invocation is `dev:noauth` on `:5181`
with `PW_BASE_URL`, already documented in `package.json`.

**4. `PromptEditorDrawer` has no unit test.** Plan 116-06 scoped tests to "the
two that carry a decision". Its save/restore/archive paths are covered by `tsc`,
by the e2e create/archive round trip, and by the live D-15/D-16 probes above —
but not by a component test.

**5. D-14's cap depth is unexercised.** The constant and the inline prune are
verified by reading the code; no prompt in the library has 20+ versions, so the
eviction path has never actually run.

**6. The library holds one prompt.** `adversarial-plan-review` (uses=1), created
as the round-trip fixture. It is a real, useful prompt, deliberately left in
place. Every probe row created during verification was archived individually —
no bulk path was used on the live instance at any point.

## Verdict

**PASSED.** All three goal clauses hold against the live system, and all 16
acceptance-bearing decisions carry evidence. The gaps above are disclosures, not
open work — with the exception of the pre-existing `theme-contrast` failures,
which belong to Phase 113 (Debt Sweep) or their own phase.
