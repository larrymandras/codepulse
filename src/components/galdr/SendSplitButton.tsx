/**
 * SendSplitButton — Galdr's three delivery targets, one of which is blocking.
 *
 * Phase 116 (Galdr Prompt Library), plan 116-06 Task 2, implementing D-12.
 *
 * Resolution happens on the Galdr side of the handoff, BEFORE `navigate`, never
 * after. Once `navigate("/chat", ...)` runs, `Chat.tsx`'s effect (:544-556) sends
 * the text behind a `firedRef` guard with no confirmation step — there is no
 * "send now, fix later" path, which is why "Send to Chat" routes through
 * FillVariablesDialog rather than firing directly.
 *
 * DropdownMenu shell follows RunTargetChooser.tsx:183-193, including the
 * `onCloseAutoFocus` preventDefault. Per its comment at :14-16, opening an
 * overlay from a DropdownMenuItem's `onSelect` fights Radix's own
 * close-autofocus return — and this component opens a Dialog from exactly that
 * seam, so the line is load-bearing here, not decorative.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Copy, MessageSquare, Terminal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FillVariablesDialog } from "./FillVariablesDialog";

/** The subset of an `api.galdr.list` row this control needs. */
export interface GaldrPromptLike {
  slug: string;
  title: string;
  body: string;
  /** Computed server-side by the same detectVariables — not recomputed here. */
  variables: string[];
}

type GaldrTarget = "chat" | "copy" | "command";

const TARGET_ITEMS: ReadonlyArray<{
  target: GaldrTarget;
  icon: typeof MessageSquare;
  label: string;
}> = [
  { target: "chat", icon: MessageSquare, label: "Send to Chat" },
  { target: "copy", icon: Copy, label: "Copy" },
  { target: "command", icon: Terminal, label: "Copy as command" },
];

/** SkillRow.tsx's exact idle/copied/failed labels and 1.8s timing. */
type CopyState = "idle" | "copied" | "failed";
const COPY_LABEL: Record<CopyState, string> = {
  idle: "Send",
  copied: "Copied",
  failed: "Failed",
};

export function SendSplitButton({
  prompt,
  onUsage,
}: {
  prompt: GaldrPromptLike;
  /** The caller supplies the recordUsage mutation, keeping this Convex-light. */
  onUsage: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const [dialogMode, setDialogMode] = useState<"copy" | "chat" | null>(null);
  const [lastTarget, setLastTarget] = useState<GaldrTarget>("chat");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const flashCopyState = (next: CopyState) => {
    setCopyState(next);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 1800);
  };

  const sendToChat = (text: string) => {
    onUsage(prompt.slug);
    navigate("/chat", {
      state: { autoSend: { text, skillName: `galdr:${prompt.slug}` } },
    });
  };

  const copyBody = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flashCopyState("copied");
    } catch {
      flashCopyState("failed");
    }
    onUsage(prompt.slug);
  };

  const copyAsCommand = async () => {
    try {
      await navigator.clipboard.writeText(`/galdr ${prompt.slug}`);
      flashCopyState("copied");
    } catch {
      flashCopyState("failed");
    }
    // Deliberately NO onUsage here. UI-SPEC's usage semantics exclude it: the
    // eventual `/galdr <slug>` run is what bumps the count. Without this comment
    // a future reader "fixes" the missing bump and double-counts every copy.
  };

  // Every branch below runs from an event handler, never from inside a state
  // updater — StrictMode double-invokes updaters, and a navigate or clipboard
  // write placed there fires twice.
  const pick = (target: GaldrTarget) => {
    setLastTarget(target);
    if (target === "command") {
      void copyAsCommand();
      return;
    }
    // The zero-variable path is the vacuous-truth case of the same rule, not a
    // bypass: unresolvedVariables on a body with no variables is already empty.
    if (prompt.variables.length === 0) {
      if (target === "chat") sendToChat(prompt.body);
      else void copyBody(prompt.body);
      return;
    }
    setDialogMode(target);
  };

  const handleDialogSubmit = (resolvedBody: string) => {
    if (dialogMode === "chat") sendToChat(resolvedBody);
    else void copyBody(resolvedBody);
  };

  return (
    <>
      <div className="flex items-center">
        <Button
          className="rounded-r-none"
          onClick={() => pick(lastTarget)}
        >
          {COPY_LABEL[copyState]}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="rounded-l-none border-l px-2"
              aria-label={`Choose send target for ${prompt.title}`}
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {TARGET_ITEMS.map(({ target, icon: Icon, label }) => (
              <DropdownMenuItem
                key={target}
                data-testid={`galdr-target-item-${target}`}
                onSelect={(e) => {
                  e.preventDefault();
                  pick(target);
                }}
              >
                <Icon />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dialogMode !== null && (
        <FillVariablesDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialogMode(null);
          }}
          promptTitle={prompt.title}
          body={prompt.body}
          mode={dialogMode}
          onSubmit={handleDialogSubmit}
        />
      )}
    </>
  );
}
