import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function MissionControl() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Mission Control</h1>
      <SectionErrorBoundary name="Mission Control">
        <p className="text-sm text-muted-foreground">Loading Mission Control...</p>
      </SectionErrorBoundary>
    </div>
  );
}
