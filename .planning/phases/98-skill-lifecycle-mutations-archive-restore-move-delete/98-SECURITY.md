---
phase: 98
slug: skill-lifecycle-mutations-archive-restore-move-delete
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-22
---

# Phase 98 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → Convex mutation (`enqueueLifecycle`) | Client-supplied `skillName`/`sourceOrigin`/`workspaceId` cross into a control path a daemon executes as real fs ops | skill identifiers → fs paths |
| Convex ack httpAction → forgeCommands row | Daemon-supplied error strings are rewritten into operator-facing copy | error strings |
| Convex command row → daemon fs op | A claimed `lifecyclePayload` drives real `renameSync`/`rmSync` on the host filesystem | command payload → destructive fs ops |
| skill directory contents → move engine | A skill dir may contain a symlink/junction reparse point escaping the intended tree | directory tree contents |
| ambiguous row scope → mutation targeting | A skill active in multiple scopes could be mutated on the wrong instance if the menu guesses | origin selection |
| client shadow detection → daemon | The disabled-Restore guard is the client half of the two-layer shadow check (D-04) | shadow state |
| daemon snapshot → registry prune | The `scannedOrigins` manifest authorizes deletion of registry rows; a wrong/over-broad manifest could wipe live skills | rescan manifest → row deletion |
| unmounted workspace drive → scan | A transient G: Google Drive unmount must not be read as "workspace emptied" | workspace reachability |
| operator input → destructive enqueue | The type-to-confirm gate is the last client-side guard before a permanent-delete command is issued | operator confirmation |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-98-01a | Tampering | Convex `enqueueLifecycle` skillName | mitigate | `convex/forge.ts:726-732` — `isSafeSkillName` rejects empty string, `/`, `\`, `".."`, and `/^[A-Za-z]:/` drive-letter prefix; called at `convex/forge.ts:1106` before any row insert | closed |
| T-98-01b | Tampering | daemon lifecycle-exec path resolution | mitigate | `forge/src/process/lifecycle-exec.ts:114-120` local `isSafeSkillName` (checked line 300) + `resolveRoot`/`resolvePath` (172-192) build paths only from fixed root constants and `getWorkspace(deps.db, workspaceId)` — never a client absolute path | closed |
| T-98-02a | Elevation/Tampering | Convex delete cold-only rule | mitigate | `convex/forge.ts:665-672` — delete refuses unless `sourceOrigin === DORMANT_ORIGIN`. Narrowed from the plan's "refuses when any non-dormant origin row exists" to target-scoped cold-only per 98-REVIEW WR-04 (Larry sign-off 2026-07-21); the protected property (delete can never touch an active copy) still holds | closed |
| T-98-02b | Elevation/Tampering | daemon delete cold-only re-check | mitigate | `forge/src/process/lifecycle-exec.ts:316-341` — `rmSync` structurally reachable only via `coldRoot = resolveRoot(deps,'cold',null)` + live `fs.existsSync(coldPath)`; same WR-04 target-scoped narrowing, approved | closed |
| T-98-03 | Tampering | concurrent same-name commands | mitigate | `forge/src/emit/command-poller.ts:197,418-450` — `lifecycleInFlight: Set<string>` + per-name FIFO queue serializes same-name commands; `lifecycle-exec.ts:399-404` maps vanished source to `lifecycle-refused:source-missing:` instead of a crash | closed |
| T-98-04 | Tampering/Info Disclosure | reparse point inside skill dir | mitigate | `forge/src/process/lifecycle-exec.ts:406-415` — `reparseScanner(srcPath)` (defaults to lstatSync-based `defaultReparseScanner`) refuses with `lifecycle-refused:reparse:` before `moveTree` | closed |
| T-98-05 | Spoofing/Elevation | `enqueueLifecycle` auth | mitigate | `convex/forge.ts:1091-1094` — Clerk fail-closed `ctx.auth.getUserIdentity()` null-throw before any DB access (D-13); dialogs and menu call `enqueueLifecycle` directly with no alternate path | closed |
| T-98-06 | Tampering | client-supplied sourceOrigin | mitigate | `convex/forge.ts:641-645` — `validateLifecyclePreflight` throws unless `originsForName.includes(args.sourceOrigin)`, using the live `skills` `by_name` query result | closed |
| T-98-07 | Tampering | DeleteSkillDialog confirm gate | mitigate | `src/components/skills/DeleteSkillDialog.tsx:57-73` — `canDelete = confirmText.trim() === skillName && !submitting`; no pre-fill, no autofocus-select (D-06) | closed |
| T-98-08 | Tampering | multi-scope row menu | mitigate | `src/components/skills/SkillLifecycleMenu.tsx:130-134,260-282` — `nonDormantOrigins.length > 1` disables Archive/Move; `activeOrigin` only set when exactly one non-dormant origin exists, never `origins[0]` | closed |
| T-98-09 | Tampering | shadow-bypass Restore | mitigate | `SkillLifecycleMenu.tsx:129,162-167,225-249` — `isShadowing(skill)` disables Restore with tooltip; `handleRestore` early-returns `if (shadowed) return;` as defense-in-depth; daemon LAYER-2 (98-02) backstops | closed |
| T-98-10 | Tampering (data loss) | over-eager prune on unmount | mitigate | `forge/src/emit/skill-rescan.ts:243,264-273,285-289` — `isReachable()` (fs.statSync, catches all errors) gates every `scannedOrigins.push`, including project and home-root (GC-02) declarations; unreachable root never declared → rows never pruned | closed |
| T-98-11 | Tampering (registry wipe) | empty-snapshot prune guard | mitigate | `convex/skillSync.ts:57-86` — `prunableOrigins` defaults to incoming-only, union'd with `scannedOrigins` only when provided; `convex/registry.ts:182-187,350-355` gate pruning on `skills.length > 0 || scannedOrigins.length > 0`, via `sanitizeScannedOrigins` (GC-03) guarding malformed `v.any()` bodies | closed |
| T-98-SC3 | Tampering (supply chain) | dropdown-menu install | mitigate | `src/components/ui/dropdown-menu.tsx:3` imports the first-party `radix-ui` meta-package; `package.json:45` shows only `"radix-ui": "^1.4.3"` — no new per-primitive dependency | closed |
| T-98-12 | Repudiation | pruned-row audit | accept | Pruned-row `configChanges` audit-log write preserved verbatim (`convex/registry.ts:189-194`) — deletions remain traceable | closed |
| T-98-SC (98-01/02/04/05) | Tampering | package installs | accept | No npm/pip installs in plans 98-01, 98-02, 98-04, 98-05; dropdown-menu (98-03) covered by T-98-SC3 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-98-01 | T-98-12 | Existing `configChanges` audit-log write per pruned row is preserved verbatim; deletions remain traceable. No new control needed | plan 98-05 (Larry) | 2026-07-21 |
| AR-98-02 | T-98-SC (98-01/02/04/05) | No package installs occurred in these plans; nothing to audit. 98-03's dropdown-menu verified separately as T-98-SC3 | plans 98-01..05 (Larry) | 2026-07-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-22 | 16 | 16 | 0 | gsd-security-auditor (sonnet) + orchestrator spot-check |

---

## Auditor Notes

- **T-98-02 wording drift (approved deviation, not a gap):** the plan-time mitigation read "refuse delete whenever any non-dormant origin exists"; the shipped rule is narrower — target-scoped cold-only (`sourceOrigin === DORMANT_ORIGIN`). Changed deliberately per 98-REVIEW WR-04 (Larry sign-off 2026-07-21) to unwedge archive-collision remediation. The STRIDE property the threat protects (an active/non-cold skill can never be deleted) remains fully closed on both layers: `rmSync` is structurally reachable only under the cold root in `convex/forge.ts:665-672` (pre-flight) and `forge/src/process/lifecycle-exec.ts:316-341` (host re-check). Orchestrator independently re-read both cited ranges and confirmed the mechanism.
- 98-05's implementation carries GC-01/GC-02/GC-03 refinements (readOk gating, `~/.claude` home-root reachability, `sanitizeScannedOrigins` malformed-input guard) beyond the original plan text — all strengthen T-98-10/T-98-11.
- Manual/live UAT items (real archive, real cross-volume move, real G: unmount negative test) remain outstanding phase-gate verification per 98-02/98-04/98-05 SUMMARYs — separate from this code-level audit; tracked in 98-HUMAN-UAT.md.
- No unregistered threat flags: no `## Threat Flags` section exists in any 98-0N-SUMMARY.md.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-22
