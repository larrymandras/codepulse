/**
 * wakeWordWorker.ts — Web Worker running the three-stage openWakeWord ONNX pipeline.
 *
 * Architecture (mandatory split — RESEARCH Pitfall 2):
 *   AudioWorklet → [Float32Array frames] → this Worker → [wake message] → main thread
 *
 * Pipeline:
 *   Stage 1: melspectrogram.onnx   — 1280 raw samples → [5, mel_bins] mel frames
 *   Stage 2: embedding_model.onnx  — 76-frame mel buffer → [1, 1, 1, 96] embedding
 *   Stage 3: hey_astrid.onnx       — 16×96 embedding buffer → [1, 1] score
 *
 * Mel normalization: apply (v / 10.0) + 2.0 via normalizeMelFrame after Stage 1
 * (RESEARCH Pitfall 1 — omitting this causes near-zero scores always).
 *
 * Threshold: score >= 0.5 AND cooldown >= 2000ms → post { type: 'wake', score }
 *
 * No COOP/COEP required: ort.env.wasm.numThreads = 1 avoids SharedArrayBuffer.
 *
 * Message protocol:
 *   Inbound:  { type: 'init', baseUrl: string }  |  { type: 'frame', samples: Float32Array }
 *   Outbound: { type: 'ready' }  |  { type: 'error', message: string }  |  { type: 'wake', score: number }
 *
 * @see RESEARCH.md §"Pattern 1: Three-Stage ONNX Pipeline"
 * @see src/worklets/micCapture.worklet.ts (the frame source)
 * @see src/lib/melNormalize.ts (the normalization util)
 */

import * as ort from 'onnxruntime-web';
import { normalizeMelFrame } from '../lib/melNormalize';

// ---[ ONNX runtime config — must be set BEFORE any InferenceSession.create ]---
// numThreads=1: prevents COOP/COEP requirement (no SharedArrayBuffer needed).
// wasmPaths: ort 1.17+ loads a paired .wasm + .mjs loader per backend.
//   - PROD: viteStaticCopy emits ort-wasm-*.{wasm,mjs} at the dist/ root → '/'.
//   - DEV: viteStaticCopy does NOT serve those files (Vite's SPA fallback + the
//     .mjs?import module transform shadow them), so a bare '/' yields the HTML
//     fallback and ort reports "no available backend found". Point dev at the
//     pinned jsDelivr CDN, which serves the static runtime as plain assets.
//   Only the WASM binary is fetched from the CDN — captured audio never leaves
//   the browser, so the in-browser privacy model is unchanged.
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = import.meta.env.DEV
  ? 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
  : '/';

// ---[ Detection constants ]---
export const THRESHOLD = 0.5;
export const COOLDOWN_MS = 2000;

// ---[ Fallback model name if hey_astrid.onnx is absent ]---
const CLASSIFIER_PRIMARY = 'hey_astrid.onnx';
const CLASSIFIER_FALLBACK = 'hey_jarvis_v0.1.onnx';

// ---[ Session references ]---
let melSession: ort.InferenceSession | null = null;
let embeddingSession: ort.InferenceSession | null = null;
let classifierSession: ort.InferenceSession | null = null;

// ---[ Resolved model dims (inspected at load — RESEARCH Pitfall 6) ]---
let melBins = 0;         // mel_bins from melspectrogram output (typically 32)
let embDim = 0;          // embedding feature dim (typically 96)
let classifierSeqLen = 0; // classifier sequence length (typically 16, occasionally 22)

// ---[ Stateful sliding-window buffers ]---
// Mel buffer: accumulates mel frames; embedding run fires when >= classifierSeqLen * 8 worth of frames are buffered
// For 76-frame window: we buffer mel frames and slide by 8 per embedding run
const melBuffer: number[] = [];
const embBuffer: number[][] = [];

// ---[ Cooldown tracking ]---
let lastDetectTime = 0;

// ---[ Load ONNX sessions and inspect shapes ]---
async function loadModels(baseUrl: string): Promise<void> {
  // Stage 1: melspectrogram
  melSession = await ort.InferenceSession.create(`${baseUrl}/melspectrogram.onnx`);

  // Stage 2: embedding
  embeddingSession = await ort.InferenceSession.create(`${baseUrl}/embedding_model.onnx`);

  // Stage 3: classifier — try primary (hey_astrid.onnx), fall back to hey_jarvis
  let classifierUrl = `${baseUrl}/${CLASSIFIER_PRIMARY}`;
  try {
    classifierSession = await ort.InferenceSession.create(classifierUrl);
    console.log(`[wakeWordWorker] Loaded classifier: ${CLASSIFIER_PRIMARY}`);
  } catch (_primaryErr) {
    classifierUrl = `${baseUrl}/${CLASSIFIER_FALLBACK}`;
    console.warn(
      `[wakeWordWorker] ${CLASSIFIER_PRIMARY} not found; falling back to ${CLASSIFIER_FALLBACK}`,
    );
    classifierSession = await ort.InferenceSession.create(classifierUrl);
    console.log(`[wakeWordWorker] Loaded classifier (fallback): ${CLASSIFIER_FALLBACK}`);
  }

  // ---[ Runtime shape inspection — RESEARCH Pitfall 6 ]---
  // Melspectrogram output: [5, mel_bins] — extract mel_bins
  const melOutputInfo = melSession.outputNames;
  if (!melOutputInfo.length) throw new Error('melspectrogram.onnx has no output names');
  // Run a dummy inference to get output shape
  // melspectrogram input is rank-2 [batch, samples] — onnxruntime-web 1.27 rejects rank-1.
  const dummyInput = new ort.Tensor('float32', new Float32Array(1280), [1, 1280]);
  const dummyMelOut = await melSession.run({ [melSession.inputNames[0]]: dummyInput });
  const melOutputTensor = dummyMelOut[melSession.outputNames[0]];
  // dims is e.g. [5, 32] — extract mel_bins from last dim
  const melDims = melOutputTensor.dims;
  melBins = Number(melDims[melDims.length - 1]);
  if (!melBins || melBins <= 0) throw new Error(`Unexpected mel output dims: ${JSON.stringify(melDims)}`);
  console.log(`[wakeWordWorker] mel_bins=${melBins}, mel output shape=${JSON.stringify(melDims)}`);

  // Embedding output: [1, 1, 1, 96] — extract embedding dim from last dim
  const MEL_WINDOW = 76; // standard openWakeWord embedding window
  const dummyMelArr = new Float32Array(MEL_WINDOW * melBins);
  // embedding input is rank-4 [batch, 76, mel_bins, 1] — prepend the batch dim.
  const dummyEmbInput = new ort.Tensor('float32', dummyMelArr, [1, MEL_WINDOW, melBins, 1]);
  const dummyEmbOut = await embeddingSession.run({ [embeddingSession.inputNames[0]]: dummyEmbInput });
  const embOutputTensor = dummyEmbOut[embeddingSession.outputNames[0]];
  const embDims = embOutputTensor.dims;
  embDim = Number(embDims[embDims.length - 1]);
  if (!embDim || embDim <= 0) throw new Error(`Unexpected embedding output dims: ${JSON.stringify(embDims)}`);
  console.log(`[wakeWordWorker] embDim=${embDim}, embedding output shape=${JSON.stringify(embDims)}`);

  // Classifier input: [1, seqLen, embDim] — extract seqLen from dim[1]
  const classInputMeta = classifierSession.inputNames;
  if (!classInputMeta.length) throw new Error('classifier has no input names');
  // Derive seqLen by inspecting what the classifier accepts
  // Use a sequence length of 16 as default and handle the shape dynamically
  // by probing with a small dummy (some models accept any length)
  // For openWakeWord classifiers, standard lengths are 16 or 22
  const candidateSeqLens = [16, 22];
  let resolvedSeqLen = 0;
  for (const seqLen of candidateSeqLens) {
    try {
      const testInput = new ort.Tensor(
        'float32',
        new Float32Array(seqLen * embDim),
        [1, seqLen, embDim],
      );
      await classifierSession.run({ [classifierSession.inputNames[0]]: testInput });
      resolvedSeqLen = seqLen;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!resolvedSeqLen) {
    // Last resort: assume 16
    resolvedSeqLen = 16;
    console.warn(`[wakeWordWorker] Could not probe classifier seqLen; assuming ${resolvedSeqLen}`);
  }
  classifierSeqLen = resolvedSeqLen;
  console.log(`[wakeWordWorker] classifierSeqLen=${classifierSeqLen}`);
}

// ---[ Frame processing — exported for unit tests ]---
/**
 * Process one 1280-sample frame through the 3-stage pipeline.
 * Returns the classifier score (0..1), or 0 if buffers are not yet full.
 */
export async function processChunk(samples: Float32Array): Promise<number> {
  if (!melSession || !embeddingSession || !classifierSession) return 0;
  if (!melBins || !embDim || !classifierSeqLen) return 0;

  // ---[ Stage 1: melspectrogram ]---
  const melInput = new ort.Tensor('float32', samples, [1, 1280]);
  const melOut = await melSession.run({ [melSession.inputNames[0]]: melInput });
  const rawMel = Array.from(melOut[melSession.outputNames[0]].data as Float32Array);

  // ---[ Mel normalization — RESEARCH Pitfall 1, MANDATORY ]---
  const normalizedMel = normalizeMelFrame(rawMel);
  melBuffer.push(...normalizedMel);

  const MEL_WINDOW = 76;
  const SLIDE = 8;

  // ---[ Stage 2: embedding — fires when mel buffer is full (76 frames) ]---
  if (melBuffer.length < MEL_WINDOW * melBins) return 0;

  const melSlice = new Float32Array(melBuffer.slice(0, MEL_WINDOW * melBins));
  const embInput = new ort.Tensor('float32', melSlice, [1, MEL_WINDOW, melBins, 1]);
  const embOut = await embeddingSession.run({ [embeddingSession.inputNames[0]]: embInput });
  const embedding = Array.from(embOut[embeddingSession.outputNames[0]].data as Float32Array);
  // Advance sliding window by 8 frames
  melBuffer.splice(0, SLIDE * melBins);

  // ---[ Stage 3: classifier — fires when embedding buffer holds classifierSeqLen embeddings ]---
  embBuffer.push(embedding);
  if (embBuffer.length > classifierSeqLen) embBuffer.shift();
  if (embBuffer.length < classifierSeqLen) return 0;

  const classData = new Float32Array(embBuffer.flat());
  const classInput = new ort.Tensor('float32', classData, [1, classifierSeqLen, embDim]);
  const classOut = await classifierSession.run({
    [classifierSession.inputNames[0]]: classInput,
  });
  const score = (classOut[classifierSession.outputNames[0]].data as Float32Array)[0];
  return score;
}

// ---[ Frame handling — one 1280-sample chunk → score → maybe 'wake' ]---
async function handleFrame(samples: Float32Array): Promise<void> {
  try {
    const score = await processChunk(samples);
    const now = Date.now();
    if (score >= THRESHOLD && now - lastDetectTime > COOLDOWN_MS) {
      lastDetectTime = now;
      self.postMessage({ type: 'wake', score });
    }
  } catch (err) {
    // Swallow per-frame errors — do not crash the Worker on transient ONNX failures.
    console.warn('[wakeWordWorker] processChunk error:', err);
  }
}

// ---[ Message handler ]---
// Mic frames do NOT arrive on self — the AudioWorklet posts them down a
// MessageChannel whose other end is transferred to us via { type: 'port' }. We
// must listen on that port (self.onmessage never sees the worklet's frames).
self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'init'; baseUrl: string }
    | { type: 'port'; port: MessagePort }
    | { type: 'frame'; samples: Float32Array };

  if (msg.type === 'init') {
    try {
      await loadModels(msg.baseUrl);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
    return;
  }

  if (msg.type === 'port') {
    msg.port.onmessage = (fe: MessageEvent) => {
      const fmsg = fe.data as { type?: string; samples?: Float32Array };
      if (fmsg?.type === 'frame' && fmsg.samples) void handleFrame(fmsg.samples);
    };
    msg.port.start?.();
    return;
  }

  // Back-compat: frames posted directly to the worker (unit tests use this path).
  if (msg.type === 'frame') void handleFrame(msg.samples);
};
