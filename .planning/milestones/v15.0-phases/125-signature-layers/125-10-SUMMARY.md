---
phase: 125-signature-layers
plan: 10
status: complete
verdict: revisit
executed: 2026-08-24
commits: [a80a1a07]
requirements: [SIGNAL-03]
---

# 125-10 — Serif trial: run it, and record the verdict

**Plan complete. Verdict: REVISIT.** The gate artifact
`.planning/phases/125-signature-layers/125-SERIF-TRIAL.md` exists, which is what D-16 requires.

"Complete" here means the trial was run and a verdict was recorded — it does NOT mean the serif
question was settled. `revisit` records that it wasn't.

## Task 1 — Prove the page is populated and the italic face is loaded (`a80a1a07`)

`e2e/serif-trial.spec.ts`, 182 lines, one file, no foreign file swept in. Passing. Measured:

- **20** `.briefing-voice` elements on screen — populated, not the empty state
- `cyan`: `fontFamily = "Instrument Serif", Georgia, serif`, `fontStyle = italic`
- `readable`: `fontFamily = Geist, system-ui, sans-serif`, `fontStyle = normal`
- Screenshots at `test-results/serif-trial-cyan.png` and `...-readable.png`

The orchestrator independently re-ran the spec against the live keyless server and reproduced every
value, and separately confirmed the server's identity (`PID 102152`,
`vite --port 5181 --strictPort --host 127.0.0.1`) rather than trusting an HTTP 200.

### The prescribed control was blind; the executor caught it

The plan said to prove font load with `document.fonts.check()` plus a bogus-family control. Probed
before asserting:

```
check("italic 17px 'Instrument Serif'")            -> true
check("italic 17px 'Definitely Not A Real Family'") -> true
```

`check()` returns `true` for any family in this Chromium build, so the control could not have come
out the other way. Replaced with a `FontFaceSet` scan (`family`/`style`/`status === "loaded"`),
which returns a genuine `false` for the bogus family. **Reusable finding: use the FontFaceSet form
for any font-load assertion in this repo; `document.fonts.check()` is not evidence here.**

## Task 2 — Operator checkpoint

Presented to Larry with Task 1's measurements and the dev server already running. He answered:

> revisit — record that and use the malformed-snapshot control for 125-12

## Task 3 — Record the verdict

`125-SERIF-TRIAL.md` written with the verdict, his verbatim words, and the evidence.

## Why the verdict is `revisit` — the load-bearing finding

The trial surface contains **no authored prose at all**, so the checkpoint could not put its own
question to the operator. Measured via `convex run briefings:listBriefings` (50 rows, the same query
`src/pages/Briefings.tsx:20-21` paginates):

| `type` | count | `narrative` content |
|---|---|---|
| `session` | 46 | `Session <uuid> completed. N events recorded. Tool activity: Bash: 31, …` |
| `daily_digest` | 4 | `Daily digest for <date>. Sessions: 0. Cost: $0.0000. Anomalies: 0. Findings: 20.` |

Lengths min/median/max = 84/187/263. All 50 templated; zero authored. D-14/D-15 scope the serif to
*her authored prose*, so what was on screen in Instrument Serif italic was telemetry. Every one of
the 46 session rows collapses to the literal `Session <uuid> completed` — a UUID in a display serif.

An `adopt` or `reject` recorded against that would have been transcribed verbatim as the answer to
a question never actually asked, and read as settled by a later phase.

**This was caught by looking at the rendered page, not by reading the plan.** Task 1's own
acceptance criteria were fully satisfied — the page WAS populated, the face WAS loaded — because
"populated" was defined as element count, and 20 templated strings satisfy that as readily as 20
authored ones. The criterion could not distinguish the two.

## What did NOT change

No shipped code. 125-05's work stands exactly as landed: Instrument Serif italic on `/briefings`
and nowhere else, `readable` override intact as CSS. `revisit` marks the QUESTION unresolved, not
the implementation wrong.

## Downstream

- A valid re-trial needs a surface carrying authored prose, and must ASSERT that before measuring
  anything visual. Three candidate directions are recorded in `125-SERIF-TRIAL.md`; none is chosen.
- Larry's same reply also settled 125-12's control problem — recorded as **D-20** in
  `125-CONTEXT.md`, not here.
