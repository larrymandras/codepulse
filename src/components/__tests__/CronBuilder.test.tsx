import { describe, test } from "vitest";
describe("CronBuilder", () => {
  test.todo("generates '* * * * *' for every_minute preset");
  test.todo("generates correct expression for every_day with hour selection");
  test.todo("shows human-readable preview that updates live");
  test.todo("validates custom expression against cron regex");
  test.todo("disables save when expression is invalid");
  test.todo("disables save when name field is empty");
});
