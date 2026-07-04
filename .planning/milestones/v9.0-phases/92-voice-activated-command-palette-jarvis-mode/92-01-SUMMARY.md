---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: 01
subsystem: infra, testing, voice
tags: [onnxruntime-web, vite-plugin-static-copy, mel-normalization, openWakeWord, jsdom-mocks, vitest, wasm]

# Dependency graph
requires: []
provides:
  - onnxruntime-web installed and Vite configured with optimizeDeps.exclude + viteStaticCopy for correct WASM serving
  - normalizeMelFrame pure function (v/10)+2 with full unit tests — required by downstream wakeWordWorker.ts
  - jsdom global stubs for SpeechRecognition, Audio, Worker, AudioWorkletNode/addModule — enables all voice hook tests
  - hey_astrid.onnx training requirement documented in public/openwakeword/README.md; "hey jarvis" stand-in named
affects:
  - 92-02 (useTtsPlayback/useSpeechRecognition hooks use mel util and mocks)
  - 92-03 (wakeWordWorker.ts imports normalizeMelFrame; tests run under the Worker mock)
  - 92-04 (VoiceModePanel and MicToggle tests run under SpeechRecognition and Audio mocks)

# Tech tracking
tech-stack:
  added:
    - onnxruntime-web@^1.27.0 (Microsoft ONNX Runtime browser port; WASM backend)
    - vite-plugin-static-copy@^4.1.1 (WASM asset copy plugin for Vite build)
  patterns:
    - Vite optimizeDeps.exclude + viteStaticCopy to serve ONNX WASM without pre-bundling corruption (RESEARCH Pitfall 7)
    - Pure pure-function util in src/lib/ with co-located .test.ts (formatters.ts analog)
    - Guard-before-install pattern for jsdom stubs in setup.ts (only install if global is undefined)

key-files:
  created:
    - src/lib/melNormalize.ts (pure mel-normalization function; no ONNX import)
    - src/lib/melNormalize.test.ts (4 TDD behaviors; GREEN on all)
    - public/openwakeword/README.md (model inventory; hey_astrid.onnx PENDING; hey jarvis stand-in documented)
  modified:
    - vite.config.ts (added viteStaticCopy + optimizeDeps.exclude)
    - package.json (onnxruntime-web in dependencies; vite-plugin-static-copy in devDependencies)
    - src/test/setup.ts (added SpeechRecognition, Audio, Worker, AudioWorkletNode global stubs)

key-decisions:
  - "numThreads=1 avoids COOP/COEP requirement — single-thread WASM is sufficient for 80ms wake-word frames"
  - "Task 0 operator-approved: both packages slop-checked [OK]; hey_astrid.onnx pending training acknowledged"
  - "normalizeMelFrame is a standalone pure util (not inlined in Worker) so it can be independently unit-tested"
  - "jsdom stubs use guard pattern (only install if undefined) to avoid clobbering real jsdom implementations"

patterns-established:
  - "Pattern: vite.config.ts WASM exclusion via optimizeDeps.exclude + viteStaticCopy for any future onnxruntime-web consumers"
  - "Pattern: mel normalization as pure standalone util (not embedded in ONNX pipeline) for testability"
  - "Pattern: voice-browser-API stubs in setup.ts with undefined guard — safe to extend without resetting existing mocks"

requirements-completed: [VOX-01]

# Metrics
duration: 25min
completed: 2026-06-24
---

# Phase 92 Plan 01: Foundation Summary

**onnxruntime-web installed and Vite configured for correct WASM serving; normalizeMelFrame (v/10)+2 pure util unit-tested; jsdom voice-API global stubs added without regression**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-24T19:50:00Z
- **Completed:** 2026-06-24T20:15:00Z
- **Tasks:** 3 (+ Task 0 pre-approved)
- **Files modified:** 6

## Accomplishments

- `onnxruntime-web@^1.27.0` installed; `vite-plugin-static-copy@^4.1.1` added to devDependencies
- `vite.config.ts` extended with `viteStaticCopy` WASM target and `optimizeDeps.exclude: ['onnxruntime-web']` — prevents Vite pre-bundling from corrupting WASM binary path resolution (RESEARCH Pitfall 7)
- `normalizeMelFrame` pure function implementing the mandatory `(v / 10.0) + 2.0` transform — extracted as a standalone unit-testable util so the downstream Worker can import it without needing ONNX in scope
- 4 Vitest behaviors covering zero, positive, negative, Float32Array, and empty-input cases — all GREEN
- `src/test/setup.ts` extended with guarded global stubs for `SpeechRecognition`, `webkitSpeechRecognition`, `window.Audio`, `HTMLAudioElement.prototype.play`, `Worker`, `AudioWorkletNode`, and `AudioContext.prototype.audioWorklet.addModule` — full test suite (135 files) passes with no regression
- `public/openwakeword/README.md` updated: `hey_astrid.onnx` explicitly marked PENDING; `hey_jarvis_v0.1.onnx` named as the development/integration stand-in; VOX-01 live-detection QA gated on custom model training

## Task Commits

Each task committed atomically:

0. **Task 0: Package legitimacy gate** — OPERATOR PRE-APPROVED (no commit; checkpoint cleared by orchestrator)
1. **Task 1: Install onnxruntime-web + Vite config** — `15c46a8` (chore)
2. **Task 2 RED: Failing test for normalizeMelFrame** — `96fe2d8` (test)
3. **Task 2 GREEN: Implement normalizeMelFrame** — `9a09ed3` (feat)
4. **Task 3: jsdom voice mocks + README** — `0cc0543` (feat)

## Files Created/Modified

- `vite.config.ts` — added `viteStaticCopy` WASM target and `optimizeDeps.exclude: ['onnxruntime-web']`
- `package.json` / `package-lock.json` — onnxruntime-web dependency, vite-plugin-static-copy devDependency
- `src/lib/melNormalize.ts` — pure `normalizeMelFrame(frame: number[] | Float32Array): number[]`
- `src/lib/melNormalize.test.ts` — 4 TDD behavior tests (all GREEN)
- `src/test/setup.ts` — global stubs for SpeechRecognition, Audio, Worker, AudioWorkletNode
- `public/openwakeword/README.md` — model inventory with hey_astrid.onnx PENDING, hey jarvis stand-in noted

## Decisions Made

- **No COOP/COEP headers** — `ort.env.wasm.numThreads = 1` (set downstream in 92-03 wakeWordWorker.ts) avoids the `SharedArrayBuffer` requirement entirely; single-threaded WASM is sufficient for 80ms wake-word inference frames
- **Task 0 operator-approved** — both packages verified at npmjs.com (onnxruntime-web = Microsoft/onnxruntime [OK], vite-plugin-static-copy = sapphi-red [OK]); hey_astrid.onnx pending training acknowledged; all code/tests use "hey jarvis" stand-in
- **normalizeMelFrame as standalone pure util** — not embedded inline in the Worker — so it can be independently tested without mocking ONNX sessions; downstream Worker imports it via a clean module boundary

## Deviations from Plan

None — plan executed exactly as written. Task 0 was pre-approved at the orchestrator level per `<operator_checkpoint_cleared>` directive; no additional gate was needed.

## Issues Encountered

None. `npx tsc --noEmit` passed clean after Vite config changes. Full 135-file test suite had no regressions from the setup.ts additions.

## Known Stubs

None. This plan lays infrastructure (package install, Vite config, pure util, test mocks). No data flows, UI components, or render paths were introduced. `hey_astrid.onnx` is an external prerequisite, not a code stub — it is tracked in `public/openwakeword/README.md`.

## Threat Flags

None. The two new npm packages were operator-verified before install (T-92-SC mitigated). WASM serving via viteStaticCopy prevents the pre-bundling corruption vector (T-92-01 mitigated). No network endpoints, auth paths, or schema changes introduced.

## User Setup Required

**hey_astrid.onnx must be trained before VOX-01 live-detection QA sign-off.** See `public/openwakeword/README.md` for the Colab training procedure. All Phase 92 code and tests run against the bundled "hey jarvis" stand-in in the interim. No other external configuration is required.

## Next Phase Readiness

- 92-02 can proceed: `normalizeMelFrame` is importable; Audio and SpeechRecognition mocks are ready for `useTtsPlayback` and `useSpeechRecognition` hook tests
- 92-03 can proceed: Worker mock and ONNX exclude config are in place for `wakeWordWorker.ts` implementation
- 92-04 can proceed: all jsdom stubs needed for `VoiceModePanel` / `MicToggle` tests are installed

---
*Phase: 92-voice-activated-command-palette-jarvis-mode*
*Completed: 2026-06-24*
