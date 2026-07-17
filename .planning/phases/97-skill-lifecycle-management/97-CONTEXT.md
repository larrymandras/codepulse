# Phase 97: Real Skill Intake & Daemon Foundation - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the existing **dry-run** skill-install pipeline into a **real** one. Today the CodePulse surface is fully built — `IntakeModal` (upload + GitHub URL + destination + optimistic rows), `enqueueIntake` (Clerk-gated, GitHub URL parse + path-traversal guards ported from `skill-intake`), `supportedTypes`/`resolveClaimTypes` advertising, `capAckReport`, and `registry.syncInventory` — but it reports "Validation only — nothing is written" because **the Forge daemon does not execute `intake`** (only launch/stop/logs/files).

This phase makes intake real: the Forge daemon executes `intake` commands (upload / GitHub URL → SKILL.md written to the chosen scope on the host), rescans the registry so the skill appears automatically, surfaces its real execution/validation report, and advertises that it supports `intake` so an older daemon build is never handed a command type it cannot run.

**In scope:** INTAKE-01..04, DAEMON-01, DAEMON-03, DAEMON-04.
**Not in scope (later phases):** lifecycle mutations archive/restore/move/delete + DAEMON-02 (Phase 98), launch/dispatch (Phase 99), control-surface ⋯/drag UX (Phase 100). Also deferred: skill versioning/overwrite-update, private-repo auth, bulk multi-select, in-app SKILL.md body editing.

</domain>

<decisions>
## Implementation Decisions

### Daemon Home & Write Engine
- **D-01:** The intake executor lives in the **existing Forge daemon** (`C:\Users\mandr\forge`, host `lmofficenew`). Add an `intake` branch to the existing `CommandPoller` that already claims/acks `forgeCommands` and reflects status back for launch/stop/logs/files. One daemon, one poller, one auth path — `intake` is just a new `commandType`. **Rejected:** a second poller in astridr-repo (splits command transport across two daemons).
- **D-02:** The daemon **shells out to the existing `skill-intake` Python package / `manage-skills` CLI** to perform the validated write — it does NOT reimplement validate+write natively in TS. `skill-intake` is the canonical installer (its `github_url.py` parser was already ported into `enqueueIntake`); reusing it keeps a single source of truth for install semantics and avoids validation drift. The daemon captures the tool's **real report + exit code** and surfaces it back through the `forgeCommands` ack/report (satisfies INTAKE-04). Implication: the daemon host must have Python + `skill-intake` available.

### Registry Rescan (INTAKE-03 / DAEMON-03)
- **D-03:** After each successful write the daemon runs a **full host skill rescan and posts the whole inventory snapshot to `registry.syncInventory`** (upsert by name+origin + per-origin prune). Chosen over a targeted single-skill upsert because it guarantees host-truth (origin/scope correct, no drift) and per-origin pruning correctly reconciles a GitHub subpath fan-out that installed several skills. Intake is low-frequency, so the heavier rescan cost is acceptable.

### Project-Scope Path Resolution
- **D-04:** For a `"project"` destination, the target path is resolved from **synced Forge workspaces only** — today's UI reveals a workspace picker; the daemon maps `workspaceId` → the workspace's known absolute path and writes to `<workspace>/.claude/skills/<name>/`. No free-text host paths (no new path-traversal surface; the daemon already enumerates these paths for the emitter). If no workspace is synced, "project" is effectively unavailable and the UI already says so.

### GitHub Install Scope & Auth (INTAKE-02)
- **D-05:** **Public GitHub repos only** this phase — no token handling. Private-repo auth (token storage / daemon secret handling) is deferred to a future phase. The URL-shape + path-traversal guards already in `enqueueIntake` still apply. (The fetch mechanism itself — clone vs raw download — is `skill-intake`'s internal concern per D-02, not a decision here.)
- **D-06:** When one URL + `subpath` resolves to **multiple** skills (fan-out), the flow is **resolve → confirm the set → install**: the candidate skills are enumerated and the user confirms before anything is written. Prevents a surprise bulk-install from a broad subpath and pairs cleanly with the no-partial-state guarantee. ⚠ **Research must confirm** `skill-intake` exposes a resolve/enumerate step separate from write (a dry-resolve mode); if it writes atomically per invocation, the confirm-first UX needs either that mode or client-side enumeration.

### Name Collision (behavior gap not covered by the 4 areas)
- **D-07:** Phase 97 is **first-install only** — a same-name collision at the destination scope is a **clean failed install with an actionable error** (INTAKE-04), **never a silent overwrite**. Overwrite/update stays deferred (Future Requirements); `isShadowing`-aware activation is Phase 98.

### Claude's Discretion
- Failure atomicity mechanics (temp-write-then-move vs in-place + cleanup) and the "no partial directory on disk" guarantee — delegate to `skill-intake`'s own semantics where possible; research should confirm.
- Cold-storage destination path convention (`.claude/skills-available/` / dormant origin) — follow the existing `manage-skills`/registry convention; not a user decision.
- Exact `commandType`/payload shape for the daemon `intake` branch and how `supportedTypes` is extended to advertise `intake` (DAEMON-04) — follow the launch/stop precedent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/ROADMAP.md` §"### Phase 97: Real Skill Intake & Daemon Foundation" — goal + 5 success criteria + dependency notes
- `.planning/REQUIREMENTS.md` — INTAKE-01..04, DAEMON-01/03/04 (+ traceability table); note deferred/out-of-scope lists (versioning, private-repo, bulk, body-editing)

### CodePulse intake surface (already built — extend, don't rebuild)
- `convex/forge.ts` — `enqueueIntake` mutation, `buildIntakeRow`/`IntakeRowArgs` (`destination` + `workspaceId` + `storageId`/`githubUrl`/`subpath`), ported `GITHUB_FULL_URL`/`GITHUB_SHORTHAND` parser (§ line ~249), `resolveClaimTypes` (§ line ~650, defaults old daemons to `["launch","stop"]`), `capAckReport` (report size cap)
- `convex/forgeCommands.ts` — `forgeCommandsClaim` / `forgeCommandsAck` httpActions; `supportedTypes` shape validation; intake `storageId` → download-URL handoff (§ line ~87)
- `convex/registry.ts` — `syncInventory` mutation (upsert by name+origin, per-origin prune) — the rescan target for D-03
- `convex/scan.ts` — scan/inventory surface
- `src/components/skills/IntakeModal.tsx` — host picker + Destination toggle (Global/Project/Cold) + workspace picker (revealed for "project", synced-workspaces list) + drop-zone/URL XOR; the "Validation only — nothing is written" note (§ line ~486) to be replaced
- `src/hooks/useIntake.ts` — `IntakeDestination`, `IntakeCommandRow`, `mapIntakeStatus`, optimistic-row conventions
- `src/components/skills/IntakeReportView.tsx` — renders the daemon report (extend to render the real execution/validation report)
- `src/pages/Skills.tsx`, `src/components/skills/SkillRow.tsx` — Skills page that must reflect the installed skill automatically

### Cross-repo (external repos — daemon side)
- `C:\Users\mandr\forge` — the Forge daemon (Fastify, host `lmofficenew`); `CommandPoller` (poll → claim → execute → ack) is where the `intake` branch lands; emitter/`syncInventory` post path. Deploy/env: posts to `https://tidy-whale-981.convex.site`, `FORGE_INGEST_API_KEY`; see `docs/forge-deploy-checklist.md`
- `C:\Users\mandr\skill-intake` — canonical Python installer; `src/skill_intake/ingestion/github_url.py` is the source the CodePulse URL parser was ported from; the tool the daemon shells out to for validated write (D-02)
- `C:\Users\mandr\.claude\skills\manage-skills` — the `manage-skills` CLI (candidate write path / the "run in a terminal" tool UX-04 later removes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`forgeCommands` queue + `CommandPoller`**: intake extends the exact launch/stop/logs/files transport — claim/ack, TTL/expiry, optimistic rows, Clerk fail-closed auth are all already shipped (Phases 80-82). No new transport.
- **`resolveClaimTypes` / `supportedTypes`**: the advertising mechanism for DAEMON-04 already exists — extend the daemon's advertised types to include `intake` so old daemons never claim it.
- **`skill-intake` package**: canonical validate+write + GitHub fetch; its parser is already partially in-repo. Shelling out reuses all of it.
- **`registry.syncInventory`**: the full-rescan sink already handles upsert-by-identity + per-origin prune (D-03).
- **IntakeModal workspace picker**: project-scope path resolution (D-04) is already wired to synced workspaces — minimal UI delta.

### Established Patterns
- **Surface-Substrate bridge** (v7.0): browser/Convex cannot touch the host filesystem; all host mutations flow DOWN through `forgeCommands` and the daemon executes locally. Intake follows this exactly.
- **Optimistic row → reconcile against server command row** (`useIntake` / Phase 07-02): reuse for the pending/executing/done/failed/expired states.
- **Daemon report cap** (`capAckReport`): the real report is surfaced but bounded to stay under Convex's ~1 MiB doc limit.

### Integration Points
- Daemon `CommandPoller` `intake` branch → `skill-intake` shell-out → full rescan → `registry.syncInventory`.
- `forgeCommandsClaim` already hands the daemon the uploaded-file download URL (`storageId` → `ctx.storage.getUrl`) for the upload path.
- Skills page (`useQuery(api.registry/skills.*)`) auto-updates via Convex reactivity once `syncInventory` lands — no manual refresh (INTAKE-03).

### Known landmine
- **`~/.claude/skills/` write ACLs** — Phase 82 hit a codex-sandbox ACL block on the daemon; `promoteWorkspace` fixed it with a best-effort `icacls <dest> /grant <USERNAME>:(OI)(CI)F /T`. Writing skills to the scope dir may need the same grant so the daemon (and the rescan) can read back what it wrote. See memory `forge-codex-sandbox-acl-blocks-reads`.

</code_context>

<specifics>
## Specific Ideas

- Reuse the **canonical installer** rather than reimplementing — Larry consistently prefers a single source of truth for install semantics (D-02) over a parallel TS reimplementation that can drift.
- Confirm-first for fan-out (D-06) reflects the house rule of not doing surprise bulk file operations; pairs with the "no partial state on disk" guarantee.

</specifics>

<deferred>
## Deferred Ideas

- **Private-repo GitHub auth** (token storage / daemon secret handling) — deferred out of the foundation phase (D-05); future concern.
- **Skill versioning / overwrite-update** (pull a newer SKILL.md over an installed one, diff before overwrite) — Future Requirements; Phase 97 rejects same-name collisions (D-07).
- **Lifecycle mutations** (archive/restore/move/delete) + DAEMON-02 — Phase 98.
- **Launch/dispatch** to Chat/Forge-agent/Ástríðr — Phase 99.
- **Control-surface UX** (⋯ menu, drag lanes, in-app Cold Storage restore) — Phase 100.
- **Bulk multi-select** lifecycle actions and **`importSkills` catalog bulk-import** UI — deferred per REQUIREMENTS.

None of these were scope-creep during discussion — all are already sequenced in later phases / Future Requirements.

</deferred>

---

*Phase: 97-skill-lifecycle-management*
*Context gathered: 2026-07-17*
