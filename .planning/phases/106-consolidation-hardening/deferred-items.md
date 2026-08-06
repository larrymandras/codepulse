# Phase 106 — Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by the plan that
found them.

## D-106-04-01: `src/pages/Chat.test.tsx` brain-pill test is intermittently failing

**Found:** 2026-08-05, during plan 106-04's pre-change baseline run.
**Scope:** pre-existing on a clean tree at commit `1c26a69a`, before any file in
plan 106-04 was touched. Not caused by, and not related to, the bundle work.

Full-suite run 1 of 3 failed at `src/pages/Chat.test.tsx:576-577`:

```
const labelBefore = (await screen.findByTestId("chat-brain-pill-label")).textContent;
expect(labelBefore).toBe("anthropic-sonnet-5");
```

Runs 2 and 3 on the identical tree passed (3401/3401). It did not recur in the
three post-change full-suite runs either (3430/3430 each). Because it is
intermittent, a passing run does **not** clear it.

Per the repo's own standing guidance, an intermittently-failing test is shared
fixture/state contamination until proven otherwise — the first suspect is
whatever earlier test in the run mutates the brain-selection state this
assertion reads. It was not investigated here because the fix belongs to the
Chat/brains surface, not to DEBT-03's import-shape work.

### Investigation 2026-08-06 — STILL OPEN, but three hypotheses are now RULED OUT

Investigated during the post-v13.0 debt sweep. **No fix applied, deliberately**: the
failure did not reproduce in ~8 full-suite runs that day (all green, 3478/3478 at the
end), and every mechanism proposed for it was disproved. Applying a `waitFor` to stop it
flaking would mask a defect that has not been identified — which is worse than leaving it
open. Recording the refutations so the next investigator does not repeat them:

1. **Shared-fixture contamination of the brain mocks — REFUTED.** The enclosing
   `describe`'s own `beforeEach` (`Chat.test.tsx:515-518`) resets **both**
   `mockActiveEngineMap = {}` and `lastBrainPickerProps = null`, alongside
   `vi.clearAllMocks()`. The deferred item's stated first suspect does not hold; neither
   variable can leak between tests in this block.

2. **Async catalogue changing the label mid-assertion — REFUTED.** `baseLabel` comes from
   `resolveModelDisplayName(resolved.model, catalogue, globalModelNames)` (`Chat.tsx:184`),
   and `catalogue` is loaded by an async `brainsApi.getCatalogue()` effect — a plausible
   race, since `findByTestId` resolves as soon as the element EXISTS, not once its content
   settles. But the mock is `mockGetCatalogue.mockResolvedValue([])` (line 155, re-applied
   at 519), and `resolveModelDisplayName` only rewrites the label when
   `catalogue.length > 0` (`brainsApi.ts:256`). An empty catalogue can never change it.

3. **`useGlobalModelNames` (the `fallbackNames` argument) — REFUTED.** It early-returns
   unless `status === "connected"` on the Ástríðr WebSocket (`useResolvedBrain.ts:170`),
   which never occurs under test, so it returns `{}` permanently.

With both async label sources inert, the rendered label is **deterministic** in this test,
which is what makes the single observed failure genuinely puzzling rather than a routine
race. The recorded symptom — the element was FOUND but its text differed — is consistent
with a stale element surviving from an earlier render (i.e. RTL cleanup not having run),
but that was not demonstrated and `findByTestId` would normally throw on a duplicate match
instead. **Next step for whoever picks this up:** capture the ACTUAL `textContent` on
failure (the run that failed did not record it), since knowing what it said instead of
`anthropic-sonnet-5` would discriminate the remaining candidates immediately.

## D-106-04-02: `react-syntax-highlighter` full Prism bundle (~774,578 bytes)

Baseline remediation candidate #1 from `106-BUNDLE-ANALYSIS.md`. Deliberately not
taken by plan 106-04 — the reasoning is written up in that file under
`## After remediation` § 4. It is a behavioural change (deciding which languages
stop highlighting) affecting a shared *lazy* chunk, not the entry chunk, and it
has two import sites rather than the single one the plan's action branch assumed.
Still open and unclaimed.
