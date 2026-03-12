import { describe, it, expect } from "vitest";
import { enrichAfterDeploy } from "../ir-enricher";
import { createEmptyIRGraph } from "../ir-types";
import type { IRGraph } from "../ir-types";
import type { AgentResult } from "../types";
import type { MemoryBusState } from "../memory-bus";

function makeAgentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  return {
    agentName: "market-analyst",
    archetype: "ANALYST-FINANCIAL",
    dimension: "Market Dynamics",
    findings: [
      {
        statement: "Market is $5B TAM",
        evidence: "Industry report 2025",
        confidence: "HIGH",
        sourceTier: "PRIMARY",
        evidenceType: "direct",
        source: "https://example.com/report",
        implication: "Large addressable market",
        tags: ["market", "tam"],
      },
    ],
    gaps: ["No APAC data"],
    signals: ["Found regulatory concern"],
    minorityViews: [],
    toolsUsed: ["web_search", "financial_data"],
    tokensUsed: 15000,
    ...overrides,
  };
}

function makeBusState(): MemoryBusState {
  return {
    version: 1,
    created: new Date().toISOString(),
    task: "test",
    blackboard: [
      {
        id: "bb-1",
        agent: "market-analyst",
        timestamp: new Date().toISOString(),
        key: "market-dynamics/direct",
        value: "Market is $5B TAM",
        confidence: 0.9,
        evidenceType: "direct",
        tags: ["market dynamics", "high"],
        references: ["https://example.com/report"],
      },
    ],
    signals: [
      {
        id: "sig-1",
        from: "market-analyst",
        to: "all",
        type: "discovery",
        priority: "medium",
        timestamp: new Date().toISOString(),
        message: "Found regulatory concern",
      },
    ],
    conflicts: [],
  };
}

describe("IR Enricher — DEPLOY phase", () => {
  it("populates findings from agent results", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    const agents = [makeAgentResult()];
    const busState = makeBusState();

    enrichAfterDeploy(graph, agents, busState, "STANDARD");

    expect(graph.findings).toHaveLength(1);
    expect(graph.findings[0].agent).toBe("market-analyst");
    expect(graph.findings[0].agentArchetype).toBe("ANALYST-FINANCIAL");
    expect(graph.findings[0].dimension).toBe("Market Dynamics");
    expect(graph.findings[0].confidence).toBe(0.9);
    expect(graph.findings[0].findingIndex).toBe(0);
    expect(graph.findings[0].actionabilityScore).toBeGreaterThanOrEqual(1);
    expect(graph.findings[0].actionabilityScore).toBeLessThanOrEqual(5);
    expect(graph.findings[0].noveltyScore).toBeGreaterThanOrEqual(1);
    expect(graph.findings[0].noveltyScore).toBeLessThanOrEqual(5);
  });

  it("populates relationships from bus signals", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    enrichAfterDeploy(graph, [makeAgentResult()], makeBusState(), "STANDARD");

    expect(graph.relationships.length).toBeGreaterThanOrEqual(1);
    const rel = graph.relationships[0];
    expect(rel.from).toBe("market-analyst");
    expect(rel.type).toBe("discovery");
  });

  it("populates agents from agent results", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    enrichAfterDeploy(graph, [makeAgentResult()], makeBusState(), "STANDARD");

    expect(graph.agents).toHaveLength(1);
    expect(graph.agents[0].name).toBe("market-analyst");
    expect(graph.agents[0].archetype).toBe("ANALYST-FINANCIAL");
    expect(graph.agents[0].findingCount).toBe(1);
    expect(graph.agents[0].gapCount).toBe(1);
    expect(graph.agents[0].signalCount).toBe(1);
    expect(graph.agents[0].toolsUsed).toEqual(["web_search", "financial_data"]);
    expect(graph.agents[0].tokensUsed).toBe(15000);
  });

  it("populates sources from finding references", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    enrichAfterDeploy(graph, [makeAgentResult()], makeBusState(), "STANDARD");

    expect(graph.sources.length).toBeGreaterThanOrEqual(1);
    expect(graph.sources[0].url).toBe("https://example.com/report");
  });

  it("sets metadata tier and agent manifest", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    enrichAfterDeploy(graph, [makeAgentResult()], makeBusState(), "STANDARD");

    expect(graph.metadata.investigationTier).toBe("FOCUSED");
    expect(graph.metadata.agentManifest).toContain("market-analyst");
  });

  it("assigns sequential findingIndex across multiple agents", () => {
    const graph = createEmptyIRGraph("run-1", "test");
    const agent1 = makeAgentResult({ agentName: "agent-a" });
    const agent2 = makeAgentResult({ agentName: "agent-b" });
    const busState = makeBusState();
    busState.blackboard.push({
      ...busState.blackboard[0],
      id: "bb-2",
      agent: "agent-b",
    });

    enrichAfterDeploy(graph, [agent1, agent2], busState, "STANDARD");

    expect(graph.findings[0].findingIndex).toBe(0);
    expect(graph.findings[1].findingIndex).toBe(1);
  });
});
