---
phase: 92-voice-activated-command-palette-jarvis-mode
verified: 2026-06-24T21:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Speaking the wake word ('Hey Astrid' or 'Hey Jarvis' stand-in) opens the palette in listening mode"
    expected: "Within ~1s of speaking the wake phrase, CommandPalette opens with VoiceModePanel visible (listening state badge, transcript area, close button)"
    why_human: "Requires real mic + live ONNX inference in AudioWorklet/Worker — not reproducible in jsdom. The hey_astrid.onnx model is also PENDING training; this must be re-validated once the custom model is in public/openwakeword/."
  - test: "Spoken command transcribes live and fires chat.send"
    expected: "Interim transcript updates in the palette as the operator speaks; on silence the final text appears, then sendCommand({type:'chat.send', message}) fires over the AstridrWSContext WS."
    why_human: "Web Speech API requires real audio input — cannot simulate in jsdom."
  - test: "Streamed reply renders in the palette and TTS auto-plays in the persona voice"
    expected: "run.text chunks append to the ASTRIDHR reply stream visible in VoiceModePanel; run.tts audio_url auto-plays audibly once in Astridhr's ElevenLabs voice via useTtsPlayback (same hook used by Chat.tsx)."
    why_human: "Audible TTS and live WebSocket stream require a running Astridhr backend."
  - test: "Feedback guard: recognition paused during TTS playback"
    expected: "While useTtsPlayback.isPlaying is true, the speech recognition is paused (Astridhr's reply is not re-transcribed and looped back as a command)."
    why_human: "Acoustic self-transcription is only observable with real mic + real audio output playing simultaneously."
  - test: "Graceful degradation on model load failure"
    expected: "Rename/remove melspectrogram.onnx or hey_astrid.onnx, reload the app. MicToggle shows MicOff icon, is disabled with opacity-40, tooltip shows the error reason. No crash, no silent always-on mic."
    why_human: "Requires forcing a real onnxruntime/model load failure in a browser context — not injectable in jsdom."
  - test: "Toggle OFF by default; persistence across reload"
    expected: "Fresh load: voiceModeEnabled=false, MicToggle shows Mic icon (OFF state), no ListeningIndicatorPill visible. Enable toggle, reload — voiceModeEnabled=true restored from localStorage ('codepulse-voice-mode'), engine starts, pill appears."
    why_human: "localStorage persistence across page reload needs a real browser."
  - test: "⌘K coexistence: keyboard shortcut still opens text mode"
    expected: "While voice mode is enabled, pressing Cmd+K (or Ctrl+K) opens the palette in text mode (CommandInput + CommandList, not VoiceModePanel). The voiceMode flag is explicitly false on the keyboard path."
    why_human: "Keyboard interaction requires a browser runtime."
  - test: "Continuous conversation: after Astridhr reply, next turn starts without re-waking"
    expected: "After TTS ends (isPlaying flips false), the feedback guard restarts speech recognition. The operator can speak the next command without saying the wake phrase again. 'stop' or 'goodbye' exits voice mode."
    why_human: "Requires the full live audio loop — TTS playback + microphone input — running in a browser."
---

# Phase 92: Voice-Activated Command Palette (Jarvis Mode) — Verification Report

**Phase Goal:** An operator can summon Astridhr hands-free from anywhere in CodePulse by speaking a wake word, speak a command, and hear the streamed reply in a Norse persona voice — entirely through the existing command palette and WebSocket `chat.send` path, with zero Astridhr backend changes.
**Verified:** 2026-06-24T21:00:00Z
**Status:** human_needed — all automated checks pass; 8 items require live browser/audio verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Wake word opens the palette in listening mode via local ONNX in Worker/AudioWorklet; ⌘K coexists | VERIFIED (automated portion) / NEEDS HUMAN (live detection) | `useWakeWord` in `DashboardLayout.tsx:578-584` calls `onWake: () => { setPaletteOpen(true); setVoiceMode(true); }`. Worker (`wakeWordWorker.ts`) runs full 3-stage ONNX pipeline (mel→embedding→classifier); AudioWorklet (`micCapture.worklet.ts`) captures frames. `⌘K` path at line 605 sets `setVoiceMode(false)`, ensuring text mode. Test coverage: 8+5 tests green. Live detection = MANUAL (custom hey_astrid.onnx PENDING). |
| 2 | Spoken command transcribed via reused Web Speech hook, shown as live transcript, sent via `sendCommand({type:'chat.send'})` over existing WS — no new transport | VERIFIED (code + unit tests) | `VoiceModePanel.tsx:236` calls `sendCommand({ type: "chat.send", message: text })`. `useSpeechRecognition` (extracted from ChatInput) provides live transcript with `continuous:true, interimResults:true`. ChatInput still imports `useSpeechRecognition` — no duplicate Web Speech logic. 17 VoiceModePanel tests green including `sendCommand` assertion. |
| 3 | Streamed reply renders in palette (`run.text`); `run.tts` auto-plays via shared `useTtsPlayback`; Chat and palette share one playback path; no CodePulse voice config | VERIFIED (code + unit tests) | `VoiceModePanel.tsx:300-345` subscribes to `run.text`, `run.tts`, `run.completed`. Line 331 calls `ttsPlay(data.audio_url)`. `Chat.tsx:51` also consumes `useTtsPlayback()` — verified no `new Audio()` in Chat.tsx directly. `useTtsPlayback` normalizes relative URLs internally. 6 useTtsPlayback tests green. |
| 4 | Voice mode is privacy-honest: OFF by default, explicit toggle, persistent listening indicator, graceful ONNX failure degradation | VERIFIED (code + unit tests) | `voiceModeEnabled` initializes from `localStorage.getItem("codepulse-voice-mode") ?? "false"` (line 543). `start()` gated on `voiceModeEnabled && wakeWordStatus !== 'error-disabled'` (line 589). `ListeningIndicatorPill` guarded: `voiceModeEnabled && wakeWordStatus === 'ready'` (line 730). `useWakeWord` catches all failures → `status:'error-disabled'` + mic tracks stopped (no hot mic). `MicToggle` shows `MicOff + disabled` on `error-disabled`. 11 MicToggle tests + 8 useWakeWord tests green. |

**Score:** 4/4 success criteria verified at the code/unit-test level. Live browser checks are the only open items (see Human Verification Required below).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vite.config.ts` | `viteStaticCopy` + `optimizeDeps.exclude` for ONNX WASM | VERIFIED | Line 5: `import { viteStaticCopy }`, lines 11-21: target `*.wasm`, `exclude: ['onnxruntime-web']` |
| `src/lib/melNormalize.ts` | Pure `(v/10)+2` function, exported | VERIFIED | 16 lines; exports `normalizeMelFrame`; no ONNX import; 4 tests green |
| `src/test/setup.ts` | Worker / AudioWorklet / SpeechRecognition / Audio mocks | VERIFIED | Lines 10-83: all four mock families present |
| `public/openwakeword/README.md` | hey_astrid.onnx PENDING; hey_jarvis stand-in documented | VERIFIED | Line 12: "PENDING — train in Colab before VOX-01 QA sign-off" |
| `src/hooks/useSpeechRecognition.ts` | Shared Web Speech hook; extracted from ChatInput | VERIFIED | 169 lines; exports `useSpeechRecognition`; 8 tests green |
| `src/hooks/useTtsPlayback.ts` | Shared TTS hook with `isPlaying`; extracted from Chat | VERIFIED | 81 lines; exports `useTtsPlayback` with `isPlaying`; 6 tests green |
| `src/components/ChatInput.tsx` | Consumes `useSpeechRecognition`; no inline Web Speech setup | VERIFIED | Line 16: `import { useSpeechRecognition }`. No `declare global`/`webkitSpeechRecognition` in file. |
| `src/pages/Chat.tsx` | Consumes `useTtsPlayback`; no `new Audio()` directly | VERIFIED | Line 13: `import { useTtsPlayback }`. No `new Audio(` in Chat.tsx. |
| `src/worklets/micCapture.worklet.ts` | AudioWorklet; `registerProcessor`; NO onnxruntime import | VERIFIED | 97 lines; ends with `registerProcessor('mic-capture', MicCaptureProcessor)`. Zero onnxruntime imports. |
| `src/workers/wakeWordWorker.ts` | Web Worker; `numThreads=1`; imports `normalizeMelFrame`; 3-stage pipeline | VERIFIED | Line 34: `ort.env.wasm.numThreads = 1`; line 29: `import { normalizeMelFrame }`; full pipeline implemented; `THRESHOLD=0.5`, `COOLDOWN_MS=2000`; 5 tests green |
| `src/components/voice/voiceState.ts` | Pure 6-state machine; `voiceReducer`; `isEndPhrase` | VERIFIED | 91 lines; no React imports; exports `voiceReducer`, `isEndPhrase`, `VoiceState`; 24 tests green covering all transitions + end phrases |
| `src/components/voice/VoiceModePanel.tsx` | Turn loop, transcript, reply stream, feedback guard, chat.send | VERIFIED | 433 lines; uses `useSpeechRecognition` + `useTtsPlayback`; `sendCommand({type:'chat.send'})` at line 236; feedback guard at lines 281-294; silence timeout at line 193; 17 tests green |
| `src/components/CommandPalette.tsx` | `voiceMode` prop; renders `VoiceModePanel` conditionally | VERIFIED | Lines 86-90: `voiceMode?`, `voiceState?`, `onVoiceClose?` props; line 112-119: conditional `<VoiceModePanel>` render |
| `src/components/MicToggle.tsx` | Three-state toggle (OFF/ON/DISABLED) with tooltip | VERIFIED | 95 lines; three icon states (Mic/MicVocal/MicOff); `disabled` attribute on error-disabled; shadcn Tooltip with 3 tooltip strings; 11 tests green |
| `src/components/ListeningIndicatorPill.tsx` | "VOICE ACTIVE" pill with aria-live | VERIFIED | 43 lines; renders "VOICE ACTIVE" text; `aria-live="polite"` sr-only span |
| `src/layouts/DashboardLayout.tsx` | `useWakeWord` wired; toggle + pill in header; OFF-by-default persistence | VERIFIED | `useWakeWord` at line 578; `codepulse-voice-mode` localStorage read (line 543) + write (line 737); `MicToggle` + guarded `ListeningIndicatorPill` at lines 730-739; voiceMode props to CommandPalette at lines 775-779 |
| `public/openwakeword/` | ONNX model files present | VERIFIED (2 of 3) | `melspectrogram.onnx` + `embedding_model.onnx` + `hey_jarvis_v0.1.onnx` present. `hey_astrid.onnx` = PENDING (acknowledged, documented, not a defect). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vite.config.ts` | `onnxruntime-web/dist/*.wasm` | `viteStaticCopy` target | WIRED | Line 14: `src: "node_modules/onnxruntime-web/dist/*.wasm"` |
| `src/workers/wakeWordWorker.ts` | `src/lib/melNormalize.ts` | `import normalizeMelFrame` | WIRED | Line 29; applied at line 158 within `processChunk()` |
| `src/hooks/useWakeWord.ts` | `src/workers/wakeWordWorker.ts` | `new Worker(new URL('../workers/wakeWordWorker.ts', ...))` | WIRED | Line 118-120 |
| `src/hooks/useWakeWord.ts` | `src/worklets/micCapture.worklet.ts` | `audioCtx.audioWorklet.addModule(...)` | WIRED | Line 178 |
| `src/components/ChatInput.tsx` | `src/hooks/useSpeechRecognition.ts` | `useSpeechRecognition({ continuous: false, ... })` | WIRED | Line 64 |
| `src/pages/Chat.tsx` | `src/hooks/useTtsPlayback.ts` | `useTtsPlayback()` | WIRED | Line 51 |
| `src/components/voice/VoiceModePanel.tsx` | `src/contexts/AstridrWSContext` | `sendCommand({type:'chat.send'})` + `subscribeEvent(run.text/run.tts/...)` | WIRED | Lines 169, 236, 300-346 |
| `src/components/voice/VoiceModePanel.tsx` | `src/hooks/useTtsPlayback.ts` | `useTtsPlayback().play + isPlaying feedback guard` | WIRED | Lines 272, 282-293 |
| `src/components/voice/VoiceModePanel.tsx` | `src/hooks/useSpeechRecognition.ts` | `useSpeechRecognition({ continuous:true, interimResults:true })` | WIRED | Line 262 |
| `src/layouts/DashboardLayout.tsx` | `src/hooks/useWakeWord.ts` | `useWakeWord({ baseUrl:'/openwakeword', onWake })` | WIRED | Line 578 |
| `src/layouts/DashboardLayout.tsx` | `src/components/CommandPalette.tsx` | `voiceMode/voiceState/onVoiceClose` props | WIRED | Lines 775-779 |
| `src/layouts/DashboardLayout.tsx` | `localStorage` | `"codepulse-voice-mode"` key read + write | WIRED | Lines 543, 737 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `VoiceModePanel.tsx` | `replyText` | `subscribeEvent("run.text")` → `setReplyText(prev => prev + chunk)` | Yes — live WS event data | VERIFIED (code); MANUAL for live stream |
| `VoiceModePanel.tsx` | `interimText` / `finalText` | `useSpeechRecognition` callbacks → `setInterimText` / `setFinalText` | Yes — real Web Speech API | VERIFIED (code); MANUAL for live audio |
| `VoiceModePanel.tsx` | TTS playback | `subscribeEvent("run.tts")` → `ttsPlay(data.audio_url)` → `useTtsPlayback` → `new Audio(fullUrl).play()` | Yes — real audio URL from backend | VERIFIED (code); MANUAL for live audio |
| `DashboardLayout.tsx` | `wakeWordStatus` | `useWakeWord()` → Worker ONNX pipeline → `status:'ready'` or `'error-disabled'` | Yes — real Worker/ONNX state | VERIFIED (code); MANUAL for live ONNX |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for live wake detection / TTS (requires running browser + mic + backend — not testable as a 10s command). All logic-level behaviors exercised by the 83-test suite below.

---

### Probe Execution

Step 7c: No probe scripts declared or found for this phase. SKIPPED.

---

### Phase 92 Test Suite

All 83 phase-specific tests pass when run directly (scoped to avoid the known broken pages from Phase 89 WIP).

| Test File | Tests | Result |
|-----------|-------|--------|
| `src/lib/melNormalize.test.ts` | 4 | PASS |
| `src/hooks/useSpeechRecognition.test.ts` | 8 | PASS |
| `src/hooks/useTtsPlayback.test.ts` | 6 | PASS |
| `src/hooks/useWakeWord.test.ts` | 8 | PASS |
| `src/workers/wakeWordWorker.test.ts` | 5 | PASS |
| `src/components/voice/voiceState.test.ts` | 24 | PASS |
| `src/components/voice/VoiceModePanel.test.tsx` | 17 | PASS |
| `src/components/MicToggle.test.tsx` | 11 | PASS |
| **Total** | **83** | **ALL PASS** |

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| VOX-01 | 92-01, 92-03, 92-05 | Local in-browser wake detection via ONNX Worker/AudioWorklet; hey_astrid.onnx trained first | SATISFIED (code) / MANUAL (live detection) | Worker + worklet + useWakeWord + DashboardLayout wiring all verified. hey_astrid.onnx PENDING (acknowledged, documented). |
| VOX-02 | 92-02, 92-04 | Web Speech transcription reused from ChatInput; live transcript; chat.send over existing WS | SATISFIED | `useSpeechRecognition` extracted; ChatInput refactored; VoiceModePanel sends `chat.send`. |
| VOX-03 | 92-02, 92-04 | Streamed reply in palette; run.tts auto-plays via shared `useTtsPlayback`; no duplicate logic | SATISFIED | `useTtsPlayback` extracted; Chat.tsx + VoiceModePanel both consume it; no `new Audio()` in Chat directly. |
| VOX-04 | 92-03, 92-05 | OFF by default; persistent toggle; visible indicator; ONNX failure → disabled state, no crash, no hot mic | SATISFIED (code) / MANUAL (failure path) | localStorage default false; `start()` gated; `error-disabled` path catches all failures and stops mic tracks; MicToggle shows disabled state. |

---

### Anti-Patterns Found

None. Scan of all 11 Phase 92 source files for TBD/FIXME/XXX, empty implementations, and hardcoded stubs returned zero matches.

Notable: the ROADMAP checklist line for Phase 92 (line 212) still says "Porcupine" (old tech name from before the Picovoice account rejection). This is stale documentation in the roadmap description, not in any implementation file. It does not affect correctness.

---

### Safety Invariants Verified

| Invariant | Verified | Evidence |
|-----------|----------|----------|
| `useWakeWord` never throws — all errors go to `error-disabled` | Yes | `start()` wraps entire init in `try/catch`; catch block sets `status:'error-disabled'` + `errorReason`; no `throw` reaches caller |
| No silent hot mic on failure | Yes | `releaseResources()` called in catch (line 209); stops all `micStream.getTracks()` before setting error state |
| Mic never opens unless `voiceModeEnabled && status !== 'error-disabled'` | Yes | `DashboardLayout` `useEffect` at line 589 gates `wakeWordStart()` on both conditions |
| Voice mode OFF by default + persisted | Yes | `useState(() => JSON.parse(localStorage.getItem("codepulse-voice-mode") ?? "false"))` defaults to `false` |
| Toggle disabled-with-reason on ONNX failure | Yes | `MicToggle` sets `disabled` attribute + `MicOff` icon + tooltip with `errorReason` when `status === 'error-disabled'` |
| No onnxruntime import in AudioWorklet | Yes | `micCapture.worklet.ts` contains zero onnxruntime references (grep confirmed) |
| No new transport for voice — reuses `sendCommand({type:'chat.send'})` | Yes | `VoiceModePanel.tsx:236`; `AstridrWSContext` is the only transport |
| No duplicate Web Speech or TTS logic | Yes | ChatInput imports `useSpeechRecognition`; Chat imports `useTtsPlayback`; VoiceModePanel imports both |

---

### Human Verification Required

The following require a live browser with real mic, real ONNX inference, and a running Astridhr backend. All automated checks pass; these are the sole remaining open items.

#### 1. Live Wake Detection (VOX-01 primary)

**Test:** Enable voice mode via MicToggle; navigate to any page; speak "Hey Astrid" (when hey_astrid.onnx is trained and placed in `public/openwakeword/`) or "Hey Jarvis" (current stand-in).
**Expected:** CommandPalette opens in listening mode (VoiceModePanel visible) within approximately 1 second. State badge shows "Listening...".
**Why human:** Requires real mic + live ONNX inference in AudioWorklet/Web Worker. hey_astrid.onnx is also PENDING training — VOX-01 live-detection QA is blocked on it (documented in `public/openwakeword/README.md`).

#### 2. Spoken Command Transcription and chat.send (VOX-02)

**Test:** After wake, speak a command (e.g., "show me the agent list").
**Expected:** Interim transcript appears as you speak; final transcript is shown and `sendCommand({type:'chat.send', message:'show me the agent list'})` fires over the WebSocket.
**Why human:** Web Speech API requires real audio input — cannot simulate in jsdom.

#### 3. Streamed Reply + TTS Auto-Play (VOX-03)

**Test:** Complete a voice command and confirm Astridhr responds.
**Expected:** `run.text` chunks append to the ASTRIDHR reply stream in VoiceModePanel. `run.tts` audio_url plays audibly once in Astridhr's ElevenLabs voice (same `useTtsPlayback` hook used by Chat.tsx).
**Why human:** Requires live WebSocket stream and audible TTS playback.

#### 4. Feedback Guard: No Self-Transcription (VOX-03)

**Test:** While Astridhr's voice reply is playing, confirm the operator's mic is paused.
**Expected:** Astridhr's spoken reply is not captured by the speech recognition and sent back as a follow-up command.
**Why human:** Self-transcription is only observable with real mic + real audio output simultaneously.

#### 5. Graceful Degradation on ONNX Failure (VOX-04)

**Test:** Rename `public/openwakeword/melspectrogram.onnx` (or `hey_jarvis_v0.1.onnx`) to break model loading, then reload the app.
**Expected:** MicToggle shows MicOff icon, is `disabled` (opacity-40), tooltip shows the specific error reason. No crash, no JavaScript console error escaping to a SectionErrorBoundary. No mic stream opened.
**Why human:** Requires forcing a real onnxruntime load failure in a browser — not injectable in jsdom.

#### 6. Toggle Persistence Across Reload (VOX-04)

**Test:** Enable MicToggle, reload the app.
**Expected:** `localStorage.getItem('codepulse-voice-mode')` is `"true"`; voice mode resumes automatically; ListeningIndicatorPill appears once engine reaches `ready` status. Disable and reload — returns to OFF state.
**Why human:** localStorage persistence across page reload needs a real browser session.

#### 7. ⌘K Coexistence with Voice Mode (VOX-01)

**Test:** With voice mode enabled, press Cmd+K (or Ctrl+K).
**Expected:** Palette opens in text mode (CommandInput + CommandList visible, NOT VoiceModePanel). The voiceMode flag is `false` on this path.
**Why human:** Keyboard interaction requires a browser runtime.

#### 8. Continuous Conversation Turn Loop (D-01)

**Test:** Complete a voice command and TTS reply, then speak a follow-up without re-saying the wake phrase.
**Expected:** After TTS ends, speech recognition automatically restarts (feedback guard). The next spoken command is transcribed and sent without needing to wake again. Saying "stop" or "goodbye" exits voice mode (END dispatched, palette closes).
**Why human:** Requires the full live audio loop — TTS playback + mic input — in a browser.

---

### Gaps Summary

No automated gaps found. All 4 ROADMAP success criteria are verified at the code and unit-test level. The 8 human verification items above are all live-audio/browser behaviors that the validation strategy (`92-VALIDATION.md`) explicitly classified as Manual-Only from the outset. They are not defects in the implementation — they are the expected QA boundary for browser voice features.

The one genuine external dependency that must be resolved before full VOX-01 sign-off is training and placing `hey_astrid.onnx` in `public/openwakeword/`. This was operator-acknowledged at the 92-01 checkpoint and is tracked in `public/openwakeword/README.md`.

---

_Verified: 2026-06-24T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
