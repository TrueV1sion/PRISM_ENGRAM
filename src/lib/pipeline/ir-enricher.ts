/**
 * PRISM v2 — IR Enricher
 *
 * Pure functions that project pipeline phase outputs into IR graph entities.
 * Called from executor.ts after each phase completes.
 *
 * Each function mutates the IRGraph in place (the graph lives on the MemoryBus).
 * No side effects, no DB calls, no imports from phase modules.
 */

import type {
  IRGraph,
  IRFinding,
  IRRelationship,
  IRAgent,
  IRSource,
  IRTension,
} from "./ir-types";
import { mapSwarmTierToInvestigationTier } from "./ir-types";
import type { AgentResult, SwarmTier } from "./types";
import type { MemoryBusState } from "./memory-bus";

// ─── Helpers ────────────────────────────────────────────────

function generateIRId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function hashSource(url: string, title: string): string {
  // Simple deterministic hash for dedup
  const input = `${url}|${title}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `src_${Math.abs(hash).toString(36)}`;
}

function deriveActionabilityScore(finding: { evidenceType: string; tags: string[] }): number {
  let score = 3;
  if (finding.evidenceType === "direct") score += 1;
  if (finding.evidenceType === "analogical") score -= 1;
  if (finding.tags.some(t => t.toLowerCase().includes("action"))) score += 1;
  return Math.max(1, Math.min(5, score));
}

function deriveNoveltyScore(
  agentName: string,
  value: string,
  allFindings: Array<{ agent: string; value: string }>,
): number {
  // Count how many other agents have similar findings (simple overlap heuristic)
  const words = new Set(value.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  let overlapCount = 0;
  for (const other of allFindings) {
    if (other.agent === agentName) continue;
    const otherWords = new Set(other.value.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    const overlap = [...words].filter(w => otherWords.has(w)).length;
    if (words.size > 0 && overlap > words.size * 0.5) overlapCount++;
  }
  // More overlap = less novel
  if (overlapCount === 0) return 5;
  if (overlapCount === 1) return 3;
  return 1;
}

// ─── DEPLOY Enrichment ──────────────────────────────────────

export function enrichAfterDeploy(
  graph: IRGraph,
  agentResults: AgentResult[],
  busState: MemoryBusState,
  swarmTier: SwarmTier,
): void {
  // Set metadata
  graph.metadata.investigationTier = mapSwarmTierToInvestigationTier(swarmTier);
  graph.metadata.agentManifest = agentResults.map(ar => ar.agentName);

  // Collect all blackboard values for novelty scoring
  const allBBValues = busState.blackboard.map(bb => ({
    agent: bb.agent,
    value: bb.value,
  }));

  // Findings — project from blackboard entries (matched with agent results for archetype/dimension)
  let findingIndex = 0;
  const agentLookup = new Map(agentResults.map(ar => [ar.agentName, ar]));

  for (const bb of busState.blackboard) {
    const agentResult = agentLookup.get(bb.agent);
    // EvidenceKind ("direct" | "inferred" | "analogical") is a subset of IRFinding evidenceType
    // so the cast is safe; "modeled" can only appear in IR synthesis enrichment
    const finding: IRFinding = {
      id: bb.id,
      agent: bb.agent,
      agentArchetype: agentResult?.archetype ?? "unknown",
      dimension: agentResult?.dimension ?? "unknown",
      key: bb.key,
      value: bb.value,
      confidence: bb.confidence,
      evidenceType: bb.evidenceType as IRFinding["evidenceType"],
      tags: bb.tags,
      references: bb.references,
      timestamp: bb.timestamp,
      findingIndex,
      actionabilityScore: deriveActionabilityScore(bb),
      noveltyScore: deriveNoveltyScore(bb.agent, bb.value, allBBValues),
    };
    graph.findings.push(finding);
    findingIndex++;
  }

  // Relationships — from bus signals
  for (const sig of busState.signals) {
    const rel: IRRelationship = {
      id: sig.id,
      from: sig.from,
      to: sig.to,
      type: sig.type,
      relationshipType: "discovery",
      priority: sig.priority,
      timestamp: sig.timestamp,
      message: sig.message,
      payload: sig.payload,
    };
    graph.relationships.push(rel);
  }

  // Agents
  for (const ar of agentResults) {
    const agent: IRAgent = {
      id: generateIRId("agent"),
      name: ar.agentName,
      archetype: ar.archetype,
      dimension: ar.dimension,
      findingCount: ar.findings.length,
      gapCount: ar.gaps.length,
      signalCount: ar.signals.length,
      toolsUsed: ar.toolsUsed,
      tokensUsed: ar.tokensUsed,
    };
    graph.agents.push(agent);
  }

  // Sources — extract from finding references, deduplicate
  const sourceMap = new Map<string, IRSource>();
  for (const finding of graph.findings) {
    for (const ref of finding.references) {
      const url = ref;
      const title = ref; // Use URL as title when no title available
      const sourceId = hashSource(url, title);
      if (sourceMap.has(sourceId)) {
        sourceMap.get(sourceId)!.referencedByFindings.push(finding.id);
      } else {
        sourceMap.set(sourceId, {
          id: sourceId,
          title,
          url,
          sourceTier: "SECONDARY",
          referencedByFindings: [finding.id],
        });
      }
    }
  }
  graph.sources.push(...sourceMap.values());

  // Tensions — from bus conflicts
  for (const conflict of busState.conflicts) {
    const tension: IRTension = {
      id: conflict.id,
      registeredBy: conflict.registeredBy,
      timestamp: conflict.timestamp,
      status: conflict.status,
      claim: conflict.claim,
      positions: conflict.positions,
      resolution: conflict.resolution,
      resolutionStrategy: conflict.resolutionStrategy,
    };
    graph.tensions.push(tension);
  }
}
