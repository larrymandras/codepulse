/**
 * RunTargetChooser — Run target dispatch (Phase 99 Plan 04, LAUNCH-04, D-01).
 *
 * `useRunLaunch(skill)` is the shared dispatch hook: it owns the per-instance
 * popover open state for Chat/Ástríðr, builds the invocation text once via
 * `skillInvocation`, and branches by target — Chat/Ástríðr navigate to /chat
 * with an AutoSendHandoff (Plan 01/02/03), Forge opens the shared
 * SkillLaunchProvider modal (Plan 04 Task 1). `RunTargetItems` is the
 * presentational 3-row list (usable inside any DropdownMenuContent or
 * DropdownMenuSubContent — e.g. nested under SkillLifecycleMenu's own ⋯ menu,
 * Plan 05). `RunTargetChooser` is the standalone dropdown for QuickDeck: the
 * chip itself is the trigger.
 *
 * DropdownMenu shell copied from SkillLifecycleMenu.tsx's ⋯ menu construction
 * (same primitive, same onCloseAutoFocus gotcha — opening a Popover from a
 * DropdownMenuItem's onSelect fights Radix's own close-autofocus return).
 */
import { useRef, useState, isValidElement, cloneElement, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MessageSquare, Bot, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { skillInvocation, type SkillLike } from "@/lib/skills";
import type { ProfileId } from "@/lib/profiles";
import type { RunTarget } from "@/lib/skillRun";
import { useSkillLaunch } from "./SkillLaunchProvider";
import RunChatPopover from "./RunChatPopover";
import RunAstridrPopover from "./RunAstridrPopover";

/** The minimal skill shape every Run trigger needs: registry name + display label. */
export type DeckSkillLike = SkillLike & {
  name: string;
  displayName: string;
};

const TARGET_ITEMS: ReadonlyArray<{
  target: RunTarget;
  icon: typeof MessageSquare;
  label: string;
}> = [
  { target: "chat", icon: MessageSquare, label: "Send to Chat" },
  { target: "forge", icon: Bot, label: "Launch as Forge Agent" },
  { target: "astridr", icon: Sparkles, label: "Dispatch to Ástríðr" },
];

export interface UseRunLaunchResult {
  /** setLastTarget + branch: chat/astridr open their popover, forge opens the shared modal. */
  pick: (t: RunTarget) => void;
  chatOpen: boolean;
  setChatOpen: (o: boolean) => void;
  astridrOpen: boolean;
  setAstridrOpen: (o: boolean) => void;
  /** skillInvocation(skill) + " " — the prefill both popovers share. */
  invocation: string;
  /** Navigates to /chat with an AutoSendHandoff (no profile key). */
  submitChat: (text: string) => void;
  /** Navigates to /chat with an AutoSendHandoff including profile. */
  submitAstridr: (text: string, profile: ProfileId) => void;
  lastTarget: RunTarget;
}

export function useRunLaunch(skill: DeckSkillLike): UseRunLaunchResult {
  const { lastTarget, setLastTarget, launchForge } = useSkillLaunch();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [astridrOpen, setAstridrOpen] = useState(false);
  const invocation = `${skillInvocation(skill)} `;

  const pick = (t: RunTarget) => {
    setLastTarget(t);
    if (t === "chat") {
      setChatOpen(true);
    } else if (t === "astridr") {
      setAstridrOpen(true);
    } else {
      launchForge(skill);
    }
  };

  const submitChat = (text: string) => {
    setChatOpen(false);
    navigate("/chat", {
      state: { autoSend: { text, skillName: skill.name } },
    });
  };

  const submitAstridr = (text: string, profile: ProfileId) => {
    setAstridrOpen(false);
    navigate("/chat", {
      state: { autoSend: { text, skillName: skill.name, profile } },
    });
  };

  return {
    pick,
    chatOpen,
    setChatOpen,
    astridrOpen,
    setAstridrOpen,
    invocation,
    submitChat,
    submitAstridr,
    lastTarget,
  };
}

/**
 * Presentational 3-row list. The row matching `lastTarget` gets a leading
 * Check icon + `text-primary` tint — visual-only, no extra copy (UI-SPEC:
 * "no extra text label — avoid a redundant '(last used)' suffix").
 */
export function RunTargetItems({
  lastTarget,
  onPick,
}: {
  lastTarget: RunTarget;
  onPick: (t: RunTarget) => void;
}) {
  return (
    <>
      {TARGET_ITEMS.map(({ target, icon: Icon, label }) => {
        const isLast = target === lastTarget;
        return (
          <DropdownMenuItem
            key={target}
            data-testid={`run-target-item-${target}`}
            className={isLast ? "text-primary" : undefined}
            onSelect={(e) => {
              e.preventDefault();
              onPick(target);
            }}
          >
            {isLast && (
              <Check
                data-testid="run-target-check"
                className="text-primary"
              />
            )}
            <Icon className={isLast ? "text-primary" : undefined} />
            {label}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/** Standalone dropdown for QuickDeck: the chip (children) is the trigger. */
export function RunTargetChooser({
  skill,
  children,
}: {
  skill: DeckSkillLike;
  children: ReactNode;
}) {
  const {
    pick,
    chatOpen,
    setChatOpen,
    astridrOpen,
    setAstridrOpen,
    invocation,
    submitChat,
    submitAstridr,
    lastTarget,
  } = useRunLaunch(skill);

  // Anchor the follow-up popovers to the same DOM node as the dropdown
  // trigger. DropdownMenuTrigger's `asChild` (Radix Slot) composes any ref
  // already present on the cloned child with its own — so cloning `children`
  // with `ref={anchorRef}` here does not fight Radix's own trigger ref.
  const anchorRef = useRef<HTMLElement | null>(null);
  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ ref?: React.Ref<HTMLElement> }>, {
        ref: anchorRef,
      })
    : children;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <RunTargetItems lastTarget={lastTarget} onPick={pick} />
        </DropdownMenuContent>
      </DropdownMenu>

      <RunChatPopover
        open={chatOpen}
        onOpenChange={setChatOpen}
        displayName={skill.displayName}
        invocation={invocation}
        onSubmit={submitChat}
        anchorRef={anchorRef}
      />
      <RunAstridrPopover
        open={astridrOpen}
        onOpenChange={setAstridrOpen}
        displayName={skill.displayName}
        invocation={invocation}
        onSubmit={submitAstridr}
        anchorRef={anchorRef}
      />
    </>
  );
}
