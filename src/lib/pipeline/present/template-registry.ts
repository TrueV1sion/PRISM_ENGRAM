import type { DataShape } from "./types";

// ── Exported Interfaces ──

export interface SlotSchema {
  name: string;
  type: "text" | "stat" | "list" | "enum";
  required: boolean;
  constraints: { maxLength?: number; maxItems?: number; enumValues?: string[]; format?: string };
}

export interface ChartSlotSchema {
  name: string;
  chartTypes: string[];
  datasetRef: boolean;
}

export interface ComponentField {
  name: string;
  type: "text" | "enum";
  required: boolean;
  constraints?: { maxLength?: number; enumValues?: string[] };
}

export interface ComponentSlot {
  name: string;
  component: string;
  required: boolean;
  fields: ComponentField[];
}

export type SlideIntent = "context" | "evidence" | "comparison" | "trend" | "composition" |
  "ranking" | "process" | "recommendation" | "summary" | "transition";

export interface TemplateRegistryEntry {
  id: string;
  name: string;
  category: "single-focus" | "data-viz" | "content" | "composite";
  dataShapes: DataShape[];
  densityRange: [number, number];
  slots: SlotSchema[];
  chartSlots: ChartSlotSchema[];
  componentSlots: ComponentSlot[];
}

// ── Shared component field schemas ──

const statBlockFields: ComponentField[] = [
  { name: "value", type: "text", required: true, constraints: { maxLength: 12 } },
  { name: "label", type: "text", required: true, constraints: { maxLength: 30 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
  { name: "trend_direction", type: "enum", required: false, constraints: { enumValues: ["up", "down", "flat"] } },
  { name: "delta", type: "text", required: false, constraints: { maxLength: 12 } },
];

const statBlockMiniFields: ComponentField[] = [
  { name: "value", type: "text", required: true, constraints: { maxLength: 12 } },
  { name: "label", type: "text", required: true, constraints: { maxLength: 20 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
];

const sourceCitationFields: ComponentField[] = [
  { name: "text", type: "text", required: true, constraints: { maxLength: 80 } },
];

const actionCardFields: ComponentField[] = [
  { name: "title", type: "text", required: true, constraints: { maxLength: 40 } },
  { name: "description", type: "text", required: true, constraints: { maxLength: 120 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
];

const comparisonRowFields: ComponentField[] = [
  { name: "label", type: "text", required: true, constraints: { maxLength: 30 } },
  { name: "before_value", type: "text", required: true, constraints: { maxLength: 15 } },
  { name: "after_value", type: "text", required: true, constraints: { maxLength: 15 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
];

const timelineStepFields: ComponentField[] = [
  { name: "label", type: "text", required: true, constraints: { maxLength: 20 } },
  { name: "title", type: "text", required: true, constraints: { maxLength: 40 } },
  { name: "description", type: "text", required: true, constraints: { maxLength: 100 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
];

const featureCardFields: ComponentField[] = [
  { name: "icon", type: "text", required: true, constraints: { maxLength: 5 } },
  { name: "title", type: "text", required: true, constraints: { maxLength: 30 } },
  { name: "description", type: "text", required: true, constraints: { maxLength: 100 } },
  { name: "color_class", type: "enum", required: true, constraints: { enumValues: ["cyan", "green", "purple", "orange"] } },
];

// ── Common slot definitions ──

const headlineSlot: SlotSchema = { name: "headline", type: "text", required: true, constraints: { maxLength: 60 } };
const subheadSlot: SlotSchema = { name: "subhead", type: "text", required: true, constraints: { maxLength: 120 } };
const slideClassSlot: SlotSchema = { name: "slide_class", type: "enum", required: true, constraints: { enumValues: ["gradient-dark", "gradient-blue", "gradient-radial", "dark-mesh", "dark-particles"] } };

function statComponent(name: string, required = true): ComponentSlot {
  return { name, component: "stat-block", required, fields: statBlockFields };
}

function statMiniComponent(name: string, required = true): ComponentSlot {
  return { name, component: "stat-block-mini", required, fields: statBlockMiniFields };
}

function sourceComponent(required = true): ComponentSlot {
  return { name: "source", component: "source-citation", required, fields: sourceCitationFields };
}

// ── Registry Entries ──

const registry: TemplateRegistryEntry[] = [
  // ── Single Focus (SF) ──
  {
    id: "SF-01", name: "Hero Stat", category: "single-focus",
    dataShapes: ["single_metric"], densityRange: [1, 3],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      statComponent("stat_1"),
      statComponent("stat_2", false),
      statComponent("stat_3", false),
      sourceComponent(),
    ],
  },
  {
    id: "SF-02", name: "Full Chart", category: "single-focus",
    dataShapes: ["time_series", "comparison", "distribution"], densityRange: [4, 8],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [{ name: "chart_primary", chartTypes: ["line", "bar", "area"], datasetRef: true }],
    componentSlots: [sourceComponent()],
  },
  {
    id: "SF-03", name: "Quote Insight", category: "single-focus",
    dataShapes: [], densityRange: [0, 2],
    slots: [
      headlineSlot, slideClassSlot,
      { name: "quote_text", type: "text", required: true, constraints: { maxLength: 200 } },
      { name: "quote_attribution", type: "text", required: true, constraints: { maxLength: 60 } },
      subheadSlot,
    ],
    chartSlots: [],
    componentSlots: [statComponent("stat_1", false), sourceComponent(false)],
  },
  {
    id: "SF-04", name: "Section Divider", category: "single-focus",
    dataShapes: [], densityRange: [0, 0],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "section_number", type: "text", required: false, constraints: { maxLength: 10 } },
    ],
    chartSlots: [],
    componentSlots: [],
  },
  {
    id: "SF-05", name: "Title Slide", category: "single-focus",
    dataShapes: [], densityRange: [0, 0],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "badge", type: "text", required: true, constraints: { maxLength: 30 } },
      { name: "date", type: "text", required: true, constraints: { maxLength: 30 } },
    ],
    chartSlots: [],
    componentSlots: [],
  },

  // ── Data Viz (DV) ──
  {
    id: "DV-01", name: "Trend Hero", category: "data-viz",
    dataShapes: ["time_series"], densityRange: [4, 7],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [{ name: "chart_primary", chartTypes: ["line", "area"], datasetRef: true }],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"), statComponent("stat_3"),
      sourceComponent(),
    ],
  },
  {
    id: "DV-02", name: "Composition Donut", category: "data-viz",
    dataShapes: ["composition"], densityRange: [4, 8],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [{ name: "chart_primary", chartTypes: ["donut", "pie"], datasetRef: true }],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"), statComponent("stat_3"),
      sourceComponent(),
    ],
  },
  {
    id: "DV-03", name: "Comparison Bars", category: "data-viz",
    dataShapes: ["comparison"], densityRange: [3, 6],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [{ name: "chart_primary", chartTypes: ["bar", "horizontal-bar"], datasetRef: true }],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      sourceComponent(),
    ],
  },
  {
    id: "DV-04", name: "Multi Metric", category: "data-viz",
    dataShapes: ["single_metric"], densityRange: [4, 6],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      statComponent("stat_3"), statComponent("stat_4"),
      sourceComponent(),
    ],
  },
  {
    id: "DV-05", name: "Dual Chart", category: "data-viz",
    dataShapes: ["time_series", "comparison", "distribution", "composition"], densityRange: [3, 5],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "chart_left_title", type: "text", required: true, constraints: { maxLength: 40 } },
      { name: "chart_right_title", type: "text", required: true, constraints: { maxLength: 40 } },
    ],
    chartSlots: [
      { name: "chart_left", chartTypes: ["line", "bar", "area", "donut"], datasetRef: true },
      { name: "chart_right", chartTypes: ["line", "bar", "area", "donut"], datasetRef: true },
    ],
    componentSlots: [sourceComponent()],
  },
  {
    id: "DV-06", name: "Sparkline Row", category: "data-viz",
    dataShapes: ["time_series"], densityRange: [3, 5],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [
      { name: "chart_spark_1", chartTypes: ["sparkline"], datasetRef: true },
      { name: "chart_spark_2", chartTypes: ["sparkline"], datasetRef: true },
      { name: "chart_spark_3", chartTypes: ["sparkline"], datasetRef: true },
    ],
    componentSlots: [
      statMiniComponent("stat_1"), statMiniComponent("stat_2"), statMiniComponent("stat_3"),
      sourceComponent(),
    ],
  },
  {
    id: "DV-07", name: "Counter Grid", category: "data-viz",
    dataShapes: ["single_metric"], densityRange: [4, 6],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      statComponent("stat_3"), statComponent("stat_4"),
      statComponent("stat_5", false), statComponent("stat_6", false),
      sourceComponent(),
    ],
  },
  {
    id: "DV-08", name: "Ranked List", category: "data-viz",
    dataShapes: ["ranking"], densityRange: [4, 8],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "items", type: "list", required: true, constraints: { maxItems: 8 } },
    ],
    chartSlots: [],
    componentSlots: [sourceComponent()],
  },

  // ── Content Layouts (CL) ──
  {
    id: "CL-01", name: "Two Column", category: "content",
    dataShapes: ["time_series", "comparison", "distribution", "composition", "ranking", "single_metric"], densityRange: [0, 100],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "col_left_title", type: "text", required: true, constraints: { maxLength: 40 } },
      { name: "col_left_body", type: "text", required: true, constraints: { maxLength: 300 } },
      { name: "col_right_title", type: "text", required: true, constraints: { maxLength: 40 } },
      { name: "col_right_body", type: "text", required: true, constraints: { maxLength: 300 } },
    ],
    chartSlots: [{ name: "chart_primary", chartTypes: ["line", "bar", "donut", "area"], datasetRef: true }],
    componentSlots: [sourceComponent(false)],
  },
  {
    id: "CL-02", name: "Three Column Features", category: "content",
    dataShapes: ["time_series", "comparison", "distribution", "composition", "ranking", "single_metric"], densityRange: [0, 100],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      { name: "feature_1", component: "feature-card", required: true, fields: featureCardFields },
      { name: "feature_2", component: "feature-card", required: true, fields: featureCardFields },
      { name: "feature_3", component: "feature-card", required: true, fields: featureCardFields },
    ],
  },
  {
    id: "CL-03", name: "Timeline", category: "content",
    dataShapes: ["time_series"], densityRange: [3, 5],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      { name: "step_1", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_2", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_3", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_4", component: "timeline-step", required: false, fields: timelineStepFields },
    ],
  },
  {
    id: "CL-04", name: "Before After", category: "content",
    dataShapes: ["comparison"], densityRange: [2, 4],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      { name: "row_1", component: "comparison-row", required: true, fields: comparisonRowFields },
      { name: "row_2", component: "comparison-row", required: true, fields: comparisonRowFields },
      { name: "row_3", component: "comparison-row", required: true, fields: comparisonRowFields },
      { name: "row_4", component: "comparison-row", required: false, fields: comparisonRowFields },
    ],
  },
  {
    id: "CL-05", name: "Matrix Quadrant", category: "content",
    dataShapes: ["comparison"], densityRange: [4, 4],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "x_axis", type: "text", required: true, constraints: { maxLength: 30 } },
      { name: "y_axis", type: "text", required: true, constraints: { maxLength: 30 } },
      { name: "q1_label", type: "text", required: true, constraints: { maxLength: 20 } },
      { name: "q1_items", type: "text", required: true, constraints: { maxLength: 100 } },
      { name: "q2_label", type: "text", required: true, constraints: { maxLength: 20 } },
      { name: "q2_items", type: "text", required: true, constraints: { maxLength: 100 } },
      { name: "q3_label", type: "text", required: true, constraints: { maxLength: 20 } },
      { name: "q3_items", type: "text", required: true, constraints: { maxLength: 100 } },
      { name: "q4_label", type: "text", required: true, constraints: { maxLength: 20 } },
      { name: "q4_items", type: "text", required: true, constraints: { maxLength: 100 } },
    ],
    chartSlots: [],
    componentSlots: [sourceComponent(false)],
  },
  {
    id: "CL-06", name: "Process Flow", category: "content",
    dataShapes: [], densityRange: [3, 5],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      { name: "step_1", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_2", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_3", component: "timeline-step", required: true, fields: timelineStepFields },
      { name: "step_4", component: "timeline-step", required: false, fields: timelineStepFields },
      { name: "step_5", component: "timeline-step", required: false, fields: timelineStepFields },
    ],
  },
  {
    id: "CL-07", name: "Bullet Insights", category: "content",
    dataShapes: [], densityRange: [3, 6],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "items", type: "list", required: true, constraints: { maxItems: 6 } },
    ],
    chartSlots: [],
    componentSlots: [sourceComponent(false)],
  },

  // ── Composite (CO) ──
  {
    id: "CO-01", name: "Dashboard", category: "composite",
    dataShapes: ["time_series", "composition", "comparison", "single_metric"], densityRange: [6, 20],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [
      { name: "chart_primary", chartTypes: ["line", "area", "bar"], datasetRef: true },
      { name: "chart_secondary", chartTypes: ["donut", "bar", "sparkline"], datasetRef: true },
    ],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      statComponent("stat_3"), statComponent("stat_4"),
      sourceComponent(),
    ],
  },
  {
    id: "CO-02", name: "Scorecard", category: "composite",
    dataShapes: ["single_metric", "comparison"], densityRange: [4, 6],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      statComponent("stat_3"), statComponent("stat_4"),
      statComponent("stat_5", false), statComponent("stat_6", false),
      sourceComponent(),
    ],
  },
  {
    id: "CO-03", name: "Market Map", category: "composite",
    dataShapes: ["composition", "comparison"], densityRange: [4, 8],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [{ name: "chart_primary", chartTypes: ["donut", "bar"], datasetRef: true }],
    componentSlots: [
      statComponent("stat_1"), statComponent("stat_2"),
      statComponent("stat_3"), statComponent("stat_4"),
      sourceComponent(),
    ],
  },
  {
    id: "CO-04", name: "Competitive Landscape", category: "composite",
    dataShapes: ["comparison", "ranking"], densityRange: [3, 8],
    slots: [
      headlineSlot, subheadSlot, slideClassSlot,
      { name: "items", type: "list", required: true, constraints: { maxItems: 6 } },
    ],
    chartSlots: [{ name: "chart_primary", chartTypes: ["bar", "horizontal-bar", "radar"], datasetRef: true }],
    componentSlots: [sourceComponent()],
  },
  {
    id: "CO-05", name: "Strategic Recommendation", category: "composite",
    dataShapes: [], densityRange: [3, 4],
    slots: [headlineSlot, subheadSlot, slideClassSlot],
    chartSlots: [],
    componentSlots: [
      { name: "action_1", component: "action-card", required: true, fields: actionCardFields },
      { name: "action_2", component: "action-card", required: true, fields: actionCardFields },
      { name: "action_3", component: "action-card", required: true, fields: actionCardFields },
      statMiniComponent("impact_1", false), statMiniComponent("impact_2", false),
    ],
  },
];

// ── Lookup Maps (built once at module init) ──

const byId = new Map<string, TemplateRegistryEntry>(
  registry.map(t => [t.id, t]),
);

const FALLBACK_TEMPLATES = ["CL-01", "CL-02"];

// ── Intent-to-Category heuristic ──

function categoryMatchesIntent(
  category: TemplateRegistryEntry["category"],
  intent: SlideIntent,
): boolean {
  switch (intent) {
    case "trend":
    case "composition":
    case "ranking":
      return category === "data-viz";
    case "comparison":
      return category === "data-viz" || category === "content";
    case "evidence":
      return category === "data-viz" || category === "composite";
    case "context":
    case "process":
      return category === "content";
    case "recommendation":
    case "summary":
      return category === "composite" || category === "content";
    case "transition":
      return category === "single-focus";
    default:
      return false;
  }
}

// ── Public API ──

export function getAllTemplates(): TemplateRegistryEntry[] {
  return [...registry];
}

export function getTemplate(id: string): TemplateRegistryEntry | undefined {
  return byId.get(id);
}

export function selectTemplate(
  dataShapes: DataShape[],
  pointCount: number,
  slideIntent: SlideIntent,
  usedTemplates: Set<string>,
): TemplateRegistryEntry {
  const candidates = registry
    .filter(t => t.dataShapes.length === 0
      ? false  // templates with no dataShapes are structural, not data-driven
      : t.dataShapes.some(s => dataShapes.includes(s)))
    .filter(t => pointCount >= t.densityRange[0] && pointCount <= t.densityRange[1])
    .sort((a, b) => {
      // Prefer unused templates
      const aUsed = usedTemplates.has(a.id) ? 1 : 0;
      const bUsed = usedTemplates.has(b.id) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      // Prefer category that matches intent
      const aMatch = categoryMatchesIntent(a.category, slideIntent) ? -1 : 0;
      const bMatch = categoryMatchesIntent(b.category, slideIntent) ? -1 : 0;
      return aMatch - bMatch;
    });

  if (candidates.length > 0) return candidates[0];

  // Fallback: no template matches the data shape + density.
  // Use CL-01 (two-column) or CL-02 (three-column) as flexible general-purpose layouts.
  const fallbackId = FALLBACK_TEMPLATES.find(id => !usedTemplates.has(id)) ?? FALLBACK_TEMPLATES[0];
  return byId.get(fallbackId)!;
}
