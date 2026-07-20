# Ástríðr Presence — Resume Handoff

_Checkpoint: 2026-07-20. Design approved, presence page built + committed. Next: wire real voice._

## What this is
Redesign of how you interact with Ástríðr in CodePulse: she moved from a transient
voice **popup** to a **full-presence Chat page**. Decided during the session
(reversing an earlier "always-on shell rail" idea):
- She lives **only on `/chat`** — NOT docked on every route. You interact with her there.
- The `/chat` page IS her presence: **AvatarAura hero + conversation + input + mic ON/OFF toggle**.
- **Listening OFF = text-only** (mic fully disabled, avatar dims, "LISTENING OFF"); persists.

Mockup (approved look): `codepulse/html-out/astridr-presence-mockup.html`.

## Done + committed (codepulse `master`)
- `1900944` — full-presence Chat page. Key files:
  - `src/pages/Chat.tsx` — the presence page (avatar hero, thread, input, mic toggle, listening state persisted to `codepulse-astridr-listening`).
  - `src/hooks/useAstridrChat.ts` — **the conversation engine** (send + run.text/blocks/tts/completed/error subscriptions + block dedup + TTS + approvals). Extracted from the old Chat.tsx so there's ONE home for streaming logic.
  - `DashboardLayout.tsx` — shell rail removed (she's not global).
  - `AstridrRail.tsx` — deleted (shell-rail approach abandoned).
- Earlier same session — the conversational fixes (all committed, verified live):
  - `dbdce35` interim barge-in (stop cuts instantly, no 6s lag)
  - `562801d` conversational warm gate (short "continue"/"go on" accepted) + stop-doesn't-close
  - `62e386a` run.blocks text/tool_use render as prose + `🔧` chip (not JSON)
  - `441d35c` run.blocks per-message dedup (backend double-delivers)
  - astridr-repo `b3ae806a` — "continue" RESUMES the interrupted reply (wiring.py prompt), container rebuilt + live.

## NEXT STEP — wire real voice into the presence page
Goal: talking to her works on `/chat`, **gated by the mic ON/OFF toggle** (`listening` state in Chat.tsx). When off → no mic, text-only.

Where the voice logic lives today (in the popup, to migrate/reuse):
- `src/components/voice/VoiceModePanel.tsx` — the full voice interaction: `useSpeechRecognition`, barge-in (interim detection, `handleBargeIn`, `bargeInSwallowFinalRef`), `conversationWarmRef` gate, `flushSend` (sends via `chat.send` with `interrupted_reply`), silence timer, `shouldReject` noise gate, follow-up window.
- `src/components/voice/voiceState.ts` — reducer + `isBargeInPhrase`/`isEndPhrase`/`isStrictModeCommand`. NOTE: we discussed dropping "stop" from `END_PHRASES` (it's overloaded as both barge-in AND end-phrase) so "stop" never closes — was mid-change when we pivoted; re-decide when wiring.
- `src/hooks/useSpeechRecognition.ts` — the Web Speech hook (continuous + interim).
- `src/components/voice/AvatarAura.tsx` — `state="listening"|"transcribing"` **acquires the mic** for the reactive aura; `state="speaking"` reacts to her TTS analyser. Currently the page passes `idle`/`processing` only (avatar calm) to avoid a premature mic prompt. When wiring: drive `avatarState` from the real voice state, gated by `listening`.

Plan when resuming:
1. Lift the recognition + barge-in + transcript + send logic out of VoiceModePanel into the presence page (or a `useAstridrVoice` hook that composes `useAstridrChat.sendMessage`). The conversation send should go through `useAstridrChat` (unify — don't keep VoiceModePanel's separate `flushSend`).
2. Gate all mic acquisition on `listening`. Toggling off must `stop()`/`abort()` the recognizer and release the mic; on must (re)start it.
3. Wire `avatarState` to the real voice state (listening/transcribing/processing/speaking) so the aura reacts + the mic-reactive AvatarAura works; keep the dim when `listening` is off.
4. Live transcript + "Listening…/Thinking…/Speaking" status from the real state.
5. Decide the CommandPalette wake-word popup's fate — she's page-scoped now, so the global wake-word popup (`CommandPalette` voiceMode in DashboardLayout) likely goes away or is repurposed to focus the Chat page.
6. Verify LIVE with Larry (barge-in "stop" cuts instantly + stays, "continue" resumes, short replies accepted, mic OFF truly silences). Don't ship voice-timing changes unverified (restart-storm lesson).

## Open backend TODOs (not blocking the presence work)
- `run.blocks` is delivered to the WS **twice** (`telemetry.send` + `telemetry.send_live` both hit `_ws_subscribers`); frontend dedups it. Proper fix: emit once (astridr `loop.py` / `post_turn_pipeline.py`). `TODO(backend)` marker in `useAstridrChat.ts`.
- Active brain is **claude-cli** (brain-swap branch); tool-call turns emit text in both the tool-round and final `run.blocks` (identical text) — the dedup also covers this, but cleaner upstream.

## GSD Phase 183 note
This presence redesign grew out of `/gsd-execute-phase 183` (conversation polish). 183 waves 1–4 executed; 183-04 SUMMARY reconstructed + committed. 183-05 is manual live verification (CONV-01 echo-guard + CONV-04 hands-free) — now partly superseded by this redesign. Reconcile 183 status when the voice wiring lands.
