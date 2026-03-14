/**
 * ComponentCatalog
 *
 * Provides:
 * - CSS class validation (extracted from presentation.css)
 * - Exemplar HTML routing by slide type
 * - Component reference generation for slide generators
 * - Planner system prompt with structured component catalog
 */

import fs from "fs";
import path from "path";

// ─── Module-level cache ───────────────────────────────────────────────────────

let _cachedClasses: Set<string> | null = null;
let _cachedExemplars: Map<string, string> | null = null;

// ─── Descriptions for major component families ────────────────────────────────

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  // Slide wrappers
  slide: "Full-viewport slide container with scroll-snap; required wrapper for every slide",
  "slide-inner": "Centered content wrapper (max 1200px); use inside every .slide",
  "slide-bg-glow": "Decorative radial glow blob; position with top/left/bottom/right inline styles",
  "slide-footer": "Fixed-position footer with three columns: attribution | stats | slide number",
  "slide-title": "Primary heading with gradient text treatment; use <h2>",
  "slide-subtitle": "Subtitle paragraph beneath slide-title; max-width 700px",
  "title-slide": "Modifier on .slide for centered hero layout with gradient background",
  "emergent-slide": "Modifier on .slide for emergence slides; adds radial glow background",
  "slide-counter": "Fixed slide counter pill (bottom center); managed by JS",
  "slide-nav-hint": "Navigation hint text (bottom center); managed by JS",

  // Navigation
  "nav-toggle": "Hamburger button to open nav panel (top right)",
  "nav-panel": "Slide-out navigation drawer; contains nav-items",
  "nav-overlay": "Dark overlay behind open nav panel",
  "nav-item": "Single navigation entry in the drawer",
  "nav-num": "Slide number within nav-item",
  "nav-label": "Slide title text within nav-item",
  "nav-tag": "Optional badge within nav-item (e.g. EMERGENT)",
  "prism-mark": "Fixed PRISM wordmark (top left); always present",
  open: "State modifier: applies to nav-panel and nav-overlay when open",
  visible: "State modifier: applies to slide-counter, anim elements",
  show: "State modifier: applies to slide-nav-hint",

  // Hero / Title components
  "hero-title": "Giant gradient headline for title slides; use <h1>",
  "hero-sub": "Subtitle paragraph for title slides",
  "hero-date": "Date / metadata line for title slides",
  "hero-badge": "Pill badge above hero-title (e.g. 'PRISM Extended Intelligence Brief')",
  "hero-stats": "4-column grid of hero-stat boxes",
  "hero-stat": "Individual stat box inside hero-stats",
  "agent-chip": "Inline chip listing a swarm agent name with colored dot",
  dot: "Colored circle inside agent-chip; set background via inline style",
  value: "Large metric value inside hero-stat",
  label: "Label text inside hero-stat",
  "validation-box": "Side-by-side container for validation-card and framework-card",
  "validation-card": "Validation methodology card; uses val-row/val-icon children",
  "framework-card": "Pipeline framework visualization card; uses framework-visual children",
  "val-row": "Single validation row with icon and text",
  "val-icon": "Circular icon (✓) inside val-row; use .green modifier",
  "framework-visual": "Flex container for fw-node / fw-arrow / fw-center pipeline viz",
  "fw-node": "Agent node pill in framework visual",
  "fw-arrow": "Arrow between nodes (→)",
  "fw-center": "Central synthesis node in framework visual",

  // Animation
  anim: "Fade-up entrance animation; add .visible via IntersectionObserver to trigger",
  "anim-scale": "Scale-in entrance animation; triggered by .visible",
  "anim-blur": "Blur-fade entrance animation; triggered by .visible",
  d1: "Stagger delay 100ms on anim/anim-scale/anim-blur",
  d2: "Stagger delay 200ms",
  d3: "Stagger delay 300ms",
  d4: "Stagger delay 400ms",
  d5: "Stagger delay 500ms",
  d6: "Stagger delay 600ms",
  d7: "Stagger delay 700ms",
  "is-visible": "Applied by JS to trigger bar-chart, line-chart, donut-chart, sparkline animations",
  animate: "Applied by JS to trigger bar-fill scaleX animation",

  // Grid layouts
  "grid-2": "2-column equal grid; preferred layout for most content slides",
  "grid-3": "3-column equal grid; ideal for stat dashboards",
  "grid-4": "4-column equal grid; compact feature comparison",
  "two-col": "2-column grid with wider gap; similar to grid-2 but with 2.5rem gap",
  "stat-grid": "Auto-fit grid of stat-cards (min 220px columns)",

  // Stat / metric components
  "stat-block": "Centered stat container with eyebrow, large number, suffix, trend",
  "stat-eyebrow": "Small uppercase label above the number in stat-block",
  "stat-number": "Large animated counter number; set data-target for JS counter",
  "stat-suffix": "Unit suffix next to stat-number (%, M, B, etc.)",
  "stat-trend": "Trend badge below number; use .positive or .negative modifier",
  "stat-card": "Bordered card containing a metric; hover lifts",
  "stat-label": "Label text inside stat-card",
  "stat-value": "Value text inside stat-card; use .positive/.negative/.warn modifiers",
  "stat-context": "Contextual note below stat-value",

  // Finding cards
  "finding-card": "Primary content card with left accent border; modifiers: .opportunity .risk .emergent .regulatory .caution",
  "finding-title": "Heading inside finding-card",
  "finding-body": "Body text inside finding-card",
  "confidence-badge": "Inline confidence indicator; modifiers: .high .medium .low",
  opportunity: "finding-card modifier: green left border for opportunities",
  risk: "finding-card modifier: red left border for risks",
  emergent: "finding-card modifier: cyan left border for emergent insights",
  regulatory: "finding-card modifier: red left border for regulatory findings",
  caution: "finding-card modifier: sand/warning left border for tensions",

  // Emergence components
  "emergent-number": "Giant background number for emergence slides (visual accent only)",
  "emergent-content": "z-index wrapper for emergence slide content",
  "emergence-card": "Violet-tinted card for cross-agent emergent insights (NOT finding-card)",
  "emergent-why": "Explanation block for multi-agent synthesis methodology",
  "emergent-why-label": "Label heading inside emergent-why",

  // Tags
  tag: "Inline pill badge; modifiers: .clinical .financial .regulatory .strategic .quality",
  clinical: "tag modifier: green",
  financial: "tag modifier: gold/warning",
  strategic: "tag modifier: blue",
  quality: "tag modifier: violet",
  "tag-red": "Standalone red tag (no .tag parent needed)",
  "tag-green": "Standalone green tag",
  "tag-blue": "Standalone blue tag",
  "tag-orange": "Standalone orange tag",
  "tag-purple": "Standalone purple tag",
  "tag-gold": "Standalone gold/warning tag",
  "tag-cyan": "Standalone cyan tag",

  // Card color variants
  "card-accent": "Left border red (accent-error)",
  "card-blue": "Left border blue (accent)",
  "card-green": "Left border green (accent-success)",
  "card-orange": "Left border orange (#f97316)",
  "card-purple": "Left border violet (accent-violet)",
  "card-gold": "Left border gold (accent-warning)",
  "card-cyan": "Left border cyan (accent-bright)",

  // Color utilities
  red: "Text color: accent-error",
  orange: "Text color: #f97316",
  green: "Text color: accent-success",
  blue: "Text color: accent",
  gold: "Text color: accent-warning",
  white: "Text color: text-primary",
  cyan: "Text color: accent-bright",
  purple: "Text color: accent-violet",
  positive: "Color modifier: green (stat-value, stat-trend, policy-box, val-icon)",
  negative: "Color modifier: red (stat-value, stat-trend)",
  warn: "Color modifier: gold (stat-value)",
  neutral: "Color modifier: blue (policy-box)",
  high: "confidence-badge modifier: green",
  medium: "confidence-badge modifier: gold",
  low: "confidence-badge modifier: red",
  highlight: "Bold primary text inline highlight",

  // SVG Chart components
  "donut-chart": "SVG donut chart container; add .is-visible to trigger segment animation",
  segment: "SVG circle element inside donut-chart; set stroke-dasharray/offset for data",
  "donut-wrapper": "Flex column wrapper centering donut-chart above legend",
  "chart-legend": "Flex-wrap list of legend-item elements below a chart",
  "legend-item": "Single legend row with legend-dot and label text",
  "legend-dot": "Colored circle inside legend-item; set background via inline style",
  "bar-chart": "SVG bar chart container; add .is-visible to trigger bar animation",
  bar: "SVG rect element inside bar-chart; transform-origin:bottom for animation",
  "line-chart": "SVG line chart with animated clip-rect reveal",
  "clip-rect": "SVG clipPath rect inside line-chart; animated width",
  "data-points": "SVG group of data circles inside line-chart",
  "chart-container": "Generic chart wrapper with 1rem vertical margin",
  "sparkline-container": "Inline 80×24px wrapper for sparkline SVG",
  sparkline: "Small inline SVG trend line; add .is-visible to animate",
  "sparkline-line": "SVG polyline inside sparkline; uses stroke-dashoffset animation",
  "sparkline-dot": "SVG endpoint circle inside sparkline; fades in after line animates",

  // Horizontal bar / comparison
  "comparison-bars": "Container for a set of bar-row elements",
  "bar-row": "Single horizontal bar entry with label and track",
  "bar-label": "Label column (min-width 120px) in bar-row",
  "bar-track": "Gray track container for bar-fill",
  "bar-fill": "Colored fill inside bar-track; scaleX(0) initially, .animate triggers",
  "bar-fill-value": "Value label text inside bar-fill",

  // Table components
  "compact-table": "Dense data table with 6px padding; ideal for structured comparisons",
  "prov-table": "Provenance/sources table with 1rem padding",

  // Timeline
  timeline: "Horizontal timeline with connecting gradient line",
  "timeline-phase": "Single phase node in the timeline",
  "timeline-dot": "Circle marker for timeline-phase",
  "timeline-year": "Year label above timeline-dot",
  "timeline-label": "Phase name below timeline-dot",
  "timeline-items": "Bullet list of items within a timeline-phase",
  "timeline-bar": "Horizontal segmented progress bar for pipeline progress",
  "timeline-segment": "Individual segment inside timeline-bar",
  "tl-done": "timeline-segment modifier: green (complete)",
  "tl-active": "timeline-segment modifier: gold (in-progress)",
  "tl-pending": "timeline-segment modifier: gray (pending)",
  "pipeline-caption": "Caption below timeline-bar",

  // Threat meter
  "threat-meter": "Row of 5 threat-dot indicators",
  "threat-dot": "Single dot indicator; modifiers: .active-red .active-orange .active-yellow .active-green .active-blue",
  "active-red": "threat-dot modifier: red fill",
  "active-orange": "threat-dot modifier: orange fill",
  "active-yellow": "threat-dot modifier: yellow fill",
  "active-green": "threat-dot modifier: green fill",
  "active-blue": "threat-dot modifier: blue fill",

  // State grid
  "state-grid": "3-column grid of state-item cards",
  "state-item": "Individual state card with state-name and state-impact",
  "state-name": "State abbreviation or name inside state-item",
  "state-impact": "Impact value or label inside state-item",

  // Policy box
  "policy-box": "Tinted box for policy/regulatory context; modifiers: .positive .neutral (default is red/risk)",

  // Quote
  "quote-block": "Left-bordered italic quote with gold accent",
  "quote-attr": "Attribution line below quote-block",

  // Typography / layout
  eyebrow: "Small secondary label row above slide-title; contains tag + agent name",
  "section-intro": "Intro paragraph beneath slide-title (max 800px, 13.5px)",

  // Source / attribution
  "source-list": "Tiny source footnote row at slide bottom",
  "source-item": "Individual source entry inside source-list",
  "source-unverified": "Superscript dagger for unverified/secondary sources",
  "dagger-footnote": "Absolute-positioned footnote at slide bottom",

  // Impact labels
  impact: "Flex row for impact severity label with icon",
  "impact-severe": "Red impact label",
  "impact-moderate": "Gold impact label",
  "impact-positive": "Green impact label",
  "impact-neutral": "Blue impact label",

  // TOC
  "toc-group-header": "Section header within a table-of-contents slide",
  "toc-item": "Individual TOC entry with border",

  // Header
  "inovalon-header": "Branded header banner with teal-to-green gradient border",
};

// ─── ComponentCatalog class ───────────────────────────────────────────────────

export class ComponentCatalog {
  readonly validClasses: Set<string>;
  private exemplars: Map<string, string>;

  constructor() {
    this.validClasses = loadValidClasses();
    this.exemplars = loadExemplars();
  }

  /**
   * Returns exemplar HTML for a given slide type.
   * Routes to the most relevant exemplar based on slide purpose.
   */
  exemplarForSlideType(type: string): string {
    const routingTable: Record<string, string> = {
      title: "hero-title",
      "executive-summary": "hero-title",
      "dimension-deep-dive": "findings",
      "data-metrics": "chart-heavy",
      emergence: "emergence",
      tension: "tension",
      "findings-toc": "data-heavy",
      closing: "hero-title",
    };

    const key = routingTable[type] ?? "findings";
    return this.exemplars.get(key) ?? this.exemplars.get("findings") ?? "";
  }

  /**
   * Generates a compact markdown reference for the given class names.
   */
  componentReference(classes: string[]): string {
    const lines: string[] = ["## Component Reference\n"];
    for (const cls of classes) {
      const desc = COMPONENT_DESCRIPTIONS[cls];
      if (desc) {
        lines.push(`- \`.${cls}\` — ${desc}`);
      } else {
        lines.push(`- \`.${cls}\` — CSS class defined in presentation.css`);
      }
    }
    return lines.join("\n");
  }

  /**
   * Generates a structured ~3KB planner system prompt listing component families.
   * Contains NO raw HTML — only class names and descriptions.
   */
  plannerSystemPrompt(): string {
    return `# PRISM Component Catalog

Use ONLY these CSS classes from presentation.css. Do not invent class names.

## SLIDE WRAPPERS (required)
- \`.slide\` — Full-viewport slide container (scroll-snap)
- \`.slide-inner\` — Centered content wrapper (max 1200px); inside every slide
- \`.slide-bg-glow\` — Decorative radial glow; position via inline style
- \`.slide-footer\` — Three-column footer row
- \`.title-slide\` — Modifier on .slide for hero/title layouts
- \`.emergent-slide\` — Modifier on .slide for emergence slides

## TYPOGRAPHY
- \`.hero-title\` — Giant gradient headline <h1> (title slides only)
- \`.hero-sub / .hero-date / .hero-badge\` — Title slide secondary elements
- \`.slide-title\` — Primary heading <h2> with gradient text
- \`.slide-subtitle\` — Subtitle paragraph beneath slide-title
- \`.eyebrow\` — Small label row above slide-title (tag + agent name)
- \`.section-intro\` — Framing paragraph (13.5px, max 800px)

## ANIMATION (all require JS .visible trigger via IntersectionObserver)
- \`.anim\` — Fade-up entrance
- \`.anim-scale\` — Scale-in entrance
- \`.anim-blur\` — Blur-fade entrance
- \`.d1–.d7\` — Stagger delays (100ms–700ms)
- \`.is-visible\` — Triggers chart animations (bar-chart, donut-chart, line-chart, sparkline)

## GRID LAYOUTS
- \`.grid-2\` — 2-column equal grid (most common)
- \`.grid-3\` — 3-column stat dashboard
- \`.grid-4\` — 4-column compact grid
- \`.two-col\` — 2-column with larger gap
- \`.stat-grid\` — Auto-fit grid of stat-cards

## CHART COMPONENTS
- \`.donut-chart\` — SVG donut with animated .segment circles
- \`.bar-chart\` — SVG bar chart with animated .bar rects
- \`.line-chart\` — SVG line with .clip-rect reveal animation
- \`.sparkline-container / .sparkline / .sparkline-line / .sparkline-dot\` — Inline trend line
- \`.chart-legend / .legend-item / .legend-dot\` — Chart legend row
- \`.donut-wrapper\` — Centers donut above legend
- \`.chart-container\` — Generic chart wrapper

## STAT / METRIC COMPONENTS
- \`.stat-block\` — Centered stat with eyebrow, number, suffix, trend
- \`.stat-eyebrow\` — Uppercase label above number
- \`.stat-number\` — Large animated number; set data-target for counter
- \`.stat-suffix\` — Unit (%, M, B)
- \`.stat-trend\` — Trend badge; .positive (green) / .negative (red)
- \`.stat-card / .stat-label / .stat-value / .stat-context\` — Card variant

## FINDING CARDS
- \`.finding-card\` — Left-bordered content card; modifiers: .opportunity .risk .emergent .regulatory .caution
- \`.finding-title\` — Card heading
- \`.finding-body\` — Card body text
- \`.confidence-badge\` — .high (green) / .medium (gold) / .low (red)

## EMERGENCE COMPONENTS
- \`.emergent-number\` — Giant background number (visual accent)
- \`.emergent-content\` — z-index wrapper for emergence content
- \`.emergence-card\` — Violet-tinted cross-agent insight card
- \`.emergent-why / .emergent-why-label\` — Methodology explanation block

## TAGS & COLOR CHIPS
- \`.tag\` — Inline pill; modifiers: .clinical .financial .regulatory .strategic .quality
- \`.tag-red / .tag-green / .tag-blue / .tag-orange / .tag-purple / .tag-gold / .tag-cyan\` — Colored standalone tags
- \`.card-blue / .card-green / .card-orange / .card-purple / .card-gold / .card-cyan\` — Left-border card color variants

## DATA VISUALIZATION (non-SVG)
- \`.comparison-bars / .bar-row / .bar-label / .bar-track / .bar-fill\` — Horizontal bar rows
- \`.compact-table\` — Dense comparison table
- \`.threat-meter / .threat-dot\` — 5-dot severity indicator (.active-red/orange/yellow/green/blue)
- \`.state-grid / .state-item\` — State/region comparison grid

## SPECIAL COMPONENTS
- \`.timeline / .timeline-phase / .timeline-dot / .timeline-year / .timeline-label\` — Horizontal timeline
- \`.timeline-bar / .timeline-segment / .tl-done / .tl-active / .tl-pending\` — Pipeline progress bar
- \`.quote-block / .quote-attr\` — Pull quote with gold left border
- \`.policy-box\` — Tinted policy context box (.positive/.neutral)
- \`.source-list / .source-item / .dagger-footnote\` — Source attribution
- \`.hero-stats / .hero-stat / .agent-chip / .validation-box / .validation-card / .framework-card\` — Title slide components
- \`.inovalon-header\` — Branded header banner

## COLOR UTILITIES
Text: \`.red .orange .green .blue .gold .white .cyan .purple\`
State: \`.positive .negative .warn .neutral .high .medium .low\`
Impact: \`.impact-severe .impact-moderate .impact-positive .impact-neutral\`
`;
  }
}

// ─── Private loader functions ─────────────────────────────────────────────────

function loadValidClasses(): Set<string> {
  if (_cachedClasses) return _cachedClasses;

  const cssPath = path.resolve(process.cwd(), "public/styles/presentation.css");
  const css = fs.readFileSync(cssPath, "utf8");

  const classes = new Set<string>();
  // Match all .classname patterns — handles compound selectors like .finding-card.caution
  const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = classRegex.exec(css)) !== null) {
    classes.add(m[1]);
  }

  _cachedClasses = classes;
  return classes;
}

function loadExemplars(): Map<string, string> {
  if (_cachedExemplars) return _cachedExemplars;

  const exemplars = new Map<string, string>();
  const exemplarDir = path.resolve(process.cwd(), "references/exemplars");
  const fragmentDir = path.resolve(exemplarDir, "fragments");

  // Load root exemplars (keyed by filename without extension)
  if (fs.existsSync(exemplarDir)) {
    for (const file of fs.readdirSync(exemplarDir)) {
      if (file.endsWith(".html")) {
        const key = file.replace(/\.html$/, "");
        const content = fs.readFileSync(path.join(exemplarDir, file), "utf8");
        exemplars.set(key, content);
      }
    }
  }

  // Load fragment exemplars (keyed as "fragments/name")
  if (fs.existsSync(fragmentDir)) {
    for (const file of fs.readdirSync(fragmentDir)) {
      if (file.endsWith(".html")) {
        const key = `fragments/${file.replace(/\.html$/, "")}`;
        const content = fs.readFileSync(path.join(fragmentDir, file), "utf8");
        exemplars.set(key, content);
      }
    }
  }

  _cachedExemplars = exemplars;
  return exemplars;
}
