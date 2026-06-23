import React, { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("cyan");

  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem("codepulse-theme") || "cyan";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    localStorage.setItem("codepulse-theme", value);
    document.documentElement.setAttribute("data-theme", value);
  };

  return (
    <div className="flex items-center gap-2">
      <Paintbrush className="w-4 h-4 text-muted-foreground" />
      <Select value={theme} onValueChange={handleThemeChange}>
        <SelectTrigger className="w-[140px] h-8 bg-card/50 border-border/50 text-sm">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cyan">Electric Cyan</SelectItem>
          <SelectItem value="emerald">Matrix Emerald</SelectItem>
          <SelectItem value="amber">Warning Amber</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
