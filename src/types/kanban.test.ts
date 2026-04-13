import { describe, test } from "vitest";
describe("kanban types", () => {
  test.todo("TaskColumn union includes all 6 values: backlog, queued, running, review, done, cancelled");
  test.todo("TASK_COLUMNS array has length 6");
  test.todo("ACTION_COLUMNS contains running and cancelled");
  test.todo("KanbanTask interface requires columnEnteredAt");
  test.todo("NewTask interface includes optional findingId");
});
