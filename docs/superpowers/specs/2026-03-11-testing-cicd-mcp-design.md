# Testing, CI/CD, and MCP Enablement Design

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Three parallel workstreams to bring Protoprism to production readiness

---

## 1. Testing

### Framework

Vitest — native ESM/TypeScript, fast watch mode, compatible with Next.js 16.

### Dependencies

- `vitest` — test runner
- `@vitest/coverage-v8` — coverage reporting
- `vitest-mock-extended` — typed Prisma mocking

### Test Tiers

**Unit tests** — pure functions, no external dependencies:
- Zod schema validation (all pipeline phase schemas)
- Archetype search, forge, chemistry matrix
- Skill router matching and injection
- Crypto encrypt/decrypt round-trip
- Rate limiter token bucket behavior
- Settings store serialization
- Logger output formatting
- Constants and utility functions

**Integration tests** — mocked external boundaries:
- Pipeline phases (think, construct, deploy, synthesize, verify, present) with MockAnthropicClient
- MCP client tool discovery, qualification, and routing with mock server registry
- SSE stream event serialization

**API route tests** — mocked Prisma + pipeline:
- `/api/pipeline/stream` — validates SSE event format
- `/api/pipeline/approve` — blueprint approval gate
- `/api/pipeline/triage` — finding action updates
- `/api/onboarding/status` — settings retrieval
- `/api/settings` — CRUD operations

### Mock Strategy

**MockAnthropicClient** (`src/__mocks__/anthropic.ts`):
- Returns canned responses matching Zod schemas for each pipeline phase
- Supports tool_use response format for DEPLOY phase testing
- Configurable to return errors for error-path testing

**MockPrisma** (`src/__mocks__/prisma.ts`):
- Uses `vitest-mock-extended` for typed mocks
- No real SQLite in unit/integration tests

**MockMCPManager** (`src/__mocks__/mcp.ts`):
- Returns mock tool definitions per archetype
- Validates tool routing without real server connections

### File Structure

```
src/
  __tests__/
    unit/
      pipeline/types.test.ts
      pipeline/archetypes.test.ts
      pipeline/skill-router.test.ts
      lib/crypto.test.ts
      lib/rate-limit.test.ts
      lib/settings-store.test.ts
    integration/
      pipeline/think.test.ts
      pipeline/construct.test.ts
      pipeline/deploy.test.ts
      pipeline/synthesize.test.ts
      mcp/client.test.ts
    api/
      pipeline-stream.test.ts
      onboarding.test.ts
      settings.test.ts
  __mocks__/
    anthropic.ts
    prisma.ts
    mcp.ts
```

### Configuration

`vitest.config.ts` at project root:
- Resolve `@/` path alias to `./src/`
- Global test setup for mock initialization
- Coverage thresholds: 60% lines (initial target, increase over time)
- Exclude `src/generated/`, `src/app/layout.tsx`, config files

---

## 2. CI/CD

### GitHub Actions

**Workflow: `ci.yml`** — triggers on PR and push to main

Steps:
1. Checkout code
2. Setup Node 20 with npm cache
3. `npm ci` (clean install)
4. `npx prisma generate` (build client)
5. `npm run lint`
6. `npm run type-check`
7. `npm run test -- --coverage`
8. `npm run build`
9. Upload coverage artifact

Fail-fast: each step depends on the previous. No point building if tests fail.

**Workflow: `docker-publish.yml`** — triggers on push to main (after CI passes)

Steps:
1. Checkout code
2. Login to GitHub Container Registry
3. Build Docker image (multi-stage)
4. Tag with git SHA + `latest`
5. Push to `ghcr.io/<org>/protoprism`

### Docker

**Multi-stage Dockerfile:**

```
Stage 1 (deps):
  FROM node:20-alpine
  COPY package.json package-lock.json
  RUN npm ci

Stage 2 (build):
  FROM deps
  COPY . .
  RUN npx prisma generate
  RUN npm run build

Stage 3 (runner):
  FROM node:20-alpine
  COPY --from=build /app/.next/standalone ./
  COPY --from=build /app/.next/static ./.next/static
  COPY --from=build /app/public ./public
  COPY --from=build /app/prisma ./prisma
  COPY --from=build /app/src/generated ./src/generated
  ENV NODE_ENV=production
  EXPOSE 3000
  CMD ["node", "server.js"]
```

Requires `output: "standalone"` in `next.config.ts`.

**Runtime configuration:**
- `ANTHROPIC_API_KEY` — required env var
- `DATABASE_URL` — defaults to `file:./prisma/dev.db`
- SQLite database file mounted as Docker volume for persistence
- MCP server URLs via environment variables

**Health check:** `GET /api/onboarding/status` returns 200

### npm Scripts (new)

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "type-check": "tsc --noEmit",
  "ci": "npm run lint && npm run type-check && npm run test && npm run build"
}
```

### Git Hooks

Using `simple-git-hooks` + `lint-staged` (lightweight, no Husky):

**pre-commit:** Run lint + type-check on staged `.ts`/`.tsx` files only.

```json
// package.json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix"]
  }
}
```

---

## 3. MCP Server Enablement

### Problem

6 MCP servers configured in `src/lib/mcp/config.ts`, all hardcoded `available: false`. These are remote Anthropic-hosted servers requiring SSE transport, but `MCPManager` currently only supports `StdioClientTransport`.

### Solution

Add SSE transport support to `MCPManager` alongside existing stdio support.

### Config Changes (`mcp/config.ts`)

Extend `MCPServerConfig` interface:

```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  available: boolean;
  transport: "sse" | "stdio";
  // SSE transport
  url?: string;        // resolved from env var at runtime
  envUrlKey?: string;   // e.g. "MCP_PUBMED_URL"
  // Stdio transport (existing)
  command?: string;
  args?: string[];
  // Shared
  tools: string[];
}
```

Each server updated:
```typescript
{
  id: "pubmed",
  available: true,            // enabled by default
  transport: "sse",
  envUrlKey: "MCP_PUBMED_URL", // resolved at runtime
  ...
}
```

### Client Changes (`mcp/client.ts`)

Update `MCPManager.initialize()`:

```
for each server in config:
  if server.transport === "sse":
    url = process.env[server.envUrlKey]
    if (!url) → mark unavailable, log gap, continue
    transport = new SSEClientTransport(new URL(url))
  else if server.transport === "stdio":
    transport = new StdioClientTransport({ command, args })

  try:
    client = new Client(...)
    await client.connect(transport, { timeout: 10_000 })
    discover tools, register in map
  catch:
    mark server unavailable at runtime
    log gap
    continue  // graceful degradation
```

This preserves the existing graceful degradation pattern — if a server URL isn't set or the connection fails, the agent reports gaps instead of crashing.

### Environment Variables

```env
# MCP Server URLs (all optional — graceful degradation if missing)
MCP_PUBMED_URL=https://...
MCP_CMS_COVERAGE_URL=https://...
MCP_ICD10_URL=https://...
MCP_NPI_REGISTRY_URL=https://...
MCP_CLINICAL_TRIALS_URL=https://...
MCP_BIORXIV_URL=https://...
```

### Docker/CI Behavior

- **CI:** No MCP URLs set → all servers unavailable → agents report gaps → tests pass
- **Docker:** MCP URLs passed as runtime env vars → servers connect on startup
- **Local dev:** Add URLs to `.env` if available, otherwise graceful degradation

### Test Strategy

- **Unit tests:** Mock `SSEClientTransport` — verify tool discovery, qualified naming, routing per archetype
- **Integration flag:** `MCP_INTEGRATION=true` enables real connection tests (skipped in CI)
- **Existing graceful degradation** already handles missing servers — no new error paths needed

---

## Cross-Cutting Concerns

### Dependency Budget

New dev dependencies:
- `vitest`, `@vitest/coverage-v8`, `vitest-mock-extended`
- `simple-git-hooks`, `lint-staged`

No new production dependencies (SSE transport is already in `@modelcontextprotocol/sdk`).

### Migration Risk

- **Testing:** Zero risk — additive only, no existing code changes
- **CI/CD:** Zero risk — new files only (workflows, Dockerfile, npm scripts)
- **MCP:** Low risk — changes to 2 files (`config.ts`, `client.ts`), preserves existing degradation behavior
- **next.config.ts:** One change — add `output: "standalone"` for Docker

### Implementation Order

All three can proceed in parallel since they touch different files. Recommended sequence within each:

1. **Testing:** vitest config → mocks → unit tests → integration tests → API tests
2. **CI/CD:** npm scripts → git hooks → ci.yml → Dockerfile → docker-publish.yml
3. **MCP:** config.ts types → client.ts SSE support → env vars → verify connections
