# Phase 93 — Judge Calibration Reference Set (E3)

**Created:** 2026-07-06 (93-06 Task 3)
**Source:** 29 real completed sessions pulled from prod Convex (`tidy-whale-981`) via `getCandidateSessionsInternal` across 2026-07-04 → 2026-07-06; 12 selected to span the AI-SPEC Section 5 composition classes. Digests below are the EXACT text the judge sees — produced by the real `buildJudgeDigest` (convex/evalScores.ts) over the real prod `getJudgeDigestInternal` data, not re-derived.

**E3 gate (AI-SPEC Section 5):** judge `overall` must agree with Larry's hand labels at **>= 0.7 agreement/rank-correlation** before the Quality page's trends are trusted.

## Gate status

| Item | Status |
|---|---|
| Reference set pulled + digests frozen | DONE (12 sessions, below) |
| Judge scores on reference set | 3 of 12 (nightly cron will accrue the rest; or trigger `judgeSessionsAction` manually) |
| Human labels (Larry — sole labeler per AI-SPEC 1b) | **PENDING — labeling table below is empty by design; labels are never invented** |
| Judge-vs-human agreement computed | **PENDING (blocked on labels)** |
| **E3 >= 0.7 gate** | **NOT EVALUATED — labels pending** |

> **Verdict: trust the Quality trends? NO — not until Larry fills the labeling table and the agreement/rank-correlation is computed here and clears 0.7.** The pipeline (EVAL-01/02/03) is live-verified end-to-end (93-06 Task 2, D-04), but calibration of the judge itself is explicitly un-established. Reading the trend line as truth before this gate closes is exactly the E3 FAIL condition.

## Labeling instructions (Larry)

For each session: skim the digest (and the session in CodePulse `/sessions/:id` if the digest is ambiguous), then fill `H-overall` + the four `H-*` dimension columns with your own 0–1 scores. Score what the digest evidence supports — the judge only ever sees the digest, so if the digest hides the story, that is an E6 finding worth a note in the last column. When done, compute Spearman rank-correlation between `J-overall` and `H-overall` over the judged rows and record it in the Gate status table above.

## Reference set + labeling table

Classes: CLEAN (calibration high anchor), ERR (error-heavy, feeds E6), CHURN (tool-thrash, tests `tool_efficiency`), COST (expensive) — see "Known measurement gaps" for the COST class.

| # | Session | Class | Events | Errors | Judge J-overall | J-dims (tc/eh/te/cd) | H-overall | H-tc | H-eh | H-te | H-cd | Notes |
|---|---------|-------|--------|--------|-----------------|----------------------|-----------|------|------|------|------|-------|
| S1 | `d817e249-5d37` | CLEAN (0 err) | 200 | 0 | **0.25** | 0.3 / 0.5 / 0.2 / 1.0 | | | | | | **Divergence flag:** judge scored a zero-error session 0.25, citing "zero-token count raises questions whether the session executed" — the cost/LLM blindspot (see gaps) directly skewed this. Highest-value label. |
| S2 | `23c139ad-3467` | CLEAN | 200 | 0 | — | — | | | | | | Read-dominant exploration (133 Read / 30 Bash) |
| S3 | `8985225c-73f2` | CLEAN (small) | 11 | 0 | — | — | | | | | | Tiny 11-event session incl. AskUserQuestion — low-signal digest, good "does the judge abstain from over-penalizing brevity?" probe |
| S4 | `04bd84bc-95f0` | CLEAN (mid) | 45 | 0 | — | — | | | | | | Balanced edit session (11 Bash / 9 Edit / 5 Read) |
| S5 | `cc288673-7a83` | ERR | 200 | 9 | — | — | | | | | | Exit-255 git merge failures in global-legal-crisis; digest preserves failing tool `[Bash]` + error text (E6 check: does rationale cite it?) |
| S6 | `5a6ce787-18bc` | ERR | 200 | 10 | — | — | | | | | | Worktree "File does not exist" Read failures (gsd-executor agent) — E6: failing tool `[Read]` survives truncation |
| S7 | `9da9024c-75b2` | ERR | 58 | 3 | **0.55** | 0.6 / 0.4 / 0.65 / 1.0 | | | | | | `aws: command not found` (exit 127) + pandoc permission errors; judge rationale cited both correctly (E6 PASS spot-check 2026-07-06) |
| S8 | `92279b1c-bf1f` | ERR (mid) | 101 | 4 | — | — | | | | | | PowerShell exit-255s in astridr-repo; error text is mostly benign directory listings — probes whether the judge over-penalizes noisy-but-harmless errors |
| S9 | `5f0117d8-361b` | CHURN | 200 | 0 | — | — | | | | | | 96 Bash + 48 Read + 30 Grep, zero errors — pure churn-vs-throughput discrimination for `tool_efficiency` |
| S10 | `007183ad-1234` | CHURN | 200 | 0 | — | — | | | | | | 102 Bash / 54 Read — near-twin of S9 (consistency probe: near-identical digests should get near-identical scores) |
| S11 | `2ad92aa9-182f` | CHURN | 200 | 1 | **0.79** | 0.85 / 0.8 / 0.7 / 1.0 | | | | | | 122 Bash (61% of activity); judge docked `tool_efficiency` to 0.7 for "possible redundant shell operations" — plausible, needs the human check |
| S12 | `587b32e6-fca6` | CHURN+ERR | 200 | 2 | — | — | | | | | | 93 Bash / 21 Grep / 19 Edit with 2 minor Bash errors — mixed-class boundary case |

`tc` = task_completion, `eh` = error_handling, `te` = tool_efficiency, `cd` = cost_discipline. J-columns are the judge's stored `evalScores` rows (rubricVersion v1, judgeModel claude-haiku-4-5, 2026-07-06 batch). "—" = not yet judged; the nightly 05:00 UTC cron samples up to 3/persona/night, or run `npx convex run evalScores:judgeSessionsAction '{}' --prod` on days these sessions fall in the sampling window.

## Known measurement gaps (recorded honestly, per AI-SPEC "stated honestly, not invented")

1. **The COST composition class has ZERO representatives on prod.** Every candidate session (29/29) is a `claude-cli` build-time session whose `llmMetrics` join by `sessionId` is empty — `Cost: $0.0000 | LLM calls: 0` in every digest. `cost_discipline` therefore scores 1.0 on every session (zero discrimination), and worse, the missing cost data actively misled the judge on S1 (scored 0.25 partly for "zero tokens"). Until runtime sessions (with real `llmMetrics`) enter the sampling pool, or build-session cost attribution is wired, `cost_discipline` should be read as non-informative and the judge prompt may deserve a "cost data may be unavailable — do not penalize" note (rubric v2 candidate; version-stamp per E5 before changing).
2. **Judge `overall` is NOT the dimension mean** (S1: dims average 0.5, overall 0.25) — the judge weighs holistically. Fine per rubric, but labelers should score `H-overall` holistically too, not as an average.
3. **Persona attribution of these 12 sessions is `unknown`** — build-time coding sessions don't attribute to personal/business/consulting (`llmMetrics.agentId` join is empty). Calibration is unaffected (E3 measures judge-vs-human on sessions, not personas), but the per-persona trend lines will be fed mostly by the runtime `task_quality` mirror until session→persona attribution improves.

## E4 boundary pair designation

The E4 regression-detector boundary tests in `convex/evalScores.test.ts` (`evaluateRegression` describe block — the "does NOT fire on a 4-vs-6 comparison" and just-under-threshold cases) currently run on **synthetic score arrays, not recorded sessions** — deliberate, since the gate math is pure. From this reference set, the designated real boundary pair for a future fixture upgrade: **before-window = S2/S3/S4/S9 (4 sessions, clean/high), after-window = S5/S6/S7/S8/S12 + S1 (6 sessions, error-heavy/low)** — a real 4-vs-6 arrangement that must NOT fire (min-sample floor), and whose mean drop sits near the 0.15 threshold once judged.

## Fixture promotions into `convex/evalScores.test.ts`

- **Already promoted (as of 93-06):** none verbatim — the existing E1/E2/E4/E5 tests use synthetic fixtures (schema-shaped, not recorded), which the AI-SPEC permits until recorded outputs exist.
- **Designated for promotion once labeled:** S7 (`9da9024c`) — recorded judge output with real error citations, ideal E2 replay fixture; S1 (`d817e249`) — the divergence case, ideal "judge output that parses but is miscalibrated" documentation fixture; S9+S10 — the near-twin digest pair for a determinism/consistency fixture. Promotion = paste the frozen digest + recorded judge JSON from this doc's source data (scratchpad `digest-summary.json` regenerable via `getJudgeDigestInternal`) into `fixtures/judge-outputs/*.json` per AI-SPEC Section 5 CI notes.

## Frozen digests (exact judge input, `buildJudgeDigest` output)

### S1 — d817e249-5d37-4e23-bf10-b9ad1c137f66 (CLEAN, judged 0.25 — divergence)
```
Session: d817e249-5d37-4e23-bf10-b9ad1c137f66 | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 75, Read: 49, Edit: 39, PowerShell: 10, Grep: 8, Write: 5, SubagentStart: 3, SubagentStop: 3, Agent: 3, UserPromptSubmit: 2, Stop: 2, SessionStart: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S2 — 23c139ad-3467-4645-a006-5728b0a523c6 (CLEAN)
```
Session: 23c139ad-3467-4645-a006-5728b0a523c6 | status: completed | provider: claude-cli | model: claude-fable-5
Event count: 200
Tool/event activity: Read: 133, Bash: 30, Agent: 12, Grep: 9, SubagentStart: 6, PowerShell: 3, ToolSearch: 3, SessionStart: 2, UserPromptSubmit: 1, Stop: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S3 — 8985225c-73f2-4999-991c-b48da3523679 (CLEAN, small)
```
Session: 8985225c-73f2-4999-991c-b48da3523679 | status: completed | provider: claude-cli | model: unknown
Event count: 11
Tool/event activity: PowerShell: 3, Read: 2, Bash: 2, SessionStart: 1, UserPromptSubmit: 1, AskUserQuestion: 1, Stop: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S4 — 04bd84bc-95f0-4879-89c8-72058b8fa601 (CLEAN, mid)
```
Session: 04bd84bc-95f0-4879-89c8-72058b8fa601 | status: completed | provider: claude-cli | model: claude-fable-5
Event count: 45
Tool/event activity: Bash: 11, Edit: 9, PowerShell: 5, Read: 5, UserPromptSubmit: 3, Stop: 3, Grep: 3, Write: 2, SessionStart: 1, SubagentStart: 1, SubagentStop: 1, Agent: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S5 — cc288673-7a83-4271-88fe-3592e61e778c (ERR, 9 errors)
```
Session: cc288673-7a83-4271-88fe-3592e61e778c | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 96, Read: 50, Write: 10, TaskCreate: 6, SubagentStart: 6, Edit: 6, Agent: 5, Glob: 4, ToolSearch: 3, TaskUpdate: 3, UserPromptSubmit: 2, SubagentStop: 2, WebFetch: 2, Stop: 2, SessionStart: 1, SendMessage: 1, PowerShell: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (9): [Bash] {"cwd":"C:\\Users\\mandr\\global-legal-crisis","duration_ms":7973,...,"error":"Exit code 255\n...Merge made by the 'ort…" | [Read] {"agent_id":"aa46a94…" ...
```

### S6 — 5a6ce787-18bc-4601-8077-82ccaea54a94 (ERR, 10 errors)
```
Session: 5a6ce787-18bc-4601-8077-82ccaea54a94 | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 85, Read: 40, PowerShell: 28, Write: 12, Edit: 5, Grep: 5, UserPromptSubmit: 4, SubagentStart: 4, Agent: 4, Stop: 4, SubagentStop: 3, TaskStop: 2, SessionStart: 1, Glob: 1, ToolSearch: 1, AskUserQuestion: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (10): [Read] {"agent_id":"ac22c310b471f7643","agent_type":"gsd-executor","cwd":"...worktrees\\agent-ac22c310b471f7643",...,"error":"File does not exist. Note: your current working …" | [Bash] ...
```

### S7 — 9da9024c-75b2-4e44-92b9-c4211b08386b (ERR, judged 0.55)
```
Session: 9da9024c-75b2-4e44-92b9-c4211b08386b | status: completed | provider: claude-cli | model: claude-sonnet-5
Event count: 58
Tool/event activity: Bash: 19, Read: 11, UserPromptSubmit: 6, Stop: 6, SubagentStop: 6, Write: 4, AskUserQuestion: 3, SessionStart: 1, Skill: 1, Edit: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (3): [Bash] {"cwd":"C:\\Users\\mandr\\mission-control-aws",...,"error":"Exit code 127\n/usr/bin/bash: line 3: aws: command not found..." | [Bash] ...
```

### S8 — 92279b1c-bf1f-4d4d-b590-bc59596165d9 (ERR, mid)
```
Session: 92279b1c-bf1f-4d4d-b590-bc59596165d9 | status: completed | provider: claude-cli | model: claude-fable-5
Event count: 101
Tool/event activity: PowerShell: 40, Read: 16, Edit: 14, Grep: 13, Write: 8, UserPromptSubmit: 3, Stop: 3, SessionStart: 1, AskUserQuestion: 1, Glob: 1, Skill: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (4): [PowerShell] {"cwd":"C:\\Users\\mandr\\astridr-repo",...,"error":"Exit code 255\npre-v16.0-phases\r\n..." (benign directory listing in error text) | ...
```

### S9 — 5f0117d8-361b-4709-936c-1b46e8c3cf44 (CHURN)
```
Session: 5f0117d8-361b-4709-936c-1b46e8c3cf44 | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 96, Read: 48, Grep: 30, Edit: 12, Agent: 3, Write: 3, Glob: 3, SessionStart: 2, UserPromptSubmit: 1, SubagentStart: 1, Stop: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S10 — 007183ad-1234-46bf-a6a9-03f590186407 (CHURN, S9 near-twin)
```
Session: 007183ad-1234-46bf-a6a9-03f590186407 | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 102, Read: 54, Grep: 18, Edit: 12, Write: 6, Agent: 3, SessionStart: 2, UserPromptSubmit: 1, SubagentStart: 1, Stop: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
```

### S11 — 2ad92aa9-182f-4e6e-93c3-ec1c6e27d042 (CHURN, judged 0.79)
```
Session: 2ad92aa9-182f-4e6e-93c3-ec1c6e27d042 | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 122, Read: 45, Edit: 12, Grep: 9, UserPromptSubmit: 3, Agent: 3, SessionStart: 2, Stop: 2, SubagentStart: 1, SubagentStop: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (1): [Bash] {"cwd":"C:\\Users\\mandr\\astridr-repo",...,"error":"Exit code 1\n=== nyquist config ===..."}
```

### S12 — 587b32e6-fca6-4d0c-b7a8-a556a8f4755b (CHURN+ERR)
```
Session: 587b32e6-fca6-4d0c-b7a8-a556a8f4755b | status: completed | provider: claude-cli | model: unknown
Event count: 200
Tool/event activity: Bash: 93, Read: 47, Grep: 21, Edit: 19, Write: 5, UserPromptSubmit: 3, SubagentStart: 3, Agent: 3, Stop: 3, SubagentStop: 2, SessionStart: 1
Cost: $0.0000 | LLM calls: 0 | total tokens: 0
Errors (2): [Bash] {"cwd":"C:\\Users\\mandr\\astridr-repo",...,"error":"Exit code 2\n---STATE.md (head)---..." | [Bash] {"agent_id":"ae08b2c…"}
```

---
*E3 gate re-evaluation cadence: once now (before first trusting the Quality page), then monthly per AI-SPEC Section 5 E3 / Section 6 Offline flywheel.*
