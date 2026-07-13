import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { GlassPanel } from "@/components/GlassPanel";
import { StatusBadge } from "@/components/StatusBadge";

export interface Fact {
  _id: string;
  factText?: string;
  category?: string;
  confidence?: number;
  timestamp?: number;
}

interface FactsTableProps {
  facts: Fact[] | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  sectionName: string;
}

function formatRelative(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Shared "facts table" surface used by both Memory's "Durable Facts" tab and
 * Dreaming's "Facts" tab (D-09). Query + filter STATE lives in the host page;
 * this component owns the actual text/category filtering + presentation so
 * both existing empty-state / no-match copy stays intact (UI-SPEC).
 */
export function FactsTable({
  facts,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
  sectionName,
}: FactsTableProps) {
  const filteredFacts = (facts ?? []).filter((f) => {
    const matchesSearch =
      !search || (f.factText ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !category || f.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <SectionErrorBoundary name={sectionName}>
      <div className="space-y-4 mt-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search facts..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          {categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-base text-foreground focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {!facts || facts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-base text-muted-foreground">
              No durable facts extracted yet. Run a dreaming cycle to
              extract long-term facts from your conversation history.
            </p>
          </div>
        ) : filteredFacts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-base text-muted-foreground">
              No facts match your search.
            </p>
          </div>
        ) : (
          <GlassPanel className="rounded-xl overflow-hidden hover:scale-[1.01] transition-transform duration-300">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fact</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacts.map((fact) => (
                  <TableRow key={fact._id}>
                    <TableCell className="text-base text-foreground max-w-md">
                      {fact.factText}
                    </TableCell>
                    <TableCell>
                      {fact.category && (
                        <StatusBadge
                          status="idle"
                          label={fact.category.toUpperCase()}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-base">
                      {fact.confidence != null
                        ? `${(fact.confidence * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {fact.timestamp ? formatRelative(fact.timestamp) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassPanel>
        )}
      </div>
    </SectionErrorBoundary>
  );
}

export default FactsTable;
