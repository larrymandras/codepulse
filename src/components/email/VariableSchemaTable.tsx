import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, Plus } from "lucide-react";
import type { VariableRow } from "@/lib/emailTemplateUtils";

interface VariableSchemaTableProps {
  rows: VariableRow[];
  onChange: (rows: VariableRow[]) => void;
}

const VARIABLE_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;

export function VariableSchemaTable({ rows, onChange }: VariableSchemaTableProps) {
  const [nameErrors, setNameErrors] = useState<Record<number, string>>({});

  const addRow = () => {
    onChange([
      ...rows,
      { name: "", type: "string", required: false, description: "", example: "" },
    ]);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i));
    setNameErrors((prev) => {
      const next = { ...prev };
      delete next[i];
      // Re-index errors after removal
      const reindexed: Record<number, string> = {};
      for (const [key, val] of Object.entries(next)) {
        const k = parseInt(key);
        if (k < i) reindexed[k] = val;
        else if (k > i) reindexed[k - 1] = val;
      }
      return reindexed;
    });
  };

  const updateRow = (
    i: number,
    field: keyof VariableRow,
    value: string | boolean,
  ) => {
    onChange(
      rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)),
    );
  };

  const validateName = (i: number, value: string) => {
    if (!value.trim()) {
      setNameErrors((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
      return;
    }
    if (!VARIABLE_NAME_REGEX.test(value.trim())) {
      setNameErrors((prev) => ({
        ...prev,
        [i]: "Use lowercase letters, numbers, and underscores only (e.g., first_name).",
      }));
    } else {
      setNameErrors((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Variables</Label>
      {rows.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="h-9">
                <TableHead className="w-[25%] text-xs py-2 px-3">Name</TableHead>
                <TableHead className="w-[15%] text-xs py-2 px-3">Type</TableHead>
                <TableHead className="w-[10%] text-xs py-2 px-3">Required</TableHead>
                <TableHead className="w-[30%] text-xs py-2 px-3">Description</TableHead>
                <TableHead className="w-[15%] text-xs py-2 px-3">Example</TableHead>
                <TableHead className="w-[5%] text-xs py-2 px-3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} className="h-10">
                  <TableCell className="py-1 px-3">
                    <div className="space-y-1">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(i, "name", e.target.value)}
                        onBlur={(e) => validateName(i, e.target.value)}
                        placeholder="variable_name"
                        className={`font-mono text-sm h-8 ${nameErrors[i] ? "border-destructive" : ""}`}
                      />
                      {nameErrors[i] && (
                        <p className="text-xs text-destructive">{nameErrors[i]}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateRow(
                          i,
                          "type",
                          v as "string" | "number" | "url" | "html",
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">string</SelectItem>
                        <SelectItem value="number">number</SelectItem>
                        <SelectItem value="url">url</SelectItem>
                        <SelectItem value="html">html</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Switch
                      checked={row.required}
                      onCheckedChange={(checked) =>
                        updateRow(i, "required", checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(i, "description", e.target.value)}
                      placeholder="Description"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Input
                      value={row.example}
                      onChange={(e) => updateRow(i, "example", e.target.value)}
                      placeholder="Example value"
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-w-[40px] min-h-[40px] text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(i)}
                      aria-label="Remove variable"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={addRow}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Variable
      </Button>
    </div>
  );
}

export default VariableSchemaTable;
