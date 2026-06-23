interface TextBlockProps {
  block: { type: string; text?: string };
}

export function TextBlock({ block }: TextBlockProps) {
  return (
    <div className="bg-(--card) rounded p-3">
      <p className="text-base text-(--foreground) whitespace-pre-wrap leading-relaxed">
        {block.text ?? ""}
      </p>
    </div>
  );
}
