import { describe, it } from "vitest";

describe("designProjects", () => {
  describe("upsert", () => {
    it.todo("inserts new project when odProjectId not found");
    it.todo("patches existing project when odProjectId matches");
    it.todo("sets syncedAt to current timestamp");
  });

  describe("listIds", () => {
    it.todo("returns array of odProjectId strings");
  });

  describe("remove", () => {
    it.todo("deletes project matching odProjectId");
    it.todo("no-ops when odProjectId not found");
  });
});
