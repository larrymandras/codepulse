import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportProject } from "@/lib/openDesignApi";
import type { ExportFormat } from "@/lib/openDesignTypes";
import { cn } from "@/lib/utils";

interface ExportPanelProps {
  projectId: string | null;
}

const FORMATS: ExportFormat[] = ["html", "pdf", "pptx", "zip", "md"];

export default function ExportPanel({ projectId }: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("html");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!projectId) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await exportProject(projectId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch {
      setError("Export failed. Check daemon connection and try again.");
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          Choose a format to export your design artifact.
        </p>
        <div className="flex gap-2 flex-wrap">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                "px-3 py-1.5 text-sm rounded border transition-colors uppercase",
                format === f
                  ? "bg-primary/10 text-primary border-primary/40 font-medium"
                  : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={!projectId || downloading}
        onClick={handleDownload}
        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
      >
        {downloading && <Loader2 className="h-4 w-4 animate-spin" />}
        Download File
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {!projectId && (
        <p className="text-xs text-muted-foreground">
          Complete the generation step to enable export.
        </p>
      )}
    </div>
  );
}
