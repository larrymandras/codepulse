// src/components/config/YamlSection.tsx
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { githubDark } from "@uiw/codemirror-theme-github";

interface YamlSectionProps {
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

export function YamlSection({ value, onChange, description }: YamlSectionProps) {
  return (
    <div className="flex flex-col h-full">
      {description && (
        <p className="text-sm text-(--muted-foreground) px-1 pb-2">{description}</p>
      )}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[yaml()]}
          theme={githubDark}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
        />
      </div>
    </div>
  );
}
