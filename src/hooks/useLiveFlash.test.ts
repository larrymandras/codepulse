import { describe } from "vitest";

describe("useLiveFlash", () => {
  test.todo("adds live-update-flash class to element ref on triggerFlash"); // D-03
  test.todo("removes live-update-flash class after 620ms timeout"); // D-03
  test.todo("debounces — does not re-flash within 1 second of previous flash"); // D-03
  test.todo("allows flash after 1 second debounce window expires"); // D-03
  test.todo("forces reflow to restart animation when re-triggering"); // D-03
});
