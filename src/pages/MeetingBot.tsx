import SectionErrorBoundary from "@/components/SectionErrorBoundary";

export default function MeetingBot() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Meeting Bot</h1>
      <SectionErrorBoundary name="Meeting Bot">
        <p className="text-sm text-muted-foreground">Loading Meeting Bot...</p>
      </SectionErrorBoundary>
    </div>
  );
}
