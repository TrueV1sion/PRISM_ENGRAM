/**
 * Structural HTML Validator
 *
 * Validates generated presentation HTML against the presentation.css design system.
 * Extracts valid CSS class names independently from the CSS file and checks
 * each slide for structural integrity, class name correctness, and quality metrics.
 *
 * Exports: validate(html: string): QualityScorecard
 */

import fs from "fs";
import path from "path";
import type { QualityScorecard, QualityMetrics, MetricScore, SlideIssue } from "./types";

// ─── CSS Class Extraction ─────────────────────────────────────────────────────

/** Load and cache valid CSS class names from presentation.css at module load time. */
const CSS_PATH = path.resolve(process.cwd(), "public/styles/presentation.css");

function extractCssClasses(css: string): Set<string> {
  const classes = new Set<string>();
  // Match .className patterns — class selectors (including compound selectors)
  const classPattern = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = classPattern.exec(css)) !== null) {
    classes.add(match[1]);
  }
  return classes;
}

/** Extra utility/runtime classes that are applied via JS or conventions not in CSS. */
const UTILITY_CLASSES = new Set([
  "visible",
  "animate",
  "is-visible",
  "active",
  "open",
  "show",
  "hidden",
  "loaded",
  "playing",
  "paused",
  "focused",
  "disabled",
  "selected",
  "expanded",
  "collapsed",
  "current",
  "first",
  "last",
  "odd",
  "even",
]);

let _validClasses: Set<string> | null = null;

function getValidClasses(): Set<string> {
  if (_validClasses !== null) return _validClasses;
  let css = "";
  try {
    css = fs.readFileSync(CSS_PATH, "utf-8");
  } catch {
    // If CSS file is not found, fall back to an empty set (graceful degradation)
    _validClasses = new Set([...UTILITY_CLASSES]);
    return _validClasses;
  }
  const fromCss = extractCssClasses(css);
  _validClasses = new Set([...fromCss, ...UTILITY_CLASSES]);
  return _validClasses;
}

// ─── HTML Parsing Utilities ────────────────────────────────────────────────────

/** Extract the value of a named attribute from an HTML string. */
function extractAttrValue(html: string, attrName: string): string | null {
  const re = new RegExp(`${attrName}="([^"]*)"`, "g");
  const match = re.exec(html);
  return match ? match[1] : null;
}

/** Extract all class attribute values from an HTML fragment. */
function extractAllClassValues(html: string): string[] {
  const results: string[] = [];
  const re = /class="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/** Split a class attribute value into individual class names. */
function splitClasses(classValue: string): string[] {
  return classValue.split(/\s+/).filter(Boolean);
}

/**
 * Parse slides from a full HTML document. Returns an array of slide HTML strings.
 * Each slide is a `<section class="slide"...>...</section>` block.
 */
function parseSlides(html: string): string[] {
  const slides: string[] = [];
  // Match opening <section ... class="slide" ...> tags (handles attribute ordering)
  const sectionOpenRe = /<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = sectionOpenRe.exec(html)) !== null) {
    const openTagEnd = match.index + match[0].length;
    // Find the matching </section> tag by walking through nested sections
    let depth = 1;
    let pos = openTagEnd;
    while (pos < html.length && depth > 0) {
      const nextOpen = html.indexOf("<section", pos);
      const nextClose = html.indexOf("</section>", pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 8; // skip past "<section"
      } else {
        depth--;
        if (depth === 0) {
          slides.push(html.slice(match.index, nextClose + 10));
        }
        pos = nextClose + 10; // skip past "</section>"
      }
    }
  }

  return slides;
}

// ─── Metric Scorers ────────────────────────────────────────────────────────────

interface SlideAnalysis {
  slideNumber: number;
  html: string;
  classes: string[];
  hasSlideInner: boolean;
  hasSlideFooter: boolean;
  hasSlideBgGlow: boolean;
  hasChartComponent: boolean;
  animTypes: Set<string>;
  hasDataTarget: boolean;
  hasEmergenceClass: boolean;
  footerHasSource: boolean;
}

const CHART_CLASSES = ["donut-chart", "bar-chart", "sparkline", "line-chart"];
const ANIM_CLASSES = ["anim", "anim-scale", "anim-blur"];
const EMERGENCE_CLASSES = ["emergent-slide", "emergence-card", "emergent-content", "emergent-why", "emergent-number"];

function analyzeSlide(html: string, slideNumber: number): SlideAnalysis {
  const classValues = extractAllClassValues(html);
  const classes: string[] = [];
  for (const val of classValues) {
    classes.push(...splitClasses(val));
  }
  const classSet = new Set(classes);

  const hasSlideInner = html.includes('class="slide-inner"') || /class="[^"]*\bslide-inner\b[^"]*"/.test(html);
  const hasSlideFooter = html.includes('class="slide-footer"') || /class="[^"]*\bslide-footer\b[^"]*"/.test(html);
  const hasSlideBgGlow = html.includes('class="slide-bg-glow"') || /class="[^"]*\bslide-bg-glow\b[^"]*"/.test(html);

  const hasChartComponent = CHART_CLASSES.some(c => classSet.has(c));

  const animTypes = new Set<string>();
  for (const animClass of ANIM_CLASSES) {
    if (classSet.has(animClass)) animTypes.add(animClass);
  }

  const hasDataTarget = /data-target\s*=/.test(html);

  const hasEmergenceClass = EMERGENCE_CLASSES.some(c => classSet.has(c));

  // Check slide-footer for source attribution
  let footerHasSource = false;
  const footerMatch = html.match(/<div[^>]*class="[^"]*\bslide-footer\b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  if (footerMatch) {
    const footerContent = footerMatch[1].toLowerCase();
    footerHasSource =
      footerContent.includes("source") ||
      footerContent.includes("prism") ||
      footerContent.includes("slide") ||
      footerContent.includes("data");
  }

  return {
    slideNumber,
    html,
    classes,
    hasSlideInner,
    hasSlideFooter,
    hasSlideBgGlow,
    hasChartComponent,
    animTypes,
    hasDataTarget,
    hasEmergenceClass,
    footerHasSource,
  };
}

// ─── Main Validator ────────────────────────────────────────────────────────────

export function validate(html: string): QualityScorecard {
  const validClasses = getValidClasses();
  const slides = parseSlides(html);
  const perSlideIssues: SlideIssue[] = [];

  // Analyze each slide
  const analyses: SlideAnalysis[] = slides.map((slideHtml, idx) =>
    analyzeSlide(slideHtml, idx + 1)
  );

  // ─── Metric 1: classNameValidity (weight 30) ─────────────────────────────
  let totalClasses = 0;
  let validClassCount = 0;

  for (const analysis of analyses) {
    for (const cls of analysis.classes) {
      totalClasses++;
      if (validClasses.has(cls)) {
        validClassCount++;
      } else {
        perSlideIssues.push({
          slideNumber: analysis.slideNumber,
          severity: "warning",
          message: `Unknown CSS class: "${cls}"`,
          className: cls,
        });
      }
    }
  }

  const classNameValidityScore = totalClasses === 0 ? 100 : Math.round((validClassCount / totalClasses) * 100);

  const classNameValidity: MetricScore = {
    score: classNameValidityScore,
    weight: 30,
    details:
      totalClasses === 0
        ? "No class names found"
        : `${validClassCount}/${totalClasses} class names are valid`,
  };

  // ─── Metric 2: structuralIntegrity (weight 25) ──────────────────────────
  const STRUCTURAL_ELEMENTS = ["slide-inner", "slide-footer", "slide-bg-glow"] as const;
  let structuralDeductions = 0;
  let maxStructuralDeductions = 0;

  for (const analysis of analyses) {
    maxStructuralDeductions += STRUCTURAL_ELEMENTS.length;
    if (!analysis.hasSlideInner) {
      structuralDeductions++;
      perSlideIssues.push({
        slideNumber: analysis.slideNumber,
        severity: "error",
        message: "Missing required element: slide-inner",
      });
    }
    if (!analysis.hasSlideFooter) {
      structuralDeductions++;
      perSlideIssues.push({
        slideNumber: analysis.slideNumber,
        severity: "error",
        message: "Missing required element: slide-footer",
      });
    }
    if (!analysis.hasSlideBgGlow) {
      structuralDeductions++;
      perSlideIssues.push({
        slideNumber: analysis.slideNumber,
        severity: "warning",
        message: "Missing recommended element: slide-bg-glow",
      });
    }
  }

  const structuralIntegrityScore =
    analyses.length === 0 || maxStructuralDeductions === 0
      ? 100
      : Math.round(((maxStructuralDeductions - structuralDeductions) / maxStructuralDeductions) * 100);

  const structuralIntegrity: MetricScore = {
    score: structuralIntegrityScore,
    weight: 25,
    details:
      analyses.length === 0
        ? "No slides found"
        : `${structuralDeductions} structural issues across ${analyses.length} slides`,
  };

  // ─── Metric 3: chartAdoption (weight 10) ────────────────────────────────
  const slidesWithCharts = analyses.filter(a => a.hasChartComponent).length;
  // Score based on proportion of slides using charts; bonus for any chart usage
  const chartAdoptionScore =
    analyses.length === 0
      ? 100
      : slidesWithCharts > 0
        ? Math.min(100, 50 + Math.round((slidesWithCharts / analyses.length) * 50))
        : 0;

  const chartAdoption: MetricScore = {
    score: chartAdoptionScore,
    weight: 10,
    details: `${slidesWithCharts}/${analyses.length} slides use chart components`,
  };

  // ─── Metric 4: animationVariety (weight 10) ──────────────────────────────
  const allAnimTypes = new Set<string>();
  for (const analysis of analyses) {
    for (const t of analysis.animTypes) {
      allAnimTypes.add(t);
    }
  }
  const slidesWithAnim = analyses.filter(a => a.animTypes.size > 0).length;
  // Score based on variety (1 type = 60, 2 = 80, 3 = 100) and adoption
  const varietyScore = allAnimTypes.size === 0 ? 0 : Math.min(100, 40 + allAnimTypes.size * 20);
  const adoptionScore = analyses.length === 0 ? 100 : Math.round((slidesWithAnim / analyses.length) * 100);
  const animationVarietyScore = analyses.length === 0 ? 100 : Math.round((varietyScore + adoptionScore) / 2);

  const animationVariety: MetricScore = {
    score: animationVarietyScore,
    weight: 10,
    details: `${allAnimTypes.size} animation type(s) used across ${slidesWithAnim}/${analyses.length} slides`,
  };

  // ─── Metric 5: counterAdoption (weight 5) ────────────────────────────────
  const slidesWithCounters = analyses.filter(a => a.hasDataTarget).length;
  const counterAdoptionScore =
    analyses.length === 0
      ? 100
      : slidesWithCounters > 0
        ? Math.min(100, 50 + Math.round((slidesWithCounters / analyses.length) * 50))
        : 30; // baseline — counters are optional but encouraged

  const counterAdoption: MetricScore = {
    score: counterAdoptionScore,
    weight: 5,
    details: `${slidesWithCounters}/${analyses.length} slides use animated counters (data-target)`,
  };

  // ─── Metric 6: emergenceHierarchy (weight 10) ────────────────────────────
  const slidesWithEmergence = analyses.filter(a => a.hasEmergenceClass).length;
  const emergenceHierarchyScore =
    analyses.length === 0
      ? 100
      : slidesWithEmergence > 0
        ? Math.min(100, 50 + Math.round((slidesWithEmergence / analyses.length) * 50))
        : 30; // baseline — emergence is optional but encouraged

  const emergenceHierarchy: MetricScore = {
    score: emergenceHierarchyScore,
    weight: 10,
    details: `${slidesWithEmergence}/${analyses.length} slides use emergence hierarchy classes`,
  };

  // ─── Metric 7: sourceAttribution (weight 10) ─────────────────────────────
  const slidesWithSource = analyses.filter(a => a.footerHasSource).length;
  const sourceAttributionScore =
    analyses.length === 0
      ? 100
      : Math.round((slidesWithSource / analyses.length) * 100);

  const sourceAttribution: MetricScore = {
    score: sourceAttributionScore,
    weight: 10,
    details: `${slidesWithSource}/${analyses.length} slides have source attribution in footer`,
  };

  // ─── Overall Score (weighted average) ────────────────────────────────────
  const metrics: QualityMetrics = {
    classNameValidity,
    structuralIntegrity,
    chartAdoption,
    animationVariety,
    counterAdoption,
    emergenceHierarchy,
    sourceAttribution,
  };

  const totalWeight = Object.values(metrics).reduce((sum, m) => sum + m.weight, 0);
  const weightedSum = Object.values(metrics).reduce((sum, m) => sum + m.score * m.weight, 0);
  const overall = Math.round(weightedSum / totalWeight);

  // ─── Grade Assignment ─────────────────────────────────────────────────────
  let grade: string;
  if (overall >= 95) grade = "A+";
  else if (overall >= 90) grade = "A";
  else if (overall >= 85) grade = "B+";
  else if (overall >= 80) grade = "B";
  else if (overall >= 75) grade = "C+";
  else if (overall >= 70) grade = "C";
  else if (overall >= 60) grade = "D";
  else grade = "F";

  return {
    metrics,
    overall,
    grade,
    perSlideIssues,
  };
}
