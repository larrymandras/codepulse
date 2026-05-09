import { useState, useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type EmailLayout,
} from "@/lib/astridrApi";
import {
  variableSchemaToRows,
  rowsToVariableSchema,
  type VariableRow,
} from "@/lib/emailTemplateUtils";
import { VariableSchemaTable } from "@/components/email/VariableSchemaTable";
import { VariableChipsToolbar } from "@/components/email/VariableChipsToolbar";
import { EmailPreviewPane } from "@/components/email/EmailPreviewPane";

interface TemplateSheetProps {
  templateSlug: string | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  layouts: EmailLayout[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TemplateSheet({
  templateSlug,
  mode,
  open,
  onOpenChange,
  onSaved,
  layouts,
}: TemplateSheetProps) {
  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState("");
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);

  // Original state for dirty tracking
  const [originalState, setOriginalState] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugDerivedFromName, setSlugDerivedFromName] = useState(true);

  // Monaco editor ref for insert-at-cursor
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const insertAtCursor = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    editor.executeEdits("variable-insert", [
      {
        range: selection ?? {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
        text,
        forceMoveMarkers: true,
      },
    ]);
    editor.focus();
  };

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setPurpose("");
      setCategory("");
      setLayoutId(null);
      setSubjectTemplate("");
      setHtmlBody("");
      setTextBody("");
      setVariableRows([]);
      setOriginalState("");
      setLoadError(null);
      setSaveError(null);
      setSlugDerivedFromName(true);
    }
  }, [open]);

  // Load template in edit mode
  useEffect(() => {
    if (!open || mode !== "edit" || !templateSlug) return;

    setLoading(true);
    setLoadError(null);
    fetchTemplate(templateSlug)
      .then((template) => {
        setName(template.name);
        setSlug(template.slug);
        setPurpose(template.purpose);
        setCategory(template.category);
        setLayoutId(template.layout_id);
        setSubjectTemplate(template.subject_template);
        setHtmlBody(template.html_body);
        setTextBody(template.text_body);
        const rows = variableSchemaToRows(template.variables);
        setVariableRows(rows);
        // Capture original state for dirty tracking
        const orig = JSON.stringify({
          name: template.name,
          slug: template.slug,
          purpose: template.purpose,
          category: template.category,
          layoutId: template.layout_id,
          subjectTemplate: template.subject_template,
          htmlBody: template.html_body,
          textBody: template.text_body,
          variableRows: rows,
        });
        setOriginalState(orig);
        setSlugDerivedFromName(false);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Failed to load template",
        ),
      )
      .finally(() => setLoading(false));
  }, [open, mode, templateSlug]);

  // Auto-derive slug from name in create mode
  const handleNameChange = (value: string) => {
    setName(value);
    if (mode === "create" && slugDerivedFromName) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugDerivedFromName(false);
  };

  // Dirty tracking
  const currentState = JSON.stringify({
    name,
    slug,
    purpose,
    category,
    layoutId,
    subjectTemplate,
    htmlBody,
    textBody,
    variableRows,
  });
  const isDirty =
    mode === "create"
      ? name.trim() !== "" ||
        htmlBody.trim() !== "" ||
        subjectTemplate.trim() !== ""
      : currentState !== originalState;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const variables = rowsToVariableSchema(variableRows);
      if (mode === "create") {
        await createTemplate({
          name,
          slug,
          purpose,
          category,
          layout_id: layoutId,
          subject_template: subjectTemplate,
          html_body: htmlBody,
          text_body: textBody,
          variables,
        });
        toast.success("Template saved");
      } else if (templateSlug) {
        await updateTemplate(templateSlug, {
          name,
          slug,
          purpose,
          category,
          layout_id: layoutId,
          subject_template: subjectTemplate,
          html_body: htmlBody,
          text_body: textBody,
          variables,
        });
        toast.success("Template saved");
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setSaveError(
        "Something went wrong. Try again or check your connection.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateSlug) return;
    setDeleting(true);
    try {
      await deleteTemplate(templateSlug);
      toast.success("Template deleted");
      setShowDeleteConfirm(false);
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[1100px] sm:max-w-5xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New Template" : "Edit Template"}
            </SheetTitle>
          </SheetHeader>

          {/* Loading state */}
          {loading && (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-[320px] w-full" />
            </div>
          )}

          {/* Load error */}
          {loadError && (
            <div className="mt-6">
              <p className="text-sm text-destructive">{loadError}</p>
            </div>
          )}

          {/* Main content */}
          {!loading && !loadError && (
            <div
              className="flex gap-6 mt-6"
              style={{ minHeight: "calc(100vh - 120px)" }}
            >
              {/* Left panel — editor fields (50%) */}
              <div className="flex-1 space-y-4 overflow-y-auto">
                {/* Name */}
                <div className="space-y-1">
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Template name"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1">
                  <Label htmlFor="template-slug">Slug</Label>
                  <Input
                    id="template-slug"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="template-slug"
                    className="font-mono text-sm"
                  />
                </div>

                {/* Purpose */}
                <div className="space-y-1">
                  <Label htmlFor="template-purpose">Purpose</Label>
                  <Input
                    id="template-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g., Welcome email for new users"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <Label htmlFor="template-category">Category</Label>
                  <Input
                    id="template-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., transactional, marketing"
                  />
                </div>

                {/* Layout selector */}
                <div className="space-y-1">
                  <Label htmlFor="template-layout">Layout</Label>
                  <Select
                    value={layoutId ?? "none"}
                    onValueChange={(v) =>
                      setLayoutId(v === "none" ? null : v)
                    }
                  >
                    <SelectTrigger id="template-layout">
                      <SelectValue placeholder="Select layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {layouts.map((layout) => (
                        <SelectItem key={layout.id} value={layout.id}>
                          {layout.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div className="space-y-1">
                  <Label htmlFor="template-subject">Subject</Label>
                  <Input
                    id="template-subject"
                    value={subjectTemplate}
                    onChange={(e) => setSubjectTemplate(e.target.value)}
                    placeholder="Subject line (supports {{variables}})"
                  />
                </div>

                {/* HTML Body — chips toolbar + Monaco */}
                <div className="space-y-0">
                  <Label className="mb-1 block">HTML Body</Label>
                  {variableRows.some((v) => v.name.trim()) && (
                    <VariableChipsToolbar
                      variables={variableRows}
                      onInsert={insertAtCursor}
                    />
                  )}
                  <div
                    className={`border border-border overflow-hidden ${
                      variableRows.some((v) => v.name.trim())
                        ? "border-t-0"
                        : ""
                    }`}
                    style={{ height: "320px" }}
                  >
                    <Editor
                      theme="vs-dark"
                      language="html"
                      value={htmlBody}
                      onChange={(v) => setHtmlBody(v ?? "")}
                      onMount={handleMount}
                      options={{
                        minimap: { enabled: false },
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        lineHeight: 20,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                      loading={<Skeleton className="h-full w-full" />}
                    />
                  </div>
                </div>

                {/* Text body — Monaco */}
                <div className="space-y-1">
                  <Label>Text Body (fallback)</Label>
                  <div
                    className="border border-border overflow-hidden"
                    style={{ height: "160px" }}
                  >
                    <Editor
                      theme="vs-dark"
                      language="plaintext"
                      value={textBody}
                      onChange={(v) => setTextBody(v ?? "")}
                      options={{
                        minimap: { enabled: false },
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        lineHeight: 20,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                      loading={<Skeleton className="h-full w-full" />}
                    />
                  </div>
                </div>

                {/* Variable schema table */}
                <VariableSchemaTable
                  rows={variableRows}
                  onChange={setVariableRows}
                />

                {/* Save / Delete buttons */}
                <div className="space-y-2 pt-2 pb-6">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => void handleSave()}
                      disabled={!isDirty || !name.trim() || saving}
                      className="bg-primary text-primary-foreground"
                    >
                      {saving && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      {saving ? "Saving…" : "Save Template"}
                    </Button>
                    {mode === "edit" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                  {saveError && (
                    <p className="text-sm text-destructive">{saveError}</p>
                  )}
                </div>
              </div>

              {/* Right panel — preview (50%) */}
              <div className="w-[400px] shrink-0 flex flex-col">
                <EmailPreviewPane
                  slug={templateSlug ?? ""}
                  html={htmlBody}
                  subject={subjectTemplate}
                  variables={rowsToVariableSchema(variableRows)}
                  disabled={mode === "create"}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TemplateSheet;
