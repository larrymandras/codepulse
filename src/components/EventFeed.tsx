import { useRecentEvents } from "../hooks/useRecentEvents";
import { getEventIcon, getEventColor } from "../lib/eventIcons";
import { formatTimestamp } from "../lib/formatters";

export default function EventFeed() {
  const events = useRecentEvents(50);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Live Event Feed</h2>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">Waiting for events...</p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1">
          {events.map((event: any, i: number) => (
            <div
              key={event._id ?? i}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                i % 2 === 0 ? "bg-gray-800/30" : ""
              }`}
            >
              <span>{getEventIcon(event.eventType)}</span>
              <span className={`font-mono ${getEventColor(event.eventType)}`}>
                {event.eventType}
              </span>
              {event.toolName && (
                <span className="text-gray-500 truncate max-w-[100px]">
                  {event.toolName}
                </span>
              )}
              <span className="ml-auto text-gray-600 font-mono whitespace-nowrap">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
