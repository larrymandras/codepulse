---
phase: 92
slug: voice-activated-command-palette-jarvis-mode
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-24
---

# Phase 92 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 92-RESEARCH.md → "## Validation Architecture". Real mic + ONNX inference
> cannot run in jsdom/Vitest — the strategy below splits each success criterion into
> the part that is unit-assertable (pure logic, wiring, state machine) and the part
> that is manual-only (live wake detection, real STT, audible TTS).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) — `src/test/setup.ts` mocks Clerk, Recharts, Three.js, React Flow, Tone.js |
| **Config file** | `vitest.config.ts` / `vite.config.ts` (path alias `@/` → `./src/`) |
| **Quick run command** | `npx vitest run src/hooks src/components/voice` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the touched hook/component.
- **After every plan wave:** Run `npm test` (full suite) + `npx tsc --noEmit`.
- **Before `/gsd:verify-work`:** Full suite green + manual-only checklist walked once in a real browser.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

> Filled per plan during planning. Wake-detection ONNX inference, real `getUserMedia`,
> and audible TTS are MANUAL (see below); everything around them (frame math, mel
> normalization `(v/10)+2`, state-machine transitions, feedback-guard pause/resume,
> chat.send wiring, graceful-degradation branches) is unit-testable with mocks.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 92-01-T0 | 01 | 1 | VOX-01 | manual (checkpoint) | — (train + place `hey_astrid.onnx`; "hey jarvis" stand-in for code/tests) | ⬜ pending |
| 92-01-T1 | 01 | 1 | VOX-01 | config | `npx tsc --noEmit && grep -c "viteStaticCopy" vite.config.ts` | ⬜ pending |
| 92-01-T2 | 01 | 1 | VOX-01 | unit (tdd) | `npx vitest run src/lib/melNormalize.test.ts` | ⬜ pending |
| 92-01-T3 | 01 | 1 | VOX-01 | unit+config | `npx vitest run src/lib/melNormalize.test.ts && grep -c "SpeechRecognition" src/test/setup.ts` | ⬜ pending |
| 92-02-T1 | 02 | 1 | VOX-02 | unit (tdd) | `npx vitest run src/hooks/useSpeechRecognition.test.ts src/components/ChatInput.test.tsx` | ⬜ pending |
| 92-02-T2 | 02 | 1 | VOX-03 | unit (tdd) | `npx vitest run src/hooks/useTtsPlayback.test.ts` | ⬜ pending |
| 92-03-T1 | 03 | 2 | VOX-01 | config | `npx tsc --noEmit && grep -c "registerProcessor" src/worklets/micCapture.worklet.ts` | ⬜ pending |
| 92-03-T2 | 03 | 2 | VOX-01, VOX-04 | unit | `npx vitest run src/hooks/useWakeWord.test.ts src/workers/wakeWordWorker.test.ts` | ⬜ pending |
| 92-04-T1 | 04 | 3 | VOX-02 | unit (tdd) | `npx vitest run src/components/voice/voiceState.test.ts` | ⬜ pending |
| 92-04-T2 | 04 | 3 | VOX-02, VOX-03 | unit (tdd) | `npx vitest run src/components/voice/VoiceModePanel.test.tsx` | ⬜ pending |
| 92-04-T3 | 04 | 3 | VOX-02 | config | `npx tsc --noEmit && grep -c "VoiceModePanel" src/components/CommandPalette.tsx` | ⬜ pending |
| 92-05-T1 | 05 | 4 | VOX-04 | unit (tdd) | `npx vitest run src/components/MicToggle.test.tsx` | ⬜ pending |
| 92-05-T2 | 05 | 4 | VOX-01, VOX-04 | config | `npx tsc --noEmit && grep -c "useWakeWord\|codepulse-voice-mode\|MicToggle" src/layouts/DashboardLayout.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Live wake detection, real STT, and audible TTS are validated via the Manual-Only table below — not in jsdom.*

---

## Wave 0 Requirements

- [ ] `onnxruntime-web` installed + Vite config (`optimizeDeps.exclude`, `vite-plugin-static-copy` for `*.wasm`) — gates all wake-detection tests.
- [ ] Mel-normalization helper extracted as a pure function so the `(value/10)+2` transform is unit-assertable without running ONNX.
- [ ] Vitest mocks for `AudioWorkletNode` / `Worker` / `SpeechRecognition` / `HTMLAudioElement.play` (extend `src/test/setup.ts`).
- [ ] Custom `hey_astrid.onnx` classifier trained (Colab, ~30–60 min) — until then, dev/integration uses bundled "hey jarvis" model as a stand-in. **Blocks the live-detection manual checks, not the unit suite.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Speaking "Hey Astrid" opens palette in <~1s | VOX-01 | Needs real mic + ONNX inference; not reproducible in jsdom | Enable voice toggle, speak wake phrase from another page, confirm palette opens in listening mode |
| Spoken command transcribed + sent verbatim | VOX-02 | Web Speech API requires real audio | Speak a command, confirm live transcript then `chat.send` fires with the final text |
| Streamed reply renders + auto-plays in persona voice | VOX-03 | Audible TTS + live WS stream | Confirm `run.text` renders and `run.tts` audio plays once in Ástríðr's voice (shared `useTtsPlayback`) |
| Feedback guard: recognition paused during TTS | VOX-03 | Acoustic self-transcription only observable live | Confirm Ástríðr's own voice is not re-transcribed mid-reply |
| Graceful degradation on model load failure | VOX-04 | Requires forcing a real onnxruntime/model load failure | Rename/remove an ONNX asset, reload, confirm disabled toggle + reason tooltip, no crash, no silent hot mic |

---

## Validation Sign-Off

- [x] All tasks have an automated verify command OR a Wave 0 dependency OR a justified Manual-Only row
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers onnxruntime-web install + mocks + mel-normalization extraction
- [x] No watch-mode flags in any verify command
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter once map is filled

**Approval:** approved 2026-06-24
