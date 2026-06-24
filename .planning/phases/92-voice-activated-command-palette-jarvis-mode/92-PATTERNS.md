# Phase 92: Voice-Activated Command Palette (Jarvis Mode) — Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useWakeWord.ts` | hook / stateful browser-API orchestrator | event-driven | `src/hooks/useAudioEvents.ts` + `src/contexts/AmbientContext.tsx` | role-match (browser-API lifecycle + worker messaging) |
| `src/hooks/useSpeechRecognition.ts` | hook / extracted browser-API wrapper | event-driven | `src/components/ChatInput.tsx` lines 54–170 | exact (direct extraction) |
| `src/hooks/useTtsPlayback.ts` | hook / audio state manager | event-driven | `src/pages/Chat.tsx` lines 63–86 | exact (direct extraction) |
| `src/workers/wakeWordWorker.ts` | Web Worker / ONNX inference pipeline | event-driven | none — no Workers exist yet | no analog |
| `src/worklets/micCapture.worklet.ts` | AudioWorklet processor | streaming | none — no AudioWorklets exist yet | no analog |
| `src/components/VoiceModePanel.tsx` | component / palette voice-mode UI | request-response | `src/components/ChatInput.tsx` (ChatBubble + streaming render) | role-match |
| `src/components/MicToggle.tsx` | component / icon toggle button | request-response | `src/layouts/DashboardLayout.tsx` `CrtToggle` (lines 486–519) | exact (same shape: localStorage-persisted toggle button in header) |
| `src/components/ListeningIndicatorPill.tsx` | component / status pill | request-response | `src/layouts/DashboardLayout.tsx` "Astridr Runtime Telemetry" pill (lines 651–656) | exact |
| `src/components/CommandPalette.tsx` (modified) | component / command surface | request-response | self — current `CommandPalette.tsx` | exact (additive) |
| `src/layouts/DashboardLayout.tsx` (modified) | layout / app shell | event-driven | self — current `DashboardLayout.tsx` | exact (additive) |
| `vite.config.ts` (modified) | config | build | self — current `vite.config.ts` | exact |

---

## Pattern Assignments

---

### `src/hooks/useWakeWord.ts` (hook, event-driven)

**Primary analog:** `src/hooks/useAudioEvents.ts`
**Secondary analog:** `src/contexts/AmbientContext.tsx` (localStorage-persisted on/off toggle)

**Imports pattern** — `useAudioEvents.ts` lines 1–8; `AmbientContext.tsx` lines 1–9:
```typescript
import { useEffect, useRef, useCallback, useState } from "react";
// useAudioEvents pattern: custom event → window.addEventListener lifecycle
// AmbientContext pattern: localStorage.getItem with try/catch default
```

**localStorage-persisted toggle pattern** — `DashboardLayout.tsx` lines 534–540:
```typescript
const [crtEnabled, setCrtEnabled] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
  } catch {
    return false;
  }
});
```
Copy this exact shape for the `voiceModeEnabled` state initializer, using key `"codepulse-voice-mode"`.

**custom-event + window listener lifecycle pattern** — `useAudioEvents.ts` lines 54–77:
```typescript
export function useAudioEvents(): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const handleEvent = useCallback(
    (e: Event) => {
      if (!enabledRef.current) return;
      // ... dispatch to handler
    },
    [playAlert, playEvent],
  );

  useEffect(() => {
    window.addEventListener(AUDIO_EVENT, handleEvent);
    return () => window.removeEventListener(AUDIO_EVENT, handleEvent);
  }, [handleEvent]);
}
```
`useWakeWord` uses the same ref-for-stable-callback + useEffect cleanup lifecycle. Replace `window.addEventListener` with Worker `onmessage` assignment; the teardown pattern (`worker.terminate()` in cleanup) mirrors `window.removeEventListener`.

**D-07 graceful-degradation return shape** — derived from pattern in AmbientContext + RESEARCH.md Pattern 3:
```typescript
export type WakeWordStatus = 'idle' | 'loading' | 'ready' | 'error-disabled';

export interface UseWakeWordReturn {
  status: WakeWordStatus;
  errorReason: string | null;
  voiceModeEnabled: boolean;
  setVoiceModeEnabled: (v: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
}
```
`status: 'error-disabled'` is the catch-all for any Worker/ONNX init failure. Never throw; always surface via the status field. `SectionErrorBoundary` is NOT a fallback here — the hook catches internally (CLAUDE.md: "useWakeWord must catch all ONNX errors internally").

**Worker lifecycle pattern** — RESEARCH.md lines 533–556 (verified pattern):
```typescript
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
    console.error('Wake word init failed:', err);
    return null;  // null → status:'error-disabled'
  }
}
```

**Wake event → palette open pattern** — `DashboardLayout.tsx` lines 559–563:
```typescript
// Keyboard shortcut opens palette — mirror this for wake-word wake event:
if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
  e.preventDefault();
  setPaletteOpen((prev) => !prev);
}
// Wake word equivalent: setPaletteOpen(true); setVoiceMode(true);
```

---

### `src/hooks/useSpeechRecognition.ts` (hook, event-driven — extraction)

**Analog:** `src/components/ChatInput.tsx` lines 54–170

This hook is a direct extraction + generalization. Copy verbatim the types and logic, then generalize the configuration.

**Type declarations to lift** — `ChatInput.tsx` lines 16–40:
```typescript
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}
```
Move these into `src/hooks/useSpeechRecognition.ts`. Remove the duplicate `declare global` from `ChatInput.tsx` and import the types from the hook file.

**Feature-detection helper to lift** — `ChatInput.tsx` line 54–56:
```typescript
function getSpeechRecognitionClass(): (new () => SpeechRecognitionInstance) | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}
```

**Recognition lifecycle to lift** — `ChatInput.tsx` lines 119–170:
```typescript
const stopListening = useCallback(() => {
  if (recognitionRef.current) {
    recognitionRef.current.stop();
    recognitionRef.current = null;
  }
  setIsListening(false);
}, []);

const startListening = useCallback(() => {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) return;

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;    // ← becomes options.continuous ?? false
  recognition.interimResults = false; // ← becomes options.interimResults ?? false
  recognition.lang = "en-US";        // ← becomes options.lang ?? "en-US"

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const transcript = event.results[event.resultIndex]?.[0]?.transcript;
    if (transcript) {
      // ← call options.onFinalResult(transcript) here
    }
  };

  recognition.onend = () => {
    setIsListening(false);
    recognitionRef.current = null;
    // ← call options.onEnd?.()
  };

  recognition.onerror = (event: { error: string }) => {
    if (event.error !== "aborted" && event.error !== "no-speech") {
      console.warn("Speech recognition error:", event.error);
    }
    setIsListening(false);
    recognitionRef.current = null;
  };

  recognitionRef.current = recognition;
  recognition.start();
  setIsListening(true);
}, [onVoiceSend]); // ← deps become the options callbacks
```

**Hook public interface** (RESEARCH.md Pattern 4 — add `onInterimResult` for palette transcript display):
```typescript
export interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onFinalResult: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onEnd?: () => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions): {
  start: () => void;
  stop: () => void;
  abort: () => void;
  isListening: boolean;
  speechAvailable: boolean;
}
```

**Cleanup on unmount** — `ChatInput.tsx` lines 79–86:
```typescript
useEffect(() => {
  return () => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  };
}, []);
```
Copy verbatim.

---

### `src/hooks/useTtsPlayback.ts` (hook, event-driven — extraction)

**Analog:** `src/pages/Chat.tsx` lines 63–86

**Audio helpers to extract** — `Chat.tsx` lines 63–86:
```typescript
// TTS state
const audioRef = useRef<HTMLAudioElement | null>(null);

const playAudio = useCallback((url: string) => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
  const audio = new Audio(url);
  audioRef.current = audio;
  audio.play().catch((err) => {
    console.warn("TTS playback failed:", err);
  });
  audio.onended = () => {
    audioRef.current = null;
    // ← ADD: setIsPlaying(false); options.onEnded?.();
  };
  // ← ADD: setIsPlaying(true);
}, []);

// Cleanup audio on unmount (Chat.tsx lines 79–86)
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };
}, []);
```

**URL construction to extract** — `Chat.tsx` lines 262–264:
```typescript
// Build full URL — audio_url may be relative like /api/audio/file.mp3
const fullUrl = data.audio_url.startsWith("http")
  ? data.audio_url
  : `${ASTRIDR_API_URL}${data.audio_url}`;
```
Move `ASTRIDR_API_URL = import.meta.env.VITE_ASTRIDR_API_URL ?? "http://localhost:8181"` into the hook.

**Hook public interface** (RESEARCH.md Pattern 5 — add `isPlaying` for feedback guard):
```typescript
export interface UseTtsPlaybackReturn {
  play: (url: string) => void;  // accepts relative or absolute URL; normalizes internally
  stop: () => void;
  isPlaying: boolean;           // true while <audio> element is playing; false after onended
}
```

**isPlaying state** — add `useState(false)`:
- Set `true` before `audio.play()`
- Set `false` in `audio.onended`
- Set `false` in `stop()` after `audio.pause()`

`Chat.tsx` consumes this hook after extraction — the `ttsEnabled` guard in `Chat.tsx` line 283–287 remains in `Chat.tsx`; only the playback mechanics move to the hook.

---

### `src/workers/wakeWordWorker.ts` (Web Worker, event-driven)

**Analog:** none — no Workers exist in this codebase.

**Pattern source:** RESEARCH.md Pattern 1 (lines 223–294) — the three-stage ONNX pipeline.

Key implementation rules extracted from RESEARCH.md:
1. `ort.env.wasm.numThreads = 1` — set before ANY session creation (skips COOP/COEP requirement).
2. `ort.env.wasm.wasmPaths = '/';` — set to wherever WASM files land (Vite static copy puts them at root).
3. Mel normalization `(v / 10.0) + 2.0` — apply to every value in melspectrogram output before feeding embedding model (Pitfall 1).
4. Runtime shape inspection: call `session.inputNames` and inspect `.dims` on first load — do NOT hardcode (Pitfall 6).
5. Dual stateful buffers: mel buffer (76 frames), embedding circular buffer (16 × 96).
6. `self.onmessage` protocol: `init` → `ready`/`error`; `frame` → process + conditionally `wake`.
7. Cooldown: `COOLDOWN_MS = 2000`, `THRESHOLD = 0.5`.

**Message protocol** (RESEARCH.md lines 277–293):
```typescript
// Inbound from main thread:
// { type: 'init', baseUrl: string }
// { type: 'frame', samples: Float32Array }
// Outbound to main thread:
// { type: 'ready' }
// { type: 'error', message: string }
// { type: 'wake', score: number }
```

---

### `src/worklets/micCapture.worklet.ts` (AudioWorklet, streaming)

**Analog:** none — no AudioWorklets exist in this codebase.

**Pattern source:** RESEARCH.md Pattern 2 (lines 300–331).

Key rules:
1. `registerProcessor('mic-capture', MicCaptureProcessor)` — required at file end.
2. Buffer 1280 samples, then `this.port.postMessage({ type: 'frame', samples }, [buffer.buffer])` — zero-copy transfer.
3. NO `import * as ort` here — ONNX is forbidden in AudioWorkletGlobalScope (Pitfall 2, confirmed open bug).
4. Resampling: try `getUserMedia({ audio: { sampleRate: { ideal: 16000 } } })` first; fall back to decimation (keep every 3rd sample from 48kHz) in the worklet's `process()` method if actual context rate differs.

---

### `src/components/VoiceModePanel.tsx` (component, request-response)

**Primary analog:** `src/components/ChatInput.tsx` (state-driven render with recognition state)
**Secondary analog:** `src/pages/Chat.tsx` (streaming reply display pattern)

**Inline subcomponent pattern** — copy from `CommandPalette.tsx` lines 102–115 (inline components within the same file, each a simple const arrow function):
```typescript
// CommandPalette uses inline helper components and a local select() coordinator:
function select(action: () => void) {
  action();
  onOpenChange(false);
}
// VoiceModePanel follows same: inline VoiceStateBadge, VoiceTranscriptArea,
// VoiceReplyStream, VoiceWaveform as named const arrows in the same file.
```

**Streamed-text append pattern** — `Chat.tsx` lines 202–216:
```typescript
setMessages((prev) =>
  prev.map((msg) => {
    if (msg.role === "assistant" && msg.streaming) {
      return {
        ...msg,
        content: msg.content + (text ?? ""),
        streaming: done ? false : true,
      };
    }
    return msg;
  })
);
```
`VoiceReplyStream` uses a simpler version: a single `replyText` string state, appending each `run.text` chunk: `setReplyText(prev => prev + chunk)`.

**subscribeEvent cleanup pattern** — `Chat.tsx` lines 186–300:
```typescript
useEffect(() => {
  const unsubText = subscribeEvent("run.text", (event) => { ... });
  const unsubTts  = subscribeEvent("run.tts", (event) => { ... });
  const unsubCompleted = subscribeEvent("run.completed", (event) => { ... });
  return () => {
    unsubText();
    unsubTts();
    unsubCompleted();
  };
}, [subscribeEvent]);
```
Copy this multi-unsub pattern exactly for VoiceModePanel's subscription block.

**shadcn/CommandGroup composition** — `CommandPalette.tsx` lines 96–115:
```typescript
<CommandDialog open={open} onOpenChange={onOpenChange}>
  <CommandInput placeholder="..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Pages">
      {/* items */}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```
In voice mode: `CommandInput` is conditionally hidden (or replaced); `CommandList` contains `VoiceModePanel` instead of `CommandGroup` items. The `CommandDialog` wrapper and `onOpenChange` prop stay identical.

**State-driven rendering with ChatInput speech state** — `ChatInput.tsx` lines 62–65, 75:
```typescript
const [isListening, setIsListening] = useState(false);
const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
const speechAvailable = typeof window !== "undefined" && getSpeechRecognitionClass() !== null;
```
`VoiceModePanel` receives `speechAvailable` and the current `VoiceState` as props; renders `error-disabled` branch when speechAvailable is false.

**aria-live regions** (UI-SPEC lines 249–257) — use `aria-live="assertive"` on state label, `aria-live="polite" aria-atomic="false"` on transcript and reply containers. No analog exists — implement fresh per spec.

---

### `src/components/MicToggle.tsx` (component, request-response)

**Analog:** `CrtToggle` function in `src/layouts/DashboardLayout.tsx` lines 486–519

This is the closest structural match: same position (top-bar header control group), same shape (stateless prop-driven toggle button with localStorage persistence handled by the parent), same Lucide icon pattern.

**Button structure to copy** — `DashboardLayout.tsx` lines 505–518:
```typescript
return (
  <button
    onClick={toggle}
    aria-label={crtEnabled ? "Disable CRT effect" : "Enable CRT effect"}
    title={crtEnabled ? "CRT effect ON — click to disable" : "CRT effect OFF — click to enable"}
    className={`p-1.5 transition-colors text-xs font-mono font-medium ${
      crtEnabled
        ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    }`}
  >
    CRT
  </button>
);
```

**MicToggle adaptation** — replace text label with Lucide icon; add `disabled` attribute + `cursor-not-allowed` for `error-disabled` state; add Radix `Tooltip` wrapper (already installed per UI-SPEC). Map three states to three icon/className combos per UI-SPEC:
```typescript
// OFF:      Mic      h-4 w-4 text-muted-foreground   bg-transparent hover:bg-accent/50
// ON:       MicVocal h-4 w-4 text-primary             bg-primary/10 border border-primary/30 shadow-[var(--glow-xs)]
// DISABLED: MicOff   h-4 w-4 text-muted-foreground    opacity-40 cursor-not-allowed disabled
```

**Disabled pattern** — `EStopButton.tsx` lines 39–52:
```typescript
const isConnected = status === "connected";
return (
  <button
    onClick={() => setOpen(true)}
    disabled={!isConnected}
    title={isConnected ? "..." : "Not connected"}
    className="... disabled:opacity-40 disabled:cursor-not-allowed"
  >
```
Copy `disabled` prop + `disabled:opacity-40 disabled:cursor-not-allowed` Tailwind classes verbatim for the `error-disabled` state.

---

### `src/components/ListeningIndicatorPill.tsx` (component, request-response)

**Analog:** `src/layouts/DashboardLayout.tsx` "Astridr Runtime Telemetry" pill — lines 651–656

**Pill JSX to model** — `DashboardLayout.tsx` lines 651–656:
```typescript
<div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 border border-primary/20 shadow-[var(--glow-xs)]">
  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[var(--glow-md)]" />
  <span className="text-xs font-mono tracking-widest text-primary uppercase">
    Astridr Runtime Telemetry
  </span>
</div>
```

**ListeningIndicatorPill deviation** (per UI-SPEC lines 51–52): use `py-1` (not `py-1.5`) to stay on 4-point grid. All other tokens are identical. Text: `"VOICE ACTIVE"`.

**Visibility guard** — only render when `voiceModeEnabled && wakeWordStatus !== 'error-disabled'`. Use conditional render (`{condition && <ListeningIndicatorPill />}`) matching the existing pattern at `DashboardLayout.tsx` line 613 (`{sidebarOpen && ...}`).

**`prefers-reduced-motion` guard** (UI-SPEC lines 272–277) — add to `src/index.css` under the existing `@media (prefers-reduced-motion: reduce)` block at line 376:
```css
@media (prefers-reduced-motion: reduce) {
  .voice-listening-dot { animation: none; opacity: 0.6; }
}
```
The `animate-pulse` Tailwind class is already handled by the global block; adding the static class name guard covers any custom keyframe added for voice.

---

### `src/components/CommandPalette.tsx` (modified, request-response)

**Analog:** self — current `src/components/CommandPalette.tsx`

**Props extension pattern** — `CommandPalette.tsx` lines 80–83:
```typescript
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // ADD:
  voiceMode?: boolean;
  voiceState?: VoiceState;   // import from VoiceModePanel or a shared types file
  onVoiceClose?: () => void;
}
```

**Conditional render pattern** — mirror how `CommandPalette` already conditionally renders groups based on data presence (lines 113–135). Voice mode is a top-level conditional replacing `<CommandInput> + <CommandList>` contents:
```typescript
<CommandDialog open={open} onOpenChange={onOpenChange}>
  {voiceMode ? (
    <VoiceModePanel
      voiceState={voiceState ?? 'listening'}
      onClose={() => { onVoiceClose?.(); onOpenChange(false); }}
    />
  ) : (
    <>
      <CommandInput placeholder="Search pages, agents, sessions, commands..." />
      <CommandList>
        {/* existing content unchanged */}
      </CommandList>
    </>
  )}
</CommandDialog>
```

---

### `src/layouts/DashboardLayout.tsx` (modified, event-driven)

**Analog:** self — current `src/layouts/DashboardLayout.tsx`

**State addition pattern** — mirror existing state declarations at lines 524–532:
```typescript
// Existing pattern:
const [paletteOpen, setPaletteOpen] = useState(false);
// Add below it:
const [voiceMode, setVoiceMode] = useState(false);
```

**localStorage-persisted state initializer** — copy from `crtEnabled` at lines 534–540 (exact pattern):
```typescript
const [voiceModeEnabled, setVoiceModeEnabled] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("codepulse-voice-mode") ?? "false");
  } catch {
    return false;
  }
});
```

**Header control group insertion point** — `DashboardLayout.tsx` lines 684–694:
```tsx
<div className="flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10">
  {/* INSERT BEFORE EStopButton: */}
  {voiceModeEnabled && wakeWordStatus === 'ready' && <ListeningIndicatorPill />}
  <MicToggle
    enabled={voiceModeEnabled}
    status={wakeWordStatus}
    errorReason={wakeWordErrorReason}
    onToggle={(v) => {
      setVoiceModeEnabled(v);
      localStorage.setItem("codepulse-voice-mode", JSON.stringify(v));
    }}
  />
  <div className="w-px h-4 bg-primary/20 mx-1" />
  <EStopButton />
  {/* rest unchanged */}
```

**Keyboard handler extension** — `DashboardLayout.tsx` lines 558–587 (existing `useEffect` keyboard handler). The wake-word callback does NOT go in this handler — it fires from the Worker `onmessage` via `useWakeWord`'s `onWake` callback prop. The existing `Cmd+K` logic at line 562 stays untouched; `voiceMode` is set to `false` when palette is opened via keyboard (keyboard open = text mode).

**`CommandPalette` render extension** — `DashboardLayout.tsx` line 713:
```typescript
// Before (line 713):
<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
// After:
<CommandPalette
  open={paletteOpen}
  onOpenChange={(open) => { setPaletteOpen(open); if (!open) setVoiceMode(false); }}
  voiceMode={voiceMode}
  voiceState={currentVoiceState}
  onVoiceClose={() => { setVoiceMode(false); setPaletteOpen(false); }}
/>
```

---

### `vite.config.ts` (modified, build config)

**Analog:** self — current `vite.config.ts`

**Current file** (lines 1–16) — baseline to extend:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
```

**Additions** — RESEARCH.md Pattern 6 (lines 399–421):
```typescript
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: '.',  // copies to dist/ root
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],  // prevents Vite pre-bundling WASM (Pitfall 7)
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
```

---

## Shared Patterns

### localStorage persistence for toggle state
**Source:** `src/layouts/DashboardLayout.tsx` lines 534–540, 493–502
**Apply to:** `MicToggle.tsx`, `useWakeWord.ts` (wherever `voiceModeEnabled` is persisted)
```typescript
// Read (lazy initializer):
const [state, setState] = useState(() => {
  try { return JSON.parse(localStorage.getItem("codepulse-{key}") ?? "false"); }
  catch { return false; }
});
// Write (in toggle handler):
localStorage.setItem("codepulse-{key}", JSON.stringify(nextValue));
```

### subscribeEvent cleanup (multi-subscription)
**Source:** `src/pages/Chat.tsx` lines 186–308 (run.text + run.tts + run.completed in one useEffect)
**Apply to:** `VoiceModePanel.tsx` (subscribes to same three events)
```typescript
useEffect(() => {
  const unsubA = subscribeEvent("run.text", handlerA);
  const unsubB = subscribeEvent("run.tts", handlerB);
  const unsubC = subscribeEvent("run.completed", handlerC);
  return () => { unsubA(); unsubB(); unsubC(); };
}, [subscribeEvent]);
```

### sendCommand + session_id tracking
**Source:** `src/pages/Chat.tsx` lines 129–181
**Apply to:** `VoiceModePanel.tsx` (voice command send path)
```typescript
const ack = await sendCommand({ type: "chat.send", message: text });
const sessionId = (ack.session_id as string | undefined)
  ?? (ack.data?.session_id as string | undefined)
  ?? generateId();
activeSessionRef.current = sessionId;
```
The `sessionId` filter is required for `run.tts` routing (RESEARCH.md Open Question 4).

### Icon button shape (top-bar control group)
**Source:** `src/layouts/DashboardLayout.tsx` lines 505–518 (`CrtToggle`), `src/components/EStopButton.tsx` lines 43–53
**Apply to:** `MicToggle.tsx`
```typescript
// Standard shape: button with aria-label, title, className with disabled: variants
<button
  onClick={...}
  disabled={isDisabled}
  aria-label="..."
  title="..."
  className={`p-1.5 transition-colors ... disabled:opacity-40 disabled:cursor-not-allowed`}
>
  <IconComponent className="h-4 w-4" />
</button>
```

### Error handling in browser-API hooks (non-throwing)
**Source:** `src/hooks/useAudioEvents.ts` lines 59–70 (guard with `enabledRef.current`); `src/components/ChatInput.tsx` lines 158–165 (`onerror` handler)
**Apply to:** `useWakeWord.ts`, `useSpeechRecognition.ts`, `useTtsPlayback.ts`
```typescript
// ChatInput.tsx onerror pattern:
recognition.onerror = (event: { error: string }) => {
  if (event.error !== "aborted" && event.error !== "no-speech") {
    console.warn("Speech recognition error:", event.error);
  }
  setIsListening(false);
  recognitionRef.current = null;
};
// useWakeWord equivalent: catch in Worker init → set status:'error-disabled', log, never throw
```

### Testing: vi.mock for browser context + renderHook
**Source:** `src/hooks/useLiveState.test.ts` lines 1–52
**Apply to:** `useWakeWord.test.ts`, `useSpeechRecognition.test.ts`, `useTtsPlayback.test.ts`

```typescript
// AstridrWSContext mock pattern (useLiveState.test.ts lines 21–29):
vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: mockStatus,
    sendCommand: vi.fn(),
    subscribeEvent: mockSubscribeEvent,
    reconnect: vi.fn(),
  })),
}));

// renderHook + act pattern (useLiveState.test.ts lines 55–61):
const { result } = renderHook(() => useLiveState({ topics: ["agents"] }));
act(() => { fireEvent("event_type", { data: { ... } }); });
expect(result.current.state.someField).toBe("expected");
```

For voice-specific mocks (new — no existing analog):
```typescript
// Mock window.SpeechRecognition (same shape as ChatInput.tsx types):
const mockRecognition = { continuous: false, interimResults: false, lang: '',
  start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
  onresult: null, onend: null, onerror: null };
vi.stubGlobal('SpeechRecognition', vi.fn(() => mockRecognition));

// Mock window.Audio:
const mockAudio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn(),
  onended: null };
vi.stubGlobal('Audio', vi.fn(() => mockAudio));

// Mock navigator.mediaDevices.getUserMedia:
vi.stubGlobal('navigator', {
  mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(new MediaStream())) }
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/workers/wakeWordWorker.ts` | Web Worker | event-driven | No Web Workers exist in this codebase; all async computation is React/hook-based |
| `src/worklets/micCapture.worklet.ts` | AudioWorklet | streaming | No AudioWorklets exist; Tone.js ambient audio uses the AudioEngine abstraction, not raw AudioWorklet |

Both files must follow RESEARCH.md Patterns 1 and 2 directly (cited from Deep Core Labs reference implementation + onnxruntime-web docs). Executor should treat RESEARCH.md lines 223–331 as the implementation spec.

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/`, `src/layouts/`, `src/contexts/`, `src/pages/Chat.tsx`, `vite.config.ts`
**Files scanned:** 14 source files read in full or in targeted sections
**Pattern extraction date:** 2026-06-24
