/**
 * FillVariablesDialog — the single gate both Copy and Send-to-Chat pass through.
 *
 * Phase 116 (Galdr Prompt Library), plan 116-06 Task 1, implementing D-11 and the
 * resolution half of D-12.
 *
 * Why this is one component rather than two: `Chat.tsx`'s autoSend handoff fires
 * immediately on arrival behind a `firedRef` guard, with no confirmation step on
 * the Chat side — so an unresolved body handed to it is answered by Ástríðr before
 * anyone can correct it. Resolution therefore has to be a BLOCKING step on the
 * Galdr side, and the Copy path is gated by the same rule so the two cannot drift.
 *
 * This component owns no side effects. It does not write to the clipboard and does
 * not navigate; it hands the caller a resolved string and closes. That keeps it
 * testable without a router or the Clipboard API, and keeps the StrictMode
 * double-invoke hazard (a navigate or a clipboard write fired twice) out of it
 * entirely — there is no side effect here to double.
 */
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  detectVariables,
  substituteVariables,
  unresolvedVariables,
} from "../../../convex/galdrVariables";
import { splitPreview } from "./previewSegments";

export interface FillVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptTitle: string;
  body: string;
  mode: "copy" | "chat";
  /** Receives the fully substituted body. The caller owns copy/navigate. */
  onSubmit: (resolvedBody: string) => void;
}

/** Copy verbatim from 116-UI-SPEC.md § Copywriting Contract. */
const HELPER_TEXT: Record<FillVariablesDialogProps["mode"], string> = {
  copy: "Fill in every variable to enable Copy.",
  chat: "Fill in every variable to enable Send.",
};

const ACTION_LABEL: Record<FillVariablesDialogProps["mode"], string> = {
  copy: "Copy",
  chat: "Send to Chat",
};

export function FillVariablesDialog({
  open,
  onOpenChange,
  promptTitle,
  body,
  mode,
  onSubmit,
}: FillVariablesDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const names = useMemo(() => detectVariables(body), [body]);
  const unresolved = useMemo(
    () => unresolvedVariables(body, values),
    [body, values]
  );
  const resolved = useMemo(
    () => substituteVariables(body, values),
    [body, values]
  );
  const previewSegments = useMemo(() => splitPreview(resolved), [resolved]);

  const blocked = unresolved.length > 0;

  const handleSubmit = () => {
    if (blocked) return;
    // Called from an event handler, never from inside a state updater — a
    // StrictMode-doubled updater would fire the caller's clipboard write or
    // navigate twice.
    onSubmit(resolved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No typographic override on DialogTitle: its font-semibold default is
          inherited primitive chrome that UI-SPEC deliberately excludes from
          Galdr's authored type scale. */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{`Fill in variables — ${promptTitle}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {names.map((name) => {
            const fieldId = `galdr-var-${name}`;
            return (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={fieldId} className="font-mono text-xs">
                  {name}
                </Label>
                <Input
                  id={fieldId}
                  value={values[name] ?? ""}
                  placeholder={name}
                  className="font-mono"
                  onChange={(e) => {
                    const next = e.target.value;
                    setValues((prev) => ({ ...prev, [name]: next }));
                  }}
                />
              </div>
            );
          })}

          {/* Plain text only. The body is agent-authored free text; rendering it
              as HTML would be a stored-XSS surface for zero benefit. */}
          <div
            data-testid="galdr-variable-preview"
            className="max-h-48 overflow-y-auto rounded-md border p-3 font-mono text-sm whitespace-pre-wrap"
          >
            {previewSegments.map((segment, i) =>
              segment.unresolved ? (
                <span key={i} style={{ color: "var(--status-warn)" }}>
                  {segment.text}
                </span>
              ) : (
                <span key={i}>{segment.text}</span>
              )
            )}
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={blocked}
              onClick={handleSubmit}
              style={blocked ? { color: "var(--muted-foreground)" } : undefined}
            >
              {ACTION_LABEL[mode]}
            </Button>
          </div>
          {blocked && (
            <p className="text-muted-foreground text-right text-sm">
              {HELPER_TEXT[mode]}
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
