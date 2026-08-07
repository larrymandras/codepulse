---
created: 2026-07-23
source: 98-HUMAN-UAT.md (tests 4, 5)
phase_origin: 98
priority: medium
type: uat-blocked-visual
---

# Phase 98 deferred browser-visual UAT (tests 4 & 5)

> **⚠ PARTLY RESOLVED 2026-07-27 — this file's body below was written 2026-07-23 and
> overstates what is still outstanding.** Re-checked at v14.0 scoping (2026-08-06)
> against `milestones/v11.0-phases/98-.../98-HUMAN-UAT.md:11,85`, which is the source
> of truth:
> - **Test 5 — DONE.** Fully verified in-browser 2026-07-27; the refusal toast shows
>   the real reason, not "Server Error" (CR-03 / ConvexError fix confirmed live).
> - **Test 4 — PARTLY DONE.** The **shadowed** sub-case is verified in-browser
>   (Restore disabled + shadow tooltip + no page-blank; the CR-02 guard holds).
> - **Still outstanding — Test 4's other three sub-cases only:** active-single-scope,
>   dormant-non-shadowed, and multi-scope ⋯ menu states.
>
> Not scoped into v14.0 — no v14.0 phase touches the Skills ⋯ menu, so this stays
> parked rather than being force-fitted to a phase. `98-HUMAN-UAT.md` still reads
> `status: partial` / `blocked: 1`, correctly.

Two Phase 98 UAT checks were **blocked on a signed-in CodePulse browser
session** (Clerk gates the whole app; the claude-in-chrome extension would not
pair across two Chrome restarts + a full quit on 2026-07-23, and headless
Playwright reaches only the sign-in screen). The **server / mutation / daemon /
registry halves of both are already verified and committed** — what remains is
purely whether the UI *renders* the expected control states and toast. Both were
left `blocked` in `98-HUMAN-UAT.md`; the phase sits at status `partial`.

Carry these into the next phase's human-UAT / UI pass, run against a
**signed-in** Skills page (real browser, logged into Clerk).

## Test 4 — ⋯ menu scope-gating and shadow/multi-scope tooltips
Open the ⋯ lifecycle menu on each staged row and confirm:
- **Active single-scope** row → shows **Archive** + exactly **one Move** item.
- **Dormant** row → shows **Restore** + **Delete Permanently**.
- **Shadowed dormant** row → **Restore disabled** with the shadow tooltip, and
  critically **does NOT blank the Skills page** (CR-02 regression guard).
- **Multi-scope** row → **Archive/Move disabled** with the honest reason string.

Data-side staging for every state was already verified in the registry
(single-scope, dormant-only, shadowed active+cold, multi-scope rows all exist).

## Test 5 — LAYER-1 refusal toast (CR-03 fix)
Click **Archive** on a skill that already has a dormant cold copy → a **toast**
must surface with the house-copy refusal reason, instead of doing nothing.
Server half PASSED (`enqueueLifecycle` throws
`lifecycle-refused:collision:a dormant copy already exists in cold storage`
before inserting any row); only the visual toast render is unconfirmed.

**How to resume:** with the extension paired to a fresh Claude Code session (or
by manual click-through), run `/gsd-verify-work 98` — it picks up from the two
`blocked` tests. Once both pass, Phase 98 advances from `partial` to `complete`.
