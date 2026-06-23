/**
 * KGSearchResults — Full-text search results panel for the KG Explorer (Phase 86, KG-08).
 *
 * Renders result rows from Ástríðr's `/api/kg/search` endpoint in a scrollable panel.
 * Each row shows entity name · predicate · matched snippet with the matched term
 * emphasized via `font-semibold text-primary` (NOT `<mark>` or `dangerouslySetInnerHTML`
 * — XSS safety T-86-06 mandate).
 *
 * States: idle (no query), loading, ok (results / no-results), not-deployed (404/501
 * informational copy — D-01 graceful-degrade), error (red banner).
 */
import { AlertTriangle, Info, Search } from "lucide-react";
import type { KgSearchHit } from "../../lib/kgApi";

export interface KGSearchResultsProps {
  results: KgSearchHit[];
  query: string;
  loading: boolean;
  /** "ok" — results returned (may be empty); "not-deployed" — 404/501 informational;
   *  "error" — non-gated error; "idle" — no query entered yet */
  gateState: "ok" | "not-deployed" | "error" | "idle";
  errorMessage?: string | null;
  /** Called with subjectName verbatim — caller builds the focus URL (D-02). */
  onSelectResult: (subjectName: string) => void;
}

// ── Snippet emphasis renderer (XSS-safe: React text nodes, never dangerouslySetInnerHTML) ──

function renderSnippet(snippet: string, matchedTerm?: string): React.ReactNode {
  if (!matchedTerm) return snippet;
  const idx = snippet.toLowerCase().indexOf(matchedTerm.toLowerCase());
  if (idx === -1) return snippet;
  const before = snippet.slice(0, idx);
  const match = snippet.slice(idx, idx + matchedTerm.length);
  const after = snippet.slice(idx + matchedTerm.length);
  return (
    <>
      {before}
      <span className="font-semibold text-primary">{match}</span>
      {after}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function KGSearchResults({
  results,
  query,
  loading,
  gateState,
  errorMessage,
  onSelectResult,
}: KGSearchResultsProps) {
  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-primary/70 font-mono text-base animate-pulse">
            Searching knowledge graph…
          </p>
        </div>
      )}

      {/* Not-deployed gated state (404/501) — informational, NOT a red error banner */}
      {!loading && gateState === "not-deployed" && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm font-mono leading-relaxed">
            <p className="text-foreground">
              Full-text search isn&apos;t available on the connected Ástríðr build yet.
            </p>
            <p className="text-muted-foreground mt-0.5">
              This needs the <span className="text-primary">/api/kg/search endpoint</span> (cross-repo).
              Entity-name search remains available.
            </p>
          </div>
        </div>
      )}

      {/* Error state — red banner */}
      {!loading && gateState === "error" && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <div className="text-sm font-mono leading-relaxed">
            <p className="text-foreground">Could not reach the KG search API.</p>
            <p className="text-muted-foreground mt-0.5">
              Full-text search needs Ástríðr&apos;s /api/kg/search endpoint. Start Ástríðr or
              check VITE_ASTRIDR_API_URL/KEY. Entity-name search (Entity lens) still works
              against /api/kg.
            </p>
            {errorMessage && (
              <p className="text-muted-foreground/70 mt-0.5">{errorMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Idle / no query — empty state */}
      {!loading && gateState === "idle" && (
        <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-8">
          <Search className="h-6 w-6 text-primary/50" />
          <p className="text-base text-muted-foreground font-mono">
            Search the knowledge graph
          </p>
          <p className="text-sm text-muted-foreground/60 max-w-md">
            Type a term to match across fact text and relationship labels — not just entity names.
          </p>
        </div>
      )}

      {/* ok state — results or no-results */}
      {!loading && gateState === "ok" && (
        <>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-6 py-8">
              <AlertTriangle className="h-6 w-6 text-primary/50" />
              <p className="text-base text-muted-foreground font-mono">
                No matches for &ldquo;{query}&rdquo;
              </p>
              <p className="text-sm text-muted-foreground/60 max-w-md">
                Try a shorter term, or switch to the Entity lens to look up an entity by name.
              </p>
            </div>
          ) : (
            <>
              {/* Results count line */}
              <p className="text-xs font-mono text-muted-foreground px-1">
                {results.length} matches across facts &amp; relationships
              </p>

              {/* Result rows */}
              <div className="space-y-1">
                {results.map((hit, i) => (
                  <button
                    key={`${hit.subjectId}-${hit.predicate}-${i}`}
                    onClick={() => onSelectResult(hit.subjectName)}
                    className="w-full text-left flex items-start gap-3 rounded-[var(--radius-sm)] border border-border bg-card/50 px-3 py-2.5 hover:bg-accent/50 hover:border-primary/30 transition-colors"
                    aria-label={`${hit.subjectName} — ${hit.predicate}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-mono text-foreground">
                          {hit.subjectName}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">·</span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {hit.predicate}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-0.5 break-words">
                        {renderSnippet(hit.snippet, hit.matchedTerm)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
