/**
 * Kanban task types for Phase 56 CPCC-04.
 */

export type TaskPriority = "high" | "medium" | "low";
export type TaskColumn = "backlog" | "in_progress" | "done";

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  column: TaskColumn;
  agentId?: string;
  agentName?: string;
  createdAt: number; // Unix seconds
}

export interface NewTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  agentId?: string;
  agentName?: string;
}
