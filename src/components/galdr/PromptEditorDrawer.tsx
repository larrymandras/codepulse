/**
 * PromptEditorDrawer — create/edit a prompt, preview it, and browse its versions.
 *
 * Phase 116 (Galdr Prompt Library), plan 116-06 Task 3.
 *
 * This component owns no Convex hooks. The page (plan 116-08) wires the
 * mutations and passes them down, which keeps the drawer renderable — and
 * reviewable — in isolation.
 *
 * The slug preview and the variable chips both come from the SAME functions the
 * server uses (`slugify`, `detectVariables`), so the preview cannot disagree with
 * what actually gets saved. That is the whole point of those two modules living
 * under `convex/` rather than `src/lib/`.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { detectVariables, substituteVariables } from "../../../convex/galdrVariables";
import { slugify } from "../../../convex/galdrSlug";
import { splitPreview } from "./previewSegments";
import { relativeTime } from "@/lib/formatters";

export interface EditablePrompt {
  _id: string;
  title: string;
  slug: string;
  body: string;
  category: string;
}

export interface PromptVersionLike {
  _id: string;
  savedAt: number;
}

export interface PromptEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null puts the drawer in create mode. */
  prompt: EditablePrompt | null;
  /** undefined while the versions query is still loading. */
  versions: PromptVersionLike[] | undefined;
  versionsError?: boolean;
  onCreate: (input: {
    title: string;
    body: string;
    category: string;
  }) => void | Promise<void>;
  onUpdate: (input: {
    promptId: string;
    title: string;
    body: string;
    category: string;
  }) => void | Promise<void>;
  onRestore: (input: { promptId: string; versionId: string }) => void | Promise<void>;
  onArchive: (input: { promptId: string }) => void | Promise<void>;
}

/**
 * No Tags input this phase. The schema field exists (design doc §4.1) and stays
 * unused; UI-SPEC leaves it to the planner and it is deferred so the drawer
 * carries only the fields the design doc's own UI paragraph names. Its absence
 * is a decision, not an oversight.
 */

/**
 * Verbatim from 116-UI-SPEC.md § Copywriting Contract. Held as a single-line
 * constant rather than inline JSX text: JSX would wrap it across source lines,
 * so the string would render correctly but no longer exist as a literal anyone
 * (or any acceptance grep) could find in the file.
 */
const ARCHIVE_BODY =
  "Hidden from the grid and from skill lookup. The prompt and its version history are retained — nothing is deleted.";

/** Convex redacts a plain Error's message client-side; only `.data` survives. */
function readCollision(
  err: unknown
): { existingTitle: string; existingUpdatedAt: number } | null {
  const data = (err as { data?: unknown } | null)?.data as
    | { code?: string; existingTitle?: string; existingUpdatedAt?: number }
    | undefined;
  if (!data || data.code !== "SLUG_COLLISION") return null;
  return {
    existingTitle: data.existingTitle ?? "",
    existingUpdatedAt: data.existingUpdatedAt ?? 0,
  };
}

export function PromptEditorDrawer({
  open,
  onOpenChange,
  prompt,
  versions,
  versionsError = false,
  onCreate,
  onUpdate,
  onRestore,
  onArchive,
}: PromptEditorDrawerProps) {
  const isEdit = prompt !== null;

  const [title, setTitle] = useState(prompt?.title ?? "");
  const [category, setCategory] = useState(prompt?.category ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [debouncedBody, setDebouncedBody] = useState(body);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [collision, setCollision] = useState<{
    existingTitle: string;
    existingUpdatedAt: number;
  } | null>(null);

  // Re-seed the draft whenever the drawer is opened on a different prompt.
  useEffect(() => {
    setTitle(prompt?.title ?? "");
    setCategory(prompt?.category ?? "");
    setBody(prompt?.body ?? "");
    setDebouncedBody(prompt?.body ?? "");
    setCollision(null);
  }, [prompt, open]);

  // Debounced so detectVariables + substitute don't re-run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBody(body), 200);
    return () => clearTimeout(t);
  }, [body]);

  const variables = useMemo(
    () => detectVariables(debouncedBody),
    [debouncedBody]
  );
  // Nothing is filled in while editing, so every placeholder stays unresolved
  // and renders tinted — which is exactly the "still a placeholder" signal.
  const previewSegments = useMemo(
    () => splitPreview(substituteVariables(debouncedBody, {})),
    [debouncedBody]
  );

  // In edit mode the slug is IMMUTABLE: render the stored one, never a
  // re-derivation. Renaming does not re-slug, because the slug is the
  // identifier live Claude Code sessions already hold.
  const shownSlug = isEdit ? prompt.slug : slugify(title);

  const handleSave = async () => {
    setCollision(null);
    try {
      if (isEdit) {
        await onUpdate({ promptId: prompt._id, title, body, category });
      } else {
        await onCreate({ title, body, category });
      }
      onOpenChange(false);
    } catch (err) {
      const hit = readCollision(err);
      if (hit) setCollision(hit);
      else throw err;
    }
  };

  const versionCount = versions?.length ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* Wider than IntakeSheet.tsx:40's sm:max-w-xl because this stacks a
            body editor, a preview, and version history. */}
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            {/* No typographic override — inherited primitive chrome. */}
            <SheetTitle>{isEdit ? "Edit Prompt" : "New Prompt"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 px-4 pb-6">
            <div className="space-y-1.5">
              <Label htmlFor="galdr-title">Title</Label>
              <Input
                id="galdr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-muted-foreground font-mono text-xs">
                {isEdit ? `slug (fixed): ${shownSlug}` : `slug: ${shownSlug}`}
              </p>
              {collision && (
                <p className="text-sm" style={{ color: "var(--status-warn)" }}>
                  {`A prompt named "${collision.existingTitle}" already exists (updated ${relativeTime(
                    collision.existingUpdatedAt / 1000
                  )}). Choose a different title, or edit the existing prompt instead.`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="galdr-category">Category</Label>
              <Input
                id="galdr-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="galdr-body">Body</Label>
              <Textarea
                id="galdr-body"
                rows={12}
                value={body}
                className="font-mono min-h-64"
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {variables.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {variables.map((name) => (
                  <span
                    key={name}
                    className="text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-widest uppercase"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            <Collapsible defaultOpen>
              <CollapsibleTrigger className="font-mono text-xs font-bold tracking-widest uppercase">
                Preview
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Plain text only — never raw-HTML injection, never a markdown
                    renderer. The body is agent-authored free text (T-116-09). */}
                <div
                  data-testid="galdr-editor-preview"
                  className="mt-2 max-h-64 overflow-y-auto rounded-md border p-3 font-mono text-sm whitespace-pre-wrap"
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
              </CollapsibleContent>
            </Collapsible>

            <Collapsible>
              <CollapsibleTrigger className="font-mono text-xs font-bold tracking-widest uppercase">
                {`Version history (${versionCount})`}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {versionsError ? (
                    <p className="text-muted-foreground text-sm">
                      Couldn't load version history.
                    </p>
                  ) : versions === undefined ? (
                    <>
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </>
                  ) : versions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No earlier versions yet.
                    </p>
                  ) : (
                    versions.map((version) => (
                      <div
                        key={version._id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="font-mono text-xs">
                          {new Date(version.savedAt).toLocaleString()}
                        </span>
                        {/* No confirm dialog: D-15 makes restore append-only,
                            so nothing is lost. */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            isEdit &&
                            void onRestore({
                              promptId: prompt._id,
                              versionId: version._id,
                            })
                          }
                        >
                          Restore
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <SheetFooter className="flex-row items-center justify-between">
            {isEdit ? (
              <Button
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
              >
                Archive
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void handleSave()}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* A plain two-button AlertDialog. The skills-side type-to-confirm
          pattern is deliberately NOT used here: it is reserved for the
          irreversible hard delete D-16 does not build. */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Archive "${title}"?`}</AlertDialogTitle>
            <AlertDialogDescription>{ARCHIVE_BODY}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isEdit) void onArchive({ promptId: prompt._id });
                onOpenChange(false);
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
