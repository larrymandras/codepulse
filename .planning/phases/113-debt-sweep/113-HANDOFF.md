# Phase 113 (Debt Sweep) — session handoff

Written 2026-08-11 at the end of a long session that completed Phases 116, 117
and 119. Nothing here is new analysis of 113 itself — it is the environment and
context a fresh session would otherwise have to rediscover.

---

## What 113 is

Three independent tech-debt items (ROADMAP `### Phase 113`, requirements
DEBT-05/06/07). Depends on nothing.

1. **DEBT-05 — `computeSkillPrunes` drops live plugin skills** on a transient or
   partial catalog scan. The observed symptom is a skill count oscillating
   185 → 131 → 185 across a scan cycle.
2. **DEBT-06 — the intermittent `Chat.test.tsx` brain-pill failure.** The
   success criterion is explicit that it must be fixed **from a captured root
   cause, not masked by a widened `waitFor`**. Treat an intermittent test as
   shared-fixture corruption or a real race until proven otherwise.
3. **DEBT-07 — `convex-selfhost/` under version control**: its compose
   `logging:` block and restart scripts committed and reproducible from a fresh
   checkout.

No `113-CONTEXT.md` exists yet, so the GSD pre-flight gate will stop a
`plan-phase`. Start with discuss/context.

---

## Environment facts this session established

**Playwright must run against the no-auth server.** The default
`npx playwright test` targets `:5173`, where Clerk is enabled, and every
nav-click test fails on a sign-in gate — proven by a probe returning
`"Sign in to access the telemetry dashboard"` with `ANCHOR_COUNT: 0`. Correct
invocation, already documented in `package.json`'s `test:e2e:noauth:help`:

```
VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth        # port 5181, from GIT BASH
PW_BASE_URL=http://localhost:5181 npx playwright test
```

A dev server was already running on 5181 during this session; check before
starting another (`--strictPort` fails loudly if occupied, which is how the
duplicate was caught).

**`npx convex env list` must never be run bare** — it prints `NAME=VALUE` for
every variable against this self-hosted backend. Always
`| cut -d= -f1` (bash) or `| ForEach-Object { ($_ -split '=')[0] }` (PowerShell).

**`Successfully set` is not evidence of persistence.** A `convex env set`
reported success while the stored value provably did not change; a second
identical attempt worked. Cause never established. Verify credential writes by
reading back and comparing hashes, never by trusting the CLI's own success line.

**Shared checkout.** A concurrent session has been committing every few minutes
throughout (Phases 110 and 111). It has had staged deletions sitting in the
shared index. Use `git commit -- <paths>` (pathspec-limited) rather than a plain
commit, and re-check `git status` immediately before committing.

---

## Known-failing tests that are NOT 113's, and NOT regressions

Do not spend time diagnosing these fresh:

- **`e2e/theme-contrast.spec.ts` — 20 failures.** Pre-existing, control-proven
  (reverting an unrelated nav entry reproduced all 20). Tracked as SEED-006.
- **`e2e/command-center-breakpoints.spec.ts` — 3 failures.** Caused by
  `87dafe30 feat(111-02)`, which deleted `ActiveAgentsPanel` while the spec still
  lists `'ACTIVE AGENTS'` at line 37 among required panel headers. Belongs to the
  in-flight Phase 111.
- **The Seiðr e2e specs (`galdr`, `bifrost`, `loom`) are flaky under full-suite
  parallel load** — contention over one shared Convex instance and one dev
  server, not a timeout value. Reliable in isolation: those four files together
  → 15/15. The fix is a separate serial Playwright project for live-data specs;
  deliberately not done because it is a repo-wide config change.

**Note for DEBT-06:** that last item is the same *class* of problem as the
`Chat.test.tsx` flake, but a different instance. Do not conflate them, and do not
let the e2e flakiness be "fixed" by widening a timeout — the success criterion
forbids exactly that shape of fix.

Unit suite was green at session end: `npx vitest run` → 298 files, 3947 passed,
0 failures. `npx tsc --noEmit` → exit 0.

---

## Planning-doc drift, unresolved

`STATE.md` and `ROADMAP.md` were deliberately left untouched all session because
the concurrent session owns them right now.

- The ROADMAP **Progress table lists only 108–113**. Phases 114–119 are absent
  entirely, so **116, 117 and 119 appear nowhere despite being complete and
  verified** (each has a `*-VERIFICATION.md` with `status: passed`).
- Phase 109's checklist entry is still unchecked while the same table reports it
  `10/10 Complete`.
- `STATE.md` frontmatter at handoff time read `completed_phases: 3`. Counting
  phases with a `VERIFICATION.md` on disk gives **5** (108, 109, 116, 117, 119).
  Re-derive from disk rather than trusting either number.

---

## Completed this session, for context only

- **116 Galdr** — prompt library, skill, verified passed (3/3 clauses, 16/16 decisions).
- **117 Bifröst** — link hub, verified passed (4/4, 6/6).
- **119 Loom** — curated pipelines, verified passed (4/4, 8/8). `/loom-author`
  and `/loom` skills are installed and pushed in the config repo.

A `LOOM_API_KEY` was leaked into the transcript by a PowerShell alias collision
(`H` shadowing `Get-History`, which printed its argument in an error) and has
since been **rotated and verified dead** (old `sha256 ef281a8b…`, new
`4d98cf6be5dd`, confirmed on both the backend and the user store, with a
wrong-key control returning exit 3).
