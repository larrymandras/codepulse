/**
 * LiveRun — watch active agent runs in real time, see blocks as they arrive.
 * Phase 56 stub: renders empty state with WSStatusIndicator.
 * Full implementation in Phase 56 Plan 03.
 */

import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";

export default function LiveRun() {
  const { status } = useAstridrWS();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-gray-100">Live Run</h1>
        <WSStatusIndicator status={status} />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-500">
          No runs recorded. Start a session with Ástríðr to see live blocks here.
        </p>
      </div>
    </div>
  );
}
