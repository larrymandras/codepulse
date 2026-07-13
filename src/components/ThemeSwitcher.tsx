import React, { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const VALID_THEMES = ["cyan", "emerald", "readable", "aubergine"];

function readSavedTheme(): string {
  if (typeof localStorage === "undefined") return "cyan";
  const saved = localStorage.getItem("codepulse-theme");
  return saved && VALID_THEMES.includes(saved) ? saved : "cyan";
}

export function ThemeSwitcher() {
  // Lazy initializer: the pre-paint script in index.html already applied the saved
  // theme to <html data-theme> before React mounted, so read the same key here. This
  // makes the Select render the correct value on first paint instead of flashing
  // "cyan" and correcting in an effect (Phase 89 WR-02).
  const [theme, setTheme] = useState<string>(readSavedTheme);

  useEffect(() => {
    // Idempotent reassertion of the resolved theme on <html> (pre-paint already did
    // this; harmless if it runs again, and keeps behavior correct if mounted without
    // the pre-paint script).
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    localStorage.setItem("codepulse-theme", value);
    document.documentElement.setAttribute("data-theme", value);
  };

  return (
    <div className="flex items-center gap-2">
      <Paintbrush className="w-4 h-4 text-muted-foreground" />
      <Select value={theme} onValueChange={handleThemeChange}>
        <SelectTrigger aria-label="Select theme" className="w-[160px] h-8 bg-card/50 border-border/50 text-sm">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cyan">Electric Cyan</SelectItem>
          <SelectItem value="emerald">Matrix Emerald</SelectItem>
          <SelectItem value="readable">Readable Dark</SelectItem>
          <SelectItem value="aubergine">Midnight Aubergine</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
