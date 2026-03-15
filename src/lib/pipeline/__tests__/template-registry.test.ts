import { describe, it, expect } from "vitest";
import {
  getTemplate,
  selectTemplate,
  getAllTemplates,
  type TemplateRegistryEntry,
} from "../present/template-registry";

describe("Template Registry", () => {
  it("returns all 25 templates", () => {
    const all = getAllTemplates();
    expect(all).toHaveLength(25);
  });

  it("selects DV-01 for time_series + medium density", () => {
    const result = selectTemplate(["time_series"], 5, "trend", new Set());
    expect(result.id).toBe("DV-01");
  });

  it("selects DV-02 for composition data", () => {
    const result = selectTemplate(["composition"], 5, "composition", new Set());
    expect(result.id).toBe("DV-02");
  });

  it("avoids already-used templates when alternatives exist", () => {
    const used = new Set(["DV-01"]);
    const result = selectTemplate(["time_series"], 4, "trend", used);
    // Should pick DV-05 or DV-06 instead of DV-01
    expect(result.id).not.toBe("DV-01");
  });

  it("falls back to CL-01 when no template matches", () => {
    // Pass a data shape that no template covers at density 100
    const result = selectTemplate(["time_series"], 100, "trend", new Set());
    expect(["CL-01", "CL-02"]).toContain(result.id);
  });

  it("retrieves template by ID", () => {
    const template = getTemplate("SF-05");
    expect(template).toBeDefined();
    expect(template!.name).toBe("Title Slide");
  });

  it("has correct data shape mappings for data-viz templates", () => {
    const dv01 = getTemplate("DV-01")!;
    expect(dv01.dataShapes).toContain("time_series");

    const dv02 = getTemplate("DV-02")!;
    expect(dv02.dataShapes).toContain("composition");

    const dv03 = getTemplate("DV-03")!;
    expect(dv03.dataShapes).toContain("comparison");
  });
});
