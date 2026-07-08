# Handoff — Tier-2 "cyber-Norse Ástríðr" voice avatar

**Created:** 2026-07-08 · **For:** a fresh Claude Code session (post-/clear) to resume this feature.

## Goal
Give CodePulse's voice mode a **Jarvis-like visual presence**: a stylized **Nordic-woman avatar of Ástríðr** with an **audio-reactive aura** that pulses with the conversation — reacts to *my* voice while I talk and to *her* voice while she speaks, with distinct listening / thinking / speaking states. Larry chose this (Tier 2) over an abstract orb (Tier 1) or a full 3D lip-synced avatar (Tier 3). Semi-humanoid, on-brand with the dark cyberpunk theme — NOT a photoreal talking head.

## Step 1 — Concept art (do this first, then show Larry & iterate)
Use Higgsfield `mcp__higgsfield__generate_image` (load its schema via ToolSearch first). Generate **3–4 concepts**, `count` up to 4, portrait aspect ratio. Model: a character-strong one (e.g. `soul_2` or `nano_banana_pro`).

**Prompt spec:** a strikingly beautiful Scandinavian woman reimagined as a semi-humanoid digital/AI being — pale platinum braided hair with subtle Norse styling, sharp Nordic features, calm intelligent expression; translucent holographic edges, faint glowing circuit/runic light tracings; a soft **electric-cyan (`#06b6d4`) + emerald** glow emanating from her; near-black (`#09090b`) background so she reads as a glowing presence; **front-facing bust/portrait, centered, framed for a dark UI panel**; cinematic, volumetric glow, subtle CRT/scanline atmosphere; stylized digital-human / hologram look, not photoreal.

Vary the concepts (e.g. one valkyrie/shield-maiden lean, one sleek-AI/hologram lean). Once Larry picks a direction, generate the production asset(s) — ideally a calm state + a "speaking" variant, dark/transparent background so it composites into the UI.

## Step 2 — Audio-reactive panel
Render the avatar in **`src/components/voice/VoiceModePanel.tsx`** with a glowing aura driven by Web Audio `AnalyserNode`s:
- **My voice:** the mic `MediaStream` lives in **`src/hooks/useWakeWord.ts`** (created via getUserMedia; wired mic→worklet). Tap it with `createMediaStreamSource` → `AnalyserNode` → amplitude drives the aura while *listening*.
- **Her voice:** TTS plays via **`src/hooks/useTtsPlayback.ts`** (an `HTMLAudioElement` playing `audio_url` from the `run.tts` WS event). Tap that element with `createMediaElementSource` → `AnalyserNode` → drives the aura while *speaking*. (`isPlaying` from the hook already distinguishes speaking.)
- **State machine** already exists: `voiceState.ts` reducer → `listening | transcribing | processing (thinking) | speaking`. Map aura behavior to these: listening = reacts to mic; processing = idle swirl/shimmer; speaking = reacts to her TTS.
- **Theme:** default is Electric Cyan (`--primary #06b6d4`, accent violet `#8b5cf6`); read tokens, don't hardcode. Consider a reactive ring/halo (Siri/Jarvis style) behind her. Respect `prefers-reduced-motion`.

## Current state (all shipped/pushed as of 2026-07-08, `origin/master` @ `54ecb3c`)
- **Voice mode is fully working**: wake word ("Hey Astrid"), pause-to-send, exit phrase, AudioContext auto-resume, and **Ástríðr's real ElevenLabs voice** (`ELEVENLABS_VOICE_ID=1NOPZlhvXZ6u0CX5lJD3`, confirmed `method=elevenlabs`).
- **Deployment:** CodePulse is live on **Vercel** at `https://codepulse-jade-omega.vercel.app` (Clerk-gated, `pk_test`). It reads **Convex** (cloud `tidy-whale-981`) + **Ástríðr** over **Tailscale** (`https://lmofficenew.tail5bb6b3.ts.net`, CORS-allowlisted). Ástríðr runs in Docker (`astridr-agent`). Pushes to master auto-deploy.
- For local UI work: `npm run dev` (auth on) or an auth-disabled instance (`VITE_CLERK_PUBLISHABLE_KEY= npm run dev -- --port 5180`) + set `localStorage.codepulse_onboarding_complete='true'` to dismiss the onboarding modal.

## Pointers
- `src/components/voice/VoiceModePanel.tsx` — the panel (transcript, reply stream, waveform, TTS wiring)
- `src/components/voice/voiceState.ts` — state machine + `isEndPhrase`
- `src/hooks/useWakeWord.ts` — mic stream + wake engine
- `src/hooks/useTtsPlayback.ts` — TTS `<audio>` playback
- `src/index.css` — theme tokens (`[data-theme]` blocks), glow scale `--glow-xs..lg`
