# Testing, CI/CD, and MCP Enablement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated testing (Vitest), CI/CD (GitHub Actions + Docker), and enable MCP SSE transport across all 6 remote servers.

**Architecture:** Three independent workstreams touching disjoint files. Testing provides the foundation — CI/CD runs the tests, MCP changes are validated by them. Each workstream produces working, committable increments.

**Tech Stack:** Vitest, @vitest/coverage-v8, vitest-mock-extended, simple-git-hooks, lint-staged, Docker (node:20-alpine), GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-11-testing-cicd-mcp-design.md`

---

## Chunk 1: Testing Foundation

### Task 1: Install Vitest and configure

**Files:**
- Modify: `package.json` (add devDependencies + scripts)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest dependencies**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 vitest-mock-extended
```

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: [
        "src/generated/**",
        "src/lib/prisma.ts",
        "src/**/*.d.ts",
      ],
      thresholds: {
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add npm scripts to package.json**

Add to `package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "type-check": "tsc --noEmit",
  "ci": "npm run lint && npm run type-check && npm run test && npm run build"
}
```

- [ ] **Step 4: Run `npm run test` to verify Vitest starts (no tests yet)**

Run: `npm run test`
Expected: "No test files found" or similar — confirms Vitest is configured.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add Vitest testing framework and npm scripts"
```

---

### Task 2: Create mock infrastructure

**Files:**
- Create: `src/__mocks__/prisma.ts`
- Create: `src/__mocks__/anthropic.ts`
- Create: `src/__mocks__/mcp.ts`
- Create: `src/__tests__/setup.ts`

- [ ] **Step 1: Create Prisma mock**

Create `src/__mocks__/prisma.ts`:
```typescript
import { vi } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@/generated/prisma/client";

export const prismaMock = mockDeep<PrismaClient>();

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

export function resetPrismaMock() {
  mockReset(prismaMock);
}
```

- [ ] **Step 2: Create Anthropic SDK mock**

Create `src/__mocks__/anthropic.ts`:
```typescript
import { vi } from "vitest";

export interface MockMessageResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  model: string;
  stop_reason: "end_turn" | "tool_use";
  usage: { input_tokens: number; output_tokens: number };
}

export function createMockMessageResponse(
  content: MockMessageResponse["content"],
  overrides?: Partial<MockMessageResponse>,
): MockMessageResponse {
  return {
    id: "msg_test_001",
    type: "message",
    role: "assistant",
    content,
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 200 },
    ...overrides,
  };
}

export const mockAnthropicCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

export function resetAnthropicMock() {
  mockAnthropicCreate.mockReset();
}
```

- [ ] **Step 3: Create MCP manager mock**

Create `src/__mocks__/mcp.ts`:
```typescript
import { vi } from "vitest";
import type { ArchetypeFamily } from "@/lib/pipeline/types";

export const mockGetToolsForArchetype = vi.fn().mockReturnValue([]);
export const mockGetGapsForArchetype = vi.fn().mockReturnValue([]);
export const mockExecuteTool = vi.fn().mockResolvedValue("mock tool result");
export const mockInitialize = vi.fn().mockResolvedValue(undefined);
export const mockShutdown = vi.fn().mockResolvedValue(undefined);
export const mockGetConnectedServers = vi.fn().mockReturnValue([]);
export const mockGetUnavailableServers = vi.fn().mockReturnValue([
  "pubmed", "cms_coverage", "icd10", "npi_registry", "clinical_trials", "biorxiv",
]);

vi.mock("@/lib/mcp/client", () => ({
  MCPManager: vi.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    getToolsForArchetype: mockGetToolsForArchetype,
    getGapsForArchetype: mockGetGapsForArchetype,
    executeTool: mockExecuteTool,
    shutdown: mockShutdown,
    getConnectedServers: mockGetConnectedServers,
    getUnavailableServers: mockGetUnavailableServers,
  })),
  getMCPManager: vi.fn().mockReturnValue({
    initialize: mockInitialize,
    getToolsForArchetype: mockGetToolsForArchetype,
    getGapsForArchetype: mockGetGapsForArchetype,
    executeTool: mockExecuteTool,
    shutdown: mockShutdown,
    getConnectedServers: mockGetConnectedServers,
    getUnavailableServers: mockGetUnavailableServers,
  }),
}));

export function resetMCPMock() {
  mockGetToolsForArchetype.mockReset().mockReturnValue([]);
  mockGetGapsForArchetype.mockReset().mockReturnValue([]);
  mockExecuteTool.mockReset().mockResolvedValue("mock tool result");
  mockInitialize.mockReset().mockResolvedValue(undefined);
  mockShutdown.mockReset().mockResolvedValue(undefined);
}

/**
 * Configure the mock to return specific tools for an archetype.
 * Useful for testing construct/deploy phases.
 */
export function setMockToolsForArchetype(
  archetype: ArchetypeFamily,
  tools: Array<{ name: string; description: string }>,
) {
  mockGetToolsForArchetype.mockImplementation((a: ArchetypeFamily) => {
    if (a === archetype) {
      return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: { type: "object" as const, properties: {} },
      }));
    }
    return [];
  });
}
```

- [ ] **Step 4: Create test setup file**

Create `src/__tests__/setup.ts`:
```typescript
import { beforeEach, afterEach, vi } from "vitest";
import { resetPrismaMock } from "@/__mocks__/prisma";
import { resetAnthropicMock } from "@/__mocks__/anthropic";
import { resetMCPMock } from "@/__mocks__/mcp";

beforeEach(() => {
  resetPrismaMock();
  resetAnthropicMock();
  resetMCPMock();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
```

- [ ] **Step 5: Update vitest.config.ts to use setup file**

In `vitest.config.ts`, add to the `test` object:
```typescript
setupFiles: ["./src/__tests__/setup.ts"],
```

- [ ] **Step 6: Commit**

```bash
git add src/__mocks__/ src/__tests__/setup.ts vitest.config.ts
git commit -m "test: add mock infrastructure for Prisma, Anthropic SDK, and MCP"
```

---

### Task 3: Unit tests — Zod schemas (types.ts)

**Files:**
- Create: `src/__tests__/unit/pipeline/types.test.ts`
- Test: `src/lib/pipeline/types.ts`

- [ ] **Step 1: Write failing tests for Zod schema validation**

Create `src/__tests__/unit/pipeline/types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  BlueprintSchema,
  AgentResultSchema,
  SynthesisResultSchema,
  PresentationResultSchema,
  QualityReportSchema,
  AgentFindingSchema,
  ComplexityScoreSchema,
  SwarmTierEnum,
  ConfidenceLevelEnum,
  SourceTierEnum,
  EvidenceTypeEnum,
  FindingActionEnum,
} from "@/lib/pipeline/types";

describe("Pipeline Zod Schemas", () => {
  describe("Enums", () => {
    it("validates SwarmTier values", () => {
      expect(SwarmTierEnum.parse("MICRO")).toBe("MICRO");
      expect(SwarmTierEnum.parse("CAMPAIGN")).toBe("CAMPAIGN");
      expect(() => SwarmTierEnum.parse("INVALID")).toThrow();
    });

    it("validates ConfidenceLevel values", () => {
      expect(ConfidenceLevelEnum.parse("HIGH")).toBe("HIGH");
      expect(() => ConfidenceLevelEnum.parse("VERY_HIGH")).toThrow();
    });

    it("validates SourceTier values", () => {
      expect(SourceTierEnum.parse("PRIMARY")).toBe("PRIMARY");
      expect(() => SourceTierEnum.parse("QUATERNARY")).toThrow();
    });

    it("validates EvidenceType values", () => {
      expect(EvidenceTypeEnum.parse("direct")).toBe("direct");
      expect(() => EvidenceTypeEnum.parse("hearsay")).toThrow();
    });

    it("validates FindingAction values", () => {
      expect(FindingActionEnum.parse("keep")).toBe("keep");
      expect(FindingActionEnum.parse("boost")).toBe("boost");
      expect(() => FindingActionEnum.parse("delete")).toThrow();
    });
  });

  describe("ComplexityScoreSchema", () => {
    const validScore = {
      breadth: 3,
      depth: 4,
      interconnection: 2,
      total: 9,
      urgency: 1.0,
      adjusted: 9,
      reasoning: "Moderate complexity across three dimensions",
    };

    it("accepts valid complexity score", () => {
      expect(ComplexityScoreSchema.parse(validScore)).toEqual(validScore);
    });

    it("rejects breadth out of range", () => {
      expect(() =>
        ComplexityScoreSchema.parse({ ...validScore, breadth: 0 }),
      ).toThrow();
      expect(() =>
        ComplexityScoreSchema.parse({ ...validScore, breadth: 6 }),
      ).toThrow();
    });

    it("rejects urgency out of range", () => {
      expect(() =>
        ComplexityScoreSchema.parse({ ...validScore, urgency: 0.5 }),
      ).toThrow();
      expect(() =>
        ComplexityScoreSchema.parse({ ...validScore, urgency: 2.0 }),
      ).toThrow();
    });
  });

  describe("AgentFindingSchema", () => {
    const validFinding = {
      statement: "GLP-1 adoption is accelerating",
      evidence: "CMS data shows 40% increase in claims",
      confidence: "HIGH",
      sourceTier: "PRIMARY",
      evidenceType: "direct",
      source: "CMS Claims Database Q4 2025",
      implication: "Payers must adjust formularies",
      tags: ["glp-1", "pharmacy", "cost"],
    };

    it("accepts valid finding", () => {
      expect(AgentFindingSchema.parse(validFinding)).toEqual(validFinding);
    });

    it("rejects missing required fields", () => {
      const { statement, ...withoutStatement } = validFinding;
      expect(() => AgentFindingSchema.parse(withoutStatement)).toThrow();
    });
  });

  describe("BlueprintSchema", () => {
    const minimalBlueprint = {
      query: "How will GLP-1 drugs affect MA margins?",
      dimensions: [
        {
          name: "Market Dynamics",
          description: "Adoption trends",
          justification: "Key growth driver",
          dataSources: ["CMS"],
          lens: "financial",
          signalMatch: "GLP-1",
        },
        {
          name: "Regulatory",
          description: "CMS rules",
          justification: "Policy driver",
          dataSources: ["CMS"],
          lens: "regulatory",
          signalMatch: "coverage",
        },
      ],
      agents: [
        {
          name: "Market Analyst",
          archetype: "ANALYST-FINANCIAL",
          dimension: "Market Dynamics",
          mandate: "Analyze adoption curves",
          tools: [],
          lens: "financial",
          bias: "quantitative",
        },
        {
          name: "Regulatory Scout",
          archetype: "RESEARCHER-DOMAIN",
          dimension: "Regulatory",
          mandate: "Track CMS changes",
          tools: ["cms_coverage"],
          lens: "regulatory",
          bias: "conservative",
        },
      ],
      interconnections: [],
      complexityScore: {
        breadth: 2,
        depth: 3,
        interconnection: 2,
        total: 7,
        urgency: 1.0,
        adjusted: 7,
        reasoning: "Focused dual-dimension analysis",
      },
      tier: "STANDARD",
      estimatedTime: "3-5 minutes",
      ethicalConcerns: [],
    };

    it("accepts valid minimal blueprint", () => {
      const result = BlueprintSchema.parse(minimalBlueprint);
      expect(result.dimensions).toHaveLength(2);
      expect(result.agents).toHaveLength(2);
    });

    it("rejects blueprint with fewer than 2 dimensions", () => {
      expect(() =>
        BlueprintSchema.parse({
          ...minimalBlueprint,
          dimensions: [minimalBlueprint.dimensions[0]],
        }),
      ).toThrow();
    });

    it("rejects blueprint with fewer than 2 agents", () => {
      expect(() =>
        BlueprintSchema.parse({
          ...minimalBlueprint,
          agents: [minimalBlueprint.agents[0]],
        }),
      ).toThrow();
    });
  });

  describe("AgentResultSchema", () => {
    it("accepts valid agent result", () => {
      const result = AgentResultSchema.parse({
        agentName: "Market Analyst",
        archetype: "ANALYST-FINANCIAL",
        dimension: "Market Dynamics",
        findings: [],
        gaps: ["MCP server \"pubmed\" unavailable"],
        signals: ["Rising adoption curve"],
        minorityViews: [],
        toolsUsed: ["web_search"],
        tokensUsed: 5000,
      });
      expect(result.agentName).toBe("Market Analyst");
    });
  });

  describe("SynthesisResultSchema", () => {
    it("accepts valid synthesis result", () => {
      const result = SynthesisResultSchema.parse({
        layers: [
          {
            name: "foundation",
            insights: ["GLP-1 is the dominant cost driver"],
            description: "Core findings",
          },
        ],
        emergentInsights: [],
        tensionPoints: [],
        overallConfidence: "MEDIUM",
        criticRevisions: [],
      });
      expect(result.layers).toHaveLength(1);
    });
  });

  describe("PresentationResultSchema", () => {
    it("accepts valid presentation result", () => {
      const result = PresentationResultSchema.parse({
        html: "<html>...</html>",
        title: "GLP-1 Impact Analysis",
        subtitle: "Strategic Intelligence Brief",
        slideCount: 12,
      });
      expect(result.slideCount).toBe(12);
    });
  });

  describe("QualityReportSchema", () => {
    it("accepts minimal quality report", () => {
      const result = QualityReportSchema.parse({
        totalFindings: 15,
        sourcedFindings: 12,
        sourceCoveragePercent: 80,
        confidenceDistribution: { high: 5, medium: 7, low: 3 },
        sourceTierDistribution: { primary: 4, secondary: 6, tertiary: 5 },
        emergenceYield: 3,
        gapCount: 2,
        provenanceComplete: true,
      });
      expect(result.sourceCoveragePercent).toBe(80);
    });

    it("accepts quality report with optional extended fields", () => {
      const result = QualityReportSchema.parse({
        totalFindings: 15,
        sourcedFindings: 12,
        sourceCoveragePercent: 80,
        confidenceDistribution: { high: 5, medium: 7, low: 3 },
        sourceTierDistribution: { primary: 4, secondary: 6, tertiary: 5 },
        emergenceYield: 3,
        gapCount: 2,
        provenanceComplete: true,
        grade: "B+",
        overallScore: 82,
      });
      expect(result.grade).toBe("B+");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test -- src/__tests__/unit/pipeline/types.test.ts`
Expected: All tests PASS (these test existing Zod schemas)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/pipeline/types.test.ts
git commit -m "test: add Zod schema validation tests for all pipeline types"
```

---

### Task 4: Unit tests — crypto.ts

**Files:**
- Create: `src/__tests__/unit/lib/crypto.test.ts`
- Test: `src/lib/crypto.ts`

- [ ] **Step 1: Write crypto tests**

Create `src/__tests__/unit/lib/crypto.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("crypto", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_SECRET", "test-secret-key-at-least-16-chars");
  });

  it("encrypts and decrypts round-trip", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const plaintext = "sk-ant-secret-api-key-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same input (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("encrypted format is iv:authTag:ciphertext hex", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12 bytes = 24 hex chars (IV)
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars (auth tag)
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);     // variable length ciphertext
  });

  it("throws if ENCRYPTION_SECRET is missing", async () => {
    vi.stubEnv("ENCRYPTION_SECRET", "");
    // Re-import to pick up env change
    vi.resetModules();
    const { encrypt } = await import("@/lib/crypto");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_SECRET");
  });

  it("throws if ENCRYPTION_SECRET is too short", async () => {
    vi.stubEnv("ENCRYPTION_SECRET", "short");
    vi.resetModules();
    const { encrypt } = await import("@/lib/crypto");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_SECRET");
  });

  it("fails to decrypt with wrong key", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const encrypted = encrypt("secret");

    vi.stubEnv("ENCRYPTION_SECRET", "different-secret-key-at-least-16");
    vi.resetModules();
    const { decrypt } = await import("@/lib/crypto");
    expect(() => decrypt(encrypted)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/lib/crypto.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/crypto.test.ts
git commit -m "test: add AES-256-GCM crypto round-trip and validation tests"
```

---

### Task 5: Unit tests — rate-limit.ts

**Files:**
- Create: `src/__tests__/unit/lib/rate-limit.test.ts`
- Test: `src/lib/rate-limit.ts`

- [ ] **Step 1: Write rate limiter tests**

Create `src/__tests__/unit/lib/rate-limit.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 10_000); // 3 requests per 10s for testing
  });

  it("allows requests under the limit", () => {
    const r1 = limiter.check("ip1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("ip1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("ip1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests over the limit", () => {
    limiter.check("ip1");
    limiter.check("ip1");
    limiter.check("ip1");

    const r4 = limiter.check("ip1");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks different keys independently", () => {
    limiter.check("ip1");
    limiter.check("ip1");
    limiter.check("ip1");

    const r = limiter.check("ip2");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("allows requests after window expires", () => {
    vi.useFakeTimers();

    limiter.check("ip1");
    limiter.check("ip1");
    limiter.check("ip1");
    expect(limiter.check("ip1").allowed).toBe(false);

    vi.advanceTimersByTime(10_001);

    expect(limiter.check("ip1").allowed).toBe(true);

    vi.useRealTimers();
  });

  it("cleanup removes expired entries", () => {
    vi.useFakeTimers();

    limiter.check("ip1");
    vi.advanceTimersByTime(10_001);

    limiter.cleanup();

    // After cleanup, ip1 should have fresh allowance
    const r = limiter.check("ip1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/lib/rate-limit.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/rate-limit.test.ts
git commit -m "test: add rate limiter sliding window and cleanup tests"
```

---

### Task 6: Unit tests — settings-types.ts

**Files:**
- Create: `src/__tests__/unit/lib/settings-types.test.ts`
- Test: `src/lib/settings-types.ts`

- [ ] **Step 1: Write settings tests**

Create `src/__tests__/unit/lib/settings-types.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, type SettingsState } from "@/lib/settings-types";

describe("DEFAULT_SETTINGS", () => {
  it("has all required fields", () => {
    expect(DEFAULT_SETTINGS.primaryModel).toBe("claude-sonnet-4-6");
    expect(DEFAULT_SETTINGS.fallbackModel).toBe("gpt-4o");
    expect(DEFAULT_SETTINGS.temperature).toBe(0.3);
    expect(DEFAULT_SETTINGS.maxTokens).toBe(8192);
    expect(DEFAULT_SETTINGS.maxAgents).toBe(8);
  });

  it("has quality gates enabled by default", () => {
    expect(DEFAULT_SETTINGS.blueprintGateEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.findingsGateEnabled).toBe(true);
    expect(DEFAULT_SETTINGS.synthesisGateEnabled).toBe(true);
  });

  it("has default urgency set to balanced", () => {
    expect(DEFAULT_SETTINGS.defaultUrgency).toBe("balanced");
  });

  it("has healthcare skills enabled by default", () => {
    expect(DEFAULT_SETTINGS.enabledSkills).toContain("healthcare-quality-analytics");
    expect(DEFAULT_SETTINGS.enabledSkills).toContain("regulatory-intelligence");
    expect(DEFAULT_SETTINGS.enabledSkills.length).toBeGreaterThan(0);
  });

  it("is a valid SettingsState (type check)", () => {
    const settings: SettingsState = { ...DEFAULT_SETTINGS };
    expect(settings.primaryModel).toBeDefined();
  });

  it("can be spread and overridden (merge pattern)", () => {
    const custom = { ...DEFAULT_SETTINGS, maxAgents: 12, temperature: 0.7 };
    expect(custom.maxAgents).toBe(12);
    expect(custom.temperature).toBe(0.7);
    expect(custom.primaryModel).toBe("claude-sonnet-4-6"); // unchanged
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/lib/settings-types.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/settings-types.test.ts
git commit -m "test: add settings defaults and merge pattern tests"
```

---

### Task 7: Unit tests — MCP config and routing

**Files:**
- Create: `src/__tests__/unit/mcp/config.test.ts`
- Test: `src/lib/mcp/config.ts`

- [ ] **Step 1: Write MCP config tests**

Create `src/__tests__/unit/mcp/config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  MCP_SERVERS,
  ARCHETYPE_TOOL_ROUTING,
  WEB_SEARCH_ARCHETYPES,
} from "@/lib/mcp/config";

describe("MCP Server Config", () => {
  it("defines all 6 healthcare MCP servers", () => {
    const serverNames = Object.keys(MCP_SERVERS);
    expect(serverNames).toContain("pubmed");
    expect(serverNames).toContain("cms_coverage");
    expect(serverNames).toContain("icd10");
    expect(serverNames).toContain("npi_registry");
    expect(serverNames).toContain("clinical_trials");
    expect(serverNames).toContain("biorxiv");
    expect(serverNames).toHaveLength(6);
  });

  it("every server has required config fields", () => {
    for (const [name, config] of Object.entries(MCP_SERVERS)) {
      expect(config.description, `${name} missing description`).toBeTruthy();
      expect(typeof config.available, `${name} available not boolean`).toBe("boolean");
    }
  });
});

describe("Archetype Tool Routing", () => {
  it("maps RESEARCHER-DATA to pubmed, clinical_trials, biorxiv", () => {
    expect(ARCHETYPE_TOOL_ROUTING["RESEARCHER-DATA"]).toEqual(
      expect.arrayContaining(["pubmed", "clinical_trials", "biorxiv"]),
    );
  });

  it("maps RESEARCHER-DOMAIN to healthcare servers", () => {
    const servers = ARCHETYPE_TOOL_ROUTING["RESEARCHER-DOMAIN"]!;
    expect(servers).toContain("pubmed");
    expect(servers).toContain("cms_coverage");
    expect(servers).toContain("icd10");
    expect(servers).toContain("npi_registry");
  });

  it("gives ANALYST-FINANCIAL no MCP servers", () => {
    expect(ARCHETYPE_TOOL_ROUTING["ANALYST-FINANCIAL"]).toEqual([]);
  });

  it("all referenced servers exist in MCP_SERVERS", () => {
    const validServers = new Set(Object.keys(MCP_SERVERS));
    for (const [archetype, servers] of Object.entries(ARCHETYPE_TOOL_ROUTING)) {
      for (const server of servers ?? []) {
        expect(validServers.has(server),
          `Archetype ${archetype} references unknown server "${server}"`,
        ).toBe(true);
      }
    }
  });
});

describe("Web Search Archetypes", () => {
  it("includes RESEARCHER-WEB", () => {
    expect(WEB_SEARCH_ARCHETYPES.has("RESEARCHER-WEB")).toBe(true);
  });

  it("includes CRITIC-FACTUAL", () => {
    expect(WEB_SEARCH_ARCHETYPES.has("CRITIC-FACTUAL")).toBe(true);
  });

  it("does not include CRITIC-LOGICAL", () => {
    expect(WEB_SEARCH_ARCHETYPES.has("CRITIC-LOGICAL")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/mcp/config.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/mcp/config.test.ts
git commit -m "test: add MCP server config and archetype routing validation tests"
```

---

### Task 8: Unit tests — settings-store.ts (Prisma-backed)

**Files:**
- Create: `src/__tests__/unit/lib/settings-store.test.ts`
- Test: `src/lib/settings-store.ts`

> **Note:** These tests use `prismaMock` from the mock infrastructure. The source code under test already exists — no verify-fail step needed.

- [ ] **Step 1: Write settings store tests**

Create `src/__tests__/unit/lib/settings-store.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "@/__mocks__/prisma";
import { loadSettings, saveSettings } from "@/lib/settings-store";
import { DEFAULT_SETTINGS } from "@/lib/settings-types";

describe("loadSettings", () => {
  it("returns defaults when no row exists", async () => {
    prismaMock.settings.findUnique.mockResolvedValue(null);
    const result = await loadSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored data with defaults", async () => {
    const partial = { maxAgents: 12, temperature: 0.9 };
    prismaMock.settings.findUnique.mockResolvedValue({
      id: "default",
      data: JSON.stringify(partial),
      onboardingDismissed: false,
      hasCompletedTour: false,
      updatedAt: new Date(),
    });
    const result = await loadSettings();
    expect(result.maxAgents).toBe(12);
    expect(result.temperature).toBe(0.9);
    expect(result.primaryModel).toBe(DEFAULT_SETTINGS.primaryModel); // from defaults
  });

  it("returns defaults on database error", async () => {
    prismaMock.settings.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await loadSettings();
    expect(result).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saveSettings", () => {
  it("upserts settings as JSON", async () => {
    const settings = { ...DEFAULT_SETTINGS, maxAgents: 16 };
    prismaMock.settings.upsert.mockResolvedValue({
      id: "default",
      data: JSON.stringify(settings),
      onboardingDismissed: false,
      hasCompletedTour: false,
      updatedAt: new Date(),
    });

    const result = await saveSettings(settings);
    expect(result).toEqual(settings);
    expect(prismaMock.settings.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      update: { data: JSON.stringify(settings) },
      create: { id: "default", data: JSON.stringify(settings) },
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/lib/settings-store.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/settings-store.test.ts
git commit -m "test: add settings store serialization and Prisma mock tests"
```

---

### Task 9: Unit tests — logger.ts

**Files:**
- Create: `src/__tests__/unit/lib/logger.test.ts`
- Test: `src/lib/logger.ts`

> **Note:** Source code already exists — no verify-fail step needed.

- [ ] **Step 1: Write logger tests**

Create `src/__tests__/unit/lib/logger.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "@/lib/logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  it("returns a logger with info, warn, error, debug methods", () => {
    const log = createLogger("test-run-id");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("info logs to console.log", () => {
    const log = createLogger("run123");
    log.info("THINK", "decomposing query");
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("warn logs to console.warn", () => {
    const log = createLogger("run123");
    log.warn("DEPLOY", "agent fallback");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("error logs to console.error", () => {
    const log = createLogger("run123");
    log.error("PRESENT", "generation failed", new Error("oops"));
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("debug logs to console.debug", () => {
    const log = createLogger("run123");
    log.debug("THINK", "debug info", { key: "value" });
    expect(console.debug).toHaveBeenCalledTimes(1);
  });

  it("formats as JSON in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = createLogger("run-prod");
    log.info("THINK", "test message");
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe("info");
    expect(parsed.runId).toBe("run-prod");
    expect(parsed.phase).toBe("THINK");
    expect(parsed.message).toBe("test message");
  });

  it("formats as human-readable in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = createLogger("run-dev-12345678");
    log.info("DEPLOY", "deploying agents");
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(output).toContain("[INFO]");
    expect(output).toContain("run-dev-");
    expect(output).toContain("DEPLOY");
  });

  it("includes error details when Error is passed", () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = createLogger("run-err");
    log.error("PRESENT", "failed", new Error("test error"));
    const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.error).toBe("test error");
    expect(parsed.stack).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test -- src/__tests__/unit/lib/logger.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/lib/logger.test.ts
git commit -m "test: add structured logger output formatting tests"
```

---

### Task 10: Run full test suite and verify coverage

- [ ] **Step 1: Run all tests with coverage**

Run: `npm run test:coverage`
Expected: All tests PASS, coverage report generated.

- [ ] **Step 2: Verify the test count and structure**

Run: `npm run test -- --reporter=verbose`
Expected: Tests organized by describe blocks, all passing.

- [ ] **Step 3: Commit any adjustments**

```bash
git add -A
git commit -m "test: finalize test suite — all unit tests passing"
```

---

## Chunk 2: CI/CD Pipeline

### Task 11: Add git hooks (simple-git-hooks + lint-staged)

**Files:**
- Modify: `package.json` (add devDependencies + config)

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install -D simple-git-hooks lint-staged
```

- [ ] **Step 2: Add config to package.json**

Add to `package.json` (top level):
```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix"]
  }
}
```

- [ ] **Step 3: Initialize hooks**

Run: `npx simple-git-hooks`
Expected: "pre-commit hook set" or similar confirmation.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pre-commit git hooks with lint-staged"
```

---

### Task 12: Add next.config.ts standalone output for Docker

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add output: "standalone"**

In `next.config.ts`, add `output: "standalone"` to the config:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  serverExternalPackages: ["@prisma/client", "prisma"],
};
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: Build succeeds, `.next/standalone/` directory created.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore: enable Next.js standalone output for Docker builds"
```

---

### Task 13: Create Dockerfile

> **Depends on:** Task 12 (`output: "standalone"` in `next.config.ts`). The runner stage copies from `.next/standalone/` which only exists when standalone output is enabled and `npm run build` has been run.

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

Create `.dockerignore`:
```
node_modules
.next
.git
.env*
prisma/dev.db
prisma/dev.db-journal
src/generated
docs
*.md
```

- [ ] **Step 2: Create Dockerfile**

Create `Dockerfile`:
```dockerfile
# ─── Stage 1: Dependencies ───────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ──────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: Runner ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone Next.js server
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Copy Prisma schema and generated client for runtime
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Create volume mount point for SQLite
RUN mkdir -p /app/data
ENV DATABASE_URL=file:/app/data/prism.db

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/onboarding/status || exit 1

CMD ["node", "server.js"]
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add multi-stage Dockerfile for production builds"
```

---

### Task 14: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Test
        run: npm run test:coverage

      - name: Build
        run: npm run build

      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, type-check, test, build"
```

---

### Task 15: Create Docker publish workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`

- [ ] **Step 1: Create Docker publish workflow**

Create `.github/workflows/docker-publish.yml`:
```yaml
name: Docker Publish

on:
  push:
    branches: [main]

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  docker:
    needs: ci
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "ci: add Docker publish workflow to GHCR on main push"
```

---

## Chunk 3: MCP SSE Transport

### Task 16: Update MCPServerConfig for dual transport

**Files:**
- Modify: `src/lib/mcp/config.ts`

- [ ] **Step 1: Write test for new config shape**

Create `src/__tests__/unit/mcp/config-sse.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

describe("MCP Server Config (SSE)", () => {
  it("all servers have transport type defined", async () => {
    const { MCP_SERVERS } = await import("@/lib/mcp/config");
    for (const [name, config] of Object.entries(MCP_SERVERS)) {
      expect(config.transport, `${name} missing transport`).toBeDefined();
      expect(["sse", "stdio"]).toContain(config.transport);
    }
  });

  it("SSE servers have envUrlKey defined", async () => {
    const { MCP_SERVERS } = await import("@/lib/mcp/config");
    for (const [name, config] of Object.entries(MCP_SERVERS)) {
      if (config.transport === "sse") {
        expect(config.envUrlKey, `${name} missing envUrlKey`).toBeTruthy();
      }
    }
  });

  it("all servers are available by default", async () => {
    const { MCP_SERVERS } = await import("@/lib/mcp/config");
    for (const [name, config] of Object.entries(MCP_SERVERS)) {
      expect(config.available, `${name} should be available`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/unit/mcp/config-sse.test.ts`
Expected: FAIL — current config has no `transport` field.

- [ ] **Step 3: Update MCPServerConfig interface and server entries**

Modify `src/lib/mcp/config.ts`. Replace the `MCPServerConfig` interface:
```typescript
export interface MCPServerConfig {
  /** Human-readable description of what this server provides */
  description: string;
  /**
   * Whether this server is enabled.
   * If true, MCPManager will attempt connection at init.
   * Connection failures degrade gracefully (server marked unavailable at runtime).
   */
  available: boolean;
  /** Transport type: "sse" for remote HTTP servers, "stdio" for local processes */
  transport: "sse" | "stdio";
  // ── SSE transport fields ──
  /** Env var key holding the server URL (resolved at runtime) */
  envUrlKey?: string;
  // ── Stdio transport fields ──
  /** Command to spawn the server process */
  command?: string;
  /** Arguments to pass to the command */
  args?: string[];
  /** Environment variables for the spawned process */
  env?: Record<string, string>;
}
```

Replace the `MCP_SERVERS` object:
```typescript
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  pubmed: {
    description: "PubMed article search and retrieval",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_PUBMED_URL",
  },
  cms_coverage: {
    description: "CMS national and local coverage determinations",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_CMS_COVERAGE_URL",
  },
  icd10: {
    description: "ICD-10 code lookup, search, and validation",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_ICD10_URL",
  },
  npi_registry: {
    description: "NPI provider registry search and validation",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_NPI_REGISTRY_URL",
  },
  clinical_trials: {
    description: "ClinicalTrials.gov search and analysis",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_CLINICAL_TRIALS_URL",
  },
  biorxiv: {
    description: "bioRxiv/medRxiv preprint search and retrieval",
    available: true,
    transport: "sse",
    envUrlKey: "MCP_BIORXIV_URL",
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/__tests__/unit/mcp/config-sse.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all existing tests to check nothing broke**

Run: `npm run test`
Expected: All tests PASS (config test from Task 7 may need minor update for removed `command`/`args` fields)

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/config.ts src/__tests__/unit/mcp/config-sse.test.ts
git commit -m "feat(mcp): add SSE transport config, enable all 6 servers"
```

---

### Task 17: Update MCPManager for SSE transport

**Files:**
- Modify: `src/lib/mcp/client.ts`

- [ ] **Step 1: Write test for SSE connection behavior**

Create `src/__tests__/integration/mcp/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the MCP SDK transports
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn(),
}));

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockListTools = vi.fn().mockResolvedValue({
  tools: [
    { name: "search_articles", description: "Search PubMed", inputSchema: { type: "object", properties: {} } },
  ],
});
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "mock result" }],
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
  })),
}));

// Mock remote transports (StreamableHTTP preferred, SSE fallback)
vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({})),
}));

describe("MCPManager", () => {
  beforeEach(() => {
    vi.resetModules();
    mockConnect.mockReset().mockResolvedValue(undefined);
    mockListTools.mockReset().mockResolvedValue({
      tools: [
        { name: "search_articles", description: "Search PubMed", inputSchema: { type: "object", properties: {} } },
      ],
    });
  });

  it("connects to SSE servers when URL is provided", async () => {
    vi.stubEnv("MCP_PUBMED_URL", "https://mcp.example.com/pubmed");
    // Only enable pubmed for this test
    vi.doMock("@/lib/mcp/config", () => ({
      MCP_SERVERS: {
        pubmed: {
          description: "PubMed",
          available: true,
          transport: "sse" as const,
          envUrlKey: "MCP_PUBMED_URL",
        },
      },
      ARCHETYPE_TOOL_ROUTING: { "RESEARCHER-DATA": ["pubmed"] },
      WEB_SEARCH_ARCHETYPES: new Set(),
    }));

    const { MCPManager } = await import("@/lib/mcp/client");
    const manager = new MCPManager();
    await manager.initialize();

    expect(manager.getConnectedServers()).toContain("pubmed");
    expect(manager.getUnavailableServers()).toHaveLength(0);

    await manager.shutdown();
  });

  it("marks SSE server unavailable when URL is missing", async () => {
    vi.stubEnv("MCP_PUBMED_URL", "");
    vi.doMock("@/lib/mcp/config", () => ({
      MCP_SERVERS: {
        pubmed: {
          description: "PubMed",
          available: true,
          transport: "sse" as const,
          envUrlKey: "MCP_PUBMED_URL",
        },
      },
      ARCHETYPE_TOOL_ROUTING: {},
      WEB_SEARCH_ARCHETYPES: new Set(),
    }));

    const { MCPManager } = await import("@/lib/mcp/client");
    const manager = new MCPManager();
    await manager.initialize();

    expect(manager.getConnectedServers()).toHaveLength(0);
    expect(manager.getUnavailableServers()).toContain("pubmed");

    await manager.shutdown();
  });

  it("routes tool execution to correct server", async () => {
    vi.stubEnv("MCP_PUBMED_URL", "https://mcp.example.com/pubmed");
    vi.doMock("@/lib/mcp/config", () => ({
      MCP_SERVERS: {
        pubmed: {
          description: "PubMed",
          available: true,
          transport: "sse" as const,
          envUrlKey: "MCP_PUBMED_URL",
        },
      },
      ARCHETYPE_TOOL_ROUTING: { "RESEARCHER-DATA": ["pubmed"] },
      WEB_SEARCH_ARCHETYPES: new Set(),
    }));

    const { MCPManager } = await import("@/lib/mcp/client");
    const manager = new MCPManager();
    await manager.initialize();

    const result = await manager.executeTool("pubmed__search_articles", { query: "test" });
    expect(result).toBe("mock result");

    await manager.shutdown();
  });

  it("getToolsForArchetype returns tools for connected servers", async () => {
    vi.stubEnv("MCP_PUBMED_URL", "https://mcp.example.com/pubmed");
    vi.doMock("@/lib/mcp/config", () => ({
      MCP_SERVERS: {
        pubmed: {
          description: "PubMed",
          available: true,
          transport: "sse" as const,
          envUrlKey: "MCP_PUBMED_URL",
        },
      },
      ARCHETYPE_TOOL_ROUTING: { "RESEARCHER-DATA": ["pubmed"] },
      WEB_SEARCH_ARCHETYPES: new Set(),
    }));

    const { MCPManager } = await import("@/lib/mcp/client");
    const manager = new MCPManager();
    await manager.initialize();

    const tools = manager.getToolsForArchetype("RESEARCHER-DATA");
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("pubmed__search_articles");

    await manager.shutdown();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/integration/mcp/client.test.ts`
Expected: FAIL — MCPManager doesn't handle SSE transport yet.

- [ ] **Step 3: Update MCPManager to support SSE transport**

Modify `src/lib/mcp/client.ts`. Add the SSE import:
```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
```

Replace the `connectServer` method:
```typescript
private async connectServer(
  name: string,
  config: MCPServerConfig,
): Promise<void> {
  let transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;

  if (config.transport === "sse") {
    const url = config.envUrlKey ? process.env[config.envUrlKey] : undefined;
    if (!url) {
      console.warn(
        `[MCPManager] Remote server "${name}" skipped: env var ${config.envUrlKey} not set`,
      );
      this.unavailableServers.push(name);
      return;
    }
    // Prefer StreamableHTTP (modern), fall back to SSE (legacy) if needed
    try {
      transport = new StreamableHTTPClientTransport(new URL(url));
    } catch {
      transport = new SSEClientTransport(new URL(url));
    }
  } else {
    if (!config.command) {
      throw new Error(`Stdio server "${name}" missing command`);
    }
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env,
    });
  }

  const client = new Client(
    { name: `prism-${name}`, version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  const { tools } = await client.listTools();

  const toolInfos: MCPToolInfo[] = tools.map((tool) => ({
    name: tool.name,
    qualifiedName: `${name}__${tool.name}`,
    serverName: name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema as Record<string, unknown>,
  }));

  this.servers.set(name, { client, transport, tools: toolInfos });
}
```

Update the `ConnectedServer` interface:
```typescript
interface ConnectedServer {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;
  tools: MCPToolInfo[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/__tests__/integration/mcp/client.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/mcp/client.ts src/__tests__/integration/mcp/client.test.ts
git commit -m "feat(mcp): add SSE transport support for remote MCP servers"
```

---

### Task 18: Verify end-to-end and finalize

- [ ] **Step 1: Run full CI command locally**

Run: `npm run ci`
Expected: lint → type-check → test → build all pass.

- [ ] **Step 2: Run type-check to verify no type errors from MCP changes**

Run: `npm run type-check`
Expected: No errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize testing, CI/CD, and MCP enablement"
```
