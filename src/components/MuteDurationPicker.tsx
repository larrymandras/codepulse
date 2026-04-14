/**
 * MuteDurationPicker — popover with mute duration options.
 *
 * Options: 15m, 1h, 4h, 24h, Indefinitely
 * Single-click selection calls onSelect and closes the popover.
 * Touch targets are minimum 44px height (WCAG 2.5.5).
 *
 * Phase 06-05: ALR-06 mute duration picker
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MuteDurationPickerProps {
  onSelect: (duration: string) => void;
  trigger: React.ReactNode;
}

const DURATION_OPTIONS: { label: string; value: string }[] = [
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "24 hours", value: "24h" },
  { label: "Indefinitely", value: "indefinite" },
];

export function MuteDurationPicker({ onSelect, trigger }: MuteDurationPickerProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(value: string) {
    onSelect(value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="text-sm font-medium px-2 py-1 mb-1">Mute for how long?</p>
        <div className="flex flex-col">
          {DURATION_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              style={{ minHeight: "44px" }}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
