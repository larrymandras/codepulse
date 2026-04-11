/**
 * ConfigEditor — read and edit Ástríðr config sections with YAML highlighting
 * and dry-run validation before applying changes.
 * Phase 56 stub: renders empty state with WSStatusIndicator.
 * Full implementation in Phase 56 Plan 05.
 */

import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";

export default function ConfigEditor() {
  const { status } = useAstridrWS();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-gray-100">Config</h1>
        <WSStatusIndicator status={status} />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">
          Failed to load config. Check WebSocket connection.
        </p>
      </div>
    </div>
  );
}
