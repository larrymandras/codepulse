/**
 * CodeBlock — syntax-highlighted code and diff block for the BlockRenderer generative UI system.
 *
 * Supports:
 *   code type: single syntax-highlighted panel
 *   diff type: two-panel side-by-side with Before/After labels
 *
 * Phase 03, Plan 02: IL-03 block rendering.
 */

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CodeBlockData, DiffBlockData } from "@/types/generative-blocks";

interface CodeBlockProps {
  block: CodeBlockData | DiffBlockData;
  diff?: boolean;
}

const codeStyle = {
  margin: 0,
  borderRadius: 0,
  fontSize: "0.875rem", // 14px — JetBrains Mono per UI-SPEC
  fontFamily: "'JetBrains Mono', monospace",
};

export function CodeBlock({ block, diff }: CodeBlockProps) {
  if (diff || block.type === "diff") {
    const diffBlock = block as DiffBlockData;
    const lang = diffBlock.language ?? "text";

    return (
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-(--muted-foreground) mb-1">
            Before
          </p>
          <SyntaxHighlighter language={lang} style={oneDark} customStyle={codeStyle}>
            {diffBlock.before}
          </SyntaxHighlighter>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-(--muted-foreground) mb-1">
            After
          </p>
          <SyntaxHighlighter language={lang} style={oneDark} customStyle={codeStyle}>
            {diffBlock.after}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  const codeBlock = block as CodeBlockData;
  return (
    <SyntaxHighlighter
      language={codeBlock.language}
      style={oneDark}
      customStyle={codeStyle}
    >
      {codeBlock.content}
    </SyntaxHighlighter>
  );
}
