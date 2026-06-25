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
# (A) Graph inspection
# ============================================================
def inspect_model(model_path: pathlib.Path, label: str) -> dict:
    """Load and inspect an ONNX model graph; returns summary dict."""
    if not model_path.exists():
        print(f"  [MISSING] {label}: {model_path}")
        return {}

    model = onnx.load(str(model_path))
    try:
        onnx.checker.check_model(model)
        check_status = "OK"
    except Exception as exc:
        check_status = f"FAIL ({exc})"

    graph = model.graph
    opset = model.opset_import[0].version if model.opset_import else "unknown"

    # Count trained parameters and detect all-zero weights
    total_params = 0
    all_zero = True
    for init in graph.initializer:
        arr = onnx.numpy_helper.to_array(init)
        total_params += int(arr.size)
        if arr.any():
            all_zero = False

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
    print(f"    All-zero weights:  {all_zero}")

    return {
        "check_status": check_status,
        "total_params": total_params,
        "all_zero": all_zero,
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


# ============================================================
# (B) Embedding-dim resolution
# ============================================================
print("\n--- (B) Embedding-dim Resolution ---")

# Stage 1: melspectrogram — mirror wakeWordWorker.ts lines 91-98
mel_path = MODEL_DIR / "melspectrogram.onnx"
if not mel_path.exists():
    print(f"  [MISSING] {mel_path} — cannot resolve mel_bins")
    sys.exit(1)

mel_session = ort.InferenceSession(str(mel_path))
# Worker passes a flat Float32Array(1280) with shape [1280]
dummy_mel_input = np.zeros(1280, dtype=np.float32)
mel_out = mel_session.run(None, {mel_session.get_inputs()[0].name: dummy_mel_input})
mel_tensor = mel_out[0]
mel_bins = int(mel_tensor.shape[-1])
print(f"  melspectrogram output shape: {list(mel_tensor.shape)}")
print(f"  mel_bins = {mel_bins}")

# Stage 2: embedding — mirror wakeWordWorker.ts lines 101-108
emb_path = MODEL_DIR / "embedding_model.onnx"
if not emb_path.exists():
    print(f"  [MISSING] {emb_path} — cannot resolve embDim")
    sys.exit(1)

emb_session = ort.InferenceSession(str(emb_path))
# Worker passes [MEL_WINDOW, mel_bins, 1]
dummy_emb_input = np.zeros((MEL_WINDOW, mel_bins, 1), dtype=np.float32)
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

cls_session = ort.InferenceSession(str(astrid_path))
cls_input_name = cls_session.get_inputs()[0].name
cls_output_name = cls_session.get_outputs()[0].name
print(f"  Classifier input:  {cls_input_name}")
print(f"  Classifier output: {cls_output_name}")

# Probe seqLen exactly as wakeWordWorker.ts does (lines 118-133)
resolved_seq_len = None
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
else:
    pass_1 = False
print(f"  PASS-1 (seqLen in {{16,22}} + >=1 output value): {'PASS' if pass_1 else 'FAIL'}")

# PASS-2: embDim match — we probed with emb_dim; acceptance proves the match
pass_2 = resolved_seq_len is not None  # probe used emb_dim as last dim
print(f"  PASS-2 (embDim match — classifier accepts embDim={emb_dim}): {'PASS' if pass_2 else 'FAIL'}")

# PASS-3: non-degenerate weights — params > 0 AND not all zero
astrid_all_zero = astrid_info.get("all_zero", True)
pass_3 = astrid_params > 0 and not astrid_all_zero
print(f"  PASS-3 (non-degenerate weights — params={astrid_params:,}, all-zero={astrid_all_zero}): {'PASS' if pass_3 else 'FAIL'}")

# PASS-4: non-constant output — N=8 random inputs, stdev > 1e-6
scores = []
score_std = 0.0
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
else:
    score_min = score_max = score_mean = 0.0
    pass_4 = False

print(f"  PASS-4 (non-constant output, stdev={score_std:.6f} > 1e-6): {'PASS' if pass_4 else 'FAIL'}")


# ============================================================
# Final report
# ============================================================
print("\n--- Final Report ---")
print(f"  hey_astrid.onnx params:   {astrid_params:,}")
print(f"  hey_jarvis params:        {jarvis_params:,}")
print(f"  mel_bins:                 {mel_bins}")
print(f"  embDim:                   {emb_dim}")
print(f"  resolved seqLen:          {resolved_seq_len}")
if scores:
    print(f"  8-sample score stats:     min={score_min:.6f} max={score_max:.6f} mean={score_mean:.6f} stdev={score_std:.6f}")

checks = {
    "PASS-1 (contract: seqLen in {16,22} + >=1 output)": pass_1,
    "PASS-2 (embDim match)": pass_2,
    "PASS-3 (non-degenerate weights: params>0, non-zero)": pass_3,
    "PASS-4 (non-constant output: stdev>1e-6)": pass_4,
}

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
