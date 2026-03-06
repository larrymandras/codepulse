import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useAvatarMutations } from "../hooks/useAvatars";

interface AvatarUploaderProps {
  onUpload: (storageId: string) => void;
  onCancel?: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getCroppedImg(imageSrc: string, pixelCrop: CropArea): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => {
    image.onload = resolve;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    256,
    256
  );
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png")
  );
}

export default function AvatarUploader({ onUpload, onCancel }: AvatarUploaderProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [uploading, setUploading] = useState(false);
  const { generateUploadUrl } = useAvatarMutations();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onCropComplete = useCallback((_: any, croppedPixels: CropArea) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/png" },
      });
      const { storageId } = await result.json();
      onUpload(storageId);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  if (!imageSrc) {
    return (
      <div className="space-y-3">
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-600/50 rounded-xl p-8 text-center hover:border-gray-500/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById("avatar-file-input")?.click()}
        >
          <p className="text-sm text-gray-400 mb-1">Drop an image here or click to browse</p>
          <p className="text-xs text-gray-600">PNG, JPG, WebP</p>
          <input
            id="avatar-file-input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <input
        type="range"
        min={1}
        max={3}
        step={0.1}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={uploading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex-1"
        >
          {uploading ? "Uploading..." : "Save"}
        </button>
        <button
          onClick={() => setImageSrc(null)}
          className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm"
        >
          Reset
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
