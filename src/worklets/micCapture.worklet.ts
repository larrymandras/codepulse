/**
 * MicCaptureProcessor — AudioWorklet for mic capture at 16kHz / 1280-sample frames.
 *
 * Runs in AudioWorkletGlobalScope: NO onnxruntime-web import here.
 * onnxruntime-web cannot load in AudioWorkletGlobalScope (ReferenceError: self is not
 * defined) — RESEARCH Pitfall 2. All ONNX inference lives in wakeWordWorker.ts.
 *
 * Resampling strategy (RESEARCH Pattern 2, §Assumptions A1):
 *   1. Prefer native 16kHz via getUserMedia sampleRate constraint (negotiated in useWakeWord.ts).
 *   2. If AudioContext is created at a different rate (e.g. 48kHz), decimate in process():
 *      keep every N-th sample where N = round(sampleRate / 16000).
 *
 * Frame protocol: when 1280 samples are buffered, zero-copy transfer to the Worker port
 * via postMessage({ type: 'frame', samples }, [buffer.buffer]).
 *
 * @see RESEARCH.md §"Pattern 2: AudioWorklet → Worker Split"
 * @see src/workers/wakeWordWorker.ts (the receiver)
 */

// AudioWorklet runs in a restricted global scope that does not extend the normal
// Worker globalThis. We use inline ambient declarations so the file compiles under
// the standard tsconfig without requiring @types/audioworklet.

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}
declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor,
): void;
// sampleRate is a global in AudioWorkletGlobalScope
declare const sampleRate: number;

const FRAME_SIZE = 1280; // 80ms at 16kHz — non-negotiable for openWakeWord melspectrogram
const TARGET_RATE = 16_000;

class MicCaptureProcessor extends AudioWorkletProcessor {
  private _buffer: Float32Array;
  private _bufferIndex: number;
  private _decimationFactor: number;
  private _decimationCounter: number;
  private _workerPort: MessagePort | null;

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);

    // A MessagePort cannot be passed through processorOptions (structured-cloned,
    // not transferable). useWakeWord transfers the Worker-bound port through the
    // node's .port AFTER construction; capture it here. Frames are dropped (process()
    // no-ops) until it arrives, which is a single tick later.
    this._workerPort = null;
    this.port.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; port?: MessagePort };
      if (data?.type === 'workerPort' && data.port) {
        this._workerPort = data.port;
      }
    };

    this._buffer = new Float32Array(FRAME_SIZE);
    this._bufferIndex = 0;

    // Decimation: if the AudioContext did not honour the 16kHz sampleRate constraint,
    // we keep every N-th sample. N=1 means no decimation (native 16kHz path).
    this._decimationFactor = Math.round(sampleRate / TARGET_RATE) || 1;
    this._decimationCounter = 0;
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (!input || !this._workerPort) return true;

    for (let i = 0; i < input.length; i++) {
      // Decimation: only keep samples at the target rate
      if (this._decimationCounter === 0) {
        this._buffer[this._bufferIndex++] = input[i];

        if (this._bufferIndex >= FRAME_SIZE) {
          // Zero-copy transfer: transfer ownership of the underlying ArrayBuffer
          this._workerPort.postMessage(
            { type: 'frame', samples: this._buffer },
            [this._buffer.buffer],
          );
          // Allocate a fresh buffer immediately after transfer
          this._buffer = new Float32Array(FRAME_SIZE);
          this._bufferIndex = 0;
        }
      }

      this._decimationCounter = (this._decimationCounter + 1) % this._decimationFactor;
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('mic-capture', MicCaptureProcessor);
