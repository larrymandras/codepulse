import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  fetchLayout,
  createLayout,
  updateLayout,
  deleteLayout,
} from "@/lib/astridrApi";
import type { EmailLayout, LayoutCreate } from "@/lib/astridrApi";
import { AssetDropzone } from "@/components/email/AssetDropzone";
import { AssetPicker } from "@/components/email/AssetPicker";

interface LayoutSheetProps {
  layoutSlug: string | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  html_header: string;
  html_footer: string;
  css: string;
  logo_storage_path: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  html_header: "",
  html_footer: "",
  css: "",
  logo_storage_path: "",
};

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const SLOT_DOCS = [
  "{{{content}}}",
  "{{{logo_url}}}",
  "{{{avatar_url}}}",
  "{{{signature_name}}}",
  "{{{signature_title}}}",
];

function SlotHelpPanel() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-2 rounded border border-border/40 bg-muted/20">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Available template slots</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1 px-3 pb-3">
          {SLOT_DOCS.map((slot) => (
            <code
              key={slot}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
            >
              {slot}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

export function LayoutSheet({
  layoutSlug,
  mode,
  open,
  onOpenChange,
  onSaved,
}: LayoutSheetProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [original, setOriginal] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(original);

  // Reset state when sheet closes or mode changes
  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM);
      setOriginal(DEFAULT_FORM);
      setError(null);
      setSaveError(null);
      setSlugEdited(false);
      return;
    }

    if (mode === "create") {
      setForm(DEFAULT_FORM);
      setOriginal(DEFAULT_FORM);
      setError(null);
      setSaveError(null);
      setSlugEdited(false);
      return;
    }

    // Edit mode: fetch existing layout
    if (!layoutSlug) return;
    setLoading(true);
    setError(null);
    fetchLayout(layoutSlug)
      .then((data: EmailLayout) => {
        const loaded: FormState = {
          name: data.name ?? "",
          slug: data.slug ?? "",
          description: data.description ?? "",
          html_header: data.html_header ?? "",
          html_footer: data.html_footer ?? "",
          css: data.css ?? "",
          logo_storage_path: data.logo_storage_path ?? "",
        };
        setForm(loaded);
        setOriginal(loaded);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load layout",
        );
      })
      .finally(() => setLoading(false));
  }, [open, mode, layoutSlug]);

  const setField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (value: string) => {
    setField("name", value);
    if (!slugEdited) {
      setField("slug", deriveSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugEdited(true);
    setField("slug", value);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body: LayoutCreate = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        html_header: form.html_header,
        html_footer: form.html_footer,
        css: form.css,
        logo_storage_path: form.logo_storage_path || undefined,
      };

      if (mode === "create") {
        await createLayout(body);
        toast.success("Layout saved");
      } else if (layoutSlug) {
        await updateLayout(layoutSlug, body);
        toast.success("Layout saved");
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setSaveError("Failed to save layout. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLayout(form.slug);
      toast.success("Layout deleted");
      setShowDeleteConfirm(false);
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete layout");
    } finally {
      setDeleting(false);
    }
  };

  const retry = () => {
    if (!layoutSlug) return;
    setLoading(true);
    setError(null);
    fetchLayout(layoutSlug)
      .then((data: EmailLayout) => {
        const loaded: FormState = {
          name: data.name ?? "",
          slug: data.slug ?? "",
          description: data.description ?? "",
          html_header: data.html_header ?? "",
          html_footer: data.html_footer ?? "",
          css: data.css ?? "",
          logo_storage_path: data.logo_storage_path ?? "",
        };
        setForm(loaded);
        setOriginal(loaded);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load layout",
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-[640px] sm:max-w-[640px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New Layout" : "Edit Layout"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Loading skeleton (edit mode) */}
            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-[320px] w-full" />
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={retry}>
                  Retry
                </Button>
              </div>
            )}

            {/* Form content */}
            {!loading && !error && (
              <Tabs defaultValue="header">
                <TabsList className="w-full">
                  <TabsTrigger
                    value="header"
                    className="text-xs py-1 flex-1"
                  >
                    Header
                  </TabsTrigger>
                  <TabsTrigger
                    value="footer"
                    className="text-xs py-1 flex-1"
                  >
                    Footer
                  </TabsTrigger>
                  <TabsTrigger
                    value="css"
                    className="text-xs py-1 flex-1"
                  >
                    CSS
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="text-xs py-1 flex-1"
                  >
                    Settings
                  </TabsTrigger>
                </TabsList>

                {/* Header tab */}
                <TabsContent value="header" className="space-y-2 pt-3">
                  <SlotHelpPanel />
                  <div className="h-80 rounded-md border border-border overflow-hidden">
                    <Editor
                      theme="vs-dark"
                      language="html"
                      value={form.html_header}
                      onChange={(v) => setField("html_header", v ?? "")}
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
                </TabsContent>

                {/* Footer tab */}
                <TabsContent value="footer" className="space-y-2 pt-3">
                  <SlotHelpPanel />
                  <div className="h-80 rounded-md border border-border overflow-hidden">
                    <Editor
                      theme="vs-dark"
                      language="html"
                      value={form.html_footer}
                      onChange={(v) => setField("html_footer", v ?? "")}
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
                </TabsContent>

                {/* CSS tab */}
                <TabsContent value="css" className="space-y-2 pt-3">
                  <div className="h-80 rounded-md border border-border overflow-hidden">
                    <Editor
                      theme="vs-dark"
                      language="css"
                      value={form.css}
                      onChange={(v) => setField("css", v ?? "")}
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
                </TabsContent>

                {/* Settings tab */}
                <TabsContent value="settings" className="space-y-4 pt-3">
                  <div className="space-y-2">
                    <Label htmlFor="layout-name">Name</Label>
                    <Input
                      id="layout-name"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="My Layout"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="layout-slug">Slug</Label>
                    <Input
                      id="layout-slug"
                      value={form.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="my-layout"
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="layout-description">Description</Label>
                    <Textarea
                      id="layout-description"
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <AssetDropzone
                      folder="logos"
                      currentUrl={
                        form.logo_storage_path
                          ? form.logo_storage_path.startsWith("http")
                            ? form.logo_storage_path
                            : `${import.meta.env.VITE_ASTRIDR_API_URL ?? ""}/api/email-assets/public/${form.logo_storage_path}`
                          : undefined
                      }
                      onUploaded={(asset) =>
                        setField("logo_storage_path", asset.storage_path)
                      }
                      onPickerOpen={() => setAssetPickerOpen(true)}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* Save button */}
            {!loading && !error && (
              <div className="space-y-2 pt-4 border-t border-border">
                <Button
                  onClick={() => void handleSave()}
                  disabled={!isDirty || !form.name.trim() || saving}
                  className="w-full"
                >
                  {saving ? "Saving..." : "Save Layout"}
                </Button>
                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}
              </div>
            )}

            {/* Delete button (edit mode only) */}
            {mode === "edit" && !loading && !error && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Layout
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the layout and cannot be undone.
              Templates using this layout may stop rendering correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Asset picker for logo selection */}
      <AssetPicker
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        folder="logos"
        onSelect={(asset) => {
          setField("logo_storage_path", asset.storage_path);
          setAssetPickerOpen(false);
        }}
      />
    </>
  );
}

export default LayoutSheet;
