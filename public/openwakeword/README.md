# openWakeWord browser models — Phase 92 (Voice-Activated Command Palette)

Wake-word detection runs in-browser via `onnxruntime-web` using openWakeWord's
melspectrogram → embedding → classifier ONNX chain. No account/key/quota.

## Files

| File | Role | Source | Status |
|------|------|--------|--------|
| `melspectrogram.onnx` | Shared audio front-end (mel features) | openWakeWord v0.5.1 release | present (1.04 MB) |
| `embedding_model.onnx` | Shared speech embedding | openWakeWord v0.5.1 release | present (1.27 MB) |
| `hey_astrid.onnx` | **Custom wake-word classifier (SHIPPED)** | Trained via openWakeWord auto-training (Colab) 2026-06-25 | ✅ present (214 KB, self-contained, opset 18) — the live VOX-01 trigger |
| `hey_jarvis_v0.1.onnx` | Built-in reference model | openWakeWord v0.5.1 release | present (1.24 MB) — kept as fallback/reference only, NOT the shipped trigger |

The two shared models are used unchanged by every openWakeWord wake word.
`hey_astrid.onnx` is the custom-trained classifier and is the **live** wake word.

## Model provenance

`hey_astrid.onnx` trained 2026-06-25 via openWakeWord's automatic-training
notebook (phrase `hey astrid`, 1000 positive samples, 10k steps).
**Training metrics:** accuracy 0.732 · recall 0.470 · false-positives 0.177/hr.
Exported self-contained (`onnx.save_model(..., save_as_external_data=False)`) so all
50,403 weights are inline — no `.onnx.data` sidecar.

**Structural validation 2026-06-25 (`python scripts/validate_wakeword_model.py`): VERDICT PASS**
— real, contract-compatible, non-degenerate classifier. 214 KB self-contained (opset 18),
input `[1, 16, 96]` (seqLen=16, embDim=96 — matches wakeWordWorker.ts), single-score `[1,1]` output,
50,403 trained params, ops Gemm/LayerNormalization/Relu/Reshape/Sigmoid. Non-degenerate: 8 random
inputs produced varied scores (stdev 0.319 > 1e-6, min 0.004 / max 0.81), proving input-sensitive
trained weights. onnx.checker OK; loads cleanly in onnxruntime. Re-run the script after any retrain.
(The ~0.47 recall means live-mic QA must still confirm field reliability — see threshold note below.)

Detection threshold is tunable at inference in `useWakeWord` — start ~0.5 and
raise if false triggers are too frequent, lower if it misses the phrase.

## Training `hey_astrid.onnx` (one-time, free, Colab)

1. Open `notebooks/automatic_model_training.ipynb` from
   https://github.com/dscripka/openWakeWord ("Open in Colab").
2. Runtime → Change runtime type → **GPU**.
3. Set the target phrase to `hey astrid` (optionally add variants e.g. `hey ostrid`).
4. Run all cells (Piper TTS generates positive samples → trains classifier; ~30–60 min).
5. **Export self-contained** (CRITICAL): the notebook's default export writes weights to a
   separate `hey_astrid.onnx.data` sidecar that is easy to miss and breaks onnxruntime if not
   committed. After training, re-save inline before downloading:
   ```python
   import onnx; from google.colab import files
   onnx.save_model(onnx.load("/content/my_custom_model/hey_astrid.onnx"),
                   "hey_astrid_full.onnx", save_as_external_data=False)
   files.download("hey_astrid_full.onnx")   # ~200 KB single file, no .data
   ```
6. Place it in this folder as `public/openwakeword/hey_astrid.onnx`, then run
   `python scripts/validate_wakeword_model.py` and confirm `VERDICT: PASS`.

> **Colab 2026 note:** the upstream notebook has bit-rotted against current Colab (Python 3.12 +
> torch 2.6). A working run needed: pin `piper-sample-generator` to tag `v2.0.0`; `pip install
> piper-phonemize-cross` (no 3.12 wheel for `piper-phonemize`); `pip install onnxscript`; patch
> `torch_audiomentations`'s removed `torchaudio.set_audio_backend`/`.info`/`.load` calls; and set
> `weights_only=False` in piper's `torch.load`. Budget extra time for these.

## Pinned source

GitHub release: `dscripka/openWakeWord` tag `v0.5.1`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/melspectrogram.onnx`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/embedding_model.onnx`
- `https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/hey_jarvis_v0.1.onnx` (dev stand-in only)
