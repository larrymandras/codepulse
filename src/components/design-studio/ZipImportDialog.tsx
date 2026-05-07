import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { importClaudeDesign } from "@/lib/openDesignApi";

interface ZipImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export default function ZipImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ZipImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(value: boolean) {
    if (!value) {
      setFile(null);
      setError(null);
    }
    onOpenChange(value);
  }

  async function handleImport() {
    if (!file) return;
    if (!file.name.endsWith(".zip") && file.type !== "application/zip") {
      setError("Please select a ZIP file.");
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await importClaudeDesign(file);
      toast.success("ZIP imported successfully");
      onImportComplete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Claude Design ZIP</DialogTitle>
          <DialogDescription>
            Select a ZIP file exported from Claude Artifacts. Your skill and design system
            selections will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>

        <DialogFooter>
          <button
            onClick={() => handleOpenChange(false)}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleImport()}
            disabled={!file || importing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {importing ? "Importing..." : "Import ZIP"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
