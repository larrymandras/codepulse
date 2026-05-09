import { useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { useEmailAssets } from "@/hooks/useEmailAssets";
import { deleteEmailAsset } from "@/lib/astridrApi";
import type { EmailAssetItem } from "@/lib/astridrApi";
import { AssetDropzone } from "@/components/email/AssetDropzone";
import { toast } from "sonner";

interface AssetGalleryProps {
  selectedPath?: string;
  onSelect?: (asset: EmailAssetItem) => void;
  showUploadButton?: boolean;
  onUpload?: () => void;
}

type FilterOption = "all" | "avatars" | "logos";

export function AssetGallery({
  selectedPath,
  onSelect,
  showUploadButton = true,
}: AssetGalleryProps) {
  const { assets, loading, error, reload, filter, setFilter } =
    useEmailAssets();
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  const filterOptions: { value: FilterOption; label: string }[] = [
    { value: "all", label: "All" },
    { value: "avatars", label: "Avatars" },
    { value: "logos", label: "Logos" },
  ];

  const handleDelete = async () => {
    if (!deletingPath) return;
    try {
      await deleteEmailAsset(deletingPath);
      toast.success("Asset deleted");
      void reload();
    } catch {
      toast.error("Failed to delete asset");
    } finally {
      setDeletingPath(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {filterOptions.map((f) => (
            <Skeleton key={f.value} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2">
        {filterOptions.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value as FilterOption)}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Upload dropzone (inline, toggle) */}
      {showUploader && (
        <div className="space-y-2">
          <AssetDropzone
            folder="logos"
            onUploaded={() => {
              setShowUploader(false);
              void reload();
            }}
          />
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowUploader(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty state */}
      {assets.length === 0 && !showUploader && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="text-base font-semibold">No assets uploaded</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Upload logos and avatar images to use across your email layouts.
          </p>
          {showUploadButton && (
            <Button onClick={() => setShowUploader(true)}>Upload Image</Button>
          )}
        </div>
      )}

      {/* Thumbnail grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <div key={asset.storage_path} className="relative group">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(asset)}
                  className={[
                    "h-24 w-24 rounded overflow-hidden bg-card transition-all",
                    selectedPath === asset.storage_path
                      ? "ring-2 ring-primary bg-primary/10"
                      : "hover:ring-1 hover:ring-border",
                  ].join(" ")}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="h-24 w-24 rounded overflow-hidden bg-card">
                  <img
                    src={asset.public_url}
                    alt={asset.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <p className="mt-1 w-24 truncate text-xs text-muted-foreground">
                {asset.name}
              </p>
              {/* Delete button */}
              <button
                type="button"
                aria-label="Delete asset"
                onClick={() => setDeletingPath(asset.storage_path)}
                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs group-hover:flex"
              >
                ×
              </button>
            </div>
          ))}

          {/* Upload "+" cell */}
          {showUploadButton && !showUploader && (
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              className="h-24 w-24 rounded border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:border-border transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deletingPath}
        onOpenChange={(open) => { if (!open) setDeletingPath(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This image will be removed from the asset library. Layouts or
              templates referencing it may display broken images.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AssetGallery;
