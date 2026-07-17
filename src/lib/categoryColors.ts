// Single source of truth for category accent colors. Category `color` is user
// data (picked in CategoryEditPopover), so this stays a name→hex palette
// rather than theme tokens.
export const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", red: "#ef4444", purple: "#a855f7", amber: "#f59e0b",
  cyan: "#06b6d4", emerald: "#10b981", violet: "#8b5cf6", blue: "#3b82f6",
  orange: "#f97316", pink: "#ec4899", teal: "#14b8a6", rose: "#f43f5e",
  green: "#22c55e", yellow: "#eab308", gray: "#6b7280",
};

export function categoryHex(color: string | null | undefined): string {
  return COLOR_HEX[color ?? "gray"] ?? COLOR_HEX.gray;
}
