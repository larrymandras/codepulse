---
phase: 106-consolidation-hardening
plan: 07
subsystem: voice
tags: [uat, voice, wake-word, barge-in, tts, duplex, debt-04, no-code-change]

# Dependency graph
requires:
  - phase: 106-06
    provides: the `106-HUMAN-UAT.md` artifact and its tests 1-4 (UAT session A), whose numbering and expected/result/notes shape this plan continues
provides:
  - "tests 5-7 in 106-HUMAN-UAT.md — wake, barge-in, re-arm — each with a code-derived expected line and a live recorded result, all PASS"
  - "a verbatim captured voice lifecycle trace in `## Voice trace`, covering one continuous 16:16-16:20 session"
  - "a recorded capture-method finding: the browser console omits all `tts.audio.*` events, so COPY TRACE is authoritative and a console paste is not"
  - "a recorded, non-reproducing anomaly from an earlier attempt, with the hypothesis that was tested and refuted"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "judge an interruption on the media element's own currentTime-vs-duration, never on a self-reported latch flag"
    - "carry a within-session control: un-interrupted playbacks in the same run end at currentTime == duration, making 'cut' and 'finished' distinguishable by measurement rather than assertion"
    - "when a live observation contradicts the trace, verify the INSTRUMENT before concluding the system is broken"

key-files:
  created:
    - .planning/phases/106-consolidation-hardening/106-07-SUMMARY.md
  modified:
    - .planning/phases/106-consolidation-hardening/106-HUMAN-UAT.md

key-decisions:
  - "Accepted 'Thank you.' as the leg-3 end phrase instead of the scripted 'goodbye'. Both are in END_PHRASES (voiceState.ts:86) and it took the identical `final.end-phrase → graceful close` path, so the branch under test was genuinely exercised. Recorded rather than re-run."
  - "Did NOT count the unexplained 15:57 anomaly as an issue in `## Summary`. Every leg of the recorded session passed and the anomaly did not reproduce across a full 4.5-minute run; inflating the issue count on a non-reproducing observation would misrepresent the result. Recorded in full under `## Voice trace` instead."
  - "Wrote tests 5-7's results from the orchestrator rather than re-dispatching an executor, after the plan's subagents were stopped mid-session. The live result existed only in conversation and would have been lost; the edit is artifact-only and the plan's no-source-change gate was re-asserted after writing."
  - "Task 3 executed as a documented no-op. Its action block branches on 'if any leg failed'; none did, so there is no root cause to route to gap closure and no `/gsd-plan-phase 106 --gaps` entry was created."

patterns-established:
  - "A UAT result that rests on a flag the codebase itself documents as unreliable is not a result. Name the real observable in the expected line BEFORE the session, so the evidence recorded afterwards is the right kind."

requirements-completed: []

# Metrics
duration: ~70min
completed: 2026-08-05
---

# Phase 106 Plan 07: Voice UAT (Session B) Summary

Ran the complete "Hey Ástríðr" wake → "stop" barge-in → re-arm sequence live in one continuous session. **All three legs PASS.** This is the first time DEBT-04's full sequence has been exercised end to end in a single pass — STATE.md recorded it as never having been done, and the 2026-07-27 check covered only a basic speech→tool→speech round trip.

Zero source files were modified.

## What Shipped

### Task 1 — stack proven live, tracing proven emitting, tests staged (`c5745559`)

Both halves of the stack were measured, not relayed:

| Check | Result |
|---|---|
| Dev server `:5173` | HTTP 200 on **all three** of `localhost`, `127.0.0.1`, `[::1]` |
| Ástríðr authenticated `GET /api/agents` | **200** with the app's own `authHeaders()` |
| Unauthenticated control, same route | **401** |
| Convex target | `wss://lmofficenew.tail5bb6b3.ts.net/api/1.42.1/sync`, captured from the page's own websocket |
| Voice tracing | Already `VOICE_DEBUG = true` in source (`useAstridrVoice.ts:128`) — no edit needed — and proven emitting with a verbatim captured line |

The unauthenticated control matters: a 200 alone would not have distinguished a working auth path from a route that ignores auth. T-106-25 is mitigated by measurement, not assumption.

Two findings from Task 1 changed how the session had to be run:

1. **The session must run at `http://localhost:5173`.** That origin is in Ástríðr's CORS allowlist (preflight 200 + ACAO); `http://lmofficenew.tail5bb6b3.ts.net:5173` is **not**, and would have failed every `/api/*` call for reasons unrelated to voice.
2. **Ástríðr's 401s carry no `access-control-allow-origin`**, so an auth failure surfaces in the browser as "blocked by CORS policy". Recorded so a mid-session CORS error is read as a 401 first.

Tests 5-7 were staged with expected lines derived from source, each naming real identifiers with `file:line`. Test 6's expected line was written specifically to name the media-element observable and to state that a `barged` flag is not accepted as evidence.

### Task 2 — the live session (`88945325`)

One continuous session, 16:16:12 → 16:20:53.

**Leg 1 — wake: PASS.** Three detections, no click required:

| Time | Score | Followed by |
|---|---|---|
| 16:17:02.613 | 0.564 | `wake → conversation open` + `recognizer.start {trigger:"wake"}` |
| 16:17:46.933 | 0.639 | same, then transcribed a full spoken question |
| 16:20:02.774 | 0.332 | same, opened a fresh turn after a graceful close |

`recognizer.start` is the browser's real `onstart` (wired in `useSpeechRecognition.ts` for exactly this reason), so it proves the recognizer *began*, not merely that `start()` was called. No `wake.ignored` occurred at any point.

**Leg 2 — barge-in: PASS, on the media element.** Saying "stop" 0.6 s into a 10.82 s reply produced this, all within the same millisecond:

```
16:18:06.148 onresult {"isFinal":false,"text":" stop","state":"speaking"}
16:18:06.148 interim.barge-in {"text":" stop"}
16:18:06.148 barge-in.fired
16:18:06.148 tts.audio.stop.called {"reason":"interrupt:barge-in","currentTime":4.47,"duration":10.82,"paused":false,"ended":false}
16:18:06.148 tts.audio.teardown {"cause":"stop:interrupt:barge-in","currentTime":4.47,"duration":10.82}
```

**Playback was cut at 4.47 s of 10.82 s — 41 % through.** That is precisely the pair `useTtsPlayback.ts:63-64` names as decisive: *"currentTime far below duration on a teardown means playback was CUT, whatever the cause claims."*

The session supplies its own control: three *un*-interrupted replies terminate `tts.audio.ended` at `currentTime == duration` (6.04/6.04, 2.18/2.18, 5.9/5.9). "Cut" and "finished" are therefore distinguishable by measurement within the same run, not by assertion.

`tts.end {barged:true}` was also emitted but is **not** what this result rests on, per the 2026-07-30 lesson.

The self-answering loop did not occur: `final.barge-swallowed {"text":"Sta."}` at 16:18:06.561.

**Leg 3 — re-arm: PASS.** Exercised with "Thank you.", an `END_PHRASES` member (`voiceState.ts:86`) — note "stop" is deliberately excluded from that list and correctly behaved as a barge-in in leg 2 rather than a close.

```
16:19:40.740 final.end-phrase → graceful close {"text":"Thank you."}
16:19:40.740 flushSend {"message":"Thank you.","closing":true}
16:19:46.914 tts.audio.ended {"playbackId":3,"currentTime":2.18,"duration":2.18}
16:19:46.952 close.graceful → re-arm after her goodbye
16:19:46.953 conversation.teardown {"mode":"stop"}
16:20:02.774 wake.worker.wake-detected {"score":0.332}   <- fresh turn
```

The second wake carried a complete new question through transcription, `flushSend`, and a spoken answer. **The cycle is repeatable, not one-shot.**

Her own TTS echo was rejected twice on the way through, so she never answered herself: `interim.ignored-while-speaking {" you're"/" you're welcome"}` during playback, then `final.noise-rejected {" you're welcome", confidence:0.748}` once state returned to `idle`.

### Task 3 — no-op, documented

The action block branches on "if any leg failed". None did. There is no root cause to write and no gap routed to `/gsd-plan-phase 106 --gaps`. Recorded as a deliberate no-op rather than silently skipped.

## Findings Worth Carrying Forward

### 1. The console omits the evidence this test depends on

`ttsTrace` (`useTtsPlayback.ts:53-82`) pushes to the shared `window.__astridrVoiceTrace` ring buffer but **never calls `console.log`** — unlike `trace()` (`useAstridrVoice.ts:138-146`), which does both. A console-copied trace therefore contains **zero** `tts.audio.*` events, i.e. exactly the media-element evidence leg 2 rests on.

This caused a real mid-session error: an intermediate reading of one console paste concluded there was an instrumentation gap in duplex mode. **There is none.** The instrumentation was working perfectly; the view was incomplete. **COPY TRACE is authoritative; a console paste is not.**

### 2. The interim/final split is load-bearing, and demonstrably so

Barge-in fired on the interim `" stop"`. The final arrived 412 ms later, garbled as `"Sta."`. A final-only implementation would have missed this barge-in entirely — the 2026-07-20 fix visibly earning its keep in a live run rather than in principle.

### 3. Unexplained, non-reproducing anomaly (recorded, not chased)

An earlier attempt at 15:57 produced a trace with a 13-second hole: `wake.status {"to":"ready"}` followed directly by `run.tts.received` with `{"sessionMatches":false,"activeSession":null}` and `tts.start {"state":"idle"}` — **zero** wake, conversation-open or recognizer events — while Larry reported the header *had* flipped to `IN CONVERSATION` and that he had asked by voice. The audio ran to completion (`9.2 == 9.2`) and "stop" did nothing, consistent with no recognizer running.

A multi-tab explanation was hypothesised (a second tab holding no session receiving the broadcast TTS — the `188-09-14` false-alarm shape) and **refuted**: one tab only. The 500-entry ring buffer was ruled out (14 entries used; no eviction possible). It did not reproduce across the full 16:16-16:20 session.

Recorded as an open anomaly rather than pursued, per the plan's own two-attempts rule and this subsystem's documented cost for blind reasoning.

## Deviations from Plan

### 1. [Scripted phrase] "Thank you." instead of "goodbye"

- **Issue:** The plan scripts "goodbye" for leg 3.
- **Why accepted:** Both are `END_PHRASES` members and the trace shows the identical `final.end-phrase → graceful close` path, so the branch under test was genuinely exercised. Re-running for the literal word would have measured nothing new.
- **Recorded** rather than corrected.

### 2. [Observation, not defect] `recognizer.start {state:"listening"}` on the third wake

The 16:20:02 wake logged `state:"listening"` rather than the expected `state:"idle"`. The prior turn had fully torn down 16 s earlier, the wake and the fresh turn both worked, and nothing downstream misbehaved. Recorded as an observation.

### 3. [Process] Results written by the orchestrator, not an executor

The plan's subagents were stopped mid-session. The live results existed only in conversation and would have been lost. The orchestrator wrote tests 5-7, `## Voice trace`, `## Summary` and the `## Current Test` marker directly, then re-asserted the no-source-change gate.

## Threat Model

| ID | Disposition |
|---|---|
| T-106-23 (bearer token disclosure) | Mitigated. Only the fact that an Authorization header was sent and the resulting status were recorded. No token value appears in the artifact or transcript. |
| T-106-24 (transcribed speech in a committed file) | Mitigated. Test prompts were benign by design; the captured trace was reviewed and contained no personal content, so nothing required `<redacted>`. Event ordering left intact. |
| T-106-25 (a 401 presenting as a voice failure) | Mitigated by measurement — authenticated `/api/agents` → 200 against an unauthenticated control → 401, recorded before any voice test. Also recorded that Ástríðr's 401s lack ACAO and therefore surface as CORS errors. |
| T-106-26 (speculative same-session patching) | Mitigated. `git diff --quiet -- src/hooks src/pages/Chat.tsx` passes; `git status --porcelain src convex` shows no file owned by this plan. |
| T-106-SC (package installs) | Nothing installed. |

## Verification

| Gate | Result |
|---|---|
| Blank `result:` lines in `106-HUMAN-UAT.md` | **0** |
| `### N.` test sections | **7** (≥7 required) |
| `## Voice trace` populated | Yes — verbatim, not summarised |
| `## Summary` reconciles | 7 total / 7 passed / 0 issues / 0 pending |
| Frontmatter `status:` | `in-progress` (plan 106-08 closes this file) |
| Frontmatter `updated:` | refreshed to `2026-08-05T16:25:00Z` |
| `git diff --quiet -- src/hooks src/pages/Chat.tsx` | **passes** |
| Credential values in artifact | none |

## Known Stubs

None.

## Deferred Issues

The 15:57 anomaly above — recorded, not reproducing, not counted as an issue.
