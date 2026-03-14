#!/usr/bin/env npx tsx
/**
 * PRISM Presentation System Compiler
 *
 * Reads design-tokens.yaml and golden exemplars, compiles them into
 * references/presentation-system.md — the system prompt that Claude
 * receives during the PRESENT phase.
 *
 * Usage:
 *   npx tsx scripts/compile-presentation-spec.ts
 *   npm run spec:compile
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(import.meta.dirname ?? __dirname, "..");
const TOKENS_PATH = resolve(ROOT, "design-tokens.yaml");
const EXEMPLARS_DIR = resolve(ROOT, "references", "exemplars");
const OUTPUT_PATH = resolve(ROOT, "references", "presentation-system.md");

// ─── Load & Parse ───────────────────────────────────────────

const rawYaml = readFileSync(TOKENS_PATH, "utf-8");
const tokens = parseYaml(rawYaml) as Record<string, unknown>;

const colors = tokens.colors as Record<string, string>;
const typography = tokens.typography as Record<string, unknown>;
const spacing = tokens.spacing as Record<string, unknown>;
const shadows = tokens.shadows as Record<string, string>;
const radii = tokens.radii as Record<string, number>;
const transitions = tokens.transitions as Record<string, unknown>;
const breakpoints = tokens.breakpoints as Record<string, number>;
const zIndex = tokens.z_index as Record<string, number>;
const prism = tokens.prism as Record<string, unknown>;
const charts = tokens.charts as Record<string, unknown>;
const keyframes = tokens.keyframes as Record<string, unknown>;
const interactions = tokens.interactions as Record<string, unknown>;
const components = tokens.components as Record<string, unknown>;

// ─── Helpers ────────────────────────────────────────────────

function colorTable(subset: [string, string, string][]): string {
  const header = "| Token | CSS Variable | Value | Usage |";
  const sep = "|-------|-------------|-------|-------|";
  const rows = subset.map(([name, value, usage]) => `| ${name} | \`--${name}\` | \`${value}\` | ${usage} |`);
  return [header, sep, ...rows].join("\n");
}

function extractComment(key: string): string {
  // Extract inline YAML comment for this key from raw source
  const regex = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*"[^"]*"\\s*#\\s*(.+)$`, "m");
  const match = rawYaml.match(regex);
  return match?.[1]?.trim() ?? "";
}

function objTable(obj: Record<string, unknown>, cols: [string, string]): string {
  const header = `| ${cols[0]} | ${cols[1]} |`;
  const sep = "|-------|-------|";
  const rows = Object.entries(obj).map(([k, v]) => `| \`${k}\` | \`${String(v)}\` |`);
  return [header, sep, ...rows].join("\n");
}

// ─── Section Builders ───────────────────────────────────────

function buildSection1(): string {
  return `# PRISM Presentation System

> **Compiled from design-tokens.yaml (PRISM v4.1)**
> Single source of truth for all PRISM Intelligence presentations.

You are a presentation generator for PRISM Intelligence briefs. You produce
complete, self-contained HTML5 documents with executive-grade visual design.

## Output Format

Generate a complete HTML5 document. Output ONLY raw HTML starting with \`<!DOCTYPE html>\`.

### Required External Assets
Include these in \`<head>\`:
\`\`\`html
<link rel="stylesheet" href="/styles/presentation.css">
<script src="/js/presentation.js" defer></script>
\`\`\`

Do NOT write any inline \`<style>\` or \`<script>\` tags. All styles come from
the external CSS file. All behavior comes from the external JS file.

### Slide Structure
Every slide MUST follow this skeleton:
\`\`\`html
<section class="slide" id="slide-N">
  <div class="slide-bg-glow"></div>
  <div class="slide-inner">
    <!-- content here -->
  </div>
  <div class="slide-footer">
    <span>PRISM Intelligence</span>
    <span>Source: [tier] — [description]</span>
    <span>Slide N of T</span>
  </div>
</section>
\`\`\`
The \`slide-footer\` is MANDATORY on every slide. Never omit it.`;
}

function buildSection2(): string {
  // Brand palette
  const brandColors: [string, string, string][] = [
    ["inov-navy", colors["inov-navy"], extractComment("inov-navy") || "Corporate primary"],
    ["inov-cerulean", colors["inov-cerulean"], extractComment("inov-cerulean") || "Interactive default"],
    ["inov-sky", colors["inov-sky"], extractComment("inov-sky") || "Accent bright"],
    ["inov-midnight", colors["inov-midnight"], extractComment("inov-midnight") || "Deep background"],
    ["inov-jade", colors["inov-jade"], extractComment("inov-jade") || "Success/positive"],
    ["inov-sand", colors["inov-sand"], extractComment("inov-sand") || "Warning/caution"],
    ["inov-violet", colors["inov-violet"], extractComment("inov-violet") || "Emergence/creative"],
    ["inov-cloud", colors["inov-cloud"], extractComment("inov-cloud") || "Light surface"],
  ];

  // Surface system
  const surfaceColors: [string, string, string][] = [
    ["bg-primary", colors["bg-primary"], extractComment("bg-primary") || "Canvas"],
    ["bg-secondary", colors["bg-secondary"], extractComment("bg-secondary") || "Section background"],
    ["bg-tertiary", colors["bg-tertiary"], extractComment("bg-tertiary") || "Recessed areas"],
    ["bg-elevated", colors["bg-elevated"], extractComment("bg-elevated") || "Cards, panels"],
    ["bg-card", colors["bg-card"], extractComment("bg-card") || "Frosted glass overlay"],
  ];

  // Text hierarchy
  const textColors: [string, string, string][] = [
    ["text-primary", colors["text-primary"], extractComment("text-primary") || "Headlines, primary content"],
    ["text-secondary", colors["text-secondary"], extractComment("text-secondary") || "Body text, descriptions"],
    ["text-tertiary", colors["text-tertiary"], extractComment("text-tertiary") || "Labels, metadata, captions"],
  ];

  // Semantic accents
  const accentColors: [string, string, string][] = [
    ["accent", colors["accent"], extractComment("accent") || "Default interactive"],
    ["accent-bright", colors["accent-bright"], extractComment("accent-bright") || "Hero text, emergent highlights"],
    ["accent-success", colors["accent-success"], extractComment("accent-success") || "Positive outcomes, opportunity"],
    ["accent-warning", colors["accent-warning"], extractComment("accent-warning") || "Caution, medium confidence"],
    ["accent-error", colors["accent-error"], extractComment("accent-error") || "Risk, tension, negative"],
    ["accent-violet", colors["accent-violet"], extractComment("accent-violet") || "Emergence, regulatory"],
  ];

  // State colors
  const stateColors: [string, string, string][] = [
    ["accent-hover", colors["accent-hover"], extractComment("accent-hover") || "Hover state"],
    ["accent-active", colors["accent-active"], extractComment("accent-active") || "Active/pressed state"],
    ["accent-disabled", colors["accent-disabled"], extractComment("accent-disabled") || "Disabled elements"],
  ];

  // Border system
  const borderColors: [string, string, string][] = [
    ["border", colors["border"], extractComment("border") || "Subtle structural"],
    ["border-bright", colors["border-bright"], extractComment("border-bright") || "Emphasis, focus"],
  ];

  // Chart palette
  const chartColors: [string, string, string][] = Array.from({ length: 8 }, (_, i) => {
    const key = `chart-${i + 1}`;
    return [key, colors[key], extractComment(key) || `Chart color ${i + 1}`] as [string, string, string];
  });

  return `## Brand Identity & Color System

### Inovalon Brand Palette (Source of Truth)
All theme tokens derive from these 8 brand colors:

${colorTable(brandColors)}

### Executive Dark Theme — Surface System
5-tier depth hierarchy, darkest to lightest:

${colorTable(surfaceColors)}

### Text Hierarchy
3-tier text system with APCA contrast validation:

${colorTable(textColors)}

### Semantic Accent Colors
Function-mapped colors — use these for meaning, not decoration:

${colorTable(accentColors)}

### Derived State Colors

${colorTable(stateColors)}

### Border System

${colorTable(borderColors)}

### Chart Color Palette
8-stop sequence for data visualization:

${colorTable(chartColors)}

### Component-Level Semantic Tokens
These map finding types to border colors:

| Finding Type | CSS Variable | Color | Used On |
|-------------|-------------|-------|---------|
| Default | \`--finding-border-default\` | \`${colors["finding-border-default"]}\` | Standard findings |
| Emergent | \`--finding-border-emergent\` | \`${colors["finding-border-emergent"]}\` | Novel multi-agent insights |
| Risk | \`--finding-border-risk\` | \`${colors["finding-border-risk"]}\` | Threats, negative outcomes |
| Opportunity | \`--finding-border-opportunity\` | \`${colors["finding-border-opportunity"]}\` | Positive outcomes |
| Regulatory | \`--finding-border-regulatory\` | \`${colors["finding-border-regulatory"]}\` | Policy, compliance |
| Caution | \`--finding-border-caution\` | \`${colors["finding-border-caution"]}\` | Uncertain, mixed signals |`;
}

function buildSection3(): string {
  const fluidSizes = typography.fluid_sizes as Record<string, { min: string; preferred: string; max: string }>;
  const lineHeights = typography.line_height as Record<string, number>;
  const tracking = typography.tracking as Record<string, string>;

  const sizeRows = Object.entries(fluidSizes)
    .map(([name, { min, preferred, max }]) =>
      `| \`--text-${name}\` | \`clamp(${min}, ${preferred}, ${max})\` |`,
    )
    .join("\n");

  const lhRows = Object.entries(lineHeights)
    .map(([name, value]) => `| \`${name}\` | \`${value}\` |`)
    .join("\n");

  const trackRows = Object.entries(tracking)
    .map(([name, value]) => `| \`--tracking-${name}\` | \`${value}\` |`)
    .join("\n");

  return `## Typography Scale

### Font Families
- Sans: \`${typography.font_family_sans}\`
- Mono: \`${typography.font_family_mono}\`

### Modular Scale
Base: ${typography.base_size}rem (16px) | Ratio: Perfect Fourth (1.333)

### Fluid Type Sizes (viewport-responsive via clamp())

| CSS Variable | Value |
|-------------|-------|
${sizeRows}

### Font Weights

| Name | Value |
|------|-------|
| Regular | ${typography.weight_regular} |
| Medium | ${typography.weight_medium} |
| Semibold | ${typography.weight_semibold} |
| Bold | ${typography.weight_bold} |
| Extrabold | ${typography.weight_extrabold} |
| Black | ${typography.weight_black} |

### Line Heights (size-adaptive)

| Context | Value |
|---------|-------|
${lhRows}

### Letter Spacing

| Token | Value |
|-------|-------|
${trackRows}

**Rules:**
- Hero/large headings: \`tight\` line-height + \`tightest\` letter-spacing
- Subheadings: \`snug\` line-height + \`tight\` letter-spacing
- Body text: \`normal\` line-height + \`normal\` letter-spacing
- Eyebrow labels: \`widest\` letter-spacing + uppercase + \`--text-xs\``;
}

function buildSection4(): string {
  const fc = components.finding_card as Record<string, string>;
  const ct = components.compact_table as Record<string, string>;
  const cb = components.confidence_badge as Record<string, string | number>;
  const hs = components.hero_stat as Record<string, string | number>;
  const sl = components.source_list as Record<string, string>;
  const ey = components.eyebrow as Record<string, string | number>;
  const slide = components.slide as Record<string, string | number>;

  return `## Component Library

### Finding Card
\`\`\`html
<div class="finding-card opportunity">
  <div class="finding-title">Title Text</div>
  <div class="finding-body">Body content...</div>
  <span class="confidence-badge high">HIGH CONFIDENCE</span>
</div>
\`\`\`
- Container: \`.finding-card\` | Background: \`var(--bg-card)\`
- Padding: \`${fc.padding}\` | Border-radius: \`${fc.border_radius}\` (12px)
- Left accent border: \`${fc.accent_border_width}\` solid, positioned \`${fc.accent_border_position}\`
- **Semantic variants** — choose based on finding type:
  - \`.opportunity\` → jade border (\`--accent-success\`)
  - \`.risk\` → red border (\`--accent-error\`)
  - \`.emergent\` → sky border (\`--accent-bright\`)
  - \`.regulatory\` → violet border (\`--accent-violet\`)
  - \`.caution\` → sand border (\`--accent-warning\`)
- Always include: \`.confidence-badge\` + \`.source-list\`

### Stat Block
\`\`\`html
<div class="stat-block">
  <div class="stat-eyebrow">METRIC LABEL</div>
  <div class="stat-number" data-target="42">42</div>
  <div class="stat-suffix">%</div>
  <div class="stat-trend up">+12%</div>
</div>
\`\`\`
- Use \`data-target="N"\` for animated counter on scroll
- Wrap in \`.grid-3\` or \`.grid-4\` for stat dashboards
- \`.stat-trend.up\` (green arrow) or \`.stat-trend.down\` (red arrow)

### Hero Stat Block (Title Slide)
\`\`\`html
<div class="hero-stat">
  <div class="stat-number" data-target="8">8</div>
  <div class="stat-label">AGENTS DEPLOYED</div>
</div>
\`\`\`
- Padding: \`${hs.padding}\` | Border-radius: \`${hs.border_radius}\`
- Background: \`${hs.bg}\` | Border: \`${hs.border}\`
- Number: \`${hs.number_size}\` at weight \`${hs.number_weight}\`
- Label: \`${hs.label_size}\` with \`${hs.label_tracking}\` tracking

### Confidence Badge
\`\`\`html
<span class="confidence-badge high">HIGH CONFIDENCE</span>
<span class="confidence-badge medium">MEDIUM</span>
<span class="confidence-badge low">LOW</span>
\`\`\`
- Padding: \`${cb.padding}\` | Font size: \`${cb.font_size}\` | Weight: \`${cb.font_weight}\`
- Border-radius: \`${cb.border_radius}\` (4px) | Tracking: \`${cb.letter_spacing}\`
- Colors: HIGH=jade bg/text, MEDIUM=sand bg/text, LOW=red bg/text

### Compact Table
\`\`\`html
<table class="compact-table">
  <thead><tr><th>HEADER</th></tr></thead>
  <tbody><tr><td>Data</td></tr></tbody>
</table>
\`\`\`
- Cell padding: \`${ct.cell_padding}\`
- Header: bg \`${ct.header_bg}\` | font \`${ct.header_font_size}\` | tracking \`${ct.header_tracking}\`
- Row hover: \`${ct.row_hover_bg}\`
- Border: \`${ct.border_color}\`

### Tags
\`\`\`html
<span class="tag tag-cyan">CATEGORY</span>
\`\`\`
- Variants: \`.tag-red\`, \`.tag-orange\`, \`.tag-yellow\`, \`.tag-green\`, \`.tag-cyan\`, \`.tag-blue\`, \`.tag-purple\`
- \`.tag.quality\` — for confidence-style quality tags

### Source List
\`\`\`html
<div class="source-list">
  <div class="source-item">● PRIMARY — Source description</div>
  <div class="source-item">◐ SECONDARY — Source description</div>
  <div class="source-item">○ TERTIARY — Source description</div>
</div>
\`\`\`
- Font: \`${sl.font_size}\` | Color: \`${sl.color}\`
- Border top: \`${sl.border_top}\` | Margin top: \`${sl.margin_top}\`
- Tier icons: ● PRIMARY (green), ◐ SECONDARY (sand), ○ TERTIARY (red)
- Use \`.dagger-footnote\` for unverified claims: † notation

### Eyebrow Label
\`\`\`html
<div class="eyebrow">SECTION LABEL</div>
\`\`\`
- Font: \`${ey.font_size}\` | Weight: \`${ey.font_weight}\` | Tracking: \`${ey.letter_spacing}\`
- Transform: \`${ey.text_transform}\` | Color: \`${ey.color}\`

### Grid Layouts
- \`.grid-2\` — Two-column layout (comparisons, side-by-side)
- \`.grid-3\` — Three-column layout (stat groups, card sets)
- \`.grid-4\` — Four-column layout (stat dashboards)
- All grids collapse to single column on mobile (\`< ${breakpoints.md}px\`)

### Additional Components
- **Quote Block**: \`blockquote.quote-block\` with \`.quote-source\`
- **Policy Box**: \`.policy-box > .policy-label + .policy-body\`
- **Validation Box**: \`.validation-box.pass\` or \`.validation-box.fail\`
- **Threat Meter**: \`.threat-meter\` with 5x \`.threat-dot\` (colored with \`.active\` classes)
- **State Grid**: \`.state-grid > .state-item\` (with \`.active\` for highlighted)
- **Timeline Bar**: \`.timeline-bar > .tl-segment.tl-done / .tl-active / .tl-pending\`
- **Vertical Timeline**: \`.timeline > .tl-item\`
- **Link Block**: \`a.link-block\` for clickable card surfaces
- **Comparison Bars**: \`.bar-label + .bar-track > .bar-fill[style="--fill-pct:N%"] + .bar-fill-value\`

### Slide Layout Specs
- Content max-width: \`${slide.max_width}\`
- Padding: \`${slide.padding}\`
- Min-height: \`${slide.min_height}\`
- Background glow: \`${slide.glow_size}\` circle, \`${slide.glow_blur}\` blur, \`${slide.glow_opacity}\` opacity
- Footer font: \`${slide.footer_font_size}\` | Counter: \`${slide.counter_font_size}\``;
}

function buildSection5(): string {
  const donut = charts.donut as Record<string, unknown>;
  const barV = charts.bar_vertical as Record<string, unknown>;
  const barH = charts.bar_horizontal as Record<string, unknown>;
  const line = charts.line_chart as Record<string, unknown>;
  const spark = charts.sparkline as Record<string, unknown>;
  const heat = charts.heatmap as Record<string, unknown>;
  const counter = charts.counter as Record<string, unknown>;

  return `## Chart Components

### Donut / Ring Chart
\`\`\`html
<svg class="donut-chart" viewBox="${donut.viewbox}" style="max-width:${donut.max_width}">
  <circle class="segment" cx="${donut.cx}" cy="${donut.cy}" r="${donut.radius}"
    stroke="var(--chart-1)" stroke-width="${donut.stroke_width}"
    stroke-dasharray="SEGMENT_LENGTH ${donut.circumference}"
    stroke-dashoffset="OFFSET" fill="none" />
  <!-- repeat for each segment -->
</svg>
<div class="chart-legend">
  <div class="legend-item"><span class="legend-dot" style="background:var(--chart-1)"></span> Label</div>
</div>
\`\`\`
- **SVG geometry**: viewBox \`${donut.viewbox}\` | center \`(${donut.cx},${donut.cy})\` | radius \`${donut.radius}\`
- **Stroke**: width \`${donut.stroke_width}\` (hover: \`${donut.stroke_width_hover}\`)
- **Circumference**: \`${donut.circumference}\` (2πr — use for stroke-dasharray calculations)
- **Animation**: \`${donut.segment_transition}\` with \`${donut.segment_stagger_base}\` stagger per segment
- **Legend**: gap \`${donut.legend_gap}\` | dot size \`${donut.legend_dot_size}\`

### Vertical Bar Chart
\`\`\`html
<div class="bar-chart-container">
  <div class="bar-wrapper">
    <div class="bar" style="height:75%; background:var(--chart-1)"></div>
    <span class="bar-value">75%</span>
    <span class="bar-label">Label</span>
  </div>
</div>
\`\`\`
- Transform origin: \`${barV.transform_origin}\` | Initial: \`${barV.initial_scale}\`
- Transition: \`${barV.transition}\`
- Stagger: \`${barV.stagger_base}\` per bar
- Min height: \`${barV.min_height}\` | Border radius: \`${barV.border_radius}\`

### Horizontal Bar Chart (Comparison)
\`\`\`html
<div class="bar-row">
  <span class="bar-label">Category</span>
  <div class="bar-track">
    <div class="bar-fill" style="--fill-pct:65%"></div>
  </div>
  <span class="bar-fill-value">65%</span>
</div>
\`\`\`
- Transform origin: \`${barH.transform_origin}\` | Transition: \`${barH.transition}\`
- Bar height: \`${barH.bar_height}\` | Radius: \`${barH.bar_radius}\`
- Track background: \`${barH.track_bg}\`

### Line Chart
\`\`\`html
<svg class="line-chart" viewBox="0 0 500 200">
  <polyline class="line-path" points="10,180 100,120 200,140 300,60 400,80 490,20"
    fill="none" stroke="var(--chart-1)" stroke-width="${line.stroke_width}" />
  <circle class="data-point" cx="10" cy="180" r="${line.point_radius}" fill="var(--chart-1)" />
</svg>
\`\`\`
- Clip animation: \`${line.clip_transition}\`
- Point animation: \`${line.point_transition}\` with \`${line.point_transition_delay}\` delay

### Sparkline (inline mini-chart)
\`\`\`html
<svg class="sparkline-container" viewBox="0 0 80 24" width="${spark.width}" height="${spark.height}">
  <polyline class="sparkline-line" points="..." fill="none"
    stroke="var(--accent)" stroke-width="${spark.stroke_width}" />
  <circle class="sparkline-dot" cx="..." cy="..." r="3" />
</svg>
\`\`\`
- Dash animation: dasharray \`${spark.stroke_dasharray}\` → offset \`${spark.stroke_dashoffset_visible}\`
- Transition: \`${spark.transition}\`
- Dot appears with \`${spark.dot_transition_delay}\` delay

### Heatmap
- Cell padding: \`${heat.cell_padding}\` | Radius: \`${heat.cell_radius}\`
- Font: \`${heat.cell_font_size}\` at weight \`${heat.cell_font_weight}\`
- Intensity: \`${heat.intensity_levels}\` levels, opacity \`${heat.intensity_min_opacity}\` to \`${heat.intensity_max_opacity}\`

### Animated Counter
- Use \`data-target="N"\` on \`.stat-number\` elements
- Duration: \`${counter.duration}\` | Easing: \`${counter.easing}\`
- Font: weight \`${counter.font_weight}\` at \`${counter.font_size}\`
- Counters animate automatically via presentation.js on scroll`;
}

function buildSection6(): string {
  const kf = keyframes as Record<string, Record<string, unknown>>;

  function formatKeyframe(name: string, def: Record<string, unknown>): string {
    const states = Object.entries(def)
      .filter(([k]) => !["duration", "easing", "iteration"].includes(k))
      .map(([k, v]) => {
        if (typeof v === "object" && v !== null) {
          const props = Object.entries(v as Record<string, string>)
            .map(([p, val]) => `${p}: ${val}`)
            .join("; ");
          return `  ${k}: { ${props} }`;
        }
        return `  ${k}: ${String(v)}`;
      })
      .join("\n");
    const duration = def.duration ? ` | Duration: \`${def.duration}\`` : "";
    const easing = def.easing ? ` | Easing: \`${def.easing}\`` : "";
    const iter = def.iteration ? ` | Iteration: \`${def.iteration}\`` : "";
    return `**\`@keyframes ${name}\`**${duration}${easing}${iter}\n\`\`\`\n${states}\n\`\`\``;
  }

  const stagger = kf.stagger as Record<string, unknown>;

  return `## Animation System

### Easing Functions

| CSS Variable | Value | Usage |
|-------------|-------|-------|
| \`--ease-out-expo\` | \`${transitions.easing_out_expo}\` | Primary — smooth deceleration |
| \`--ease-out-quart\` | \`${transitions.easing_out_quart}\` | Secondary — snappy |
| \`--ease-spring\` | \`${transitions.easing_spring}\` | Playful — overshoot effect |
| \`--ease-in-out\` | \`${transitions.easing_in_out}\` | Balanced — subtle |

### Duration Scale

| CSS Variable | Value | Usage |
|-------------|-------|-------|
| \`--dur-fast\` | \`${transitions.duration_fast}\` | Micro-interactions, hover |
| \`--dur-normal\` | \`${transitions.duration_normal}\` | Standard transitions |
| \`--dur-slow\` | \`${transitions.duration_slow}\` | Slide content reveal |
| \`--dur-cinematic\` | \`${transitions.duration_cinematic}\` | Hero entrances, page transitions |

### Keyframe Definitions

${formatKeyframe("fadeUp", kf.fadeUp as Record<string, unknown>)}

${formatKeyframe("fadeIn", kf.fadeIn as Record<string, unknown>)}

${formatKeyframe("slideUp", kf.slideUp as Record<string, unknown>)}

${formatKeyframe("glowPulse", kf.glowPulse as Record<string, unknown>)}

### Animation Classes

| Class | Effect |
|-------|--------|
| \`.anim\` | Fade-up on scroll (opacity 0→1, translateY 24px→0) |
| \`.anim-scale\` | Scale-in on scroll |
| \`.anim-blur\` | Blur-in on scroll |

### Stagger System
Add stagger delay classes for sequential content reveals:
- \`.d1\` through \`.d7\` — each adds \`${stagger.base_delay}\` × N delay
- Example: \`.anim.d3\` fades up after \`300ms\` delay

\`\`\`html
<div class="anim d1">First item (100ms delay)</div>
<div class="anim d2">Second item (200ms delay)</div>
<div class="anim d3">Third item (300ms delay)</div>
\`\`\`

### Scroll Reveal
Content animates into view via IntersectionObserver:
- Threshold: \`${(interactions.scroll_reveal as Record<string, unknown>)?.threshold ?? 0.15}\`
- Root margin: \`${(interactions.scroll_reveal as Record<string, unknown>)?.root_margin ?? "0px 0px -60px 0px"}\``;
}

function buildSection7(): string {
  const hover = interactions.hover as Record<string, unknown>;
  const focus = interactions.focus as Record<string, unknown>;
  const glass = interactions.glass as Record<string, unknown>;

  return `## Interaction States & Glass Morphism

### Hover States (applied via CSS, not inline)
- Card border: lightens to \`${hover.card_border_color}\`
- Card transform: \`${hover.card_transform}\` (subtle lift)
- Chart segments: opacity \`${hover.chart_segment_opacity}\`
- Nav items: background \`${hover.nav_item_bg}\`

### Focus States (accessibility)
- Outline: \`${focus.outline_width}\` \`${focus.outline_style}\` \`${focus.outline_color}\`
- Offset: \`${focus.outline_offset}\`
- Focus ring: \`${focus.ring_shadow}\`

### Glass Morphism
Three blur levels for frosted-glass effects:
- Light: \`${glass.blur_sm}\` — subtle background blur
- Standard: \`${glass.blur_md}\` — cards and panels
- Heavy: \`${glass.blur_lg}\` — navigation panel, modals

Glass backgrounds:
- Cards: \`${glass.bg_card}\`
- Nav panel: \`${glass.bg_nav}\`
- Nav toggle: \`${glass.bg_nav_toggle}\``;
}

function buildSection8(): string {
  const shadowRows = Object.entries(shadows)
    .map(([name, value]) => `| \`--shadow-${name}\` | \`${value}\` |`)
    .join("\n");

  const radiiRows = Object.entries(radii)
    .map(([name, value]) => `| \`--radius-${name}\` | \`${value}rem\` (${Math.round(value * 16)}px) |`)
    .join("\n");

  const bpRows = Object.entries(breakpoints)
    .map(([name, value]) => `| \`${name}\` | \`${value}px\` |`)
    .join("\n");

  const zRows = Object.entries(zIndex)
    .map(([name, value]) => `| \`${name}\` | \`${value}\` |`)
    .join("\n");

  return `## Layout System

### Shadows / Elevation

| Token | Value |
|-------|-------|
${shadowRows}

### Border Radius Scale

| Token | Value |
|-------|-------|
${radiiRows}

### Breakpoints

| Name | Width |
|------|-------|
${bpRows}

Grid layouts collapse to single-column below \`md\` (${breakpoints.md}px).

### Z-Index Tiers

| Layer | Value |
|-------|-------|
${zRows}

### Spacing Scale
Base unit: \`${spacing.base}rem\` (4px). Harmonic progression:
\`space-1\` (4px) → \`space-2\` (8px) → \`space-3\` (12px) → \`space-4\` (16px) →
\`space-5\` (20px) → \`space-6\` (24px) → \`space-7\` (32px) → \`space-8\` (40px) →
\`space-9\` (48px) → \`space-10\` (64px) → \`space-11\` (80px)`;
}

function buildSection9(): string {
  const glowColors = (prism as Record<string, unknown>).glow_colors as Record<string, string>;
  const glowRows = Object.entries(glowColors)
    .map(([type, cssVar]) => `| \`${type}\` | \`${cssVar}\` |`)
    .join("\n");

  return `## PRISM Semantic System

### Slide-Type → Glow Color Mapping
Each slide type gets a distinct background glow color via \`.slide-bg-glow\`:

| Slide Type | Glow Color |
|-----------|------------|
${glowRows}

Set the glow color on \`.slide-bg-glow\` via inline style:
\`\`\`html
<div class="slide-bg-glow" style="background:var(--inov-cerulean)"></div>
\`\`\`

### Source Quality Notation
- ● PRIMARY (green) — Direct sources, official data
- ◐ SECONDARY (sand) — Industry reports, analysis
- ○ TERTIARY (red) — Anecdotal, unverified
- † Dagger — Unverified claims requiring footnote

### Confidence Badge System
| Level | Background | Text Color |
|-------|-----------|------------|
| HIGH | \`rgba(0,228,159,0.12)\` | \`var(--accent-success)\` |
| MEDIUM | \`rgba(245,230,187,0.15)\` | \`var(--accent-warning)\` |
| LOW | \`rgba(255,92,92,0.12)\` | \`var(--accent-error)\` |`;
}

function buildCompositionRules(): string {
  return `## Composition Rules (CRITICAL — NO PLAIN BULLETS)

### Data Shape → Component Mapping

**Quantitative data (numbers, percentages, metrics):**
- \`.stat-block\` with \`.stat-number[data-target="N"]\` for animated big numbers
- SVG bar charts for comparisons across categories
- SVG donut charts for part-of-whole relationships
- Sparklines for inline trend indicators
- Comparison bars for ranked items
- Stat grids: \`.grid-3\` or \`.grid-4\` wrapping multiple \`.stat-block\`

**Qualitative findings (insights, analysis, assessments):**
- Finding Cards with semantic variants (opportunity, risk, emergent, regulatory, caution)
- Tags for categorization (\`.tag-red\` through \`.tag-cyan\`)
- Quote Blocks for direct quotes or key statements
- Policy Boxes for regulatory/policy content

**Comparisons and tensions:**
- \`.grid-2\` side-by-side layouts
- Comparison bars with labeled tracks
- Threat meters for severity levels

**Timelines and processes:**
- Timeline bars for phase/status tracking
- Vertical timelines for sequential events

**Source provenance:**
- Source lists with tier indicators (●, ◐, ○)
- Dagger notation for unverified claims
- Compact tables for structured source data

### Slide Density Rules
- Maximum 4 finding-cards per slide
- Maximum 6 stat-blocks per grid
- Maximum 2 component types per slide section (don't over-clutter)
- Every slide needs one clear focal point — one hero element

### Editorial Judgment
- If an agent returned thin data (few findings, low confidence), merge with another dimension
- If no emergent insights exist, skip the emergence slide — do NOT fabricate
- Match slide density to data richness: data-heavy agents get charts; qualitative agents get cards
- Prefer specificity: use exact numbers, name sources, cite evidence tiers
- NEVER use plain bullet lists when a component fits the data shape

### Slide Sequence
1. **Title Slide** — hero stats, dramatic title, PRISM branding
2. **Table of Contents** (6+ agents) — grouped navigation
3. **Executive Summary** — 3-4 key takeaways as finding cards
4. **Methodology** — agent roster as compact table
5. **Dimension Slides** (one per agent) — 3+ rich components each
6. **Emergence Slide** (if insights exist) — emergent finding cards
7. **Tension Slide** (if tensions exist) — grid-2 side-by-side
8. **Strategic Implications** — timeline or action matrix
9. **Source Provenance** — source list with tier breakdown
10. **Closing Slide** — call to action

### Branding
Use "PRISM | Intelligence" throughout. No other brand references.`;
}

function buildExemplars(): string {
  if (!existsSync(EXEMPLARS_DIR)) return "";

  const exemplarFiles = readdirSync(EXEMPLARS_DIR)
    .filter((f) => f.endsWith(".html"))
    .sort();

  if (exemplarFiles.length === 0) return "";

  const exemplarSections = exemplarFiles
    .map((file) => {
      const name = basename(file, ".html")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const content = readFileSync(resolve(EXEMPLARS_DIR, file), "utf-8");
      return `### ${name}

\`\`\`html
${content.trim()}
\`\`\``;
    })
    .join("\n\n");

  return `## Reference Examples (Golden Exemplars)

These are curated examples showing ideal component composition for each slide archetype.
Study the component choices, token usage, and structure — then apply the same patterns
to the data you receive.

${exemplarSections}`;
}

// ─── Assemble & Write ───────────────────────────────────────

const sections = [
  buildSection1(),
  buildSection2(),
  buildSection3(),
  buildSection4(),
  buildSection5(),
  buildSection6(),
  buildSection7(),
  buildSection8(),
  buildSection9(),
  buildCompositionRules(),
  buildExemplars(),
].filter(Boolean);

const output = sections.join("\n\n---\n\n") + "\n";

writeFileSync(OUTPUT_PATH, output, "utf-8");

const lineCount = output.split("\n").length;
const charCount = output.length;
const tokenEstimate = Math.round(charCount / 4); // rough estimate

console.log(`[spec:compile] Generated ${OUTPUT_PATH}`);
console.log(`  Lines: ${lineCount}`);
console.log(`  Characters: ${charCount}`);
console.log(`  Estimated tokens: ~${tokenEstimate}`);
console.log(`  Exemplars: ${existsSync(EXEMPLARS_DIR) ? readdirSync(EXEMPLARS_DIR).filter((f) => f.endsWith(".html")).length : 0}`);
