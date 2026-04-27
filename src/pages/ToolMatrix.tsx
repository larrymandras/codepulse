import { ToolMatrixPanel } from "../components/ToolMatrixPanel";

export default function ToolMatrixPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-100">Tool Matrix</h1>
        <p className="text-sm text-gray-400">
          Agent tool assignments, classifications, and pending approvals
        </p>
      </div>
      <ToolMatrixPanel />
    </div>
  );
}
