/**
 * Kanban task types for Phase 04 task-management.
 */

export type TaskPriority = "high" | "medium" | "low";
export type TaskColumn = "backlog" | "queued" | "running" | "review" | "done" | "cancelled";
export const TASK_COLUMNS: TaskColumn[] = ["backlog", "queued", "running", "review", "done", "cancelled"];
export const ACTION_COLUMNS: TaskColumn[] = ["running", "cancelled"];

export interface KanbanTask {
  id: string;
  _id?: string; // Convex document ID
  title: string;
  description?: string;
  priority: TaskPriority;
  column: TaskColumn;
  agentId?: string;
  agentName?: string;
  labels?: string[];
  dueAt?: number;
  columnEnteredAt: number;
  findingId?: string;
  createdAt: number;
}

export interface NewTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  agentId?: string;
  agentName?: string;
  labels?: string[];
  dueAt?: number;
  findingId?: string;
}

export type FindingStatus = "open" | "acknowledged" | "converted" | "dismissed";
