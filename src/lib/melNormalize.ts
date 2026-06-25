/**
 * Normalize a mel-spectrogram frame for openWakeWord embedding input.
 *
 * Transform: output = (value / 10.0) + 2.0 — mandatory for trained-model compatibility.
 * Apply to every element of melspectrogram.onnx output before feeding embedding_model.onnx.
 * Omitting this normalization causes near-zero classifier scores regardless of audio input.
 *
 * @see RESEARCH.md §"Pattern 1: Three-Stage ONNX Pipeline" / §"Pitfall 1"
 */
export function normalizeMelFrame(frame: number[] | Float32Array): number[] {
  const result: number[] = new Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    result[i] = (frame[i] / 10.0) + 2.0;
  }
  return result;
}
