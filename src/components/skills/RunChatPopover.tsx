/**
 * RunChatPopover — deliberate pre-send capture for the Chat Run target
 * (Phase 99 Plan 03, LAUNCH-01, D-04/D-05).
 *
 * Pure, controlled, presentational form: prefills the skill invocation, lets
 * the user add optional arguments, and calls `onSubmit(text)` on Enter/Send.
 * It NEVER calls chat.send / navigate / recordSkillLaunch itself — that is
 * the caller's job (Chat.tsx, after navigation, per D-06). Escape or an
 * outside-click closes the popover with zero side effects (D-05): nothing
 * fires unless the user explicitly presses Enter or clicks Send.
 *
 * Shell copied from src/components/kg/KGViewsPopover.tsx's `w-72 p-4`
 * PopoverContent (the UI-SPEC's named literal shape source), with the
 * Enter/Escape key handling shape mirrored from that same file's
 * `handleSaveKeyDown`.
 *
 * Note: focus/cursor placement is done from a *callback ref* rather than a
 * `useEffect` keyed on `open` — Radix's PopoverContent only actually mounts
 * its children a render pass after `open` first flips true (it settles its
 * own internal controllable state first), so an effect on the outer `open`
 * prop can fire before the <input> exists in the DOM. A callback ref fires
 * exactly when the real DOM node appears, regardless of which commit that is.
 */
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Radix's PopoverAnchor `virtualRef` prop expects `React.RefObject<Measurable>`
// (from the internal @radix-ui/rect package, not a direct dependency here).
// Our public prop type (fixed by this plan's interface contract) is
// `React.RefObject<HTMLElement | null>` — structurally a superset of what
// Radix needs (any HTMLElement has getBoundingClientRect()), but TS can't
// bridge the two RefObject<T> generics in one step because of the `null`
// member, so we go through `unknown` for this narrow, well-understood case.
interface Measurable {
  getBoundingClientRect(): DOMRect;
}

export interface RunChatPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** skill.displayName — used in the "Run {displayName}" title. */
  displayName: string;
  /** Prefill text incl. trailing space, e.g. "/gsd-plan-phase " (built by the caller via skillInvocation). */
  invocation: string;
  /** Caller navigates + Chat.tsx sends/records; this popover does NOT send/record. */
  onSubmit: (text: string) => void;
  /** Radix PopoverAnchor target — positions the popover next to the Run trigger. */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function RunChatPopover({
  open,
  onOpenChange,
  displayName,
  invocation,
  onSubmit,
  anchorRef,
}: RunChatPopoverProps) {
  const fallbackAnchorRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(invocation);

  // Re-prefill every time the popover opens (D-04) — reopening always
  // re-seeds the invocation, discarding any prior in-progress edit.
  useEffect(() => {
    if (open) {
      setValue(invocation);
    }
  }, [open, invocation]);

  // Place the cursor at the end (after the trailing space) — never
  // auto-select the prefilled text (UI-SPEC: "never auto-selected"). Runs
  // from the callback ref itself (see file header note) so it always fires
  // on the commit that actually inserts the <input> into the DOM.
  const attachInputRef = (el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };

  const canSubmit = value.trim().length > 0;

  const handleSubmit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      // D-05: Escape discards with zero side effects — never call onSubmit.
      onOpenChange(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor
        virtualRef={
          (anchorRef ?? fallbackAnchorRef) as unknown as React.RefObject<Measurable>
        }
      />
      <PopoverContent className="w-72 p-4" side="bottom" align="end">
        <p className="text-lg font-semibold mb-2">Run {displayName}</p>
        <Input
          ref={attachInputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="font-mono text-sm"
          aria-label={`Run ${displayName} invocation`}
        />
        <p className="text-sm text-muted-foreground mt-2 mb-3">
          Press Enter to send, or add arguments first.
        </p>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          Send
        </Button>
      </PopoverContent>
    </Popover>
  );
}
