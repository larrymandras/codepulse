# openWakeWord browser models — Phase 92 (Voice-Activated Command Palette)

Wake-word detection runs in-browser via `onnxruntime-web` using the
melspectrogram → embedding → classifier ONNX chain. No account/key/quota.

## Files

| File | Role | Source | Status |
|------|------|--------|--------|
| `melspectrogram.onnx` | Shared audio front-end (mel features) | openWakeWord v0.5.1 release | present (1.04 MB) |
| `embedding_model.onnx` | Shared speech embedding | openWakeWord v0.5.1 release | present (1.27 MB) |
| `hey_astrid.onnx` | **Custom wake-word classifier (SHIPPED)** | Retrained via **livekit-wakeword** trainer 2026-07-09 | ✅ present (157 KB) — the live VOX-01 trigger |
| `hey_jarvis_v0.1.onnx` | Built-in reference model | openWakeWord v0.5.1 release | present — fallback/reference only, NOT the shipped trigger |

The two shared models are used unchanged by every openWakeWord wake word.
`hey_astrid.onnx` is the custom-trained classifier and is the **live** wake word.

## Model provenance (current — 2026-07-09)

`hey_astrid.onnx` retrained 2026-07-09 with **livekit-wakeword** (LiveKit's
open-source, openWakeWord-compatible trainer) — `conv_attention/small`, **20,000
synthetic samples** (Piper VITS + SLERP speaker blending), 50k-step 3-phase
training with focal loss + checkpoint averaging + adversarial negatives tuned
for "astrid" (`hey astro`, `hey ashtray`, `hey ostrich`, `astrid`, …).

**Validation metrics (24.2h of audio):**
- At the shipped threshold **0.21** (`wakeWordWorker.ts`): **recall 90.7%**,
  **~0.12 false-positives/hour**, accuracy 95.3%.
- (At default 0.5: recall 63.3% @ 0 FP/hr.)

This replaced the original 2026-06-25 model (openWakeWord auto-training, 1k
samples / 10k steps) which only reached ~0.47 recall and was unreliable in the
field. Training config + Dockerfile live at `C:\Users\mandr\wakeword-training\`.
See `.planning/WAKEWORD-STRATEGY.md`.

Verified drop-in: front-end models byte-identical to LiveKit's, classifier
contract `embeddings[1,16,96] → score[1,1]`, loads + infers in onnxruntime-web
1.27.0 WASM (real Chromium).

The detection threshold is `THRESHOLD` in `src/workers/wakeWordWorker.ts`
(currently 0.21). Raise toward 0.3–0.4 if false triggers annoy; lower toward
0.15 if it misses the phrase.
