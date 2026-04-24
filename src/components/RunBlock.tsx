import { TextBlock } from "./blocks/TextBlock";
import { ErrorBlock } from "./blocks/ErrorBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolCallBlock } from "./blocks/ToolCallBlock";
import { FailoverBlock } from "./blocks/FailoverBlock";

interface RunBlockProps {
  block: { type: string; [key: string]: unknown };
  streaming?: boolean;
}

export function RunBlock({ block, streaming = false }: RunBlockProps) {
  switch (block.type) {
    case "text":
      return <TextBlock block={block as { type: string; text?: string }} />;

    case "thinking":
    case "reasoning":
      return (
        <ThinkingBlock
          block={block as { type: string; round_num?: number; thinking_text?: string }}
          streaming={streaming}
        />
      );

    case "tool_call":
      return (
        <ToolCallBlock
          block={
            block as {
              type: string;
              tool_name?: string;
              arguments?: unknown;
              result?: string;
              status?: string;
            }
          }
        />
      );

    case "tool_use":
      return (
        <ToolCallBlock
          block={{
            type: "tool_call",
            tool_name: (block.name as string | undefined) ?? "tool",
            arguments: block.arguments,
            status: "success",
          }}
        />
      );

    case "tool_result":
      return null;

    case "error":
      return (
        <ErrorBlock
          block={block as { type: string; error_type?: string; message?: string }}
        />
      );

    case "failover":
      return (
        <FailoverBlock
          block={
            block as {
              type: string;
              failedProvider?: string;
              newProvider?: string;
              errorMessage?: string;
            }
          }
        />
      );

    default:
      return (
        <div className="bg-(--muted) border border-(--border) rounded p-3">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--muted-foreground)">
            {JSON.stringify(block, null, 2)}
          </pre>
        </div>
      );
  }
}
