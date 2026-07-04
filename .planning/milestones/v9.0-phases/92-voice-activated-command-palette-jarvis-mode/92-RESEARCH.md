# Phase 92: Voice-Activated Command Palette (Jarvis Mode) — Research

**Researched:** 2026-06-24
**Domain:** Browser wake-word detection (openWakeWord / onnxruntime-web) + Web Speech API + WebSocket voice command turn loop
**Confidence:** HIGH (core stack), MEDIUM (ONNX tensor shapes), HIGH (CodePulse integration points)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Continuous Jarvis conversation — after reply, keep listening for follow-ups without re-wake. Exit on end-phrase ("stop", "thanks", "goodbye") or ~30s silence timeout.
- **D-02:** Client-side turn loop: restart STT after `run.completed` + TTS playback ends. Guard against self-transcription by pausing recognition during TTS. Barge-in may be deferred.
- **D-03a:** openWakeWord (Apache-2.0) on `onnxruntime-web`, NOT Picovoice. No account/key/quota.
- **D-03b:** Detection in Web Worker / AudioWorklet feeding 16kHz frames to ONNX graph. Three ONNX assets in `public/openwakeword/`.
- **D-03:** Wake phrase = "Hey Astrid". Custom model trained via openWakeWord synthetic-data pipeline. Built-in "hey jarvis" model is fallback/validation only.
- **D-04:** Replies spoken in Ástríðr's ElevenLabs voice, resolved server-side. CodePulse plays `run.tts` `audio_url` unchanged.
- **D-05:** Reuse existing `CommandPalette` (`src/components/CommandPalette.tsx`) in "voice mode". No separate HUD.
- **D-06:** Always-on listening OFF by default. Mic toggle in DashboardLayout top bar. Persisted to localStorage. Persistent "listening" indicator while ON.
- **D-07:** Graceful degradation mandatory. ONNX model load failure → clear disabled state, no crash, no silent always-on mic.

### Claude's Discretion
- Exact Web Worker / AudioWorklet wiring for openWakeWord on `onnxruntime-web` (WASM vs WebGPU backend, frame buffering, detection threshold/debounce)
- Listening-state visual treatment inside the palette
- End-phrase list
- Silence timeout value (~30s starting point)
- Whether barge-in lands in MVP or follow-on

### Deferred Ideas (OUT OF SCOPE)
- "Hermes" persona
- Multi-persona selection / persona-name wake words
- Server-side Whisper STT (MediaRecorder → `/api/chat/voice`)
- Barge-in (interrupt TTS by speaking) — assess during planning
- War Room / LiveKit voice (Phase 90)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOX-01 | Wake word ("Hey Astrid") detected in-browser via openWakeWord ONNX + onnxruntime-web in Web Worker/AudioWorklet; triggers palette open in voice mode within ~1s; no audio leaves machine for wake detection | ONNX pipeline mechanics, AudioWorklet→Worker split, tensor shapes, threshold confirmed |
| VOX-02 | Spoken command transcribed via Web Speech API (reusing ChatInput.tsx logic), shown as live transcript, sent via existing `sendCommand({type:"chat.send", message})` over AstridrWSContext | ChatInput.tsx extraction path confirmed line-by-line |
| VOX-03 | Streamed reply renders in palette (`run.text`); `run.tts` `audio_url` auto-plays via shared `useTtsPlayback` hook extracted from Chat.tsx (no duplicate logic) | Chat.tsx TTS logic isolated; extraction pattern clear |
| VOX-04 | Voice mode OFF by default; explicit toggle; persistent "listening" indicator; ONNX failure degrades gracefully (disabled state, no crash, no silent mic) | Degradation pattern and localStorage persistence confirmed |
</phase_requirements>

---

## Summary

Phase 92 adds browser-side always-on wake-word detection and a voice conversation mode to the existing `CommandPalette`. The research confirms the technical path is viable with no blocking unknowns, but several precise mechanics must be wired correctly.

**The custom "hey_astrid.onnx" classifier is the only missing asset.** The two shared openWakeWord ONNX models (`melspectrogram.onnx`, `embedding_model.onnx`) are already present in `public/openwakeword/` at versions pinned to openWakeWord v0.5.1. The classifier must be trained via the Colab notebook before MVP ships — this is the only external dependency that is a genuine blocker for end-to-end testing.

**onnxruntime-web CANNOT run inside an AudioWorklet** (confirmed open issue, `ReferenceError: self is not defined`). The correct architecture is a **split**: AudioWorklet captures mic audio at the hardware sample rate and posts 1280-sample (80ms) chunks to a **Web Worker**; the Web Worker runs all three ONNX sessions and posts a `"wake"` message to the main thread when the classifier exceeds threshold. This is the architecture used by the reference `openwakeword_wasm` wrapper.

**Vite 7 requires two explicit config changes** to serve onnxruntime-web correctly: `optimizeDeps.exclude: ["onnxruntime-web"]` and `vite-plugin-static-copy` to copy `*.wasm` files from `node_modules/onnxruntime-web/dist/` to `dist/`. Multi-threaded WASM requires COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`) for `SharedArrayBuffer`. **Setting `ort.env.wasm.numThreads = 1` before session creation avoids the COOP/COEP requirement entirely** and is the recommended default for a dashboard app that does not need maximum throughput — wake-word inference on 80ms frames is not latency-critical enough to require threading.

The CodePulse integration points are well-mapped. `sendCommand`, `subscribeEvent`, and `setPaletteOpen` are all stable, stable-ref APIs. The Web Speech API recognition logic in `ChatInput.tsx` (lines 54–170) and TTS playback in `Chat.tsx` (lines 63–86) are clean, self-contained, and ready to extract.

**Primary recommendation:** Split architecture (AudioWorklet → Web Worker → main thread), single-threaded WASM to skip COOP/COEP, localStorage-persisted toggle, custom model training gated as Wave 0 prerequisite task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wake-word detection (ONNX inference) | Browser / Web Worker | AudioWorklet (capture only) | onnxruntime-web cannot run in AudioWorkletGlobalScope; inference must be in Worker |
| Mic audio capture + resampling | Browser / AudioWorklet | — | AudioWorklet runs on dedicated audio thread; low-latency, not blocked by JS main thread |
| Speech recognition (post-wake STT) | Browser / Main thread | — | Web Speech API is main-thread only; no Worker access |
| Turn-loop state machine | Browser / Main thread (React) | — | React state drives palette UI; all state in DashboardLayout + new useWakeWord hook |
| chat.send + event subscription | Browser / Main thread via AstridrWSContext | — | Existing WS transport; no change |
| TTS playback | Browser / Main thread | — | `<audio>` element; already working in Chat.tsx |
| Persona→voice resolution | Ástríðr backend | — | Server-side `VoiceIdentityResolver`; CodePulse never touches voice IDs |
| Voice mode persistence (on/off) | Browser / localStorage | — | Matches existing CRT toggle pattern (DashboardLayout.tsx:534) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `onnxruntime-web` | 1.27.0 | Run openWakeWord ONNX models in-browser (WASM backend) | Official Microsoft ONNX Runtime port; no alternative for client-side ONNX |
| Web Speech API | Browser-native | Post-wake command STT | Already used in `ChatInput.tsx`; no install needed |
| Web Audio API (AudioContext, AudioWorklet) | Browser-native | Mic capture + 16kHz resampling | Standard; already used by Tone.js ambient audio in project |
| openWakeWord ONNX models v0.5.1 | Pre-downloaded | melspectrogram + embedding; present in `public/openwakeword/` | Official release; already present |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite-plugin-static-copy` | 4.1.1 | Copy `*.wasm` from `node_modules/onnxruntime-web/dist/` to `dist/` at build time | Required — Vite does not auto-copy node_modules WASM files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Split AudioWorklet+Worker | SharedArrayBuffer ring buffer (requires COOP/COEP) | COOP/COEP has production hosting implications; skip for MVP |
| `ort.env.wasm.numThreads = 1` | Multi-threaded WASM (default) | Multi-thread requires COOP/COEP headers; single-thread is sufficient for 80ms frames |
| Extracting useSpeechRecognition hook | Duplicating ChatInput logic | Duplication violates VOX-03; extract is mandatory |
| `vite-plugin-static-copy` | Manual `public/` copy of WASM files | Manual copy works but ties to exact onnxruntime-web version; plugin is cleaner |

**Installation:**

```bash
npm install onnxruntime-web
npm install --save-dev vite-plugin-static-copy
```

**Version verification (confirmed 2026-06-24):**

```
onnxruntime-web@1.27.0  — published 2026-06-19 (Microsoft/onnxruntime) [VERIFIED: npm registry]
vite-plugin-static-copy@4.1.1  — published 2021-12-07, active maintenance (sapphi-red/vite-plugin-static-copy) [VERIFIED: npm registry]
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `onnxruntime-web` | npm | ~4 yrs | github.com/Microsoft/onnxruntime | [OK] | Approved |
| `vite-plugin-static-copy` | npm | ~4.5 yrs | github.com/sapphi-red/vite-plugin-static-copy | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Mic (getUserMedia)]
        │  hardware sample rate (44.1k/48kHz)
        ▼
[AudioWorklet — 1280-sample chunks]
   resamples to 16kHz (OfflineAudioContext or manual decimation)
        │  Float32Array[1280] via postMessage
        ▼
[Web Worker — onnxruntime-web WASM]
   ┌──────────────────────────────────┐
   │ Stage 1: melspectrogram.onnx     │ Float32[1280] → mel frames [5, mel_bins]
   │ Stage 2: embedding_model.onnx    │ mel buffer [76 frames] → embedding [96]
   │ Stage 3: hey_astrid.onnx         │ embedding buffer [16×96] → score [0..1]
   └──────────────────────────────────┘
   score >= 0.5 AND cooldown elapsed?
        │  postMessage("wake")
        ▼
[Main Thread — DashboardLayout.tsx]
   setPaletteOpen(true) + set voiceMode=true
        │
        ▼
[CommandPalette → VoiceModePanel]
   state: IDLE → LISTENING
        │
   [Web Speech API — recognition.start()]
        │  onresult → interim/final transcript
        ▼
   final transcript → sendCommand({type:"chat.send", message})
        │
        ▼
[AstridrWSContext WebSocket → Ástríðr backend]
        │  run.text events → append to VoiceReplyStream
        │  run.tts  event  → useTtsPlayback.play(audio_url)
        │  run.completed   → restart STT (next turn)
        ▼
[useTtsPlayback hook — <audio> element]
   playing: pause STT (feedback guard)
   ended:   resume STT (next turn)
```

### Recommended Project Structure (new files only)

```
src/
├── hooks/
│   ├── useWakeWord.ts        # openWakeWord orchestrator: Worker lifecycle, wake event
│   ├── useSpeechRecognition.ts  # extracted from ChatInput.tsx; shared hook
│   └── useTtsPlayback.ts     # extracted from Chat.tsx; shared hook
├── workers/
│   └── wakeWordWorker.ts     # Web Worker: onnxruntime-web sessions + 3-stage pipeline
├── worklets/
│   └── micCapture.worklet.ts # AudioWorklet: mic → 16kHz chunks → postMessage to Worker
└── components/
    └── VoiceModePanel.tsx    # Voice UI inside CommandPalette (or inline in CommandPalette.tsx)

public/openwakeword/
├── melspectrogram.onnx   ✅ present (1.04 MB)
├── embedding_model.onnx  ✅ present (1.27 MB)
└── hey_astrid.onnx       ⏳ PENDING — must train before integration tests
```

### Pattern 1: Three-Stage ONNX Pipeline in Web Worker

The critical mechanics verified by the Deep Core Labs reference implementation:

**Frame format:** 16kHz, 16-bit PCM (or Float32), 1280 samples = 80ms per chunk. This is non-negotiable — openWakeWord's mel model expects exactly 1280 samples per call.

**Mel normalization:** After melspectrogram.onnx, apply `output = (value / 10.0) + 2.0` to each element. This transform is mandatory for trained-model compatibility and is NOT optional.

**Dual stateful buffers:**
- Mel buffer: holds 76 frames, advances 8 frames per inference call
- Embedding buffer: circular buffer of 16 embeddings × 96 features each

**Tensor shapes (MEDIUM confidence — verified via reference impl + GitHub issue #175; not in official docs):**

| Model | Input shape | Input dtype | Output shape |
|-------|-------------|-------------|--------------|
| `melspectrogram.onnx` | `[1280]` float32 | float32 | `[5, mel_bins]` float32 |
| `embedding_model.onnx` | `[76, mel_bins, 1]` float32 | float32 | `[1, 1, 1, 96]` float32 |
| `hey_astrid.onnx` (classifier) | `[1, 16, 96]` float32 | float32 | `[1, 1]` float32 (score) |

**Important:** Tensor shapes vary slightly by openWakeWord release and model. The executor MUST call `session.inputNames` and `session.outputNames` + inspect actual shapes on first load. Hardcoding shapes without runtime verification causes silent failures.

```typescript
// Source: Deep Core Labs openWakeWord browser impl + onnxruntime-web docs
// [VERIFIED: deepcorelabs.com/open-wake-word-on-the-web/ + github.com/dnavarrom/openwakeword_wasm]

// wakeWordWorker.ts (Web Worker scope)
import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = 1;       // No COOP/COEP needed
ort.env.wasm.wasmPaths = '/ort/';  // Set to wherever wasm files are served

let melSession: ort.InferenceSession;
let embeddingSession: ort.InferenceSession;
let classifierSession: ort.InferenceSession;

// Stateful buffers
const melBuffer: number[] = [];    // Accumulates mel frames (target: 76)
const embBuffer: number[][] = [];  // Circular: 16 × 96 embeddings
let lastDetectTime = 0;
const COOLDOWN_MS = 2000;
const THRESHOLD = 0.5;

async function loadModels(baseUrl: string) {
  melSession = await ort.InferenceSession.create(`${baseUrl}/melspectrogram.onnx`);
  embeddingSession = await ort.InferenceSession.create(`${baseUrl}/embedding_model.onnx`);
  classifierSession = await ort.InferenceSession.create(`${baseUrl}/hey_astrid.onnx`);
}

async function processChunk(samples: Float32Array): Promise<number> {
  // Stage 1: mel
  const melInput = new ort.Tensor('float32', samples, [1280]);
  const melOut = await melSession.run({ [melSession.inputNames[0]]: melInput });
  let melFrames = Array.from(melOut[melSession.outputNames[0]].data as Float32Array);
  // Normalize: (val / 10.0) + 2.0
  melFrames = melFrames.map(v => (v / 10.0) + 2.0);
  melBuffer.push(...melFrames);    // Each call produces 5 mel frames

  if (melBuffer.length < 76 * MEL_BINS) return 0; // Buffer not full yet

  // Stage 2: embedding (run when buffer has 76 frames)
  const melTensor = new ort.Tensor('float32', new Float32Array(melBuffer.slice(0, 76 * MEL_BINS)), [76, MEL_BINS, 1]);
  const embOut = await embeddingSession.run({ [embeddingSession.inputNames[0]]: melTensor });
  const embedding = Array.from(embOut[embeddingSession.outputNames[0]].data as Float32Array); // 96 values
  melBuffer.splice(0, 8 * MEL_BINS); // Advance 8 frames (sliding window)

  // Stage 3: classifier
  embBuffer.push(embedding);
  if (embBuffer.length > 16) embBuffer.shift(); // Keep last 16
  if (embBuffer.length < 16) return 0;

  const classInput = new ort.Tensor('float32', new Float32Array(embBuffer.flat()), [1, 16, 96]);
  const classOut = await classifierSession.run({ [classifierSession.inputNames[0]]: classInput });
  return (classOut[classifierSession.outputNames[0]].data as Float32Array)[0];
}

self.onmessage = async (e) => {
  if (e.data.type === 'init') {
    try {
      await loadModels(e.data.baseUrl);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
  } else if (e.data.type === 'frame') {
    const score = await processChunk(e.data.samples as Float32Array);
    const now = Date.now();
    if (score >= THRESHOLD && now - lastDetectTime > COOLDOWN_MS) {
      lastDetectTime = now;
      self.postMessage({ type: 'wake', score });
    }
  }
};
```

### Pattern 2: AudioWorklet → Worker Split (Mic Capture)

AudioWorklet runs on a dedicated real-time audio thread. onnxruntime-web cannot import there. The worklet's only job is to accumulate samples and post to the Worker.

```typescript
// micCapture.worklet.ts — runs in AudioWorkletGlobalScope (NO onnxruntime here)
// Source: Web Audio API standard + Deep Core Labs impl [VERIFIED: deepcorelabs.com]
class MicCaptureProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array = new Float32Array(1280);
  private bufferIndex = 0;
  private port: MessagePort;

  constructor(options: AudioWorkletNodeOptions) {
    super(options);
    this.port = options.processorOptions?.workerPort as MessagePort;
  }

  process(inputs: Float32Array[][]) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    // input is at AudioContext.sampleRate (44.1k or 48kHz) — must downsample to 16kHz
    // Simplest approach: collect at native rate, resample in Worker
    // OR: use OfflineAudioContext in the Worker to resample before ONNX
    for (const sample of input) {
      this.buffer[this.bufferIndex++] = sample;
      if (this.bufferIndex >= 1280) {
        // Transfer ownership — zero-copy
        this.port.postMessage({ type: 'frame', samples: this.buffer }, [this.buffer.buffer]);
        this.buffer = new Float32Array(1280);
        this.bufferIndex = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCaptureProcessor);
```

**Resampling note:** Browsers capture mic at 44.1kHz or 48kHz, not 16kHz. Resampling must happen before the ONNX pipeline. Options (in order of preference for MVP):
1. Request `sampleRate: 16000` in `getUserMedia` constraints — works on Chrome desktop, not guaranteed cross-browser.
2. Use `OfflineAudioContext` in the Worker to resample the raw buffer from hardware rate to 16kHz before ONNX inference. Reliable and cross-browser. [ASSUMED — not confirmed on all target browsers]
3. Decimation in the AudioWorklet: collect at 48kHz, keep every 3rd sample (decimation by 3 = 16kHz). Simple but lower quality (no anti-aliasing filter). Acceptable for wake detection.

**Recommended for MVP:** Try `sampleRate: 16000` constraint first; if AudioContext creation succeeds at 16kHz, no resampling needed. Fall back to decimation in the worklet if context creates at a different rate.

### Pattern 3: useWakeWord Hook (Main Thread)

```typescript
// src/hooks/useWakeWord.ts
// [ASSUMED — pattern derived from openwakeword_wasm reference impl]
export type WakeWordStatus = 'idle' | 'loading' | 'ready' | 'error-disabled';

export interface UseWakeWordReturn {
  status: WakeWordStatus;
  errorReason: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Usage in DashboardLayout:
// const { status, errorReason, start, stop } = useWakeWord({
//   baseUrl: '/openwakeword',
//   onWake: () => { setPaletteOpen(true); setVoiceMode(true); },
// });
```

### Pattern 4: useSpeechRecognition Hook (Extracted)

The `startListening` / `stopListening` / `getSpeechRecognitionClass` logic in `ChatInput.tsx` lines 54–170 maps cleanly to a hook. Key difference for palette voice mode: `continuous: true` (default in ChatInput is `false`), and the hook must expose `interimTranscript` for live display.

```typescript
// src/hooks/useSpeechRecognition.ts
export interface UseSpeechRecognitionOptions {
  continuous?: boolean;          // false for ChatInput, true for palette voice mode
  interimResults?: boolean;      // true for palette (shows interim transcript)
  lang?: string;
  onFinalResult: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onEnd?: () => void;
}
// Returns: { start, stop, isListening, speechAvailable }
```

**ChatInput.tsx compatibility:** ChatInput continues working by calling `useSpeechRecognition({ continuous: false, interimResults: false, ... })`. The extracted hook is a strict superset of the existing inline logic.

### Pattern 5: useTtsPlayback Hook (Extracted)

From `Chat.tsx` lines 63–86 (`playAudio`, `audioRef`, `onended` cleanup):

```typescript
// src/hooks/useTtsPlayback.ts
export interface UseTtsPlaybackReturn {
  play: (url: string) => void;
  stop: () => void;
  isPlaying: boolean;   // NEW — palette voice mode uses this for feedback guard
}
// isPlaying is set true on play(), false in audio.onended
// Chat.tsx passes isPlaying down to ChatInput disabled state (TTS guard)
// Palette voice mode pauses STT recognition when isPlaying === true
```

### Pattern 6: Vite Configuration Changes

```typescript
// vite.config.ts additions
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // ... existing config
  optimizeDeps: {
    exclude: ['onnxruntime-web'],  // Prevent Vite pre-bundling WASM module
  },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: '.',  // copies to dist/ root; matches default wasmPaths behavior
        },
      ],
    }),
  ],
});
```

In worker init code, set `ort.env.wasm.wasmPaths = '/';` (or the actual public base path) before creating any session.

**COOP/COEP:** NOT required when `ort.env.wasm.numThreads = 1`. Only needed for SharedArrayBuffer (multi-threaded WASM). Skip for MVP.

### Pattern 7: Turn-Loop State Machine

Mirrors `astridr/channels/voice.py:42-138` client-side. States in order:

```
IDLE (toggle OFF) 
  → [toggle ON + model loaded] → LISTENING (wake detection hot, STT idle)
      → [wake detected] → (open palette, start STT)
      → [STT interim result] → TRANSCRIBING
      → [STT final result] → sendCommand() → PROCESSING
      → [first run.text event] → (render reply) → still PROCESSING
      → [run.tts audio starts] → SPEAKING (STT paused — feedback guard)
      → [audio.onended] → LISTENING (next turn — no re-wake needed)
      → [end phrase OR 30s silence] → LISTENING (close palette, reset)
  → [toggle OFF OR error] → IDLE
```

**Feedback guard implementation:**
```typescript
// When TTS starts playing:
recognition.stop();   // pause STT
// When TTS audio.onended:
recognition.start();  // resume STT for next turn
```

**End-phrase detection (mirrors voice.py:136-138):**
```typescript
const END_PHRASES = ["goodbye", "that's all", "thanks", "stop"];
function isEndPhrase(text: string): boolean {
  return END_PHRASES.includes(text.toLowerCase().trim());
}
```

### Anti-Patterns to Avoid

- **Running onnxruntime-web inside AudioWorklet:** Always fails with `ReferenceError: self is not defined`. The AudioWorklet's `AudioWorkletGlobalScope` is not a standard Worker scope. Inference MUST be in a separate `new Worker()`.
- **Hardcoding tensor shapes:** Use `session.inputNames[0]` and inspect `.dims` at runtime. Shapes vary by openWakeWord version.
- **Shipping without `optimizeDeps.exclude`:** Vite tries to pre-bundle onnxruntime-web and produces broken output (magic bytes error: `found 3c 21 44 4f` — it served the error HTML instead of the WASM).
- **Not guarding STT during TTS playback:** Web Speech API will transcribe Ástríðr's own spoken reply, triggering another turn with the reply as the command.
- **Calling `recognition.start()` while recognition is already active:** Throws `InvalidStateError`. Always check `isListening` state before starting.
- **Enabling multi-threaded WASM without COOP/COEP headers:** `SharedArrayBuffer` is unavailable without cross-origin isolation; onnxruntime-web silently falls back to single-thread anyway, but may log warnings. Set `numThreads = 1` explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ONNX model inference in browser | Custom tensor math / WebGL shaders | `onnxruntime-web` | ONNX graph execution with fused ops, WASM SIMD, WebGPU — years of optimization |
| Mel spectrogram | Custom FFT + filterbank | `melspectrogram.onnx` (already in `public/`) | openWakeWord's ONNX mel impl with fixed parameters tuned for the models |
| Wake phrase recognition | Keyword matching on Web Speech transcripts | openWakeWord classifier | False positive rate is orders of magnitude higher with text matching; openWakeWord detects before command STT even starts |
| Resampling from 48kHz to 16kHz | Manual decimation | `getUserMedia({ sampleRate: 16000 })` first; `OfflineAudioContext` fallback | Decimation without anti-aliasing filter aliases high-frequency content into the 0–8kHz band |
| TTS playback | New `<audio>` element per hook | `useTtsPlayback` extracted from `Chat.tsx` | Avoid duplicate Audio objects competing for the same URL; Chat and palette must share one playback path |

**Key insight:** The entire wake-detection signal-processing chain (mel → embedding → classifier) is already implemented in the three ONNX models. The browser implementation is a data-flow harness, not a DSP implementation.

---

## Common Pitfalls

### Pitfall 1: mel frame normalization forgotten
**What goes wrong:** Model produces near-zero scores for all audio — wake word never detected.
**Why it happens:** The melspectrogram.onnx output is raw log-power; the embedding model expects it normalized to the range used during training.
**How to avoid:** Always apply `frame = (frame / 10.0) + 2.0` to every mel output value before feeding the embedding model.
**Warning signs:** Classifier score stays < 0.01 even when saying the wake word loudly into the mic.

### Pitfall 2: onnxruntime-web in AudioWorklet scope
**What goes wrong:** `ReferenceError: self is not defined` — worklet crashes on import.
**Why it happens:** `AudioWorkletGlobalScope` does not expose the `self` global that onnxruntime-web expects; ES module imports inside addModule are also restricted.
**How to avoid:** All onnxruntime-web code lives in a `new Worker()` (separate file). AudioWorklet only captures and forwards audio frames.
**Warning signs:** Console error on `audioWorkletNode.port.postMessage` or on AudioContext `addModule` — or worker imports fail silently.

### Pitfall 3: WASM files not found in production build
**What goes wrong:** `Failed to fetch ort-wasm-simd.wasm` — ONNX sessions fail to create.
**Why it happens:** Vite does not automatically copy WASM files from `node_modules/` to `dist/`.
**How to avoid:** Add `vite-plugin-static-copy` targeting `node_modules/onnxruntime-web/dist/*.wasm` → `dist/.` AND set `optimizeDeps.exclude: ['onnxruntime-web']`.
**Warning signs:** Works in `vite dev` (serves from node_modules), breaks in `vite build` / `vite preview`.

### Pitfall 4: Self-transcription feedback loop
**What goes wrong:** After Ástríðr speaks a reply, the mic transcribes the TTS audio as the next command, creating an infinite loop.
**Why it happens:** Web Speech API is active during TTS playback.
**How to avoid:** In `useTtsPlayback`, expose `isPlaying` state. Pause `recognition.stop()` when playback starts, call `recognition.start()` in `audio.onended`.
**Warning signs:** Observe that `sendCommand` is called immediately after TTS finishes with content matching the spoken reply.

### Pitfall 5: hey_astrid.onnx not trained before integration testing
**What goes wrong:** Can only test with "hey jarvis" fallback model; the shipped phrase never detects.
**Why it happens:** The custom model is a Colab training artifact (~30–60 min to train).
**How to avoid:** Treat model training as Wave 0 prerequisite. The hey_jarvis built-in model works for integration testing; `hey_astrid.onnx` must be in place before QA sign-off.
**Warning signs:** README in `public/openwakeword/` explicitly marks `hey_astrid.onnx` as `⏳ PENDING`.

### Pitfall 6: Tensor shape mismatch after model update
**What goes wrong:** `OrtError: shape mismatch` — inference fails if model files are replaced.
**Why it happens:** openWakeWord classifier input shapes vary (some models expect `[1,16,96]`, others `[1,22,96]`).
**How to avoid:** Runtime-inspect `session.inputNames` and model input dims on session create. Log them. Assert embedding buffer length matches expected classifier input dim.
**Warning signs:** Error in Worker immediately after classifier session `run()`.

### Pitfall 7: Vite pre-bundling onnxruntime-web
**What goes wrong:** ONNX model file content is served as HTML (magic bytes `3c 21 44 4f` = `<!DO`), crashing session creation.
**Why it happens:** Without `optimizeDeps.exclude`, Vite transforms the module and corrupts the WASM binary path resolution.
**How to avoid:** Add `optimizeDeps: { exclude: ['onnxruntime-web'] }` in `vite.config.ts`.

---

## Code Examples

### Loading Models with Error Handling (D-07 Graceful Degradation)

```typescript
// Source: onnxruntime-web docs + openwakeword_wasm reference [CITED: onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html]
async function initWakeWordWorker(): Promise<Worker | null> {
  try {
    const worker = new Worker(
      new URL('../workers/wakeWordWorker.ts', import.meta.url),
      { type: 'module' }
    );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker init timeout')), 10_000);
      worker.onmessage = (e) => {
        if (e.data.type === 'ready') { clearTimeout(timeout); resolve(); }
        if (e.data.type === 'error') { clearTimeout(timeout); reject(new Error(e.data.message)); }
      };
      worker.postMessage({ type: 'init', baseUrl: '/openwakeword' });
    });
    return worker;
  } catch (err) {
    // D-07: surface error reason to UI, never crash
    console.error('Wake word init failed:', err);
    return null;  // null → useWakeWord returns status:'error-disabled'
  }
}
```

### Web Speech Recognition (extracted from ChatInput.tsx:127–170)

The existing `ChatInput.tsx` recognition uses `continuous: false, interimResults: false`. The palette voice mode needs `continuous: true, interimResults: true`. The `useSpeechRecognition` hook must support both modes via options. The core event handlers are identical — only the constructor options differ.

```typescript
// Key config difference for voice mode (vs ChatInput):
recognition.continuous = true;      // keep listening between sentences
recognition.interimResults = true;  // fire onresult with isFinal=false for live transcript
```

### Audio URL Construction (from Chat.tsx:262–264)

```typescript
// Already in Chat.tsx — extract to useTtsPlayback:
// Source: src/pages/Chat.tsx:262 [VERIFIED: live codebase]
const fullUrl = data.audio_url.startsWith("http")
  ? data.audio_url
  : `${ASTRIDR_API_URL}${data.audio_url}`;
```

### AudioContext sample rate negotiation

```typescript
// Source: Web Audio API spec + MDN [ASSUMED — not all browsers honor sampleRate constraint]
async function openMicAt16kHz(): Promise<MediaStream> {
  try {
    // Try native 16kHz first (Chrome desktop supports it)
    return await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: { ideal: 16000 }, channelCount: 1, echoCancellation: true }
    });
  } catch {
    // Fall back to default rate — worklet will decimate to 16kHz
    return await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true }
    });
  }
}
```

---

## Runtime State Inventory

*Omitted: this is a greenfield feature addition. No existing stored data, service config, OS-registered state, secrets, or build artifacts require migration. The `public/openwakeword/` directory was created as part of Phase 92 setup (not a rename/refactor).*

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Package install | ✓ | (project already running) | — |
| Browser Web Speech API | Post-wake STT (VOX-02) | Chrome/Edge ✓; Firefox ✗; Safari partial | browser-native | Hide mic button if `getSpeechRecognitionClass() === null` — same guard as ChatInput.tsx:75 |
| Browser AudioWorklet | Mic capture | Chrome/Edge/Firefox/Safari ✓ (all modern) | browser-native | ScriptProcessorNode deprecated fallback (not recommended; skip for MVP) |
| Browser WebAssembly | onnxruntime-web WASM backend | ✓ all modern browsers | browser-native | No fallback — show error-disabled if WASM unavailable |
| `hey_astrid.onnx` | Wake detection (VOX-01) | ✗ PENDING training | — | Use `hey_jarvis_v0.1.onnx` for dev/integration testing ONLY |

**Missing dependencies with no fallback:**
- `hey_astrid.onnx` — blocks production wake detection. Must be trained via Colab before final QA. Dev testing uses "hey jarvis" substitute.

**Missing dependencies with fallback:**
- Web Speech API in Firefox — show clear "Voice recognition not supported in this browser" message in place of transcription (identical pattern to ChatInput.tsx:75).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/hooks/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOX-01 | Wake word detection fires correct postMessage event | Unit (Worker mock) | `npx vitest run src/hooks/useWakeWord.test.ts` | ❌ Wave 0 |
| VOX-01 | Score below threshold does NOT fire wake event | Unit (Worker mock) | same | ❌ Wave 0 |
| VOX-01 | ONNX load failure → status:'error-disabled', no crash | Unit (mock InferenceSession.create throw) | same | ❌ Wave 0 |
| VOX-02 | useSpeechRecognition: onFinalResult fires with transcript | Unit (mock SpeechRecognition) | `npx vitest run src/hooks/useSpeechRecognition.test.ts` | ❌ Wave 0 |
| VOX-02 | useSpeechRecognition: onInterimResult fires during transcription | Unit (mock) | same | ❌ Wave 0 |
| VOX-02 | ChatInput still works after useSpeechRecognition extraction | Unit (existing behavior unchanged) | `npx vitest run src/components/ChatInput.test.tsx` | ❌ Wave 0 |
| VOX-03 | useTtsPlayback: play() sets isPlaying=true; onended → isPlaying=false | Unit (mock Audio constructor) | `npx vitest run src/hooks/useTtsPlayback.test.ts` | ❌ Wave 0 |
| VOX-03 | useTtsPlayback: play() constructs full URL from relative audio_url | Unit | same | ❌ Wave 0 |
| VOX-04 | Voice mode toggle persisted to localStorage on change | Unit (renderHook + localStorage mock) | `npx vitest run src/hooks/useWakeWord.test.ts` | ❌ Wave 0 |
| VOX-04 | Listening indicator renders only when voice mode ON | Unit (render MicToggle) | `npx vitest run src/components/MicToggle.test.tsx` | ❌ Wave 0 |
| VOX-04 | Error-disabled state: toggle is disabled, no mic stream opened | Unit (mock getUserMedia reject) | `npx vitest run src/hooks/useWakeWord.test.ts` | ❌ Wave 0 |

### Testing Constraints

**Cannot test in jsdom/Vitest:**
- Real ONNX inference (requires WASM; jsdom does not support WebAssembly easily)
- Real AudioWorklet (not implemented in jsdom)
- Real Web Speech API (browser API with no jsdom impl)
- Real TTS audio playback (no audio output in jsdom)

**Mock strategy:**
- **ONNX sessions:** Mock `onnxruntime-web` `InferenceSession.create` — return fake session with `run()` returning configurable scores. Test that score >= 0.5 fires wake, score < 0.5 does not.
- **Web Worker:** Test the Worker message protocol by importing `wakeWordWorker.ts` logic as a plain module (not via `new Worker()`) in unit tests. Test `processChunk()` with synthetic Float32Array frames.
- **SpeechRecognition:** Mock `window.SpeechRecognition` constructor — same pattern as existing `ChatInput.tsx` tests.
- **Audio:** Mock `window.Audio` constructor, spy on `.play()` and `.onended`.
- **getUserMedia:** Mock `navigator.mediaDevices.getUserMedia` — test both success and rejection paths.

### Sampling Rate

- **Per task commit:** `npx vitest run src/hooks/ src/components/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useWakeWord.test.ts` — covers VOX-01 + VOX-04 worker protocol + error-disabled
- [ ] `src/hooks/useSpeechRecognition.test.ts` — covers VOX-02 recognition hook
- [ ] `src/hooks/useTtsPlayback.test.ts` — covers VOX-03 playback hook
- [ ] `src/components/MicToggle.test.tsx` — covers VOX-04 UI states
- [ ] `src/test/setup.ts` additions — mock `window.Audio`, `navigator.mediaDevices`, `window.SpeechRecognition` for voice tests

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Picovoice/Porcupine (requires account + .ppn file) | openWakeWord ONNX (open-source, no account) | Phase 92 discuss | No API key; custom model via free Colab notebook |
| ScriptProcessorNode (deprecated) | AudioWorklet | ~2020 | AudioWorklet is the standard; ScriptProcessorNode will be removed |
| COOP/COEP required for WASM | `numThreads=1` avoids requirement | onnxruntime-web v1.x | Single-thread mode sidesteps cross-origin isolation entirely |
| WebGL execution provider | WebGPU (optional) + WASM (default) | onnxruntime-web 1.17+ | For audio processing: WASM is sufficient; WebGPU optional for GPU acceleration |

**Deprecated/outdated:**
- `ScriptProcessorNode`: replaced by AudioWorklet; do not use
- Picovoice/Porcupine path: explicitly rejected (D-03a); no `.ppn` or `VITE_PICOVOICE_ACCESS_KEY` in this phase
- ROADMAP "Last updated" footnote referencing Porcupine and `VITE_PICOVOICE_ACCESS_KEY`: stale; superseded by CONTEXT.md D-03a

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getUserMedia({ sampleRate: 16000 })` works on Chrome desktop (avoids resampling) | Patterns 2, Code Examples | May need decimation fallback on all browsers; adds ~30 lines to worklet |
| A2 | `OfflineAudioContext` is accessible in a Web Worker for resampling fallback | Pattern 2 | If not available, must implement manual decimation in worklet |
| A3 | Tensor shapes for `hey_astrid.onnx` classifier will be `[1, 16, 96]` input | Pattern 1 table | Custom-trained classifiers can have different sequence lengths; must inspect at runtime |
| A4 | mel_bins for melspectrogram.onnx output = 32 | Pattern 1 code | Could be different; derived from embedding model expected input — verify via `session.inputNames` dims |
| A5 | Web Speech API `continuous: true` can be paused via `recognition.stop()` mid-turn without losing state | Pattern 4 | If stop() resets recognition state and restart requires full re-init, feedback guard implementation changes |
| A6 | Vite 7 dev server serves WASM files from node_modules without additional config (only prod build needs plugin) | Pattern 6 | If dev server also fails, need `assetsInclude: ['**/*.wasm']` or `ort.env.wasm.wasmPaths` pointing to CDN for dev |

---

## Open Questions (RESOLVED)

> Each question below carries an inline `RESOLVED:` line stating how Phase 92 planning addresses it. These are planning-time resolutions; items A1–A6 in the Assumptions table above remain runtime-verifiable during execution (and have explicit fallbacks in the plans), which is expected for a hardware/browser-dependent feature.

1. **hey_astrid.onnx training timeline**
   - What we know: Training takes 30–60 min on Colab GPU; requires Colab access (free tier available)
   - What's unclear: Has this been trained yet? The `public/openwakeword/README.md` marks it `⏳ PENDING`
   - Recommendation: Make this Wave 0 task 0 ("train and place hey_astrid.onnx") with "hey jarvis" as integration-test stand-in. Block VOX-01 QA sign-off on its presence.
   - **RESOLVED:** Surfaced as the blocking human checkpoint **92-01 T0** (train + place `hey_astrid.onnx`); all surrounding code/tests build against the bundled "hey jarvis" stand-in (named explicitly in 92-03 T1), and VOX-01 live-detection sign-off is gated on the custom model per 92-VALIDATION.md Manual-Only row.

2. **Barge-in in MVP scope**
   - What we know: D-02 defers to planner assessment; UI-SPEC covers both cases (dim mic to 30% during speaking if deferred)
   - What's unclear: Does the added complexity of `recognition.start()` while `isPlaying=true` introduce race conditions?
   - Recommendation: Defer barge-in. "Mic dims during speaking" is simpler, avoids feedback race, and still delivers the Jarvis feel. Flag as follow-on in plan.
   - **RESOLVED:** Barge-in is **deferred** (within CONTEXT.md Claude's Discretion). 92-04 T2 implements the simpler feedback guard (pause recognition while `useTtsPlayback.isPlaying`, resume after) and the UI-SPEC "mic dims during speaking" affordance; barge-in is documented as a follow-on.

3. **AudioContext sample rate on Windows**
   - What we know: macOS Chrome locks all AudioContexts to same rate; Windows behavior may differ when Tone.js ambient audio is also active
   - What's unclear: Tone.js uses its own AudioContext (from `audioEngine.ts`). Creating a second AudioContext for wake detection at 16kHz may conflict if the browser enforces a single sample rate for all contexts
   - Recommendation: Test locally before committing to native 16kHz path. Worklet decimation fallback is reliable.
   - **RESOLVED:** Handled procedurally in **92-03 T1** — prefer native `sampleRate: 16000`, fall back to in-worklet decimation if the browser refuses a second rate (covers the Tone.js coexistence case). Runtime-verifiable (assumption A1/A2) with the decimation fallback as the reliable path.

4. **run.tts session_id routing in voice mode**
   - What we know: Chat.tsx:272 routes `run.tts` events to messages by `sessionId`; the voice palette won't have a message list in the same structure
   - What's unclear: `useTtsPlayback` needs to know WHICH `run.tts` event to play — the one matching the active session
   - Recommendation: `useWakeWord`/palette voice mode tracks `activeSessionId` (from `sendCommand` ack, same as Chat.tsx:149–151); `useTtsPlayback` accepts a `sessionId` filter param.
   - **RESOLVED:** 92-02 T2 gives `useTtsPlayback` a `sessionId` filter param; 92-04 T2 tracks `activeSessionId` from the `sendCommand` ack (per PATTERNS §sendCommand+session_id) so the palette plays only the matching `run.tts` event.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 92 |
|-----------|-------------------|
| Tech stack: React 19, Vite 7, TypeScript 5.9 | AudioWorklet types: use `@types/audioworklet` or inline ambient declarations; Vite 7 Worker import via `new URL(...)` |
| Icons: Lucide only | UI-SPEC already specifies `Mic`, `MicVocal`, `MicOff`, `AlertCircle`, `X`, `Volume2` — all Lucide |
| shadcn/ui New York | VoiceModePanel composes from `CommandGroup`, `CommandEmpty` (already installed) + Radix `Tooltip` (already installed) |
| No `.env` commits | No new env vars this phase (no API key for openWakeWord) |
| Tailwind 4 via `@tailwindcss/vite` | New CSS keyframes for voice UI go in `src/index.css`, NOT in separate CSS files |
| `authHeaders()` for Ástríðr API calls | Voice mode uses WS path, not REST — no auth header change needed |
| Error boundaries: `<SectionErrorBoundary>` | `useWakeWord` must catch all ONNX errors internally and surface via `status:'error-disabled'`; do not let errors propagate to React tree |
| `run:dev` = `vite` on port 5173 | Worker files must be bundled by Vite (type: 'module' Worker syntax) — verify Vite 7 handles `new Worker(new URL(...))` |

---

## Sources

### Primary (HIGH confidence)
- Live codebase: `src/components/CommandPalette.tsx` — confirmed `sendCommand` at line 87 via `useAstridrWS()`
- Live codebase: `src/layouts/DashboardLayout.tsx` — confirmed `paletteOpen` at line 532, `setPaletteOpen` at line 563, `CommandPalette` render at line 713, right-side control group at lines 684–694
- Live codebase: `src/components/ChatInput.tsx` — confirmed `getSpeechRecognitionClass`, `startListening`, `stopListening` at lines 54–170
- Live codebase: `src/pages/Chat.tsx` — confirmed `playAudio` at lines 63–76, `run.tts` handler at lines 253–288, `useTtsPlayback` extraction target
- Live codebase: `src/contexts/AstridrWSContext.tsx` — confirmed `sendCommand` signature at lines 307–332, `subscribeEvent` at lines 347–358, `TOPIC_EVENT_MAP` `run.tts`/`run.text`/`run.completed` at lines 77–87
- Live codebase: `public/openwakeword/README.md` — confirmed melspectrogram.onnx + embedding_model.onnx present (v0.5.1), hey_astrid.onnx PENDING
- Live codebase: `package.json` — confirmed onnxruntime-web NOT yet a dependency
- Live codebase: `vite.config.ts` — confirmed no WASM/ONNX config present yet
- Ástríðr server-side: `astridr/channels/wake_word.py:72–133` — confirmed 16kHz PCM int16, threshold 0.5, `sensitivity` param, model reset
- Ástríðr server-side: `astridr/channels/voice.py:42–138` — confirmed state machine (IDLE/WAKE_DETECTED/LISTENING/PROCESSING), end phrases, `_tts_complete` event for feedback guard
- onnxruntime-web npm: version 1.27.0, published 2026-06-19, repo github.com/Microsoft/onnxruntime — [VERIFIED: npm registry]
- slopcheck: onnxruntime-web [OK], vite-plugin-static-copy [OK]

### Secondary (MEDIUM confidence)
- Deep Core Labs implementation: [deepcorelabs.com/open-wake-word-on-the-web/](https://deepcorelabs.com/open-wake-word-on-the-web/) — exact tensor pipeline details, mel normalization `(v/10)+2`, dual buffer mechanics, 1280-sample/80ms frame format, VAD hangover
- openwakeword_wasm reference: [github.com/dnavarrom/openwakeword_wasm](https://github.com/dnavarrom/openwakeword_wasm) — WakeWordEngine architecture, React integration pattern, Vite asset structure
- onnxruntime.ai env-flags docs: [onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html) — `numThreads=1` to disable COOP/COEP requirement, `wasmPaths` config
- Vite+onnxruntime-web: [github.com/vitejs/vite/discussions/15962](https://github.com/vitejs/vite/discussions/15962) — confirmed `optimizeDeps.exclude` + `viteStaticCopy` pattern
- openWakeWord GitHub issue #175: embedding output shape `(1,1,1,96)`, classifier input `(1,16,96)` or `(1,22,96)` — shape varies by model

### Tertiary (LOW confidence — flag for validation)
- AudioWorklet resampling approaches — [0110.be/posts/Resampling_audio_via_a_Web_Audio_API_Audio_Worklet](https://0110.be/posts/Resampling_audio_via_a_Web_Audio_API_Audio_Worklet) — decimation approach cited but anti-aliasing quality not confirmed
- `getUserMedia({ sampleRate: 16000 })` browser compat — [ASSUMED] works on Chrome desktop; Firefox and Safari behavior not confirmed for this phase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — onnxruntime-web is the only ONNX runtime for browsers; no alternatives exist
- Architecture (Worker/Worklet split): HIGH — onnxruntime-web-in-AudioWorklet is a confirmed open bug; split is confirmed working pattern
- ONNX tensor shapes: MEDIUM — verified via reference impl + GitHub issue, not official docs; must inspect at runtime
- Mel normalization transform: MEDIUM — verified via Deep Core Labs impl; not in openWakeWord README
- Pitfalls: HIGH — most verified from open GitHub issues and reference implementations
- CodePulse integration points: HIGH — all lines verified against live codebase

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (onnxruntime-web is actively developed; verify version before executing)

---

*What I could not confirm and why:*
- *Exact mel_bins value for melspectrogram.onnx:* Not in public openWakeWord docs; Deep Core Labs mentions 32 bins implicitly via embedding model input. Must inspect `session.inputNames[0].dims` at runtime.
- *OfflineAudioContext availability inside Web Workers:* Not confirmed cross-browser. The MDN spec allows it but real-world support varies; decimation fallback in worklet is safer.
- *hey_astrid.onnx classifier input sequence length:* Auto-trained classifiers sometimes use 22 instead of 16 embeddings. Must be inspected after training.
- *Tone.js AudioContext interaction with 16kHz getUserMedia constraint on Windows:* Could not test locally; flagged as Open Question 3.
