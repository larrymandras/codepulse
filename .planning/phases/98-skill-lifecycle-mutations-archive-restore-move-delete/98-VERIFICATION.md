---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
verified: 2026-07-21T18:15:00Z
status: human_needed
score: 11/11 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Real cross-volume move (C: global/cold <-> G:\\ project workspace)"
    expected: "The skill directory relocates on disk (copy+delete fallback vs. the Google Drive virtual FS actually works against the live mount) and the Skills page shows the new lane after rescan"
    why_human: "The EXDEV/cross-volume fallback is unit-tested with an injected fake renameFn; the real Google Drive virtual-FS interaction (EIO/EPERM behavior, actual bytes on G:\\) cannot be proven by a same-host unit test"
  - test: "Archive / restore / permanent-delete round-trip against a live Forge daemon"
    expected: "Archiving a global skill moves it to ~/.claude/skills-available/ and the Skills page shows it as dormant after rescan; restoring it moves it back and clears the dormant lane; permanently deleting a cold row (via type-to-confirm) removes the directory and the row disappears"
    why_human: "Requires a running Forge daemon claiming real forgeCommands rows and a live rescanAndSync — not provable by same-host unit tests per 98-02-PLAN's own verification block"
  - test: "Offline-daemon expiry (LIFE-06)"
    expected: "With the daemon stopped, issuing an archive shows the command as queued, then visibly expires (RowStatusBadge 'expired') once the 5-minute TTL passes — never a false 'done'/success state"
    why_human: "Requires stopping the live daemon and watching real TTL expiry; the shared IntakeRowStatus 'expired' state is code-verified to exist and render, but the live timing/behavior needs a human watch"
  - test: "Menu scope-gating and shadow/multi-scope tooltips live in the browser"
    expected: "An active single-scope row shows Archive + one Move item; a dormant row shows Restore + Delete Permanently; a shadowed dormant row shows Restore disabled with the shadow tooltip (and does NOT throw / blank the Skills page — this is the CR-02 regression the review caught); a multi-scope row shows Archive/Move disabled with the honest reason"
    why_human: "Visual/interaction verification of Radix DropdownMenu + Tooltip composition in a real browser; jsdom test coverage exists (SkillLifecycleMenu.test.tsx, 21+ cases) but the review's own CR-02 finding was a real runtime crash that only a live render would have caught the first time, so a live smoke pass is warranted before calling requirements complete"
  - test: "LAYER-1 refusal toast surfaces correctly in the browser (CR-03 fix)"
    expected: "Clicking Archive on a skill that already has a dormant cold copy shows a toast with the house-copy refusal reason instead of doing nothing"
    why_human: "toast.error() firing and rendering via sonner is unit-tested via the mutation rejection path, but the actual visual toast appearance/timing is a UI behavior best confirmed live"
---

# Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete) Verification Report

**Phase Goal:** An operator can archive, restore, move, and delete skills from the UI, with every mutation executed atomically on the host by the Forge daemon and reflected back through a registry rescan — archive-first, `isShadowing`-aware, and honest when the daemon is offline.
**Verified:** 2026-07-21
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can archive an active skill to cold storage from the UI; host moves it to `.claude/skills-available/` and it's tracked dormant (LIFE-01 / ROADMAP SC1) | VERIFIED | `SkillLifecycleMenu.tsx:157-160` (`handleArchive` -> `enqueueLifecycle({action:"archive", destination:"cold", ...})`); `forge/src/process/lifecycle-exec.ts` archive branch moves global/project root -> cold root via `moveTree`; `lifecycle-exec.test.ts` archive happy-path test (real `fs.renameSync`) passes |
| 2 | User can restore a dormant/cold skill to active (global/project); shadow-blocked when an active same-name skill exists (LIFE-02/05 / ROADMAP SC2) | VERIFIED | `convex/forge.ts:646` (`lifecycle-refused:shadow:` LAYER-1); `lifecycle-exec.ts` LAYER-2 destination-exists re-check emits `shadow` kind for restore (line ~399); `SkillLifecycleMenu.tsx:174-244` disables Restore + renders the exact UI-SPEC tooltip copy when `isShadowing(skill)` is true, and `handleRestore` early-returns on `shadowed` as defense-in-depth |
| 3 | User can move a skill between global and project scope; host file relocates on disk (LIFE-03 / ROADMAP SC3) | VERIFIED | `MoveToProjectDialog.tsx` (workspace picker, enqueues `action:"move", destination:"project"`); `SkillLifecycleMenu.tsx` Move-to-Global direct enqueue; `lifecycle-exec.ts:354-378` resolves a project-scope SOURCE from `workspaceRootsForProjectOrigin`/`repoKey` (CR-01 fix, confirmed present in file and in `forge` commit `0bd6ae4`) — previously this path failed 100% of the time; now resolves host truth |
| 4 | Deleting a skill defaults to archive (reversible); true file deletion is a separate action requiring explicit confirmation (LIFE-04 / ROADMAP SC4) | VERIFIED | `DeleteSkillDialog.tsx:66` `canDelete = confirmText.trim() === skillName` (case-sensitive, no pre-fill, gates the destructive `AlertDialogAction`); Archive has no confirmation dialog (D-07, direct enqueue) — matches "archive is the default/reversible action, delete is separate+confirmed" |
| 5 | When the Forge daemon is offline, lifecycle actions queue and the UI shows the command will expire — no false-success (LIFE-06 / ROADMAP SC5) | VERIFIED (code-level) | `useLifecycle.ts` reuses `IntakeRowStatus`/`mapIntakeStatus` verbatim (import, not redefinition) including the `expired` state; `IntakeStatusBadge.tsx:91` defines the `expired` badge; the same `forgeCommands` TTL/expiry machinery from Phase 97 backs lifecycle rows unchanged (`buildLifecycleRow` mirrors `buildIntakeRow` field-for-field, `FORGE_COMMAND_TTL_MS`) |
| 6 | enqueueLifecycle is auth-gated, idempotent, and refuses every doomed mutation server-side before any row is queued | VERIFIED | `convex/forge.ts:1073` `enqueueLifecycle` mutation: fail-closed `getUserIdentity()` throw, `by_commandId` idempotency early-return, `isSafeSkillName` guard, LAYER-1 pre-flight (`convex/forge.test.ts` — full suite green, 239 passed / 21 todo) |
| 7 | The daemon executes archive/restore/move/delete natively in TS, cross-volume-safe, with a host-truth re-check and cold-only delete guard (DAEMON-02) | VERIFIED | `forge/src/process/lifecycle-exec.ts` — `runLifecycle`, `CROSS_VOLUME_CODES`/`copyTreeReadWrite` fallback (WR-03 mid-copy cleanup fix confirmed present), `existsAtRoot` LAYER-2 re-check, cold-only delete verified against global root AND every synced workspace; `lifecycle-exec.test.ts` + `command-poller.test.ts` — 55 tests green |
| 8 | rescanAndSync fires on success only; a failed mutation does not trigger it | VERIFIED | `command-poller.ts:463` `executeLifecycle` — `if (status==='done' && this.rescanCfg) void rescanAndSync(...)`, mirrors `executeIntake` exactly; covered by command-poller.test.ts |
| 9 | Concurrent same-name lifecycle commands cannot interleave; move-to-project resolves a fresh workspace list without a daemon restart | VERIFIED | `command-poller.ts` per-skillName in-flight `Set` + FIFO queue; `index.ts:152-167` `rescanCfg.workspaces` is now a getter calling `listWorkspaces(db)` fresh (Pitfall 5 fix) |
| 10 | Every skill row exposes an always-visible, scope-gated ⋯ menu; no wrong-action is ever rendered for the row's scope (D-07) | VERIFIED | `SkillRow.tsx:155` renders `<SkillLifecycleMenu skill={skill} hostId={hostId} lane={lane} />` outside the hover-only cluster with a `min-w-8 min-h-8` touch target; `SkillLifecycleMenu.tsx` gates dormant/active/multi-scope branches; `ColdStorageView.tsx` no longer references `/manage-skills`, now points to the ⋯ menu, and passes `lane="cold"` (WR-04 fix) |
| 11 | A LAYER-1 preflight refusal is surfaced to the user (not silently swallowed) and does not crash the Skills page on a shadow/multi-scope tooltip render | VERIFIED | CR-02 fix: `SkillLifecycleMenu.tsx:184` wraps the returned tree in a local `<TooltipProvider delayDuration={200}>` (this repo's `tooltip.tsx` embeds none, and neither `DashboardLayout` provider wraps the routed `<Outlet />`); CR-03 fix: all three enqueue call sites (`SkillLifecycleMenu.tsx:152`, `MoveToProjectDialog.tsx`, `DeleteSkillDialog.tsx:87`) now `.catch()`/`try/catch` and `toast.error(lifecycleRefusalMessage(err))`, dialogs close only on success |

**Score:** 11/11 truths verified at the code level (schema, mutation, daemon executor, UI wiring, all unit-tested and green; all 7 code-review findings requiring a fix — CR-01/02/03, WR-01/02/03, WR-04-partial — confirmed landed in both repos' current HEAD via `git show` on the cited commits and direct file reads)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | `lifecycle` commandType + `lifecyclePayload` union | VERIFIED | Line 1657 (`v.literal("lifecycle")`), line 1704 (`lifecyclePayload`) |
| `convex/forge.ts` | `enqueueLifecycle`, `isSafeSkillName`, `synthesizeLifecycleRefusalReport`, `listLifecycleCommands`, `validateLifecyclePreflight` | VERIFIED | All present and exported; `convex/forge.test.ts` green (239 passed / 21 todo pre-existing baseline) |
| `C:/Users/mandr/forge/src/process/lifecycle-exec.ts` | Native-TS lifecycle executor | VERIFIED | `runLifecycle`, `resolvePath`, `workspaceRootsForProjectOrigin`, `CROSS_VOLUME_CODES` all present; `lifecycle-exec.test.ts` + `command-poller.test.ts` — 55 tests green |
| `C:/Users/mandr/forge/src/emit/command-poller.ts` | `executeLifecycle` branch + mutex | VERIFIED | Confirmed present, dispatches via parallel branch, per-skillName mutex |
| `C:/Users/mandr/forge/src/index.ts` | `lifecycleFn` wiring, fresh workspace getter | VERIFIED | `lifecycleFn` bound and wired unconditionally; `workspaces` getter reads `listWorkspaces(db)` live |
| `src/components/ui/dropdown-menu.tsx` | shadcn primitive, radix-ui import | VERIFIED | Present, imports from `radix-ui` meta-package |
| `src/hooks/useLifecycle.ts` | Lifecycle command row hook | VERIFIED | Exports `useLifecycleCommands`, `LifecycleCommandRow`, `latestLifecycleForSkill`, `lifecycleRefusalMessage` (CR-03 addition); 13+ tests green |
| `src/components/skills/MoveToProjectDialog.tsx` | Workspace-picker move dialog | VERIFIED | Reuses `IntakeModal`'s workspace Select, no class filter, catches+toasts on refusal (CR-03) |
| `src/components/skills/DeleteSkillDialog.tsx` | Type-to-confirm delete AlertDialog | VERIFIED | Case-sensitive trimmed match gate, no pre-fill, catches+toasts on refusal (CR-03) |
| `src/components/skills/SkillLifecycleMenu.tsx` | Scope-gated ⋯ menu | VERIFIED | 328 lines; dormant/active/multi-scope branches, local `TooltipProvider` (CR-02), failed-badge tooltip (WR-02), `lane` prop (WR-04); 19+ tests green |
| `src/components/skills/SkillRow.tsx` | Always-visible ⋯ trigger | VERIFIED | Renders `SkillLifecycleMenu` outside hover-only cluster with min touch target |
| `src/components/skills/ColdStorageView.tsx` | Updated copy, lane-aware menu | VERIFIED | `/manage-skills` copy removed, `lane="cold"` passed, `hasDormantCopy` filter (WR-04) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `convex/forge.ts enqueueLifecycle` | `skills` table `by_name` | pre-flight registry query | WIRED | `withIndex("by_name"` present in handler |
| `convex/forge.ts ackCommand` | `synthesizeLifecycleRefusalReport` | `commandType === 'lifecycle'` dispatch | WIRED | Confirmed dispatch branch, intake branch byte-unchanged |
| `command-poller.ts executeLifecycle` | `rescanAndSync` | fire-and-forget on `status==='done'` | WIRED | Confirmed in `command-poller.ts:463-` region |
| `lifecycle-exec.ts move path` | `getWorkspace`/`listWorkspaces` | project-scope path resolution | WIRED | `resolvePath` + `workspaceRootsForProjectOrigin` (CR-01) both present |
| `src/hooks/useLifecycle.ts` | `api.forge.listLifecycleCommands` | `useQuery` | WIRED | Confirmed |
| `SkillLifecycleMenu.tsx` | `isShadowing` | disabled Restore item + tooltip | WIRED | Confirmed, plus local `TooltipProvider` (CR-02 fix) so it doesn't crash |
| `SkillLifecycleMenu.tsx` | `api.forge.enqueueLifecycle` | `useMutation` on menu action / dialog confirm | WIRED | Confirmed, now with `.catch()` toast (CR-03) |

### Behavioral Spot-Checks / Test Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Forge lifecycle-exec + poller unit tests | `cd C:/Users/mandr/forge && npx vitest run src/process/lifecycle-exec.test.ts src/emit/command-poller.test.ts` | 55/55 passed | PASS |
| Forge full suite (regression check) | `cd C:/Users/mandr/forge && npx vitest run` | 991/991 passed, 61 files | PASS |
| Forge typecheck | `cd C:/Users/mandr/forge && npx tsc --noEmit` | Clean (no output) | PASS |
| CodePulse phase-scoped unit tests | `npx vitest run convex/forge.test.ts src/hooks/useLifecycle.test.ts src/components/skills/MoveToProjectDialog.test.tsx src/components/skills/DeleteSkillDialog.test.tsx src/components/skills/SkillLifecycleMenu.test.tsx src/components/skills/SkillRow.test.tsx src/components/skills/ColdStorageView.test.tsx` | 239/239 passed, 21 todo | PASS |
| CodePulse full suite (regression check) | `npx vitest run` | 2324/2324 passed, 204 files, 193 todo | PASS |
| CodePulse typecheck | `npx tsc --noEmit` | Clean (no output) | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes declared for this phase (not a migration/CLI-tooling phase in that sense); test-suite runs above serve as the equivalent evidence.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIFE-01 | 98-01, 98-02, 98-04 | Archive active skill to cold storage | SATISFIED (code) / Pending (REQUIREMENTS.md) | Code-complete and unit-tested end-to-end; traceability table intentionally left "Pending" per this repo's own precedent (Phase 97 INTAKE-01..04) awaiting live manual UAT |
| LIFE-02 | 98-01, 98-02, 98-04 | Restore dormant skill to active | SATISFIED (code) / Pending | Same as above |
| LIFE-03 | 98-01, 98-02, 98-03, 98-04 | Move skill between global/project | SATISFIED (code) / Pending | Same as above; CR-01 fix specifically closes the project-source resolution gap the review found |
| LIFE-04 | 98-01, 98-02, 98-03, 98-04 | Delete defaults to archive; true delete is separate, confirmed | SATISFIED (code) / Pending | Same as above |
| LIFE-05 | 98-01, 98-02, 98-04 | Respect `isShadowing` — no silent conflicting activation | SATISFIED (code) / Pending | Same as above; WR-04 made the shadow-blocked branch reachable against real data (was previously dead code) |
| LIFE-06 | 98-01, 98-03 | Graceful degrade when daemon offline, no false-success | SATISFIED (code) / Pending | Reuses Phase 97's proven TTL/expiry model verbatim |
| DAEMON-02 | 98-02 | Daemon executes lifecycle commands atomically, archive-first for delete | SATISFIED (code) / Pending | `lifecycle-exec.ts` + `command-poller.ts`; WR-03 fix closes the "nothing changed on disk" atomicity gap on cross-volume mid-copy failure |

All 7 requirement IDs declared across the 4 plans (LIFE-01..06, DAEMON-02) are accounted for and match REQUIREMENTS.md's Phase 98 mapping exactly — no orphaned requirements. `REQUIREMENTS.md` currently shows all 7 as "Pending"; this is a deliberate executor decision (documented identically across all four SUMMARY.md files) to defer traceability sign-off to the phase's own manual UAT gate, matching the established Phase 97 precedent for this repo. This verification treats that as a `human_needed` gate, not a code gap.

### Anti-Patterns Found

None. Grepped all phase-modified files in both repos for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" — zero debt markers found (two incidental matches were legitimate HTML `placeholder=` attributes, not code stubs).

One **Info-tier** finding from 98-REVIEW.md was deliberately left unfixed (in scope: critical + warning only):
- **IN-01**: No action↔destination coherence validation on `enqueueLifecycle` (e.g., `action:"archive"` paired with `destination:"global"` would pass validators). Public Clerk-authed mutation surface; only the UI enforces correct pairing today. Not a blocker for this phase's must-haves (the UI never sends an incoherent pair), but worth a follow-up hardening pass.
- **IN-02**: `commandId` comment says "ULID", code sends UUIDv4 — cosmetic only.

### Human Verification Required

The phase's own plans (98-02, 98-04) and 98-VALIDATION.md's "Manual-Only Verifications" table explicitly gate final requirement sign-off on a live UAT pass against a real Forge daemon and a real G:\ project workspace. All 4 SUMMARY.md files and REQUIREMENTS.md agree LIFE-01..06/DAEMON-02 stay "Pending" until this UAT is done — this is not an oversight, it's the documented phase-completion gate. See frontmatter `human_verification` for the itemized list (real cross-volume move, live archive/restore/delete round-trip, offline-daemon expiry timing, live menu scope-gating/tooltip render, and live toast-on-refusal behavior).

### Gaps Summary

No code-level gaps. All must-have truths, artifacts, and key links are present, substantive, and test-verified in both repos (codepulse + forge), including confirmation that all 7 code-review fix commits (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04-partial) actually landed in the current HEAD of both repos — not just claimed in 98-REVIEW.md's frontmatter. Full regression suites are green in both repos (2324/2324 codepulse, 991/991 forge) and both typecheck cleanly. The only remaining item is the phase's own documented manual UAT gate (live daemon + live cross-volume Drive mount), which cannot be verified from static code inspection and is explicitly deferred by the executors themselves, matching Phase 97's precedent. `status: human_needed` reflects that gate, not a code deficiency.

One acknowledged, explicitly-not-fixed design gap remains from 98-REVIEW.md's WR-04 (fixed-partial): deleting the dormant copy of a shadowed skill is still refused by both LAYER-1 and LAYER-2 D-05 cold-only checks, so the archive-collision error's own "delete it first" remediation still dead-ends (now visibly via a toast, not silently). The review correctly scoped this as "a destructive-path design decision that needs sign-off, not a review fix" — it does not block any of the phase's ROADMAP success criteria and is not treated as a gap here, but should be flagged to Larry for an explicit decision before Phase 100 builds further UX on top of this menu.

---

_Verified: 2026-07-21_
_Verifier: Claude (gsd-verifier)_
