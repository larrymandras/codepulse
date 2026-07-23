# Phase 99: Skill Launch / Dispatch - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 8 (3 new, 5 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/components/skills/RunTargetChooser.tsx` (NEW) | component (dropdown menu) | request-response (client dispatch) | `src/components/skills/SkillLifecycleMenu.tsx` (⋯ DropdownMenu shell) | exact (same DropdownMenu primitive + trigger-button convention) |
| `src/components/skills/RunChatPopover.tsx` (NEW) | component (popover form) | request-response (fire-and-navigate) | `src/components/kg/KGViewsPopover.tsx` (`w-72 p-4` Popover) | exact (UI-SPEC names this file as the literal shape source) |
| `src/components/skills/RunAstridrPopover.tsx` (NEW) | component (popover form + segmented picker) | request-response | `src/components/kg/KGViewsPopover.tsx` (popover shell) + `src/pages/Reminders.tsx` (`ProfileSwitch`/`PROFILES`) | exact (two-source composite, both verbatim reuse per D-08) |
| `src/components/skills/SkillLifecycleMenu.tsx` (MODIFY) | component (dropdown menu) | request-response | itself (Phase 98, self-analog) | exact — add one `DropdownMenuItem` + `DropdownMenuSeparator` |
| `src/components/skills/QuickDeck.tsx` (MODIFY) | component (tile grid) | request-response / CRUD (usage recording) | itself (self-analog) | exact — swap primary chip handler, relabel hover icon |
| `src/pages/Skills.tsx` (MODIFY) | page / controller (handler composition) | CRUD (recordSkillLaunch) + request-response | itself (self-analog) | exact — rewire `handleOpenInChat`, add new launch handlers, stop-on-copy |
| `src/pages/Chat.tsx` (MODIFY — new auto-send effect) | page / controller | event-driven (mount-triggered send) | `src/contexts/AstridrWSContext.tsx` (StrictMode-safe delayed-effect pattern) + itself (composer `submit()`) | role-match (no existing "fire on mount" precedent anywhere in `src/pages/`) |
| `src/hooks/useAstridrChat.ts` (MODIFY — add `profile` passthrough) | hook (streaming client) | request-response (WS command) | itself (self-analog — extend the existing `sendCommand({ type: "chat.send", ... })` spread pattern) | exact |
| `src/components/forge/ForgeLaunchModal.tsx` (MODIFY — add `initialPrompt` prop) | component (dialog form) | CRUD (Convex mutation) | itself (self-analog — extend existing reset-on-open `useEffect`) | exact |

## Pattern Assignments

### `src/components/skills/RunTargetChooser.tsx` (NEW component, request-response)

**Analog:** `src/components/skills/SkillLifecycleMenu.tsx` (the Phase 98 ⋯ menu — same DropdownMenu primitive, same trigger-button sizing/hover convention, same `TooltipProvider` wrapper caution).

**Imports pattern** (`SkillLifecycleMenu.tsx` lines 18-51):
```tsx
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreVertical, /* ... */ } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
```

**Trigger-button pattern** (`SkillLifecycleMenu.tsx` lines 206-215) — reuse the exact `min-w-8 min-h-8` touch target and hover-tint classes (UI-SPEC §Spacing Scale explicitly locks this):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      aria-label={`Skill actions for ${skill.displayName}`}
      className="min-w-8 min-h-8 flex items-center justify-center rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
    >
      <MoreVertical className="w-3.5 h-3.5" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
    {/* items */}
  </DropdownMenuContent>
</DropdownMenu>
```
**Critical gotcha carried over:** `onCloseAutoFocus={(e) => e.preventDefault()}` is required because opening a Popover/Dialog from a `DropdownMenuItem`'s `onSelect` fights Radix's own close-autofocus return — omit it and the follow-up popover/modal loses focus. Same recipe needed when RunTargetChooser's "Send to Chat" / "Dispatch to Ástríðr" items open `RunChatPopover`/`RunAstridrPopover`, and when "Launch as Forge Agent" opens `ForgeLaunchModal`.

**localStorage last-pick pattern** — do NOT invent new persistence logic; copy `Reminders.tsx`'s `STORAGE_KEY`/`isProfileId`/`loadStoredProfile` shape verbatim (lines 38-48), retargeted to the 3 Run targets:
```tsx
// Source: src/pages/Reminders.tsx:38-48 — adapt id union to "chat" | "forge" | "astridr"
const STORAGE_KEY = "codepulse-skills-run-target";
function isValidTarget(value: string | null): value is RunTarget {
  return value === "chat" || value === "forge" || value === "astridr";
}
function loadStoredTarget(): RunTarget {
  if (typeof window === "undefined") return "chat";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidTarget(stored) ? stored : "chat";
}
// write on every successful pick, mirroring Reminders.tsx:103-106's useEffect(() => localStorage.setItem(...), [value])
```

**Checkmark/last-pick highlight** — no existing exact analog for a checkmark+tint `DropdownMenuItem`; compose from `SkillLifecycleMenu.tsx`'s existing `text-primary` accent convention (line 211: `hover:text-primary`) — UI-SPEC §Copywriting Contract locks the exact rule: "Checkmark (✓) + `--primary`-tinted row, no extra text label."

---

### `src/components/skills/RunChatPopover.tsx` (NEW component, request-response)

**Analog:** `src/components/kg/KGViewsPopover.tsx` — UI-SPEC explicitly names this file's `w-72 p-4` shell as the pattern to copy (not `ConnectionPopover`'s narrower variant).

**Popover shell pattern** (`KGViewsPopover.tsx` lines 133-141):
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm">{/* trigger */}</Button>
  </PopoverTrigger>
  <PopoverContent className="w-72 p-4" side="bottom" align="end">
    {/* title, input, helper text, primary action button */}
  </PopoverContent>
</Popover>
```
Note: RunChatPopover is opened programmatically from a `DropdownMenuItem.onSelect` (not its own `PopoverTrigger`) — control `open`/`onOpenChange` as controlled state from `RunTargetChooser`, same controlled-Popover shape used by `SkillLifecycleMenu`'s `moveOpen`/`deleteOpen` dialogs (lines 109-110, 307-326).

**Deliberate pre-send capture pattern (D-05)** — no direct analog exists (this is genuinely new behavior); compose from:
1. `src/lib/skills.ts:110-114` `skillInvocation()` — build the prefilled text:
```typescript
export function skillInvocation(skill: SkillLike): string {
  const cmd = skill.command?.trim();
  if (cmd) return cmd.replace(/\s*<[^>]*>/g, "").trim();
  return `/${skill.name}`;
}
```
2. `src/pages/Chat.tsx:261-266` `submit()` — the exact guard-then-send shape to mirror inside the popover's Send handler:
```tsx
const submit = () => {
  const text = draft.trim();
  if (!text || isStreaming || disconnected) return;
  void sendMessage(text);
  setDraft("");
};
```
3. Enter-to-submit key handling: `KGViewsPopover.tsx:82-89`'s `onKeyDown` (Enter confirms, Escape cancels) is the closest existing "popover input commit" convention:
```tsx
const handleSaveKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleConfirmSave();
  } else if (e.key === "Escape") {
    handleCancelSave();
  }
};
```

**Error/disconnected handling (Pitfall 3, RESEARCH.md):** Must check `status === "connected"` before calling `sendMessage` — mirrors `Chat.tsx:254` (`const disconnected = status !== "connected"`) and the composer's disabled-state convention (`Chat.tsx:536`: `disabled={!draft.trim() || isStreaming || disconnected}`). On a disconnected send, surface the UI-SPEC-specified toast: `"Couldn't send — {error message}. Try again."` (mirrors `SkillLifecycleMenu.tsx`'s `toast.error(lifecycleRefusalMessage(err))` pattern, line 153).

---

### `src/components/skills/RunAstridrPopover.tsx` (NEW component, request-response)

**Analog 1 (popover shell):** same `KGViewsPopover.tsx` `w-72 p-4` pattern as `RunChatPopover.tsx` above — identical shell, extra control stacked above the input per UI-SPEC §4.

**Analog 2 (persona picker — reuse verbatim, do not redefine per D-08):** `src/pages/Reminders.tsx` lines 25-36, 52-94.
```tsx
// Source: src/pages/Reminders.tsx:25-36 — the exact PROFILES array to import, not copy
export type ProfileId = "personal" | "business" | "consulting";
export const PROFILES: { id: ProfileId; label: string; accentVar: string }[] = [
  { id: "personal", label: "Personal", accentVar: "--status-ok" },
  { id: "business", label: "Business", accentVar: "--status-warn" },
  { id: "consulting", label: "Consulting", accentVar: "--status-info" },
];
```
```tsx
// Source: src/pages/Reminders.tsx:52-94 — ProfileSwitch segmented-control render
// shape (adapt to "colored-dot + label pill" per UI-SPEC §4, but the active-state
// styling convention — accent color + boxShadow glow on the active segment — is
// the one to copy verbatim):
<div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5" role="tablist" aria-label="Profile">
  {PROFILES.map((p) => {
    const active = p.id === value;
    return (
      <button
        key={p.id} type="button" role="tab" aria-selected={active}
        onClick={() => onChange(p.id)}
        className={/* active ? accent-tinted : muted, see source */}
        style={active ? {
          color: `var(${p.accentVar})`,
          boxShadow: `0 0 8px oklch(from var(${p.accentVar}) l c h / 0.35)`,
        } : undefined}
      >
        {p.label}
      </button>
    );
  })}
</div>
```
**IMPORTANT — do not import `Reminders.tsx`'s `PROFILES` directly if it isn't exported for cross-page use; verify at plan time whether to (a) import it from `Reminders.tsx` (it IS exported, `export const PROFILES`) or (b) hoist it to a shared `src/lib/profiles.ts` if `Reminders.tsx` doesn't want a `Skills.tsx` import dependency. Either is defensible; D-08 only requires no *second, drifting copy* of the data.**

**Send pattern (extends `useAstridrChat.sendMessage`'s existing `opts` spread, not a new mutation):**
```typescript
// Source: src/hooks/useAstridrChat.ts:112-119 (live code, extend with profile)
const ack = await sendCommand({
  type: "chat.send",
  message: text,
  ...(opts?.interruptedReply ? { interrupted_reply: opts.interruptedReply } : {}),
  ...(opts?.voice ? { voice: true } : {}),
  ...(opts?.frame ? { frame: opts.frame, frame_mime_type: opts.frameMimeType } : {}),
  ...(opts?.swapHandled ? { swap_handled: true } : {}),
  ...(opts?.profile ? { profile: opts.profile } : {}),  // Phase 99 addition — see D-14a
});
```
**Honesty constraint (hard rule, not stylistic):** per D-14a research finding and UI-SPEC Interaction Contract #4, this popover's copy must NEVER claim "answered as {persona}" — the `profile` field only scopes `SecurityContext.profile_id`/DLP policy server-side, not which persona's system prompt answers. Copy stays "Send," matching `RunChatPopover`'s copy exactly (no persona-specific success string).

---

### `src/components/skills/SkillLifecycleMenu.tsx` (MODIFY — add Run item)

**Analog:** itself. Insert pattern (mirrors the existing `dormant ? (...) : multiScope ? (...) : (...)` item-list shape at lines 223-302) — add as the unconditional FIRST item, before the branch, separated by `DropdownMenuSeparator`:
```tsx
// New import: DropdownMenuSeparator (already exported from "@/components/ui/dropdown-menu"
// per shadcn's standard dropdown-menu.tsx — verify export exists, it's a standard primitive)
// New import: Play icon from lucide-react
<DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
  <DropdownMenuItem onSelect={() => setRunChooserOpen(true) /* or however RunTargetChooser is wired in */}>
    <Play /> Run
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  {dormant ? ( /* ...unchanged existing branch... */ ) : /* ... */}
</DropdownMenuContent>
```
Run "never disables" per UI-SPEC §1 — unlike every other item in this menu (which gates on `dormant`/`multiScope`/`shadowed`), the Run item renders unconditionally in every scope state.

---

### `src/components/skills/QuickDeck.tsx` (MODIFY — primary click becomes Run)

**Analog:** itself. Current primary-chip handler (`handleCopy`, lines 32-45) becomes the **secondary** (copy icon) handler; a new `onRun` handler takes the primary chip's `onClick` (currently line 72: `onClick={() => handleCopy(skill)}`).

**Hover-reveal icon group swap** (lines 88-103) — replace `MessageSquare` (open-in-chat, retired per D-05/D-06) with `Copy` (clipboard, D-03), keep `Star` unchanged:
```tsx
// BEFORE (line 88-103): [MessageSquare (open in chat), Star (favorite)]
// AFTER: [Copy (clipboard — now calls what handleCopy used to do), Star (unchanged)]
<div className="flex w-0 overflow-hidden items-center gap-0.5 transition-all group-hover:w-14 group-focus-within:w-14 group-hover:pr-2 group-focus-within:pr-2">
  <button
    onClick={() => handleCopy(skill)}  // was onOpenInChat(skill.name)
    aria-label={`Copy invocation for ${skill.name}`}
    className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
  >
    <Copy className="w-3.5 h-3.5" />
  </button>
  <button onClick={() => onToggleFavorite(skill.name)} /* unchanged */>
    <Star className={/* unchanged */} />
  </button>
</div>
```
**Props signature changes:** `onOpenInChat: (skillName: string) => void` is retired from `QuickDeckProps` (line 15); a new `onRun: (skillName: string) => void` prop replaces it as the primary-chip handler. `onUse` (line 14, currently fired on every copy per line 44 `onUse(skill.name)`) — per D-13, copy must STOP calling `onUse`/`recordLaunch`; only the new `onRun` path should record usage (the recording call itself lives in `Skills.tsx`, triggered downstream of the Run flow's actual execution, not from `QuickDeck` directly).

---

### `src/pages/Skills.tsx` (MODIFY — rewire handlers, stop-on-copy per D-13)

**Analog:** itself. Current `handleRecordUse`/`handleOpenInChat` (lines 132-139):
```typescript
const handleRecordUse = (skillName: string) => {
  void recordLaunch({ name: skillName });
};

const handleOpenInChat = async (skillName: string) => {
  await recordLaunch({ name: skillName });
  navigate(`/chat?skill=${encodeURIComponent(skillName)}`);
};
```
**D-13/Pitfall 1/Pitfall 2 resolution (per RESEARCH.md's own recommendation):** `handleRecordUse` is currently wired as `QuickDeck`'s `onUse` (called on every copy, line 272: `onUse={handleRecordUse}`) AND as `ColdStorageView`/`AllSkillsOverview`/`SkillsInCategory`/`SkillCommandPalette`'s `onRecordUse` prop (lines 374, 386, 405, 423). Per D-13, the copy-triggered calls must stop; `recordLaunch` should fire only from the new real-execution paths (chat send resolving, `enqueueLaunch` resolving, Ástríðr dispatch resolving) — call sites to audit: every `onRecordUse={handleRecordUse}` / `onUse={handleRecordUse}` prop passed to a component whose action is "copy," not "run."

`handleOpenInChat`'s `navigate('/chat?skill=...')` (broken today, confirmed by RESEARCH.md's Chat.tsx grep) is the literal shape to REPLACE with the new real Chat-send flow (router-state handoff per Pitfall 2's recommendation), not repair:
```typescript
// New pattern (RESEARCH.md Pitfall 1/2 recommendation — router state, not query param)
const handleRunInChat = async (skillName: string, argsText: string) => {
  navigate('/chat', { state: { autoSend: { text: argsText } } });
  // recordSkillLaunch fires from Chat.tsx's effect on confirmed send, OR here
  // if the popover already awaited sendMessage before navigating — lock this
  // exact sequencing at plan time (RunChatPopover fires sendMessage FIRST per
  // RESEARCH.md's "Pattern 2: Navigate-then-stream", D-06).
};
```

**Convex mutation import (unchanged):**
```typescript
// Source: src/pages/Skills.tsx:4, 46 (live code, unchanged)
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
const recordLaunch = useMutation(api.registry.recordSkillLaunch);
```

---

### `src/pages/Chat.tsx` (MODIFY — new mount-triggered auto-send effect)

**Analog:** No existing "navigate-with-payload-to-auto-execute" precedent anywhere in `src/pages/` (confirmed by RESEARCH.md's Open Questions #2). Compose the new effect from two existing conventions in this same file:

**1. StrictMode-safe delayed-effect caution** (`src/contexts/AstridrWSContext.tsx` lines 363-375) — the established pattern for "this effect must not double-fire under StrictMode's mount→cleanup→remount":
```typescript
// Source: src/contexts/AstridrWSContext.tsx:363-375 (live code)
// Initial connection — delayed to survive React StrictMode double-mount.
// StrictMode runs mount→cleanup→remount synchronously; without a guard
// the effect fires twice.
useEffect(() => {
  mountedRef.current = true;
  const connectTimer = setTimeout(() => connect(), 50);
  return () => {
    mountedRef.current = false;
    clearTimeout(connectTimer);
    /* ... */
  };
}, [connect]);
```
Adapt to a `useRef`-guarded one-shot fire (simpler than the timer — no delay needed here, just idempotency): `const firedRef = useRef(false); useEffect(() => { if (firedRef.current) return; if (locationState?.autoSend) { firedRef.current = true; /* wait for connected, then sendMessage */ } }, [...]);`

**2. Composer's own guard-then-send shape** (`src/pages/Chat.tsx` lines 261-266, already read above) — the auto-send effect must replicate this exact connected/streaming guard, not bypass it (Pitfall 3):
```tsx
const submit = () => {
  const text = draft.trim();
  if (!text || isStreaming || disconnected) return;
  void sendMessage(text);
  setDraft("");
};
```

**Imports already present** (`src/pages/Chat.tsx` lines 18-31) — `useEffect`, `useRef` already imported; new addition needed: `useLocation` from `react-router-dom` (not currently imported in this file — confirm via grep at plan time) to read `location.state.autoSend`.

**Error handling (Pitfall 3):** if `status !== "connected"` when the effect fires, do NOT silently drop — surface a toast per UI-SPEC's "Couldn't send — {error message}. Try again." convention (no existing toast import in `Chat.tsx` today; `sonner`'s `toast` is already a project-wide dependency, imported in `SkillLifecycleMenu.tsx:19` and `Reminders.tsx:14` — same import to add here).

---

### `src/hooks/useAstridrChat.ts` (MODIFY — add `profile` passthrough)

**Analog:** itself — extend the existing optional-spread `opts` pattern, do not add a new function or parameter shape.

**Exact insertion point** (`src/hooks/useAstridrChat.ts` lines 84-96, 112-119):
```typescript
// sendMessage's opts type (lines 84-96) — add one new optional field:
opts?: {
  interruptedReply?: string;
  voice?: boolean;
  frame?: string;
  frameMimeType?: string;
  swapHandled?: boolean;
  profile?: string;  // NEW — D-07/D-14a: scopes SecurityContext.profile_id server-side only
}

// sendCommand call (lines 112-119) — add matching spread:
const ack = await sendCommand({
  type: "chat.send",
  message: text,
  ...(opts?.interruptedReply ? { interrupted_reply: opts.interruptedReply } : {}),
  ...(opts?.voice ? { voice: true } : {}),
  ...(opts?.frame ? { frame: opts.frame, frame_mime_type: opts.frameMimeType } : {}),
  ...(opts?.swapHandled ? { swap_handled: true } : {}),
  ...(opts?.profile ? { profile: opts.profile } : {}),
});
```
No schema change needed astridr-side — `ChatSendCommand.profile: str | None = None` already exists (`astridr-repo/astridr/api/ws_commands.py:63-67`, verified live by the phase researcher).

---

### `src/components/forge/ForgeLaunchModal.tsx` (MODIFY — add `initialPrompt` prop)

**Analog:** itself — extend the existing reset-on-open `useEffect`, do not add a second effect or bypass the reset.

**Exact insertion point** (`src/components/forge/ForgeLaunchModal.tsx` lines 82-125):
```tsx
interface ForgeLaunchModalProps {
  open: boolean;
  onClose: () => void;
  onLaunched: (row: ForgeCommandRow) => void;
  onLaunchFailed: (commandId: string, message: string) => void;
  initialPrompt?: string;  // NEW — D-11: prefills prompt instead of always resetting to ""
}

export function ForgeLaunchModal({
  open, onClose, onLaunched, onLaunchFailed, initialPrompt,
}: ForgeLaunchModalProps) {
  // ...
  useEffect(() => {
    if (open) {
      setAgent("codex");
      setWorkspaceId("");
      setMode("goal");
      setPrompt(initialPrompt ?? "");  // CHANGED from setPrompt("")
      setModel("gpt-5.5");
      setMaxTurns("50");
      setAdvancedOpen(false);
      setSubmitting(false);
      setHostId("");
    }
  }, [open, initialPrompt]);  // add initialPrompt to dep array
```
All other modal behavior (host/agent/workspace/mode picker, `enqueueLaunch` call at lines 194-203, Clerk fail-closed auth, non-optimistic pending-row pattern) is unchanged per D-11 — reused wholesale. `recordSkillLaunch` should fire from the CALLER (Skills.tsx / RunTargetChooser) on `onLaunched` resolving, not inside this modal (keeps the modal's existing Forge-only responsibility boundary intact — it already doesn't know about the `skills` Convex table).

---

## Shared Patterns

### Popover shell (`w-72 p-4`)
**Source:** `src/components/kg/KGViewsPopover.tsx:141`
**Apply to:** `RunChatPopover.tsx`, `RunAstridrPopover.tsx`
```tsx
<PopoverContent className="w-72 p-4" side="bottom" align="end">
```
Locked by UI-SPEC's Spacing Scale section — do not use `ConnectionPopover`'s narrower `w-[280px] p-3` variant.

### DropdownMenu shell + `onCloseAutoFocus` guard
**Source:** `src/components/skills/SkillLifecycleMenu.tsx:206-221`
**Apply to:** `RunTargetChooser.tsx`, and unchanged in `SkillLifecycleMenu.tsx` itself
```tsx
<DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
```
Required whenever a `DropdownMenuItem.onSelect` opens a Popover or Dialog — omitting this loses focus to the closing menu instead of the newly-opened surface.

### Toast error copy on failed dispatch
**Source:** `src/components/skills/SkillLifecycleMenu.tsx:153` (`toast.error(lifecycleRefusalMessage(err))`)
**Apply to:** `RunChatPopover.tsx` (Chat send failure), `RunAstridrPopover.tsx` (Ástríðr unreachable)
```tsx
} catch (err: unknown) {
  toast.error(`Couldn't send — ${err instanceof Error ? err.message : String(err)}. Try again.`);
}
```
Exact copy strings locked by UI-SPEC's Copywriting Contract: `"Couldn't send — {error message}. Try again."` (Chat) and `"Couldn't reach Ástríðr — {error message}. Try again."` (Ástríðr) — distinct wording per target, same structural pattern.

### `recordSkillLaunch` — fire on confirmed execution only (D-12/D-13)
**Source:** `convex/registry.ts:678-691`
**Apply to:** all three Run paths (`RunChatPopover` after `sendMessage` resolves, `ForgeLaunchModal`'s `onLaunched` callback, `RunAstridrPopover` after its `sendMessage({profile})` resolves) — NEVER from the QuickDeck copy-icon click or palette copy.
```typescript
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

### `skillInvocation()` — the one place `/skill args` text is built
**Source:** `src/lib/skills.ts:110-114`
**Apply to:** `RunChatPopover.tsx`, `RunAstridrPopover.tsx` (prefill), `ForgeLaunchModal`'s `initialPrompt` caller in `Skills.tsx`/`RunTargetChooser.tsx`
```typescript
export function skillInvocation(skill: SkillLike): string {
  const cmd = skill.command?.trim();
  if (cmd) return cmd.replace(/\s*<[^>]*>/g, "").trim();
  return `/${skill.name}`;
}
```

### `PROFILES` persona list — reuse verbatim, never redefine (D-08)
**Source:** `src/pages/Reminders.tsx:25-36`
**Apply to:** `RunAstridrPopover.tsx` only
```typescript
export type ProfileId = "personal" | "business" | "consulting";
export const PROFILES: { id: ProfileId; label: string; accentVar: string }[] = [
  { id: "personal", label: "Personal", accentVar: "--status-ok" },
  { id: "business", label: "Business", accentVar: "--status-warn" },
  { id: "consulting", label: "Consulting", accentVar: "--status-info" },
];
```

### localStorage read-on-mount / write-on-pick
**Source:** `src/pages/Reminders.tsx:38-48, 103-106`
**Apply to:** `RunTargetChooser.tsx` (last-pick persistence, D-01)
```typescript
const STORAGE_KEY = "codepulse-skills-run-target";
function loadStoredTarget(): RunTarget {
  if (typeof window === "undefined") return "chat";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidTarget(stored) ? stored : "chat";
}
// on pick: window.localStorage.setItem(STORAGE_KEY, target);
```

## No Analog Found

| File/Surface | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Mount-triggered auto-send effect in `Chat.tsx` | event handler (effect) | event-driven | No existing page in `src/pages/` does "navigate with a payload to auto-execute on arrival" (confirmed by RESEARCH.md's grep of all `src/pages/`). Composed from two partial analogs (StrictMode-guard shape from `AstridrWSContext.tsx`, guard-then-send shape from `Chat.tsx`'s own `submit()`) rather than one direct copy — see Pattern Assignment above. |
| Checkmark + accent "last pick" highlight on a `DropdownMenuItem` | visual state | n/a | No existing `DropdownMenuItem` in the codebase renders a persistent "remembered choice" indicator; UI-SPEC's own copy contract (checkmark + `text-primary` tint, no label) is the full spec — compose from `SkillLifecycleMenu.tsx`'s existing accent-color convention, not a literal copy. |

## Metadata

**Analog search scope:** `src/components/skills/`, `src/components/kg/`, `src/components/forge/`, `src/pages/`, `src/hooks/`, `src/contexts/`, `src/lib/skills.ts`, `convex/registry.ts`
**Files scanned:** 11 (SkillLifecycleMenu.tsx, QuickDeck.tsx, Skills.tsx, Chat.tsx, useAstridrChat.ts, ForgeLaunchModal.tsx, KGViewsPopover.tsx, Reminders.tsx, skills.ts, AstridrWSContext.tsx, registry.ts excerpt)
**Pattern extraction date:** 2026-07-23
