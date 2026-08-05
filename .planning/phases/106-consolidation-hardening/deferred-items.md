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

## D-106-04-02: `react-syntax-highlighter` full Prism bundle (~774,578 bytes)

Baseline remediation candidate #1 from `106-BUNDLE-ANALYSIS.md`. Deliberately not
taken by plan 106-04 — the reasoning is written up in that file under
`## After remediation` § 4. It is a behavioural change (deciding which languages
stop highlighting) affecting a shared *lazy* chunk, not the entry chunk, and it
has two import sites rather than the single one the plan's action branch assumed.
Still open and unclaimed.
