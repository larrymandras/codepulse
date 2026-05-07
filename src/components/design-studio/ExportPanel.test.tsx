import { describe, it } from "vitest";

describe("ExportPanel", () => {
  describe("format selection", () => {
    it.todo("renders all 5 export format buttons: html, pdf, pptx, zip, md");
    it.todo("highlights selected format with accent styling");
    it.todo("defaults to html format");
  });

  describe("download", () => {
    it.todo("calls exportProject with selected format and projectId");
    it.todo("triggers blob download via URL.createObjectURL");
    it.todo("shows loading spinner while downloading");
    it.todo("displays error on export failure");
  });
});
