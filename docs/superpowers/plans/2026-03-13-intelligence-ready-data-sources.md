# Intelligence-Ready Data Source Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 15 standalone MCP sidecar servers with a three-layer in-process data source architecture (API Clients → Granular Tools → Research Tools) that maximizes agent intelligence output quality.

**Architecture:** Three layers: Layer 1 (internal API clients with rate limiting, retry, typed responses), Layer 2 (granular tools returning markdown-formatted results), Layer 3 (compound research tools combining multiple APIs into intelligence packets). ToolRegistry replaces MCPManager for 15 Protoprism sources; MCPManager remains for 6 Anthropic remote MCP servers. deploy.ts routes by tool name format: no `__` → ToolRegistry, has `__` → MCPManager.

**Tech Stack:** TypeScript, vitest, Zod, native fetch, Anthropic SDK types

**Spec:** `docs/superpowers/specs/2026-03-13-intelligence-ready-data-sources-design.md`

---

## File Structure

```
src/lib/data-sources/
  types.ts                   ← All interfaces: ApiClientConfig, ApiResponse, DataVintage, DataSourceTool, ToolResult, Citation, ResearchToolInput, CacheEntry, McpBridgeResult
  rate-limit.ts              ← GlobalRateLimiter (semaphore) + TokenBucketLimiter (per-client)
  cache.ts                   ← ResultCache with promise coalescing
  format.ts                  ← Shared markdown formatting helpers (table, truncation, citations)
  registry.ts                ← ToolRegistry class + ARCHETYPE_TOOL_ROUTING + WEB_SEARCH_ARCHETYPES
  mcp-bridge.ts              ← McpBridge for Layer 3 → Anthropic MCP server calls

  clients/
    openfda.ts               ← openFDA API client (ported from mcp-servers/openfda-mcp-server)
    sec-edgar.ts             ← SEC EDGAR API client
    federal-register.ts      ← Federal Register API client
    uspto-patents.ts         ← USPTO PatentsView API client
    congress-gov.ts          ← Congress.gov API client
    bls-data.ts              ← BLS Public Data API client
    census-bureau.ts         ← Census Bureau API client
    who-gho.ts               ← WHO Global Health Observatory API client
    gpo-govinfo.ts           ← GPO GovInfo API client
    cbo.ts                   ← Congressional Budget Office API client
    oecd-health.ts           ← OECD Health Statistics API client
    sam-gov.ts               ← SAM.gov API client
    fda-orange-book.ts       ← FDA Orange Book API client
    grants-gov.ts            ← Grants.gov API client
    ahrq-hcup.ts             ← AHRQ HCUP API client

  tools/
    openfda.tools.ts         ← 6 openFDA granular tools (markdown output)
    sec-edgar.tools.ts       ← SEC EDGAR granular tools
    federal-register.tools.ts
    uspto-patents.tools.ts
    congress-gov.tools.ts
    bls-data.tools.ts
    census-bureau.tools.ts
    who-gho.tools.ts
    gpo-govinfo.tools.ts
    cbo.tools.ts
    oecd-health.tools.ts
    sam-gov.tools.ts
    fda-orange-book.tools.ts
    grants-gov.tools.ts
    ahrq-hcup.tools.ts

  research/
    drug-safety.ts           ← research_drug_safety (openFDA AE + labels + Orange Book)
    clinical-evidence.ts     ← research_clinical_evidence (PubMed + ClinicalTrials + bioRxiv via McpBridge)
    coverage-policy.ts       ← research_coverage_policy (CMS NCD/LCD + ICD-10 via McpBridge)
    company-position.ts      ← research_company_position (SEC + SAM.gov + patents)
    regulatory-landscape.ts  ← research_regulatory_landscape (Fed Register + CMS + Congress + GPO)
    market-dynamics.ts       ← research_market_dynamics (BLS + Census + OECD)
    patent-landscape.ts      ← research_patent_landscape (USPTO + FDA Orange Book)
    legislative-status.ts    ← research_legislative_status (Congress + CBO + GPO)
    provider-landscape.ts    ← research_provider_landscape (NPI + Census via McpBridge)
    global-health.ts         ← research_global_health (WHO + OECD + AHRQ)
    competitive-intel.ts     ← research_competitive_intel (SEC + patents + trials + FDA)
    funding-landscape.ts     ← research_funding_landscape (Grants.gov + SAM.gov)
    quality-benchmarks.ts    ← research_quality_benchmarks (AHRQ HCUP + CMS + WHO)

  __tests__/
    types.test.ts
    rate-limit.test.ts
    cache.test.ts
    format.test.ts
    registry.test.ts
    mcp-bridge.test.ts
    clients/
      openfda.test.ts
    tools/
      openfda.tools.test.ts
    research/
      drug-safety.test.ts

Modified files:
  src/lib/pipeline/deploy.ts        ← Add ToolRegistry import + dual routing
  src/lib/mcp/config.ts             ← Remove 15 Protoprism entries, keep 6 Anthropic
  src/lib/mcp/client.ts             ← Add isServerAvailable() method
```

---

## Chunk 1: Infrastructure

Infrastructure modules that all other layers depend on: types, rate limiting, caching, and formatting.

### Task 1: Types module

**Files:**
- Create: `src/lib/data-sources/types.ts`
- Test: `src/lib/data-sources/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/types.test.ts
import { describe, it, expect } from "vitest";

describe("data-sources/types", () => {
  it("exports budget constants with expected values", async () => {
    const mod = await import("../types");
    expect(mod.LAYER_2_CHAR_BUDGET).toBe(4000);
    expect(mod.LAYER_3_CHAR_BUDGET).toBe(6000);
    expect(mod.MAX_TABLE_ROWS_LAYER_2).toBe(20);
    expect(mod.MAX_TABLE_ROWS_LAYER_3).toBe(10);
    expect(mod.MAX_CONCURRENT_REQUESTS).toBe(20);
  });

  it("exports ToolCache interface (used by DataSourceTool.handler)", async () => {
    // ToolCache is a type-only export, but we verify the module loads
    // and that isToolResult (which depends on types) is a function
    const { isToolResult } = await import("../types");
    expect(typeof isToolResult).toBe("function");
  });

  it("isToolResult validates a complete ToolResult", async () => {
    const { isToolResult } = await import("../types");
    const valid = {
      content: "## Test\nSome content",
      citations: [{ id: "[TEST-1]", source: "Test", query: "test query" }],
      vintage: { queriedAt: new Date().toISOString(), source: "Test API" },
      confidence: "HIGH" as const,
      truncated: false,
    };
    expect(isToolResult(valid)).toBe(true);
  });

  it("isToolResult rejects incomplete objects", async () => {
    const { isToolResult } = await import("../types");
    expect(isToolResult({ content: "hello" })).toBe(false);
    expect(isToolResult(null)).toBe(false);
    expect(isToolResult("string")).toBe(false);
    expect(isToolResult(undefined)).toBe(false);
    expect(isToolResult(42)).toBe(false);
  });

  it("isToolResult rejects objects with invalid confidence", async () => {
    const { isToolResult } = await import("../types");
    expect(isToolResult({
      content: "test",
      citations: [],
      vintage: { queriedAt: "2026-01-01", source: "API" },
      confidence: "INVALID",
      truncated: false,
    })).toBe(false);
  });

  it("isToolResult rejects objects with missing vintage.source", async () => {
    const { isToolResult } = await import("../types");
    expect(isToolResult({
      content: "test",
      citations: [],
      vintage: { queriedAt: "2026-01-01" }, // missing source
      confidence: "HIGH",
      truncated: false,
    })).toBe(false);
  });

  it("isToolResult rejects objects with non-boolean truncated", async () => {
    const { isToolResult } = await import("../types");
    expect(isToolResult({
      content: "test",
      citations: [],
      vintage: { queriedAt: "2026-01-01", source: "API" },
      confidence: "HIGH",
      truncated: "no", // string instead of boolean
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/types.test.ts`
Expected: FAIL — module `../types` does not exist

- [ ] **Step 3: Write the types module**

```typescript
// src/lib/data-sources/types.ts
/**
 * Intelligence-Ready Data Source Types
 *
 * Core interfaces for the three-layer data source architecture.
 * Layer 1 (API Clients), Layer 2 (Granular Tools), Layer 3 (Research Tools).
 */

// NOTE: No imports from ./cache — avoids circular dependency.
// DataSourceTool.handler uses ToolCache interface (defined below),
// which ResultCache implements.

// ─── Constants ───────────────────────────────────────────────

/** Maximum characters for a Layer 2 granular tool response */
export const LAYER_2_CHAR_BUDGET = 4000;

/** Maximum characters for a Layer 3 intelligence packet */
export const LAYER_3_CHAR_BUDGET = 6000;

/** Maximum table rows in Layer 2 responses */
export const MAX_TABLE_ROWS_LAYER_2 = 20;

/** Maximum table rows in Layer 3 intelligence packets */
export const MAX_TABLE_ROWS_LAYER_3 = 10;

/** Maximum concurrent outbound API requests across all clients */
export const MAX_CONCURRENT_REQUESTS = 20;

// ─── Layer 1: API Client Types ───────────────────────────────

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  userAgent?: string;
  rateLimitMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  vintage: DataVintage;
}

export interface DataVintage {
  queriedAt: string;
  dataThrough?: string;
  source: string;
}

// ─── Cache Interface ─────────────────────────────────────────

/**
 * Minimal cache interface used by tool handlers.
 * ResultCache (in cache.ts) implements this — defined here to avoid
 * a circular import between types.ts and cache.ts.
 */
export interface ToolCache {
  getOrCompute(
    toolName: string,
    input: Record<string, unknown>,
    compute: () => Promise<ToolResult>,
  ): Promise<ToolResult>;
}

// ─── Layer 2: Granular Tool Types ────────────────────────────

export interface DataSourceTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, cache: ToolCache) => Promise<ToolResult>;
  layer: 2 | 3;
  sources: string[];
}

export interface ToolResult {
  content: string;
  citations: Citation[];
  vintage: DataVintage;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  truncated: boolean;
}

export interface Citation {
  id: string;
  source: string;
  query: string;
  dateRange?: string;
  resultCount?: number;
}

// ─── Layer 3: Research Tool Types ────────────────────────────

export interface ResearchToolInput {
  query: string;
  timeframe?: string;
  focus?: string;
}

// ─── MCP Bridge Types ────────────────────────────────────────

export type AnthropicMcpServer =
  | "pubmed"
  | "clinical_trials"
  | "biorxiv"
  | "cms_coverage"
  | "icd10"
  | "npi_registry";

export interface McpBridgeResult {
  available: boolean;
  server: string;
  toolName: string;
  data?: string;
  error?: string;
}

// ─── Cache Types ─────────────────────────────────────────────

export interface CacheEntry {
  result: ToolResult;
  createdAt: number;
}

// ─── Type Guard ──────────────────────────────────────────────

export function isToolResult(value: unknown): value is ToolResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.content === "string" &&
    Array.isArray(v.citations) &&
    v.vintage !== null &&
    typeof v.vintage === "object" &&
    typeof (v.vintage as Record<string, unknown>).queriedAt === "string" &&
    typeof (v.vintage as Record<string, unknown>).source === "string" &&
    (v.confidence === "HIGH" || v.confidence === "MEDIUM" || v.confidence === "LOW") &&
    typeof v.truncated === "boolean"
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/types.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/types.ts src/lib/data-sources/__tests__/types.test.ts
git commit -m "feat(data-sources): add core type definitions for three-layer architecture"
```

---

### Task 2: GlobalRateLimiter + TokenBucketLimiter

**Files:**
- Create: `src/lib/data-sources/rate-limit.ts`
- Test: `src/lib/data-sources/__tests__/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("GlobalRateLimiter", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("allows up to maxConcurrent simultaneous acquisitions", async () => {
    const { GlobalRateLimiter } = await import("../rate-limit");
    const limiter = new GlobalRateLimiter(2);

    await limiter.acquire();
    await limiter.acquire();

    // Third should block — verify by checking it doesn't resolve immediately
    let thirdResolved = false;
    const thirdPromise = limiter.acquire().then(() => { thirdResolved = true; });

    // Let microtasks settle
    await vi.advanceTimersByTimeAsync(0);
    expect(thirdResolved).toBe(false);

    // Release one slot
    limiter.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(thirdResolved).toBe(true);
    limiter.release();
    limiter.release();
  });

  it("queues requests when at capacity", async () => {
    const { GlobalRateLimiter } = await import("../rate-limit");
    const limiter = new GlobalRateLimiter(1);
    await limiter.acquire();

    const order: number[] = [];
    const p1 = limiter.acquire().then(() => order.push(1));
    const p2 = limiter.acquire().then(() => order.push(2));

    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([]); // Both blocked

    limiter.release(); // Unblocks first queued
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1]);

    limiter.release(); // Unblocks second queued
    await vi.advanceTimersByTimeAsync(0);
    expect(order).toEqual([1, 2]);

    limiter.release();
    limiter.release();
  });
});

describe("TokenBucketLimiter", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("allows immediate request when bucket has tokens", async () => {
    const { TokenBucketLimiter } = await import("../rate-limit");
    const limiter = new TokenBucketLimiter(10, 1); // 10 req/s, 1 token bucket
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBe(0);
  });

  it("enforces minimum interval between requests", async () => {
    const { TokenBucketLimiter } = await import("../rate-limit");
    const limiter = new TokenBucketLimiter(4, 1); // 4 req/s → 250ms interval

    await limiter.acquire();

    // Second call should wait ~250ms
    const secondPromise = limiter.acquire();
    await vi.advanceTimersByTimeAsync(250);
    await secondPromise;
    // If we got here, the wait worked
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/rate-limit.test.ts`
Expected: FAIL — module `../rate-limit` does not exist

- [ ] **Step 3: Write the rate limiter module**

```typescript
// src/lib/data-sources/rate-limit.ts
/**
 * Rate Limiting for Data Source Clients
 *
 * Two layers:
 * 1. GlobalRateLimiter: Semaphore limiting total concurrent outbound requests (default 20)
 * 2. TokenBucketLimiter: Per-client rate limiter based on upstream API limits
 */

import { MAX_CONCURRENT_REQUESTS } from "./types";

// ─── Global Concurrency Limiter ──────────────────────────────

/**
 * Semaphore-based concurrency limiter. Limits total concurrent outbound
 * API requests across all Layer 1 clients to prevent overwhelming
 * upstream APIs when many agents run in parallel.
 */
export class GlobalRateLimiter {
  private available: number;
  private readonly maxConcurrent: number;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number = MAX_CONCURRENT_REQUESTS) {
    this.maxConcurrent = maxConcurrent;
    this.available = maxConcurrent;
  }

  /** Acquire a slot. Resolves immediately if slots available, queues otherwise. */
  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.available--;
        resolve();
      });
    });
  }

  /** Release a slot and unblock the next queued request. */
  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.available = Math.min(this.available + 1, this.maxConcurrent);
    }
  }
}

/** Singleton global rate limiter — shared across all Layer 1 clients */
export const globalRateLimiter = new GlobalRateLimiter();

// ─── Per-Client Token Bucket Limiter ─────────────────────────

/**
 * Simple token bucket rate limiter for per-client request pacing.
 * Enforces a minimum interval between requests based on the upstream
 * API's documented rate limits.
 */
export class TokenBucketLimiter {
  private readonly intervalMs: number;
  private lastRequestTime = 0;

  /**
   * @param requestsPerSecond — max requests per second for this client
   * @param _bucketSize — unused, reserved for future burst support
   */
  constructor(requestsPerSecond: number, _bucketSize: number = 1) {
    this.intervalMs = Math.ceil(1000 / requestsPerSecond);
  }

  /** Wait until the next request slot is available. */
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.intervalMs) {
      const waitMs = this.intervalMs - elapsed;
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastRequestTime = Date.now();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/rate-limit.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/rate-limit.ts src/lib/data-sources/__tests__/rate-limit.test.ts
git commit -m "feat(data-sources): add global concurrency + per-client token bucket rate limiting"
```

---

### Task 3: ResultCache with promise coalescing

**Files:**
- Create: `src/lib/data-sources/cache.ts`
- Test: `src/lib/data-sources/__tests__/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/cache.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolResult } from "../types";

const mockResult: ToolResult = {
  content: "## Test\nSome results",
  citations: [{ id: "[T-1]", source: "TestAPI", query: "test" }],
  vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "TestAPI" },
  confidence: "HIGH",
  truncated: false,
};

describe("ResultCache", () => {
  beforeEach(() => { vi.resetModules(); });

  it("returns cached result on second call with same key", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let callCount = 0;
    const compute = async () => { callCount++; return mockResult; };

    const r1 = await cache.getOrCompute("tool_a", { q: "test" }, compute);
    const r2 = await cache.getOrCompute("tool_a", { q: "test" }, compute);

    expect(r1).toEqual(mockResult);
    expect(r2).toEqual(mockResult);
    expect(callCount).toBe(1); // compute called only once
  });

  it("calls compute for different inputs", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let callCount = 0;
    const compute = async () => { callCount++; return mockResult; };

    await cache.getOrCompute("tool_a", { q: "one" }, compute);
    await cache.getOrCompute("tool_a", { q: "two" }, compute);

    expect(callCount).toBe(2);
  });

  it("coalesces concurrent requests for the same key", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let callCount = 0;
    const compute = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return mockResult;
    };

    // Fire 3 concurrent calls with the same key
    const [r1, r2, r3] = await Promise.all([
      cache.getOrCompute("tool_a", { q: "test" }, compute),
      cache.getOrCompute("tool_a", { q: "test" }, compute),
      cache.getOrCompute("tool_a", { q: "test" }, compute),
    ]);

    expect(callCount).toBe(1); // Only one actual API call
    expect(r1).toEqual(mockResult);
    expect(r2).toEqual(mockResult);
    expect(r3).toEqual(mockResult);
  });

  it("removes inflight entry on error and retries on next call", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let attempt = 0;
    const compute = async () => {
      attempt++;
      if (attempt === 1) throw new Error("transient");
      return mockResult;
    };

    await expect(cache.getOrCompute("tool_a", { q: "test" }, compute)).rejects.toThrow("transient");
    const result = await cache.getOrCompute("tool_a", { q: "test" }, compute);
    expect(result).toEqual(mockResult);
    expect(attempt).toBe(2);
  });

  it("clear() resets all state", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let callCount = 0;
    const compute = async () => { callCount++; return mockResult; };

    await cache.getOrCompute("tool_a", { q: "test" }, compute);
    cache.clear();
    await cache.getOrCompute("tool_a", { q: "test" }, compute);

    expect(callCount).toBe(2);
  });

  it("stats() returns hit/miss/entries counts", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    const compute = async () => mockResult;

    await cache.getOrCompute("t", { q: "a" }, compute); // miss
    await cache.getOrCompute("t", { q: "a" }, compute); // hit
    await cache.getOrCompute("t", { q: "b" }, compute); // miss

    const s = cache.stats();
    expect(s.hits).toBe(1);
    expect(s.misses).toBe(2);
    expect(s.entries).toBe(2);
  });

  it("sorts input keys for stable cache keys", async () => {
    const { ResultCache } = await import("../cache");
    const cache = new ResultCache();
    let callCount = 0;
    const compute = async () => { callCount++; return mockResult; };

    await cache.getOrCompute("t", { b: 2, a: 1 }, compute);
    await cache.getOrCompute("t", { a: 1, b: 2 }, compute);

    expect(callCount).toBe(1); // Same cache key despite different key order
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/cache.test.ts`
Expected: FAIL — module `../cache` does not exist

- [ ] **Step 3: Write the cache module**

```typescript
// src/lib/data-sources/cache.ts
/**
 * Per-Pipeline-Run Result Cache
 *
 * Caches tool results keyed by (toolName, inputHash). Uses promise coalescing
 * to prevent redundant API calls when parallel agents request the same data.
 *
 * Scoped to a single pipeline run — call clear() between runs.
 */

import type { ToolResult, CacheEntry } from "./types";

export class ResultCache {
  private store = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<ToolResult>>();
  private hits = 0;
  private misses = 0;

  /**
   * Get a cached result or compute it. If another caller is already computing
   * the same (toolName, input), this awaits the same promise instead of making
   * a duplicate API call.
   */
  async getOrCompute(
    toolName: string,
    input: Record<string, unknown>,
    compute: () => Promise<ToolResult>,
  ): Promise<ToolResult> {
    const key = this.cacheKey(toolName, input);

    // 1. Check completed cache
    const cached = this.store.get(key);
    if (cached) {
      this.hits++;
      return cached.result;
    }

    // 2. Check inflight — another caller already computing this
    const existing = this.inflight.get(key);
    if (existing) {
      this.hits++;
      return existing;
    }

    // 3. Cache miss — compute and share the promise
    this.misses++;
    const promise = compute()
      .then((result) => {
        this.store.set(key, { result, createdAt: Date.now() });
        this.inflight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Clear all entries (call between pipeline runs) */
  clear(): void {
    this.store.clear();
    this.inflight.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Cache stats for observability */
  stats(): { hits: number; misses: number; entries: number } {
    return { hits: this.hits, misses: this.misses, entries: this.store.size };
  }

  private cacheKey(toolName: string, input: Record<string, unknown>): string {
    return `${toolName}::${JSON.stringify(input, Object.keys(input).sort())}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/cache.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/cache.ts src/lib/data-sources/__tests__/cache.test.ts
git commit -m "feat(data-sources): add ResultCache with promise coalescing"
```

---

### Task 4: Markdown formatting helpers

**Files:**
- Create: `src/lib/data-sources/format.ts`
- Test: `src/lib/data-sources/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/format.test.ts
import { describe, it, expect } from "vitest";

describe("format helpers", () => {
  describe("markdownTable", () => {
    it("formats rows into a markdown table", async () => {
      const { markdownTable } = await import("../format");
      const result = markdownTable(
        ["Name", "Value"],
        [["Aspirin", "100mg"], ["Ibuprofen", "200mg"]],
      );
      expect(result).toContain("| Name | Value |");
      expect(result).toContain("|------|-------|");
      expect(result).toContain("| Aspirin | 100mg |");
      expect(result).toContain("| Ibuprofen | 200mg |");
    });

    it("truncates to maxRows and adds note", async () => {
      const { markdownTable } = await import("../format");
      const rows = Array.from({ length: 25 }, (_, i) => [`item${i}`, `${i}`]);
      const result = markdownTable(["Name", "Value"], rows, 5, 25);
      const lines = result.split("\n").filter(Boolean);
      // header + separator + 5 data rows + truncation note = 8 lines
      expect(lines.length).toBe(8);
      expect(result).toContain("Showing 5 of 25");
    });

    it("handles empty rows", async () => {
      const { markdownTable } = await import("../format");
      const result = markdownTable(["Name"], []);
      expect(result).toContain("No results");
    });
  });

  describe("formatCitations", () => {
    it("formats citations into a markdown block", async () => {
      const { formatCitations } = await import("../format");
      const result = formatCitations([
        { id: "[FDA-AE-1]", source: "openFDA FAERS", query: "adalimumab", resultCount: 42 },
      ]);
      expect(result).toContain("### Citations");
      expect(result).toContain("[FDA-AE-1]");
      expect(result).toContain("openFDA FAERS");
      expect(result).toContain("42 results");
    });
  });

  describe("truncateToCharBudget", () => {
    it("returns content unchanged when under budget", async () => {
      const { truncateToCharBudget } = await import("../format");
      const result = truncateToCharBudget("short content", 1000);
      expect(result.content).toBe("short content");
      expect(result.truncated).toBe(false);
    });

    it("truncates and adds note when over budget", async () => {
      const { truncateToCharBudget } = await import("../format");
      const longContent = "x".repeat(5000);
      const result = truncateToCharBudget(longContent, 100);
      expect(result.content.length).toBeLessThanOrEqual(100);
      expect(result.truncated).toBe(true);
    });
  });

  describe("intelligenceHeader", () => {
    it("formats the standard intelligence packet header", async () => {
      const { intelligenceHeader } = await import("../format");
      const result = intelligenceHeader({
        topic: "Drug Safety",
        subject: "Adalimumab",
        confidence: "HIGH",
        sourcesQueried: 3,
        sourcesReturned: 3,
        vintage: "2026-Q1",
      });
      expect(result).toContain("## Drug Safety: Adalimumab");
      expect(result).toContain("**Confidence**: HIGH");
      expect(result).toContain("**Sources**: 3/3");
      expect(result).toContain("**Data through**: 2026-Q1");
    });
  });

  describe("formatNumber", () => {
    it("adds commas to large numbers", async () => {
      const { formatNumber } = await import("../format");
      expect(formatNumber(1234567)).toBe("1,234,567");
    });

    it("handles small numbers without commas", async () => {
      const { formatNumber } = await import("../format");
      expect(formatNumber(42)).toBe("42");
    });

    it("handles zero", async () => {
      const { formatNumber } = await import("../format");
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("formatDate", () => {
    it("converts YYYYMMDD format to YYYY-MM-DD", async () => {
      const { formatDate } = await import("../format");
      expect(formatDate("20250601")).toBe("2025-06-01");
    });

    it("extracts date portion from ISO strings", async () => {
      const { formatDate } = await import("../format");
      expect(formatDate("2025-06-01T12:00:00Z")).toBe("2025-06-01");
    });

    it("returns other formats as-is", async () => {
      const { formatDate } = await import("../format");
      expect(formatDate("June 2025")).toBe("June 2025");
    });
  });

  describe("dig", () => {
    it("extracts nested values by dot path", async () => {
      const { dig } = await import("../format");
      expect(dig({ a: { b: { c: "deep" } } }, "a.b.c")).toBe("deep");
    });

    it("returns fallback for missing paths", async () => {
      const { dig } = await import("../format");
      expect(dig({ a: 1 }, "b.c")).toBe("—");
    });

    it("returns custom fallback when provided", async () => {
      const { dig } = await import("../format");
      expect(dig(null, "a.b", "N/A")).toBe("N/A");
    });

    it("joins arrays with commas", async () => {
      const { dig } = await import("../format");
      expect(dig({ tags: ["a", "b", "c"] }, "tags")).toBe("a, b, c");
    });

    it("converts non-string values to strings", async () => {
      const { dig } = await import("../format");
      expect(dig({ count: 42 }, "count")).toBe("42");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/format.test.ts`
Expected: FAIL — module `../format` does not exist

- [ ] **Step 3: Write the format module**

```typescript
// src/lib/data-sources/format.ts
/**
 * Markdown Formatting Helpers
 *
 * Shared utilities for formatting API data into LLM-optimized markdown.
 * Used by all Layer 2 tools and Layer 3 research tools.
 */

import type { Citation } from "./types";

// ─── Markdown Table ──────────────────────────────────────────

/**
 * Format data rows into a markdown table.
 *
 * @param headers Column header names
 * @param rows Array of row arrays (each row has same length as headers)
 * @param maxRows Maximum rows to display (default: no limit)
 * @param totalCount Total matching results (for truncation note)
 */
export function markdownTable(
  headers: string[],
  rows: string[][],
  maxRows?: number,
  totalCount?: number,
): string {
  if (rows.length === 0) {
    return "No results found.";
  }

  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `|${headers.map(() => "------").join("|")}|`;
  const dataLines = displayRows.map((row) => `| ${row.join(" | ")} |`);

  let result = [headerLine, separatorLine, ...dataLines].join("\n");

  if (maxRows && rows.length > maxRows) {
    const total = totalCount ?? rows.length;
    result += `\n*Showing ${maxRows} of ${total} results. Use more specific filters for complete data.*`;
  }

  return result;
}

// ─── Citation Block ──────────────────────────────────────────

/**
 * Format citations into a standard markdown citation block.
 */
export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) return "";

  const lines = citations.map((c) => {
    const parts = [`${c.id} Source: ${c.source}`, `query: "${c.query}"`];
    if (c.dateRange) parts.push(`date range: ${c.dateRange}`);
    if (c.resultCount !== undefined) parts.push(`${c.resultCount} results`);
    return parts.join(" | ");
  });

  return `### Citations\n${lines.join("\n")}`;
}

// ─── Smart Truncation ────────────────────────────────────────

/**
 * Truncate content to fit within a character budget.
 * Attempts to truncate at section boundaries to preserve readability.
 */
export function truncateToCharBudget(
  content: string,
  budget: number,
): { content: string; truncated: boolean } {
  if (content.length <= budget) {
    return { content, truncated: false };
  }

  // Try to truncate at a section boundary (### or ##)
  const truncationNote = "\n\n*Response truncated. Use granular tools for detailed data.*";
  const targetLength = budget - truncationNote.length;

  if (targetLength <= 0) {
    return { content: content.slice(0, budget), truncated: true };
  }

  // Find the last section boundary before the target length
  const slice = content.slice(0, targetLength);
  const lastSection = Math.max(
    slice.lastIndexOf("\n### "),
    slice.lastIndexOf("\n## "),
    slice.lastIndexOf("\n\n"),
  );

  const cutPoint = lastSection > 0 ? lastSection : targetLength;
  return {
    content: content.slice(0, cutPoint) + truncationNote,
    truncated: true,
  };
}

// ─── Intelligence Packet Header ──────────────────────────────

/**
 * Format the standard header line for Layer 3 intelligence packets.
 */
export function intelligenceHeader(opts: {
  topic: string;
  subject: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sourcesQueried: number;
  sourcesReturned: number;
  vintage: string;
}): string {
  return [
    `## ${opts.topic}: ${opts.subject}`,
    `**Confidence**: ${opts.confidence} | **Sources**: ${opts.sourcesReturned}/${opts.sourcesQueried} returned data | **Data through**: ${opts.vintage}`,
  ].join("\n");
}

// ─── Value Formatting Helpers ────────────────────────────────

/** Format a number with commas (e.g., 1234567 → "1,234,567") */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/** Format a date string to YYYY-MM-DD if possible, otherwise return as-is */
export function formatDate(date: string): string {
  // Handle YYYYMMDD format from FDA APIs
  if (/^\d{8}$/.test(date)) {
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  }
  // Handle ISO dates
  if (date.includes("T")) {
    return date.split("T")[0];
  }
  return date;
}

/** Safely extract a nested value from an object, returning fallback on miss */
export function dig(obj: unknown, path: string, fallback = "—"): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return fallback;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || current === undefined) return fallback;
  if (Array.isArray(current)) return current.join(", ");
  return String(current);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/format.test.ts`
Expected: PASS — all 19 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/format.ts src/lib/data-sources/__tests__/format.test.ts
git commit -m "feat(data-sources): add markdown formatting helpers (tables, citations, truncation)"
```

---

## Chunk 2: ToolRegistry + deploy.ts Integration

The in-process tool registry that replaces MCPManager for Protoprism data sources, plus deploy.ts dual-routing integration.

### Task 5: ToolRegistry class

**Files:**
- Create: `src/lib/data-sources/registry.ts`
- Test: `src/lib/data-sources/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/registry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We can't test full archetype routing without tools registered, but we can
// test the registry mechanics: register, lookup, execute, cache reset.

describe("ToolRegistry", () => {
  beforeEach(() => { vi.resetModules(); });

  it("registers a tool and looks it up by name", async () => {
    const { ToolRegistry } = await import("../registry");
    const registry = new ToolRegistry();

    registry.registerTool({
      name: "test_tool",
      description: "A test tool",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
      handler: async () => ({
        content: "result",
        citations: [],
        vintage: { queriedAt: new Date().toISOString(), source: "test" },
        confidence: "HIGH" as const,
        truncated: false,
      }),
      layer: 2,
      sources: ["test"],
    });

    expect(registry.hasToolName("test_tool")).toBe(true);
    expect(registry.hasToolName("nonexistent")).toBe(false);
  });

  it("rejects tool names containing double-underscore", async () => {
    const { ToolRegistry } = await import("../registry");
    const registry = new ToolRegistry();

    expect(() => registry.registerTool({
      name: "server__tool",
      description: "Bad name",
      inputSchema: {},
      handler: async () => ({
        content: "",
        citations: [],
        vintage: { queriedAt: "", source: "" },
        confidence: "LOW" as const,
        truncated: false,
      }),
      layer: 2,
      sources: [],
    })).toThrow("must not contain '__'");
  });

  it("executeTool returns formatted content string", async () => {
    const { ToolRegistry } = await import("../registry");
    const registry = new ToolRegistry();

    registry.registerTool({
      name: "echo_tool",
      description: "Echoes input",
      inputSchema: { type: "object", properties: { msg: { type: "string" } } },
      handler: async (input) => ({
        content: `Echo: ${input.msg}`,
        citations: [{ id: "[E-1]", source: "Echo", query: String(input.msg) }],
        vintage: { queriedAt: new Date().toISOString(), source: "Echo" },
        confidence: "HIGH" as const,
        truncated: false,
      }),
      layer: 2,
      sources: ["echo"],
    });

    const result = await registry.executeTool("echo_tool", { msg: "hello" });
    expect(result).toContain("Echo: hello");
    expect(result).toContain("[E-1]");
  });

  it("getToolsForArchetype returns Anthropic tool format", async () => {
    const { ToolRegistry } = await import("../registry");
    const registry = new ToolRegistry();

    registry.registerTool({
      name: "search_test",
      description: "Test tool",
      inputSchema: { type: "object", properties: { q: { type: "string" } } },
      handler: async () => ({
        content: "ok",
        citations: [],
        vintage: { queriedAt: "", source: "t" },
        confidence: "HIGH" as const,
        truncated: false,
      }),
      layer: 2,
      sources: ["test"],
    });

    // Use a real archetype that maps to this tool — we'll test with
    // a manually set routing for unit testing purposes
    registry.setArchetypeRouting("RESEARCHER-DATA", {
      research: [],
      granular: ["search_test"],
    });

    const tools = registry.getToolsForArchetype("RESEARCHER-DATA");
    expect(tools.length).toBe(1);
    expect(tools[0]).toHaveProperty("name", "search_test");
    expect(tools[0]).toHaveProperty("description", "Test tool");
    expect(tools[0]).toHaveProperty("input_schema");
  });

  it("resetCache clears cached results", async () => {
    const { ToolRegistry } = await import("../registry");
    const registry = new ToolRegistry();
    let callCount = 0;

    registry.registerTool({
      name: "counter_tool",
      description: "Counts",
      inputSchema: {},
      handler: async (_input, _cache) => {
        callCount++;
        return {
          content: `count: ${callCount}`,
          citations: [],
          vintage: { queriedAt: "", source: "t" },
          confidence: "HIGH" as const,
          truncated: false,
        };
      },
      layer: 2,
      sources: ["test"],
    });

    await registry.executeTool("counter_tool", {});
    await registry.executeTool("counter_tool", {}); // cached
    expect(callCount).toBe(1);

    registry.resetCache();
    await registry.executeTool("counter_tool", {}); // miss after reset
    expect(callCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/registry.test.ts`
Expected: FAIL — module `../registry` does not exist

- [ ] **Step 3: Write the ToolRegistry module**

```typescript
// src/lib/data-sources/registry.ts
/**
 * ToolRegistry — In-Process Data Source Tool Registry
 *
 * Replaces MCPManager for the 15 Protoprism-built data sources.
 * MCPManager continues to handle the 6 Anthropic-provided remote MCP servers.
 *
 * Tool names MUST NOT contain "__" — that delimiter is reserved for
 * MCPManager qualified names (server__tool). This prevents routing collisions.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ArchetypeFamily } from "@/lib/pipeline/types";
import type { DataSourceTool, ToolResult } from "./types";
import { ResultCache } from "./cache";
import { formatCitations } from "./format";

// ─── Archetype Routing ───────────────────────────────────────

interface ArchetypeToolSet {
  research: string[];  // Layer 3 tools (listed first — Claude prefers earlier tools)
  granular: string[];  // Layer 2 tools (precision fallback)
}

// ─── WEB_SEARCH_ARCHETYPES ──────────────────────────────────

/**
 * Archetypes that receive Anthropic's native web_search server tool.
 * Moved here from src/lib/mcp/config.ts since archetype routing now
 * lives in this module. The conditional-inclusion logic stays in deploy.ts.
 */
export const WEB_SEARCH_ARCHETYPES: Set<ArchetypeFamily> = new Set([
  "RESEARCHER-WEB",
  "CRITIC-FACTUAL",
  "ANALYST-STRATEGIC",
  "MACRO-CONTEXT",
  "LEGISLATIVE-PIPELINE",
  "REGULATORY-RADAR",
  "RED-TEAM",
]);

// ─── ToolRegistry ────────────────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, DataSourceTool>();
  private cache: ResultCache;
  private archetypeRouting = new Map<ArchetypeFamily, ArchetypeToolSet>();

  constructor() {
    this.cache = new ResultCache();
  }

  /** Register a single tool. Validates naming convention. */
  registerTool(tool: DataSourceTool): void {
    if (tool.name.includes("__")) {
      throw new Error(
        `Tool name "${tool.name}" must not contain '__'. ` +
        `Double-underscore is reserved for MCPManager qualified names.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  /** Register multiple tools at once. */
  registerTools(tools: DataSourceTool[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /** Set archetype routing (for testing or manual configuration). */
  setArchetypeRouting(archetype: ArchetypeFamily, toolSet: ArchetypeToolSet): void {
    this.archetypeRouting.set(archetype, toolSet);
  }

  /** Load the production archetype routing map. */
  loadDefaultRouting(routing: Record<string, ArchetypeToolSet>): void {
    for (const [archetype, toolSet] of Object.entries(routing)) {
      this.archetypeRouting.set(archetype as ArchetypeFamily, toolSet);
    }
  }

  /** Check if a tool name belongs to this registry. */
  hasToolName(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get Anthropic-format tool definitions for an archetype.
   * Research tools listed first (Claude preferentially selects earlier tools).
   */
  getToolsForArchetype(archetype: ArchetypeFamily): Anthropic.Messages.Tool[] {
    const routing = this.archetypeRouting.get(archetype);
    if (!routing) return [];

    const toolNames = [...routing.research, ...routing.granular];
    const result: Anthropic.Messages.Tool[] = [];

    for (const name of toolNames) {
      const tool = this.tools.get(name);
      if (tool) {
        result.push({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
        });
      }
    }

    return result;
  }

  /**
   * Get tool name strings for an archetype (for prompt-building in construct.ts).
   * Returns research tool names first, then granular tool names.
   */
  getToolNamesForArchetype(archetype: ArchetypeFamily): string[] {
    const routing = this.archetypeRouting.get(archetype);
    if (!routing) return [];
    return [...routing.research, ...routing.granular];
  }

  /** Get gap descriptions for tools that are in routing but not registered. */
  getGapsForArchetype(archetype: ArchetypeFamily): string[] {
    const routing = this.archetypeRouting.get(archetype);
    if (!routing) return [];

    const toolNames = [...routing.research, ...routing.granular];
    const gaps: string[] = [];

    for (const name of toolNames) {
      if (!this.tools.has(name)) {
        gaps.push(`Tool "${name}" is configured for this archetype but not available`);
      }
    }

    return gaps;
  }

  /**
   * Execute a tool by name. Results are cached per pipeline run.
   * Returns the formatted content string (markdown + citations).
   */
  async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool "${name}" in ToolRegistry`);
    }

    const result = await this.cache.getOrCompute(name, input, () =>
      tool.handler(input, this.cache),
    );

    return this.formatResult(result);
  }

  /** Reset cache (call between pipeline runs). */
  resetCache(): void {
    this.cache.clear();
  }

  /** Cache stats for observability. */
  cacheStats(): { hits: number; misses: number; entries: number } {
    return this.cache.stats();
  }

  /** Format a ToolResult into the final string returned to the agent. */
  private formatResult(result: ToolResult): string {
    const parts = [result.content];

    if (result.citations.length > 0) {
      parts.push(formatCitations(result.citations));
    }

    return parts.join("\n\n");
  }
}

// ─── Singleton ───────────────────────────────────────────────

let registryInstance: ToolRegistry | null = null;

/**
 * Get the singleton ToolRegistry instance.
 * Call once at app startup; subsequent calls return the same instance.
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
    // Tools will be registered by tool modules importing this and calling registerTool
    // The production routing will be loaded by the initialization code
  }
  return registryInstance;
}

/** Reset the singleton (for testing). */
export function resetToolRegistry(): void {
  registryInstance = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/registry.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/registry.ts src/lib/data-sources/__tests__/registry.test.ts
git commit -m "feat(data-sources): add ToolRegistry with archetype routing and cache integration"
```

---

### Task 6: McpBridge adapter

**Files:**
- Create: `src/lib/data-sources/mcp-bridge.ts`
- Test: `src/lib/data-sources/__tests__/mcp-bridge.test.ts`
- Modify: `src/lib/mcp/client.ts` — add `isServerAvailable()` method

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/mcp-bridge.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the MCP client module
vi.mock("@/lib/mcp/client", () => ({
  getMCPManager: vi.fn(() => ({
    isServerAvailable: vi.fn((name: string) => name === "pubmed"),
    executeTool: vi.fn(async (qualifiedName: string) => {
      if (qualifiedName === "pubmed__search_articles") {
        return JSON.stringify({ results: [{ title: "Test Article" }] });
      }
      throw new Error("Tool not found");
    }),
  })),
}));

describe("McpBridge", () => {
  beforeEach(() => { vi.resetModules(); });

  it("calls MCP server tool when server is available", async () => {
    const { McpBridge } = await import("../mcp-bridge");
    const bridge = new McpBridge();
    const result = await bridge.call("pubmed", "search_articles", { query: "test" });

    expect(result.available).toBe(true);
    expect(result.server).toBe("pubmed");
    expect(result.data).toContain("Test Article");
  });

  it("returns unavailable when server is not connected", async () => {
    const { McpBridge } = await import("../mcp-bridge");
    const bridge = new McpBridge();
    const result = await bridge.call("clinical_trials", "search_trials", { condition: "cancer" });

    expect(result.available).toBe(false);
    expect(result.error).toBe("MCP server not connected");
  });

  it("reports available servers", async () => {
    const { McpBridge } = await import("../mcp-bridge");
    const bridge = new McpBridge();
    const available = bridge.availableServers();

    expect(available).toContain("pubmed");
    expect(available).not.toContain("clinical_trials");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/mcp-bridge.test.ts`
Expected: FAIL — module `../mcp-bridge` does not exist

- [ ] **Step 3: Add `isServerAvailable()` to MCPManager**

In `src/lib/mcp/client.ts`, add this method to the `MCPManager` class (after `getGapsForArchetype`):

```typescript
  /** Check if a specific MCP server is connected and available. */
  isServerAvailable(serverName: string): boolean {
    return this.servers.has(serverName) && !this.unavailableServers.includes(serverName);
  }
```

- [ ] **Step 4: Write the McpBridge module**

```typescript
// src/lib/data-sources/mcp-bridge.ts
/**
 * MCP Bridge — Adapter for Layer 3 → Anthropic MCP Server Calls
 *
 * Thin adapter that lets Layer 3 research tools call Anthropic MCP
 * server tools programmatically. Translates between MCPManager's
 * qualified-name API and a typed function call interface.
 *
 * Hardcodes the 6 Anthropic server names that Layer 3 needs.
 * If an MCP server is unavailable, returns { available: false }
 * so the research tool can degrade gracefully.
 */

import { getMCPManager } from "@/lib/mcp/client";
import type { AnthropicMcpServer, McpBridgeResult } from "./types";

const ANTHROPIC_SERVERS: AnthropicMcpServer[] = [
  "pubmed",
  "clinical_trials",
  "biorxiv",
  "cms_coverage",
  "icd10",
  "npi_registry",
];

export class McpBridge {
  /** Execute a tool on an Anthropic MCP server. */
  async call(
    server: AnthropicMcpServer,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<McpBridgeResult> {
    const mcpManager = getMCPManager();
    const qualifiedName = `${server}__${toolName}`;

    if (!mcpManager.isServerAvailable(server)) {
      return { available: false, server, toolName, error: "MCP server not connected" };
    }

    try {
      const rawResult = await mcpManager.executeTool(qualifiedName, input);
      return { available: true, server, toolName, data: rawResult };
    } catch (err) {
      return { available: false, server, toolName, error: String(err) };
    }
  }

  /** Check which Anthropic MCP servers are currently connected. */
  availableServers(): string[] {
    const mcpManager = getMCPManager();
    return ANTHROPIC_SERVERS.filter((s) => mcpManager.isServerAvailable(s));
  }
}

/** Singleton bridge instance */
export const mcpBridge = new McpBridge();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/mcp-bridge.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 6: Commit**

```bash
git add src/lib/data-sources/mcp-bridge.ts src/lib/data-sources/__tests__/mcp-bridge.test.ts src/lib/mcp/client.ts
git commit -m "feat(data-sources): add McpBridge adapter for Layer 3 → Anthropic MCP calls"
```

---

### Task 7: deploy.ts dual routing integration

**Files:**
- Modify: `src/lib/pipeline/deploy.ts`

This task modifies `deploy.ts` to build tools from both ToolRegistry (in-process) and MCPManager (remote MCP), and routes tool calls to the correct handler based on the name format.

- [ ] **Step 1: Update imports in deploy.ts**

At the top of `src/lib/pipeline/deploy.ts`, replace:

```typescript
import { WEB_SEARCH_ARCHETYPES } from "@/lib/mcp/config";
```

with:

```typescript
import { getToolRegistry, WEB_SEARCH_ARCHETYPES } from "@/lib/data-sources/registry";
import type { ToolRegistry } from "@/lib/data-sources/registry";
```

- [ ] **Step 2: Update the `deploy()` function to initialize ToolRegistry**

In the `deploy()` function body (after `await mcpManager.initialize()`), add:

```typescript
  const toolRegistry = getToolRegistry();
```

Then pass `toolRegistry` to `executeAgent()`, `executeParallel()`, and `executeTwoWaves()` calls.

Update the function signatures:
- `executeAgent(agent, emitEvent, mcpManager)` → `executeAgent(agent, emitEvent, mcpManager, toolRegistry)`
- `executeParallel(agents, emitEvent, mcpManager, memoryBus)` → `executeParallel(agents, emitEvent, mcpManager, toolRegistry, memoryBus)`
- `executeTwoWaves(agents, blueprint, emitEvent, mcpManager, externalBus)` → `executeTwoWaves(agents, blueprint, emitEvent, mcpManager, toolRegistry, externalBus)`

- [ ] **Step 3: Update tool building in `executeAgent()`**

Find the section in `executeAgent()` that builds the `tools` array for the Claude API call. It starts with `const archetypeFamily =` and includes `mcpManager.getToolsForArchetype()` and the `submitFindingsTool` definition. Replace that entire tool-building block with:

```typescript
  // ─── Build tools array ────────────────────────────────────

  const archetypeFamily = agent.archetype as ArchetypeFamily;

  // In-process data source tools (Layer 2 + Layer 3)
  const dataSourceTools = toolRegistry.getToolsForArchetype(archetypeFamily);

  // Remote MCP tools (Anthropic servers: PubMed, ClinicalTrials, etc.)
  const mcpTools = mcpManager.getToolsForArchetype(archetypeFamily);

  // Track which tool names are MCP tools for routing
  const mcpToolNames = new Set<string>();
  for (const tool of mcpTools) {
    if ("name" in tool && tool.type !== "web_search_20250305") {
      mcpToolNames.add(tool.name);
    }
  }

  // Add submit_findings tool for structured output
  const submitFindingsTool: Anthropic.Messages.Tool = {
    name: "submit_findings",
    description:
      "Submit your complete structured analysis. You MUST call this tool when your research is complete. " +
      "Include all findings, gaps, signals, minority views, and tools used.",
    input_schema:
      getAgentResultJsonSchema() as Anthropic.Messages.Tool.InputSchema,
  };

  // Data source tools listed first (research before granular),
  // then MCP tools, then submit_findings
  const allTools: Anthropic.Messages.ToolUnion[] = [
    ...dataSourceTools,
    ...mcpTools,
    submitFindingsTool,
  ];
```

- [ ] **Step 4: Update tool execution routing in `executeAgent()`**

Find the tool execution routing in `executeAgent()`'s message loop — the section inside the `for (const toolBlock of toolUseBlocks)` loop that handles `web_search`, MCP tool calls, and unknown tools. Replace the entire routing logic (from the `web_search` check through the final `else { toolResultContents.push(... "Unknown tool" ...) }`) with:

```typescript
        // web_search is handled server-side by Anthropic
        if (toolName === "web_search") {
          continue;
        }

        // Route 1: In-process data source tool (no __ in name)
        if (toolRegistry.hasToolName(toolName)) {
          emitEvent({
            type: "tool_call",
            agentName: agent.name,
            toolName,
            serverName: "data-sources",
          });

          if (!toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
          }

          try {
            const toolResult = await toolRegistry.executeTool(toolName, toolInput);
            toolResultContents.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: toolResult.slice(0, 10000),
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toolResultContents.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: `Tool error: ${errMsg}`,
              is_error: true,
            });
          }
        }
        // Route 2: Remote MCP tool (has __ in name)
        else if (mcpToolNames.has(toolName)) {
          emitEvent({
            type: "tool_call",
            agentName: agent.name,
            toolName,
            serverName: toolName.split("__")[0] ?? "unknown",
          });

          if (!toolsUsed.includes(toolName)) {
            toolsUsed.push(toolName);
          }

          try {
            const toolResult = await mcpManager.executeTool(toolName, toolInput);
            toolResultContents.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: toolResult.slice(0, 10000),
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toolResultContents.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: `Tool error: ${errMsg}`,
              is_error: true,
            });
          }
        }
        // Unknown tool
        else {
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: `Unknown tool "${toolName}".`,
            is_error: true,
          });
        }
```

- [ ] **Step 5: Update `executeParallel()` and `executeTwoWaves()` function bodies**

Both `executeParallel()` and `executeTwoWaves()` call `executeAgent()` internally. After updating their signatures to accept `toolRegistry`:
- In `executeParallel()`: find the `executeAgent()` call and add `toolRegistry` as the fourth argument
- In `executeTwoWaves()`: find both `executeAgent()` calls (wave 1 and wave 2) and add `toolRegistry` as the fourth argument

Also find the calls to `executeParallel()` and `executeTwoWaves()` inside `deploy()` and add `toolRegistry` as an argument matching the updated signatures.

- [ ] **Step 6: Update `mcpGaps` to include ToolRegistry gaps**

After the existing `mcpGaps` line, add:

```typescript
  const dataSourceGaps = toolRegistry.getGapsForArchetype(archetypeFamily);
  const allGaps = [...dataSourceGaps, ...mcpGaps];
```

Then use `allGaps` instead of `mcpGaps` throughout the function.

- [ ] **Step 7: Verify TypeScript compiles and existing tests pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/pipeline/`
Expected: No TypeScript errors. Any existing pipeline tests continue to pass. If there are integration tests that exercise `executeAgent()` with mock tools, verify they still route correctly.

> **Note:** Full integration testing of the dual routing (ToolRegistry + MCPManager) is covered in Task 17's final verification. At this step, ensure compilation and existing test compatibility.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pipeline/deploy.ts
git commit -m "feat(deploy): integrate ToolRegistry dual routing (in-process + MCP)"
```

---

## Chunk 3: Vertical Slice — openFDA

Complete implementation of one data source across all three layers as a template for the remaining 14. This proves the architecture end-to-end.

### Task 8: openFDA Layer 1 API client

**Files:**
- Create: `src/lib/data-sources/clients/openfda.ts`
- Test: `src/lib/data-sources/__tests__/clients/openfda.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/clients/openfda.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock the rate limiters to avoid real timing
vi.mock("../../rate-limit", () => ({
  globalRateLimiter: { acquire: vi.fn(async () => {}), release: vi.fn() },
  TokenBucketLimiter: vi.fn().mockImplementation(() => ({
    acquire: vi.fn(async () => {}),
  })),
}));

describe("openFDA API Client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("searchAdverseEvents returns typed ApiResponse", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { results: { total: 1, skip: 0, limit: 10 }, last_updated: "2026-01-01" },
        results: [{ safetyreportid: "123", serious: 1 }],
      }),
    });

    const { openfdaClient } = await import("../../clients/openfda");
    const response = await openfdaClient.searchAdverseEvents({
      drugName: "adalimumab",
      limit: 10,
    });

    expect(response.status).toBe(200);
    expect(response.data.results).toHaveLength(1);
    expect(response.data.results[0]).toHaveProperty("safetyreportid", "123");
    expect(response.vintage.source).toContain("openFDA");
  });

  it("searchDrugLabels builds correct URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { results: { total: 0, skip: 0, limit: 10 } },
        results: [],
      }),
    });

    const { openfdaClient } = await import("../../clients/openfda");
    await openfdaClient.searchDrugLabels({ brandName: "Humira" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.fda.gov/drug/label.json");
    expect(calledUrl).toContain("openfda.brand_name");
    expect(calledUrl).toContain("Humira");
  });

  it("returns empty results on 404 (no matches)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "NOT_FOUND", message: "No matches" } }),
    });

    const { openfdaClient } = await import("../../clients/openfda");
    const response = await openfdaClient.searchAdverseEvents({ drugName: "zzz_nonexistent" });

    expect(response.data.results).toEqual([]);
    expect(response.data.total).toBe(0);
  });

  it("throws on 429 rate limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });

    const { openfdaClient } = await import("../../clients/openfda");
    await expect(
      openfdaClient.searchAdverseEvents({ drugName: "test" }),
    ).rejects.toThrow("rate limit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/clients/openfda.test.ts`
Expected: FAIL — module `../../clients/openfda` does not exist

- [ ] **Step 3: Write the openFDA API client**

```typescript
// src/lib/data-sources/clients/openfda.ts
/**
 * openFDA API Client (Layer 1)
 *
 * Internal HTTP client for the openFDA public API. Handles query construction,
 * rate limiting, pagination, and error handling. Not exposed to agents.
 *
 * Ported from mcp-servers/openfda-mcp-server/src/api-client.ts with these changes:
 * - Uses native fetch instead of axios
 * - Uses shared GlobalRateLimiter + TokenBucketLimiter
 * - Returns typed ApiResponse<T> with DataVintage instead of raw FormattedResult
 * - No JSON.stringify — downstream tools handle formatting
 */

import type { ApiResponse, DataVintage } from "../types";
import { globalRateLimiter, TokenBucketLimiter } from "../rate-limit";

// ─── Constants ───────────────────────────────────────────────

const BASE_URL = "https://api.fda.gov";

const ENDPOINTS = {
  DRUG_LABEL: "/drug/label.json",
  DRUG_EVENT: "/drug/event.json",
  DRUG_ENFORCEMENT: "/drug/enforcement.json",
  DEVICE_510K: "/device/510k.json",
  DEVICE_EVENT: "/device/event.json",
} as const;

// 4 req/s without API key (240/min with key)
const clientLimiter = new TokenBucketLimiter(4);

// ─── Types ───────────────────────────────────────────────────

interface OpenFDAResponse {
  meta?: {
    last_updated?: string;
    results?: { skip: number; limit: number; total: number };
  };
  results?: unknown[];
  error?: { code: string; message: string };
}

export interface OpenFDAResult {
  results: Record<string, unknown>[];
  total: number;
  hasMore: boolean;
}

// ─── Query Helpers ───────────────────────────────────────────

function quoteValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSearchQuery(clauses: string[]): string | undefined {
  const nonEmpty = clauses.filter((c) => c.length > 0);
  return nonEmpty.length === 0 ? undefined : nonEmpty.join("+AND+");
}

function buildDateRange(field: string, from?: string, to?: string): string {
  if (!from && !to) return "";
  return `${field}:[${from ?? "*"}+TO+${to ?? "*"}]`;
}

// ─── Core Request ────────────────────────────────────────────

async function makeRequest(
  endpoint: string,
  params: {
    search?: string;
    limit?: number;
    skip?: number;
    count?: string;
  } = {},
): Promise<ApiResponse<OpenFDAResult>> {
  await globalRateLimiter.acquire();
  try {
    await clientLimiter.acquire();

    // Build URL manually — openFDA uses literal '+' in search syntax
    const queryParts: string[] = [];
    const apiKey = process.env.OPENFDA_API_KEY;
    if (apiKey) queryParts.push(`api_key=${encodeURIComponent(apiKey)}`);
    if (params.search) queryParts.push(`search=${params.search}`);
    if (params.count) {
      queryParts.push(`count=${encodeURIComponent(params.count)}`);
    }
    if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
    if (params.skip !== undefined && params.skip > 0) queryParts.push(`skip=${params.skip}`);

    const url = queryParts.length > 0
      ? `${BASE_URL}${endpoint}?${queryParts.join("&")}`
      : `${BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Protoprism/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404) {
      return {
        data: { results: [], total: 0, hasMore: false },
        status: 404,
        vintage: makeVintage(),
      };
    }

    if (response.status === 429) {
      throw new Error("openFDA rate limit exceeded. Try again shortly.");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as OpenFDAResponse;
      throw new Error(
        `openFDA API error (HTTP ${response.status}): ${body.error?.message ?? "Unknown error"}`,
      );
    }

    const data = (await response.json()) as OpenFDAResponse;
    if (data.error) {
      throw new Error(`openFDA API error: ${data.error.message}`);
    }

    const results = (data.results ?? []) as Record<string, unknown>[];
    const meta = data.meta?.results;
    const total = meta?.total ?? results.length;
    const skip = meta?.skip ?? params.skip ?? 0;

    return {
      data: {
        results,
        total,
        hasMore: skip + results.length < total,
      },
      status: response.status,
      vintage: makeVintage(data.meta?.last_updated),
    };
  } finally {
    globalRateLimiter.release();
  }
}

function makeVintage(lastUpdated?: string): DataVintage {
  return {
    queriedAt: new Date().toISOString(),
    dataThrough: lastUpdated,
    source: "openFDA FAERS",
  };
}

// ─── Public API ──────────────────────────────────────────────

export const openfdaClient = {
  async searchAdverseEvents(params: {
    drugName?: string;
    reaction?: string;
    serious?: boolean;
    dateFrom?: string;
    dateTo?: string;
    query?: string;
    limit?: number;
    skip?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.drugName) {
      const q = quoteValue(params.drugName);
      clauses.push(`(patient.drug.openfda.brand_name:${q}+OR+patient.drug.openfda.generic_name:${q})`);
    }
    if (params.reaction) clauses.push(`patient.reaction.reactionmeddrapt:${quoteValue(params.reaction)}`);
    if (params.serious !== undefined) clauses.push(`serious:${params.serious ? "1" : "2"}`);
    const dateClause = buildDateRange("receivedate", params.dateFrom, params.dateTo);
    if (dateClause) clauses.push(dateClause);

    return makeRequest(ENDPOINTS.DRUG_EVENT, {
      search: buildSearchQuery(clauses),
      limit: params.limit ?? 10,
      skip: params.skip,
    });
  },

  async countAdverseEvents(params: {
    field: string;
    drugName?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.drugName) {
      const q = quoteValue(params.drugName);
      clauses.push(`(patient.drug.openfda.brand_name:${q}+OR+patient.drug.openfda.generic_name:${q})`);
    }
    const dateClause = buildDateRange("receivedate", params.dateFrom, params.dateTo);
    if (dateClause) clauses.push(dateClause);

    return makeRequest(ENDPOINTS.DRUG_EVENT, {
      search: buildSearchQuery(clauses),
      count: params.field,
      limit: params.limit ?? 10,
    });
  },

  async searchDrugLabels(params: {
    query?: string;
    brandName?: string;
    genericName?: string;
    manufacturer?: string;
    limit?: number;
    skip?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.brandName) clauses.push(`openfda.brand_name:${quoteValue(params.brandName)}`);
    if (params.genericName) clauses.push(`openfda.generic_name:${quoteValue(params.genericName)}`);
    if (params.manufacturer) clauses.push(`openfda.manufacturer_name:${quoteValue(params.manufacturer)}`);

    return makeRequest(ENDPOINTS.DRUG_LABEL, {
      search: buildSearchQuery(clauses),
      limit: params.limit ?? 10,
      skip: params.skip,
    });
  },

  async searchRecalls(params: {
    query?: string;
    classification?: string;
    status?: string;
    reason?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.classification) clauses.push(`classification:${quoteValue(params.classification)}`);
    if (params.status) clauses.push(`status:${quoteValue(params.status)}`);
    if (params.reason) clauses.push(`reason_for_recall:${quoteValue(params.reason)}`);
    const dateClause = buildDateRange("report_date", params.dateFrom, params.dateTo);
    if (dateClause) clauses.push(dateClause);

    return makeRequest(ENDPOINTS.DRUG_ENFORCEMENT, {
      search: buildSearchQuery(clauses),
      limit: params.limit ?? 10,
      skip: params.skip,
    });
  },

  async search510k(params: {
    query?: string;
    applicant?: string;
    deviceName?: string;
    decision?: string;
    productCode?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.applicant) clauses.push(`applicant:${quoteValue(params.applicant)}`);
    if (params.deviceName) clauses.push(`device_name:${quoteValue(params.deviceName)}`);
    if (params.decision) clauses.push(`decision_code:${quoteValue(params.decision)}`);
    if (params.productCode) clauses.push(`product_code:${quoteValue(params.productCode)}`);
    const dateClause = buildDateRange("decision_date", params.dateFrom, params.dateTo);
    if (dateClause) clauses.push(dateClause);

    return makeRequest(ENDPOINTS.DEVICE_510K, {
      search: buildSearchQuery(clauses),
      limit: params.limit ?? 10,
      skip: params.skip,
    });
  },

  async searchDeviceEvents(params: {
    query?: string;
    deviceName?: string;
    manufacturer?: string;
    eventType?: string;
    productCode?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
  }): Promise<ApiResponse<OpenFDAResult>> {
    const clauses: string[] = [];
    if (params.query) clauses.push(params.query);
    if (params.deviceName) clauses.push(`device.generic_name:${quoteValue(params.deviceName)}`);
    if (params.manufacturer) clauses.push(`device.manufacturer_d_name:${quoteValue(params.manufacturer)}`);
    if (params.eventType) clauses.push(`event_type:${quoteValue(params.eventType)}`);
    if (params.productCode) clauses.push(`device.device_report_product_code:${quoteValue(params.productCode)}`);
    const dateClause = buildDateRange("date_received", params.dateFrom, params.dateTo);
    if (dateClause) clauses.push(dateClause);

    return makeRequest(ENDPOINTS.DEVICE_EVENT, {
      search: buildSearchQuery(clauses),
      limit: params.limit ?? 10,
      skip: params.skip,
    });
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/clients/openfda.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/clients/openfda.ts src/lib/data-sources/__tests__/clients/openfda.test.ts
git commit -m "feat(data-sources): add openFDA Layer 1 API client"
```

---

### Task 9: openFDA Layer 2 granular tools

**Files:**
- Create: `src/lib/data-sources/tools/openfda.tools.ts`
- Test: `src/lib/data-sources/__tests__/tools/openfda.tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/tools/openfda.tools.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultCache } from "../../cache";

// Mock the openFDA client
vi.mock("../../clients/openfda", () => ({
  openfdaClient: {
    searchAdverseEvents: vi.fn(async () => ({
      data: {
        results: [
          {
            safetyreportid: "10001",
            serious: 1,
            seriousnessdeath: 0,
            seriousnesshospitalization: 1,
            receivedate: "20250601",
            patient: {
              reaction: [{ reactionmeddrapt: "Nausea" }, { reactionmeddrapt: "Headache" }],
              drug: [{ openfda: { brand_name: ["Humira"], generic_name: ["adalimumab"] } }],
            },
          },
        ],
        total: 1,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", dataThrough: "2025-Q4", source: "openFDA FAERS" },
    })),
    searchDrugLabels: vi.fn(async () => ({
      data: {
        results: [
          {
            openfda: { brand_name: ["Humira"], generic_name: ["adalimumab"], manufacturer_name: ["AbbVie"] },
            indications_and_usage: ["Treatment of rheumatoid arthritis"],
            warnings: ["Risk of infections"],
          },
        ],
        total: 1,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA Drug Labels" },
    })),
    countAdverseEvents: vi.fn(async () => ({
      data: {
        results: [{ term: "NAUSEA", count: 150 }, { term: "HEADACHE", count: 120 }],
        total: 2,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA FAERS" },
    })),
    searchRecalls: vi.fn(async () => ({
      data: {
        results: [{ report_date: "20250615", classification: "Class II", product_description: "Contaminated tablets", reason_for_recall: "cGMP deviations", status: "Ongoing" }],
        total: 1,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA Enforcement" },
    })),
    search510k: vi.fn(async () => ({
      data: {
        results: [{ k_number: "K241234", device_name: "Coronary Stent", applicant: "MedDevice Inc", decision_code: "SESE", decision_date: "20250501" }],
        total: 1,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA 510(k)" },
    })),
    searchDeviceEvents: vi.fn(async () => ({
      data: {
        results: [{ mdr_report_key: "9876543", device: [{ generic_name: "Infusion Pump", manufacturer_d_name: "PumpCo" }], event_type: "Malfunction", date_received: "20250801" }],
        total: 1,
        hasMore: false,
      },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA MAUDE" },
    })),
  },
}));

describe("openFDA granular tools", () => {
  let cache: ResultCache;

  beforeEach(() => {
    cache = new ResultCache();
    vi.clearAllMocks();
  });

  it("search_adverse_events returns markdown table, not JSON", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "search_adverse_events");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ drug_name: "adalimumab" }, cache);
    expect(result.content).toContain("##"); // Has markdown headers
    expect(result.content).toContain("Nausea"); // Contains reaction data
    expect(result.content).not.toContain('"safetyreportid"'); // No raw JSON
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].source).toContain("openFDA");
    expect(result.confidence).toBe("HIGH");
  });

  it("search_drug_labels returns markdown output", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "search_drug_labels");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ brand_name: "Humira" }, cache);
    expect(result.content).toContain("Humira");
    expect(result.content).toContain("rheumatoid arthritis");
    expect(result.confidence).toBe("HIGH");
  });

  it("count_adverse_events returns term/count table", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "count_adverse_events");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ field: "patient.reaction.reactionmeddrapt", drug_name: "adalimumab" }, cache);
    expect(result.content).toContain("##"); // Has markdown header
    expect(result.citations).toHaveLength(1);
  });

  it("search_drug_recalls returns recall table", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "search_drug_recalls");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ query: "contamination" }, cache);
    expect(result.content).toContain("Recalls");
    expect(result.citations).toHaveLength(1);
  });

  it("search_510k returns clearance table", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "search_510k");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ device_name: "stent" }, cache);
    expect(result.content).toContain("510(k)");
    expect(result.citations).toHaveLength(1);
  });

  it("search_device_events returns device event table", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    const tool = openfdaTools.find((t) => t.name === "search_device_events");
    expect(tool).toBeDefined();

    const result = await tool!.handler({ device_name: "pump" }, cache);
    expect(result.content).toContain("Device Event");
    expect(result.citations).toHaveLength(1);
  });

  it("all tools have layer=2 and no __ in name", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    for (const tool of openfdaTools) {
      expect(tool.layer).toBe(2);
      expect(tool.name).not.toContain("__");
      expect(tool.sources).toContain("openfda");
    }
  });

  it("exports at least 5 tools", async () => {
    const { openfdaTools } = await import("../../tools/openfda.tools");
    expect(openfdaTools.length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/tools/openfda.tools.test.ts`
Expected: FAIL — module `../../tools/openfda.tools` does not exist

- [ ] **Step 3: Write the openFDA granular tools module**

```typescript
// src/lib/data-sources/tools/openfda.tools.ts
/**
 * openFDA Layer 2 Granular Tools
 *
 * 6 tools that wrap openFDA Layer 1 API client calls and return
 * markdown-formatted ToolResult responses. Agents see these tools
 * directly and get human-readable tables + citations — no raw JSON.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { openfdaClient } from "../clients/openfda";
import {
  markdownTable,
  formatCitations,
  formatNumber,
  formatDate,
  dig,
  MAX_TABLE_ROWS_LAYER_2,
} from "../format";

// ─── search_adverse_events ───────────────────────────────────

const searchAdverseEvents: DataSourceTool = {
  name: "search_adverse_events",
  description:
    "Search FDA adverse event reports (FAERS) by drug name, reaction, seriousness, or date range. " +
    "Returns markdown table of matching reports with reactions and outcomes.",
  inputSchema: {
    type: "object",
    properties: {
      drug_name: { type: "string", description: "Drug brand or generic name" },
      reaction: { type: "string", description: "Adverse reaction term (MedDRA preferred term)" },
      serious: { type: "boolean", description: "Filter to serious events only" },
      date_from: { type: "string", description: "Start date (YYYYMMDD)" },
      date_to: { type: "string", description: "End date (YYYYMMDD)" },
      limit: { type: "number", description: "Max results (default 10, max 100)" },
    },
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.searchAdverseEvents({
      drugName: input.drug_name as string | undefined,
      reaction: input.reaction as string | undefined,
      serious: input.serious as boolean | undefined,
      dateFrom: input.date_from as string | undefined,
      dateTo: input.date_to as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Report ID", "Drug", "Reactions", "Serious", "Date"];
    const rows = response.data.results.map((r) => [
      dig(r, "safetyreportid"),
      dig(r, "patient.drug.0.openfda.brand_name.0", dig(r, "patient.drug.0.openfda.generic_name.0", "Unknown")),
      ((dig(r, "patient.reaction") === "—") ? "—" :
        (r.patient as Record<string, unknown>)?.reaction
          ? ((r.patient as Record<string, unknown>).reaction as Array<Record<string, string>>)
              .map((rx) => rx.reactionmeddrapt).slice(0, 3).join(", ")
          : "—"),
      (r as Record<string, unknown>).serious === 1 ? "Yes" : "No",
      formatDate(dig(r, "receivedate")),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.drug_name as string) ?? (input.reaction as string) ?? "all";

    const citation = {
      id: `[FDA-AE-${Date.now()}]`,
      source: "openFDA FAERS",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Adverse Events: ${queryDesc}\n\n**${formatNumber(response.data.total)} reports found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── count_adverse_events ────────────────────────────────────

const countAdverseEvents: DataSourceTool = {
  name: "count_adverse_events",
  description:
    "Count adverse events by a specific field (e.g., patient.reaction.reactionmeddrapt). " +
    "Returns top values and their counts. Useful for identifying most common reactions.",
  inputSchema: {
    type: "object",
    properties: {
      field: { type: "string", description: "Field to count by (e.g., 'patient.reaction.reactionmeddrapt')" },
      drug_name: { type: "string", description: "Drug brand or generic name to filter by" },
      date_from: { type: "string", description: "Start date (YYYYMMDD)" },
      date_to: { type: "string", description: "End date (YYYYMMDD)" },
      limit: { type: "number", description: "Number of top values to return (default 10)" },
    },
    required: ["field"],
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.countAdverseEvents({
      field: input.field as string,
      drugName: input.drug_name as string | undefined,
      dateFrom: input.date_from as string | undefined,
      dateTo: input.date_to as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Value", "Count"];
    const rows = response.data.results.map((r) => [
      String((r as Record<string, unknown>).term ?? "Unknown"),
      formatNumber((r as Record<string, unknown>).count as number ?? 0),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const queryDesc = (input.drug_name as string) ?? "all drugs";

    const citation = {
      id: `[FDA-AE-COUNT-${Date.now()}]`,
      source: "openFDA FAERS",
      query: `${input.field as string} for ${queryDesc}`,
      resultCount: response.data.total,
    };

    return {
      content: `## AE Counts by ${input.field as string}: ${queryDesc}\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: false,
    };
  },
};

// ─── search_drug_labels ──────────────────────────────────────

const searchDrugLabels: DataSourceTool = {
  name: "search_drug_labels",
  description:
    "Search FDA drug labeling (SPL) by brand name, generic name, or manufacturer. " +
    "Returns indications, warnings, and contraindications in markdown.",
  inputSchema: {
    type: "object",
    properties: {
      brand_name: { type: "string", description: "Brand name (e.g., Humira)" },
      generic_name: { type: "string", description: "Generic name (e.g., adalimumab)" },
      manufacturer: { type: "string", description: "Manufacturer name" },
      query: { type: "string", description: "Free-text search across all label sections" },
      limit: { type: "number", description: "Max results (default 5)" },
    },
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.searchDrugLabels({
      brandName: input.brand_name as string | undefined,
      genericName: input.generic_name as string | undefined,
      manufacturer: input.manufacturer as string | undefined,
      query: input.query as string | undefined,
      limit: (input.limit as number | undefined) ?? 5,
    });

    const sections: string[] = [];
    for (const label of response.data.results) {
      const name = dig(label, "openfda.brand_name.0", dig(label, "openfda.generic_name.0", "Unknown"));
      const mfr = dig(label, "openfda.manufacturer_name.0");
      sections.push(`### ${name} (${mfr})`);

      const indications = dig(label, "indications_and_usage.0");
      if (indications !== "—") sections.push(`**Indications:** ${indications.slice(0, 500)}`);

      const warnings = dig(label, "warnings.0", dig(label, "boxed_warning.0"));
      if (warnings !== "—") sections.push(`**Warnings:** ${warnings.slice(0, 500)}`);

      const contraindications = dig(label, "contraindications.0");
      if (contraindications !== "—") sections.push(`**Contraindications:** ${contraindications.slice(0, 300)}`);
    }

    const queryDesc = (input.brand_name ?? input.generic_name ?? input.query ?? "all") as string;
    const citation = {
      id: `[FDA-LABEL-${Date.now()}]`,
      source: "openFDA Drug Labels",
      query: queryDesc,
      resultCount: response.data.total,
    };

    return {
      content: `## Drug Labels: ${queryDesc}\n\n${sections.join("\n\n")}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: false,
    };
  },
};

// ─── search_drug_recalls ─────────────────────────────────────

const searchDrugRecalls: DataSourceTool = {
  name: "search_drug_recalls",
  description:
    "Search FDA drug enforcement/recall data. Returns recall classification, reason, and status.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search" },
      classification: { type: "string", description: "Recall class: 'Class I', 'Class II', or 'Class III'" },
      status: { type: "string", description: "Recall status (e.g., 'Ongoing', 'Terminated')" },
      date_from: { type: "string", description: "Start date (YYYYMMDD)" },
      date_to: { type: "string", description: "End date (YYYYMMDD)" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.searchRecalls({
      query: input.query as string | undefined,
      classification: input.classification as string | undefined,
      status: input.status as string | undefined,
      dateFrom: input.date_from as string | undefined,
      dateTo: input.date_to as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Date", "Classification", "Product", "Reason", "Status"];
    const rows = response.data.results.map((r) => [
      formatDate(dig(r, "report_date")),
      dig(r, "classification"),
      dig(r, "product_description").slice(0, 80),
      dig(r, "reason_for_recall").slice(0, 80),
      dig(r, "status"),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const citation = {
      id: `[FDA-RECALL-${Date.now()}]`,
      source: "openFDA Enforcement",
      query: (input.query as string) ?? "all",
      resultCount: response.data.total,
    };

    return {
      content: `## Drug Recalls\n\n**${formatNumber(response.data.total)} recalls found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_510k ─────────────────────────────────────────────

const search510k: DataSourceTool = {
  name: "search_510k",
  description:
    "Search FDA 510(k) premarket device clearance data. Returns device clearance decisions, applicants, and product codes.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search" },
      applicant: { type: "string", description: "Applicant/company name" },
      device_name: { type: "string", description: "Device name" },
      product_code: { type: "string", description: "FDA product code" },
      date_from: { type: "string", description: "Start date (YYYYMMDD)" },
      date_to: { type: "string", description: "End date (YYYYMMDD)" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.search510k({
      query: input.query as string | undefined,
      applicant: input.applicant as string | undefined,
      deviceName: input.device_name as string | undefined,
      productCode: input.product_code as string | undefined,
      dateFrom: input.date_from as string | undefined,
      dateTo: input.date_to as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["510(k) #", "Device", "Applicant", "Decision", "Date"];
    const rows = response.data.results.map((r) => [
      dig(r, "k_number"),
      dig(r, "device_name").slice(0, 60),
      dig(r, "applicant").slice(0, 40),
      dig(r, "decision_code"),
      formatDate(dig(r, "decision_date")),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const citation = {
      id: `[FDA-510K-${Date.now()}]`,
      source: "openFDA 510(k)",
      query: (input.device_name ?? input.applicant ?? input.query ?? "all") as string,
      resultCount: response.data.total,
    };

    return {
      content: `## 510(k) Clearances\n\n**${formatNumber(response.data.total)} clearances found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── search_device_events ────────────────────────────────────

const searchDeviceEvents: DataSourceTool = {
  name: "search_device_events",
  description:
    "Search FDA medical device adverse event reports (MAUDE). Returns device problem reports, manufacturers, and event types.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search" },
      device_name: { type: "string", description: "Device generic name" },
      manufacturer: { type: "string", description: "Manufacturer name" },
      event_type: { type: "string", description: "Event type (e.g., 'Malfunction', 'Injury', 'Death')" },
      date_from: { type: "string", description: "Start date (YYYYMMDD)" },
      date_to: { type: "string", description: "End date (YYYYMMDD)" },
      limit: { type: "number", description: "Max results (default 10)" },
    },
  },
  layer: 2,
  sources: ["openfda"],
  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const response = await openfdaClient.searchDeviceEvents({
      query: input.query as string | undefined,
      deviceName: input.device_name as string | undefined,
      manufacturer: input.manufacturer as string | undefined,
      eventType: input.event_type as string | undefined,
      dateFrom: input.date_from as string | undefined,
      dateTo: input.date_to as string | undefined,
      limit: (input.limit as number | undefined) ?? 10,
    });

    const headers = ["Report #", "Device", "Manufacturer", "Event Type", "Date"];
    const rows = response.data.results.map((r) => [
      dig(r, "mdr_report_key"),
      dig(r, "device.0.generic_name").slice(0, 50),
      dig(r, "device.0.manufacturer_d_name").slice(0, 40),
      dig(r, "event_type"),
      formatDate(dig(r, "date_received")),
    ]);

    const table = markdownTable(headers, rows, MAX_TABLE_ROWS_LAYER_2, response.data.total);
    const citation = {
      id: `[FDA-DEVICE-${Date.now()}]`,
      source: "openFDA MAUDE",
      query: (input.device_name ?? input.manufacturer ?? input.query ?? "all") as string,
      resultCount: response.data.total,
    };

    return {
      content: `## Device Event Reports\n\n**${formatNumber(response.data.total)} reports found**\n\n${table}\n\n${formatCitations([citation])}`,
      citations: [citation],
      vintage: response.vintage,
      confidence: response.data.total > 0 ? "HIGH" : "MEDIUM",
      truncated: rows.length < response.data.total,
    };
  },
};

// ─── Export ──────────────────────────────────────────────────

export const openfdaTools: DataSourceTool[] = [
  searchAdverseEvents,
  countAdverseEvents,
  searchDrugLabels,
  searchDrugRecalls,
  search510k,
  searchDeviceEvents,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/tools/openfda.tools.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/tools/openfda.tools.ts src/lib/data-sources/__tests__/tools/openfda.tools.test.ts
git commit -m "feat(data-sources): add openFDA Layer 2 granular tools with markdown output"
```

---

### Task 10: openFDA Layer 3 research tool (drug-safety)

**Files:**
- Create: `src/lib/data-sources/research/drug-safety.ts`
- Test: `src/lib/data-sources/__tests__/research/drug-safety.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/data-sources/__tests__/research/drug-safety.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResultCache } from "../../cache";

// Mock Layer 1 clients
vi.mock("../../clients/openfda", () => ({
  openfdaClient: {
    searchAdverseEvents: vi.fn(async () => ({
      data: { results: [{ safetyreportid: "1", serious: 1 }], total: 42, hasMore: true },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", dataThrough: "2025-Q4", source: "openFDA FAERS" },
    })),
    countAdverseEvents: vi.fn(async () => ({
      data: { results: [{ term: "NAUSEA", count: 150 }, { term: "HEADACHE", count: 120 }], total: 2, hasMore: false },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA FAERS" },
    })),
    searchDrugLabels: vi.fn(async () => ({
      data: { results: [{ openfda: { brand_name: ["Humira"] }, boxed_warning: ["Serious infections"] }], total: 1, hasMore: false },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "openFDA Labels" },
    })),
  },
}));

// Mock FDA Orange Book client (not yet implemented — returns empty)
vi.mock("../../clients/fda-orange-book", () => ({
  fdaOrangeBookClient: {
    searchProducts: vi.fn(async () => ({
      data: { results: [], total: 0, hasMore: false },
      status: 200,
      vintage: { queriedAt: "2026-01-01T00:00:00Z", source: "FDA Orange Book" },
    })),
  },
}));

describe("research_drug_safety", () => {
  let cache: ResultCache;

  beforeEach(() => {
    cache = new ResultCache();
    vi.clearAllMocks();
  });

  it("returns an intelligence packet with Key Intelligence section", async () => {
    const { drugSafetyResearchTool } = await import("../../research/drug-safety");
    const result = await drugSafetyResearchTool.handler(
      { query: "adalimumab", timeframe: "3y" },
      cache,
    );

    expect(result.content).toContain("## Drug Safety: adalimumab");
    expect(result.content).toContain("### Key Intelligence");
    expect(result.content).toContain("### Citations");
    expect(result.confidence).toBe("HIGH"); // All in-process sources returned data
    expect(result.citations.length).toBeGreaterThanOrEqual(2);
  });

  it("has layer=3 and starts with research_", async () => {
    const { drugSafetyResearchTool } = await import("../../research/drug-safety");
    expect(drugSafetyResearchTool.layer).toBe(3);
    expect(drugSafetyResearchTool.name).toBe("research_drug_safety");
    expect(drugSafetyResearchTool.name).not.toContain("__");
  });

  it("content is under 6000 character budget", async () => {
    const { drugSafetyResearchTool } = await import("../../research/drug-safety");
    const result = await drugSafetyResearchTool.handler(
      { query: "adalimumab" },
      cache,
    );
    expect(result.content.length).toBeLessThanOrEqual(6000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data-sources/__tests__/research/drug-safety.test.ts`
Expected: FAIL — module `../../research/drug-safety` does not exist

- [ ] **Step 3: Write the drug-safety research tool**

```typescript
// src/lib/data-sources/research/drug-safety.ts
/**
 * research_drug_safety — Layer 3 Intelligence Tool
 *
 * Compound research tool that aggregates adverse event data, drug labeling
 * warnings, and optionally patent/exclusivity info into a single
 * intelligence packet. Makes 3-4 parallel Layer 1 API calls per invocation.
 */

import type { DataSourceTool, ToolResult, ToolCache } from "../types";
import { openfdaClient } from "../clients/openfda";
import {
  intelligenceHeader,
  markdownTable,
  formatCitations,
  formatNumber,
  truncateToCharBudget,
  CHAR_BUDGET_LAYER_3,
} from "../format";

// Forward-safe import: Orange Book client may not exist yet during
// vertical slice development. Loaded lazily on first call.
// NOTE: This inline type is temporary — replaced with the real client
// export type once Task 12 implements fda-orange-book.ts.
type OrangeBookClient = {
  searchProducts: (params: Record<string, unknown>) => Promise<{
    data: { results: Record<string, unknown>[]; total: number; hasMore: boolean };
    status: number;
    vintage: { queriedAt: string; source: string };
  }>;
};

let fdaOrangeBookClient: OrangeBookClient | null | undefined = undefined;

async function getOrangeBookClient(): Promise<OrangeBookClient | null> {
  if (fdaOrangeBookClient !== undefined) return fdaOrangeBookClient;
  try {
    const mod = await import("../clients/fda-orange-book");
    fdaOrangeBookClient = mod.fdaOrangeBookClient;
  } catch {
    // fda-orange-book client not yet implemented — graceful degradation
    fdaOrangeBookClient = null;
  }
  return fdaOrangeBookClient;
}

export const drugSafetyResearchTool: DataSourceTool = {
  name: "research_drug_safety",
  description:
    "Comprehensive drug safety intelligence: adverse events, labeling warnings, " +
    "recall history, and patent status. Makes multiple API calls and returns a " +
    "cross-referenced intelligence packet.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Drug name (brand or generic)" },
      timeframe: { type: "string", description: "How far back to search: '1y', '3y', '5y' (default '3y')" },
      focus: { type: "string", description: "Optional focus area: 'reactions', 'recalls', 'labeling'" },
    },
    required: ["query"],
  },
  layer: 3,
  sources: ["openfda", "fda-orange-book"],

  handler: async (input: Record<string, unknown>, cache: ToolCache): Promise<ToolResult> => {
    const drugName = input.query as string;
    const timeframe = (input.timeframe as string) ?? "3y";
    const yearsBack = parseInt(timeframe) || 3;

    // Calculate date range
    const now = new Date();
    const dateFrom = new Date(now);
    dateFrom.setFullYear(dateFrom.getFullYear() - yearsBack);
    const dateFromStr = dateFrom.toISOString().slice(0, 10).replace(/-/g, "");

    // ─── Parallel API calls ────────────────────────────────────
    const [aeResult, countResult, labelResult, orangeBookResult] = await Promise.all([
      openfdaClient.searchAdverseEvents({
        drugName,
        dateFrom: dateFromStr,
        limit: 5,
      }),
      openfdaClient.countAdverseEvents({
        field: "patient.reaction.reactionmeddrapt",
        drugName,
        dateFrom: dateFromStr,
        limit: 10,
      }),
      openfdaClient.searchDrugLabels({
        brandName: drugName,
        limit: 1,
      }),
      getOrangeBookClient().then((client) =>
        client ? client.searchProducts({ query: drugName, limit: 5 }) : null,
      ),
    ]);

    // ─── Extract insights ──────────────────────────────────────
    const totalAEs = aeResult.data.total;
    const seriousCount = aeResult.data.results.filter(
      (r) => (r as Record<string, unknown>).serious === 1,
    ).length;
    const seriousRate = aeResult.data.results.length > 0
      ? Math.round((seriousCount / aeResult.data.results.length) * 100)
      : 0;

    const topReactions = countResult.data.results.slice(0, 5).map((r) => ({
      term: String((r as Record<string, unknown>).term ?? "Unknown"),
      count: (r as Record<string, unknown>).count as number ?? 0,
    }));

    const label = labelResult.data.results[0] as Record<string, unknown> | undefined;
    const hasBoxedWarning = label?.boxed_warning != null;
    const boxedWarningText = hasBoxedWarning
      ? String((label!.boxed_warning as string[])[0] ?? "").slice(0, 200)
      : null;

    // ─── Confidence scoring ────────────────────────────────────
    let sourcesReturned = 0;
    const sourcesQueried = fdaOrangeBookClient ? 4 : 3;
    if (totalAEs > 0) sourcesReturned++;
    if (countResult.data.total > 0) sourcesReturned++;
    if (labelResult.data.total > 0) sourcesReturned++;
    if (orangeBookResult?.data?.total && orangeBookResult.data.total > 0) sourcesReturned++;

    const confidence: "HIGH" | "MEDIUM" | "LOW" =
      sourcesReturned >= 3 ? "HIGH" : sourcesReturned >= 2 ? "MEDIUM" : "LOW";

    // ─── Build intelligence packet ─────────────────────────────
    const sections: string[] = [];

    // Header
    sections.push(intelligenceHeader({
      topic: "Drug Safety",
      subject: drugName,
      confidence,
      sourcesQueried,
      sourcesReturned,
      vintage: aeResult.vintage.dataThrough ?? aeResult.vintage.queriedAt.slice(0, 10),
    }));

    // Key Intelligence bullets
    const bullets: string[] = [];
    bullets.push(`- **${formatNumber(totalAEs)}** adverse event reports in the last ${yearsBack} years`);
    if (seriousRate > 0) bullets.push(`- **${seriousRate}%** of sampled reports are serious`);
    if (hasBoxedWarning) bullets.push(`- ⚠️ **Boxed Warning** on label`);
    if (topReactions.length > 0) {
      bullets.push(`- Top reactions: ${topReactions.slice(0, 3).map((r) => r.term).join(", ")}`);
    }
    if (orangeBookResult?.data?.total === 0) {
      bullets.push(`- No Orange Book entries found (may be off-patent or not an NDA drug)`);
    }
    sections.push(`### Key Intelligence\n${bullets.join("\n")}`);

    // Top reactions table
    if (topReactions.length > 0) {
      const reactionRows = topReactions.map((r) => [r.term, formatNumber(r.count)]);
      sections.push(`### Top Adverse Reactions\n${markdownTable(["Reaction", "Count"], reactionRows, 10, topReactions.length)}`);
    }

    // Boxed warning excerpt
    if (boxedWarningText) {
      sections.push(`### Boxed Warning (excerpt)\n> ${boxedWarningText}...`);
    }

    // ─── Citations ─────────────────────────────────────────────
    const citations = [
      { id: `[FDA-AE-${Date.now()}]`, source: "openFDA FAERS", query: drugName, resultCount: totalAEs },
      { id: `[FDA-LABEL-${Date.now()}]`, source: "openFDA Drug Labels", query: drugName, resultCount: labelResult.data.total },
    ];
    if (orangeBookResult) {
      citations.push({
        id: `[OB-${Date.now()}]`,
        source: "FDA Orange Book",
        query: drugName,
        resultCount: orangeBookResult.data.total,
      });
    }

    sections.push(formatCitations(citations));

    // Assemble and truncate
    const rawContent = sections.join("\n\n");
    const { content, truncated } = truncateToCharBudget(rawContent, CHAR_BUDGET_LAYER_3);

    return {
      content,
      citations,
      vintage: aeResult.vintage,
      confidence,
      truncated,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data-sources/__tests__/research/drug-safety.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/research/drug-safety.ts src/lib/data-sources/__tests__/research/drug-safety.test.ts
git commit -m "feat(data-sources): add research_drug_safety Layer 3 intelligence tool"
```

---

### Task 11: Wire openFDA vertical slice into ToolRegistry

**Files:**
- Modify: `src/lib/data-sources/registry.ts`

- [ ] **Step 1: Add tool registration and archetype routing to `registry.ts`**

Add the following to the bottom of `src/lib/data-sources/registry.ts` (same file as the ToolRegistry class — keeps routing and registration co-located):

```typescript
import { openfdaTools } from "./tools/openfda.tools";
import { drugSafetyResearchTool } from "./research/drug-safety";
import type { ArchetypeFamily } from "@/lib/pipeline/types";

// ─── Archetype Routing ──────────────────────────────────────
// Maps each archetype family to the research (Layer 3) and granular (Layer 2)
// tools it should have access to. Research tools are listed first so Claude
// preferentially selects them.

export const ARCHETYPE_TOOL_ROUTING: Record<string, {
  research: string[];
  granular: string[];
}> = {
  "RESEARCHER-DATA": {
    research: ["research_clinical_evidence", "research_global_health", "research_market_dynamics"],
    granular: ["search_bls_series", "search_census_data", "search_who_indicators"],
  },
  "RESEARCHER-DOMAIN": {
    research: ["research_drug_safety", "research_coverage_policy", "research_clinical_evidence"],
    granular: ["search_drug_labels", "search_adverse_events", "search_ncd"],
  },
  "ANALYST-RISK": {
    research: ["research_drug_safety", "research_regulatory_landscape", "research_clinical_evidence", "research_coverage_policy"],
    granular: ["search_adverse_events", "search_recalls", "search_federal_register"],
  },
  "ANALYST-FINANCIAL": {
    research: ["research_company_position", "research_market_dynamics", "research_funding_landscape"],
    granular: ["search_sec_filings", "get_company_facts", "search_bls_series"],
  },
  "ANALYST-STRATEGIC": {
    research: ["research_company_position", "research_competitive_intel", "research_regulatory_landscape"],
    granular: ["search_sec_filings", "search_federal_register", "search_congress_bills"],
  },
  "ANALYST-TECHNICAL": {
    research: ["research_clinical_evidence", "research_patent_landscape", "research_drug_safety"],
    granular: ["search_clinical_trials", "search_patents", "search_drug_labels"],
  },
  "ANALYST-QUALITY": {
    research: ["research_quality_benchmarks", "research_coverage_policy", "research_global_health"],
    granular: ["search_hcup_statistics", "search_ncd", "search_who_indicators"],
  },
  "LEGISLATIVE-PIPELINE": {
    research: ["research_legislative_status", "research_regulatory_landscape", "research_coverage_policy"],
    granular: ["search_congress_bills", "search_cbo_reports", "search_govinfo"],
  },
  "REGULATORY-RADAR": {
    research: ["research_regulatory_landscape", "research_drug_safety", "research_coverage_policy"],
    granular: ["search_federal_register", "search_drug_labels", "search_govinfo"],
  },
  "MACRO-CONTEXT": {
    research: ["research_global_health", "research_market_dynamics", "research_quality_benchmarks"],
    granular: ["search_bls_series", "search_census_data", "search_oecd_indicators"],
  },
  "FUTURIST": {
    research: ["research_clinical_evidence", "research_patent_landscape", "research_competitive_intel"],
    granular: ["search_clinical_trials", "search_patents", "search_biorxiv"],
  },
  "CUSTOMER-PROXY": {
    research: ["research_provider_landscape", "research_market_dynamics"],
    granular: ["search_npi_providers", "search_census_data"],
  },
  // Archetypes with no data source tools (use web_search or no tools):
  // RESEARCHER-WEB, RESEARCHER-LATERAL, all CRITICs, all CREATORs,
  // SYNTHESIZER, ARBITER, DEVILS-ADVOCATE, HISTORIAN, RED-TEAM
};

// ─── WEB_SEARCH_ARCHETYPES ──────────────────────────────────
// Moved from src/lib/mcp/config.ts. Controls which archetypes get
// the Anthropic web_search server tool.

export const WEB_SEARCH_ARCHETYPES: Set<string> = new Set([
  "RESEARCHER-WEB",
  "RESEARCHER-LATERAL",
  "RESEARCHER-DATA",
  "RESEARCHER-DOMAIN",
  "FUTURIST",
  "RED-TEAM",
  "MACRO-CONTEXT",
]);

// ─── Tool Registration ──────────────────────────────────────

function initializeAllTools(registry: ToolRegistry): void {
  // Layer 2: Granular tools (vertical slice — more added in Task 15)
  registry.registerTools(openfdaTools);

  // Layer 3: Research tools (vertical slice — more added in Task 15)
  registry.registerTool(drugSafetyResearchTool);

  // Load archetype routing
  registry.loadDefaultRouting(ARCHETYPE_TOOL_ROUTING);
}
```

- [ ] **Step 2: Update `getToolRegistry()` singleton to call initialization**

```typescript
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
    initializeAllTools(registryInstance);
  }
  return registryInstance;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all data-sources tests**

Run: `npx vitest run src/lib/data-sources/`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/data-sources/registry.ts
git commit -m "feat(data-sources): wire openFDA vertical slice into ToolRegistry"
```

---

## Chunk 4: Remaining Data Sources + Migration Cleanup

Template-based implementation of the remaining 14 data sources across all three layers, plus MCP config cleanup.

### Task 12: Remaining Layer 1 API clients (14 modules)

**Files:**
- Create: `src/lib/data-sources/clients/sec-edgar.ts`
- Create: `src/lib/data-sources/clients/federal-register.ts`
- Create: `src/lib/data-sources/clients/uspto-patents.ts`
- Create: `src/lib/data-sources/clients/congress-gov.ts`
- Create: `src/lib/data-sources/clients/bls-data.ts`
- Create: `src/lib/data-sources/clients/census-bureau.ts`
- Create: `src/lib/data-sources/clients/who-gho.ts`
- Create: `src/lib/data-sources/clients/gpo-govinfo.ts`
- Create: `src/lib/data-sources/clients/cbo.ts`
- Create: `src/lib/data-sources/clients/oecd-health.ts`
- Create: `src/lib/data-sources/clients/sam-gov.ts`
- Create: `src/lib/data-sources/clients/fda-orange-book.ts`
- Create: `src/lib/data-sources/clients/grants-gov.ts`
- Create: `src/lib/data-sources/clients/ahrq-hcup.ts`
- Test: `src/lib/data-sources/__tests__/clients/` (one test file per client)

Each client follows the openFDA client pattern from Task 8:
1. Import `globalRateLimiter` and `TokenBucketLimiter`
2. Define constants (base URL, endpoints, rate limit)
3. Implement typed request methods that return `ApiResponse<T>`
4. Handle errors: 404=empty, 429=throw, 400=throw with context
5. Extract `DataVintage` from API response metadata

Port logic from the existing MCP server implementations under `mcp-servers/*/src/api-client.ts`.

**Per-client rate limits** (from spec):
- SEC EDGAR: 10 req/s (requires `User-Agent` header from env)
- BLS: 2 req/s
- Census Bureau: 5 req/s
- All others: 3 req/s (safe default)

- [ ] **Step 1: Implement each client module**
  - [ ] `sec-edgar.ts` — port from `mcp-servers/sec-edgar-mcp-server/src/api-client.ts`; requires `User-Agent` header; 10 req/s rate limit
  - [ ] `federal-register.ts` — port from `mcp-servers/federal-register-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `uspto-patents.ts` — port from `mcp-servers/uspto-patents-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `congress-gov.ts` — port from `mcp-servers/congress-gov-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `bls-data.ts` — port from `mcp-servers/bls-data-mcp-server/src/api-client.ts`; 2 req/s
  - [ ] `census-bureau.ts` — port from `mcp-servers/census-bureau-mcp-server/src/api-client.ts`; 5 req/s
  - [ ] `who-gho.ts` — port from `mcp-servers/who-gho-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `gpo-govinfo.ts` — port from `mcp-servers/gpo-govinfo-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `cbo.ts` — port from `mcp-servers/cbo-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `oecd-health.ts` — port from `mcp-servers/oecd-health-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `sam-gov.ts` — port from `mcp-servers/sam-gov-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `fda-orange-book.ts` — port from `mcp-servers/fda-orange-book-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `grants-gov.ts` — port from `mcp-servers/grants-gov-mcp-server/src/api-client.ts`; 3 req/s
  - [ ] `ahrq-hcup.ts` — port from `mcp-servers/ahrq-hcup-mcp-server/src/api-client.ts`; 3 req/s

- [ ] **Step 2: Write unit tests for each client** (mock fetch, verify URL construction and error handling)
  - [ ] `sec-edgar.test.ts`
  - [ ] `federal-register.test.ts`
  - [ ] `uspto-patents.test.ts`
  - [ ] `congress-gov.test.ts`
  - [ ] `bls-data.test.ts`
  - [ ] `census-bureau.test.ts`
  - [ ] `who-gho.test.ts`
  - [ ] `gpo-govinfo.test.ts`
  - [ ] `cbo.test.ts`
  - [ ] `oecd-health.test.ts`
  - [ ] `sam-gov.test.ts`
  - [ ] `fda-orange-book.test.ts`
  - [ ] `grants-gov.test.ts`
  - [ ] `ahrq-hcup.test.ts`

- [ ] **Step 3: Run all client tests**

Run: `npx vitest run src/lib/data-sources/__tests__/clients/`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-sources/clients/ src/lib/data-sources/__tests__/clients/
git commit -m "feat(data-sources): add 14 remaining Layer 1 API clients"
```

---

### Task 13: Remaining Layer 2 granular tools (14 modules)

**Files:**
- Create: `src/lib/data-sources/tools/sec-edgar.tools.ts`
- Create: `src/lib/data-sources/tools/federal-register.tools.ts`
- Create: `src/lib/data-sources/tools/uspto-patents.tools.ts`
- Create: `src/lib/data-sources/tools/congress-gov.tools.ts`
- Create: `src/lib/data-sources/tools/bls-data.tools.ts`
- Create: `src/lib/data-sources/tools/census-bureau.tools.ts`
- Create: `src/lib/data-sources/tools/who-gho.tools.ts`
- Create: `src/lib/data-sources/tools/gpo-govinfo.tools.ts`
- Create: `src/lib/data-sources/tools/cbo.tools.ts`
- Create: `src/lib/data-sources/tools/oecd-health.tools.ts`
- Create: `src/lib/data-sources/tools/sam-gov.tools.ts`
- Create: `src/lib/data-sources/tools/fda-orange-book.tools.ts`
- Create: `src/lib/data-sources/tools/grants-gov.tools.ts`
- Create: `src/lib/data-sources/tools/ahrq-hcup.tools.ts`
- Test: `src/lib/data-sources/__tests__/tools/` (one test file per tool module)

Each tool file follows the openFDA tools pattern from Task 9:
1. Import the corresponding Layer 1 client
2. Export an array of `DataSourceTool` objects
3. Each tool: maps input params → client call → markdown formatted response → `ToolResult`
4. All names use verbs (`search_`, `get_`, `list_`, `lookup_`) — no `__`
5. All responses are markdown with 4,000 char budget

- [ ] **Step 1: Implement each tools module**
  - [ ] `sec-edgar.tools.ts` — filing search, company filings, full-text search
  - [ ] `federal-register.tools.ts` — document search, public inspection search
  - [ ] `uspto-patents.tools.ts` — patent search, patent detail lookup
  - [ ] `congress-gov.tools.ts` — bill search, legislation detail, member lookup
  - [ ] `bls-data.tools.ts` — series data, survey search
  - [ ] `census-bureau.tools.ts` — data query, geography lookup
  - [ ] `who-gho.tools.ts` — indicator search, data query
  - [ ] `gpo-govinfo.tools.ts` — document search, collection browse
  - [ ] `cbo.tools.ts` — report search, cost estimate lookup
  - [ ] `oecd-health.tools.ts` — health statistics query
  - [ ] `sam-gov.tools.ts` — entity search, exclusion search
  - [ ] `fda-orange-book.tools.ts` — product search, patent/exclusivity lookup
  - [ ] `grants-gov.tools.ts` — opportunity search, forecast search
  - [ ] `ahrq-hcup.tools.ts` — statistics query, trend data

- [ ] **Step 2: Write unit tests for each** (mock client, verify markdown output format)
  - [ ] `sec-edgar.tools.test.ts`
  - [ ] `federal-register.tools.test.ts`
  - [ ] `uspto-patents.tools.test.ts`
  - [ ] `congress-gov.tools.test.ts`
  - [ ] `bls-data.tools.test.ts`
  - [ ] `census-bureau.tools.test.ts`
  - [ ] `who-gho.tools.test.ts`
  - [ ] `gpo-govinfo.tools.test.ts`
  - [ ] `cbo.tools.test.ts`
  - [ ] `oecd-health.tools.test.ts`
  - [ ] `sam-gov.tools.test.ts`
  - [ ] `fda-orange-book.tools.test.ts`
  - [ ] `grants-gov.tools.test.ts`
  - [ ] `ahrq-hcup.tools.test.ts`

- [ ] **Step 3: Run all tools tests**

Run: `npx vitest run src/lib/data-sources/__tests__/tools/`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-sources/tools/ src/lib/data-sources/__tests__/tools/
git commit -m "feat(data-sources): add 14 remaining Layer 2 granular tool sets"
```

---

### Task 14: Remaining Layer 3 research tools (12 modules)

**Files:**
- Create: `src/lib/data-sources/research/{clinical-evidence,coverage-policy,company-position,regulatory-landscape,market-dynamics,patent-landscape,legislative-status,provider-landscape,global-health,competitive-intel,funding-landscape,quality-benchmarks}.ts`
- Test: `src/lib/data-sources/__tests__/research/` (one test file per research tool)

Each research tool follows the drug-safety pattern from Task 10:
1. Makes 2-5 parallel API calls (Layer 1 clients + McpBridge for Anthropic sources)
2. Extracts and cross-references results programmatically
3. Formats into intelligence packet (header, key intelligence, data sections, citations)
4. Confidence scoring based on data completeness
5. 6,000 char budget with smart truncation

**McpBridge-dependent tools** (combine in-process + Anthropic MCP data):
- `research_clinical_evidence`: PubMed + ClinicalTrials + bioRxiv (all via McpBridge)
- `research_coverage_policy`: CMS Coverage + ICD-10 (via McpBridge)
- `research_regulatory_landscape`: Fed Register + Congress.gov + GPO (in-process) + CMS (McpBridge)
- `research_provider_landscape`: NPI Registry (via McpBridge) + Census (in-process)
- `research_competitive_intel`: SEC + USPTO + FDA (in-process) + ClinicalTrials (McpBridge)
- `research_quality_benchmarks`: AHRQ (in-process) + CMS Coverage (McpBridge) + WHO (in-process)

These tools use `mcpBridge.call()` and degrade gracefully when MCP servers are unavailable (confidence → LOW, packet notes the gap).

- [ ] **Step 1: Implement each research tool module**
  - [ ] `clinical-evidence.ts` — PubMed + ClinicalTrials + bioRxiv (all McpBridge)
  - [ ] `coverage-policy.ts` — CMS Coverage + ICD-10 (McpBridge)
  - [ ] `company-position.ts` — SEC EDGAR + SAM.gov + USPTO patents (in-process)
  - [ ] `regulatory-landscape.ts` — Federal Register + CMS (McpBridge) + Congress.gov + GPO (in-process)
  - [ ] `market-dynamics.ts` — BLS + Census + OECD (in-process)
  - [ ] `patent-landscape.ts` — USPTO + FDA Orange Book (in-process)
  - [ ] `legislative-status.ts` — Congress.gov + GPO + CBO (in-process)
  - [ ] `provider-landscape.ts` — NPI (McpBridge) + Census (in-process)
  - [ ] `global-health.ts` — WHO GHO + OECD Health + AHRQ (in-process)
  - [ ] `competitive-intel.ts` — SEC + USPTO patents + FDA (in-process) + ClinicalTrials (McpBridge)
  - [ ] `funding-landscape.ts` — Grants.gov + SAM.gov (in-process)
  - [ ] `quality-benchmarks.ts` — AHRQ (in-process) + CMS Coverage (McpBridge) + WHO (in-process)

- [ ] **Step 2: Write unit tests for each** (mock clients and McpBridge, verify packet format)
  - [ ] `clinical-evidence.test.ts`
  - [ ] `coverage-policy.test.ts`
  - [ ] `company-position.test.ts`
  - [ ] `regulatory-landscape.test.ts`
  - [ ] `market-dynamics.test.ts`
  - [ ] `patent-landscape.test.ts`
  - [ ] `legislative-status.test.ts`
  - [ ] `provider-landscape.test.ts`
  - [ ] `global-health.test.ts`
  - [ ] `competitive-intel.test.ts`
  - [ ] `funding-landscape.test.ts`
  - [ ] `quality-benchmarks.test.ts`

- [ ] **Step 3: Run all research tests**

Run: `npx vitest run src/lib/data-sources/__tests__/research/`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-sources/research/ src/lib/data-sources/__tests__/research/
git commit -m "feat(data-sources): add 12 remaining Layer 3 research tools"
```

---

### Task 15: Complete tool registration and archetype routing

**Files:**
- Modify: `src/lib/data-sources/registry.ts` — register all tools, load full routing map

- [ ] **Step 1: Update `initializeAllTools()` with all tool imports and registrations**

Replace the vertical-slice-only imports in `initializeAllTools()` (from Task 11) with the complete set:

```typescript
// Layer 2: Granular tool imports (15 modules)
import { openfdaTools } from "./tools/openfda.tools";
import { secEdgarTools } from "./tools/sec-edgar.tools";
import { federalRegisterTools } from "./tools/federal-register.tools";
import { usptoPatentsTools } from "./tools/uspto-patents.tools";
import { congressGovTools } from "./tools/congress-gov.tools";
import { blsDataTools } from "./tools/bls-data.tools";
import { censusBureauTools } from "./tools/census-bureau.tools";
import { whoGhoTools } from "./tools/who-gho.tools";
import { gpoGovinfoTools } from "./tools/gpo-govinfo.tools";
import { cboTools } from "./tools/cbo.tools";
import { oecdHealthTools } from "./tools/oecd-health.tools";
import { samGovTools } from "./tools/sam-gov.tools";
import { fdaOrangeBookTools } from "./tools/fda-orange-book.tools";
import { grantsGovTools } from "./tools/grants-gov.tools";
import { ahrqHcupTools } from "./tools/ahrq-hcup.tools";

// Layer 3: Research tool imports (13 modules)
import { drugSafetyResearchTool } from "./research/drug-safety";
import { clinicalEvidenceResearchTool } from "./research/clinical-evidence";
import { coveragePolicyResearchTool } from "./research/coverage-policy";
import { companyPositionResearchTool } from "./research/company-position";
import { regulatoryLandscapeResearchTool } from "./research/regulatory-landscape";
import { marketDynamicsResearchTool } from "./research/market-dynamics";
import { patentLandscapeResearchTool } from "./research/patent-landscape";
import { legislativeStatusResearchTool } from "./research/legislative-status";
import { providerLandscapeResearchTool } from "./research/provider-landscape";
import { globalHealthResearchTool } from "./research/global-health";
import { competitiveIntelResearchTool } from "./research/competitive-intel";
import { fundingLandscapeResearchTool } from "./research/funding-landscape";
import { qualityBenchmarksResearchTool } from "./research/quality-benchmarks";

function initializeAllTools(registry: ToolRegistry): void {
  // Layer 2: Register all 15 granular tool sets
  registry.registerTools(openfdaTools);
  registry.registerTools(secEdgarTools);
  registry.registerTools(federalRegisterTools);
  registry.registerTools(usptoPatentsTools);
  registry.registerTools(congressGovTools);
  registry.registerTools(blsDataTools);
  registry.registerTools(censusBureauTools);
  registry.registerTools(whoGhoTools);
  registry.registerTools(gpoGovinfoTools);
  registry.registerTools(cboTools);
  registry.registerTools(oecdHealthTools);
  registry.registerTools(samGovTools);
  registry.registerTools(fdaOrangeBookTools);
  registry.registerTools(grantsGovTools);
  registry.registerTools(ahrqHcupTools);

  // Layer 3: Register all 13 research tools
  registry.registerTool(drugSafetyResearchTool);
  registry.registerTool(clinicalEvidenceResearchTool);
  registry.registerTool(coveragePolicyResearchTool);
  registry.registerTool(companyPositionResearchTool);
  registry.registerTool(regulatoryLandscapeResearchTool);
  registry.registerTool(marketDynamicsResearchTool);
  registry.registerTool(patentLandscapeResearchTool);
  registry.registerTool(legislativeStatusResearchTool);
  registry.registerTool(providerLandscapeResearchTool);
  registry.registerTool(globalHealthResearchTool);
  registry.registerTool(competitiveIntelResearchTool);
  registry.registerTool(fundingLandscapeResearchTool);
  registry.registerTool(qualityBenchmarksResearchTool);

  // Load archetype routing (already defined in registry.ts from Task 11)
  registry.loadDefaultRouting(ARCHETYPE_TOOL_ROUTING);
}
```

- [ ] **Step 2: Verify `ARCHETYPE_TOOL_ROUTING` is complete**

Run: `grep -c "research_\|_tools" src/lib/data-sources/registry.ts`

Verify the routing map covers all 12 archetype families from the spec (lines 496-584). Cross-check:
1. Count archetype keys in `ARCHETYPE_TOOL_ROUTING` — should be 12
2. Every Layer 3 research tool name appears in at least one archetype's `researchTools` array
3. Every Layer 2 tool array name appears in at least one archetype's `granularTools` array

Run: `npx vitest run src/lib/data-sources/__tests__/registry.test.ts`
Expected: Routing coverage test passes (added in Task 11)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/data-sources/registry.ts
git commit -m "feat(data-sources): complete tool registration and archetype routing"
```

---

### Task 16: MCP config cleanup

**Files:**
- Modify: `src/lib/mcp/config.ts` — remove 15 Protoprism entries, keep 6 Anthropic
- Modify: `src/lib/mcp/config.ts` — remove `ARCHETYPE_TOOL_ROUTING` and `WEB_SEARCH_ARCHETYPES` exports
- Modify: `src/lib/pipeline/construct.ts` — update imports from `@/lib/mcp/config` to `@/lib/data-sources/registry`
- Modify: `src/lib/mcp/client.ts` — update imports if needed
- Modify: `.env` — mark 15 `MCP_*_URL` localhost entries as deprecated
- Modify: `src/__tests__/unit/mcp/config.test.ts` — migrate routing tests to `registry.test.ts`

- [ ] **Step 1: Reduce `MCP_SERVERS` to 6 Anthropic entries only**

Remove all entries from `pubmed` through `ahrq_hcup` that are Protoprism-built servers (ports 3010-3024). Keep only:
- `pubmed`, `cms_coverage`, `icd10`, `npi_registry`, `clinical_trials`, `biorxiv`

- [ ] **Step 2: Remove `ARCHETYPE_TOOL_ROUTING` from config.ts**

This routing now lives in `src/lib/data-sources/registry.ts`.

- [ ] **Step 3: Remove `WEB_SEARCH_ARCHETYPES` from config.ts**

This set now lives in `src/lib/data-sources/registry.ts` and is imported from there by `deploy.ts`.

- [ ] **Step 4: Update all remaining imports of moved exports**

Run: `grep -r "from.*@/lib/mcp/config" src/ --include="*.ts"`

Known files that import `ARCHETYPE_TOOL_ROUTING` or `WEB_SEARCH_ARCHETYPES` from `@/lib/mcp/config`:

**`src/lib/pipeline/construct.ts`** (lines 35-36):
```typescript
// BEFORE:
import {
  ARCHETYPE_TOOL_ROUTING,
  WEB_SEARCH_ARCHETYPES,
} from "@/lib/mcp/config";

// AFTER:
import {
  getToolRegistry,
  WEB_SEARCH_ARCHETYPES,
} from "@/lib/data-sources/registry";
```

Also update the function body in `construct.ts` that previously read tools from `ARCHETYPE_TOOL_ROUTING`:

**Important:** `construct.ts` needs tool **names** (for building agent system prompts and storing on agent records), not tool **definitions** (which `deploy.ts` uses for API calls). The replacement must account for this difference:

```typescript
// BEFORE (in construct.ts):
import {
  ARCHETYPE_TOOL_ROUTING,
  WEB_SEARCH_ARCHETYPES,
} from "@/lib/mcp/config";
// ...
const serverNames = ARCHETYPE_TOOL_ROUTING[archetype] ?? [];
// ... used serverNames to build tool name list

// AFTER:
import {
  getToolRegistry,
  WEB_SEARCH_ARCHETYPES,
} from "@/lib/data-sources/registry";
// ...
const registry = getToolRegistry();
const toolNames = registry.getToolNamesForArchetype(archetype);
// ... use toolNames (string[]) alongside MCPManager tool names
```

`getToolNamesForArchetype()` returns `string[]` (tool name strings), not `ToolUnion[]`. This method was defined on `ToolRegistry` in Task 6 alongside `getToolsForArchetype()` which returns full tool definitions for `deploy.ts`.

The exact function and line numbers depend on the current `construct.ts` implementation — search for `ARCHETYPE_TOOL_ROUTING` usage and replace with the `getToolRegistry()` call.

**`src/lib/pipeline/deploy.ts`** — already updated in Task 7 Step 1.

**`src/lib/mcp/client.ts`** — if it imports `WEB_SEARCH_ARCHETYPES`, update to import from `@/lib/data-sources/registry`.

**`src/__tests__/unit/mcp/config.test.ts`** — migrate any test cases for `ARCHETYPE_TOOL_ROUTING` and `WEB_SEARCH_ARCHETYPES` into `src/lib/data-sources/__tests__/registry.test.ts` (updating imports to `@/lib/data-sources/registry`). Remove those test cases from the MCP config test file. Tests validating `MCP_SERVERS` entries stay in the MCP config test file.

Fix each file until `grep` returns zero matches for the moved exports.

- [ ] **Step 5: Comment out localhost MCP_*_URL entries in .env**

```bash
# These localhost MCP servers are replaced by in-process data source clients.
# See src/lib/data-sources/ for the new architecture.
# MCP_OPENFDA_URL="http://localhost:3010/mcp"
# ... (all 15)
```

- [ ] **Step 6: Verify TypeScript compiles and all tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Zero errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/mcp/config.ts src/lib/pipeline/construct.ts src/lib/mcp/client.ts \
  src/__tests__/unit/mcp/config.test.ts src/lib/data-sources/__tests__/registry.test.ts \
  .env
git commit -m "refactor(mcp): reduce MCP config to 6 Anthropic servers, move routing to data-sources"
```

---

### Task 17: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Verify no remaining MCP sidecar imports**

Run: `grep -r "from.*@/lib/mcp/config.*ARCHETYPE\|from.*@/lib/mcp/config.*WEB_SEARCH" src/ --include="*.ts"`
Expected: Zero matches

- [ ] **Step 4: Verify no tool names contain __**

Run: `grep -r "name:.*__" src/lib/data-sources/tools/ src/lib/data-sources/research/ --include="*.ts"`
Expected: Zero matches (tool names must not have `__`)

- [ ] **Step 5: Start dev server and verify app loads**

Run: `npm run dev`
Expected: App loads without errors, no 500s from missing MCP servers

- [ ] **Step 6: End-to-end pipeline verification**

With the dev server still running from Step 5, run a pipeline through the API to verify the new data source architecture produces findings:

```bash
curl -X POST http://localhost:3000/api/pipeline/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the safety risks of metformin for elderly patients?", "mode": "quick"}'
```

Expected:
- Pipeline completes without errors
- Findings contain data sourced from in-process tools (no MCP sidecar dependency)
- Research tool results include intelligence packets with confidence scores and citations
- Compare finding quality to a previous MCP-baseline run if available

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification of intelligence-ready data source architecture"
```
