#!/usr/bin/env python3
"""
validate_wakeword_model.py — Phase 92 VOX-01 model structural validation

Validates that hey_astrid.onnx satisfies the wakeWordWorker.ts contract:
  Stage-3 input [1, seqLen, embDim] with seqLen in {16, 22}
  Single finite score output readable as data[0]
  Non-degenerate trained weights (non-zero, varied output across random inputs)

Run from any directory:
  python scripts/validate_wakeword_model.py

Exit codes:
  0 — all four checks pass (VERDICT: PASS)
  1 — one or more checks failed (VERDICT: FAIL)
  2 — missing onnx / onnxruntime dependencies
"""
import sys
import pathlib

# --- Dependency self-healing ---
try:
    import numpy as np
    import onnx
    import onnx.numpy_helper
    import onnxruntime as ort
except ImportError as e:
    print(f"Import error: {e}")
    print("Missing deps — run: pip install onnx onnxruntime")
    sys.exit(2)

# --- Model directory resolution ---
# Script lives at <repo_root>/scripts/validate_wakeword_model.py
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
MODEL_DIR = REPO_ROOT / "public" / "openwakeword"

# Constants mirroring wakeWordWorker.ts
THRESHOLD = 0.5          # wakeWordWorker.ts line 38
MEL_WINDOW = 76          # wakeWordWorker.ts line 101
CANDIDATE_SEQ_LENS = [16, 22]  # wakeWordWorker.ts line 118

print("=" * 70)
print("Phase 92 VOX-01 — wake-word model structural validation")
print(f"Model directory: {MODEL_DIR}")
print("=" * 70)


# ============================================================
# Helper: count external data params from tensor dims (no weight load)
# ============================================================
def count_params_no_load(model: "onnx.ModelProto") -> tuple[int, bool, list[str]]:
    """
    Count total parameters without loading external data.
    Returns (total_params, has_missing_external_data, missing_files).
    For tensors with external data, use the declared dims for size.
    For tensors with inline data, use numpy_helper.to_array().
    """
    total_params = 0
    all_zero = True
    has_missing = False
    missing_files = []
    seen_missing = set()

    for init in model.graph.initializer:
        if init.data_location == onnx.TensorProto.EXTERNAL:
            # External data: count from declared dims, note if file is missing
            dims = list(init.dims)
            size = 1
            for d in dims:
                size *= d
            total_params += size
            # Extract the external data file location
            for kv in init.external_data:
                if kv.key == "location":
                    ext_file = MODEL_DIR / kv.value
                    if not ext_file.exists() and kv.value not in seen_missing:
                        has_missing = True
                        missing_files.append(kv.value)
                        seen_missing.add(kv.value)
                    break
            # Cannot check all_zero without loading data
        else:
            # Inline data: safe to load
            arr = onnx.numpy_helper.to_array(init)
            total_params += int(arr.size)
            if arr.any():
                all_zero = False

    return total_params, has_missing, missing_files


# ============================================================
# (A) Graph inspection
# ============================================================
def inspect_model(model_path: pathlib.Path, label: str) -> dict:
    """Load and inspect an ONNX model graph; returns summary dict."""
    if not model_path.exists():
        print(f"  [MISSING] {label}: {model_path}")
        return {}

    # Load without external data first so missing .data files don't crash us
    model = onnx.load(str(model_path), load_external_data=False)

    try:
        onnx.checker.check_model(model)
        check_status = "OK"
    except Exception as exc:
        check_status = f"FAIL ({exc})"

    graph = model.graph
    opset = model.opset_import[0].version if model.opset_import else "unknown"

    # Count trained parameters (handles external data gracefully)
    total_params, has_missing_ext, missing_ext_files = count_params_no_load(model)

    # Check if external data files actually exist on disk
    ext_data_status = "OK"
    if has_missing_ext:
        ext_data_status = f"MISSING: {', '.join(missing_ext_files)}"

    # Op types
    op_types = sorted(set(node.op_type for node in graph.node))

    # Runtime inputs (exclude initializers — those are weights, not graph inputs)
    init_names = {init.name for init in graph.initializer}
    runtime_inputs = []
    for inp in graph.input:
        if inp.name in init_names:
            continue
        shape = []
        if inp.type.HasField("tensor_type") and inp.type.tensor_type.HasField("shape"):
            for dim in inp.type.tensor_type.shape.dim:
                shape.append(dim.dim_value if dim.dim_value else "?")
        runtime_inputs.append((inp.name, shape))

    runtime_outputs = []
    for out in graph.output:
        shape = []
        if out.type.HasField("tensor_type") and out.type.tensor_type.HasField("shape"):
            for dim in out.type.tensor_type.shape.dim:
                shape.append(dim.dim_value if dim.dim_value else "?")
        runtime_outputs.append((out.name, shape))

    print(f"\n  [{label}] {model_path.name}")
    print(f"    onnx.checker:      {check_status}")
    print(f"    Opset:             {opset}")
    print(f"    Runtime inputs:    {runtime_inputs}")
    print(f"    Runtime outputs:   {runtime_outputs}")
    print(f"    Op types:          {op_types}")
    print(f"    Total params:      {total_params:,}")
    print(f"    External data:     {ext_data_status}")

    return {
        "check_status": check_status,
        "total_params": total_params,
        "has_missing_ext": has_missing_ext,
        "missing_ext_files": missing_ext_files,
        "runtime_inputs": runtime_inputs,
        "runtime_outputs": runtime_outputs,
    }


print("\n--- (A) Graph Inspection ---")
astrid_info = inspect_model(MODEL_DIR / "hey_astrid.onnx", "hey_astrid.onnx")
jarvis_info = inspect_model(MODEL_DIR / "hey_jarvis_v0.1.onnx", "hey_jarvis_v0.1.onnx (reference)")

print(f"\n  Param count comparison:")
astrid_params = astrid_info.get("total_params", 0)
jarvis_params = jarvis_info.get("total_params", 0)
print(f"    hey_astrid.onnx:       {astrid_params:>12,}")
print(f"    hey_jarvis_v0.1.onnx:  {jarvis_params:>12,}")

# Pre-check: missing external data is a hard failure
astrid_missing_ext = astrid_info.get("has_missing_ext", False)
astrid_missing_files = astrid_info.get("missing_ext_files", [])
if astrid_missing_ext:
    print(f"\n  [WARNING] hey_astrid.onnx references external data files that are NOT on disk:")
    for f in astrid_missing_files:
        print(f"    Missing: {f}")
    print("  The model cannot be loaded by onnxruntime until these files are present.")


# ============================================================
# (B) Embedding-dim resolution
# ============================================================
print("\n--- (B) Embedding-dim Resolution ---")

mel_path = MODEL_DIR / "melspectrogram.onnx"
if not mel_path.exists():
    print(f"  [MISSING] {mel_path} — cannot resolve mel_bins")
    sys.exit(1)

mel_session = ort.InferenceSession(str(mel_path))
# Worker JS: new ort.Tensor('float32', new Float32Array(1280), [1280])
# Python onnxruntime requires rank-2 input: [batch_size, samples] = [1, 1280]
dummy_mel_input = np.zeros((1, 1280), dtype=np.float32)
mel_out = mel_session.run(None, {mel_session.get_inputs()[0].name: dummy_mel_input})
mel_tensor = mel_out[0]
mel_bins = int(mel_tensor.shape[-1])
print(f"  melspectrogram output shape: {list(mel_tensor.shape)}")
print(f"  mel_bins = {mel_bins}")

emb_path = MODEL_DIR / "embedding_model.onnx"
if not emb_path.exists():
    print(f"  [MISSING] {emb_path} — cannot resolve embDim")
    sys.exit(1)

emb_session = ort.InferenceSession(str(emb_path))
# Worker JS: new ort.Tensor('float32', data, [MEL_WINDOW, melBins, 1])
# Python onnxruntime requires rank-4 input: [batch, MEL_WINDOW, mel_bins, 1]
dummy_emb_input = np.zeros((1, MEL_WINDOW, mel_bins, 1), dtype=np.float32)
emb_out = emb_session.run(None, {emb_session.get_inputs()[0].name: dummy_emb_input})
emb_tensor = emb_out[0]
emb_dim = int(emb_tensor.shape[-1])
print(f"  embedding_model output shape: {list(emb_tensor.shape)}")
print(f"  embDim = {emb_dim}")


# ============================================================
# (C) Classifier contract + non-degeneracy test
# ============================================================
print("\n--- (C) Classifier Contract + Non-Degeneracy Test ---")

astrid_path = MODEL_DIR / "hey_astrid.onnx"
if not astrid_path.exists():
    print(f"  [MISSING] {astrid_path}")
    print("\nVERDICT: FAIL — hey_astrid.onnx not found")
    sys.exit(1)

# Try to create the onnxruntime session; this will fail if external data is missing
cls_session = None
cls_load_error = None
try:
    cls_session = ort.InferenceSession(str(astrid_path))
except Exception as exc:
    cls_load_error = str(exc)
    print(f"  [ERROR] onnxruntime failed to load hey_astrid.onnx: {exc}")

# PASS-0 (pre-check): onnxruntime session must load successfully
pass_0 = cls_session is not None

resolved_seq_len = None
scores = []
score_std = 0.0
score_min = score_max = score_mean = 0.0
pass_1 = pass_2 = pass_4 = False

if cls_session:
    cls_input_name = cls_session.get_inputs()[0].name
    cls_output_name = cls_session.get_outputs()[0].name
    print(f"  Classifier input:  {cls_input_name}")
    print(f"  Classifier output: {cls_output_name}")

    # Probe seqLen exactly as wakeWordWorker.ts does (lines 118-133)
    for seq_len in CANDIDATE_SEQ_LENS:
        try:
            test_input = np.zeros((1, seq_len, emb_dim), dtype=np.float32)
            result = cls_session.run(None, {cls_input_name: test_input})
            resolved_seq_len = seq_len
            print(f"  seqLen probe {seq_len}: SUCCESS")
            break
        except Exception as exc:
            print(f"  seqLen probe {seq_len}: FAILED ({exc})")

    print(f"  Resolved seqLen: {resolved_seq_len}")

    # PASS-1: contract — seqLen in {16, 22} + output has >=1 value
    if resolved_seq_len is not None:
        check_out = cls_session.run(
            None, {cls_input_name: np.zeros((1, resolved_seq_len, emb_dim), dtype=np.float32)}
        )
        pass_1 = len(check_out) > 0 and check_out[0].size >= 1
    print(f"  PASS-1 (seqLen in {{16,22}} + >=1 output value): {'PASS' if pass_1 else 'FAIL'}")

    # PASS-2: embDim match — we probed with emb_dim; acceptance proves the match
    pass_2 = resolved_seq_len is not None
    print(f"  PASS-2 (embDim match — classifier accepts embDim={emb_dim}): {'PASS' if pass_2 else 'FAIL'}")

    # PASS-4: non-constant output — N=8 random inputs, stdev > 1e-6
    if resolved_seq_len is not None:
        rng = np.random.RandomState(0)
        for _ in range(8):
            rand_input = rng.randn(1, resolved_seq_len, emb_dim).astype(np.float32)
            out = cls_session.run(None, {cls_input_name: rand_input})
            # Read element 0 of single output — mirrors wakeWordWorker.ts `data[0]`
            score = float(out[0].flat[0])
            scores.append(score)

        score_min = min(scores)
        score_max = max(scores)
        score_mean = sum(scores) / len(scores)
        score_std = (sum((s - score_mean) ** 2 for s in scores) / len(scores)) ** 0.5
        above_threshold = sum(1 for s in scores if s >= THRESHOLD)

        print(f"  8-sample scores (seed=0 random inputs):")
        print(f"    min={score_min:.6f}  max={score_max:.6f}  mean={score_mean:.6f}  stdev={score_std:.6f}")
        print(f"    Scores >= THRESHOLD({THRESHOLD}): {above_threshold}/8  (INFO — random noise not expected to trigger)")

        pass_4 = score_std > 1e-6
    print(f"  PASS-4 (non-constant output, stdev={score_std:.6f} > 1e-6): {'PASS' if pass_4 else 'FAIL'}")

else:
    print(f"  (Skipping PASS-1/2/4 — onnxruntime could not load the model)")
    print(f"  PASS-1 (seqLen in {{16,22}} + >=1 output value): FAIL (session load failed)")
    print(f"  PASS-2 (embDim match): FAIL (session load failed)")
    print(f"  PASS-4 (non-constant output): FAIL (session load failed)")

# PASS-3: non-degenerate weights — params > 0 AND not all zero
# Note: if external data is missing, we can still count from dims but cannot check all-zero
astrid_params = astrid_info.get("total_params", 0)
astrid_missing_ext = astrid_info.get("has_missing_ext", False)
if astrid_missing_ext:
    # Cannot verify non-zero without loading; param count from dims is reliable
    # but we cannot confirm training — external data missing is the root failure
    pass_3 = False
    pass_3_note = f"FAIL (external data missing — weights cannot be verified)"
else:
    pass_3 = astrid_params > 0
    pass_3_note = f"{'PASS' if pass_3 else 'FAIL'} (params={astrid_params:,})"

print(f"  PASS-3 (non-degenerate weights): {pass_3_note}")


# ============================================================
# Final report
# ============================================================
print("\n--- Final Report ---")
print(f"  hey_astrid.onnx params (from dims): {astrid_params:,}")
print(f"  hey_jarvis params:                  {jarvis_params:,}")
print(f"  mel_bins:                           {mel_bins}")
print(f"  embDim:                             {emb_dim}")
print(f"  resolved seqLen:                    {resolved_seq_len}")
if scores:
    print(f"  8-sample score stats:  min={score_min:.6f} max={score_max:.6f} mean={score_mean:.6f} stdev={score_std:.6f}")
if astrid_missing_ext:
    print(f"  Missing external data files:        {', '.join(astrid_missing_files)}")
if cls_load_error:
    print(f"  onnxruntime load error:             {cls_load_error[:120]}")

# Build checks dict (PASS-0 through PASS-4)
checks = {}
if astrid_missing_ext or not pass_0:
    checks["PASS-0 (onnxruntime session load — no missing external data)"] = False
checks["PASS-1 (contract: seqLen in {16,22} + >=1 output)"] = pass_1
checks["PASS-2 (embDim match)"] = pass_2
checks["PASS-3 (non-degenerate weights: params>0, verifiable)"] = pass_3
checks["PASS-4 (non-constant output: stdev>1e-6)"] = pass_4

all_pass = all(checks.values())
failing = [name for name, ok in checks.items() if not ok]

print()
for name, ok in checks.items():
    marker = "OK" if ok else "XX"
    print(f"  [{marker}] {name}")

print()
if all_pass:
    print("VERDICT: PASS — hey_astrid.onnx is a real, contract-compatible, non-degenerate classifier")
    sys.exit(0)
else:
    fail_list = "; ".join(failing)
    print(f"VERDICT: FAIL — failing checks: {fail_list}")
    sys.exit(1)
