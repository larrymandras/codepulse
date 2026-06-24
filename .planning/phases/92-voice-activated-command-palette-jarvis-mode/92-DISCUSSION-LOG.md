# Phase 92: Voice-Activated Command Palette (Jarvis Mode) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 92-voice-activated-command-palette-jarvis-mode
**Areas discussed:** Wake trigger tech, STT path, Persona type, Conversation flow, Wake phrase + voice, Voice surface, Enable + privacy, Wake-word engine (revisited)

---

## Wake trigger technology

| Option | Description | Selected |
|--------|-------------|----------|
| Porcupine wake word | `@picovoice/porcupine-web` WASM hotword in a Web Worker; reuses Picovoice key + custom .ppn | ✓ |
| Web Speech continuous | Browser SpeechRecognition + JS phrase match; flaky after ~60s | |
| Push-to-talk hotkey | Global hotkey opens voice mode; not hands-free | |

**User's choice:** Porcupine wake word
**Notes:** Picked for the crisp dedicated hotword model. (Revisited later — see "Wake-word engine (revisited)".)

---

## Speech-to-text path

| Option | Description | Selected |
|--------|-------------|----------|
| Browser Web Speech | Reuse ChatInput.tsx recognition; zero backend; English-only | ✓ |
| Ástríðr Whisper backend | MediaRecorder → POST /api/chat/voice; higher accuracy, more latency | |

**User's choice:** Browser Web Speech (MVP)
**Notes:** Zero backend work; fine for short commands.

---

## Answering persona type

| Option | Description | Selected |
|--------|-------------|----------|
| Existing Norse persona | Reuse a roster persona with an existing ElevenLabs voice_id | ✓ |
| Add a "Hermes" persona | New persona + voice in config/profiles.yaml | |

**User's choice:** Use an existing Norse persona
**Notes:** No backend config needed; works immediately. "Hermes" deferred.

---

## Conversation flow

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous (true Jarvis) | Stay listening for follow-ups after the reply; exit on end-phrase/timeout | ✓ |
| Single-shot | Wake → one command → one reply → idle | |

**User's choice:** Continuous (true Jarvis)
**Notes:** Core of the "like Jarvis" feel. Requires client turn loop + mic-pause-during-TTS; barge-in may be a follow-on.

---

## Wake phrase + answering voice

| Option | Description | Selected |
|--------|-------------|----------|
| "Hey Astrid" → Ástríðr voice | Clean English phonemes; replies in Ástríðr's ElevenLabs voice | ✓ |
| "Hey Valkyrie" → pick persona later | Neutral phrase; selectable persona | |
| Persona name as wake word | Wake word IS the persona; one .ppn per persona | |

**User's choice:** "Hey Astrid" → Ástríðr voice
**Notes:** One identity end-to-end. UI label may show "Ástríðr"; .ppn uses ASCII spelling.

---

## Voice surface

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Command Palette in voice mode | Wake opens existing CommandPalette.tsx in a listening state | ✓ |
| Dedicated floating voice HUD | Separate cinematic overlay component | |

**User's choice:** Reuse Command Palette in voice mode
**Notes:** Satisfies "in the command section"; maximum reuse.

---

## Enable + privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Mic toggle in top bar + persistent indicator | DashboardLayout top-bar toggle, off by default, visible while on | ✓ |
| Settings page toggle only | Cleaner top bar, less convenient | |

**User's choice:** Mic toggle in top bar + persistent indicator
**Notes:** Off by default; honest about the hot mic.

---

## Wake-word engine (revisited — Picovoice account deleted)

| Option | Description | Selected |
|--------|-------------|----------|
| Web Speech continuous | Free, no account; auto-restart loop; mic audio to Google | |
| Recreate free Picovoice account | Re-sign-up (free tier), re-export Web .ppn; keeps original plan | ✓ |
| Vosk offline | In-browser offline STT+keyword; best privacy; ~50MB model | |

**User's choice:** Continue with Picovoice — will open a new account
**Notes:** Clarified that ElevenLabs already provides voice-out (server-side TTS via run.tts) but has NO wake-word product. User opts to recreate Picovoice rather than switch engines, so the Porcupine plan stands unchanged.

## Wake-word engine (re-revisited — Picovoice account DENIED) — SUPERSEDES the entries above

| Option | Description | Selected |
|--------|-------------|----------|
| openWakeWord (in-browser ONNX) | Open-source/Apache-2.0; no account/key/quota; real trained model; local detection; same engine as Ástríðr server-side; built-in "hey jarvis" available | ✓ |
| Vosk offline (vosk-browser) | Fully offline WASM wake+STT; best privacy; ~40-50MB model | |
| Web Speech continuous | Free phrase-match; ~60s restart babysitting; audio to Google | |

**User's choice:** openWakeWord via `onnxruntime-web` (no account)
**Notes:** Picovoice **denied** the new account, so Porcupine is fully dropped (no `.ppn`, no `porcupine_params.pv`, no `VITE_PICOVOICE_ACCESS_KEY`). Confirmed ElevenLabs has no wake-word product (only the voice-out already in place). openWakeWord chosen for zero-account robustness + parity with Ástríðr's server-side `openwakeword` backend.

### Trigger phrase (openWakeWord)

| Option | Description | Selected |
|--------|-------------|----------|
| Built-in "Hey Jarvis" now | Pre-trained model, ships immediately | |
| Train custom "Hey Astrid" first | Free synthetic-data (TTS) training before MVP; on-brand from day one | ✓ |

**User's choice:** Train custom "Hey Astrid" model first
**Notes:** Use openWakeWord's synthetic-data pipeline (Piper/TTS positive samples → trained classifier `.onnx`). "hey jarvis" kept only as a validation reference, not the shipped trigger. This adds a pre-MVP training+validation step (planner should sequence it as Wave 0).

## Claude's Discretion

- Web Worker / AudioWorklet wiring for openWakeWord on `onnxruntime-web` (WASM vs WebGPU, frame buffering, threshold/debounce); listening-state visual treatment inside the palette; end-phrase list; silence-timeout value (~30s start); whether barge-in lands in MVP or a follow-on; Vite static-asset/header config for `.onnx`/`.wasm`.

## Deferred Ideas

- "Hermes" persona (new persona + voice in astridr-repo).
- Multi-persona selection / persona-name wake words.
- Server-side Whisper STT path (MediaRecorder → /api/chat/voice).
- Barge-in (interrupt TTS by speaking).
- War Room / LiveKit voice (owned by Phase 90).
