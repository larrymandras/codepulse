import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TagChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagChipInput({ values, onChange, placeholder = "Add..." }: TagChipInputProps) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) {
        onChange([...values, input.trim()]);
      }
      setInput("");
    }
  }

  function handleRemove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          {v}
          <button
            type="button"
            onClick={() => handleRemove(v)}
            className="ml-0.5 rounded-full hover:bg-(--muted) p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-7 w-32 text-xs"
      />
    </div>
  );
}
