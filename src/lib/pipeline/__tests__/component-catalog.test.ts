import { describe, it, expect } from "vitest";
import { ComponentCatalog } from "../present/component-catalog";

describe("ComponentCatalog", () => {
  const catalog = new ComponentCatalog();

  it("extracts valid CSS class names from presentation.css", () => {
    expect(catalog.validClasses.has("slide")).toBe(true);
    expect(catalog.validClasses.has("donut-chart")).toBe(true);
    expect(catalog.validClasses.has("bar-chart")).toBe(true);
    expect(catalog.validClasses.has("sparkline")).toBe(true);
    expect(catalog.validClasses.has("legend-item")).toBe(true);
    expect(catalog.validClasses.has("nonexistent-class")).toBe(false);
  });

  it("has at least 170 valid classes", () => {
    expect(catalog.validClasses.size).toBeGreaterThanOrEqual(170);
  });

  it("returns exemplar HTML for data-metrics slide type", () => {
    const html = catalog.exemplarForSlideType("data-metrics");
    expect(html).toContain("donut-chart");
    expect(html).toContain("bar-chart");
  });

  it("returns exemplar HTML for emergence slide type", () => {
    const html = catalog.exemplarForSlideType("emergence");
    expect(html).toContain("emergent-slide");
    expect(html).toContain("emergence-card");
  });

  it("generates component reference for given classes", () => {
    const ref = catalog.componentReference(["donut-chart", "stat-block", "grid-2"]);
    expect(ref).toContain("donut-chart");
    expect(ref).toContain("stat-block");
    expect(ref).toContain("grid-2");
  });

  it("generates planner system prompt without exemplar HTML", () => {
    const prompt = catalog.plannerSystemPrompt();
    expect(prompt).toContain("donut-chart");
    expect(prompt.length).toBeLessThan(5000);
    expect(prompt).not.toContain("<section");
  });
});
