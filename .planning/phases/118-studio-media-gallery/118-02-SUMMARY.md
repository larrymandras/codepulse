---
phase: 118-studio-media-gallery
plan: 02
subsystem: infra
tags: [openart, mcp, oauth, d-09, probe, third-leg, credits]

requires: []
provides:
  - "D-09's open item resolved: THIRD_LEG: openart-mcp, recorded identically in the evidence file and in a D-09 AMENDMENT"
  - "118-OPENART-EVIDENCE.md — pre-auth surface, post-auth surface, both controls, credit finding, two verify defects"
  - "the named generation tools 118-14 must invoke: openart_generate_image, openart_generate_video"
  - "a wave-9 blocking prerequisite (OpenArt credit balance) surfaced at wave 1"
affects: [118-13-fal-leg, 118-14-third-leg, 118-12-sidecar-contract]

tech-stack:
  added: []
  patterns:
    - "MCP tool-surface enumeration via ToolSearch against a KNOWN-CONNECTED control server (github), so an auth-only result is attributable to the subject rather than to the method"
    - "registration-is-not-capability: prove an OAuth MCP session with one read-only authenticated call, never from the tool list alone"
    - "price the cheapest configuration BEFORE committing to a paid leg, so an affordability blocker surfaces at the probe rather than at the proof"

key-files:
  created:
    - .planning/phases/118-studio-media-gallery/118-OPENART-EVIDENCE.md
  modified:
    - .planning/phases/118-studio-media-gallery/118-CONTEXT.md

key-decisions:
  - "THIRD_LEG: openart-mcp. Real generation tools appeared post-auth (openart_generate_image, openart_generate_video); the two auth tools were REPLACED, not supplemented (2 tools -> 16). Confirmed with Larry after the credit finding was put in front of him."
  - "second-direct-api was explicitly REJECTED: it is defined as 'no usable OpenArt generation surface', and the surface is usable — the account balance is short. A capability problem and an affordability problem are not the same branch."
  - "This leg requires NO provider credential env var (OAuth session held by the MCP client). MEDIA_VAULT_ROOT is the only env var it needs. Per D-12 its recipeMd documents the MCP tool invocation and names no key, because none exists."
  - "No headless path: MCP tools are invokable only inside an MCP-capable session. /studio-generate (a Claude Code skill) satisfies this; hooks/studioWatch.mjs cannot and must not be asked to."

patterns-established:
  - "Mutation-test a plan's own <automated> verify before trusting its green — both of this plan's checks passed while being partly blind, and neither defect was visible from running them."
  - "Whole-file substring counts in acceptance criteria are polluted by prose that merely DISCUSSES the literal; scope the assertion to the section that must carry it."

requirements-completed: [D-09]

duration: ~30min
completed: 2026-08-14
---

# Phase 118 Plan 02: OpenArt MCP Surface Probe Summary

**D-09's third leg resolves to `THIRD_LEG: openart-mcp` — real generation tools appeared post-auth and the OAuth session was proven with a live authenticated call, but the account holds 7 credits against a 10-credit cheapest generation, so the leg is capable-but-not-yet-executable and wave 9 now carries an explicit, measured prerequisite instead of a surprise.**

## Accomplishments

- **Pre-auth surface captured with a working control.** `ToolSearch "+openart"` returned exactly two tools, both OAuth handshake. Control `github` returned 8 real functional tool schemas at the same cap, proving the method surfaces non-auth tools when they exist — so the auth-only result is a fact about OpenArt, not the method. Verdict `AUTH_REQUIRED`.
- **A candidate control was considered and rejected.** `higgsfield` presents an identical auth-only surface. Corroborating, but invalid as *this* control: a second auth-gated server cannot demonstrate the method can see real tools. Using it would have been a probe returning the same answer whether or not the thing was broken.
- **Post-auth surface re-measured by the same method.** 16 tools, none auth; the two auth tools were **replaced**, not supplemented. Generation tools named: `openart_generate_image`, `openart_generate_video`. Control re-run and stable at 8, so the pre→post delta is attributable to OpenArt.
- **Capability proven separately from registration.** One read-only `openart_account_get` call returned a real payload, so this is not a shelf of tools that 401 on first use.
- **Credit blocker found at wave 1.** Plan Free, 7 credits; `openart_model_cost` puts the cheapest generation of any kind at 10 credits (`kling-3-omni` `text2image`, 1k/4:3), next tier 15, video from 50. Nothing affordable. Escalated to Larry with the measured numbers rather than absorbed silently.
- **D-09 amended** in `118-CONTEXT.md`: 34 additions, 0 deletions, no other decision touched, no decision heading altered.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `1bdf310b` | Pre-auth enumeration + control, verdict `AUTH_REQUIRED` |
| 2+3 | `14b806d8` | Post-auth surface, credit finding, `THIRD_LEG: openart-mcp` + D-09 amendment |

## Deviations from Plan

1. **Executed INLINE rather than via a `gsd-executor` subagent — deliberate, and the only correct option.** Task 1 requires enumerating "the tooling actually available in this session"; Task 2 requires invoking `mcp__openart__authenticate`. The `gsd-executor` agent type carries `Read, Write, Edit, Bash, Grep, Glob, mcp__context7__*` — no OpenArt MCP access and no visibility into the session's deferred-tool registry. A subagent could only have *guessed* the surface, which Task 1's own rule 2 forbids. Caught before dispatch, not after.

2. **`complete_authentication` was never called.** The plan's action text anticipated invoking it after Larry's consent. In practice the flow completed on the redirect and the server re-registered itself automatically, deregistering both auth tools in the same moment — the tool no longer existed by the time the surface changed. Recorded as fact; claiming it was invoked would have been false.

## Issues Encountered

**Two defects in this plan's own `<automated>` verify commands, both found by mutation-testing the checks rather than by running them. Both passed while partly blind.**

1. **Task 1's verdict check is blind to the verdict.** It regexes the *whole file* for any of the three verdict strings, and the artifact legitimately names `SERVER_NOT_CONNECTED` in prose while explaining why it does not apply. Replacing the real verdict with `MAYBE` leaves it **GREEN** — measured. It also never enforces the acceptance criterion's actual "exactly one" wording. Corrected form isolates the verdict section and requires exactly one string inside it; mutation-proved RED three ways, GREEN unmodified.

2. **Task 3's cross-file control is half-blind.** Its acceptance criteria claim "a mismatched copy is caught". A CONTEXT swap to `second-direct-api` is caught (RED), but a swap to `openart-mcp-interactive` passes **GREEN**, because the check is a plain substring test and `openart-mcp` is a substring of `openart-mcp-interactive`. The likeliest real drift — confusing the two adjacent OpenArt branches — is the one it cannot see. The files genuinely agree here, confirmed by reading rather than by the weak check.

**A self-inflicted instance of defect 1.** Documenting the fix pushed the whole-file verdict-label count to 3 against a criterion demanding exactly one. Rewritten to avoid the literal sequence; count back to 1. Recorded because the same trap will bite any future edit to this artifact.

## User Setup Required

**Blocking for wave 9 (`118-14`), not for waves 2–8.** The OpenArt balance must be at or above the quoted cost of the chosen model before the third leg's end-to-end proof can run — 10 credits buys the cheapest (`kling-3-omni` `text2image`). Larry has accepted this and will top up. `118-14` must re-read the balance via `openart_account_get` and refuse with an honest message rather than attempt a generation it cannot pay for.

## Next Phase Readiness

`118-13` is **unaffected** by this amendment — it builds the fal.ai direct-API leg exactly as D-09 item 2 already locked. `118-14` now has a resolved branch, two named tools, a documented async completion path (`openart_creation_wait` on `STILL_RUNNING`), an explicit prohibition on hand-constructing model ids (read them from `openart_model_list` / `openart_model_form_get`), and a named prerequisite — so it can execute without further discovery, which is exactly what Task 3's `<done>` asked for.

## Self-Check: PASSED

- Both plan verifies green: `pre-auth enumeration captured` / `third leg recorded consistently: openart-mcp`.
- Exactly one verdict line in the evidence file (criterion satisfied after the self-inflicted inflation was fixed).
- `118-CONTEXT.md`: 34 additions, **0 deletions**, no decision heading added or changed.
- Disclosure scan, fixed-string and control-paired (control `openart-mcp` = 9): **0** hits for `code=`, `token=`, `Bearer `, and the account uid across both artifacts. The account email is deliberately absent from the evidence file. One pre-existing email hit at `118-CONTEXT.md:26` predates this plan, is not in this diff, and already appears in 15 tracked files plus every commit's author metadata — disclosed, not introduced.
- `.planning/STATE.md` and `.planning/ROADMAP.md` untouched by this plan.

---
