import { describe, it } from "vitest";

describe("designTemplates", () => {
  describe("upsert", () => {
    it.todo("inserts new template when odTemplateId not found");
    it.todo("patches existing template when odTemplateId matches");
  });

  describe("listIds", () => {
    it.todo("returns array of odTemplateId strings");
  });

  describe("remove", () => {
    it.todo("deletes template matching odTemplateId");
  });
});
