---
phase: 92
slug: voice-activated-command-palette-jarvis-mode
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-24
validated: 2026-06-26
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
| 92-01-T0 | 01 | 1 | VOX-01 | manual (checkpoint) | — (`hey_astrid.onnx` present: 214 KB self-contained, git-tracked, validate_wakeword_model.py PASS) | ✅ done |
| 92-01-T1 | 01 | 1 | VOX-01 | config | `npx tsc --noEmit` (✓); `viteStaticCopy` grep obsolete² | ✅ green² |
| 92-01-T2 | 01 | 1 | VOX-01 | unit (tdd) | `npx vitest run src/lib/melNormalize.test.ts` (4) | ✅ green |
| 92-01-T3 | 01 | 1 | VOX-01 | unit+config | `npx vitest run src/lib/melNormalize.test.ts` + `grep SpeechRecognition src/test/setup.ts` (=7) | ✅ green |
| 92-02-T1 | 02 | 1 | VOX-02 | unit (tdd) | `npx vitest run src/hooks/useSpeechRecognition.test.ts` (8)³ | ✅ green³ |
| 92-02-T2 | 02 | 1 | VOX-03 | unit (tdd) | `npx vitest run src/hooks/useTtsPlayback.test.ts` (6) | ✅ green |
| 92-03-T1 | 03 | 2 | VOX-01 | config | `npx tsc --noEmit` + `grep registerProcessor src/worklets/micCapture.worklet.ts` (=2) | ✅ green |
| 92-03-T2 | 03 | 2 | VOX-01, VOX-04 | unit | `npx vitest run src/hooks/useWakeWord.test.ts src/workers/wakeWordWorker.test.ts` (8+5) | ✅ green |
| 92-04-T1 | 04 | 3 | VOX-02 | unit (tdd) | `npx vitest run src/components/voice/voiceState.test.ts` (24) | ✅ green |
| 92-04-T2 | 04 | 3 | VOX-02, VOX-03 | unit (tdd) | `npx vitest run src/components/voice/VoiceModePanel.test.tsx` (17) | ✅ green |
| 92-04-T3 | 04 | 3 | VOX-02 | config | `npx tsc --noEmit` + `grep VoiceModePanel src/components/CommandPalette.tsx` (=5) | ✅ green |
| 92-05-T1 | 05 | 4 | VOX-04 | unit (tdd) | `npx vitest run src/components/MicToggle.test.tsx` (11) | ✅ green |
| 92-05-T2 | 05 | 4 | VOX-01, VOX-04 | config | `npx tsc --noEmit` + `grep useWakeWord\|codepulse-voice-mode\|MicToggle src/layouts/DashboardLayout.tsx` (=6) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Live wake detection, real STT, and audible TTS are validated via the Manual-Only table below — not in jsdom.*

> ² **Deviation (in-scope):** `vite-plugin-static-copy` self-hosting "proved unreliable in dev and prod" (`vite.config.ts:29`) and was replaced by a `drop-unused-ort-wasm` inline plugin + serving ONNX/wasm from `public/openwakeword/`. The `viteStaticCopy` grep invariant is obsolete; `tsc --noEmit` is the surviving automated check for this task.
> ³ **Deviation (in-scope):** Web Speech logic was *extracted* from `ChatInput.tsx` into the shared `useSpeechRecognition` hook (92-02-SUMMARY), so the planned `src/components/ChatInput.test.tsx` was never created — its VOX-02 behavior is covered by `useSpeechRecognition.test.ts` (8 tests). `ChatInput.tsx` is now a thin consumer.

---

## Wave 0 Requirements

- [x] `onnxruntime-web ^1.27.0` installed; Vite ONNX/wasm serving resolved via `drop-unused-ort-wasm` plugin + `public/openwakeword/` (the `vite-plugin-static-copy` route was dropped as unreliable — see deviation ²).
- [x] Mel-normalization helper extracted as a pure function (`src/lib/melNormalize.ts`) — `(value/10)+2` transform unit-assertable without ONNX (4 tests green).
- [x] Vitest mocks for `AudioWorkletNode` / `Worker` / `SpeechRecognition` / `HTMLAudioElement.play` present in `src/test/setup.ts` (SpeechRecognition grep = 7).
- [x] Custom `hey_astrid.onnx` classifier trained + committed (214 KB self-contained, opset 18, 50,403 inline params; `validate_wakeword_model.py` = VERDICT PASS, 2026-06-25). Live-detection manual checks unblocked.

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

**Approval:** validated 2026-06-26 — all 13 task invariants green (83 unit tests), Wave 0 complete, no gaps.

---

## Validation Audit 2026-06-26

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Result:** Phase 92 is **Nyquist-compliant**. All VOX-01–VOX-04 invariants have automated verification that runs green.

| Suite | Result | Runtime |
|-------|--------|---------|
| `npx vitest run` (melNormalize, useSpeechRecognition, useTtsPlayback, useWakeWord, wakeWordWorker, voiceState, VoiceModePanel, MicToggle) | 83/83 passed (8 files) | ~2.6s |

**Two in-scope plan deviations** (not gaps) reconciled — see footnotes ² and ³ in the Per-Task Map:
- `vite-plugin-static-copy` replaced by `drop-unused-ort-wasm` + `public/` serving → `viteStaticCopy` grep obsolete.
- `ChatInput.test.tsx` never created; its VOX-02 logic was extracted to `useSpeechRecognition.test.ts`.

**Wake-model discrepancy reconciled:** the v9.0 milestone audit flagged (via the integration checker) that `hey_astrid.onnx` falls back to `hey_jarvis` due to a missing `.data` sidecar. **This was a false positive** — `public/openwakeword/hey_astrid.onnx` is present (214,398 bytes), self-contained (no `.data` sidecar), and git-tracked, matching 92-VERIFICATION.md. The primary wake model loads; no fallback. The milestone audit's VOX-01 warning is retracted.

The 5 Manual-Only items (live wake detection, real STT, audible TTS, feedback guard, graceful degradation) remain genuinely browser-only and were live-verified 2026-06-25 in Chrome per 92-VERIFICATION.md. Field note: training recall ~0.47 → missed triggers plausible; tune the `0.5` THRESHOLD in `wakeWordWorker.ts` if needed (quality tuning, not a coverage gap).
