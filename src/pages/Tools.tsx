import { Link } from "react-router";
import { Wrench } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import ToolUsagePanel from "../components/ToolUsagePanel";
import ToolPolicyFeed from "../components/ToolPolicyFeed";

/**
 * D-13/D-14/D-16 — the Tools page: one scroll, usage above the policy feed,
 * each stacked section in its own SectionErrorBoundary so a timing-out query
 * on one side can never blank the other (the 3b31c9f4 lesson). No tabs.
 *
 * This file is a shell — it does not duplicate any header, filter or empty
 * state ToolUsagePanel/ToolPolicyFeed already render (105-06/105-07).
 */
export default function Tools() {
  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Tools" icon={Wrench} className="mb-0" />
        <p className="text-sm text-muted-foreground mt-1">
          Ástríðr&apos;s tool-call frequency, success/failure rates, and policy/leak
          signals in one place. For per-turn tool nesting and cache ratio, open a
          session&apos;s Trace from{" "}
          <Link to="/" className="text-primary hover:underline">
            Dashboard → Active Sessions
          </Link>
          .
        </p>
      </div>

      <section>
        <SectionErrorBoundary name="Tool Usage">
          <ToolUsagePanel />
        </SectionErrorBoundary>
      </section>

      <section className="pt-12">
        <SectionErrorBoundary name="Tool Policy Events">
          <ToolPolicyFeed />
        </SectionErrorBoundary>
      </section>
    </div>
  );
}
