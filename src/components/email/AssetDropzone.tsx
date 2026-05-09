import { useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadEmailAsset } from "@/lib/astridrApi";
import type { EmailAssetItem } from "@/lib/astridrApi";

interface AssetDropzoneProps {
  folder: "avatars" | "logos";
  currentUrl?: string;
  onUploaded: (asset: { storage_path: string; public_url: string }) => void;
  onPickerOpen?: () => void;
}

type DropzoneState = "idle" | "dragover" | "uploading" | "uploaded";

export function AssetDropzone({
  folder,
  currentUrl,
  onUploaded,
  onPickerOpen,
}: AssetDropzoneProps) {
  const [state, setState] = useState<DropzoneState>(
    currentUrl ? "uploaded" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > 5 * 1024 * 1024) {
        setError("File exceeds 5 MB limit. Choose a smaller image.");
        setState(previewUrl ? "uploaded" : "idle");
        return;
      }

      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setError("Only PNG, JPEG, or WebP images are supported.");
        setState(previewUrl ? "uploaded" : "idle");
        return;
      }

      setState("uploading");
      try {
        const result = await uploadEmailAsset(file, folder);
        setPreviewUrl(result.public_url);
        setState("uploaded");
        toast.success("Image uploaded");
        onUploaded(result);
      } catch {
        toast.error("Upload failed");
        setState((prev) =>
          prev === "uploading" ? (previewUrl ? "uploaded" : "idle") : prev,
        );
      }
    },
    [folder, onUploaded, previewUrl],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (state === "uploading") return;
      const file = e.dataTransfer.files[0];
      if (!file) return;
      void validateAndUpload(file);
    },
    [validateAndUpload, state],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (state !== "uploading") setState("dragover");
  };

  const onDragLeave = () => {
    if (state === "dragover") setState(previewUrl ? "uploaded" : "idle");
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void validateAndUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleClick = () => {
    if (state !== "uploading") {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-1">
      <div
        className={[
          "relative h-20 rounded-md cursor-pointer transition-colors",
          state === "dragover"
            ? "border-2 border-dashed border-primary bg-primary/5"
            : state === "uploaded" && previewUrl
              ? "border border-border overflow-hidden"
              : "border-2 border-dashed border-border/50 bg-muted/30",
          state === "uploading" ? "cursor-not-allowed" : "",
        ].join(" ")}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={handleClick}
      >
        {state === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {state !== "uploading" && state !== "uploaded" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="text-xs text-muted-foreground">
              {state === "dragover"
                ? "Drop to upload"
                : "Drop image here or click to browse"}
            </span>
            <span className="text-xs text-muted-foreground/60">
              PNG, JPG, WebP — max 5MB
            </span>
          </div>
        )}

        {state === "uploaded" && previewUrl && (
          <div className="group relative h-full w-full">
            <img
              src={previewUrl}
              alt="Uploaded asset"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors">
              <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                Replace
              </span>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {onPickerOpen && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onPickerOpen();
          }}
        >
          Browse gallery
        </button>
      )}
    </div>
  );
}

export default AssetDropzone;
