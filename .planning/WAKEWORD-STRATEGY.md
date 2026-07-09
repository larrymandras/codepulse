# Wake-Word Reliability Strategy — CodePulse voice mode

**Created:** 2026-07-08 · Owner: Larry · Status: **SHIPPED — retrained model integrated 2026-07-09**

## RESULT (2026-07-09)
Retrained `hey_astrid.onnx` via livekit-wakeword (20k samples, 50k steps, conv_attention/small).
**Validation (24.2h): recall 90.7% @ ~0.12 FP/hr at threshold 0.21** (vs the old model's ~0.47
recall). Shipped: model → `public/openwakeword/hey_astrid.onnx`, `THRESHOLD` 0.5 → **0.21** in
`wakeWordWorker.ts`. Verified drop-in in onnxruntime-web 1.27.0 WASM. Awaiting Larry's live test.

## The problem
CodePulse's in-browser wake word ("Hey Astrid") is unreliable. Root cause is the
**model, not the runtime**: the shipped `public/openwakeword/hey_astrid.onnx` was
trained to only **~0.47 recall** (1k samples / 10k steps — see its README). It
misses the phrase ~half the time by design. Threshold tuning can't fix a weak
model. Models are served fine on Vercel (verified 200s); the browser runtime is
fine. It's the classifier.

## Options evaluated (2026-07-08, verified live)
| Option | On-device | Web-ready | Verdict |
|--------|-----------|-----------|---------|
| **openWakeWord retrain via LiveKit trainer** | ✅ | ✅ (existing runtime) | **PRIMARY** — see Track B |
| Picovoice Porcupine | ✅ | ✅ | **DENIED** personal access (2026-07-08). Commercial license still possible if needed. |
| DaVoice.io | ✅ | ✅ (`web-wake-word`, delivers `.onnx`) | **Commercial backup** — email info@davoice.io for a custom "hey astrid" .onnx; drops into the same runtime. Small/solo vendor — vet support/pricing. |
| LiveKit wake word runtime | ✅ | ❌ (Python/Rust/Swift only, no JS SDK) | Not for browser trigger. But its **trainer** feeds Track B. |
| Web Speech API keyword | ❌ (Google) | ✅ | Fallback only; privacy + Chrome-only. |
| Spokestack | — | weak web | Mobile-focused; deprioritized. |

## Track B — the primary path (VERIFIED)
LiveKit's open-source `livekit-wakeword` trainer produces an **openWakeWord-compatible
ONNX** that drops into CodePulse's existing pipeline with **zero code changes**.
Verified 2026-07-08:
- **Front-end byte-identical:** LiveKit's `melspectrogram.onnx` + `embedding_model.onnx`
  are SHA-identical to CodePulse's.
- **Classifier contract exact:** input `embeddings [batch,16,96]` → output `score [batch,1]`
  — exactly what `wakeWordWorker.ts` feeds (`[1,16,96]`) and reads (`data[0]`). Worker
  uses `inputNames[0]`/`outputNames[0]` dynamically, so names don't matter.
- **Runs in production runtime:** `hey_livekit.onnx` loaded + inferred in real Chromium
  via **onnxruntime-web 1.27.0 WASM** (the exact runtime the worker uses). All
  conv-attention ops supported.
- Integration = **swap the model file** in `public/openwakeword/hey_astrid.onnx`.

## Training (in progress)
- **Location:** `C:\Users\mandr\wakeword-training\` (durable). Repo clone +
  `configs/hey_astrid.yaml` (balanced tier) + `configs/hey_astrid_smoke.yaml` + `Dockerfile`.
- **Env:** CUDA Docker container, `--gpus all`, RTX 4070 Ti SUPER (16GB). Docker GPU
  passthrough verified. (No standalone WSL distro exists — only docker-desktop backend.)
- **Config:** `conv_attention/small`, 20k samples, 50k steps, adversarial negatives
  tuned for "astrid", target 0.15 FP/hr. Piper VITS (local TTS, no keys).
- **Data footprint:** ~18–20 GB (ACAV100M ~16GB negatives + Piper ~166MB + RIRs + MUSAN).
  `--skip-acav` (~176MB) for smoke.
- **Run:** `docker build -t wakeword-train .` then `setup` → `run`; output to
  `output/hey_astrid/hey_astrid.onnx` (+ metrics + DET curve).

## Post-training checklist
1. Validate new `.onnx`: ONNX inspect (input `[b,16,96]`, output `[b,1]`) + ORT-web load test.
2. Copy to `codepulse/public/openwakeword/hey_astrid.onnx`.
3. Live-test wake word; tune `THRESHOLD` in `wakeWordWorker.ts` (currently 0.5) using
   the model's reported optimal threshold from `hey_astrid_metrics.json`.
4. If recall still weak → retrain `model_size: medium`, 25k samples, 100k steps.

## Parked / separate tracks
- **Picovoice:** denied personal; revisit only if commercial license is justified.
- **LiveKit Agents** (already in stack, War Room): separate upgrade for the *conversation*
  experience, not the trigger.
- **Lip-sync:** amplitude-driven mouth (needs TTS analyser re-enabled safely) or 3D
  blendshapes via R3F — separate track.
