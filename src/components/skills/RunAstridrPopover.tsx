/**
 * RunAstridrPopover — deliberate pre-send capture for the Ástríðr Run target
 * (Phase 99 Plan 03, LAUNCH-03, D-07/D-08/D-09/D-14a).
 *
 * Same pure, controlled shell as RunChatPopover (prefill + optional args,
 * calls onSubmit on Enter/Send, Escape/close is a zero-side-effect no-op —
 * D-05), plus a persona picker stacked above the input (D-07). The persona
 * list is imported verbatim from src/lib/profiles.ts — no second copy (D-08).
 *
 * Honesty guard (D-09/D-14a, hard rule): this component's copy NEVER claims
 * "answered as {persona}" — `profile` only scopes SecurityContext.profile_id
 * server-side, it is not a persona-voice switch. Copy stays "Send", matching
 * RunChatPopover exactly; the segmented control's own labels are the only
 * persona wording anywhere in this file.
 */
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROFILES, type ProfileId } from "@/lib/profiles";

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

export interface RunAstridrPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
  invocation: string;
  onSubmit: (text: string, profile: ProfileId) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Defaults to "personal" when not provided. */
  defaultProfile?: ProfileId;
}

/** Quiet segmented control — mirrors Reminders.tsx's ProfileSwitch active-state
 * styling convention (accent color + boxShadow glow on the active segment). */
function PersonaSwitch({
  value,
  onChange,
}: {
  value: ProfileId;
  onChange: (id: ProfileId) => void;
}) {
  return (
    <div
      className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5"
      role="tablist"
      aria-label="Answer as"
    >
      {PROFILES.map((p) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md transition-all duration-300 ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              active
                ? {
                    color: `var(${p.accentVar})`,
                    boxShadow: `0 0 8px oklch(from var(${p.accentVar}) l c h / 0.35)`,
                  }
                : undefined
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: `var(${p.accentVar})` }}
              aria-hidden="true"
            />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function RunAstridrPopover({
  open,
  onOpenChange,
  displayName,
  invocation,
  onSubmit,
  anchorRef,
  defaultProfile,
}: RunAstridrPopoverProps) {
  const fallbackAnchorRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(invocation);
  const [profile, setProfile] = useState<ProfileId>(defaultProfile ?? "personal");

  // Re-prefill + reset the persona pick every time the popover opens (D-04/D-07).
  useEffect(() => {
    if (open) {
      setValue(invocation);
      setProfile(defaultProfile ?? "personal");
    }
  }, [open, invocation, defaultProfile]);

  // Cursor at end, never auto-selected — same callback-ref convention as
  // RunChatPopover (see that file's header note: Radix's PopoverContent only
  // mounts its children a render pass after `open` first flips true, so an
  // effect keyed on the outer `open` prop can fire before the <input> exists).
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
    onSubmit(text, profile);
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

        <p className="text-sm text-muted-foreground mb-1">Answer as</p>
        <PersonaSwitch value={profile} onChange={setProfile} />

        <Input
          ref={attachInputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="font-mono text-sm mt-3"
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
