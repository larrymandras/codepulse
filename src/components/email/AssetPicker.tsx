import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AssetGallery } from "@/components/email/AssetGallery";
import { AssetDropzone } from "@/components/email/AssetDropzone";
import type { EmailAssetItem } from "@/lib/astridrApi";

interface AssetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: "avatars" | "logos";
  onSelect: (asset: EmailAssetItem) => void;
}

export function AssetPicker({
  open,
  onOpenChange,
  folder,
  onSelect,
}: AssetPickerProps) {
  const [selectedAsset, setSelectedAsset] = useState<EmailAssetItem | null>(
    null,
  );
  const [showUploader, setShowUploader] = useState(false);

  const handleSelect = (asset: EmailAssetItem) => {
    setSelectedAsset(asset);
  };

  const handleUse = () => {
    if (selectedAsset) {
      onSelect(selectedAsset);
      onOpenChange(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedAsset(null);
      setShowUploader(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Select Asset</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUploader((v) => !v)}
            >
              {showUploader ? "Cancel Upload" : "Upload New"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {showUploader && (
            <AssetDropzone
              folder={folder}
              onUploaded={(asset) => {
                setShowUploader(false);
                // Convert to EmailAssetItem shape for selection
                setSelectedAsset({
                  name: asset.storage_path.split("/").pop() ?? "asset",
                  public_url: asset.public_url,
                  storage_path: asset.storage_path,
                });
              }}
            />
          )}

          <AssetGallery
            selectedPath={selectedAsset?.storage_path}
            onSelect={handleSelect}
            showUploadButton={false}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            onClick={handleUse}
            disabled={!selectedAsset}
          >
            Use Selected
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssetPicker;
