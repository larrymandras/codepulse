interface ErrorBlockProps {
  block: { type: string; error_type?: string; message?: string };
}

export function ErrorBlock({ block }: ErrorBlockProps) {
  return (
    <div className="bg-(--card) border-l-2 border-l-(--status-error) rounded bg-red-500/5 p-3">
      <p className="text-sm font-semibold text-(--status-error) mb-1">
        {block.error_type ?? "Error"}
      </p>
      <p className="text-base text-(--foreground) whitespace-pre-wrap">
        {block.message ?? ""}
      </p>
    </div>
  );
}
