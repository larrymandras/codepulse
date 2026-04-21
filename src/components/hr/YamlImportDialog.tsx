import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { importAgentYaml, AstridrApiError } from "@/lib/astridrApi";
import { toast } from "sonner";

interface YamlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function YamlImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: YamlImportDialogProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && /\.ya?ml$/i.test(dropped.name)) {
      setFile(dropped);
      setErrors([]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrors([]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setErrors([]);
    try {
      const result = await importAgentYaml(file);
      toast.success(`Agent "${result.id}" imported`);
      onOpenChange(false);
      onSuccess?.();
      navigate("/hr/roster");
    } catch (err) {
      if (
        err instanceof AstridrApiError &&
        (err as any).validationErrors
      ) {
        setErrors((err as any).validationErrors as string[]);
      } else {
        setErrors([err instanceof Error ? err.message : "Import failed"]);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setFile(null);
      setErrors([]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Agent from YAML</DialogTitle>
        </DialogHeader>

        {/* Dropzone */}
        <div
          className="border-2 border-dashed border-muted rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() =>
            document.getElementById("yaml-file-input")?.click()
          }
        >
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop a .yml or .yaml file here, or click to browse
              </p>
            </>
          )}
          <input
            id="yaml-file-input"
            type="file"
            accept=".yml,.yaml"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
              <AlertCircle className="h-4 w-4" />
              Validation errors
            </div>
            <ul className="list-disc list-inside text-xs text-destructive/80 space-y-0.5">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default YamlImportDialog;
