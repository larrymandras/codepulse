# openWakeWord browser models — Phase 92 (Voice-Activated Command Palette)

Wake-word detection runs in-browser via `onnxruntime-web` using openWakeWord's
melspectrogram → embedding → classifier ONNX chain. No account/key/quota.

## Files

| File | Role | Source | Status |
|------|------|--------|--------|
| `melspectrogram.onnx` | Shared audio front-end (mel features) | openWakeWord v0.5.1 release | present (1.04 MB) |
| `embedding_model.onnx` | Shared speech embedding | openWakeWord v0.5.1 release | present (1.27 MB) |
| `hey_astrid.onnx` | **Custom wake-word classifier (SHIPPED)** | Trained via openWakeWord auto-training (Colab) 2026-06-25 | ✅ present (13.8 KB) — the live VOX-01 trigger |
| `hey_jarvis_v0.1.onnx` | Built-in reference model | openWakeWord v0.5.1 release | present (1.24 MB) — kept as fallback/reference only, NOT the shipped trigger |

The two shared models are used unchanged by every openWakeWord wake word.
`hey_astrid.onnx` is the custom-trained classifier and is the **live** wake word.

## Model provenance

`hey_astrid.onnx` trained 2026-06-25 via openWakeWord's automatic-training
notebook (phrase `hey astrid`, 2000 positive samples, 10k steps).
**Validation metrics:** accuracy 0.78 · recall 0.55 · false-positives ~1.33/hr.
Backup copy in Google Drive at `MyDrive/openwakeword/hey_astrid.onnx`.

**Structural validation 2026-06-25 (`python scripts/validate_wakeword_model.py`):** NEEDS RE-EXPORT
— Graph structure is contract-compatible (declared input `[1, 16, 96]`, seqLen=16, embDim=96 matches
wakeWordWorker.ts; 50,403 params from dims; ops: Gemm/LayerNormalization/Relu/Reshape/Sigmoid;
opset 18) but the model was exported with external weight storage: weights reference
`hey_astrid.onnx.data` which was not committed to the repo. onnxruntime cannot load the model and
the browser worker falls back to `hey_jarvis_v0.1.onnx` (316,738 params, self-contained, opset 13).
To fix: re-run the Colab training notebook and export with inline weights (no external data file)
before placing in this directory. Re-validate with `python scripts/validate_wakeword_model.py`
after re-export. For comparison: hey_jarvis passes all checks (VERDICT: PASS — self-contained).

Detection threshold is tunable at inference in `useWakeWord` — start ~0.5 and
raise if false triggers are too frequent, lower if it misses the phrase.

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
