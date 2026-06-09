#!/usr/bin/env python3
"""Phase 71 Wave 4: migrate ad-hoc gray Tailwind classes to semantic design tokens.

Pure, deterministic class-string substitution per UI-SPEC migration plan.
Only touches gray-* classes (surfaces/borders/text/hover). Non-gray accents
(indigo/blue/emerald) are intentionally left untouched for visual review.

Word-boundary-safe: matches each token only when delimited by whitespace,
quote, backtick, or template-literal braces inside className strings.
"""
import re
import sys
from pathlib import Path

# Ordered longest-first so e.g. bg-gray-800/50 matches before bg-gray-800.
MAPPING = {
    # --- surfaces: gray-800* (semi-transparent panel) -> bg-card (opaque) ---
    "bg-gray-800/80": "bg-card",
    "bg-gray-800/50": "bg-card",
    "bg-gray-800/40": "bg-card",
    "bg-gray-800/30": "bg-card",
    "bg-gray-800": "bg-card",
    # --- surfaces: gray-900*/950* (deeper inset) -> bg-background ---
    "bg-gray-950/50": "bg-background",
    "bg-gray-900/80": "bg-background",
    "bg-gray-900/60": "bg-background",
    "bg-gray-900/50": "bg-background",
    "bg-gray-900/40": "bg-background",
    "bg-gray-900/30": "bg-background",
    # --- surfaces: gray-700* (raised chip/control) -> bg-muted ---
    "bg-gray-700/60": "bg-muted",
    "bg-gray-700/50": "bg-muted",
    "bg-gray-700/40": "bg-muted",
    "bg-gray-700": "bg-muted",
    # --- neutral indicator dots -> muted-foreground ---
    "bg-gray-500": "bg-muted-foreground",
    "bg-gray-400": "bg-muted-foreground",
    # --- borders -> border-border ---
    "border-gray-800/50": "border-border",
    "border-gray-800": "border-border",
    "border-gray-700/50": "border-border",
    "border-gray-700/40": "border-border",
    "border-gray-700/30": "border-border",
    "border-gray-700": "border-border",
    "border-gray-600/30": "border-border",
    # --- text -> foreground / muted-foreground ---
    "text-gray-100": "text-foreground",
    "text-gray-200": "text-foreground",
    "text-gray-300": "text-muted-foreground",
    "text-gray-400": "text-muted-foreground",
    "text-gray-500": "text-muted-foreground",
    "text-gray-600": "text-muted-foreground",
    # --- hover surfaces -> hover:bg-accent ---
    "hover:bg-gray-900/60": "hover:bg-accent",
    "hover:bg-gray-800/70": "hover:bg-accent",
    "hover:bg-gray-700/50": "hover:bg-accent",
    "hover:bg-gray-700/30": "hover:bg-accent",
    "hover:bg-gray-700/20": "hover:bg-accent",
    "hover:bg-gray-700": "hover:bg-accent",
    "hover:bg-gray-600": "hover:bg-accent",
    # --- hover text -> hover:text-foreground ---
    "hover:text-gray-200": "hover:text-foreground",
    "hover:text-gray-300": "hover:text-foreground",
    "hover:text-gray-400": "hover:text-muted-foreground",
    "group-hover:text-gray-300": "group-hover:text-foreground",
    # --- hover border -> hover:border-border ---
    "hover:border-gray-600/50": "hover:border-border",
    # --- placeholder -> placeholder:text-muted-foreground (Tailwind v4 variant) ---
    "placeholder-gray-500": "placeholder:text-muted-foreground",
    # --- focus ring matching page bg -> ring-background ---
    "ring-gray-950": "ring-background",
}

# Build one regex alternation, longest keys first to avoid partial overlaps.
keys = sorted(MAPPING, key=len, reverse=True)
# Class boundary: start/space/quote/backtick/brace/paren before; same after.
BOUND_L = r"(?<=[\s\"'`({])"
BOUND_R = r"(?=[\s\"'`)}])"
pattern = re.compile(BOUND_L + "(" + "|".join(re.escape(k) for k in keys) + ")" + BOUND_R)


def migrate(text: str):
    counts = {}

    def repl(m):
        k = m.group(1)
        counts[k] = counts.get(k, 0) + 1
        return MAPPING[k]

    new = pattern.sub(repl, text)
    return new, counts


def main(files):
    grand = {}
    for fp in files:
        p = Path(fp)
        src = p.read_text(encoding="utf-8")
        new, counts = migrate(src)
        if counts:
            p.write_text(new, encoding="utf-8")
            total = sum(counts.values())
            print(f"{p.name}: {total} replacements")
            for k, v in sorted(counts.items(), key=lambda x: -x[1]):
                grand[k] = grand.get(k, 0) + v
    print("\n--- grand totals ---")
    for k, v in sorted(grand.items(), key=lambda x: -x[1]):
        print(f"  {v:4d}  {k} -> {MAPPING[k]}")
    # Safety: report any residual gray-* class in pages.
    print("\n--- residual gray-* check ---")
    residual = re.compile(r"(?<=[\s\"'`({])((?:bg|border|text|divide|hover:bg|hover:border|hover:text|group-hover:text|group-hover:bg|placeholder|ring|focus:ring|focus:border)-gray-\d+(?:/\d+)?)(?=[\s\"'`)}])")
    for fp in files:
        for ln, line in enumerate(Path(fp).read_text(encoding="utf-8").splitlines(), 1):
            for m in residual.finditer(line):
                print(f"  RESIDUAL {Path(fp).name}:{ln}: {m.group(1)}")


if __name__ == "__main__":
    main(sys.argv[1:])
