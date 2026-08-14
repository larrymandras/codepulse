/**
 * ModelsPanel — the curated `mediaModels` recipe cards, per 118-UI-SPEC.md
 * § "Collapsible Panels — Styles & Models" (Phase 118, plan 118-11).
 *
 * Default COLLAPSED, sitting between the filter bar and the masonry grid.
 *
 * **`recipeMd` renders as PLAIN TEXT inside a `<pre className="font-mono">`
 * — never raw-HTML injection, never a markdown renderer** (T-118-05).
 * Identical rule and rationale to `PromptEditorDrawer.tsx:258-259`:
 * `recipeMd` is agent-authored free text, so rendering it as HTML would be a
 * stored-XSS surface for zero benefit — the operator wants to read and copy
 * the literal recipe, not to see it formatted. `Studio.test.tsx` proves this
 * at the DOM level by feeding an `<img src=x onerror=alert(1)>` payload and
 * asserting zero `img` elements were created; a source grep for the raw-HTML
 * prop is the weaker secondary check, not the guard. Mutation-proven: making
 * this `<pre>` inject raw HTML turns that assertion red with
 * `expected <img src="x" onerror="alert(1)"></img> to have a length of +0 but
 * got 1`.
 *
 * D-12: read-only. There is no create or edit UI here and none may be added
 * — model cards are seeded only by the agent after an actual proven run, and
 * `enabled` is DISPLAYED, not editable. D-12 also restricts `recipeMd` to
 * environment-variable NAMES; because nothing here can write, no secret
 * value can be introduced through this panel.
 */
import { ExternalLink } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface MediaModelRow {
  _id: string;
  slug: string;
  name: string;
  type: string;
  provider: string;
  recipeMd: string;
  docsUrl?: string;
  enabled: boolean;
}

export function ModelsPanel() {
  const data = useQuery(api.media.listModels);
  const rows = (Array.isArray(data) ? data : []) as MediaModelRow[];

  return (
    // No `defaultOpen` and no controlled `open` — Radix `Collapsible` starts
    // CLOSED, which is the UI-SPEC's requirement.
    <Collapsible data-testid="studio-models-panel">
      <CollapsibleTrigger
        data-testid="studio-models-trigger"
        className="text-muted-foreground hover:text-foreground font-mono text-xs font-bold tracking-widest uppercase"
      >
        {`Models (${rows.length})`}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows.length === 0 ? (
          <p
            data-testid="studio-models-empty"
            className="text-muted-foreground mt-2 text-sm"
          >
            No model recipes yet.
          </p>
        ) : (
          <div data-testid="studio-models-list" className="mt-2 space-y-3">
            {rows.map((model) => (
              <Card
                key={model._id}
                data-testid={`studio-model-card-${model._id}`}
              >
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Displayed, never editable (D-12). */}
                    <span
                      data-testid={`studio-model-enabled-${model._id}`}
                      aria-label={model.enabled ? "Enabled" : "Disabled"}
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: model.enabled
                          ? "var(--status-ok)"
                          : "var(--muted-foreground)",
                      }}
                    />
                    <span className="text-sm font-semibold">{model.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {model.provider}
                    </span>
                    <Badge
                      variant="outline"
                      data-testid={`studio-model-type-${model._id}`}
                    >
                      {model.type}
                    </Badge>
                  </div>

                  {model.docsUrl && (
                    // Bifröst's ExternalLink icon-plus-mono-URL treatment.
                    <a
                      href={model.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`studio-model-docs-${model._id}`}
                      className="text-primary inline-flex items-center gap-1 font-mono text-xs break-all"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {model.docsUrl}
                    </a>
                  )}

                  {/* PLAIN TEXT ONLY — see the file docstring (T-118-05). */}
                  <pre
                    data-testid={`studio-model-recipe-${model._id}`}
                    className="bg-muted/30 max-h-64 overflow-y-auto rounded-md border p-3 font-mono text-xs break-words whitespace-pre-wrap"
                  >
                    {model.recipeMd}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
