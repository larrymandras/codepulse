/**
 * MicCaptureProcessor — AudioWorklet for mic capture at 16kHz / 1280-sample frames.
 *
 * PLAIN JS on purpose. This is the RUNTIME copy, served as a static asset from
 * /public and loaded via `audioWorklet.addModule('/micCapture.worklet.js')`.
 * It must stay plain JS: AudioWorklet cannot parse TypeScript, and Vite copies
 * `new URL('*.ts', import.meta.url)` assets WITHOUT transpiling in a production
 * build — that shipped the raw .ts and broke addModule on the Vercel deploy
 * ("Unable to load a worklet's module"). Keep in sync with the frame protocol
 * documented in src/hooks/useWakeWord.ts and src/workers/wakeWordWorker.ts.
 *
 * Runs in AudioWorkletGlobalScope: NO onnxruntime-web here (self is undefined
 * there — RESEARCH Pitfall 2). All ONNX inference lives in wakeWordWorker.ts.
 *
 * Resampling: prefer native 16kHz via the getUserMedia sampleRate constraint;
 * if the AudioContext runs at another rate (e.g. 48kHz), decimate in process()
 * by keeping every N-th sample where N = round(sampleRate / 16000).
 *
 * Frame protocol: when 1280 samples are buffered, zero-copy transfer to the
 * Worker port via postMessage({ type: 'frame', samples }, [samples.buffer]).
 */

const FRAME_SIZE = 1280; // 80ms at 16kHz — required by the openWakeWord melspectrogram
const TARGET_RATE = 16000;

class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);

    // A MessagePort cannot be passed through processorOptions (structured-cloned,
    // not transferable). useWakeWord transfers the Worker-bound port through the
    // node's .port AFTER construction; capture it here. Frames are dropped
    // (process() no-ops) until it arrives, which is a single tick later.
    this._workerPort = null;
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === "workerPort" && data.port) {
        this._workerPort = data.port;
      }
    };

    this._buffer = new Float32Array(FRAME_SIZE);
    this._bufferIndex = 0;

    // Decimation: if the AudioContext did not honour the 16kHz sampleRate
    // constraint, keep every N-th sample. N=1 means no decimation (native 16kHz).
    this._decimationFactor = Math.round(sampleRate / TARGET_RATE) || 1;
    this._decimationCounter = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input || !this._workerPort) return true;

    for (let i = 0; i < input.length; i++) {
      // Only keep samples at the target rate
      if (this._decimationCounter === 0) {
        this._buffer[this._bufferIndex++] = input[i];

        if (this._bufferIndex >= FRAME_SIZE) {
          // Zero-copy transfer: hand off ownership of the underlying ArrayBuffer
          this._workerPort.postMessage(
            { type: "frame", samples: this._buffer },
            [this._buffer.buffer],
          );
          // Allocate a fresh buffer immediately after transfer
          this._buffer = new Float32Array(FRAME_SIZE);
          this._bufferIndex = 0;
        }
      }

      this._decimationCounter =
        (this._decimationCounter + 1) % this._decimationFactor;
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("mic-capture", MicCaptureProcessor);
