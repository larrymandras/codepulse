# Phase 99: Skill Launch / Dispatch - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the Run affordance into **real execution** across three targets, replacing today's dead ends:
- Today QuickDeck tiles **copy `/skillname` to the clipboard**, and "Open in Chat" navigates to `/chat?skill=X` which only **prefills the composer** — the user still has to notice it and hit send.
- Phase 99 makes Run actually execute: **auto-sent to Chat** (`chat.send`), **launched as a Forge agent run** (`enqueueLaunch` + `ForgeLaunchModal`), or **dispatched to Ástríðr under a chosen persona**. Every real launch records `useCount`/`lastUsedAt` (existing `recordSkillLaunch`).

**In scope:** LAUNCH-01..04. Codepulse-only for v1 (see D-09) — UI + target chooser + the three launch paths against existing channels.
**Not in scope (later phases):** the per-row ⋯ menu polish, drag-across-lanes, and optimistic reconcile (Phase 100, UX-01..04); a new Ástríðr per-turn persona-override endpoint if one doesn't already exist (deferred to a paired astridr phase — D-09); Mission Control jobs board (astridr SEED-023, separate surface); bulk multi-select launch; passing arguments through the Forge modal beyond editing the prefilled prompt.

</domain>

<decisions>
## Implementation Decisions

### Run Surface & Target Picker (LAUNCH-04)
- **D-01:** **Single "Run" → target chooser.** One Run action opens a small chooser listing **Chat / Forge agent / Ástríðr**, and it **remembers the last pick** so repeat runs are one extra click. Rejected: split button (a per-target default felt premature), three flat ⋯-menu items (more vertical space, harder to grow as targets are added). Rationale: cleanest and scales as targets grow.
- **D-02:** **Run lives on the ⋯ `SkillLifecycleMenu` (SkillRow + ColdStorageView) AND on the QuickDeck tiles** — the high-traffic launch pad. The `SkillCommandPalette` is left as-is (keeps its copy / open-in-chat behavior). Rejected: ⋯-menu-only (misses the QuickDeck fast path) and everywhere-incl-palette (more surfaces to keep consistent for little gain).
- **D-03:** **QuickDeck copy-to-clipboard is kept as a secondary action** (a small copy icon); the **primary tile click becomes Run**. Preserves the muscle-memory copy-for-paste path while making real launch the default gesture.

### Chat Auto-Send & Skill Arguments (LAUNCH-01)
- **D-04:** **Quick arg step, then real send.** Choosing the Chat target opens a **tiny input prefilled with `/skill `** (cursor after it); the user types arguments or just presses Enter, and it fires an actual `chat.send` via `useAstridrChat.sendMessage`. Handles arg-taking skills (e.g. `/gsd-discuss-phase 99`) and no-arg skills uniformly **without relying on arg metadata**, and doubles as a fire confirm. Rejected: firing bare `/skill` instantly (arg-taking skills would fire empty) and metadata-driven auto-detect (arg schema isn't reliably available).
- **D-05:** **The arg step is a deliberate pre-send capture** (a popover from the Run chooser), NOT the chat composer — so the LAUNCH-01 requirement ("not merely prefilled in the composer") is honored: the result is always an executed `chat.send`, never a composer left waiting for the user to submit.
- **D-06:** **Navigate to Chat and send there** so the user watches the turn stream live (mirrors today's `navigate('/chat?skill=…')` flow, but auto-sending instead of prefilling). Rejected: background send from the Skills page (you don't see the stream) and a side-drawer/split chat (new layout surface to build).

### Ástríðr / Persona Dispatch (LAUNCH-03)
- **D-07:** **The Ástríðr target = persona-scoped chat.** Same live chat stream as the Chat target, but the user **picks which profile answers this run** (personal / business / consulting — sourced from `profileConfigs`), overriding the currently-active profile just for this invocation. This is what distinguishes it from the plain "Chat" target (D-04), which uses whatever profile is active.
- **D-08:** **Persona list source = `profileConfigs`** (the same personal/business/consulting profiles surfaced elsewhere in CodePulse). No new persona concept is invented for this phase.
- **D-09:** **Codepulse-only v1 — stub what needs a new Ástríðr endpoint.** Ship Chat (LAUNCH-01) and Forge (LAUNCH-02) fully in codepulse this phase. For Ástríðr/persona, wire the UI + persona picker and use **whatever the existing channel already supports**; a true per-turn persona override that requires a NEW astridr endpoint becomes a **paired astridr phase / deferred item**, keeping Phase 99 shippable solo. **The researcher must probe first** (see D-14) — `chat.send` may already accept a persona/profile param, or an existing profile-switch mechanism may let one turn be persona-scoped without any astridr change.

### Forge Agent-Run Mapping (LAUNCH-02)
- **D-10:** **The Forge instruction is `/skill` + args verbatim** in the `enqueueLaunch` `prompt` — the agent's harness resolves the skill. Native for the Forge **`claude` agent** (it is Claude Code and resolves slash-skills). `codex`/`agy` slash-resolution is confirmed by research (D-14); the decision to inject `/skill` verbatim stands regardless. Rejected: a natural-language "Use the {skill} skill to…" wrapper (a paraphrase, not a literal invocation) as the default.
- **D-11:** **Open the full `ForgeLaunchModal` with the instruction prefilled** (editable — this is also where Forge-run arguments are entered); the user picks agent / workspace / mode / host / model as usual. Reuses the Phase 80 modal wholesale, preserves full per-run control. The separate Chat arg step (D-04) does NOT apply to the Forge path — the modal's prompt textarea serves that role.

### Usage Recording (LAUNCH-04)
- **D-12:** **Every real launch calls the existing `recordSkillLaunch`** (`convex/registry.ts:678`, bumps `useCount` + `lastUsedAt`) — for the Chat send, the Forge enqueue, and the Ástríðr dispatch alike.
- **D-13:** **Clipboard copy stops counting as a "launch."** Now that Run really executes, `recordSkillLaunch` should fire on actual execution only, so `useCount` reflects real runs rather than copies. (Discretion item — Larry approved the recommended reading; keep this consistent across QuickDeck copy and palette copy.)

### Claude's Discretion
- **D-14 (research directive):** Before locking the Ástríðr and Forge mappings, the phase researcher probes: (a) whether astridr's `chat.send` already accepts a persona/profile-routing param, or whether an existing profile-switch (`profileSwitches`) can scope one turn without a new endpoint (bounds D-09 scope); (b) which Forge agents (`claude`/`codex`/`agy`) resolve `/skill` slash-commands (confirms D-10's caveat handling for non-claude agents — a natural-language wrapper is the fallback only for agents that don't resolve slash-skills).
- Exact chooser component (shadcn DropdownMenu vs Popover), how "last pick" is persisted (localStorage vs Convex), and the visual form of the QuickDeck copy-vs-run affordance split (D-03) — planner/executor's call.
- Per-target error / offline handling copy (Chat send failure, Forge daemon offline queued-expiry already handled by the `enqueueLaunch` path, Ástríðr unreachable) — follow existing honest-state conventions; not separately specified here.
- Whether the persona picker (D-07) appears as a second step after choosing the Ástríðr target, or the chooser expands inline — Claude's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/ROADMAP.md` §"### Phase 99: Skill Launch / Dispatch" — goal, 4 success criteria, cross-repo note (astridr Mission Control pairing, SEED-023) — line ~551
- `.planning/REQUIREMENTS.md` — LAUNCH-01..04 and traceability table (line ~29)

### CodePulse surfaces to extend (don't rebuild)
- `convex/registry.ts` (line ~678) — `recordSkillLaunch` mutation (bumps `useCount`/`lastUsedAt`); already called today on copy + open-in-chat (D-12/D-13 change when it fires)
- `convex/forge.ts` (line ~928) — `enqueueLaunch` mutation (agent/workspaceId/mode/prompt/model/capabilities/host; Clerk fail-closed auth) — the Forge launch path (LAUNCH-02)
- `src/components/forge/ForgeLaunchModal.tsx` — the Phase 80 launch modal to reuse, prompt-prefilled (D-11); documents its trim list vs the forge/web source and its non-optimistic-write pattern
- `src/hooks/useAstridrChat.ts` — `sendMessage` → `chat.send` (the real auto-send channel for LAUNCH-01/03); note it currently has **no per-message persona/profile field** (bears on D-07/D-09)
- `src/pages/Chat.tsx` — consumes today's `?skill=` prefill via `draft`/`setDraft` (line ~252); the passive-prefill dead-end D-05 replaces
- `src/pages/Skills.tsx` — `handleOpenInChat` (line ~138, `navigate('/chat?skill=…')` + `recordLaunch`) and `handleRecordUse` (line ~132); the wiring point for the new chooser/launch handlers
- `src/components/skills/SkillLifecycleMenu.tsx` — the Phase 98 ⋯ menu that gains the Run item (D-02)
- `src/components/skills/QuickDeck.tsx` — the launch-pad tiles; copy→run primary + copy-secondary (D-03)
- `src/components/skills/SkillCommandPalette.tsx` — left as-is (copy / open-in-chat); do NOT add Run here (D-02)
- `convex/profiles.ts` + `profileConfigs` (schema) — persona source for D-07/D-08

### Prior phase context (decisions carried forward)
- `.planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-CONTEXT.md` — D-07 (build the ⋯ menu simply, Phase 100 upgrades in place), `useIntake` optimistic-row/status conventions, workspace-picker pattern; Phase 98 shipped `SkillLifecycleMenu`
- `.planning/phases/97-skill-lifecycle-management/97-CONTEXT.md` — Forge command-bridge precedent (one daemon/poller, Clerk fail-closed enqueue), synced-workspaces-only rule (relevant to the Forge workspace picker)

### Cross-repo (probe before scoping — D-14)
- `C:\Users\mandr\astridr-repo` — astridr's `chat.send` handler + profile/persona routing and `profileSwitches` semantics: does a per-turn persona override already exist, or is a new endpoint required? (bounds D-09). Any new astridr endpoint work is a paired/deferred astridr phase, NOT part of codepulse-only v1.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`recordSkillLaunch` (convex/registry.ts)**: usage-recording mutation already exists — every launch path calls it (D-12); no new mutation needed for LAUNCH-04's recording half.
- **`enqueueLaunch` + `ForgeLaunchModal` (Phase 80)**: the entire Forge launch path — command queue, agent/workspace/mode/host picker, Clerk fail-closed auth, non-optimistic pending-row pattern — is reused wholesale (D-10/D-11); Phase 99 just prefills the prompt and opens it from a skill.
- **`useAstridrChat.sendMessage` → `chat.send`**: the real auto-send channel for LAUNCH-01 (and LAUNCH-03's persona-scoped variant); Chat already streams the turn.
- **`SkillLifecycleMenu` (Phase 98)**: the ⋯ menu is the natural home for the Run item (D-02) — extend it, don't build a new menu.
- **`profileConfigs` / `convex/profiles.ts`**: the persona list for D-07/D-08.

### Established Patterns
- **Surface-Substrate bridge**: browser/Convex never touches the host; Forge launches flow through the `forgeCommands` queue and the daemon executes locally. Chat/Ástríðr flow through `chat.send`.
- **Honest state, no false success** (97/98 house rule): applies to per-target launch feedback — a failed send / offline daemon must surface honestly, never a fake "launched."
- **Fail-closed write auth (D-13, Phase 80)**: `enqueueLaunch` throws without a Clerk identity — the Forge path already enforces this; don't regress it.

### Integration Points
- Run chooser (⋯ menu + QuickDeck) → target branch:
  - **Chat**: arg-step popover → `sendMessage('/skill …')` → navigate to `/chat` → stream (D-04/D-05/D-06)
  - **Forge**: `ForgeLaunchModal` prefilled with `/skill …` → `enqueueLaunch` (D-10/D-11)
  - **Ástríðr**: persona picker (from `profileConfigs`) → persona-scoped `chat.send` per D-07 / D-09
  - all three → `recordSkillLaunch` on execution (D-12)

### Known Landmines
- **`chat.send` has no per-message persona field today** — the crux of D-09; do NOT assume a persona override exists. Probe astridr first (D-14); if absent, the persona picker ships against whatever the existing channel supports and the real override is deferred.
- **Slash-skill resolution is agent-dependent** — the Forge `claude` agent resolves `/skill`; `codex`/`agy` may not (D-10/D-14). Don't ship a codex launch that silently ignores the slash command.
- **`?skill=` prefill is a passive dead-end** — the whole point of the phase is to replace it (D-05); don't just re-point it.

</code_context>

<specifics>
## Specific Ideas

- Larry wants **one Run button with a target chooser that remembers the last pick** — not a proliferation of per-target buttons (D-01).
- **Keep the clipboard-copy path** on QuickDeck (as a secondary icon) — the copy-for-paste-into-terminal gesture is still wanted even after real Run exists (D-03).
- The Chat arg step must produce a **real send, never a prefilled-and-waiting composer** — the old behavior is exactly what LAUNCH-01 rejects (D-05).
- Keep Phase 99 **shippable solo** (codepulse-only) — don't let the Ástríðr persona override drag in an astridr endpoint build; defer that cleanly if needed (D-09).

</specifics>

<deferred>
## Deferred Ideas

- **New Ástríðr per-turn persona-override endpoint** (if research shows none exists) — paired astridr phase, not codepulse-only v1 (D-09).
- **Headless dispatch to Ástríðr's autonomous runtime** (skill as a background job under a persona, results via telemetry) — considered as an alternative Ástríðr semantic; not chosen for v1 (D-07 chose persona-scoped chat). Aligns with the Mission Control jobs board (astridr SEED-023) if revisited.
- **Split-button / per-target default launch** — rejected for D-01's single-chooser; could revisit once launch targets stabilize.
- **Run in the command palette** — deliberately excluded (D-02); could be added later.
- **Passing structured arguments through the Forge modal** (beyond editing the prefilled prompt) — out of scope; the prompt textarea is the arg surface for Forge (D-11).
- **⋯ menu polish, drag lanes, optimistic reconcile** — Phase 100 (UX-01..04).

</deferred>

---

*Phase: 99-skill-launch-dispatch*
*Context gathered: 2026-07-23*
