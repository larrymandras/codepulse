# Phase 99: Skill Launch / Dispatch - Research

**Researched:** 2026-07-23
**Domain:** Real skill execution across three existing channels (CodePulse WS chat, Forge daemon agent-run queue, Ástríðr persona-scoped chat) — no new transport, no daemon dependency.
**Confidence:** HIGH (both D-14 directives resolved with file:line evidence against live code + one official-docs fetch; one MEDIUM-confidence UI-flow finding surfaced a real drift from CONTEXT.md that changes implementation scope)

## Summary

Phase 99 wires three already-existing execution channels to the Skills page's Run affordance. The Forge path (`enqueueLaunch` + `ForgeLaunchModal`) and the plain-Chat path (`useAstridrChat.sendMessage` → WS `chat.send`) are both straightforward reuse — the launch primitives already exist and work. The persona-scoped Ástríðr path is where this phase's real research risk lived (D-14), and the investigation produced a clear, evidence-backed answer: **`chat.send` already accepts a `profile` field structurally, but it currently only scopes the inbound *security policy* (DLP/PII rules, audit `sender_id`) — it does NOT select a different persona's system prompt or "voice."** There is no code path today, reachable from CodePulse's WS `chat.send`, that makes a different persona actually *answer*. D-09's premise is confirmed correct: ship the persona picker UI and send the `profile` field (it's real, and does affect something honest — security scoping), but do not claim in copy that "Ástríðr answered as {persona}" — that would be a false-success claim per the house honesty rule. A true persona-voice override is a deferred paired-astridr-phase item, exactly as D-09 anticipated.

For D-10/Forge, the Forge daemon's three CLI adapters (`claude.ts`, `codex.ts`, `agy.ts`) all forward `job.prompt` as a single verbatim positional/`-p` argument to their respective binaries — none of them do any local slash-command preprocessing. Whether `/skill args` resolves is entirely a property of each downstream CLI. Official Claude Code docs confirm `-p`/SDK single-shot prompts DO resolve custom skills exactly like the interactive CLI (`.claude/skills/<name>/SKILL.md`, `/name` invocation, `$0`/`$1`/`$ARGUMENTS` placeholders) — HIGH confidence, official source. Codex's headless `codex exec` mode does NOT resolve slash commands (open GitHub feature request, openai/codex#3641, confirms current behavior) — MEDIUM confidence, non-official but authoritative (project's own issue tracker). `agy` (Antigravity CLI) has the same TUI-only limitation per third-party docs (LOW-MEDIUM confidence) — but this is moot for Phase 99: **`ForgeLaunchModal.tsx` already disables the `agy` option in its Agent picker** (`agy`/Antigravity, "PTY spike failed on this machine"), so the modal only ever offers `codex` or `claude` today. D-10's verbatim-inject decision is safe for `claude`; for `codex` the injected `/skill args` will be read by the model as literal text (no local resolution) — matches D-10's own caveat handling exactly, no plan change needed beyond documenting it.

One drift finding changes scope: CONTEXT.md's canonical-refs claim that `src/pages/Chat.tsx` "consumes today's `?skill=` prefill via `draft`/`setDraft` (line ~252)" is **not true of the live code** — `Chat.tsx` has zero `useSearchParams`/`useLocation`/query-string handling anywhere in the file (confirmed by full-file grep). `handleOpenInChat` in `Skills.tsx` navigates to `/chat?skill=X`, but nothing on the Chat page ever reads that param — today's "Open in Chat" is not a passive prefill, it's a **silent no-op**: the user lands on an empty composer. This means D-05/D-06 is not "flip an existing prefill mechanism to auto-send" — it requires building the navigate→auto-send handoff from scratch (there is nothing to repurpose). Practically this is simpler, not harder: no legacy prefill code to remove, but the planner should not assume a `draft`-population code path exists to hook into.

**Primary recommendation:** Ship all three targets against existing channels exactly as decided (D-01..D-13); wire the Ástríðr persona picker to send `chat.send`'s existing `profile` field (real, honest partial effect — security scoping) while keeping success copy target-agnostic (no "as {persona}" claim); build the Chat-target navigate→auto-send handoff as new code (no existing prefill to extend); and don't worry about `agy` slash-resolution — it's unreachable through the Forge modal as shipped.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run target chooser + last-pick persistence | Browser / Client | — | Pure UI state; `localStorage`, no server round-trip (matches `Reminders.tsx` precedent) |
| Chat auto-send (LAUNCH-01) | Browser / Client → API (Ástríðr WS) | — | `useAstridrChat.sendMessage` is a client hook calling the existing WS `chat.send` command; CodePulse never touches the LLM directly |
| Forge agent-run launch (LAUNCH-02) | API / Backend (Convex mutation) | Browser / Client (modal UI) | `enqueueLaunch` is a Convex mutation (Clerk-gated write); `ForgeLaunchModal` is the client surface reused wholesale |
| Forge command execution | External Service (Forge daemon, separate process/repo) | — | Out of CodePulse's tier entirely — daemon polls `forgeCommands` and spawns the CLI locally; Phase 99 never touches this |
| Ástríðr persona-scoped dispatch (LAUNCH-03) | API / Backend (Ástríðr WS command) | Browser / Client (persona picker UI) | The `profile` field crosses into Ástríðr's `SecurityContext`; CodePulse is a thin client sending an existing command shape |
| Usage recording (LAUNCH-04 half) | Database / Storage (Convex `skills` table) | — | `recordSkillLaunch` is a straight Convex mutation patch; no business logic beyond the increment |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** Single "Run" → target chooser (Chat / Forge agent / Ástríðr), remembers last pick.
- **D-02:** Run lives on `SkillLifecycleMenu` (SkillRow + ColdStorageView) AND QuickDeck tiles. `SkillCommandPalette` is left as-is (no Run item).
- **D-03:** QuickDeck copy-to-clipboard survives as a secondary icon; primary tile click becomes Run.
- **D-04:** Quick arg step (tiny input prefilled `/skill `), then real `chat.send` — handles both arg-taking and no-arg skills uniformly, without relying on arg metadata.
- **D-05:** The arg step is a deliberate pre-send capture (popover from the Run chooser), NOT the chat composer — the result is always an executed `chat.send`, never a composer left waiting.
- **D-06:** Navigate to Chat and send there (so the user watches the turn stream live) — mirrors today's `navigate('/chat?skill=…')` flow but auto-sending instead of prefilling.
- **D-07:** Ástríðr target = persona-scoped chat — same live stream as Chat target, but the user picks which profile answers, overriding the active profile for this invocation only.
- **D-08:** Persona list source = `profileConfigs` (personal/business/consulting) — no new persona concept invented.
- **D-09:** Codepulse-only v1 — stub what needs a new Ástríðr endpoint. Ship Chat + Forge fully; for Ástríðr/persona, wire UI + persona picker against whatever the existing channel supports; a true per-turn persona override requiring a NEW astridr endpoint is a paired/deferred astridr phase.
- **D-10:** Forge instruction is `/skill` + args verbatim in `enqueueLaunch`'s `prompt` — native for `claude` agent; `codex`/`agy` slash-resolution confirmed by research (this document); the verbatim-inject decision stands regardless.
- **D-11:** Open the full `ForgeLaunchModal` with the instruction prefilled (editable) — reuses the Phase 80 modal wholesale.
- **D-12:** Every real launch calls the existing `recordSkillLaunch` (`convex/registry.ts:678`).
- **D-13:** Clipboard copy stops counting as a "launch" — `recordSkillLaunch` fires on real execution only; keep consistent across QuickDeck copy and palette copy.

### Claude's Discretion

- **D-14 (research directive):** RESOLVED — see `## Ástríðr Persona Routing (D-14a)` and `## Forge Slash-Skill Resolution (D-14b)` below.
- Exact chooser component (shadcn DropdownMenu vs Popover) — **resolved by 99-UI-SPEC.md: DropdownMenu.**
- How "last pick" is persisted — **resolved by 99-UI-SPEC.md: `localStorage`, key `codepulse-skills-run-target`.**
- Visual form of the QuickDeck copy-vs-run split — **resolved by 99-UI-SPEC.md: hover-reveal icon group becomes `[Copy, Star]`.**
- Per-target error/offline handling copy — resolved by 99-UI-SPEC.md's Copywriting Contract (toast copy specified per target).
- Whether the persona picker appears as a second step or inline — **resolved by 99-UI-SPEC.md: stacked above the arg input in the same Ástríðr popover.**

### Deferred Ideas (OUT OF SCOPE)

- New Ástríðr per-turn persona-override endpoint (confirmed necessary by this research — see D-14a finding) — paired astridr phase, not codepulse-only v1.
- Headless dispatch to Ástríðr's autonomous runtime (skill as background job under a persona) — not chosen for v1; aligns with Mission Control (astridr SEED-023) if revisited.
- Split-button / per-target default launch — rejected for D-01.
- Run in the command palette — deliberately excluded (D-02).
- Passing structured arguments through the Forge modal beyond editing the prefilled prompt.
- ⋯ menu polish, drag lanes, optimistic reconcile — Phase 100 (UX-01..04).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAUNCH-01 | Run a skill in Chat — sent via `chat.send` and executes (auto-send), not merely prefilled | `useAstridrChat.sendMessage` (src/hooks/useAstridrChat.ts:81-162) is a working, tested auto-send primitive. Chat.tsx has NO existing `?skill=` handling to repurpose (drift finding) — the navigate→auto-send handoff must be built new, e.g. via `navigate('/chat', { state: { autoSend: text } })` + a `useEffect` in Chat.tsx, or a `?skill=&args=` query param read via `useSearchParams` (react-router v7 is already the router). |
| LAUNCH-02 | Launch a skill as a Forge agent run — agent/workspace/mode picker, skill as instruction, reuses `enqueueLaunch` | `ForgeLaunchModal.tsx` (full file read) takes `prompt` as local `useState`, resets to `""` on open; Phase 99 need only pass an `initialPrompt` prop (new, small change) instead of always resetting to empty. `enqueueLaunch` (convex/forge.ts:928) is Clerk-gated, unchanged. |
| LAUNCH-03 | Dispatch a skill to Ástríðr / a chosen persona | `ChatSendCommand.profile` (astridr-repo/astridr/api/ws_commands.py:63-67) is a REAL, already-wired field — safe to send. It reaches `SecurityContext.profile_id`/`sender_id` (astridr-repo/astridr/engine/bootstrap/wiring.py:259-265) but NOT persona/system-prompt selection (single shared `system_prompt`, wiring.py:329). Ship the picker; do not claim persona-driven answers in copy. |
| LAUNCH-04 | Run affordance lets user pick target at launch time; records `useCount`/`lastUsedAt` | `recordSkillLaunch` (convex/registry.ts:678-691) exists, reused as-is. Today it fires on BOTH `handleRecordUse` (copy) and `handleOpenInChat` (prefill navigate) in Skills.tsx (lines 132-139) — D-13 requires removing the copy-triggered calls; see Common Pitfalls for the palette's orphaned `handleOpenInChat` call that D-13's decision text doesn't explicitly address. |
</phase_requirements>

## Ástríðr Persona Routing (D-14a) — Full Finding

**Question:** Does astridr's `chat.send` handler already accept a persona/profile-routing parameter, OR can `profileSwitches` scope a single turn to a chosen persona without a new endpoint?

**Answer: Partially yes, but not for what D-07 needs.**

1. **`ChatSendCommand` (astridr-repo `astridr/api/ws_commands.py:63-67`) already has a `profile: str | None = None` field.** `[VERIFIED: live code read]` This is exactly the WS command CodePulse's `useAstridrChat.sendMessage` sends (`src/hooks/useAstridrChat.ts:112-119` — `sendCommand({ type: "chat.send", message: text, ... })`). Adding `profile: personaId` to that payload requires **zero schema change on either side** — it's already accepted.

2. **That field is wired through to `_handle_chat_send` (`ws_commands.py:532-639`) → `_ws_agent_launcher` (`astridr-repo/astridr/engine/bootstrap/wiring.py:192` onward), where `payload.get("profile")` feeds `SecurityContext.profile_id` and `SecurityContext.sender_id`** (`wiring.py:259-265`) — this scopes the **inbound security/DLP pipeline policy and audit trail**, not model behavior. `[VERIFIED: live code read]`

3. **The reply's system prompt is a single shared value for every WS chat.send turn** — `_ALC(system_prompt=system_prompt)` at `wiring.py:329` uses one `system_prompt` closed over at bootstrap time, not resolved per-`profile_id`. `agent_id` for the chat path is always `None` ("Skip task routing for chat — direct to default agent for speed", `ws_commands.py:608`), so there is no per-profile agent/persona selection happening anywhere in this code path. `[VERIFIED: live code read]`

4. **The actual persona-*switching* mechanism that changes who answers is `/profile use <id>`** — a slash command handled by `CommandDispatcher.handle_profile` (astridr-repo `astridr/channels/commands.py:93-170`). This is a **session-state mutation** (`apply_profile_to_session(session, agent_profile)`) that persists for all subsequent turns on that channel session — it is NOT a per-turn override, and it lives in the channel-level `MessageRouter`/`CommandDispatcher` path used by Telegram/Slack/WhatsApp/astridr's own web chat — **CodePulse's WS `chat.send` path bypasses this entirely** (`_handle_chat_send` goes straight from `ws_commands.py` to `_ws_agent_launcher`, never touching `CommandDispatcher`). `[VERIFIED: live code read]`

5. **`profileSwitches` (both the CodePulse Convex table, `convex/profiles.ts:199-224`, and its astridr source, `telemetry.py:189` mapping `"profile_switch": "system:profiles"`) is a read-only telemetry-ingest / audit-log table.** It records that astridr's own channels emitted a `profile_switch` event; CodePulse has no mutation that *causes* astridr to switch profiles — only one that records having *observed* a switch. `[VERIFIED: live code read]`

**Conclusion:** Sending `profile: <personaId>` on `chat.send` is real and harmless (it correctly scopes DLP/PII policy + audit `sender_id` to the chosen persona), but it does **not** make that persona's voice/system-prompt answer the turn. D-09's "codepulse-only v1, stub what needs a new astridr endpoint" framing is confirmed exactly correct — the true per-turn persona-voice override does not exist today and requires new astridr work (either resolving `system_prompt`/`agent_id` per `payload.get("profile")` in `_ws_agent_launcher`, or exposing a per-turn variant of `/profile use` over the WS protocol). This is the deferred paired-astridr-phase item.

**Implementation guidance for the planner:** Ship the Ástríðr popover exactly as 99-UI-SPEC.md's Interaction Contract #4 already specifies — it explicitly anticipates this outcome ("must never claim a persona override happened if it didn't — copy stays limited to 'Send' with no 'as {persona}' success confirmation unless the researcher confirms the override is real end-to-end"). This research confirms it is **not** real end-to-end. Send `profile: personaId` on the WS command (real, honest partial effect); do not add "as {persona}" success copy.

## Forge Slash-Skill Resolution (D-14b) — Full Finding

**Question:** Which Forge agents (`claude`/`codex`/`agy`) resolve `/skill` slash-commands when injected verbatim as the `enqueueLaunch` prompt?

1. **All three Forge CLI adapters forward `job.prompt` as a single verbatim string** — `claudeAdapter` pushes it after `-p` (forge/src/adapters/claude.ts:120-123), `codexAdapter` pushes it as the final positional argv element (forge/src/adapters/codex.ts:108-111), `agyAdapter` pushes it after `-p` (forge/src/adapters/agy.ts:126-128). None of the adapters parse or preprocess slash syntax themselves — resolution is entirely downstream, inside each CLI binary. `[VERIFIED: live code read]`

2. **`claude -p` / the Claude Agent SDK's single-shot `query()` DOES resolve custom skills the same as interactive mode.** `[CITED: code.claude.com/docs/en/agent-sdk/slash-commands]` — official docs confirm: "Send slash commands by including them in your prompt string, just like regular text," and custom commands defined at `.claude/skills/<name>/SKILL.md` are "automatically available through the SDK," with argument placeholders (`$0`, `$1`, `$ARGUMENTS`) resolved from the invocation text. This directly matches D-10's `/skill args` verbatim-inject design for the `claude` agent. HIGH confidence.

3. **`codex exec` (headless/non-interactive mode) does NOT resolve slash commands.** `[CITED: github.com/openai/codex/issues/3641]` — an open, unresolved feature request states plainly: "Slash commands do not work in exec mode... does not seem to parse that as a slash command (and inject my prompt), but rather just interpret the raw text." MEDIUM confidence (project's own issue tracker, not formal docs, but directly on-point and unambiguous). This confirms D-10's caveat: a codex-targeted launch sends `/skillname args` as literal text to the model, which may or may not correctly interpret intent depending on skill complexity — the natural-language wrapper fallback ("Use the {skill} skill to…") is the safer default for codex specifically, though D-10 explicitly keeps verbatim injection as the locked default regardless.

4. **`agy` (Antigravity CLI) has the same interactive-only limitation for its slash commands** — third-party docs state: "Interactive in-session slash commands... only exist inside a running agy TUI session, not on the shell wrapper." `[CITED: multiple third-party CLI cheat-sheets, cross-checked]` LOW-MEDIUM confidence (no official Google docs found; consistent across ~4 independent sources though).

5. **This is moot for Phase 99 in practice: `ForgeLaunchModal.tsx`'s Agent picker already disables `agy`** — `<SelectItem value="agy" disabled aria-disabled="true">Antigravity (disabled)</SelectItem>` with helper text "Antigravity is disabled — PTY spike failed on this machine" (`src/components/forge/ForgeLaunchModal.tsx:285-295`). `[VERIFIED: live code read]` A user launching a skill via Forge can only pick `codex` or `claude` today — the `agy` slash-resolution question, while researched, cannot actually be exercised through this phase's UI.

**Conclusion:** D-10's verbatim `/skill args` injection is correct and requires no plan change. For `claude` it resolves natively (skill executes as intended). For `codex` it will NOT resolve — the model receives literal text starting with `/skillname`, which it will most likely just treat as conversational text (possibly confused by the leading slash). No code change is needed to "fix" this per D-10 (the decision explicitly keeps verbatim injection as the default for all agents), but the planner should ensure the UI-SPEC's existing copy ("Launch as Forge Agent") doesn't imply skill-name resolution is guaranteed for every agent choice — this is cosmetic/documentation only, not a build blocker.

## Standard Stack

No new libraries. Every primitive this phase needs is already installed and already used elsewhere in the codebase:

| Component | Existing Use | Reuse For |
|-----------|--------------|-----------|
| `DropdownMenu` (Radix via shadcn) | `SkillLifecycleMenu.tsx` ⋯ menu | Run target chooser (D-01, UI-SPEC §2) |
| `Popover` (Radix via shadcn) | `KGViewsPopover.tsx` (`w-72 p-4`) | Chat/Ástríðr arg-input step (D-04/D-05, UI-SPEC §4) |
| `useAstridrChat().sendMessage` | Chat.tsx's own composer | LAUNCH-01/03 real send |
| `useMutation(api.forge.enqueueLaunch)` | `ForgeLaunchModal.tsx` | LAUNCH-02 |
| `useMutation(api.registry.recordSkillLaunch)` | `Skills.tsx` (`recordLaunch`) | LAUNCH-04 usage recording |
| `localStorage` read/write-on-mount pattern | `Reminders.tsx` (`codepulse-reminders-profile`) | D-01 last-pick persistence |
| `PROFILES` array (id/label/accentVar) | `Reminders.tsx:32-35` | D-07/D-08 persona list (verbatim reuse — do not redefine) |
| `skillInvocation(skill)` | `src/lib/skills.ts:110-114` | Building the `/skillname ` prefill string for both Chat-popover and Forge-modal prefill (already strips `<arg>` placeholders, handles suite `command:` overrides) |

**Version verification:** No new packages — nothing to verify against a registry.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. All primitives (`dropdown-menu`, `popover`, `dialog`, `input`, `button`) are already-installed shadcn components per 99-UI-SPEC.md's Registry Safety table (confirmed: `components.json` has empty `registries: {}`, no new `npx shadcn add` this phase).

## Architecture Patterns

### System Architecture Diagram

```
Skills page (SkillRow ⋯ menu | ColdStorageView ⋯ menu | QuickDeck tile click)
        │
        ▼
  Run target chooser (DropdownMenu, D-01)
  ── remembers last pick (localStorage) ──
        │
   ┌────┼────────────────┬─────────────────────┐
   ▼                      ▼                     ▼
 "Send to Chat"    "Launch as Forge Agent"  "Dispatch to Ástríðr"
   │                      │                     │
   ▼                      ▼                     ▼
 Popover (D-04/D-05)  ForgeLaunchModal      Popover + persona picker
 /{skill} + args      prompt="/{skill} …"   (D-07/D-08, PROFILES)
   │                  (D-10/D-11, editable)     │
   ▼                      │                     ▼
 useAstridrChat           ▼                Popover /{skill} + args
 .sendMessage()      enqueueLaunch          │
   │                 (Convex mutation,      ▼
   ▼                  Clerk fail-closed)   useAstridrChat.sendMessage(
 WS chat.send                │              { profile: personaId, ... })
 { message, profile? }       ▼                  │
   │                  forgeCommands row          ▼
   ▼                  (status: queued)      WS chat.send
 navigate('/chat')           │              { message, profile: personaId }
 → live stream                ▼                  │
   │                  Forge daemon polls          ▼
   ▼                  → spawns claude/codex     navigate('/chat')
 astridr WS:                 (agy disabled       → live stream, SecurityContext
 ChatSendCommand              in modal today)     scoped to chosen profile_id
 → _handle_chat_send                              (NOT a persona-voice switch —
 → _ws_agent_launcher                             see D-14a finding)
 → SecurityContext.profile_id
   = cmd.profile (or default)
        │
        ▼
  All three paths, on confirmed success only →
  recordSkillLaunch({ name: skillName })  (D-12/D-13)
```

### Recommended Project Structure

No new directories. New/changed files land in existing locations:

```
src/components/skills/
├── SkillLifecycleMenu.tsx     # add "Run" DropdownMenuItem (first item, D-02)
├── QuickDeck.tsx               # primary click → Run; hover icons → [Copy, Star] (D-03)
├── RunTargetChooser.tsx        # NEW — the D-01 chooser, shared by both entry points
├── RunChatPopover.tsx          # NEW — D-04/D-05 arg-input + send
├── RunAstridrPopover.tsx       # NEW — D-07/D-08 persona picker + arg-input + send
└── SkillCommandPalette.tsx     # UNCHANGED UI (D-02) — see Common Pitfalls re: recordSkillLaunch call

src/pages/
├── Chat.tsx                    # NEW: read auto-send handoff (router state or query param) + fire on mount
├── Skills.tsx                  # rewire handleOpenInChat / add new launch handlers; stop recording on copy (D-13)

src/hooks/
└── useAstridrChat.ts           # UNCHANGED — sendMessage already accepts opts; add `profile` passthrough (small, additive)
```

### Pattern 1: Deliberate pre-send capture (D-05)

**What:** A popover, not the persistent composer, owns the prefilled `/skill ` text. Submitting or pressing Enter inside the popover is the ONLY way the text becomes a sent message; closing/escaping the popover discards it with zero side effects.

**When to use:** Any "quick-launch with optional args" flow where the destination composer must never be left holding unstated content.

**Example (established codebase precedent for popover+action shape):**
```tsx
// Source: src/components/kg/KGViewsPopover.tsx (existing w-72 p-4 popover pattern)
<Popover open={open} onOpenChange={setOpen}>
  <PopoverContent className="w-72 p-4">
    {/* title, input, helper text, primary action button */}
  </PopoverContent>
</Popover>
```

### Pattern 2: Navigate-then-stream (D-06)

**What:** Fire `sendMessage()` FIRST (it appends the user's message + a streaming assistant placeholder to local `messages` state synchronously, then awaits the WS ack), THEN `navigate('/chat')`. Because `AstridrWSProvider` is mounted in `App.tsx` (app-shell scope, confirmed by `grep -r AstridrWSProvider src` returning only `App.tsx` + the context file itself), the WS connection and any in-flight command state persist across the route change — there is no teardown/remount race on navigation itself.

**Order matters for UX, not correctness:** `useAstridrChat`'s `messages` state lives in the hook instance, which is presumably instantiated once per Chat.tsx mount (need to confirm whether `useAstridrChat()` is called ONLY inside `Chat.tsx`, or higher up and passed down — if it's Chat.tsx-local, calling `sendMessage` before the Chat page has mounted is impossible, meaning the actual sequence must be **navigate → (Chat.tsx mounts, instantiates useAstridrChat) → send** — see Common Pitfalls for the resulting race and the recommended handoff mechanism).

### Anti-Patterns to Avoid

- **Claiming a persona-driven answer occurred** when only `SecurityContext.profile_id` was scoped — violates the house "honest state, no false success" rule (97/98 precedent) and is directly warned against by 99-UI-SPEC.md's own Interaction Contract #4.
- **Re-adding a `?skill=` "prefill" as the Chat handoff mechanism** — there is nothing today reading that param (drift finding above); building a query-param reader that leaves text sitting in the composer un-sent would recreate exactly the LAUNCH-01-rejected dead end, just with a different code path.
- **Assuming `agy` needs slash-resolution handling in this phase** — it's disabled in the modal's Agent picker; don't build conditional copy/logic for it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Forge job launch UI/plumbing | A new launch modal or a parallel `enqueue` mutation | `ForgeLaunchModal` + `enqueueLaunch` (Phase 80, unchanged) | Already handles host/workspace/mode picking, Clerk auth, optimistic pending-row UX, capability stripping |
| Chat streaming/turn lifecycle | A second WS client or a bespoke fetch-based send | `useAstridrChat().sendMessage` | Owns run.text/run.blocks/run.completed/run.error dedup, session correlation, TTS — reimplementing any slice of this risks silently breaking the existing Chat page |
| Usage counting | A new `skillLaunches` event table or per-target counters | `recordSkillLaunch` (single `useCount`/`lastUsedAt` patch) | LAUNCH-04's own wording ("records the launch") maps 1:1 to the existing mutation; a new table would fork the source of truth QuickDeck/palette already read |
| Persona list | A hardcoded 3-item array in the new popover | `Reminders.tsx`'s exported `PROFILES` (id/label/accentVar) | D-08 explicitly requires reuse; a second copy would drift on the next accent-token change |

**Key insight:** Every piece Phase 99 needs already exists somewhere in the codebase in working, tested form — the entire phase is glue code (a chooser + two small popovers + one new prop on an existing modal + one new effect in Chat.tsx), not new subsystems.

## Common Pitfalls

### Pitfall 1: The `?skill=` "prefill" doesn't exist — don't build a param-reading fix
**What goes wrong:** A plan or executor reads CONTEXT.md's canonical-refs line ("Chat.tsx consumes today's `?skill=` prefill via draft/setDraft, line ~252") and assumes there's existing prefill logic to convert from "sets draft" to "sends draft."
**Why it happens:** CONTEXT.md's line numbers/behavior description was accurate at some earlier point or was inferred rather than verified against live code; `Chat.tsx` at line 252 is just `const [draft, setDraft] = useState("")` — no relationship to any URL param.
**How to avoid:** Build the Chat auto-send handoff as new code. Two viable mechanisms, either acceptable:
  - **Router state** (`navigate('/chat', { state: { autoSend: text } })`) — cleaner, doesn't pollute the URL, but router `state` is lost on a hard refresh (acceptable here since this is a one-shot fire-and-forget action, not a bookmarkable URL).
  - **Query param** (`navigate('/chat?send=' + encodeURIComponent(text))`) — matches the OLD (nonfunctional) precedent's shape, bookmarkable, but must be cleared from the URL after firing (e.g. `navigate('/chat', { replace: true })`) so a page refresh doesn't re-send.
  Either way, Chat.tsx needs a NEW `useEffect` that fires `sendMessage` once on mount when the handoff payload is present, guarded so it never double-fires (React StrictMode double-invokes effects in dev — this file already has hard-won StrictMode guards elsewhere, e.g. `AstridrWSContext.tsx`'s connect-delay comment; follow that established caution).
**Warning signs:** A plan step titled "convert the `?skill=` prefill to auto-send" or "modify the existing draft-population effect" — there is no such effect to convert.

### Pitfall 2: The palette's orphaned `handleOpenInChat` recordLaunch call
**What goes wrong:** D-13 says "stop counting copy as a launch, keep consistent across QuickDeck copy and palette copy" — but `SkillCommandPalette`'s Ctrl+Enter path calls `onOpenInChat` (= `Skills.tsx`'s `handleOpenInChat`, which calls `recordLaunch` BEFORE navigating with a prefill that — per Pitfall 1 — doesn't even work). D-02 says the palette is "left as-is," but if `handleOpenInChat`'s implementation changes (e.g., to actually work now, or to be removed/rewired for the new Chat popover flow), the palette's Ctrl+Enter binding changes behavior for free, since it's the same shared handler.
**Why it happens:** Two decisions (D-02 "palette untouched" and D-13 "stop counting copy, keep consistent") both touch adjacent code paths without spelling out which specific call sites are in scope.
**How to avoid:** This needs an explicit call at plan time, not left implicit. Recommended resolution consistent with LAUNCH-04's own wording ("useCount reflects real runs"): since `handleOpenInChat`'s prefill-only navigate is not a real execution (confirmed doubly broken by Pitfall 1 — it doesn't even prefill today), its `recordLaunch` call should also stop firing, OR `handleOpenInChat` should be upgraded to route through the new real Chat-send flow (in which case its `recordLaunch` call becomes legitimate and stays). Either resolution is defensible; leaving it exactly as-is (recording a launch for an action that silently does nothing) is not, and contradicts LAUNCH-04's plain-language requirement.
**Warning signs:** A plan that touches QuickDeck's copy-icon and the palette's Enter-to-copy but leaves `handleOpenInChat`/Ctrl+Enter unexamined.

### Pitfall 3: Chat send guard silently no-ops when disconnected
**What goes wrong:** `sendMessage` (`useAstridrChat.ts:98`) has an early return: `if (!text.trim() || isStreamingRef.current || status !== "connected") return;` — no error, no thrown exception, nothing appended to `messages`. If the auto-send effect fires while the WS is still `"reconnecting"` (e.g., user navigated to Chat immediately after a page reload, before the 50ms-delayed `connect()` in `AstridrWSContext.tsx:369` has resolved to `"connected"`), the skill launch silently does nothing — worse than the current dead end, because it now LOOKS like it should have worked.
**Why it happens:** `sendMessage`'s guard was designed for a human typing into an always-visible composer (where a disabled Send button already prevents this state from mattering); it was never designed for a fire-and-forget programmatic call from a freshly-mounted page.
**How to avoid:** The Chat.tsx auto-send effect must check `status === "connected"` itself (or retry/wait) before calling `sendMessage`, and — per the 97/98 honest-state house rule — surface a visible message/toast if the connection isn't ready rather than silently dropping the launch. This matches the existing `disconnected` guard pattern already visible in Chat.tsx's own composer (`disabled={!draft.trim() || isStreaming || disconnected}`, line ~536).
**Warning signs:** A live-verified "Run → Send to Chat" that works when Chat is already the current page but silently fails on a fresh navigation from Skills right after opening the app.

### Pitfall 4: Sending `profile` and expecting persona behavior change
**What goes wrong:** After wiring the Ástríðr popover to send `profile: personaId`, it's tempting to add UI copy implying the response will sound/act like that persona (e.g., "Answering as Business…") or to write a verification step asserting persona-specific behavior in the reply.
**Why it happens:** The field name (`profile`) and the popover label ("Answer as") both suggest persona-voice control; the actual effect (security-policy scoping only) is not visible from the API surface alone — you have to read `_ws_agent_launcher`'s body to see `system_prompt` is never resolved per-profile.
**How to avoid:** See the D-14a finding above. Copy stays "Send," no persona-specific success claim, per 99-UI-SPEC.md's own anticipation of this outcome.
**Warning signs:** A verification/UAT step that says "confirm Ástríðr responds in a business tone when Business persona is selected" — this cannot pass today and isn't in scope for Phase 99.

## Code Examples

### Existing `chat.send` payload shape (extend, don't replace)
```typescript
// Source: src/hooks/useAstridrChat.ts:112-119 (live code)
const ack = await sendCommand({
  type: "chat.send",
  message: text,
  ...(opts?.interruptedReply ? { interrupted_reply: opts.interruptedReply } : {}),
  ...(opts?.voice ? { voice: true } : {}),
  ...(opts?.frame ? { frame: opts.frame, frame_mime_type: opts.frameMimeType } : {}),
  ...(opts?.swapHandled ? { swap_handled: true } : {}),
});
// Phase 99 adds: ...(opts?.profile ? { profile: opts.profile } : {})
// The astridr-side ChatSendCommand (ws_commands.py:63-67) already declares
// `profile: str | None = None` — no schema change needed on either side.
```

### Existing skill invocation formatting (reuse verbatim)
```typescript
// Source: src/lib/skills.ts:110-114
export function skillInvocation(skill: SkillLike): string {
  const cmd = skill.command?.trim();
  if (cmd) return cmd.replace(/\s*<[^>]*>/g, "").trim();
  return `/${skill.name}`;
}
```

### Existing `recordSkillLaunch` mutation (call unchanged from all 3 paths)
```typescript
// Source: convex/registry.ts:678-691
export const recordSkillLaunch = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const skill = await ctx.db.query("skills").withIndex("by_name", (q) => q.eq("name", args.name)).first();
    if (!skill) return;
    await ctx.db.patch(skill._id, {
      useCount: (skill.useCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| QuickDeck primary chip = copy-to-clipboard | QuickDeck primary chip = Run; copy demoted to secondary icon | Phase 99 (D-03) | Muscle-memory copy path preserved but no longer the default gesture |
| `handleOpenInChat` = navigate + (intended, non-functional) prefill | Chat target = navigate + real auto-send via new handoff mechanism | Phase 99 (D-05/D-06) | Closes a dead end that was actually worse than documented — the prefill never worked |
| `recordSkillLaunch` fires on copy AND prefill-navigate | Fires only on confirmed real execution (D-13) | Phase 99 | `useCount` becomes a trustworthy "real runs" signal instead of "clicks" |

**Deprecated/outdated:** The `?skill=` query-param convention referenced in CONTEXT.md/ROADMAP.md as "today's dead end" should be treated as aspirational/inaccurate documentation, not a real prior implementation — don't preserve its exact shape out of a mistaken sense of backward compatibility.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `agy` (Antigravity CLI) slash commands are TUI-session-only, not resolvable via `agy -p` headless mode | D-14b finding #4 | LOW — even if wrong, `agy` is disabled in `ForgeLaunchModal`'s Agent picker today, so this claim cannot be exercised through Phase 99's UI regardless |
| A2 | `codex exec` does not resolve slash commands (based on an open, unresolved GitHub feature request rather than official OpenAI docs) | D-14b finding #3 | LOW-MEDIUM — if codex has since shipped partial slash support, a codex-targeted skill launch would work better than expected (no harm, just an inaccurate caveat in documentation); if it still doesn't work, D-10's verbatim-inject default already accounts for this via the natural-language-wrapper-fallback caveat (not applied by default per D-10, but available if desired later) |
| A3 | `useAstridrChat()` is instantiated once, scoped to `Chat.tsx`'s own mount (not lifted to a shared app-level context) | Pattern 2 / Pitfall 3 | MEDIUM — if wrong (e.g., it's actually hoisted higher), the navigate-then-send race analysis changes; the planner should grep for `useAstridrChat(` call sites at plan time to confirm exactly one call site (Chat.tsx) before finalizing the handoff mechanism |

**If this table is empty:** N/A — see above; all three items are LOW-to-MEDIUM risk and none block planning, but A3 specifically should be double-checked with one grep at plan time (`grep -rn "useAstridrChat(" src/`) since it affects which handoff mechanism (router state vs. query param) is cleanest.

## Open Questions (RESOLVED)

> Both questions were locked during planning — see 99-06-PLAN.md (`<objective>` "Locked resolutions") and 99-01/99-02 (router-state `AutoSendHandoff`). Retained here for audit trail.

1. **RESOLVED (→ 99-06): Should `handleOpenInChat`'s `recordLaunch` call stop firing, given its target is retired/rebuilt?** — Resolution: `handleOpenInChat` + the `onOpenInChat` prop are deleted everywhere and the palette's copy-recording stops (Recommendation (b), extended); real Chat launch is reached only via the chooser's D-04 arg step.
   - What we know: D-13's decision text only names "QuickDeck copy" and "palette copy" as the scope for "stop counting as launch." `handleOpenInChat` is neither — it's the (currently non-functional) prefill-navigate path, still bound to `SkillCommandPalette`'s Ctrl+Enter after D-02 freezes that surface.
   - What's unclear: Whether the planner should (a) leave `handleOpenInChat` calling `recordLaunch` unchanged (technically outside D-13's stated scope), (b) stop it (consistent with LAUNCH-04's "real runs" spirit), or (c) rewire the palette's Ctrl+Enter to the new real Chat-send flow entirely (which would make recordLaunch legitimate again, but expands D-02's "palette left as-is" scope).
   - Recommendation: (b) is safest and smallest — stop recording on a navigate that (per Pitfall 1) doesn't even prefill successfully today. Flag for explicit lock at plan time rather than defaulting silently.

2. **RESOLVED (→ 99-01/99-02): Router-state vs. query-param for the Chat auto-send handoff (D-06)?** — Resolution: router `state` (`AutoSendHandoff`), per Recommendation below.
   - What we know: Both are viable; router state is cleaner and matches the "one-shot action" semantics; query param matches the shape of the (nonfunctional) old convention and is trivially testable via direct URL navigation in an E2E test.
   - What's unclear: No existing codebase precedent for either pattern exists in this exact "navigate with a payload to auto-execute on arrival" shape (checked: no other page in `src/pages/` does this).
   - Recommendation: Router `state` (`navigate('/chat', { state: { autoSend: { text, profile? } } })`) — avoids the "clear the URL after firing" cleanup step query params need, and this is a fire-and-forget action, not a bookmarkable/shareable URL. Confirm no E2E test suite specifically needs URL-based triggering before locking this.

## Environment Availability

Not applicable — this phase has no new external tool/service dependencies. It rides three already-live channels (Ástríðr WS, already connected in dev per `App.tsx`; Forge daemon, already required infra for the Forge picker to show any hosts — degrades honestly to "No hosts online" per `ForgeLaunchModal.tsx:239-242` if absent; Convex, already the app's backend).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom), existing `src/test/setup.ts` mocks (Clerk, Recharts, Three.js, Globe, React Flow, Tone.js) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run src/components/skills/<File>.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAUNCH-01 | Chat popover submit calls `sendMessage` with the typed text, then navigates | unit | `npx vitest run src/pages/Chat.test.tsx` | ❌ Wave 0 (no `Chat.test.tsx` found — `useAstridrChat.test.ts` exists but the page-level auto-send effect is untested) |
| LAUNCH-02 | Run→Forge opens `ForgeLaunchModal` with `prompt` pre-populated, editable | unit | `npx vitest run src/components/forge/ForgeLaunchModal.test.tsx` | ✅ (existing file; needs new test cases for the `initialPrompt` prop) |
| LAUNCH-03 | Ástríðr popover sends `chat.send` with `profile` set to the picked persona | unit | new test file | ❌ Wave 0 |
| LAUNCH-04 | `recordSkillLaunch` fires exactly once per real execution, not on copy/cancel | unit | `npx vitest run src/pages/Skills.test.tsx` | ❌ (no `Skills.test.tsx` found today — check before assuming; `QuickDeck.test.tsx` and `SkillCommandPalette.test.tsx` exist and should gain "copy does NOT call recordUse" regression cases) |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <file>` for the touched component
- **Per wave merge:** `npm test` (full suite — 204+ test files per Phase 98's precedent run)
- **Phase gate:** full suite green before `/gsd:verify-work`; live UAT still required for the actual WS round-trip (jsdom cannot exercise a real WebSocket to a live astridr backend) — matches the 97/98 precedent of deferring true end-to-end proof to manual verification.

### Wave 0 Gaps
- [ ] `src/pages/Skills.test.tsx` — does not appear to exist; verify with `ls src/pages/*.test.tsx` at plan time before assuming test coverage for `handleRecordUse`/`handleOpenInChat` changes
- [ ] `src/components/skills/RunTargetChooser.test.tsx` (or equivalent, new component) — new file, new tests
- [ ] `src/pages/Chat.test.tsx` — new file for the auto-send-on-mount effect (or extend `useAstridrChat.test.ts` if the handoff logic is pushed into the hook instead of the page)
- [ ] Framework install: none — Vitest already configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Partial | `enqueueLaunch` is Clerk-gated fail-closed (`convex/forge.ts:944-947`, unchanged this phase); Chat/Ástríðr paths ride the existing WS `Authorization: Bearer` protocol handshake (`AstridrWSContext.tsx:233-236`) — unchanged |
| V4 Access Control | Yes | No new authorization surface — this phase adds no new mutation that writes to a different trust boundary than the three it reuses |
| V5 Input Validation | Yes | The `profile` field sent to `chat.send` must be constrained to the known `PROFILES` id set (`"personal" \| "business" \| "consulting"`) client-side before send — matches existing `ProfileId` typing in `Reminders.tsx`; do not send arbitrary user-typed strings as `profile` |
| V6 Cryptography | No | Not applicable — no new secret/token handling introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Arbitrary text injected into `chat.send`'s `message` field reaching the LLM/agent loop unsanitized | Tampering / Elevation of Privilege | Already mitigated upstream — astridr's `_ws_agent_launcher` runs every inbound message through `security_pipeline.process_inbound` (`wiring.py:256-315`) BEFORE any agent object exists; Phase 99 does not bypass or duplicate this, it only adds a client-side construction step (`/{skill} {args}`) that lands in the same `message` field as any typed chat text |
| Spoofed `profile` value used to escalate DLP/security policy scope | Spoofing | The `profile` string is not a capability grant — it selects which named `SecurityContext.profile_id` policy applies, and astridr already treats any client-supplied value defensively (falls back to `default_profile_id` if absent, `wiring.py:259`); no new trust is extended by adding this field to CodePulse's send path |

## Sources

### Primary (HIGH confidence)
- Live code, astridr-repo: `astridr/api/ws_commands.py` (ChatSendCommand definition, `_handle_chat_send`), `astridr/engine/bootstrap/wiring.py` (`_ws_agent_launcher`, `SecurityContext` construction, `system_prompt` resolution), `astridr/channels/commands.py` (`CommandDispatcher.handle_profile`)
- Live code, forge repo: `src/adapters/claude.ts`, `src/adapters/codex.ts`, `src/adapters/agy.ts`
- Live code, codepulse repo: `src/hooks/useAstridrChat.ts`, `src/contexts/AstridrWSContext.tsx`, `src/pages/Chat.tsx`, `src/pages/Skills.tsx`, `src/components/skills/QuickDeck.tsx`, `src/components/skills/SkillCommandPalette.tsx`, `src/components/skills/SkillLifecycleMenu.tsx`, `src/components/forge/ForgeLaunchModal.tsx`, `src/lib/skills.ts`, `convex/registry.ts`, `convex/forge.ts`, `convex/profiles.ts`, `convex/schema.ts`, `src/pages/Reminders.tsx`, `src/main.tsx`
- [code.claude.com/docs/en/agent-sdk/slash-commands](https://code.claude.com/docs/en/agent-sdk/slash-commands) — official Claude Agent SDK docs, fetched live, confirms `-p`/single-shot slash-command and custom-skill resolution behavior

### Secondary (MEDIUM confidence)
- [github.com/openai/codex/issues/3641](https://github.com/openai/codex/issues/3641) — openai/codex's own issue tracker, unambiguous statement that `codex exec` does not resolve slash commands

### Tertiary (LOW confidence)
- Third-party Antigravity CLI (`agy`) cheat sheets (toolsbase.dev, scriptbyai.com, and others) describing slash commands as TUI-session-only — no official Google documentation found; moot for this phase per the `ForgeLaunchModal` disabled-agy finding

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive verified live in the codebase
- Architecture: HIGH — all three channel integration points read directly from live code on both sides (codepulse + astridr-repo + forge)
- D-14a (Ástríðr persona routing): HIGH — traced the full code path from CodePulse's WS payload through astridr's command dispatcher to the actual system-prompt resolution, with file:line evidence at every hop
- D-14b (Forge slash resolution): HIGH for `claude` (official docs), MEDIUM for `codex` (project issue tracker), LOW-MEDIUM for `agy` (third-party only, and moot in practice)
- Chat.tsx `?skill=` drift finding: HIGH — confirmed by full-file grep returning zero matches for "skill" (case-insensitive) anywhere in Chat.tsx

**Research date:** 2026-07-23
**Valid until:** 30 days for the codepulse/forge findings (stable, slow-moving internal code); the Codex/Antigravity slash-command behavior claims should be re-verified if this phase's execution is delayed more than ~60 days, since both are actively-developed external CLIs with open feature requests that could land at any time.
