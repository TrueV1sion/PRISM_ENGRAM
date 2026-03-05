/**
 * Anthropic SDK Client Wrapper
 *
 * Provides a singleton Anthropic client, model routing per pipeline phase,
 * extended thinking configuration, and prompt caching helpers.
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return client;
}

// ─── Model Routing ──────────────────────────────────────────

/** Model assignments per pipeline phase */
export const MODELS = {
  THINK: "claude-opus-4-0-20250514",
  CONSTRUCT: "claude-sonnet-4-20250514",
  DEPLOY: "claude-sonnet-4-20250514",
  CRITIC: "claude-opus-4-0-20250514",
  SYNTHESIZE: "claude-opus-4-0-20250514",
  PRESENT: "claude-sonnet-4-20250514",
} as const;

export type PipelinePhase = keyof typeof MODELS;

// ─── Extended Thinking ──────────────────────────────────────

/** Default extended thinking config for phases that need deep reasoning */
export const EXTENDED_THINKING: Anthropic.Messages.ThinkingConfigEnabled = {
  type: "enabled",
  budget_tokens: 10_000,
};

// ─── Prompt Caching ─────────────────────────────────────────

/**
 * Wraps a system prompt string in a TextBlockParam with ephemeral cache control.
 * Use this in the `system` array of a messages.create() call to enable
 * Anthropic prompt caching for frequently-reused system prompts.
 */
export function cachedSystemPrompt(
  text: string,
): Anthropic.Messages.TextBlockParam {
  return {
    type: "text",
    text,
    cache_control: { type: "ephemeral" },
  };
}

// ─── Web Search Tool ────────────────────────────────────────

/** Anthropic's native web search server tool definition */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
};
