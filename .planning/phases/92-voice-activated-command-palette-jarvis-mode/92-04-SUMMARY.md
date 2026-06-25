---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: "04"
subsystem: voice/palette
tags: [voice, state-machine, panel, tdd, turn-loop, feedback-guard, command-palette]
dependency_graph:
  requires:
    - "92-02 (useSpeechRecognition, useTtsPlayback)"
    - "92-03 (useWakeWord, wake-word engine)"
  provides:
    - "src/components/voice/voiceState.ts"
    - "src/components/voice/VoiceModePanel.tsx"
    - "src/components/CommandPalette.tsx"
    - "src/index.css"
  affects:
    - "92-05 (MicToggle/DashboardLayout passes voiceMode to CommandPalette)"
tech_stack:
  added: []
  patterns:
    - "TDD RED/GREEN for voiceState and VoiceModePanel"
    - "useReducer(voiceReducer) drives VoiceModePanel state"
    - "subscribeEvent multi-unsub cleanup (Chat.tsx analog)"
    - "Feedback guard via useEffect on isPlaying (T-92-10)"
    - "30s silence timeout (T-92-13)"
key_files:
  created:
    - src/components/voice/voiceState.ts
    - src/components/voice/voiceState.test.ts
    - src/components/voice/VoiceModePanel.tsx
    - src/components/voice/VoiceModePanel.test.tsx
  modified:
    - src/components/CommandPalette.tsx
    - src/index.css
decisions:
  - "Barge-in deferred -- pauses STT while isPlaying (RESEARCH Open Question 2)"
  - "run.tts session filter loosened when activeSessionRef=null"
  - "fireEvent used instead of user-event (not installed)"
metrics:
  duration: 15m
  completed: "2026-06-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 92 Plan 04: Voice Mode Panel + State Machine Summary

**One-liner:** Pure 6-state machine (idle/listening/transcribing/processing/speaking/error-disabled) drives VoiceModePanel inside existing CommandDialog -- continuous turn loop, live transcript, streamed reply, shared-hook TTS, feedback guard preventing self-transcription.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pure voice state machine + end-phrase detection | d7789f5 | voiceState.ts, voiceState.test.ts |
| 2 | VoiceModePanel turn loop + feedback guard + index.css | 917428c | VoiceModePanel.tsx, test.tsx, index.css |
| 3 | Wire VoiceModePanel into CommandPalette | 1b46feb | CommandPalette.tsx |

TDD RED gate commits: 7738d00 (voiceState), cd5685a (VoiceModePanel)

## What Was Built

### voiceState.ts

Pure state machine -- no React. voiceReducer(state, action) with 6 states and 7 action types.
isEndPhrase(text): case-insensitive match vs ["stop","goodbye","thanks","that's all"].
24 tests, all green.

### VoiceModePanel.tsx

Continuous turn loop rendered inside CommandDialog. Uses useReducer(voiceReducer).
- useSpeechRecognition({continuous:true, interimResults:true}) for live transcript
- On final transcript: isEndPhrase check; if end-phrase dispatch END+onClose, else sendCommand({type:"chat.send", message})
- subscribeEvent run.text appends chunks to replyText
- subscribeEvent run.tts calls useTtsPlayback.play(audio_url)
- Feedback guard: useEffect on isPlaying -- true->recognitionStop+TTS_START, false->recognitionStart+TTS_END
- 30s silence timeout cleared on each interim/final result
- aria-live assertive on state label; polite on transcript+reply
- Inline sub-components: VoiceStateBadge, VoiceTranscriptArea, VoiceReplyStream, VoiceWaveform
- 17 tests, all green

### CommandPalette.tsx (additive)

Extended props: voiceMode?, voiceState?, onVoiceClose?
When voiceMode=true: renders VoiceModePanel; when false: unchanged text search UI.

### index.css (additive)

Added: voice-listen-pulse keyframe, voice-listening-dot class, eq-bar-fast-* variants.
prefers-reduced-motion: disables dot pulse, static waveform bars, instant reply fade.

## Deviations

**[Rule 3 - Blocking] @testing-library/user-event not installed**
Fixed: replaced with fireEvent from @testing-library/react.

**[Rule 1 - Bug] TS narrowing error in VoiceWaveform**
Fixed: simplified if-chain eliminates unreachable branch.

**[Rule 1 - Bug] run.tts session filter blocked first event (activeSessionRef=null)**
Fixed: skip filter when activeSessionRef is null.

**Barge-in deferred** (documented): mic pauses while isPlaying; full interrupt deferred to follow-on.

## Known Stubs

None. All data flows fully wired.

## Threat Flags

None new. T-92-10/11/12/13 all mitigated in implementation.

## Self-Check: PASSED

- voiceState.ts: FOUND; 24/24 tests pass
- voiceState.test.ts: FOUND
- VoiceModePanel.tsx: FOUND; 17/17 tests pass
- VoiceModePanel.test.tsx: FOUND
- CommandPalette.tsx: FOUND (modified, VoiceModePanel count=5)
- index.css: FOUND (additive only)
- tsc --noEmit: 0 errors
- chat.send in panel: count=1
- useSpeechRecognition in panel: count=3
- useTtsPlayback in panel: count=3
- No inline SpeechRecognition/Audio: count=0

## TDD Gate Compliance

RED: 7738d00 (voiceState), cd5685a (VoiceModePanel)
GREEN: d7789f5 (voiceState), 917428c (VoiceModePanel)
REFACTOR: not needed -- code clean on first GREEN pass.
