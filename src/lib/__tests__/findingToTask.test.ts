import { describe, test } from "vitest";
describe("findingToTaskDefaults", () => {
  test.todo("maps critical severity to high priority");
  test.todo("maps high severity to high priority");
  test.todo("maps medium severity to medium priority");
  test.todo("maps low severity to low priority");
  test.todo("maps unknown severity to medium priority");
  test.todo("sets finding description as task title");
  test.todo("sets suggestedFix as task description");
  test.todo("includes category and scanType as labels");
  test.todo("sets findingId from finding._id");
});
