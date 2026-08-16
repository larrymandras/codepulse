---
created: 2026-08-16
source: 118-14 Task 3 (D-12 card scan; found by getting a control WRONG)
phase_origin: 118
owning_code: convex/media.ts detectCredentialValue (shipped by plan 118-12)
priority: medium
type: security-backstop-gap
---

# `detectCredentialValue` does not catch `FAL_KEY=<value>`

Found while scanning the third recipe card during `118-14`. The first scan run used
`FAL_KEY=abc123def456ghi789` as rule A's known-positive control and it **did not trip**. The card
was clean; the *control* was wrong — and chasing why exposed a real narrowness in the shipped
guard.

## Measured

Rule A's name pattern is `API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL`.

| literal | rule A |
|---|---|
| `HIGGSFIELD_API_KEY=hf3x9q2v8m1p0zt4` (the docstring's own example) | caught |
| `OPENART_TOKEN=…` / `MY_SECRET: …` / `STUDIO_API_KEY=…` | caught |
| **`FAL_KEY=abc123def456ghi789`** | **not caught** |
| **`ANTHROPIC_KEY=abc123def456ghi789`** | **not caught** |

`_KEY` on its own is not in the alternation.

**Rule C does not save it.** Its bound is exactly 40 unbroken `[A-Za-z0-9_-]` characters (39 →
false, 40 → true, both measured). A realistic fal.ai key shape `<uuid>:<32-hex>` is 69 characters
whose **longest unbroken run is 36**, because the colon and the uuid's hyphens break it. So a
pasted real `FAL_KEY` value would pass the guard entirely.

## Why it was filed rather than fixed

- The guard belongs to **closed plan `118-12`**, and widening a security predicate mid-plan without
  its own control pairs is how a guard that refuses *legitimate* cards gets shipped. Its docstring
  is explicit that it must never refuse a card that merely NAMES a variable — that acceptance case
  is the control that proves it discriminates rather than refusing everything.
- It does **not** contradict the docstring, which already calls itself a backstop rather than a
  boundary and lists "a secret that simply does not look like one" as out of scope.

It is worth fixing anyway because **`FAL_KEY` is this repo's own primary provider credential**, so
the single most likely paste is precisely the one the name pattern misses.

## What a fix needs

1. Widen rule A's name alternation to cover a trailing `_KEY` (and probably `_PAT`, `_AUTH`).
2. Keep the acceptance control green: a card saying "reads `FAL_KEY` from the environment", a table
   row listing `HIGGSFIELD_API_KEY`, and placeholders (`$FAL_KEY`, `${…}`, `<your-key>`) must all
   still be ACCEPTED. That control is the point of the guard, not an afterthought.
3. Mutation-test both directions: a real-shaped `FAL_KEY=<value>` must go RED, and the
   name-only card must stay GREEN.
4. Consider whether rule C's 40-char bound should also see a colon-joined token as one run —
   changing that threshold is riskier and should be its own decision, since the docstring says it
   is deliberately not relaxed.

Larry's call on 2026-08-16: **file it, don't touch it now.**
