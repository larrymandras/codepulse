---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: 06
subsystem: testing
tags: [onnx, onnxruntime, wake-word, validation, python, openWakeWord]

# Dependency graph
requires:
  - phase: 92-voice-activated-command-palette-jarvis-mode (plans 01-05)
    provides: wakeWordWorker.ts contract (seqLen, embDim, THRESHOLD=0.5); hey_astrid.onnx committed
provides:
  - Repeatable ONNX structural validation script for hey_astrid.onnx (scripts/validate_wakeword_model.py)
  - Honest VERDICT: FAIL for hey_astrid.onnx (missing external data file hey_astrid.onnx.data)
  - Graph structure confirmed contract-compatible: declared input [1,16,96], 50,403 params, seqLen=16, embDim=96
  - Actionable re-export instructions in README and VERIFICATION for the next retrain cycle
affects:
  - Phase 90 (WarRoom) — if voice features are tested there, hey_astrid.onnx fix is a prerequisite
  - Any future retrain: run scripts/validate_wakeword_model.py after each re-export

# Tech tracking
tech-stack:
  added: ["onnx==1.22.0 (pip, validation only)", "onnxruntime (pip, validation only)"]
  patterns:
    - "External-data-aware ONNX graph inspection: onnx.load(path, load_external_data=False) to safely inspect models that may have missing companion .data files"
    - "Rank-2/4 input shapes for Python onnxruntime vs rank-1/3 in onnxruntime-web JS (batch dim must be explicit in Python)"

key-files:
  created:
    - scripts/validate_wakeword_model.py
    - .planning/phases/92-voice-activated-command-palette-jarvis-mode/92-06-SUMMARY.md
  modified:
    - public/openwakeword/README.md
    - .planning/phases/92-voice-activated-command-palette-jarvis-mode/92-VERIFICATION.md

key-decisions:
  - "VERDICT: FAIL — hey_astrid.onnx was exported from Colab with external weight storage; hey_astrid.onnx.data was not committed; model is non-loadable by onnxruntime; hey_jarvis_v0.1.onnx remains the active fallback"
  - "Graph structure IS contract-compatible: declared input [1,16,96] = seqLen=16 embDim=96 matches wakeWordWorker.ts exactly; 50,403 params from dims; ops: Gemm/LayerNormalization/Relu/Reshape/Sigmoid; opset 18"
  - "Root cause is export config, not training quality: Colab run produced a valid model but saved weights to a companion file that was not committed — fix is a re-export with inline weights, not a retrain"

patterns-established:
  - "Validation-script pattern: load_external_data=False for safe graph inspection; try/except around onnxruntime session creation for graceful FAIL reporting"

requirements-completed: [VOX-01]

# Metrics
duration: 25min
completed: 2026-06-25
---

# Phase 92 Plan 06: ONNX Model Structural Validation Summary

**ONNX validation script written and run; hey_astrid.onnx returns VERDICT: FAIL (missing `hey_astrid.onnx.data` companion file) — graph structure is contract-compatible but model is non-loadable; hey_jarvis_v0.1.onnx confirmed as the working fallback**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-25T14:05:00Z (approx)
- **Completed:** 2026-06-25T14:32:00Z (approx)
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- Created `scripts/validate_wakeword_model.py` — repeatable standalone ONNX validation script; runs three sections (graph inspection, embedding-dim resolution, classifier contract + non-degeneracy); prints structured VERDICT line; exits 0 on PASS / 1 on FAIL / 2 on missing deps
- Ran the script and captured the honest verdict: **VERDICT: FAIL** (exit=1); root cause is a missing external data file (`hey_astrid.onnx.data`) — the Colab export split weights into a companion file that was not committed to the repo
- Confirmed the model's graph structure IS contract-compatible with `wakeWordWorker.ts`: declared input `[1, 16, 96]` (seqLen=16, embDim=96), single sigmoid output `[1, 1]`, correct op set; only runtime loading is broken
- Updated `public/openwakeword/README.md` with dated structural-validation FAIL line and re-export instructions; existing accuracy 0.78 / recall 0.55 provenance lines preserved
- Updated `92-VERIFICATION.md` "Live Wake Detection" why_human and "Gaps Summary" with RE-OPENED status and concrete failure evidence; `status: human_needed` frontmatter unchanged; 7 live-audio human items not closed

## Validation Numbers

| Metric | Value |
|--------|-------|
| Script exit code | 1 (FAIL) |
| VERDICT | FAIL |
| Root cause | hey_astrid.onnx.data missing (external weight storage not committed) |
| hey_astrid.onnx params (from dims) | 50,403 |
| hey_jarvis_v0.1.onnx params | 316,738 |
| mel_bins (from melspectrogram.onnx) | 32 |
| embDim (from embedding_model.onnx) | 96 |
| Declared seqLen (from graph input shape) | 16 |
| Resolved seqLen (runtime) | None (session load failed) |
| 8-sample score stats | N/A (session load failed) |
| onnx.checker verdict for hey_astrid | FAIL (references missing hey_astrid.onnx.data) |
| onnx.checker verdict for hey_jarvis | OK |
| hey_astrid declared input shape | [1, 16, 96] (contract-compatible) |
| hey_astrid declared output shape | [1, 1] (single score — contract-compatible) |

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the ONNX validation script** - `0d93c20` (feat)
2. **Task 1 fix: Correct onnxruntime input ranks + external data handling** - `7a75c6d` (fix — Rule 1 auto-fix)
3. **Task 2: Run validation + record FAIL verdict in README + VERIFICATION** - `a77a997` (docs)

## Files Created/Modified

- `scripts/validate_wakeword_model.py` — Standalone ONNX validation: graph inspection (param count, op types, onnx.checker), embedding-dim resolution via melspectrogram + embedding_model inference, classifier contract probe (seqLen in {16,22}, single-score output), non-degeneracy checks (PASS-0 through PASS-4), VERDICT line, exit code enforcement
- `public/openwakeword/README.md` — Added "Structural validation 2026-06-25 NEEDS RE-EXPORT" dated provenance line with param counts, declared shape, missing .data explanation, and re-export instructions
- `.planning/phases/92-voice-activated-command-palette-jarvis-mode/92-VERIFICATION.md` — RE-OPENED "Live Wake Detection" why_human + Gaps Summary with full FAIL evidence; Required Artifacts table updated; status frontmatter unchanged

## Decisions Made

- **FAIL verdict is honest and actionable:** The model graph is contract-compatible; the issue is the export config (external data storage), not the training. Re-export with inline weights (not a full retrain) is the correct fix path.
- **seqLen=16 confirmed from graph metadata:** The declared input shape `[1, 16, 96]` gives seqLen=16 even without runtime inference, matching the worker's first candidate.
- **hey_jarvis_v0.1.onnx stays as the active working fallback:** It passes all graph checks (onnx.checker OK, self-contained weights, declared input `[1, 16, 96]`, 316,738 params).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Script crashed on missing external data file instead of reporting FAIL**
- **Found during:** Task 2 (running the script)
- **Issue:** `onnx.load(path)` by default tries to load external weight data; crashed with `ValidationError` when `hey_astrid.onnx.data` was not found, instead of gracefully detecting and reporting the missing file
- **Fix:** Switched to `onnx.load(path, load_external_data=False)` for graph inspection; added explicit external-data presence check + PASS-0 gate; wrapped onnxruntime session creation in try/except with FAIL-0 reporting
- **Files modified:** scripts/validate_wakeword_model.py
- **Verification:** Script runs to completion, prints VERDICT: FAIL, exits 1
- **Committed in:** 7a75c6d

**2. [Rule 1 - Bug] Wrong input rank for melspectrogram.onnx in Python onnxruntime**
- **Found during:** Task 2 (running the script)
- **Issue:** The script passed shape `[1280]` (rank 1) mirroring the JS worker's flat array, but Python onnxruntime requires `[batch_size, samples]` = `[1, 1280]` (rank 2)
- **Fix:** Changed dummy mel input to `np.zeros((1, 1280), dtype=np.float32)`
- **Files modified:** scripts/validate_wakeword_model.py
- **Verification:** mel output confirmed: shape `[1, 1, 5, 32]`, mel_bins=32
- **Committed in:** 7a75c6d

**3. [Rule 1 - Bug] Wrong input rank for embedding_model.onnx in Python onnxruntime**
- **Found during:** Task 2 (running the script)
- **Issue:** Script passed `[76, mel_bins, 1]` (rank 3) matching the JS worker, but Python onnxruntime requires `[batch, 76, mel_bins, 1]` (rank 4)
- **Fix:** Changed dummy emb input to `np.zeros((1, MEL_WINDOW, mel_bins, 1), dtype=np.float32)`
- **Files modified:** scripts/validate_wakeword_model.py
- **Verification:** emb output confirmed: shape `[1, 1, 1, 96]`, embDim=96
- **Committed in:** 7a75c6d

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs found by running the script against the live models)
**Impact on plan:** All three fixes were necessary to produce a runnable, honest verdict. The underlying validation logic and PASS/FAIL criteria are unchanged. The script now correctly handles JS/Python onnxruntime shape differences and the external data edge case.

## Issues Encountered

- **hey_astrid.onnx.data missing:** The Colab auto-training notebook exported the classifier with `save_as_external_data=True` (PyTorch default for larger models), creating a two-file bundle. Only the `.onnx` protobuf was committed; the `.data` weight file was not. This is the sole blocker for hey_astrid.onnx becoming the live wake-word classifier.
- **Fix path:** Re-run Colab training notebook, add `opset_version=18` and explicitly set external data to False in the export step (e.g., `torch.onnx.export(...); model = onnx.load(..., load_external_data=True); onnx.save(model, path)` after consolidating weights). Commit only the single `.onnx` file. Run `python scripts/validate_wakeword_model.py` to confirm VERDICT: PASS.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The validation script is read-only diagnostic tooling that loads model files and runs CPU inference — no app code or runtime path modified. T-92-20 (read-only diagnostic, bounded to local dev) applies.

## Known Stubs

None — this plan adds a validation script and documentation only; no UI/data-flow stubs introduced.

## User Setup Required

None for the script itself. To resolve the FAIL verdict:
1. Re-export `hey_astrid.onnx` from the Colab training notebook with inline (non-external) weights
2. Replace `public/openwakeword/hey_astrid.onnx` with the re-exported file
3. Run `python scripts/validate_wakeword_model.py` — confirm VERDICT: PASS
4. Commit the updated model file
5. Re-verify live browser wake detection (the 7 human QA items in 92-VERIFICATION.md)

## Next Phase Readiness

- `scripts/validate_wakeword_model.py` is committed and repeatable — run it after any future retrain/re-export
- `hey_jarvis_v0.1.onnx` is the active, loadable wake-word fallback; the browser worker already falls back to it
- VOX-01 structural model dependency is RE-OPENED pending hey_astrid.onnx re-export
- All other Phase 92 work (83 tests passing, full voice pipeline wired) remains green

---
*Phase: 92-voice-activated-command-palette-jarvis-mode*
*Completed: 2026-06-25*
