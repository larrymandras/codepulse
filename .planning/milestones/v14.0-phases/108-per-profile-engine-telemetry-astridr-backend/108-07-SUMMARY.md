---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 07
subsystem: infra
tags: [convex-self-hosted, docker-compose, astridr, live-integration, ws-commands, model-routing, control-verb-swap]

# Dependency graph
requires:
  - phase: 108-05
    provides: "scope-aware swap_model set/restore, scope on all four control_verb_swap emit sites, D-03 boot seed"
  - phase: 108-06
    provides: "useControlVerbSwaps hook + swap-history section (codepulse-side, not exercised live by this plan)"
provides: "Live-stack proof for ENGINE-01/ENGINE-02/ENGINE-05, all marked Complete 2026-08-07 on operator sign-off. Three real defects found and closed en route: session_id-null drop, provider_affinity array-vs-string, and a stale activeEngineSnapshots row surviving a restore. Both the activeEngineSnapshots axis and the control_verb_swap swap-history axis are now proven live end-to-end."
affects: [109]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - "codepulse:.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md"
  modified: []

key-decisions:
  - "STOPPED at Task 4 (blocking human-verify checkpoint) per this plan's autonomous:false gate and the executor's explicit dispatch instructions, across every proof round — Task 4 was never self-approved by any executor. Resolved 2026-08-07 when a fresh continuation agent received the operator's explicit 'approved' and executed Task 4 (see the later Task 4 decision entry below)."
  - "A real, live-discovered defect (control_verb_swap telemetry silently dropped for every WS swap.set dispatch, root cause: session_id explicit null rejected by isOptionalString) was found during Task 3 Step 4 of the first proof. It was documented with a full root-cause chain and NOT fixed in that plan run, per its 'this plan authors no code' scope."
  - "That defect was fixed and deployed in a later session (codepulse d78fb5c1/1521fe2d, astridr f632752c) and this re-proof VERIFIED the fix works: a direct freshness probe with explicit-null optional fields landed a row with the nulls correctly stripped, and both Step 7 restore-path events (which also carry session_id:null) landed live rows."
  - "The re-proof found a SECOND, previously-masked defect on the same resolver: swap_model.py's provider_affinity field is a real list/array on every success path, but convex/runtimeIngest.ts's isOptionalString() guard only accepts undefined/null/string, so the array fails the type check and the event is skipped — this affects only success-path swaps (restore/refused paths have provider_affinity:null and are unaffected, proven by direct positive control). This is NOT the same defect as the first proof's finding; it was invisible until the first defect stopped masking it. NOT fixed in this session, per the same 'authors no code' scope — documented as a second named gap for the operator's Task 4 decision."
  - "Task 2's two commits (deploy verification + rebuild/freshness proof) and Task 3's live-proof work were committed as a single evidence-file commit (87738401) rather than two separate ones, because all edits were made to the same new file in one continuous session before the first commit — splitting after the fact would require artificial hunk surgery with no benefit, matching the 108-05 precedent for genuinely inseparable diffs."
  - "The provider_affinity gap was fixed and re-verified live (commits b43fbca8/d5dfb715), and a third defect (a stale pinned activeEngineSnapshots row surviving a restore-to-default) was found, fixed, and live-verified before Task 4 was dispatched (astridr 55849e2a, codepulse 58cdb0e7). Two synthetic test rows were purged from the live controlVerbSwaps table by verified id+scope."
  - "Task 4 (2026-08-07): Larry reviewed all three proof rounds plus the cleanup section and replied 'approved.' He explicitly approved marking ENGINE-01 and ENGINE-02 Complete on the same evidence as ENGINE-05, since both map to Phase 108 in REQUIREMENTS.md's traceability table and are now proven live, not merely code-complete. All three requirements marked Complete in REQUIREMENTS.md's checklist and traceability table in this same commit; TELE-02 verified untouched (Phase 109 / Pending)."

patterns-established: []
requirements-completed: [ENGINE-05, ENGINE-01, ENGINE-02]
# Marked Complete 2026-08-07 (Task 4, continuation agent) on the operator's explicit "approved"
# after review. ENGINE-05 is the integration gate this plan exists to close. ENGINE-01/ENGINE-02
# are marked on the SAME evidence per the operator's explicit instruction: both are mapped to
# Phase 108 in REQUIREMENTS.md's traceability table and both are now proven live (not merely
# code-complete) by the rows this plan's three proof rounds pasted. See 108-ENGINE-05-EVIDENCE.md's
# "Task 4 — Operator sign-off" section for the full sign-off record.

# Metrics
duration: "~50 min (first proof) + ~35 min (re-proof) + ~40 min (three gap-closure rounds) + Task 4 sign-off"
completed: "2026-08-07 — Task 4 operator sign-off received; ENGINE-05/ENGINE-01/ENGINE-02 marked Complete"
---

# Phase 108 Plan 7: ENGINE-05 Live Integration Gate Summary

**All four tasks complete. Larry reviewed the full evidence (three proof rounds + the cleanup
section) and replied "approved" on 2026-08-07. ENGINE-05, ENGINE-01, and ENGINE-02 are marked
Complete in `REQUIREMENTS.md`.**

## Status

- **Task 1 (consent):** Satisfied by prior operator approval (provenance recorded in the evidence
  file). Not re-asked.
- **Task 2 (deploy, rebuild, prove freshness):** COMPLETE. Self-hosted Convex deploy landed
  (`npx convex deploy --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY" --yes` — the exact
  working invocation, recorded verbatim for future phases). `astridr-agent` + 5 war-room agents +
  `notebooklm-mcp` + `cli-gateway` rebuilt via `COMPOSE_PROFILES=prod,war-room docker compose up
  --build -d`. Four in-container symbol probes all report `True`/present. D-03 boot seed captured:
  3 rows (`personal`/`business`/`consulting`), all real `profileId`+`model`
  (`anthropic/claude-sonnet-5`), `mode: "inherited"` — no sentinels.
- **Task 3 (the live proof):** COMPLETE, with a mixed result — see below. Both defects found during
  Task 3 (and a third, found during the requested cleanup) were subsequently fixed and re-verified
  live; see "Second re-proof" and "Cleanup" sections below.
- **Task 4 (operator sign-off):** COMPLETE 2026-08-07. Larry reviewed and replied "approved."
  ENGINE-05, ENGINE-01, ENGINE-02 marked Complete in `REQUIREMENTS.md`.

## Live Proof Results (see `108-ENGINE-05-EVIDENCE.md` for every raw row and command)

**PASS — the `activeEngineSnapshots` axis (ROADMAP criteria 1, 2, 4; ENGINE-01/ENGINE-02's core
claim):**
- (a) A scoped `swap.set` for `consulting` → `claude-opus-4-8` produced a real row:
  `profileId: "consulting"`, `model: "claude-opus-4-8"`, `mode: "pinned"`,
  `selectionPath: "profile-swap-override"`.
- (b) `business`'s row was byte-identical to its Step-1 baseline (same `_id`, same `timestamp`) —
  the scoped swap touched only its target profile.
- (d) An unscoped `swap.set` → `claude-haiku-4-5-20251001` produced `business`'s row with
  `selectionPath: "global-swap-override"` — the global path behaves exactly as before this phase.
- (e) `consulting`'s per-profile pin was untouched by the unscoped call (byte-identical to its own
  prior reading) — D-04's precedence (per-profile outranks global) holds live.
- Restore: both overrides genuinely cleared, proven not by the ack alone but by driving a fresh
  turn on each profile and observing `run.completed`'s `model` field revert to `claude-sonnet-5`
  for both `consulting` and `business`.
- Step 7 (negative control): an unknown `profile_id` produced `status: "error"` naming the
  rejected value, AND the row read before/after was byte-identical — the fail-closed guard at
  `ws_commands.py:1137` rejects before any dispatch, so no silent global apply occurred.

**FAIL — the `control_verb_swap` swap-history axis (assertions (c) and (f)):** every scoped and
unscoped `swap.set` dispatched over the WS command path produced **zero** rows in
`controlVerbSwaps`, confirmed both via `listByScope` and a direct `npx convex data
controlVerbSwaps` table dump ("There are no documents in this table."). This is not a proof
artifact — it is a real, live-discovered, root-caused defect:

`astridr/api/ws_commands.py:1149` (`_handle_swap_set`) unconditionally constructs
`ControlVerbContext(session_id=None, ...)` for every command-channel swap. The telemetry dict
literal in `swap_model.py` carries `"session_id": ctx.session_id` verbatim (explicit `null`, not
an omitted key), and `astridr/engine/telemetry.py`'s buffered `_post_to_convex()` path — unlike
its sibling `send_to()`, whose own docstring documents the exact footgun — does not strip
`None`-valued keys before serializing. On the CodePulse side, `convex/runtimeIngest.ts`'s
`isOptionalString()` guard (`value === undefined || typeof value === "string"`) rejects an
explicit `null`, so `resolveControlVerbSwapEvent()` returns `null` for the whole event and the
insert is silently skipped — no exception, so it is invisible to the `dropped` counter the
per-event try/catch (108-03 gap closure) tracks. **This affects every manual (WS `swap.set`)
`control_verb_swap` emission, on all four sites, scoped and unscoped alike — spoken swaps (which
thread a real `session_id`) are unaffected.**

Per this plan's own scope (`108-07-PLAN.md`: "This plan authors no code"), this defect was
**documented, not fixed**. It is a named gap for the operator to decide on at Task 4: fix now
(small, well-understood — strip `None`-valued keys before `_post_to_convex` serializes, or make
`isOptionalString` treat `null` the same as `undefined`) with a fresh consent/deploy cycle, or
defer to a follow-up plan.

## Re-proof after gap closure (2026-08-07, later same day)

The session_id-null fix above was written, deployed to self-hosted Convex, and astridr was
rebuilt (`COMPOSE_PROFILES=prod,war-room docker compose up --build -d`). Full transcript appended
to `108-ENGINE-05-EVIDENCE.md` under "Re-proof after gap closure."

- **Freshness proof:** PASS. The new `skipped` field is live in the `/runtime-ingest` response,
  and a direct freshness probe (explicit-null optional fields, matching the exact defect shape)
  landed a row with the nulls correctly stripped — confirmed the fix works at the Convex layer.
- **In-container code proof:** PASS. `_post_to_convex` calls `_strip_none_values`, confirmed live
  inside the rebuilt `astridr-agent` container (probed both immediately after rebuild and again
  after an unexplained-but-benign single container recreate settled to healthy — RestartCount
  never incremented, so this was not a crash loop).
- **Core engine axis regression check:** PASS, unchanged from the first proof. `consulting` pins
  to the scoped-swap model, `business` pins to the global-swap model, `personal` stays at its
  boot-seed default.
- **Swap-history axis (assertions c/f): STILL FAIL — a genuinely different, second defect.**
  Real scoped and unscoped `swap.set` dispatches still produced zero `controlVerbSwaps` rows.
  Root cause traced and directly reproduced (not just inferred): `swap_model.py`'s
  `provider_affinity` field is a real Python list on every path where a swap actually resolves to
  a model, but `convex/runtimeIngest.ts`'s `isOptionalString()` guard only accepts
  `undefined`/`null`/`string` — a JSON array fails that check, so the whole event is skipped. A
  positive control (the `restore` path, where `provider_affinity` is `None`) landed real rows
  under the exact same `session_id: null` conditions, isolating the new defect precisely to
  `provider_affinity`'s type. **This means the one case the swap-history feature exists to show —
  an actual successful swap — still never lands, even after the first fix.** Not fixed in this
  session, per the same "authors no code" scope.
- **One disclosed operational hiccup, not a defect:** the first swap attempt after the astridr
  rebuild was lost to a transient telemetry-buffer timeout (`telemetry.timeout events=30`,
  startup DNS/network settling after the compose recreate) — confirmed via direct in-container
  connectivity probe and log evidence, then the swap sequence was cleanly re-run once three
  consecutive successful buffer flushes were observed.
- **Restore:** PASS. Both overrides cleared, proven by driving fresh turns on both affected
  profiles and observing `model: "claude-sonnet-5"` (the pre-test default), not by acks alone.
  Larry's assistant is not left pinned to a test model.

**Net result of this re-proof:** the operator's first-proof fix is verified working exactly as
designed. ENGINE-05's swap-history axis is still not closed — for a new, distinct, root-caused
reason discovered only because the first defect stopped masking it. This is presented to the
operator as two separate, sequential findings, not conflated into one.

## Second re-proof — providerAffinity gap closed (2026-08-07, continuation)

The `providerAffinity` defect above was fixed (`convex/schema.ts`/`controlVerbSwaps.ts` retyped
`v.optional(v.string())` → `v.optional(v.array(v.string()))`; new `isOptionalStringArray` guard in
`runtimeIngest.ts`), deployed (codepulse-only — astridr already emitted the correct `list[str]`
shape), and re-proved end-to-end. A mandatory field-by-field defect-class sweep across both
`controlVerbSwaps` and `activeEngineSnapshots` found no further mismatches. Mutation-verify
confirmed RED on the reverted guard, GREEN restored; full-suite ground truth 280/297 files,
3613/3806 tests, 0 failed. A real scoped swap (`consulting`) and a real unscoped swap each produced
a genuine `controlVerbSwaps` row with `providerAffinity` present as an array, `scope`
present/absent correctly, `path: "claude-native"` — the swap-history axis (D-13/D-15's actual
purpose) was proven live for the first time across all three rounds. Core engine axis
(`activeEngine`) re-confirmed unregressed with fresh rows, control profile untouched. Stack
restored, proven via live turns. Fix commit `b43fbca8`, re-proof commit `d5dfb715`.

## Cleanup — stale-row fix and synthetic-row purge (2026-08-07, requested by Larry before sign-off)

Two additional items closed before Task 4 was dispatched:

- **`activeEngineSnapshots` stale `pinned` row after a restore-to-default.** The restore path
  cleared the router's override correctly but never emitted anything to supersede the last-pinned
  row, so the table kept reporting a profile's last-swapped model as current even after a genuine
  restore. Fixed in astridr (`swap_model.py`'s restore branch now emits an honest
  `mode: "inherited"` row via the existing D-03 boot-seed emitter, new `selectionPath:
  "restore-to-default"`); D-02's refuse-to-emit guard for genuinely unresolved models is untouched
  and its pre-existing tests pass unmodified. 16 new unit tests, 5 separate mutations each
  RED→GREEN. Live-verified: scoped restore emits for exactly that profile; unscoped restore
  correctly excludes a profile carrying its own pin (byte-identical `_id`/`timestamp`). Full
  astridr-repo suite: 9883 passed, 0 failed. Commits: astridr `55849e2a`, codepulse `58cdb0e7`.
- **Two synthetic test rows purged from `controlVerbSwaps`.** Both carried `__sentinel__`-shaped
  `scope` values left over from the freshness probes above. Purged via a temporary,
  single-document, id+scope-verified internal mutation, exercised, then removed from source and
  redeployed — confirmed gone by a post-redeploy call failing with "Could not find function." 12
  rows before, 10 after; genuine rows confirmed byte-identical.

Full detail, raw rows, and every verdict for both items: `108-ENGINE-05-EVIDENCE.md`'s "Cleanup:
stale-row fix and synthetic-row purge" section.

## Task 4 — Operator Sign-off (2026-08-07)

Larry reviewed all three proof rounds and the cleanup section — every raw row, every root-cause
trace, the restore-to-pre-test-state confirmation, and the two Phase 109 carry-forward items — and
replied **"approved."** He explicitly approved marking **ENGINE-01 and ENGINE-02 on the same
evidence** as ENGINE-05, since both are mapped to Phase 108 in `REQUIREMENTS.md`'s traceability
table and both are now proven live by this plan's rows, not merely code-complete.

**Marked Complete in `REQUIREMENTS.md`:** ENGINE-05 (the integration gate itself), ENGINE-01 (the
per-profile telemetry emit — proven live via `activeEngine:latestByProfile` reads across the boot
seed, a scoped swap, an unscoped swap, and a restore), ENGINE-02 (the scoped `swap.set` — proven
live via the same reads plus the fail-closed negative control). Both the checklist bullets and the
traceability table rows were updated; `TELE-02` was left untouched (`Phase 109` / `Pending`),
verified after the edit.

Full sign-off text (date, requirements covered, and an honest statement of what the gate found and
closed) is appended to `108-ENGINE-05-EVIDENCE.md` under its own "Task 4 — Operator sign-off"
heading — nothing in the file's prior sections was edited or retracted.

## Carry-Forward Items for Phase 109

Recorded here as explicit inputs so they are not rediscovered mid-execution:

1. **TELE-02's surfaced half.** Needs a host with a real per-profile scope. D-15's choice of
   `GlobalSwapModal` was falsified during Phase 108 execution: it is the all-profiles axis
   (`103-CONTRACT.md` §8) with exactly one mount site app-wide and a hardcoded `profileId={undefined}`.
   `convex/controlVerbSwaps.ts`'s `listByScope` declares `profileId: v.string()` non-optional, so it
   cannot serve a combined/global view without a signature change (per-profile-only works as-is).
2. **Model-id format split.** `mode: "inherited"` rows carry provider-prefixed ids
   (`anthropic/claude-sonnet-5`); `mode: "pinned"` rows carry bare ids (`grok-4.5`,
   `claude-haiku-4-5-20251001`) — directly visible throughout this plan's own evidence rows. The
   three components ENGINE-03 will bind to (`src/hooks/useActiveEngine.ts`,
   `src/components/brains/BrainHeaderBadge.tsx`, `src/components/brains/BrainPicker.tsx`) contain
   zero `/`-handling or normalization today — the `.split("/").pop()` idiom that exists lives in
   `AgentNode.tsx`/`SwarmTaskNode.tsx`, a different component reading a different data source. Any
   comparison against a model catalogue will match in one mode and silently miss in the other until
   this is normalized.
3. **`listByScope` signature.** `profileId: v.string()` is non-optional while global swaps store
   `scope: null` — a per-profile-only surface works as-is; a combined/global view needs the
   signature changed to reach the `scope: null` rows.

## Task Commits

1. **Tasks 2+3 combined (evidence file, deploy + rebuild + live proof + defect finding)**
   (codepulse) - `87738401` (docs)
2. **Re-proof after session_id-null fix** (codepulse) - `a413adf5` (docs)
3. **providerAffinity array fix** (codepulse) - `b43fbca8` (fix)
4. **Second re-proof — providerAffinity gap closed** (codepulse) - `d5dfb715` (docs)
5. **Cleanup evidence — stale-row fix + synthetic-row purge** (codepulse) - `bc62d0a5` (docs)
6. **Task 4 — sign-off + requirements marked Complete** (codepulse) - recorded below in this run's
   Self-Check

`git show --stat HEAD` confirmed the first commit contains only
`108-ENGINE-05-EVIDENCE.md` — no unintended files swept in.

## Files Created

- `codepulse:.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`
  — full verbatim command transcript and pasted raw row output for every assertion, Tasks 1-3.

## Deviations from Plan

### Auto-fixed Issues

**None** — per this plan's explicit "authors no code" scope, no code was written or fixed, even
though a real defect (the `control_verb_swap` drop bug above) was discovered. This is a deliberate
departure from the general Rule 1 "auto-fix bugs found during execution" convention: this plan's
own text and its `autonomous: false` gate scope the executor to deploy/execute/read/paste only,
and Task 4 is explicitly the decision point for gaps found live. Documented here as a disclosed,
reasoned exception, not an oversight.

### Environment/tooling notes (not code deviations)

- `docker exec astridr-agent python - <<'PY' ... PY` (without `-i`) silently produced zero stdout
  in this Git-Bash/Windows environment — the `-i` flag is required to attach stdin for heredoc
  piping into the container process. Recorded so future phases don't rediscover this.
- CWD drifted to `astridr-repo` partway through Task 3 investigation (several `grep`/`sed`
  commands against astridr files ran with no explicit `cd`, succeeding only because the drift had
  already happened) — caught when a subsequent `grep convex/...` command failed with "no such
  file." Recovered by using explicit `cd /c/Users/mandr/codepulse &&` prefixes for every
  codepulse-side command from that point forward, per this plan's own `<repo_scope_and_cwd>`
  warning.

## Known Stubs

None — this plan authors no code and touches no UI/data-rendering surface.

## Threat Flags

None beyond the plan's own `<threat_model>`. T-108-25 (secret disclosure) was actively verified,
not just assumed: the evidence file was grepped for `ADMIN_KEY`/`Bearer `/`service_key`/
`ASTRIDR_WEB_API_KEY` before this SUMMARY was written, and every hit is the shell variable
reference `"$ADMIN_KEY"`, never a resolved secret value.

## Next Phase Readiness

**UNBLOCKED — ENGINE-05, ENGINE-01, and ENGINE-02 are Complete.** Both defects the re-proofs found
(`session_id`-null, `providerAffinity` array-vs-string) were fixed, deployed, and re-verified live;
a third defect (stale `activeEngineSnapshots` row surviving a restore) was found, fixed, and
verified before sign-off. The operator reviewed and approved on 2026-08-07. Phase 109 may now
begin, carrying forward the three items listed above under "Carry-Forward Items for Phase 109" —
in particular, TELE-02's surfaced half and the model-id format split, both of which bear directly
on Phase 109's own success criteria (the per-profile picker, header badge, and confirm-modal
current-engine column).

## Self-Check: PASSED

Files (codepulse):
- FOUND: `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md`
- FOUND: `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-07-SUMMARY.md` (this file, Task 4 sign-off section)
- FOUND: `.planning/REQUIREMENTS.md` (ENGINE-05/ENGINE-01/ENGINE-02 marked Complete in checklist + traceability table; TELE-02 verified unchanged)

Commits (codepulse, `git log --oneline --all | grep <hash>`):
- FOUND: `87738401` (Tasks 2-3 evidence, first proof)
- FOUND: `a413adf5` (re-proof evidence + SUMMARY update)
- FOUND: `b43fbca8` (providerAffinity array fix)
- FOUND: `d5dfb715` (second re-proof — providerAffinity gap closed)
- FOUND: `bc62d0a5` (cleanup evidence — stale-row fix + synthetic-row purge)
- Task 4 sign-off commit hash recorded at commit time (this run) — see final commit list in the
  executor's completion report.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Plan: 07*
*Status: COMPLETE — Task 4 operator sign-off received 2026-08-07; ENGINE-05/ENGINE-01/ENGINE-02 marked Complete*
