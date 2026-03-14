/**
 * Tests for the PRISM presentation spec system:
 * 1. Compiler: design-tokens.yaml → references/presentation-system.md
 * 2. Loader: loadPresentationSpec() resolves compiled spec vs fallback
 * 3. Token coverage: all CSS variables from YAML appear in compiled output
 * 4. Exemplar embedding: all 6 golden exemplar files are included
 * 5. Idempotency: compiler produces identical output on repeated runs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { execSync } from "child_process";

const ROOT = resolve(__dirname, "../../../..");
const TOKENS_PATH = resolve(ROOT, "design-tokens.yaml");
const EXEMPLARS_DIR = resolve(ROOT, "references", "exemplars");
const OUTPUT_PATH = resolve(ROOT, "references", "presentation-system.md");
const COMPILER_PATH = resolve(ROOT, "scripts", "compile-presentation-spec.ts");

// ─── Compiler Output Tests ──────────────────────────────────

describe("compile-presentation-spec", () => {
  let compiledSpec: string;
  let tokens: Record<string, unknown>;

  beforeEach(() => {
    // Read the already-compiled spec (compiler ran during build)
    expect(existsSync(OUTPUT_PATH)).toBe(true);
    compiledSpec = readFileSync(OUTPUT_PATH, "utf-8");

    // Parse source tokens for comparison
    const rawYaml = readFileSync(TOKENS_PATH, "utf-8");
    tokens = parseYaml(rawYaml) as Record<string, unknown>;
  });

  // ── Structure ──

  describe("output structure", () => {
    it("starts with the PRISM Presentation System heading", () => {
      expect(compiledSpec).toMatch(/^# PRISM Presentation System/);
    });

    it("contains all 10 required sections", () => {
      const expectedSections = [
        "Brand Identity & Color System",
        "Typography Scale",
        "Component Library",
        "Chart Components",
        "Animation System",
        "Interaction States & Glass Morphism",
        "Layout System",
        "PRISM Semantic System",
        "Composition Rules",
        "Reference Examples (Golden Exemplars)",
      ];

      for (const section of expectedSections) {
        expect(compiledSpec).toContain(`## ${section}`);
      }
    });

    it("includes slide structure skeleton HTML", () => {
      expect(compiledSpec).toContain('<section class="slide" id="slide-N">');
      expect(compiledSpec).toContain("slide-bg-glow");
      expect(compiledSpec).toContain("slide-inner");
      expect(compiledSpec).toContain("slide-footer");
    });

    it("includes external asset references", () => {
      expect(compiledSpec).toContain("/styles/presentation.css");
      expect(compiledSpec).toContain("/js/presentation.js");
    });

    it("separates sections with horizontal rules", () => {
      const hrCount = (compiledSpec.match(/^---$/gm) ?? []).length;
      // 10 sections + exemplars = 11 total, so 10 separators
      expect(hrCount).toBeGreaterThanOrEqual(9);
    });
  });

  // ── Token Coverage ──

  describe("brand color token coverage", () => {
    const colors = () => tokens.colors as Record<string, string>;

    it("includes all 8 brand palette colors", () => {
      const brandKeys = [
        "inov-navy", "inov-cerulean", "inov-sky", "inov-midnight",
        "inov-jade", "inov-sand", "inov-violet", "inov-cloud",
      ];
      for (const key of brandKeys) {
        expect(compiledSpec).toContain(`--${key}`);
        expect(compiledSpec).toContain(colors()[key]);
      }
    });

    it("includes all surface system colors", () => {
      const surfaceKeys = ["bg-primary", "bg-secondary", "bg-tertiary", "bg-elevated", "bg-card"];
      for (const key of surfaceKeys) {
        expect(compiledSpec).toContain(`--${key}`);
      }
    });

    it("includes all text hierarchy colors", () => {
      const textKeys = ["text-primary", "text-secondary", "text-tertiary"];
      for (const key of textKeys) {
        expect(compiledSpec).toContain(`--${key}`);
        expect(compiledSpec).toContain(colors()[key]);
      }
    });

    it("includes all semantic accent colors", () => {
      const accentKeys = [
        "accent", "accent-bright", "accent-success",
        "accent-warning", "accent-error", "accent-violet",
      ];
      for (const key of accentKeys) {
        expect(compiledSpec).toContain(`--${key}`);
      }
    });

    it("includes all 8 chart colors", () => {
      for (let i = 1; i <= 8; i++) {
        const key = `chart-${i}`;
        expect(compiledSpec).toContain(`--${key}`);
        expect(compiledSpec).toContain(colors()[key]);
      }
    });

    it("includes all 6 finding border semantic tokens", () => {
      const findingBorderKeys = [
        "finding-border-default", "finding-border-emergent",
        "finding-border-risk", "finding-border-opportunity",
        "finding-border-regulatory", "finding-border-caution",
      ];
      for (const key of findingBorderKeys) {
        expect(compiledSpec).toContain(`--${key}`);
        expect(compiledSpec).toContain(colors()[key]);
      }
    });
  });

  describe("typography token coverage", () => {
    const typo = () => tokens.typography as Record<string, unknown>;

    it("includes font families", () => {
      expect(compiledSpec).toContain(String(typo().font_family_sans));
      expect(compiledSpec).toContain(String(typo().font_family_mono));
    });

    it("includes all fluid type sizes", () => {
      const sizes = typo().fluid_sizes as Record<string, { min: string; preferred: string; max: string }>;
      for (const [name, { min, max }] of Object.entries(sizes)) {
        expect(compiledSpec).toContain(`--text-${name}`);
        expect(compiledSpec).toContain(min);
        expect(compiledSpec).toContain(max);
      }
    });

    it("includes font weights", () => {
      expect(compiledSpec).toContain("400");
      expect(compiledSpec).toContain("700");
      expect(compiledSpec).toContain("900");
    });
  });

  describe("component token coverage", () => {
    const comp = () => tokens.components as Record<string, Record<string, string>>;

    it("includes finding card geometry tokens", () => {
      const fc = comp().finding_card;
      expect(compiledSpec).toContain(fc.padding);
      expect(compiledSpec).toContain(fc.border_radius);
      expect(compiledSpec).toContain(fc.accent_border_width);
    });

    it("includes compact table geometry tokens", () => {
      const ct = comp().compact_table;
      expect(compiledSpec).toContain(ct.cell_padding);
      expect(compiledSpec).toContain(ct.header_font_size);
    });

    it("includes hero stat geometry tokens", () => {
      const hs = comp().hero_stat;
      expect(compiledSpec).toContain(String(hs.number_size));
      expect(compiledSpec).toContain(String(hs.number_weight));
    });

    it("includes slide layout specs", () => {
      const sl = comp().slide;
      expect(compiledSpec).toContain(String(sl.max_width));
      expect(compiledSpec).toContain(String(sl.min_height));
    });
  });

  describe("chart component coverage", () => {
    const chartTokens = () => tokens.charts as Record<string, Record<string, unknown>>;

    it("includes donut chart SVG geometry", () => {
      const donut = chartTokens().donut;
      expect(compiledSpec).toContain(String(donut.viewbox));
      expect(compiledSpec).toContain(String(donut.radius));
      expect(compiledSpec).toContain(String(donut.circumference));
      expect(compiledSpec).toContain(String(donut.stroke_width));
    });

    it("includes bar chart tokens", () => {
      expect(compiledSpec).toContain("bar-chart-container");
      expect(compiledSpec).toContain("bar-wrapper");
      expect(compiledSpec).toContain("bar-track");
      expect(compiledSpec).toContain("bar-fill");
    });

    it("includes sparkline tokens", () => {
      expect(compiledSpec).toContain("sparkline-container");
      expect(compiledSpec).toContain("sparkline-line");
    });
  });

  describe("animation system coverage", () => {
    it("includes easing function CSS variables", () => {
      expect(compiledSpec).toContain("--ease-out-expo");
      expect(compiledSpec).toContain("--ease-out-quart");
      expect(compiledSpec).toContain("--ease-spring");
    });

    it("includes duration scale CSS variables", () => {
      expect(compiledSpec).toContain("--dur-fast");
      expect(compiledSpec).toContain("--dur-normal");
      expect(compiledSpec).toContain("--dur-slow");
      expect(compiledSpec).toContain("--dur-cinematic");
    });

    it("includes keyframe definitions", () => {
      expect(compiledSpec).toContain("@keyframes fadeUp");
      expect(compiledSpec).toContain("@keyframes fadeIn");
      expect(compiledSpec).toContain("@keyframes slideUp");
      expect(compiledSpec).toContain("@keyframes glowPulse");
    });

    it("includes animation classes", () => {
      expect(compiledSpec).toContain(".anim");
      expect(compiledSpec).toContain(".anim-scale");
      expect(compiledSpec).toContain(".anim-blur");
    });

    it("includes stagger system with d1-d7", () => {
      expect(compiledSpec).toContain(".d1");
      expect(compiledSpec).toContain(".d7");
    });
  });

  describe("layout system coverage", () => {
    it("includes shadow tokens", () => {
      const shadowKeys = Object.keys(tokens.shadows as Record<string, string>);
      for (const key of shadowKeys) {
        expect(compiledSpec).toContain(`--shadow-${key}`);
      }
    });

    it("includes border radius tokens", () => {
      const radiiKeys = Object.keys(tokens.radii as Record<string, number>);
      for (const key of radiiKeys) {
        expect(compiledSpec).toContain(`--radius-${key}`);
      }
    });

    it("includes breakpoint values", () => {
      const bp = tokens.breakpoints as Record<string, number>;
      expect(compiledSpec).toContain(`${bp.md}px`);
      expect(compiledSpec).toContain(`${bp.lg}px`);
    });

    it("includes z-index tiers", () => {
      const z = tokens.z_index as Record<string, number>;
      for (const [name, value] of Object.entries(z)) {
        expect(compiledSpec).toContain(name);
        expect(compiledSpec).toContain(String(value));
      }
    });
  });

  // ── Composition Rules ──

  describe("composition rules", () => {
    it("includes the NO PLAIN BULLETS rule", () => {
      expect(compiledSpec).toContain("NO PLAIN BULLETS");
    });

    it("includes data shape to component mapping", () => {
      expect(compiledSpec).toContain("Data Shape");
      expect(compiledSpec).toContain("Component Mapping");
    });

    it("includes slide density rules", () => {
      expect(compiledSpec).toContain("Maximum 4 finding-cards per slide");
      expect(compiledSpec).toContain("Maximum 6 stat-blocks per grid");
    });

    it("includes slide sequence", () => {
      expect(compiledSpec).toContain("Title Slide");
      expect(compiledSpec).toContain("Executive Summary");
      expect(compiledSpec).toContain("Emergence Slide");
      expect(compiledSpec).toContain("Closing Slide");
    });

    it("includes PRISM branding guidance", () => {
      expect(compiledSpec).toContain("PRISM | Intelligence");
    });
  });

  // ── PRISM Semantic System ──

  describe("PRISM semantic system", () => {
    it("includes glow color mapping", () => {
      const glowColors = (tokens.prism as Record<string, unknown>).glow_colors as Record<string, string>;
      for (const [type, cssVar] of Object.entries(glowColors)) {
        expect(compiledSpec).toContain(type);
        expect(compiledSpec).toContain(cssVar);
      }
    });

    it("includes source quality notation", () => {
      expect(compiledSpec).toContain("PRIMARY");
      expect(compiledSpec).toContain("SECONDARY");
      expect(compiledSpec).toContain("TERTIARY");
    });

    it("includes confidence badge system", () => {
      expect(compiledSpec).toContain("HIGH");
      expect(compiledSpec).toContain("MEDIUM");
      expect(compiledSpec).toContain("LOW");
    });
  });
});

// ─── Exemplar Embedding Tests ───────────────────────────────

describe("golden exemplar embedding", () => {
  let compiledSpec: string;

  beforeEach(() => {
    compiledSpec = readFileSync(OUTPUT_PATH, "utf-8");
  });

  it("embeds all 5 exemplar files", () => {
    const exemplarFiles = readdirSync(EXEMPLARS_DIR).filter((f) => f.endsWith(".html"));
    expect(exemplarFiles).toHaveLength(6);

    for (const file of exemplarFiles) {
      const content = readFileSync(resolve(EXEMPLARS_DIR, file), "utf-8").trim();
      expect(compiledSpec).toContain(content);
    }
  });

  it("formats exemplar names as title case headings", () => {
    expect(compiledSpec).toContain("### Chart Heavy");
    expect(compiledSpec).toContain("### Data Heavy");
    expect(compiledSpec).toContain("### Emergence");
    expect(compiledSpec).toContain("### Findings");
    expect(compiledSpec).toContain("### Hero Title");
    expect(compiledSpec).toContain("### Tension");
  });

  it("wraps each exemplar in html code fences", () => {
    // Each exemplar should be inside ```html ... ```
    const htmlFenceCount = (compiledSpec.match(/```html/g) ?? []).length;
    // At least 5 from exemplars + more from component examples
    expect(htmlFenceCount).toBeGreaterThanOrEqual(5);
  });

  it("includes key component tokens from hero-title exemplar", () => {
    expect(compiledSpec).toContain("hero-badge");
    expect(compiledSpec).toContain("hero-title");
    expect(compiledSpec).toContain("agent-chip");
    expect(compiledSpec).toContain("hero-stats");
    expect(compiledSpec).toContain("validation-box");
    expect(compiledSpec).toContain("framework-card");
  });

  it("includes key component tokens from data-heavy exemplar", () => {
    expect(compiledSpec).toContain("compact-table");
    expect(compiledSpec).toContain("threat-meter");
    expect(compiledSpec).toContain("threat-dot");
    expect(compiledSpec).toContain("dagger-footnote");
  });

  it("includes key component tokens from emergence exemplar", () => {
    expect(compiledSpec).toContain("emergent-slide");
    expect(compiledSpec).toContain("emergent-number");
    expect(compiledSpec).toContain("emergence-card");
    expect(compiledSpec).toContain("emergent-why");
  });

  it("includes key component tokens from tension exemplar", () => {
    expect(compiledSpec).toContain("finding-card caution");
    expect(compiledSpec).toContain("tag-gold");
  });

  it("includes key component tokens from findings exemplar", () => {
    expect(compiledSpec).toContain("toc-group-header");
    expect(compiledSpec).toContain("stat-eyebrow");
    expect(compiledSpec).toContain("stat-trend positive");
    expect(compiledSpec).toContain("source-list");
  });
});

// ─── Idempotency Test ───────────────────────────────────────

describe("compiler idempotency", () => {
  it("produces identical output on repeated runs", () => {
    const before = readFileSync(OUTPUT_PATH, "utf-8");

    // Run compiler
    execSync(`npx tsx ${COMPILER_PATH}`, {
      cwd: ROOT,
      stdio: "pipe",
    });

    const after = readFileSync(OUTPUT_PATH, "utf-8");
    expect(after).toBe(before);
  });
});

// ─── Spec Loader Tests ──────────────────────────────────────

describe("loadPresentationSpec", () => {
  // We test the loader function's behavior by checking the present.ts
  // module loading logic directly — the function prefers the compiled
  // spec at references/presentation-system.md over the embedded fallback.

  it("compiled spec exists at the expected path", () => {
    expect(existsSync(OUTPUT_PATH)).toBe(true);
  });

  it("compiled spec is not empty", () => {
    const spec = readFileSync(OUTPUT_PATH, "utf-8");
    expect(spec.length).toBeGreaterThan(1000);
  });

  it("compiled spec is substantially larger than the fallback", () => {
    // Fallback is ~50 lines / ~2500 chars. Compiled should be 10x+.
    const spec = readFileSync(OUTPUT_PATH, "utf-8");
    expect(spec.length).toBeGreaterThan(25000);
  });

  it("compiled spec contains content absent from the fallback", () => {
    const spec = readFileSync(OUTPUT_PATH, "utf-8");
    // The compiled spec has token tables, SVG geometry, keyframes —
    // none of which are in the fallback.
    expect(spec).toContain("@keyframes fadeUp");
    expect(spec).toContain("donut-chart");
    expect(spec).toContain("Golden Exemplars");
    expect(spec).toContain("Circumference");
  });
});

// ─── Source File Integrity Tests ─────────────────────────────

describe("source file integrity", () => {
  it("design-tokens.yaml exists and parses", () => {
    expect(existsSync(TOKENS_PATH)).toBe(true);
    const raw = readFileSync(TOKENS_PATH, "utf-8");
    const parsed = parseYaml(raw);
    expect(parsed).toHaveProperty("colors");
    expect(parsed).toHaveProperty("typography");
    expect(parsed).toHaveProperty("components");
    expect(parsed).toHaveProperty("charts");
    expect(parsed).toHaveProperty("keyframes");
    expect(parsed).toHaveProperty("interactions");
    expect(parsed).toHaveProperty("prism");
  });

  it("all 6 exemplar HTML files exist", () => {
    const expected = ["chart-heavy.html", "data-heavy.html", "emergence.html", "findings.html", "hero-title.html", "tension.html"];
    for (const file of expected) {
      expect(existsSync(resolve(EXEMPLARS_DIR, file))).toBe(true);
    }
  });

  it("exemplar files contain EXEMPLAR comment header", () => {
    const files = readdirSync(EXEMPLARS_DIR).filter((f) => f.endsWith(".html"));
    for (const file of files) {
      const content = readFileSync(resolve(EXEMPLARS_DIR, file), "utf-8");
      expect(content).toMatch(/<!-- EXEMPLAR:/);
    }
  });

  it("compiler script exists", () => {
    expect(existsSync(COMPILER_PATH)).toBe(true);
  });
});

// ─── CSS Class Coverage Tests ────────────────────────────────

describe("CSS class coverage", () => {
  const CSS_PATH = resolve(ROOT, "public", "styles", "presentation.css");
  let css: string;

  beforeEach(() => {
    expect(existsSync(CSS_PATH)).toBe(true);
    css = readFileSync(CSS_PATH, "utf-8");
  });

  it("includes .legend-item class", () => {
    expect(css).toContain(".legend-item");
  });

  it("includes .source-item class", () => {
    expect(css).toContain(".source-item");
  });

  it("includes .finding-card.caution class", () => {
    expect(css).toContain(".finding-card.caution");
  });

  it("includes .finding-card.regulatory class", () => {
    expect(css).toContain(".finding-card.regulatory");
  });

  it("includes .anim-scale.d1 through .anim-scale.d7 stagger delays", () => {
    for (let i = 1; i <= 7; i++) {
      expect(css).toContain(`.anim-scale.d${i}`);
    }
  });

  it("includes .anim-blur.d1 through .anim-blur.d7 stagger delays", () => {
    for (let i = 1; i <= 7; i++) {
      expect(css).toContain(`.anim-blur.d${i}`);
    }
  });
});

// ─── Exemplar Structural Tests ───────────────────────────────

describe("chart-heavy exemplar sparkline structure", () => {
  const exemplar = readFileSync(
    resolve(process.cwd(), "references/exemplars/chart-heavy.html"),
    "utf-8"
  );

  it("uses <svg class='sparkline'> not <svg class='sparkline-container'>", () => {
    expect(exemplar).not.toMatch(/svg[^>]*class="sparkline-container"/);
    expect(exemplar).toMatch(/svg[^>]*class="sparkline"/);
  });

  it("wraps sparkline SVG in a sparkline-container div", () => {
    expect(exemplar).toMatch(/class="sparkline-container"[^>]*>/);
  });
});
