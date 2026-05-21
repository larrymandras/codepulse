// src/components/config/InlineTable.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  placeholder?: string;
  width?: string;
}

interface InlineTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  emptyRow: Record<string, unknown>;
}

export function InlineTable({ columns, rows, onChange, emptyRow }: InlineTableProps) {
  function updateCell(rowIdx: number, key: string, value: unknown) {
    const updated = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
    onChange(updated);
  }

  function addRow() {
    onChange([...rows, { ...emptyRow }]);
  }

  function removeRow(rowIdx: number) {
    onChange(rows.filter((_, i) => i !== rowIdx));
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-(--muted-foreground) font-medium px-1">
        {columns.map((col) => (
          <div key={col.key} className="flex-1" style={col.width ? { width: col.width, flex: "none" } : undefined}>
            {col.label}
          </div>
        ))}
        <div className="w-8" />
      </div>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-2">
          {columns.map((col) => (
            <div key={col.key} className="flex-1" style={col.width ? { width: col.width, flex: "none" } : undefined}>
              {col.type === "text" && (
                <Input
                  value={(row[col.key] as string) ?? ""}
                  onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                  placeholder={col.placeholder}
                  className="h-7 text-xs"
                />
              )}
              {col.type === "select" && col.options && (
                <Select
                  value={(row[col.key] as string) ?? ""}
                  onValueChange={(v) => updateCell(rowIdx, col.key, v)}
                >
                  <SelectTrigger size="sm" className="h-7 text-xs">
                    <SelectValue placeholder={col.placeholder ?? "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {col.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {col.type === "checkbox" && (
                <Checkbox
                  checked={!!row[col.key]}
                  onCheckedChange={(v) => updateCell(rowIdx, col.key, v)}
                />
              )}
            </div>
          ))}
          <Button variant="ghost" size="icon-xs" onClick={() => removeRow(rowIdx)}>
            <Trash2 className="h-3 w-3 text-(--muted-foreground)" />
          </Button>
        </div>
      ))}

      <Button variant="ghost" size="xs" onClick={addRow} className="text-xs gap-1 mt-1">
        <Plus className="h-3 w-3" /> Add row
      </Button>
    </div>
  );
}
