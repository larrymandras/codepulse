---
phase: 93-eval-pipeline-quality-kpis
plan: 06
subsystem: live-verification
tags: [live-e2e, d-04, calibration, cross-repo, astridr, eval-pipeline, web-auth]

# Dependency graph
requires:
  - phase: 93-03
    provides: "astridr spawn_score task_quality mirror -> CodePulse /runtime-ingest"
  - phase: 93-05
    provides: "Quality page (/quality) + persona detail (/quality/:profileId)"
provides:
  - "D-04 live-E2E completion proof: real Astridr Telegram-turn task_quality score on prod (tidy-whale-981) as evalScores row with profileId 'personal', surfaced in listPersonaKpis"
  - "3 real llm_judge rows on prod (4 dims + rationales + rubricVersion v1 + judgeModel claude-haiku-4-5) via manually-triggered judgeSessionsAction; E7 liveness summary logged (3 sampled / 3 scored / 0 failed / 4 unknown-persona)"
  - "93-CALIBRATION.md — E3 reference set: 12 real prod sessions, frozen digests, labeling table (labels pending), explicit 'trends not trusted yet' verdict"
  - "astridr-repo: SELF-01 actually wired + D-03 gate fix + operational-persona attribution (5 commits)"
  - "astridr-repo: built-in web chat cookie-session auth + profile-path auth bypass closed (user-directed scope addition)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live-E2E verification as diagnosis engine: each real-turn attempt surfaced a distinct production gap (config off -> Langfuse pre-gate -> never-wired evaluator -> persona_id vs profile.id vocabulary -> web-chat auth 401) that no green test suite had caught — vindicating D-04's 'green tests do not close the phase' bar"
    - "Cookie-session auth for served pages that cannot hold a bearer key: POST /auth/login exchanges the pasted key (constant-time) for a random token stored server-side as sha256, delivered as HttpOnly SameSite=Strict cookie; middleware accepts bearer OR cookie"

key-files:
  created:
    - .planning/phases/93-eval-pipeline-quality-kpis/93-CALIBRATION.md
    - "C:/Users/mandr/astridr-repo/config/self-improvement.yaml (enabled:true then reverted to false)"
    - "C:/Users/mandr/astridr-repo/tests/test_web_auth.py"
  modified:
    - "C:/Users/mandr/astridr-repo/astridr/agent/self_improvement.py"
    - "C:/Users/mandr/astridr-repo/astridr/engine/bootstrap/core.py"
    - "C:/Users/mandr/astridr-repo/astridr/agent/post_turn_pipeline.py"
    - "C:/Users/mandr/astridr-repo/astridr/agent/loop.py"
    - "C:/Users/mandr/astridr-repo/astridr/channels/agent_processor.py"
    - "C:/Users/mandr/astridr-repo/astridr/channels/web.py"
    - "C:/Users/mandr/astridr-repo/tests/test_self_improvement.py"

key-decisions:
  - "Option A (operator-approved): temporarily enable SELF-01 for the live turn, keep the bug fixes permanently, revert the enable flag afterward"
  - "Persona identity for the Quality-page join = the OPERATIONAL profile id (personal/business/consulting), stamped per-message on session.active_profile — NOT persona_id ('astridr', shared by all three profiles) and NOT a change to _active_profile's persona-flavored telemetry vocabulary"
  - "Web-chat auth fix (user-directed): session-cookie login rather than embedding the key in served HTML (tunnel-exposed page would leak it); profile-scoped /{p}/api/* bypass closed with the same bearer-or-cookie check"
  - "Calibration labels left empty by design — Larry is the sole labeler (AI-SPEC 1b); E3 gate recorded as NOT EVALUATED and Quality trends explicitly NOT trusted until >=0.7 agreement is computed"

requirements-completed: [EVAL-01, EVAL-02, EVAL-03]

# Metrics
duration: ~5h wall clock (dominated by operator gates: 4 container rebuilds + 3 live conversations + visual verify)
completed: 2026-07-06
---

# Phase 93 Plan 06: Live E2E Verification + Judge Calibration Seed Summary

**D-04 is met with a real score traveling the full cross-repo path — Larry's Telegram turn (session `4e701b43`) -> `spawn_evaluation` -> mirror POST -> prod `/runtime-ingest` -> `evalScores` row with `profileId: "personal"` -> `listPersonaKpis` card (currentMean 1, delta +1, sparkline populated) — after live testing surfaced and fixed FIVE production gaps no test suite had caught, plus the E3 calibration reference set (12 real sessions, labels pending, trends explicitly not yet trusted).**

## Performance

- **Duration:** ~5h wall clock across operator gates (4 rebuilds, 3 live conversations, sign-in visual verify)
- **Tasks:** 3 (1 human-action gate, 1 human-verify live-E2E, 1 auto) + 1 user-directed scope addition
- **Files modified:** 10 (1 codepulse doc created; 7 astridr-repo code files, 2 astridr-repo test files)

## Accomplishments

- **D-04 live completion bar (Task 2):** real `task_quality` row on tidy-whale-981 from a genuine Astridr conversation, attributed to the real operational persona, returned by the Quality grid's own query. Judge triggered manually against prod: 3/3 sessions scored with full row shape (4 dimensions + rationales + `rubricVersion: "v1"` + `judgeModel: "claude-haiku-4-5"`), E7 liveness summary logged, rows render on `/quality/unknown` (operator visually confirmed the drill-in).
- **Five real production gaps found & fixed (astridr-repo)** — each one only findable live:
  1. `SelfImprovementConfig.enabled` defaults false and nothing set it → SELF-01 never ran (temp config enable, later reverted).
  2. `spawn_evaluation` pre-gated on Langfuse's enabled flag, contradicting 93-03's D-03 independent-gates intent → mirror dead whenever Langfuse keys absent (`8afe5d6a`).
  3. **Nothing ever constructed/wired `SelfImprovementEvaluator` into `AgentLoop`** — the entire SELF-01 path was dead code in production since Phase 73; bootstrap now wires it (behavior-neutral while config-gated) and the shutdown flush reuses the same instance (`0ea12ef6`).
  4. Persona identity: `_active_profile` carries `persona_id` (`"astridr"`, shared by ALL three operational profiles) → every score flattened into one non-joining bucket; `agent_processor` now stamps `session.active_profile = profile.id` per message and both spawn sites prefer it (`34c885c6`, `24f07a18`).
  5. **Built-in web chat structurally broken:** its own JS posts `/api/chat` with no Authorization header while the middleware 401s everything — silently (client-side catch), which burned three verification conversations (fixed, see scope addition).
- **User-directed scope addition — web-chat auth (`674a13c4`):** `POST /auth/login` exchanges the operator-pasted key for an HttpOnly SameSite=Strict cookie (random token, sha256-stored server-side, 7-day TTL, capped store, brute-force rate-bucketed); middleware accepts bearer (unchanged for CodePulse/API clients) OR cookie (browser pages incl. EventSource); **profile-scoped `/{p}/api/*` routes no longer bypass auth entirely** (pre-existing unauthenticated chat POST on a tunnel-exposable port); all page send/voice failures now surface in the UI. 14 new tests; 715 web-adjacent tests green.
- **E3 calibration seed (Task 3):** `93-CALIBRATION.md` — 12 sessions from 29 real prod candidates spanning CLEAN/ERR/CHURN, exact frozen `buildJudgeDigest` text per session, judge-vs-human labeling table (3 judge rows recorded, human columns empty by design), E4 boundary pair designated, fixture promotions named, and the honest gaps: the COST class has zero prod representatives (`llmMetrics` never joins claude-cli sessions — it already skewed one judge score to 0.25), and build sessions attribute to persona `unknown`.

## Task Commits

**codepulse (this repo):**
1. **Task 3: calibration reference set** — `04111c1` (docs)
2. **Plan metadata / SUMMARY** — this commit

**astridr-repo (cross-repo, sequential fixes during Task 2):**
1. `8afe5d6a` fix(93-06): stop pre-gating spawn_evaluation on Langfuse enabled (D-03)
2. `0ea12ef6` fix(93-06): wire SELF-01 SelfImprovementEvaluator into the live AgentLoop
3. `a9e183f1` chore(93-06): TEMPORARILY enable SELF-01 for live-E2E verification
4. `34c885c6` fix(93-06): thread persona identity into the task_quality mirror
5. `24f07a18` fix(93-06): attribute task_quality mirror to the OPERATIONAL profile, not persona_id
6. `1d249d5c` revert(93-06): disable SELF-01 after live-E2E verification completed
7. `674a13c4` fix(astridr-web): cookie-session auth for the built-in chat page + close profile-path auth bypass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] D-03 independent-gates violation in spawn_evaluation**
- **Found during:** Task 2 (first live-turn attempt produced nothing)
- **Fix:** caller no longer pre-gates on `LangfuseEvaluator.enabled`; `spawn_score` owns both gates
- **Files:** `self_improvement.py`, `test_self_improvement.py` — **Commit:** `8afe5d6a` (astridr-repo)

**2. [Rule 3 - Blocking] SELF-01 never wired into AgentLoop**
- **Found during:** Task 2 (config enable alone was a no-op)
- **Fix:** bootstrap constructs LangfuseEvaluator + SelfImprovementEvaluator pre-AgentLoop, passes `self_improvement=`, reuses instance for shutdown flush
- **Files:** `engine/bootstrap/core.py` — **Commit:** `0ea12ef6` (astridr-repo)

**3. [Rule 3 - Blocking] persona_id vs operational-profile vocabulary mismatch**
- **Found during:** Task 2 (second live turn landed as `profileId: "astridr"` — non-joining)
- **Fix:** per-message `session.active_profile = profile.id` stamp + operational-first at both spawn sites
- **Files:** `agent_processor.py`, `post_turn_pipeline.py`, `loop.py` — **Commits:** `34c885c6`, `24f07a18` (astridr-repo)

**4. [User-directed scope addition] Built-in web chat auth**
- **Found during:** Task 2 (three web conversations silently 401'd); Larry directed an in-session fix rather than deferral
- **Fix:** cookie-session login + bearer-or-cookie middleware + profile-path bypass closed + UI error surfacing
- **Files:** `channels/web.py`, `tests/test_web_auth.py` — **Commit:** `674a13c4` (astridr-repo)

**5. [Sequencing deviation] Temp-config revert deferred past the coordinator's literal step order** — reverting before the verification turn would have disabled the emission being verified; reverted immediately after the `personal` row + `listPersonaKpis` were confirmed (`1d249d5c`).

**6. [Process note] Two astridr-repo commits swept in concurrent workstreams' staged files** — `8afe5d6a` picked up 3 completed-todo renames and `1d249d5c` picked up `config/skill-health-scan.yaml`, both left staged by parallel agents in the shared checkout. Both are benign, semantically-correct content belonging to those finished workstreams; history was not rewritten on the shared live branch. Later commits check/unstage strays first (`674a13c4` is clean).

## Authentication/Operator Gates

Normal flow, not deviations: Task 1 (deploy + eval key + env, prior session), 4 operator container rebuilds, 3 live conversations (Telegram x2 succeeded; web x3 blocked by the auth bug, root-caused above), dashboard sign-in for the `/quality/unknown` visual verify.

## Known Stubs / Pending Human Items

| Item | Owner | Status |
|---|---|---|
| **Final astridr rebuild** — applies the revert (`1d249d5c`) AND the web-auth fix (`674a13c4`); container currently still runs with SELF-01 enabled and the broken chat page | Larry | PENDING — `docker compose up --build -d astridr` (astridr service only) |
| **/quality grid visual refresh** — the `personal` card (score 100, sparkline) after sign-in; the drill-in was already visually confirmed | Larry | PENDING |
| **E3 calibration labels** — fill the H-columns in 93-CALIBRATION.md, compute agreement vs judge, record the >=0.7 gate verdict | Larry | PENDING — **Quality trends are explicitly NOT trusted until this closes** |
| SELF-01 re-enable decision — the mirror only feeds the Quality page while `self_improvement.enabled: true`; currently reverted to false per Option A | Larry | OPEN (config/self-improvement.yaml documents the toggle) |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-bypass-closed | astridr-repo `channels/web.py` | Profile-scoped `/{p}/api/*` (chat POST, voice, SSE) previously bypassed auth_check entirely — unauthenticated chat on a tunnel-exposable port. Closed with bearer-or-cookie; pinned by tests. |
| threat_flag: new-auth-endpoint | astridr-repo `channels/web.py` | New `POST /auth/login` + `GET /auth/session`: constant-time key compare, random sha256-stored tokens, HttpOnly/SameSite=Strict/Secure-behind-tunnel cookie, rate-bucketed, boolean-only probe. Not in this plan's threat model (which predated the scope addition). |

## Deferred Issues

- `npm run dev` (codepulse) throws `__BUNDLED_DEV__ is not defined` from Vite 7's own HMR client — pre-existing, production build unaffected; logged for a future look.
- Judge persona attribution for build-time coding sessions is `unknown` (llmMetrics.agentId never joins claude-cli sessionIds) — the AI-SPEC's designed `unknown` bucket with observable `unknownCount`; a future phase could wire session->persona attribution.
- `cost_discipline` is non-discriminating on prod today (all sampled sessions show $0 — see 93-CALIBRATION.md gap #1); a rubric-v2 "cost data may be unavailable" note is a candidate, version-stamped per E5.

## Next Phase Readiness

Phase 93 is functionally complete pending the three human items above. Phase 94 (Trace Waterfall) and 95 (Hardening) are independent.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-06*

## Self-Check: PASSED

- `.planning/phases/93-eval-pipeline-quality-kpis/93-CALIBRATION.md` — FOUND (165 lines)
- `.planning/phases/93-eval-pipeline-quality-kpis/93-06-SUMMARY.md` — FOUND (this file)
- codepulse commit `04111c1` — FOUND
- astridr-repo commits `8afe5d6a`, `0ea12ef6`, `a9e183f1`, `34c885c6`, `24f07a18`, `1d249d5c`, `674a13c4` — ALL FOUND
- Prod verifications re-run this session: `evalScores` row `4e701b43…/personal/1.0` present; `listPersonaKpis` returns the personal card (currentMean 1, delta 1, 1-point sparkline); 3 `llm_judge` rows with rubricVersion v1 + judgeModel claude-haiku-4-5
