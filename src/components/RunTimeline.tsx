/**
 * RunTimeline — nested accordion timeline grouping agent run blocks into rounds.
 *
 * A "round" starts with a thinking/reasoning block and contains all blocks
 * until the next thinking block. Completed rounds are collapsed by default;
 * the active (last) round stays expanded with an amber left stripe.
 *
 * Props:
 *   blocks    — ordered array of typed response blocks
 *   streaming — when true and no blocks yet, shows pulsing thinking indicator
 *
 * Phase 03, Plan 05: D-07 nested accordion RunTimeline.
 */

import { useMemo } from "react";
import { RunBlock } from "./RunBlock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunTimelineProps {
  blocks: Array<{ type: string; [key: string]: unknown }>;
  streaming?: boolean;
}

interface Round {
  index: number;
  blocks: Array<{ type: string; [key: string]: unknown }>;
  done: boolean;
}

// ─── groupIntoRounds ─────────────────────────────────────────────────────────

function groupIntoRounds(
  blocks: Array<{ type: string; [key: string]: unknown }>,
  streaming: boolean
): Round[] {
  const rounds: Round[] = [];
  let current: Round | null = null;

  for (const block of blocks) {
    // A "thinking" or "reasoning" block starts a new round
    if (block.type === "thinking" || block.type === "reasoning") {
      if (current) {
        current.done = true;
        rounds.push(current);
      }
      current = { index: rounds.length + 1, blocks: [block], done: false };
    } else {
      if (!current) {
        // First block is not thinking — create round 1
        current = { index: 1, blocks: [], done: false };
      }
      current.blocks.push(block);
    }
  }

  if (current) {
    // Last round: done if NOT streaming, active if streaming
    current.done = !streaming;
    rounds.push(current);
  }

  return rounds;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RunTimeline({ blocks, streaming = false }: RunTimelineProps) {
  const showThinking = streaming && blocks.length === 0;
  const rounds = useMemo(
    () => groupIntoRounds(blocks, streaming),
    [blocks, streaming]
  );

  if (showThinking) {
    return (
      <div className="text-(--muted-foreground) text-base animate-pulse">
        Thinking...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rounds.map((round) => {
        const toolCallCount = round.blocks.filter(
          (b) => b.type === "tool_use" || b.type === "tool_call"
        ).length;
        const isActive = !round.done;

        return (
          <details key={round.index} open={isActive}>
            <summary
              className={`flex items-center gap-2 cursor-pointer select-none p-2 text-base font-semibold border-l-4 ${
                isActive
                  ? "border-(--status-warn)"
                  : "border-transparent"
              }`}
            >
              <span>Round {round.index}</span>
              <span className="text-sm text-(--muted-foreground) font-normal">
                {toolCallCount} tool call{toolCallCount !== 1 ? "s" : ""}
              </span>
              {round.done && (
                <span className="text-sm text-(--status-ok)">✓</span>
              )}
              {isActive && streaming && (
                <span className="h-2 w-2 rounded-full bg-(--status-warn) animate-pulse" />
              )}
            </summary>
            <div className="pl-4 flex flex-col gap-1">
              {round.blocks.map((block, idx) => (
                <RunBlock key={idx} block={block} streaming={isActive && streaming} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
