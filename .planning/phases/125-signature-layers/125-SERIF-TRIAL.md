# 125-SERIF-TRIAL — Ástríðr's serif voice, trial verdict

**Verdict: REVISIT**
**Decided by:** Larry, 2026-08-24
**Gate:** D-16. This file's EXISTENCE is the gate. Its presence unblocks *proposing* an app-wide
serif change; it authorises nothing. App-wide adoption is out of scope for v15.0 regardless of what
this file says (`REQUIREMENTS.md:97`).

## The verdict, verbatim

> revisit — record that and use the malformed-snapshot control for 125-12

## Reasoning

The verdict is **not** a judgement about the typeface. It is a judgement that the trial could not
put the intended question to the operator, because the surface under trial contains none of the
content the decision was scoped to.

D-14/D-15 scope the serif to **Ástríðr's authored prose** — "her narrative and summary prose", in
the plan's own words. Measured on the live page at decision time, via
`convex run briefings:listBriefings` against the self-hosted backend (50 rows, the same query
`src/pages/Briefings.tsx:20-21` paginates):

| `type` | count | what the `narrative` field actually holds |
|---|---|---|
| `session` | 46 | `Session <uuid> completed. N events recorded. Tool activity: Bash: 31, AskUserQuestion: 2, Read: 2, …` |
| `daily_digest` | 4 | `Daily digest for 2026-08-24. Sessions: 0. Cost: $0.0000. Anomalies: 0. Findings: 20.` |

Narrative lengths: min 84, median 187, max 263 characters. **All 50 are machine-generated
templates. Zero are authored prose.** The longest narrative on the page is a list of tool
invocation counts.

So what was rendering in Instrument Serif italic — and what the operator was being asked to judge
as "her voice" — was telemetry. A verdict of *adopt* or *reject* recorded against that would have
been recorded verbatim as the answer to a question that was never actually posed, and a future
phase would have read it as settled.

The collapsed rows are worse than the expanded ones for this purpose: every one of the 46 session
briefings collapses to the literal string `Session <uuid> completed`, i.e. a UUID set in a display
serif.

## What was nonetheless PROVEN, and remains valid

The mechanical half of the trial (plan 125-10 Task 1, commit `a80a1a07`,
`e2e/serif-trial.spec.ts`) succeeded and its findings stand independently of this verdict:

- The page was genuinely populated — 20 `.briefing-voice` elements on screen, not the empty state.
- The **real** Instrument Serif italic face is loaded, not a Georgia fallback.
- Default `cyan` theme: `fontFamily = "Instrument Serif", Georgia, serif`, `fontStyle = italic`.
- `[data-theme="readable"]`: `fontFamily = Geist, system-ui, sans-serif`, `fontStyle = normal` —
  the D-15 override works, as a CSS override rather than a JS theme check.

So the *plumbing* is correct and does not need re-doing. Only the *content* was wrong.

### A blind control was found and replaced — worth keeping

The plan prescribed proving font load via `document.fonts.check()` with a bogus family as the
control. The executor probed before asserting and measured:

```
document.fonts.check("italic 17px 'Instrument Serif'")            -> true
document.fonts.check("italic 17px 'Definitely Not A Real Family'") -> true
```

In this Chromium build `check()` returns `true` for **any** family, including invented ones. The
prescribed control could not have come out the other way, so the `true` was worthless. It was
replaced with one that discriminates — iterating the live `FontFaceSet` for a `FontFace` whose
`family === "Instrument Serif"`, `style === "italic"`, `status === "loaded"`:

```
realFamilyLoaded(FontFaceSet)       -> true
bogusFamilyHasAnyEntry(FontFaceSet) -> false   (a genuine false)
```

The orchestrator re-ran the spec independently and reproduced all four values. Keep this: any
future font-load assertion in this repo should use the FontFaceSet form, not `check()`.

## What a valid re-trial requires

Not a new typeface decision — a surface that actually carries her voice. Whoever re-runs this must
first establish that the page under trial contains authored prose, and say how they established it.
Candidate directions, none of them decided here:

1. Generate or seed briefings whose `narrative` is genuinely authored rather than templated, then
   re-run this same spec and checkpoint unchanged.
2. Trial the serif on a different surface that already carries authored prose. Note that
   `InsightsChat` was explicitly REJECTED as the trial surface on speaker-identity grounds, and
   regressing `/chat` is out of scope — so this needs its own decision, not an assumption.
3. Accept that no surface currently carries her authored prose, and treat "give Ástríðr an authored
   voice to typeset" as upstream work that must precede any serif trial at all.

The blocking precondition for any re-trial: **assert the page holds authored prose before measuring
anything about how it looks.** A trial that renders templates in a voice font measures nothing,
and this one is the proof of that.

## Scope note

Nothing in the shipped code changes as a result of this verdict. Plan 125-05's work stays exactly as
landed — Instrument Serif italic is live on `/briefings` and nowhere else, with the `readable`
override intact. `revisit` records that the QUESTION is unresolved, not that the implementation is
wrong.
