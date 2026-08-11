# 113-05 — D-08 Instrumentation Control (verbatim capture)

**Date:** 2026-08-11
**Purpose:** Prove `captureBrainPillDom()` (added in `src/pages/Chat.test.tsx`, Task 1 of
113-05, commit `f4756bf1`) produces a non-empty, real capture at the query site — before this
instrumentation can be trusted to diagnose the next occurrence of the `Chat.test.tsx` brain-pill
flake. Per D-08 as amended: "the first captured dump must come from a deliberate control and be
non-empty; an empty dump is a bug in the instrumentation, never evidence the DOM was empty at
test time."

## Procedure

1. Confirmed the working tree was clean (`git status --porcelain -- src/pages/Chat.test.tsx`
   returned nothing) after Task 1's commit `f4756bf1`.
2. Refreshed `src/pages/Chat.test.tsx.113-05.bak` to the current (post-Task-1-instrumentation,
   committed) file — `diff` against the live file exited 0 before making any control edit. (This
   deviates from the plan's literal "take the backup before editing" phrasing in Task 1, which
   would have captured the *pre*-instrumentation state; see the SUMMARY's Deviations section for
   why the backup had to reflect the instrumented state for Task 2's restore logic to be
   internally consistent.)
3. Temporarily changed **only** the expected string on the instrumented assertion
   (`src/pages/Chat.test.tsx:623`, formerly `:586` pre-instrumentation) from
   `"anthropic-sonnet-5"` to the unique control token `"DELIBERATE_CONTROL_MISMATCH_113_05_9x7q2"`.
4. Ran: `npx vitest run src/pages/Chat.test.tsx -t "keeps the base label byte-identical"`
5. Captured the complete failure output verbatim below.
6. Restored via `cp src/pages/Chat.test.tsx.113-05.bak src/pages/Chat.test.tsx` (never
   `git checkout --`, per the plan's shared-checkout warning) and proved the restore with
   `diff src/pages/Chat.test.tsx.113-05.bak src/pages/Chat.test.tsx` exiting 0.
7. Deleted the `.bak` file and confirmed `git status --porcelain src/pages/Chat.test.tsx.113-05.bak`
   returned nothing.
8. Re-ran `npx vitest run src/pages/Chat.test.tsx` and confirmed green (48/48 passed).

## Verbatim captured output (control run, exit code 1)

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
stdout | src/pages/Chat.test.tsx > Chat — composer brain pill (103-07-T2, D-01/D-03/D-15) > keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack
[voice] 19:31:57.716 mic.on → wake engine start 
[voice] 19:31:57.717 wake.status { to: 'loading' }
[voice] 19:31:57.717 wake.status {
  to: 'error-disabled',
  message: "Cannot read properties of undefined (reading 'getUserMedia')"
}
[voice] 19:31:57.717 wake.release-resources { hadWorker: false, hadAudioCtx: false, hadMicStream: false }

stderr | src/pages/Chat.test.tsx > Chat — composer brain pill (103-07-T2, D-01/D-03/D-15) > keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack
[useWakeWord] init failed: Cannot read properties of undefined (reading 'getUserMedia')
Failed to hydrate proactive prefs from server: YAMLException: expected a document, but the input is empty
    at Module.load (file:///C:/Users/mandr/codepulse/node_modules/js-yaml/dist/js-yaml.mjs:2259:36)
    at C:/Users/mandr/codepulse/src/hooks/useProactivePrefs.ts:97:34
    at processTicksAndRejections (node:internal/process/task_queues:103:5) {
  reason: 'expected a document, but the input is empty',
  mark: undefined
}
Failed to hydrate strict mode from server: YAMLException: expected a document, but the input is empty
    at Module.load (file:///C:/Users/mandr/codepulse/node_modules/js-yaml/dist/js-yaml.mjs:2259:36)
    at C:/Users/mandr/codepulse/src/pages/Chat.tsx:392:34
    at processTicksAndRejections (node:internal/process/task_queues:103:5) {
  reason: 'expected a document, but the input is empty',
  mark: undefined
}

stdout | src/pages/Chat.test.tsx > Chat — composer brain pill (103-07-T2, D-01/D-03/D-15) > keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack
[voice] 19:31:57.750 wake.release-resources { hadWorker: false, hadAudioCtx: false, hadMicStream: false }

 ❯ src/pages/Chat.test.tsx (48 tests | 1 failed | 47 skipped) 164ms
     × keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack 162ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/pages/Chat.test.tsx > Chat — composer brain pill (103-07-T2, D-01/D-03/D-15) > keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack
AssertionError: chat-brain-pill-label match count: 1
  [0] textContent="anthropic-sonnet-5" outerHTML="<span data-testid=\"chat-brain-pill-label\">anthropic-sonnet-5</span>"
chat-brain-pill-pending present: false
document.body.innerHTML length: 23387: expected 'anthropic-sonnet-5' to be 'DELIBERATE_CONTROL_MISMATCH_113_05_9x…' // Object.is equality

Expected: "DELIBERATE_CONTROL_MISMATCH_113_05_9x7q2"
Received: "anthropic-sonnet-5"

 ❯ src/pages/Chat.test.tsx:623:43
    621|     const labelBefore = (await screen.findByTestId("chat-brain-pill-la…
    622|     const domAtLabelBefore = captureBrainPillDom();
    623|     expect(labelBefore, domAtLabelBefore).toBe("DELIBERATE_CONTROL_MIS…
       |                                           ^
    624|
    625|     act(() => {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 47 skipped (48)
   Start at  15:31:55
   Duration  2.34s (transform 476ms, setup 80ms, import 1.38s, tests 164ms, environment 601ms)
```

## Acceptance bar (D-08 amended) — checked against the capture above

- **Match count ≥ 1:** `chat-brain-pill-label match count: 1`. PASS.
- **At least one non-empty `outerHTML`:** `[0] ... outerHTML="<span data-testid=\"chat-brain-pill-label\">anthropic-sonnet-5</span>"`. PASS.
- **`document.body.innerHTML` length > 0:** `document.body.innerHTML length: 23387`. PASS — proves
  the capture ran before cleanup, not after (a post-cleanup `onTestFailed` dump would show `0`).
- **`Received:` shows the real rendered label:** `Received: "anthropic-sonnet-5"`. PASS — proves the
  assertion mechanism still reports the actual text, unmasked by the message argument.

The instrumentation is proven non-empty and functioning. Restore was verified byte-exact
(`diff` exit 0) before the backup file was deleted, and `npx vitest run src/pages/Chat.test.tsx`
was green (48/48) immediately after restoration.
