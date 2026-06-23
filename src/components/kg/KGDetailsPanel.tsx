import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, AlertTriangle, X, ChevronLeft } from "lucide-react";
import { entityTypeColor } from "../../lib/kg-graph";
import type { KgGraphData, KgNode, KgLink, KgAttribute } from "../../lib/kg-graph";
import SectionErrorBoundary from "../SectionErrorBoundary";

export interface KGDetailsPanelProps {
  graph: KgGraphData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onClose: () => void;
  /** click a related entity id → re-select it. */
  onSelectNode: (id: string) => void;
  /** Same-origin-guarded return-nav target from ?from param (null = no chip). */
  returnTo?: string | null;
  /** Display label for the origin surface ("Tool Galaxy", "Code/Vault Graph", etc.). */
  returnLabel?: string | null;
  /** Navigate handler injected by the page (avoids importing useNavigate in a presentational panel). */
  onReturnNav?: (url: string) => void;
}

/** Deep-link into the episodic Memory view for a fact's source event (KG-06). */
function provenanceHref(sourceEventId?: string | null): string | null {
  return sourceEventId ? `/memory?event=${encodeURIComponent(sourceEventId)}` : null;
}

function ProvenanceLink({ sourceEventId }: { sourceEventId?: string | null }) {
  const href = provenanceHref(sourceEventId);
  if (!href) {
    return (
      <span
        className="text-xs text-muted-foreground/50 font-mono"
        title="No source event recorded for this fact"
      >
        no provenance
      </span>
    );
  }
  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline"
      title="Open the episodic memory that taught this fact"
    >
      <ExternalLink className="h-3 w-3" />
      memory
    </Link>
  );
}

function fmtConfidence(c: number | null): string {
  return c == null ? "—" : `${Math.round(c * 100)}%`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString();
}

function AttributeRow({ attr }: { attr: KgAttribute }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card/50 px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-mono text-primary">{attr.predicate}</span>
          <span className="text-sm text-muted-foreground">=</span>
          <span className="text-sm font-mono text-foreground break-all">
            {attr.value}
          </span>
          {attr.contradictionFlag && (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">
          conf {fmtConfidence(attr.confidence)} · {fmtDate(attr.validFrom)}
          {attr.validTo ? ` → ${fmtDate(attr.validTo)}` : ""}
        </div>
      </div>
      <ProvenanceLink sourceEventId={attr.sourceEventId} />
    </div>
  );
}

function EdgeRow({
  link,
  targetName,
  onSelect,
}: {
  link: KgLink;
  targetName: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card/50 px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-mono text-primary">{link.predicate}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <button
            onClick={() => onSelect(link.target)}
            className="text-sm font-mono text-foreground hover:text-primary hover:underline truncate"
          >
            {targetName}
          </button>
          {!link.current && (
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70 border border-border rounded px-1">
              superseded
            </span>
          )}
          {link.contradictionFlag && (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
        </div>
        <div className="text-xs text-muted-foreground font-mono mt-0.5">
          conf {fmtConfidence(link.confidence)} · {fmtDate(link.validFrom)}
          {link.validTo ? ` → ${fmtDate(link.validTo)}` : " → current"}
        </div>
      </div>
      <ProvenanceLink sourceEventId={link.sourceEventId} />
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  onClose,
  returnTo,
  returnLabel,
  onReturnNav,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  returnTo?: string | null;
  returnLabel?: string | null;
  onReturnNav?: (url: string) => void;
  children: React.ReactNode;
}) {
  const label = returnLabel ?? "previous graph";
  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 space-y-3 h-full overflow-y-auto custom-scrollbar">
      {/* Return chip — top of panel, above the title row */}
      {returnTo && onReturnNav && (
        <SectionErrorBoundary name="Return navigation">
          <button
            aria-label={`Return to ${label}`}
            onClick={() => onReturnNav(returnTo)}
            className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200"
          >
            <ChevronLeft className="h-3 w-3" />
            {`Back to ${label}`}
          </button>
        </SectionErrorBoundary>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground break-words">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

/**
 * Details for the current selection (KG-06). Entity → type/agent/aliases +
 * facts list (entity-edges + literal attributes); edge → triple details. Each
 * fact links its source episodic memory (provenance) when the API serializes it.
 *
 * When returnTo is present, renders a "Back to {Surface}" return chip at the
 * top of the panel so the user can return to the originating graph even when
 * the focused entity does not resolve (SC#3 / not-found arrival state).
 */
export default function KGDetailsPanel({
  graph,
  selectedNodeId,
  selectedEdgeId,
  onClose,
  onSelectNode,
  returnTo,
  returnLabel,
  onReturnNav,
}: KGDetailsPanelProps) {
  if (!selectedNodeId && !selectedEdgeId) {
    // No selection — show placeholder. If ?from is present keep the return chip
    // visible so arriving with a non-resolving entity still has a way back.
    if (returnTo && onReturnNav) {
      const label = returnLabel ?? "previous graph";
      return (
        <div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 h-full flex flex-col gap-3">
          <SectionErrorBoundary name="Return navigation">
            <button
              aria-label={`Return to ${label}`}
              onClick={() => onReturnNav(returnTo)}
              className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200"
            >
              <ChevronLeft className="h-3 w-3" />
              {`Back to ${label}`}
            </button>
          </SectionErrorBoundary>
          <div className="flex-1 flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground font-mono">
              Select an entity or edge to inspect its facts and provenance.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/30 p-4 h-full flex items-center justify-center text-center">
        <p className="text-sm text-muted-foreground font-mono">
          Select an entity or edge to inspect its facts and provenance.
        </p>
      </div>
    );
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n] as const));

  if (selectedNodeId) {
    const node = nodeById.get(selectedNodeId) as KgNode | undefined;
    if (!node) {
      return (
        <PanelShell
          title="Entity not in view"
          onClose={onClose}
          returnTo={returnTo}
          returnLabel={returnLabel}
          onReturnNav={onReturnNav}
        >
          <p className="text-sm text-muted-foreground">
            This entity is filtered out of the current view.
          </p>
        </PanelShell>
      );
    }
    const outgoing = graph.links.filter((l) => l.source === node.id);
    return (
      <PanelShell
        title={
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entityTypeColor(node.entityType) }}
            />
            {node.name}
          </span>
        }
        subtitle={`${node.entityType}${node.agentId ? ` · agent: ${node.agentId}` : " · shared"} · degree ${node.degree}`}
        onClose={onClose}
        returnTo={returnTo}
        returnLabel={returnLabel}
        onReturnNav={onReturnNav}
      >
        {/* Literal attributes */}
        {node.attributes.length > 0 && (
          <section className="space-y-1.5">
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Attributes ({node.attributes.length})
            </h4>
            {node.attributes.map((a) => (
              <AttributeRow key={a.sourceTripleId} attr={a} />
            ))}
          </section>
        )}

        {/* Entity-edge facts */}
        <section className="space-y-1.5">
          <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Relationships ({outgoing.length})
          </h4>
          {outgoing.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">
              No outgoing relationships in view.
            </p>
          ) : (
            outgoing.map((l) => (
              <EdgeRow
                key={l.id}
                link={l}
                targetName={nodeById.get(l.target)?.name ?? l.target}
                onSelect={onSelectNode}
              />
            ))
          )}
        </section>
      </PanelShell>
    );
  }

  // Edge selection
  const link = graph.links.find((l) => l.id === selectedEdgeId) as
    | KgLink
    | undefined;
  if (!link) {
    return (
      <PanelShell
        title="Edge not in view"
        onClose={onClose}
        returnTo={returnTo}
        returnLabel={returnLabel}
        onReturnNav={onReturnNav}
      >
        <p className="text-sm text-muted-foreground">
          This relationship is filtered out of the current view.
        </p>
      </PanelShell>
    );
  }
  const src = nodeById.get(link.source);
  const tgt = nodeById.get(link.target);
  return (
    <PanelShell
      title={
        <span className="inline-flex items-center gap-1.5 flex-wrap text-base">
          <button
            onClick={() => onSelectNode(link.source)}
            className="font-mono hover:text-primary hover:underline"
          >
            {src?.name ?? link.source}
          </button>
          <span className="text-primary font-mono">{link.predicate}</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => onSelectNode(link.target)}
            className="font-mono hover:text-primary hover:underline"
          >
            {tgt?.name ?? link.target}
          </button>
        </span>
      }
      subtitle={`${link.current ? "current" : "superseded"}${link.contradictionFlag ? " · contradiction" : ""}${link.agentId ? ` · agent: ${link.agentId}` : " · shared"}`}
      onClose={onClose}
      returnTo={returnTo}
      returnLabel={returnLabel}
      onReturnNav={onReturnNav}
    >
      <div className="space-y-1 text-sm font-mono">
        <Row label="Confidence" value={fmtConfidence(link.confidence)} />
        <Row label="Valid from" value={fmtDate(link.validFrom)} />
        <Row label="Valid to" value={link.validTo ? fmtDate(link.validTo) : "current"} />
        {link.contradictionFlag && (
          <div className="flex items-center gap-1.5 text-red-500 mt-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Flagged contradiction
          </div>
        )}
      </div>
      <div className="pt-1">
        <ProvenanceLink sourceEventId={link.sourceEventId} />
      </div>
    </PanelShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
