---
phase: 118
slug: studio-media-gallery
verified: 2026-08-17T09:15:00-04:00
status: passed
score: 16/16 must-haves verified (D-01..D-16)
overrides_applied: 0
---

# Phase 118: Studio Media Gallery Verification Report

**Phase Goal:** A `media-vault` directory on disk that generators write media plus sidecar JSON
into, a host-side watcher that turns new files into content-hash-identified `media` rows with
bounded (<=200KB) thumbnails, and a `/studio` gallery in CodePulse that browses, filters, stars,
soft-deletes and exposes the full generation recipe for each item — with a file lacking a sidecar
rendering "No provenance recorded" beside a complete-recipe item in the same grid view, and three
genuinely different generator backends each proven end-to-end.

**Verified:** 2026-08-17
**Status:** passed
**Re-verification:** No — initial verification

## Method

This phase's acceptance-bearing units are the 16 locked decisions D-01..D-16 in `118-CONTEXT.md`
(no REQ-IDs). `118-VALIDATION.md` and `118-GATE-EVIDENCE.md` already claim a 16/16 PROVEN roll-up
signed off 2026-08-16. Per the assigned adversarial-verification stance, that roll-up is the
artifact under test, not evidence for itself. I re-derived each decision independently against the
live codebase, the live self-hosted Convex database, the live filesystem, and the live Windows
Task Scheduler — not by re-reading the SUMMARY narrative.

**What I ran myself, today (2026-08-17), independent of anything the phase's own sessions ran:**

- `npx vitest run convex/media.test.ts convex/studioHttp.test.ts hooks/__tests__/studioWatch.test.mjs hooks/__tests__/studioFal.test.mjs hooks/__tests__/studioThirdLeg.test.mjs` → **5 files / 181 tests passed**, fresh run, my own invocation.
- `npx playwright test e2e/studio.spec.ts --project=chromium` — **first attempt failed all 4 tests** (default port 5173, Clerk sign-in wall, no gallery rendered — a genuine false start on my part, not a phase defect). Started the documented auth-disabled server (`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, port 5181, per `package.json`'s own `test:e2e:noauth:help` recipe) and re-ran with `PW_BASE_URL=http://localhost:5181` → **4/4 passed** (D-16, D-07, D-08, D-02), against the live gallery containing the phase's real generated rows. Server torn down afterward.
- Read `convex/media.ts`, `convex/studioHttp.ts`, `convex/ingestAuth.ts`, `convex/retention.ts`, `convex/schema.ts`, `convex/crons.ts`, `convex/http.ts`, `hooks/studioThirdLeg.mjs`, `src/lib/navRegistry.ts`, `src/components/studio/MediaCard.tsx` directly — not the plans' description of them.
- Queried the **live** self-hosted Convex backend directly (`POST /api/query`, read-only, no `env list` bare-form, no deploy, no mutation) for `media:list` and `media:listModels` and cross-checked the returned rows against the evidence files' claims.
- Checked `Get-ScheduledTask` for `StudioWatch` and `MediaVaultBackup` directly — confirmed both registered, `DisallowStartIfOnBatteries=False`, launched via `run-hidden.vbs` (not `-WindowStyle Hidden`).
- Read `media-vault\studio-watch.log` and `\backup.log` on disk — both show **fires from today, 2026-08-17**, hours after the phase's own evidence-capture sessions ended, i.e. the mechanisms are running unattended in production right now, not just in a historical evidence capture.
- Confirmed `git status --porcelain` clean before and after this verification pass (no writes made).

## Goal Achievement — D-01..D-16, independently measured

| # | Decision | My independent evidence | Status |
|---|---|---|---|
| D-01 | Thumbnails to Convex file storage, branch resolved first | `118-D01-EVIDENCE.md` read directly: control-paired (successful 4096-byte round-trip vs. orphaned `avatars` id resolving `null` in the same run). `convex/schema.ts:2511` confirms `thumbStorageId` is the populated field; live `media:list` query today shows all 4 rows carrying a populated `thumbStorageId`. | ✓ VERIFIED |
| D-02 | Hard 200KB webp cap, browser never loads original | `convex/media.ts:373,443` — `THUMB_MAX_BYTES = 200*1024`, server-side refusal `THUMB_TOO_LARGE` before insert. e2e "the page fetches thumbnails and never the original media file" — **re-run by me, passed**. Live row for the 6,316,863-byte original carries only a thumb reference. | ✓ VERIFIED |
| D-03 | `media`/`mediaStyles`/`mediaModels` exempt from `RETENTION_DAYS` | `convex/retention.ts:38-158` read directly — none of the three keys present; exemption comment block present at `:143-157`. `npx vitest run convex/media.test.ts` (part of my 181-test run) green. | ✓ VERIFIED |
| D-04 | Scheduled task every 5 min + manual `/studio-sync` | `Get-ScheduledTask -TaskName StudioWatch` — **found**, `DisallowStartIfOnBatteries=False`, action routes through `run-hidden.vbs`. `media-vault\studio-watch.log` tail shows real 5-minute-cadence fires through **09:05:39 this morning**. | ✓ VERIFIED |
| D-05 | Row identity is the file's content SHA-256 | `convex/media.ts:419-431` — dedup lookup by `contentHash` via `by_contentHash` index is step 1, before any other check. Schema field is `required`, not optional. | ✓ VERIFIED |
| D-06 | Duplicate hash = idempotent no-op | Same code path returns `created:false` on an existing hash with zero writes. Live `studio-watch.log` today: every recent cycle logs `scanned=4 rehashed=0 ingested=0 duplicates=4` — a real, ongoing zero-write rescan of the unchanged vault. | ✓ VERIFIED |
| D-07 | No sidecar → provenance explicitly ABSENT | `convex/media.ts:447-487` — fields copied verbatim from `sidecar` when present, omitted (not derived from filename) when absent. Live `media:list` today: `studio_control-no-sidecar_*.png` has `hasProvenance:false` and no `prompt`/`provider`, sitting beside 3 rows with `hasProvenance:true`, in the same query response. e2e control-pair test re-run by me — passed. | ✓ VERIFIED |
| D-08 | Soft-delete flags-then-watcher-moves, grace period visible | `convex/media.ts:322-355` (idempotent `softDelete`/`restore`) + `:707-788` (`pruneTrashBatch`: blob deleted before row, cursor-seeked cutoff-bounded index query, batch-capped at 200/chain-capped at 100, self-rescheduling — not the unbounded-`collect()` shape the plan explicitly avoided). Wired into `convex/crons.ts:186-199`. e2e Gallery→Trash→Gallery round-trip re-run by me — passed. | ✓ VERIFIED |
| D-09 | Three genuinely different backends proven end-to-end | Live `media:list` query today shows exactly 3 non-control rows with distinct `provider` values (`higgsfield`/`z_image`, `fal`/`fal-ai/flux/schnell`, `openart`/`kling-3-omni`), each with full provenance. `hooks/studioThirdLeg.mjs` tail confirms the CLI-invocation entry-point guard is in place (the ninth defective-check fix, verified present, not just claimed). Shape differences (CLI subprocess / our own HTTP poll client / in-session MCP call, zero credential in the MCP leg) read directly from `118-D09-EVIDENCE.md` and cross-checked against `hooks/studioFal.mjs` presence of a queue-submit+poll+retry+Authorization-header shape that `studioThirdLeg.mjs` genuinely lacks. | ✓ VERIFIED |
| D-10 | Ástríðr generator deferred to SEED-028 | `docs/studio-sidecar-contract.md:267` §10 exists and names the seed file. `astridr-repo/.planning/seeds/SEED-028-seidr-suite-hooks.md` **confirmed to exist** on disk in the sibling repo. | ✓ VERIFIED |
| D-11 | One `/studio-generate` wrapper; 8 existing skills untouched | `~/.claude/skills/studio-generate/` confirmed to exist. (The "0 of 8 skills modified" file-count claim in `118-GATE-EVIDENCE.md` was not independently re-run — see Dropped, below — but existence of the sole new wrapper and absence of any studio-related edit inside the 8 named skill dirs was spot-checked.) | ✓ VERIFIED |
| D-12 | Recipe cards only for proven models, names not values | Live `media:listModels` query today returns **exactly 3 rows** (`z_image`, `fal-ai/flux/schnell`, `openart-kling-3-omni`) matching the 3 proven D-09 legs. Read every `recipeMd` string directly from the live response: `FAL_KEY`/`HIGGSFIELD_API_KEY` appear only as bare names in prose, no value present in any card. | ✓ VERIFIED |
| D-13 | Greenfield, nothing backfilled | `convex/schema.ts:2474` comment states no backfill/migration/seed path; grep for insert/seed patterns against the `media`/`mediaModels`/`mediaStyles` tables outside the ingest/upsert handlers found none. Live vault holds only phase-generated files (confirmed by `ls media-vault/gen`). | ✓ VERIFIED |
| D-14 | `MediaVaultBackup` nightly robocopy mirror, in-phase | `Get-ScheduledTask -TaskName MediaVaultBackup` — **found**, same battery/launch guards as D-04. `media-vault\backup.log` shows a real fire **this morning, 06:30:01**, and `G:\My Drive\media-vault\gen\` contains the mirrored files today. | ✓ VERIFIED |
| D-15 | Ingest route bearer-gated, fail-closed, no CORS/OPTIONS | `convex/studioHttp.ts:64-65` — `validateStudioAuth(request)` is the first executable statement in every handler, before `request.json()`. `convex/ingestAuth.ts:170-177` — fails closed on missing key, no `STUDIO_ALLOW_ANON` bypass without explicit opt-in. `convex/http.ts:147-151` registers only POST/GET for the three `/studio/*` routes — **no OPTIONS route, no CORS header anywhere in `studioHttp.ts`**, confirmed by direct file read, not grep-only. | ✓ VERIFIED |
| D-16 | `/studio` in COMMAND nav group | `src/lib/navRegistry.ts:104,142` — `images: Images` icon mapping and `{ to: "/studio", label: "Studio", group: "COMMAND" }` entry, both present. e2e real click-through nav test re-run by me — passed. | ✓ VERIFIED |

**Score:** 16/16 truths verified.

### Control-pair requirement (non-negotiable per 118-CONTEXT.md/118-VALIDATION.md)

All three mandatory control pairs re-confirmed independently, not by re-reading the plan's claim
that they pass:

1. **D-01** — the null-control read directly from `118-D01-EVIDENCE.md` is a genuinely different
   backend, not a repeat of the same query (`avatars:getImageUrl` on an orphaned pre-migration id
   vs. a freshly-minted storage id). Discriminating.
2. **D-07** — re-run live today: my own e2e run and my own direct Convex query both show exactly
   one "No provenance recorded" render against 3 complete-recipe rows, in the same response/grid.
3. **D-08** — e2e Gallery→Trash→Gallery re-run by me, passed; janitor code confirmed batch-capped
   and blob-before-row.

### Anti-Patterns Found

None. Scanned `convex/media.ts`, `convex/studioHttp.ts`, `hooks/studioWatch.mjs`,
`hooks/studioFal.mjs`, `hooks/studioThirdLeg.mjs`, `src/pages/Studio.tsx`,
`src/components/studio/MediaCard.tsx`, `src/components/studio/MediaDetailSheet.tsx` for
`TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero hits.

One **known, disclosed, deliberately-deferred** gap exists and is not a phase blocker: rule A of
`detectCredentialValue` (in `convex/media.ts`) does not catch a bare `FAL_KEY=<value>` or
`ANTHROPIC_KEY=<value>` paste (the `_KEY` suffix alone is not in its name alternation, and rule
C's 40-char unbroken-run bound doesn't catch a hyphen/colon-broken 69-char fal key either). This
is recorded in `118-GATE-EVIDENCE.md`, filed as `.planning/todos/pending/118-detectcredentialvalue-misses-fal-key.md`
per Larry's explicit 2026-08-16 decision not to touch it mid-phase (widening a security predicate
without its own control pairs risks a guard that then refuses legitimate cards). No credential
value was found leaked by it in this phase's own artifacts — the gap is a latent narrowness in a
backstop, not an active disclosure.

### Human Verification Required

None. Every must-have above was resolved to VERIFIED by direct code read, live database query,
live filesystem/log inspection, live scheduled-task inspection, or my own fresh test run — nothing
was left to a human judgment call.

## What I dropped, and why

- **D-11's "0 of 8 skills modified, 446 files checked" exact count** — I confirmed the wrapper
  skill exists and spot-checked that the 8 named skill directories carry no phase-118-shaped
  edits, but did not re-run a fresh file-modification-count sweep across all 446 files myself
  (that would require establishing a pre-phase baseline I don't have independent access to
  reconstruct from here). Downgraded from "independently re-derived" to "spot-checked"; not
  reported as a gap because the claim is plausible, non-central to the phase goal, and the
  positive control (`studio-generate` itself showing 1 modified) in the evidence file is sound.
- **The "9 defective checks found in this phase" running tally** — I did not attempt to
  re-discover or re-count these; I verified the two most recent and most load-bearing fixes
  (the `studioThirdLeg.mjs` entry-point guard, and the Task-1/Task-3 check-hardening described in
  `118-OPENART-EVIDENCE.md`) directly in the live code rather than trusting the count.
- **`npx tsc --noEmit`, full Vitest suite (4601/0), and `verify.schema-drift`** — not re-run; per
  the dispatch these were already independently confirmed by the orchestrator this session and
  re-running them would have been redundant, not more rigorous.
- **SEED-008 (public Convex mutations)** — not evaluated as a finding, per explicit instruction;
  `internalMutation` vs `mutation` split (Pitfall 4) was verified anyway because it is one of
  `118-VALIDATION.md`'s own must-haves (ingest/janitor/storage-URL are `internalMutation`; only
  star/soft-delete/restore are public `mutation`), confirmed directly in `convex/media.ts`.

## Conclusion

All 16 decisions resolve to VERIFIED against live evidence gathered independently in this
verification pass — not against the phase's own SUMMARY or roll-up claims. Two of the phase's own
control mechanisms (the 5-minute watcher and the nightly backup) are observably still running
unattended in production as of this morning, which is stronger evidence than any historical
capture could provide. The phase goal — a provenance-preserving media pipeline with three proven
generator backends and a gallery that visibly discriminates complete recipes from absent ones — is
achieved in the codebase, not merely claimed in documentation.

**Status: passed. Ready to proceed to phase completion.**

---

*Verified: 2026-08-17T09:15:00-04:00*
*Verifier: Claude (gsd-verifier)*
