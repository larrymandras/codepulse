---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: 03
subsystem: voice, infra
tags: [onnxruntime-web, audioworklet, web-worker, wake-word, openWakeWord, vitest]

# Dependency graph
requires:
  - 92-01 (onnxruntime-web install, vite config, normalizeMelFrame, Worker/AudioWorklet mocks)
provides:
  - micCapture.worklet.ts: MicCaptureProcessor captures mic audio at 16kHz (w/ decimation fallback), posts 1280-sample frames to Worker port
  - wakeWordWorker.ts: 3-stage ONNX pipeline (melspectrogram → embedding → classifier) with mel normalization, threshold 0.5, cooldown 2000ms, exports processChunk for testing
  - useWakeWord.ts: main-thread orchestrator returning {status, errorReason, start, stop}; degrades to error-disabled on any failure; never throws; never leaves hot mic
  - 13 unit tests: 8 hook tests (wake/error/no-mic paths) + 5 worker tests (threshold/normalization/score paths)
affects:
  - 92-04 (VoiceModePanel turn loop consumes useWakeWord.start/stop/onWake)
  - 92-05 (MicToggle / DashboardLayout wire useWakeWord status + toggle)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AudioWorklet → Web Worker split (ONNX cannot run in AudioWorkletGlobalScope — Pitfall 2)
    - Runtime ONNX shape inspection via dummy inference at load (Pitfall 6 — no hardcoded dims)
    - Mel normalization (v/10)+2 via shared normalizeMelFrame util between stages 1 and 2
    - ort.env.wasm.numThreads=1 before any session creation (avoids COOP/COEP, single-thread WASM)
    - hey_astrid.onnx primary with hey_jarvis_v0.1.onnx fallback (logged which loaded)
    - Controllable Worker class pattern for jsdom unit tests (avoids vi.fn() constructor limitation)
    - ref-for-stable-callback lifecycle (onWakeRef) from useAudioEvents.ts analog

key-files:
  created:
    - src/worklets/micCapture.worklet.ts (AudioWorklet; no ONNX import; decimation fallback; zero-copy frame transfer)
    - src/workers/wakeWordWorker.ts (3-stage ONNX pipeline; normalizeMelFrame; exports processChunk/THRESHOLD/COOLDOWN_MS)
    - src/hooks/useWakeWord.ts (main-thread orchestrator; error-disabled on any failure; VOX-04)
    - src/hooks/useWakeWord.test.ts (8 tests: wake/error/onerror/getUserMedia-reject/never-throw/stop/idle paths)
    - src/workers/wakeWordWorker.test.ts (5 tests: threshold >= 0.5 fires wake, < 0.5 does not, normalizeMelFrame verified)
  modified: []

key-decisions:
  - "Runtime shape inspection via dummy inference at loadModels() — probes classifier seqLen by trying 16 then 22, avoids Pitfall 6 shape mismatch"
  - "zero-copy ArrayBuffer transfer in micCapture.worklet.ts — preserves real-time audio thread performance"
  - "Controllable Worker class (not vi.fn()) for hook tests — vitest does not support vi.fn().mockImplementation() as a constructor reliably"
  - "Worker port passed via MessageChannel not processorOptions worker port — the worklet port is in processorOptions, Worker's port1 is sent via a separate postMessage after Worker init completes"
  - "processChunk exported from wakeWordWorker.ts to enable direct unit testing without going through new Worker()"

# Metrics
duration: 10min
completed: 2026-06-25
---

# Phase 92 Plan 03: Wake-Word Engine Summary

**AudioWorklet mic capture + Web Worker 3-stage ONNX pipeline (melspectrogram → embedding → classifier) with mel normalization; useWakeWord degrades to error-disabled on any failure, never throws, never opens silent mic**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-25T00:08:57Z
- **Completed:** 2026-06-25T00:18:43Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments

**Task 1: AudioWorklet + Web Worker ONNX pipeline**
- `micCapture.worklet.ts`: `MicCaptureProcessor` class running in `AudioWorkletGlobalScope`. Buffers 1280 samples (80ms at 16kHz). Implements decimation fallback: if `AudioContext.sampleRate` differs from 16kHz (e.g. 48kHz on Windows), keeps every N-th sample where N = `round(sampleRate / 16000)`. Zero-copy frame transfer via `postMessage({ type:'frame', samples }, [buffer.buffer])`. No onnxruntime import (Pitfall 2 guard). Ends with `registerProcessor('mic-capture', MicCaptureProcessor)`.
- `wakeWordWorker.ts`: Three ONNX sessions loaded in order (melspectrogram → embedding → classifier). `ort.env.wasm.numThreads = 1` and `ort.env.wasm.wasmPaths = '/'` set before any `InferenceSession.create`. Runtime shape inspection: runs a dummy inference at load to extract `melBins`, `embDim`, and probes `classifierSeqLen` (tries 16 then 22). Mel normalization via `normalizeMelFrame` between Stages 1 and 2 (Pitfall 1). 76-frame mel sliding window (advance 8 per embedding run). 16-embedding circular buffer for classifier. `THRESHOLD=0.5`, `COOLDOWN_MS=2000`. Falls back from `hey_astrid.onnx` to `hey_jarvis_v0.1.onnx` with a console warning. Exports `processChunk`, `THRESHOLD`, `COOLDOWN_MS` for unit testing.

**Task 2: useWakeWord hook + tests**
- `useWakeWord.ts`: Main-thread orchestrator. `start()` negotiates mic via `getUserMedia` (16kHz ideal, channelCount:1, echoCancellation:true, with fallback to no-sampleRate constraint), creates `AudioContext` + `AudioWorkletNode('mic-capture')`, spins up Worker with 10s init timeout, connects mic source → worklet node. On Worker `{type:'wake'}`, calls `onWake()`. On ANY failure, calls `releaseResources()` (terminates Worker, closes AudioContext, stops ALL mic tracks) and sets `status:'error-disabled'` + `errorReason`. Never throws. `stop()` also calls `releaseResources()` and returns to `'idle'`. `useEffect` cleanup calls `releaseResources()` on unmount.
- `useWakeWord.test.ts` (8 tests, all GREEN): idle status; wake message → onWake called; Worker error → error-disabled + mic stopped; Worker onerror → error-disabled + mic stopped; getUserMedia rejection → error-disabled; never-throw; stop() releases; non-wake messages ignored.
- `wakeWordWorker.test.ts` (5 tests, all GREEN): processChunk returns 0 without init; normalizeMelFrame binding verified; THRESHOLD=0.5 / COOLDOWN_MS=2000 asserted; score >= 0.5 triggers wake postMessage; score < 0.5 does not.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | AudioWorklet mic capture + Web Worker ONNX pipeline | `7cf91fd` | src/worklets/micCapture.worklet.ts, src/workers/wakeWordWorker.ts |
| 2 | useWakeWord orchestrator hook + tests | `400241f` | src/hooks/useWakeWord.ts, src/hooks/useWakeWord.test.ts, src/workers/wakeWordWorker.test.ts |

## Deviations from Plan

**1. [Rule 1 - Enhancement] Runtime ONNX shape inspection via dummy inference**
- **Found during:** Task 1 implementation
- **Issue:** The plan says to inspect `session.inputNames` at load; tensor dims are only available after a run, not just from inputNames metadata
- **Fix:** Added a dummy inference call for melspectrogram (1280-sample zero tensor) and embedding (76xmelBins zero tensor) to extract actual output dims at load time; classifier seqLen probed by trying input shapes [1,16,embDim] then [1,22,embDim] — stops at first that succeeds
- **Files modified:** src/workers/wakeWordWorker.ts

**2. [Rule 3 - Testing] Controllable Worker class instead of vi.fn() constructor**
- **Found during:** Task 2 test writing
- **Issue:** vitest's `vi.fn().mockImplementation(factory)` does not reliably work as a `new Worker()` constructor — produces "is not a constructor" at runtime
- **Fix:** Used a plain function with `WorkerCtor.prototype = {}` as the Worker mock, with a controlled `triggerMessage`/`triggerError` API exposed on each instance
- **Files modified:** src/hooks/useWakeWord.test.ts

**3. [Rule 1 - Design] Worker port wiring via MessageChannel + separate postMessage**
- **Found during:** Task 2 implementation
- **Issue:** The plan proposes passing Worker's MessagePort via `processorOptions.workerPort` at AudioWorkletNode construction, but the Worker's `port1` must be transferred to the Worker first via a separate `postMessage`, while `port2` goes to the worklet's `processorOptions`
- **Fix:** After Worker init completes (ready received), create a `MessageChannel`, transfer `port1` to Worker via `postMessage({type:'port', port: workerPort}, [workerPort])`, and pass `port2` to AudioWorkletNode via `processorOptions.workerPort`. This is the correct sequence per Web Audio API spec.
- **Files modified:** src/hooks/useWakeWord.ts

## Known Stubs

None. The ONNX session fallback to `hey_jarvis_v0.1.onnx` is intentional and documented in `public/openwakeword/README.md` — it is not a stub but a development stand-in while `hey_astrid.onnx` is pending training. All code paths produce real behavior.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: mic-hot-on-failure-mitigated | src/hooks/useWakeWord.ts | All failure paths call releaseResources() which calls track.stop() on every mic track before setting error-disabled — T-92-07 mitigated |
| threat_flag: onnx-local-only-confirmed | src/workers/wakeWordWorker.ts | No external model fetch; all sessions created from baseUrl='/openwakeword' (first-party public/ directory) — T-92-08 mitigated |

## Self-Check: PASSED

All files found:
- FOUND: src/worklets/micCapture.worklet.ts
- FOUND: src/workers/wakeWordWorker.ts
- FOUND: src/hooks/useWakeWord.ts
- FOUND: src/hooks/useWakeWord.test.ts
- FOUND: src/workers/wakeWordWorker.test.ts
- FOUND: .planning/phases/92-voice-activated-command-palette-jarvis-mode/92-03-SUMMARY.md

Commits verified:
- 7cf91fd — feat(92-03): AudioWorklet mic capture + Web Worker ONNX pipeline
- 400241f — feat(92-03): useWakeWord orchestrator hook + tests (VOX-01, VOX-04)

No file deletions in commits. 13/13 tests GREEN. tsc --noEmit exits 0.
