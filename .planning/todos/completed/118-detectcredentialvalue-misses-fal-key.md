---
created: 2026-08-16
closed: 2026-08-17
status: closed-fixed
source: 118-14 Task 3 (D-12 card scan; found by getting a control WRONG)
phase_origin: 118
owning_code: convex/media.ts detectCredentialValue (shipped by plan 118-12)
priority: medium
type: security-backstop-gap
---

> **CLOSED 2026-08-17 — FIXED.** Done after Phase 118's verification passed, deliberately
> not before: editing the code while the verifier was grading it would have risked a false
> finding, and the gap was excluded from the phase by Larry's own 2026-08-16 call.
>
> **What changed.** Rule A's name alternation gained `[_-](?:KEY|PAT|AUTH)`, so
> `FAL_KEY=`, `ANTHROPIC_KEY=` and `GITHUB_PAT=` are now caught. The separator is
> REQUIRED and is the whole design: a bare `KEY` alternative would make `MONKEY=…` a
> credential name. Rule C's 40-char bound is **UNCHANGED** — step 4 below called that a
> separate, riskier decision, and it was not made. Rule A now catches the realistic
> `<uuid>:<32-hex>` shape by NAME instead, which is why relaxing C was unnecessary.
>
> **Reproduced first, with controls.** Before any edit: `HIGGSFIELD_API_KEY=` and
> `OPENART_TOKEN=` both HIT while `FAL_KEY=` and `ANTHROPIC_KEY=` missed — the two hits are
> what make the two misses evidence rather than a broken probe. A realistic fal.ai key's
> longest unbroken run measured **36** against rule C's bound of 40.
>
> **Mutation-proven in BOTH directions**, each restored byte-identical (`cmp` clean):
> reverting the widening turned the two catch-direction tests RED; dropping the separator
> to a bare `KEY` turned the accept matrix RED on exactly `MONKEY=abcdefghijklmnop123`.
> A green that was never shown able to go red would have proved nothing.
>
> **Step 2's acceptance control is green and expanded** to 10 cases — name-only prose, a
> markdown table row, `$FAL_KEY`, `${FAL_KEY}`, `<your-key>`, shell-by-reference, plus
> `MONKEY=`/`TURKEY_COUNT=`. That control is the point of the guard, not an afterthought.
>
> **Defect-class sweep** (not just this instance): `src/lib/privacy.ts`'s `API_KEY_RE`
> shares the same narrow shape and also misses `FAL_KEY=`, but its sibling `ENV_VAR_RE`
> (`\b[A-Z][A-Z0-9_]{3,}=[^\s]+`) catches it — measured, so there is no live gap there.
> `hooks/workspaceClassifier.mjs` uses an allowlist (`isShareable`, deny-by-default) and is
> structurally immune to "missed a name shape". No other credential-name matcher exists.
>
> Gates: `tsc` zero diagnostics; full suite 4654 passed / 0 failed (+3 new tests).
> The docstring that DESCRIBES rule A was updated in the same commit — leaving it
> describing the old predicate is how a stale claim gets shipped next to correct code.

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
