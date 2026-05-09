import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";
import { upsertAgentEmailDefaults } from "@/lib/astridrApi";
import type { AgentEmailDefaults, EmailLayout } from "@/lib/astridrApi";
import { AssetDropzone } from "@/components/email/AssetDropzone";
import { AssetPicker } from "@/components/email/AssetPicker";

interface AgentDefaultSheetProps {
  agentId: string | null;
  agentName: string;
  existingDefaults: AgentEmailDefaults | null;
  layouts: EmailLayout[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface FormState {
  signature_name: string;
  signature_title: string;
  avatar_storage_path: string;
  default_layout_id: string | null;
}

function buildInitialForm(existingDefaults: AgentEmailDefaults | null): FormState {
  return {
    signature_name: existingDefaults?.signature_name ?? "",
    signature_title: existingDefaults?.signature_title ?? "",
    avatar_storage_path: existingDefaults?.avatar_storage_path ?? "",
    default_layout_id: existingDefaults?.default_layout_id ?? null,
  };
}

export function AgentDefaultSheet({
  agentId,
  agentName,
  existingDefaults,
  layouts,
  open,
  onOpenChange,
  onSaved,
}: AgentDefaultSheetProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(existingDefaults));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Re-populate form whenever the sheet opens with new agent data
  useEffect(() => {
    if (open) {
      setForm(buildInitialForm(existingDefaults));
      setSaveError(null);
    }
  }, [open, existingDefaults]);

  const handleSave = async () => {
    if (!agentId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await upsertAgentEmailDefaults(agentId, {
        signature_name: form.signature_name,
        signature_title: form.signature_title,
        avatar_storage_path: form.avatar_storage_path,
        default_layout_id: form.default_layout_id,
      });
      toast.success("Agent settings saved");
      onSaved();
      onOpenChange(false);
    } catch {
      // T-02-14: never expose raw API error details
      setSaveError("Failed to save settings. Try again or check your connection.");
    } finally {
      setSaving(false);
    }
  };

  // Derive a public URL from the storage path, or fall through if it already
  // looks like a URL (starts with http).
  const avatarPublicUrl = form.avatar_storage_path.startsWith("http")
    ? form.avatar_storage_path
    : form.avatar_storage_path
      ? `${import.meta.env.VITE_ASTRIDR_API_URL ?? ""}/api/email-assets/public/${form.avatar_storage_path}`
      : undefined;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[480px] sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Agent Email Settings</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Agent name — display only */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Agent</p>
              <p className="text-lg font-semibold">{agentName}</p>
            </div>

            {/* Signature Name */}
            <div className="space-y-1.5">
              <Label htmlFor="signature_name">Signature Name</Label>
              <Input
                id="signature_name"
                value={form.signature_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signature_name: e.target.value }))
                }
                placeholder="e.g. Ástríðr"
              />
            </div>

            {/* Signature Title */}
            <div className="space-y-1.5">
              <Label htmlFor="signature_title">Signature Title</Label>
              <Input
                id="signature_title"
                value={form.signature_title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signature_title: e.target.value }))
                }
                placeholder="e.g. AI Assistant"
              />
            </div>

            {/* Default Layout */}
            <div className="space-y-1.5">
              <Label>Default Layout</Label>
              <Select
                value={form.default_layout_id ?? "__none__"}
                onValueChange={(val) =>
                  setForm((f) => ({
                    ...f,
                    default_layout_id: val === "__none__" ? null : val,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {layouts.map((layout) => (
                    <SelectItem key={layout.id} value={layout.id}>
                      {layout.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Avatar */}
            <div className="space-y-1.5">
              <Label>Avatar</Label>
              <AssetDropzone
                folder="avatars"
                currentUrl={avatarPublicUrl}
                onUploaded={(asset) => {
                  setForm((f) => ({
                    ...f,
                    avatar_storage_path: asset.storage_path,
                  }));
                }}
                onPickerOpen={() => setPickerOpen(true)}
              />
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            {/* Save */}
            <Button
              className="w-full"
              onClick={() => void handleSave()}
              disabled={saving || !agentId}
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Avatar picker dialog (outside Sheet to avoid z-index stacking) */}
      <AssetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        folder="avatars"
        onSelect={(asset) => {
          setForm((f) => ({
            ...f,
            avatar_storage_path: asset.storage_path,
          }));
          setPickerOpen(false);
        }}
      />
    </>
  );
}

export default AgentDefaultSheet;
