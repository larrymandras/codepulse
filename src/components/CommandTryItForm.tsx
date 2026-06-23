/**
 * CommandTryItForm — JSON Schema-driven form for executing Ástríðr commands via WebSocket.
 *
 * Renders form inputs based on JSON Schema property types:
 *   - string -> Input
 *   - boolean -> Switch
 *   - enum -> Select
 *   - number/integer -> Input[type=number]
 *
 * Submits via sendCommand() over the shared AstridrWS connection.
 * Result shown in a collapsible panel below the form.
 */

import { useState, useCallback } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassPanel } from "@/components/GlassPanel";
import { ChevronDown } from "lucide-react";

interface CommandTryItFormProps {
  commandName: string;
  schema?: Record<string, unknown>; // JSON Schema object
  onClose?: () => void;
}

export function CommandTryItForm({
  commandName,
  schema,
  onClose,
}: CommandTryItFormProps) {
  const { sendCommand } = useAstridrWS();
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  // Extract properties from JSON Schema
  const properties =
    (schema?.properties as Record<string, Record<string, unknown>> | undefined) ?? {};
  const propertyNames = Object.keys(properties);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        await sendCommand({
          type: "command.execute",
          name: commandName,
          args: formValues,
        });
        setResult("Command sent successfully. Awaiting response...");
        setResultOpen(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(
          `Command failed: ${message}. Check the Astridr logs for details.`
        );
        setResultOpen(true);
      } finally {
        setLoading(false);
      }
    },
    [commandName, formValues, sendCommand]
  );

  const updateField = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Render form field based on JSON Schema type/enum
  const renderField = (key: string, propSchema: Record<string, unknown>) => {
    const type = propSchema.type as string | undefined;
    const enumValues = propSchema.enum as string[] | undefined;

    if (enumValues && enumValues.length > 0) {
      return (
        <Select onValueChange={(v) => updateField(key, v)}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${key}`} />
          </SelectTrigger>
          <SelectContent>
            {enumValues.map((val: string) => (
              <SelectItem key={val} value={val}>
                {val}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (type === "boolean") {
      return (
        <Switch
          checked={!!formValues[key]}
          onCheckedChange={(v) => updateField(key, v)}
        />
      );
    }
    if (type === "number" || type === "integer") {
      return (
        <Input
          type="number"
          value={(formValues[key] as number) ?? ""}
          onChange={(e) => updateField(key, Number(e.target.value))}
        />
      );
    }
    // Default: string input
    return (
      <Input
        value={(formValues[key] as string) ?? ""}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder={(propSchema.description as string) ?? key}
      />
    );
  };

  return (
    <GlassPanel className="p-4 mt-2 space-y-4">
      {propertyNames.length > 0 ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {propertyNames.map((key) => (
            <div key={key} className="space-y-1">
              <Label className="text-sm">{key}</Label>
              {renderField(key, properties[key])}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Running..." : "Run Command"}
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No parameters required.
          </p>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Running..." : "Run Command"}
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </form>
      )}

      {(result !== null || error !== null) && (
        <Collapsible open={resultOpen} onOpenChange={setResultOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3 w-3" />
            Result
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre
              className={`mt-2 p-3 text-sm font-mono whitespace-pre-wrap max-h-48 overflow-auto rounded ${
                error
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-foreground"
              }`}
            >
              {error ?? result}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </GlassPanel>
  );
}
