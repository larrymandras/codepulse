/**
 * CommandEntry — shape of a single registered Ástríðr slash command.
 * Matches the catalog payload received over WebSocket on connect.
 */

export interface CommandEntry {
  name: string;           // slash command string, e.g. "/run"
  description: string;    // human-readable summary
  category: string;       // e.g. "core", "skills", "mcp"
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }[];
  source?: string;        // which manifest file it came from
  inputSchema?: Record<string, unknown>; // JSON Schema object for Try It form
}
