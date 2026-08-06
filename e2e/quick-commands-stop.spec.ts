import { test, expect, type Page } from '@playwright/test';

/**
 * Quick Commands "Stop" — media-element proof (188.1-05, D-18).
 *
 * D-18 exists because of a four-round investigation failure in Phase 188: a `tts.end` self-reported
 * cut-latch flag reading false was read as "the audio finished" when it actually meant "our own
 * cut-latch did not fire" (see the inline comment near the assertion below for the literal field
 * name and the 2026-07-30 lesson this rule codifies). A flag that reports our own action is never
 * evidence of the outcome.
 * This spec asserts on the media element's own `currentTime` versus `duration`, read from the
 * `tts.audio.stop.called` trace entry `useTtsPlayback.ts` emits BEFORE it tears the element down.
 *
 * `codepulse/src/test/setup.ts` replaces `window.Audio` globally with a shared jsdom mock that has
 * no `currentTime`/`duration` properties at all — a Vitest test can only prove wiring, never the
 * real cut. That is why this is a Playwright spec against a real browser and a real `<audio>`
 * element (see plan's <why_this_must_be_a_browser_test>).
 *
 * Reaching real playback: this harness runs with no astridr backend (VITE_BRAINS_STUB only covers
 * brain-swap, not chat/TTS). Investigated, in order:
 *   1. No dev/stub affordance drives useTtsPlayback directly — grepped `__astridr*` across src/,
 *      only `__astridrVoiceTrace` exists (the trace ring buffer itself, not a play trigger).
 *   2. `page.route` CAN intercept the audio request `new Audio(fullUrl)` issues and serve a real,
 *      known-duration local file — but reaching that request at all requires a `run.tts` WS event
 *      with a real `audio_url`, which requires a live backend. Extended: `page.routeWebSocket`
 *      mocks the WS transport (`ws://.../ws/telemetry`) that `AstridrWSContext.tsx` opens, so the
 *      REAL client code path (chat.send -> ack -> run.text -> run.completed -> run.tts) runs
 *      unmodified; only the WS *server* and the audio *bytes* are fake. The element under test,
 *      the hook, the trace, and the Stop button's whole call chain are all real product code.
 *   3. A genuine end-to-end reply (no mocking) is not reachable in this harness — no backend runs.
 *
 * This uses option 2 (WS-mocked, real-element proof), not a skip. If either mock fails to produce
 * a real playing element, this spec fails loudly rather than passing on nothing (honest-skip
 * contract) — see the explicit non-null / non-zero assertions below.
 *
 * Call chain, verified live 2026-08-06 (line numbers are a live read, not the plan draft's stale
 * ones — see 188.1-05-SUMMARY.md deviations):
 *   QuickCommandsPanel.tsx:100  <Button onClick={onStop}>Stop</Button>  (no data-testid; targeted
 *                                by accessible name "Stop", which is unique among this panel's
 *                                4 buttons)
 *   Chat.tsx:1111                onStop={voice.triggerBargeIn}          (THE REAL WIRING — CONTEXT.md's
 *                                :284 and UI-SPEC's :1076 are both now stale; :1111 is live)
 *   useAstridrVoice.ts:1906      triggerBargeIn: handleBargeIn
 *   useAstridrVoice.ts:1128      const partial = chatRef.current.interrupt("barge-in")
 *   useAstridrChat.ts:495        stopAudio(`interrupt:${reason}`)        (reason = "barge-in")
 *   useTtsPlayback.ts:180        ttsTrace("stop.called", audioRef.current, { reason, playbackId })
 *                                <-- THE ASSERTION POINT, fires BEFORE teardownAudioEl (line 182)
 *
 * Reaching a message with audioUrl: ChatBubble's "Replay Ástríðr's voice" button
 * (`ChatBubble.tsx:265`) calls `onPlayAudio(audioUrl)`, which Chat.tsx wires directly to the SAME
 * `playAudio` (`useTtsPlayback.play`) that the real `run.tts` auto-play path uses
 * (`useAstridrChat.ts:72,389`) — clicking Replay is the same shared hook/element/trace, not a
 * parallel path. `ttsEnabled` defaults to false, so the mocked `run.tts` event only attaches
 * `audioUrl` to the message (auto-play does not fire) — this spec starts playback deliberately by
 * clicking Replay, so it controls exactly when playback begins.
 */

const LS_ONBOARDING = 'codepulse_onboarding_complete';
const LS_COMMAND_CENTER = 'codepulse-command-center';

const SESSION_ID = 'e2e-d18-stop-session';
const AUDIO_PATH = '/e2e-fixtures/quick-commands-stop-test-audio.wav';
// Generous on purpose — see the note near the Stop click below: a real, unrelated toast
// notification can delay Playwright's click retry loop by several real seconds, and this
// duration must comfortably outlast that so the assertion never races it.
const AUDIO_DURATION_S = 30;

/** A real, valid, multi-second mono 16-bit PCM WAV — generated in-memory, no binary fixture
 *  committed to the repo. This is the "local audio file of known, multi-second duration" the plan
 *  calls for: a real HTMLAudioElement loads and plays these exact bytes, giving genuine
 *  currentTime/duration values, without needing a real backend or a real ElevenLabs call. */
function makeWavBuffer(durationSeconds: number, sampleRate = 8000): Buffer {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format tag
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  const freq = 220; // low, quiet tone — content is irrelevant, only duration/timing matter
  const amplitude = 6000;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.round(amplitude * Math.sin(2 * Math.PI * freq * t));
    buffer.writeInt16LE(sample, 44 + i * bytesPerSample);
  }
  return buffer;
}

interface TraceEntry {
  t: string;
  ev: string;
  d: {
    reason?: string;
    playbackId?: number;
    currentTime?: number | null;
    duration?: number | null;
    paused?: boolean | null;
    ended?: boolean | null;
    [key: string]: unknown;
  };
}

/** Reads window.__astridrVoiceTrace from inside the page and returns the LAST entry whose `ev`
 *  is `tts.audio.stop.called` — the app's own instrumentation point, fired BEFORE the element is
 *  torn down. This is the assertion target; nothing else in this file is. */
async function readLastStopCalledEntry(page: Page): Promise<TraceEntry | null> {
  return page.evaluate(() => {
    const buf =
      (window as unknown as { __astridrVoiceTrace?: Array<{ ev: string }> }).__astridrVoiceTrace ??
      [];
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].ev === 'tts.audio.stop.called') return buf[i];
    }
    return null;
  }) as Promise<TraceEntry | null>;
}

test.describe('Quick Commands "Stop" — media-element proof (D-18)', () => {
  test('clicking Stop mid-reply cuts the real <audio> element (currentTime < duration)', async ({
    page,
  }) => {
    // ── Setup, all BEFORE goto ──────────────────────────────────────────────────────────────
    // Suppress onboarding modal + force command-center mode (QuickCommandsPanel only renders in
    // the command-center footer band), same idiom as command-center-breakpoints.spec.ts. Also
    // wraps the REAL window.Audio constructor so this spec can poll a real HTMLAudioElement's
    // currentTime to know WHEN playback has genuinely started, before clicking Stop — clicking
    // before playback starts would prove nothing. This wrapper fully delegates to the native
    // constructor (returns a real `new Audio(...)` instance unmodified) — it is NOT a mock and is
    // NOT the jsdom setup.ts mock; it only stashes a reference for this spec to read. The PASS/
    // FAIL assertion below never reads this array — it reads the app's own trace entry.
    await page.addInitScript(
      ({ onboardingKey, ccKey }) => {
        window.localStorage.setItem(onboardingKey, 'true');
        window.localStorage.setItem(ccKey, 'true');

        const NativeAudioCtor = window.Audio;
        (window as unknown as { __e2eAudioElements: HTMLAudioElement[] }).__e2eAudioElements = [];
        function TracedAudio(this: unknown, ...args: unknown[]) {
          const instance = new (NativeAudioCtor as unknown as new (
            ...a: unknown[]
          ) => HTMLAudioElement)(...args);
          (window as unknown as { __e2eAudioElements: HTMLAudioElement[] }).__e2eAudioElements.push(
            instance
          );
          return instance;
        }
        TracedAudio.prototype = NativeAudioCtor.prototype;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).Audio = TracedAudio;
      },
      { onboardingKey: LS_ONBOARDING, ccKey: LS_COMMAND_CENTER }
    );

    // Mock the astridr WS transport (AstridrWSContext.tsx connects to `.../ws/telemetry`). No
    // real backend runs in this harness. Only `chat.send` is handled; everything else (the
    // initial `{action:"subscribe",...}`) is ignored, matching the real server's fire-and-forget
    // subscribe semantics for this spec's purposes.
    await page.routeWebSocket(/\/ws\/telemetry$/, (ws) => {
      ws.onMessage((raw) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
        } catch {
          return;
        }
        if (msg.type !== 'chat.send') return;
        const requestId = msg.request_id as string;
        ws.send(
          JSON.stringify({ type: 'ack', request_id: requestId, status: 'ok', session_id: SESSION_ID })
        );
        // Small delay mirrors a real server round trip; also lets the client's ack-continuation
        // (which sets activeSessionRef and appends the streaming assistant message) commit first.
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              event_type: 'run.text',
              data: {
                session_id: SESSION_ID,
                text_chunk: 'Mocked reply for the D-18 Stop proof (188.1-05).',
                done: true,
              },
            })
          );
          ws.send(JSON.stringify({ event_type: 'run.completed', data: { session_id: SESSION_ID } }));
          // audioUrl attaches to the message; ttsEnabled defaults false so this does NOT
          // auto-play (useAstridrChat.ts's willPlay gate) — this spec starts playback itself by
          // clicking Replay, below, so it controls exactly when playback begins.
          ws.send(
            JSON.stringify({
              event_type: 'run.tts',
              data: { session_id: SESSION_ID, audio_url: AUDIO_PATH },
            })
          );
        }, 50);
      });
    });

    // Serve a real, known-duration local WAV in place of a remote TTS asset. The resulting
    // <audio> element is real; only the bytes are local (threat model T-188.1-12).
    await page.route(`**${AUDIO_PATH}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: makeWavBuffer(AUDIO_DURATION_S),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // Race-safe gate check (brain-swap.spec.ts / command-center-breakpoints.spec.ts idiom).
    const signInText = page.getByText('Sign in to access the telemetry dashboard');
    const gridWrapper = page.getByTestId('cc-grid');
    await expect(signInText.or(gridWrapper).first()).toBeVisible({ timeout: 15000 });

    if (await signInText.count()) {
      test.skip(
        true,
        'Clerk auth gate present — D-18 could not be honestly exercised. Recorded as STILL OPEN in 188.1-SMOKE.md, never as a pass.'
      );
    }

    await expect(gridWrapper).toBeVisible();

    // ── Send a message so the mocked WS round trip produces an assistant reply with audioUrl ──
    // The send button is disabled on BOTH an empty draft AND a disconnected WS
    // (`disabled={!draft.trim() || isStreaming || disconnected}`, Chat.tsx) — fill the textarea
    // FIRST so the post-fill enabled check actually isolates the WS-connected signal instead of
    // failing on the empty-draft condition regardless of connection state.
    const textarea = page.getByPlaceholder('Type or speak to Ástríðr…');
    await textarea.fill('Testing the Quick Commands Stop button (D-18, 188.1-05).');

    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton, 'send button must enable once the mocked WS reports connected').toBeEnabled({
      timeout: 15000,
    });
    await sendButton.click();

    // ── Reach a replayable message (real shared playback entry point) ────────────────────────
    const replayButton = page.getByRole('button', { name: "Replay Ástríðr's voice" });
    await expect(
      replayButton,
      'the mocked run.tts event must attach audioUrl to the assistant message'
    ).toBeVisible({ timeout: 15000 });

    await replayButton.click();

    // ── Wait for GENUINE playback (non-zero elapsed) before clicking Stop ────────────────────
    // Clicking Stop before playback has actually started proves nothing (plan's explicit
    // requirement). Polls the REAL HTMLAudioElement captured by the addInitScript wrapper above.
    await page.waitForFunction(
      () => {
        const arr = (window as unknown as { __e2eAudioElements?: HTMLAudioElement[] })
          .__e2eAudioElements;
        if (!arr || arr.length === 0) return false;
        const el = arr[arr.length - 1];
        return el.currentTime > 0.3 && !el.paused;
      },
      undefined,
      { timeout: 10000, polling: 100 }
    );

    // ── Click Stop — the button under test. Targeted by accessible name (no data-testid on this
    // button; QuickCommandsPanel.tsx:100). "Stop" is unique among this panel's 4 buttons (Strict
    // Mode / Focus Mode / Share Screen / Stop). ─────────────────────────────────────────────
    // Live-run finding (188.1-05): a real, unrelated app feature (FocusExitDigest, 186-13) fires
    // a "While you were focused" sonner toast on mount with a 5-8s auto-dismiss
    // (FocusExitDigest.tsx's TOAST_DURATION_MS), and its notification region can intercept
    // pointer events over the footer band, delaying Playwright's click retry loop by several
    // real seconds — confirmed via `DEBUG=pw:api`, not guessed. Rather than race that unrelated
    // toast's timing (which would still be a race if the toast fires late), AUDIO_DURATION_S is
    // generous (comfortably longer than the toast's worst-case dismiss window) so the click
    // retry loop resolving late still lands well inside the audio's real duration — this is a
    // recorded interaction with a genuine feature, not a fake or scripted delay.
    const stopButton = page.getByRole('button', { name: 'Stop', exact: true });
    await stopButton.scrollIntoViewIfNeeded();
    await stopButton.click();

    // ── THE ASSERTION — read the app's own trace entry, never the flag that reports our own
    // action. This spec deliberately never reads or asserts on `tts.end`'s "barged" field or any
    // other latch — see the 2026-07-30 lesson this rule exists to codify: a flag reporting our
    // OWN action (whether the cut-latch fired) is never evidence of the OUTCOME (whether
    // playback actually stopped). ──────────────────────────────────────────────────────────
    const stopEntry = await readLastStopCalledEntry(page);

    // eslint-disable-next-line no-console
    console.log(`D18-EVIDENCE ${JSON.stringify(stopEntry)}`);

    expect(
      stopEntry,
      'a tts.audio.stop.called trace entry must exist after clicking Stop — its absence means the click never reached useTtsPlayback.ts:180'
    ).not.toBeNull();
    if (!stopEntry) return; // unreachable after the assertion above; narrows the type below

    expect(stopEntry.ev, 'the traced event must be the real assertion point, not any other trace entry').toBe(
      'tts.audio.stop.called'
    );

    const { currentTime, duration, reason } = stopEntry.d;

    // A null or zero currentTime/duration is the jsdom mock's default state and the documented
    // warning sign (188.1-RESEARCH.md Pitfall 4) of a test that proves nothing. Fail explicitly
    // rather than accept either as a pass.
    expect(
      typeof duration === 'number' && Number.isFinite(duration) && duration > 0,
      `duration (${duration}) must be a finite number > 0 — null/0 is the jsdom mock's default state, never a real reading, and is recorded as NO EVIDENCE`
    ).toBe(true);
    expect(
      typeof currentTime === 'number' && Number.isFinite(currentTime) && currentTime > 0,
      `currentTime (${currentTime}) must be a finite number > 0 — proves playback had genuinely started before Stop was clicked; null/0 is the jsdom mock's default state, never a real reading`
    ).toBe(true);

    const margin = (duration as number) - (currentTime as number);
    expect(
      margin,
      `currentTime (${currentTime}) must be less than duration (${duration}) by a meaningful margin — playback was CUT, not allowed to finish`
    ).toBeGreaterThan(1);

    // Confirms the click reached the intended chain (QuickCommandsPanel -> voice.triggerBargeIn
    // -> handleBargeIn -> chatRef.current.interrupt("barge-in") -> stopAudio), not some other
    // stop() call site.
    expect(reason, 'the stop reason must trace back to the barge-in interrupt path').toContain(
      'barge-in'
    );
  });
});
