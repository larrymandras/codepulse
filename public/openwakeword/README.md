# openWakeWord browser models — Phase 92 (Voice-Activated Command Palette)

Wake-word detection runs in-browser via `onnxruntime-web` using openWakeWord's
melspectrogram → embedding → classifier ONNX chain. No account/key/quota.

## Files

| File | Role | Source | Status |
|------|------|--------|--------|
| `melspectrogram.onnx` | Shared audio front-end (mel features) | openWakeWord v0.5.1 release | present (1.04 MB) |
| `embedding_model.onnx` | Shared speech embedding | openWakeWord v0.5.1 release | present (1.27 MB) |
| `hey_astrid.onnx` | **Custom wake-word classifier** | Trained via openWakeWord auto-training notebook | **PENDING — train in Colab before VOX-01 QA sign-off** |

The two shared models are used unchanged by every openWakeWord wake word.
Only `hey_astrid.onnx` is custom and must be trained.

## Dev / Integration Stand-in

All Phase 92 code and tests use the built-in `hey_jarvis_v0.1.onnx` model
(same v0.5.1 release) as the development and integration-testing stand-in
while `hey_astrid.onnx` is PENDING training.

**Live VOX-01 detection with the "Hey Astrid" wake phrase is blocked on
`hey_astrid.onnx` being trained and placed in this directory.** All other
code, tests, and CI checks pass using the "hey jarvis" stand-in.

## Training `hey_astrid.onnx` (one-time, free, Colab)

1. Open `notebooks/automatic_model_training.ipynb` from
   https://github.com/dscripka/openWakeWord ("Open in Colab").
2. Runtime → Change runtime type → **GPU**.
3. Set the target phrase to `hey astrid` (optionally add variants e.g. `hey ostrid`).
4. Run all cells (Piper TTS generates positive samples → trains classifier; ~30–60 min).
5. Download the exported `hey_astrid.onnx`.
6. Place it in this folder (`public/openwakeword/hey_astrid.onnx`).

## Pinned source

GitHub release: `dscripka/openWakeWord` tag `v0.5.1`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/melspectrogram.onnx`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/embedding_model.onnx`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/hey_jarvis_v0.1.onnx` (dev stand-in only)
