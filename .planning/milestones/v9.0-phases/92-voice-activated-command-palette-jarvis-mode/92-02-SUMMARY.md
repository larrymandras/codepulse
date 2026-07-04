---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: "02"
subsystem: hooks/voice
tags: [voice, hooks, extraction, tts, speech-recognition, tdd]
dependency_graph:
  requires: []
  provides:
    - "src/hooks/useSpeechRecognition.ts — shared Web Speech API hook"
    - "src/hooks/useTtsPlayback.ts — shared TTS playback hook with isPlaying flag"
  affects:
    - "src/components/ChatInput.tsx — refactored to consume useSpeechRecognition"
    - "src/pages/Chat.tsx — refactored to consume useTtsPlayback"
tech_stack:
  added: []
  patterns:
    - "TDD (RED → GREEN) for each hook"
    - "vi.fn() function constructor mock for SpeechRecognition"
    - "HTMLAudioElement mock via vi.stubGlobal"
    - "useRef-for-stable-callbacks pattern to avoid stale closures"
key_files:
  created:
    - src/hooks/useSpeechRecognition.ts
    - src/hooks/useSpeechRecognition.test.ts
    - src/hooks/useTtsPlayback.ts
    - src/hooks/useTtsPlayback.test.ts
  modified:
    - src/components/ChatInput.tsx
    - src/pages/Chat.tsx
decisions:
  - "Guard start() to no-op when isListening (prevents Web Speech InvalidStateError)"
  - "ttsEnabled guard and sessionId routing remain in Chat.tsx (hook is transport-agnostic)"
  - "Callbacks stored in refs to avoid stale closure issues in useSpeechRecognition"
metrics:
  duration: "8m 20s"
  completed: "2026-06-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 92 Plan 02: Shared Voice Hooks Extraction Summary

**One-liner:** Extracted `useSpeechRecognition` (Web Speech API) and `useTtsPlayback` (TTS audio with `isPlaying` feedback-guard flag) from ChatInput and Chat into shared hooks, with ChatInput and Chat refactored to consume them — no duplicate logic remains.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extract useSpeechRecognition + refactor ChatInput | 1e6d5f5 | `useSpeechRecognition.ts`, `useSpeechRecognition.test.ts`, `ChatInput.tsx` |
| 2 | Extract useTtsPlayback + refactor Chat | e42bae2 | `useTtsPlayback.ts`, `useTtsPlayback.test.ts`, `Chat.tsx` |

TDD commits also created:
- 536a855: `test(92-02)`: failing tests for useSpeechRecognition (RED gate)
- 24ee43f: `test(92-02)`: failing tests for useTtsPlayback (RED gate)

## What Was Built

### `src/hooks/useSpeechRecognition.ts`

Shared hook extracted from `ChatInput.tsx` lines 16–170. Exports:
- `SpeechRecognitionEvent`, `SpeechRecognitionInstance` types (moved from ChatInput, now shared)
- `getSpeechRecognitionClass()` feature-detection helper
- `useSpeechRecognition(options)` — supports `continuous`, `interimResults`, `lang`, `onFinalResult`, `onInterimResult`, `onEnd`
- Returns `{ start, stop, abort, isListening, speechAvailable }`

Key behaviors: `start()` is a no-op when already listening (prevents `InvalidStateError`); callbacks stored in refs to avoid stale closures; `onerror` ignores `"aborted"` and `"no-speech"`; unmount cleanup via `abort()`.

**ChatInput refactor:** Deleted inline `declare global`, type declarations, `getSpeechRecognitionClass`, `recognitionRef`, `startListening`, `stopListening`, and the unmount cleanup `useEffect`. Replaced with `useSpeechRecognition({ continuous: false, interimResults: false, onFinalResult: handleVoiceResult })`.

### `src/hooks/useTtsPlayback.ts`

Shared hook extracted from `Chat.tsx` lines 21, 53–86, 262–264. Exports:
- `useTtsPlayback()` — returns `{ play, stop, isPlaying }`
- `play(url)`: normalizes relative URLs against `VITE_ASTRIDR_API_URL`; sets `isPlaying = true` before `audio.play()`; sets `isPlaying = false` in `audio.onended`
- `stop()`: pauses audio and sets `isPlaying = false`
- `isPlaying`: feedback-guard signal for 92-04 to pause STT recognition during TTS

**Chat refactor:** Deleted `ASTRIDR_API_URL` constant, `audioRef`, `playAudio` callback, URL normalization, and the unmount cleanup `useEffect`. Replaced with `const { play: playAudio, stop: stopAudio, isPlaying: ttsIsPlaying } = useTtsPlayback()`. The `ttsEnabled` guard and `session_id` routing remain in `Chat.tsx` (the hook is transport-agnostic).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock: vi.fn() arrow function is not a constructor**
- **Found during:** Task 1 TDD RED phase
- **Issue:** `const MockSpeechRecognitionClass = vi.fn(() => { ... })` — Vitest rejects calling an arrow-function mock with `new`. The error: "The vi.fn() mock did not use 'function' or 'class' in its implementation."
- **Fix:** Changed to `vi.fn(function MockSpeechRecognition(this: MockRecognition) { ... })` — a regular `function` declaration that can be used as a constructor via `new`.
- **Files modified:** `src/hooks/useSpeechRecognition.test.ts`
- **Commit:** Fixed inline before the GREEN commit (no separate commit; test was in the RED commit state)

None for useTtsPlayback — tests passed on first GREEN run.

## TDD Gate Compliance

| Gate | Hook | Commit |
|------|------|--------|
| RED | useSpeechRecognition | 536a855 |
| GREEN | useSpeechRecognition | 1e6d5f5 |
| RED | useTtsPlayback | 24ee43f |
| GREEN | useTtsPlayback | e42bae2 |

Both RED and GREEN gates exist for both hooks. REFACTOR was not needed — code was clean on first GREEN pass.

## Known Stubs

None. This plan is a pure extraction refactor — no new data sources, no placeholder values, no UI rendering. Both hooks are fully wired: `ChatInput.tsx` calls `useSpeechRecognition` and `Chat.tsx` calls `useTtsPlayback`.

## Threat Flags

None. The threat model entries T-92-03 (Web Speech API disclosure) and T-92-04 (audio URL normalization) were reviewed:
- T-92-03: No new exposure introduced — mic still only opens on explicit user action; same guard (`speechAvailable`) applies.
- T-92-04: URL normalization in `useTtsPlayback.play()` uses the same pattern as the original `Chat.tsx:262-264` — only prefixes `VITE_ASTRIDR_API_URL` to relative paths; absolute URLs pass through unchanged.

## Self-Check: PASSED

Files exist:
- `src/hooks/useSpeechRecognition.ts` ✓
- `src/hooks/useSpeechRecognition.test.ts` ✓
- `src/hooks/useTtsPlayback.ts` ✓
- `src/hooks/useTtsPlayback.test.ts` ✓

Commits exist:
- 536a855 ✓ (test RED useSpeechRecognition)
- 1e6d5f5 ✓ (feat GREEN useSpeechRecognition + ChatInput refactor)
- 24ee43f ✓ (test RED useTtsPlayback)
- e42bae2 ✓ (feat GREEN useTtsPlayback + Chat refactor)

Acceptance criteria:
- `npx vitest run src/hooks/useSpeechRecognition.test.ts src/hooks/useTtsPlayback.test.ts` — 14 tests pass ✓
- `ChatInput.tsx` imports `useSpeechRecognition`, no `webkitSpeechRecognition` or `declare global` ✓
- `Chat.tsx` imports `useTtsPlayback`, no `new Audio(...)` ✓
- `ttsEnabled` guard and `sessionId` routing remain in `Chat.tsx` ✓
- `useTtsPlayback` exposes `isPlaying` flag ✓
- `npx tsc --noEmit` exits 0 ✓
- Full test suite: 130 files pass, 0 failures ✓
