import { describe, test } from "vitest";

describe("RunTimeline — nested accordion", () => {
  test.todo("groups blocks into rounds based on run.thinking delimiter");
  test.todo("renders each round as a collapsible accordion section");
  test.todo("shows round header with 'Round {N}' and tool call count");
  test.todo("completed rounds are collapsed by default");
  test.todo("active (last) round is expanded with streaming pulse");
  test.todo("active round header has amber --status-warn left stripe");
  test.todo("stop button calls sendCommand({ action: 'run.stop' })");
  test.todo("stop button disabled when no active run");
});
