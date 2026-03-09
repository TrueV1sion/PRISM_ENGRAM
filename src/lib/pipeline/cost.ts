/**
 * PRISM Pipeline -- Cost Tracking
 *
 * Calculates API costs based on model-specific token pricing.
 * Prices are per 1M tokens, sourced from Anthropic's pricing page.
 */

// ─── Model Pricing (per 1M tokens, USD) ─────────────────────

interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4 (Opus)
  "claude-opus-4-6": {
    input: 15,
    output: 75,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  // Claude 4 (Sonnet)
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
};

// ─── Usage Tracking ─────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface PhaseCost {
  phase: string;
  model: string;
  usage: TokenUsage;
  cost: number;
}

export interface CostSummary {
  phases: PhaseCost[];
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheTokens: number;
}

/**
 * Calculate the cost of a single API call based on model and token usage.
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`[COST] Unknown model: ${model}, cannot calculate cost`);
    return 0;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost =
    ((usage.cacheReadTokens ?? 0) / 1_000_000) * pricing.cacheRead;
  const cacheWriteCost =
    ((usage.cacheWriteTokens ?? 0) / 1_000_000) * pricing.cacheWrite;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Mutable cost tracker that accumulates costs across pipeline phases.
 * Create one per pipeline run.
 */
export class CostTracker {
  private phases: PhaseCost[] = [];

  /**
   * Record a phase's API usage and calculate its cost.
   */
  record(phase: string, model: string, usage: TokenUsage): number {
    const cost = calculateCost(model, usage);
    this.phases.push({ phase, model, usage, cost });
    return cost;
  }

  /**
   * Get the current total cost across all recorded phases.
   */
  get totalCost(): number {
    return this.phases.reduce((sum, p) => sum + p.cost, 0);
  }

  /**
   * Get a full cost summary for the pipeline run.
   */
  getSummary(): CostSummary {
    return {
      phases: [...this.phases],
      totalCost: this.totalCost,
      totalInputTokens: this.phases.reduce(
        (sum, p) => sum + p.usage.inputTokens,
        0,
      ),
      totalOutputTokens: this.phases.reduce(
        (sum, p) => sum + p.usage.outputTokens,
        0,
      ),
      totalCacheTokens: this.phases.reduce(
        (sum, p) =>
          sum + (p.usage.cacheReadTokens ?? 0) + (p.usage.cacheWriteTokens ?? 0),
        0,
      ),
    };
  }

  /**
   * Format costs for display.
   */
  static formatCost(cost: number): string {
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    if (cost < 1) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(2)}`;
  }
}
