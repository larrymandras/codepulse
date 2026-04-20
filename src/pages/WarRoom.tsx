import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function WarRoom() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">War Room</h1>
      <SectionErrorBoundary name="War Room">
        <p className="text-sm text-muted-foreground">Loading War Room...</p>
      </SectionErrorBoundary>
    </div>
  );
}
