# Deferred Items — Phase 127

## An intermittent full-suite failure exists, and its identity is NOT captured

This entry has been wrong twice. Both corrections are kept, because the way each was wrong is
the reusable part.

### Version 1 (plans 127-04, 127-05) — WRONG

Both plans logged `src/components/voice/AvatarAura.browser.test.tsx` as a **pre-existing,
unrelated repo defect**, attributed to commit `828a5b08` (Phase 193) via
`git log --oneline -1 -- <path>`.

Two errors, both worth carrying forward:

1. **A negative result is a claim about the probe, not the system.** Both observations were made
   inside git worktrees while multiple executors ran concurrently.
2. **`git log -1 -- <path>` answers "who last touched this file", never "why does it fail".**
   Both executors reached the same wrong attribution independently. Their agreement read as
   corroboration and was not — two probes sharing a defect agree exactly as readily as two
   correct ones.

### Version 2 (orchestrator, first correction) — ALSO TOO STRONG

Version 2 said the test "passes on the merged main checkout" and concluded "nothing is broken,
no action required." The first half was true and the conclusion was not, because it generalised
from two clean runs.

### Version 3 — what is actually measured, as of 2026-08-25

| Condition | Result |
|---|---|
| `npm test` full suite, main checkout | **7 of 8 runs clean; 1 run reported `1 failed`** |
| identity of that 1 failure | **NOT CAPTURED — unknown** |
| `npx vitest run --project browser` alone, main checkout | **6 of 6 clean** |
| `AvatarAura.browser.test.tsx` alone, main checkout | 1 file / 3 tests passed |
| full suite inside worktrees, concurrent executors | failed in 127-04, 127-05, 127-07; passed in 127-06 |

The failing run took **83s against a ~50s baseline**, i.e. it was the run under heaviest load.

**What this supports:** a failure that appears only under concurrent load and never in
isolation. `AvatarAura.browser.test.tsx` is the ONLY browser-mode test (its own `browser`
project in `vitest.config.ts`, launching a real chromium instance and vite server), which makes
it the most plausible candidate for an intermittent *import* failure under contention.

**What this does NOT establish, and must not be written as if it did:** that the one main-tree
failure WAS that file. The run was not captured. Circumstantial fit is not identification, and
this entry has already been rewritten twice for exactly that class of over-claim.

### Action required

**Build the capture mechanism rather than write a fourth note.** This symptom has now been seen
four times across two environments; a rule written down three times has already failed as a
rule. The next full-suite run that fails should archive its log automatically so the failing
test is named instead of inferred. Until then this is an OPEN, unidentified intermittent
failure — not a known-benign one.

**Does it block the Phase 127 deploy?** Assessment, for the operator to accept or reject: no.
127-08 deploys `convex/` schema and crons. Every `convex/**` test is deterministic and was green
in all 8 full-suite runs plus every targeted run. The intermittent failure has never once
implicated a `convex/` file. That is a judgement about scope, not a claim that the failure is
harmless.
