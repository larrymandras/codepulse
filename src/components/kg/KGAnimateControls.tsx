/**
 * KGAnimateControls — KG-11 Animate sub-mode controls (Plan 04)
 *
 * Range picker (start/end date inputs) + interval select + transport row:
 * StepBack / Play-or-Pause / StepForward + Slider scrubber + frame date readout +
 * Speed select (0.5×/1×/2×).
 *
 * D-07: scrubber spans synthesized frames (no Ástríðr snapshot-dates source).
 */

import { Play, Pause, StepBack, StepForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface KGAnimateControlsProps {
  // Range picker + interval (D-07: operator-specified, client-synthesized)
  rangeStart: string | null;
  rangeEnd: string | null;
  interval: "day" | "week" | "month";
  onChangeRange: (start: string | null, end: string | null) => void;
  onChangeInterval: (i: "day" | "week" | "month") => void;

  // Frame state (from useKgAnimation)
  frames: string[];
  currentFrameIndex: number;
  isPlaying: boolean;
  fps: number;
  frameError: string | null;

  // Transport controls
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSetFrameIndex: (i: number) => void;
  onSetFps: (n: number) => void;
}

export default function KGAnimateControls({
  rangeStart,
  rangeEnd,
  interval,
  onChangeRange,
  onChangeInterval,
  frames,
  currentFrameIndex,
  isPlaying,
  fps,
  frameError,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSetFrameIndex,
  onSetFps,
}: KGAnimateControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Range row: start/end date pickers + interval select (D-07 deviation) */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-muted-foreground">
        <label className="whitespace-nowrap text-[10px] uppercase tracking-wide">
          From
        </label>
        <Input
          type="date"
          value={rangeStart?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChangeRange(
              e.target.value
                ? new Date(e.target.value).toISOString().slice(0, 10)
                : null,
              rangeEnd,
            )
          }
          className="w-40 font-mono text-sm"
          aria-label="animation range start"
        />
        <label className="whitespace-nowrap text-[10px] uppercase tracking-wide">
          To
        </label>
        <Input
          type="date"
          value={rangeEnd?.slice(0, 10) ?? ""}
          onChange={(e) =>
            onChangeRange(
              rangeStart,
              e.target.value
                ? new Date(e.target.value).toISOString().slice(0, 10)
                : null,
            )
          }
          className="w-40 font-mono text-sm"
          aria-label="animation range end"
        />
        <Select
          value={interval}
          onValueChange={(v) => onChangeInterval(v as "day" | "week" | "month")}
        >
          <SelectTrigger className="w-28 font-mono text-sm h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transport row: step/play/pause + scrubber + frame readout + speed */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="icon"
          onClick={onStepBack}
          disabled={frames.length === 0}
          aria-label="Step back"
        >
          <StepBack className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={isPlaying ? onPause : onPlay}
          disabled={frames.length === 0}
          aria-label={isPlaying ? "Pause animation" : "Play animation"}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onStepForward}
          disabled={frames.length === 0}
          aria-label="Step forward"
        >
          <StepForward className="h-3.5 w-3.5" />
        </Button>

        <Slider
          value={[currentFrameIndex]}
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={1}
          onValueChange={([i]) => {
            onPause();
            onSetFrameIndex(i);
          }}
          className="flex-1 min-w-[120px]"
          aria-label="animation scrubber"
          disabled={frames.length === 0}
        />

        <span className="text-xs font-mono text-muted-foreground min-w-[80px] tabular-nums">
          {frames[currentFrameIndex] ?? "—"}
        </span>

        <span className="text-[10px] uppercase tracking-wide whitespace-nowrap">
          Speed:
        </span>
        <Select
          value={String(fps)}
          onValueChange={(v) => onSetFps(Number(v))}
        >
          <SelectTrigger className="w-16 font-mono text-sm h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.5">0.5×</SelectItem>
            <SelectItem value="1">1×</SelectItem>
            <SelectItem value="2">2×</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Per-frame error — inline, non-blocking (D-08 graceful-degrade) */}
      {frameError && (
        <p className="text-xs font-mono text-red-500/80 mt-0.5">{frameError}</p>
      )}
    </div>
  );
}
