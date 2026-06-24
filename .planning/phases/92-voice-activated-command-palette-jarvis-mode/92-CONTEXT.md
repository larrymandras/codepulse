# Phase 92: Voice-Activated Command Palette (Jarvis Mode) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Hands-free voice interaction with Ástríðr, surfaced through CodePulse's **existing** command palette and WebSocket `chat.send` path. A browser-side always-on wake word ("Hey Astrid") opens the command palette in a listening mode; the spoken command is transcribed in-browser, sent over the existing `AstridrWSContext` WebSocket, and the streamed reply is rendered and spoken back in Ástríðr's persona voice.

**Hard scope anchor:** No Ástríðr backend changes. All STT happens client-side (browser Web Speech API). Persona→voice resolution stays server-side (`VoiceIdentityResolver`); CodePulse just plays the `run.tts` audio URL it already receives. Wake-word detection runs entirely in the browser via Porcupine WASM.

**Out of scope (own phases / deferred):** server-side Whisper STT path, MediaRecorder upload to `/api/chat/voice`, new personas (e.g. "Hermes"), War Room voice/LiveKit (that is Phase 90), multi-language STT, voice device pickers, agent token-by-token streaming.
</domain>

<decisions>
## Implementation Decisions

### Listening behavior / conversation flow
- **D-01:** **Continuous (true Jarvis) conversation.** After Ástríðr replies, stay in conversation and keep listening for follow-ups **without** re-saying the wake word. Exit the conversation on an end-phrase ("stop", "thanks", "goodbye") or a silence timeout (~30s). Mirrors Ástríðr's own server-side `VoiceChannel` state machine (IDLE→WAKE→LISTENING→PROCESSING with end-phrase exit, `astridr/channels/voice.py:42-138`).
- **D-02:** Implies a client-side turn loop: after `run.completed` + TTS playback finishes, automatically restart speech recognition for the next turn. Must guard against the mic being hot during TTS playback (avoid self-transcription / feedback) — pause recognition while audio is playing, resume after. Barge-in (interrupting TTS by speaking) is desirable but may be deferred to a follow-on if it complicates the MVP; planner to assess.

### Wake phrase + answering persona
- **D-03:** Wake phrase is **"Hey Astrid"** — chosen for clean English phonemes (Porcupine trains/detects reliably; 2+ syllables beat single short words). UI label may display "Ástríðr"; the trained `.ppn` uses the ASCII spelling.
- **D-04:** Replies are spoken in **Ástríðr's own ElevenLabs voice** (the namesake/default persona) — one identity end-to-end. The persona is resolved server-side; CodePulse does not pick or configure voices. Single wake word, single voice for this phase (multi-persona selection deferred).

### Voice surface
- **D-05:** **Reuse the existing `CommandPalette` (`src/components/CommandPalette.tsx`) in a "voice mode."** On wake, the palette opens into a listening state showing the live transcript and the streamed reply, instead of (or layered over) its text search/command list. This satisfies "in the command section" and maximizes reuse. No separate floating HUD component this phase.

### Enable + privacy model
- **D-06:** **Always-on listening is OFF by default.** A **mic toggle in the `DashboardLayout` top bar** turns voice mode on/off, persisted across reloads (localStorage / existing settings store). While ON, a **persistent "listening" indicator** stays visible in the top bar.
- **D-07:** **Graceful degradation is mandatory:** a missing/invalid `.ppn`, missing `porcupine_params.pv`, or missing/invalid `VITE_PICOVOICE_ACCESS_KEY` must show a clear disabled state (toggle disabled with reason) — never crash, never a silent always-on mic.

### Claude's Discretion
- Exact Web Worker wiring for `@picovoice/porcupine-web`, the listening-state visual treatment inside the palette, the end-phrase list, the silence-timeout value (~30s starting point), and whether barge-in lands in MVP or a follow-on.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CodePulse — reuse targets (the integration surface)
- `src/components/CommandPalette.tsx` — the command-section surface to extend with voice mode; already has `useAstridrWS().sendCommand` (line 87) and is rendered/toggled from DashboardLayout.
- `src/layouts/DashboardLayout.tsx` §554-593,735 — `paletteOpen` state + ⌘K/Ctrl+K toggle (line 593) + `<CommandPalette>` render (line 735). Wake handler + top-bar mic toggle/indicator go here.
- `src/contexts/AstridrWSContext.tsx` — WebSocket transport: `sendCommand({type:"chat.send", message})` (~line 307-332) and topic/event subscription (`run.text`, `run.tts`, `run.completed`, `run.error`; map ~line 49-88).
- `src/components/ChatInput.tsx` §16-40,54-178 — existing browser Web Speech API recognition (`getSpeechRecognitionClass`, `startListening`, `stopListening`, result→transcript→auto-send). Reuse/extract this logic for the palette voice mode.
- `src/pages/Chat.tsx` §52-86,253-289 — existing `run.tts` audio playback (`playAudio`, auto-play). **Extract into a shared `src/hooks/useTtsPlayback.ts`** consumed by both Chat and the palette (no duplicate logic).
- `convex/_generated/api` + `src/hooks/useCommandPaletteSearch.ts` — palette's existing data hooks (unchanged; voice mode is additive).

### Ástríðr — server-side behavior CodePulse relies on (do NOT modify)
- `astridr/engine/voice_identity.py` — `VoiceIdentityResolver.resolve(persona_id)` → (voice_id, stability, similarity_boost). Confirms persona→voice is server-side; CodePulse needs no voice config.
- `config/profiles.yaml` §131+ — Norse persona roster + ElevenLabs `voice_id`s (Ástríðr = `1NOPZlhvXZ6u0CX5lJD3`). Reference only; "Hermes" does NOT exist (deferred).
- `astridr/channels/voice.py:42-138` — reference state machine for the continuous-conversation turn loop (end-phrase exit, silence timeout) to mirror client-side.
- `astridr/channels/web.py` §816-841 — confirms the SSE/`run.tts` event shape (`{text, audio_url}`) the WS path surfaces; CodePulse consumes the same event names.

### External — wake-word dependency
- `@picovoice/porcupine-web` (npm) — browser WASM wake-word engine. Needs a **Web-target** `.ppn` keyword file + English `porcupine_params.pv` (from `github.com/Picovoice/porcupine` → `lib/common/porcupine_params.pv`) in `public/`, plus `VITE_PICOVOICE_ACCESS_KEY` env var (same Picovoice AccessKey already used server-side as `PICOVOICE_ACCESS_KEY`). Operator-supplied via Picovoice Console.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CommandPalette.tsx`**: already imports `useAstridrWS` and calls `sendCommand(...)` for actions — voice mode adds a listening state + transcript→`chat.send`, not a new transport.
- **Web Speech recognition in `ChatInput.tsx`**: full `SpeechRecognition` setup with result/error handling and auto-send already exists — lift into a shared hook (e.g. `useSpeechRecognition`) for the palette.
- **`run.tts` playback in `Chat.tsx`**: working audio auto-play from `audio_url` — extract to `useTtsPlayback` so Chat and palette share one path.
- **`AstridrWSContext`**: topic-based pub/sub already fans out `run.text`/`run.tts`/`run.completed`/`run.error` — voice mode subscribes to the same events.

### Established Patterns
- Provider/context pattern (`AstridrWSProvider`, `AmbientProvider`) at app root — a `useWakeWord` hook fits this model; wake state can be lifted to DashboardLayout.
- `VITE_*` env vars for client config (`VITE_ASTRIDR_WS_URL`, etc.) — add `VITE_PICOVOICE_ACCESS_KEY` the same way.
- Tone.js ambient/alert audio already runs in-browser (`audioEngine.ts`) — confirms browser audio output is established; TTS playback is `<audio>`-based and separate.

### Integration Points
- **New:** `src/hooks/useWakeWord.ts` (Porcupine Web Worker → emits `wake`), `src/hooks/useTtsPlayback.ts` (extracted), optional `src/hooks/useSpeechRecognition.ts` (extracted from ChatInput).
- **Modified:** `CommandPalette.tsx` (voice mode + transcript + reply render), `DashboardLayout.tsx` (wake→open palette in voice mode; top-bar mic toggle + listening indicator), `package.json` (+`@picovoice/porcupine-web`), `public/` (`.ppn` + `porcupine_params.pv`), `.env` (`VITE_PICOVOICE_ACCESS_KEY` — added manually by operator; env-file-guard blocks tool edits).

</code_context>

<specifics>
## Specific Ideas

- "Like Jarvis and Hermes" — continuous, hands-free, speak-and-be-spoken-to. Continuous conversation (D-01) is the core of that feel.
- Must live "in the command section" — explicitly the ⌘K `CommandPalette` (D-05), not the `/chat` page.
- Reuse both existing stacks (Ástríðr's full server-side voice pipeline + CodePulse's existing voice input/TTS-playback) rather than building new — the gap is only browser wake-word + a palette voice mode + a shared TTS hook.

</specifics>

<deferred>
## Deferred Ideas

- **"Hermes" persona** — does not exist in `config/profiles.yaml`; would need a new persona + ElevenLabs voice in astridr-repo. Future cross-repo phase.
- **Multi-persona selection / persona-name wake words** — pick which Valkyrie answers; per-persona `.ppn`. Future phase.
- **Server-side Whisper STT** (MediaRecorder → `/api/chat/voice`) for higher accuracy / multi-language — future upgrade; MVP uses browser Web Speech.
- **Barge-in (interrupt TTS by speaking)** — assess in planning; may ship as follow-on if it complicates the MVP turn loop.
- **War Room / LiveKit voice** — separate capability, owned by Phase 90 (Agent Room).

None of these block Phase 92.

</deferred>

---

*Phase: 92-voice-activated-command-palette-jarvis-mode*
*Context gathered: 2026-06-24*
