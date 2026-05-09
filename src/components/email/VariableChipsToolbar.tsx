import type { VariableRow } from "@/lib/emailTemplateUtils";

interface VariableChipsToolbarProps {
  variables: VariableRow[];
  onInsert: (text: string) => void;
}

export function VariableChipsToolbar({
  variables,
  onInsert,
}: VariableChipsToolbarProps) {
  const visibleVars = variables.filter((v) => v.name.trim() !== "");

  if (visibleVars.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 bg-muted/20 border border-border rounded-t-md">
      {visibleVars.map((v) => (
        <button
          key={v.name}
          type="button"
          onClick={() => onInsert("{{" + v.name + "}}")}
          className="text-xs px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded transition-colors font-mono"
          aria-label={`Insert {{${v.name}}}`}
        >
          {"{{"}
          {v.name}
          {"}}"}
        </button>
      ))}
    </div>
  );
}

export default VariableChipsToolbar;
