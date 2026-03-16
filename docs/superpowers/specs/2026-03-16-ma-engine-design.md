# M&A Engine — Design Specification

## Overview

The M&A Engine is an autonomous intelligence system that actively hunts healthcare M&A opportunities, PE/VC activity, and acquisition targets across 7 sectors. It runs as a sidebar-selectable engine within the Protoprism platform shell at `/engines/ma` with violet accent theming.

Unlike the Command Center (query-driven, stateless), the M&A Engine is **self-populating** — background sweeps continuously collect signals, resolve them into deals and targets, and surface ranked intelligence without user prompting.

## Architecture: Three Layers

### Layer 1: Signal Sweep (Background)

A scheduled job runs the `healthcare-ma-signal-hunter` skill across 7 sectors:
- Hospitals, Providers, Pharmacy, Payers, Analytics, Life Sciences, Regulatory

For each sector, executes web searches using existing MCP tools (`web_search`, `gdelt_search`, `sec_edgar`, `federal_register`). Lightweight headline collection, not deep verification. Runs daily (or on-demand via API).

Produces raw `MaSignal` records classified into confidence tiers:
- **Tier 1 (Confirmed)**: SEC filing + press release + regulatory approval
- **Tier 2 (High)**: Press release + credible news (2+ sources)
- **Tier 3 (Signal)**: Single credible source or regulatory pattern

### Layer 2: Intelligence Processing (Background)

Post-sweep processor that runs after each signal sweep:

1. **Entity Resolution** — Groups signals by company names. Fuzzy-matches against existing `MaDeal` or `MaTarget` records.
2. **Deal Tracking** — New signals attach to existing deals. Status lifecycle updates when evidence warrants (e.g., FTC filing → Under Review).
3. **Target Identification** — When an entity appears in 2+ signals without a matching deal, creates an `MaTarget` record. The engine actively identifies companies as acquisition candidates.
4. **Vulnerability Scoring** — For each target, computes a 0-100 vulnerability score from accumulated signals:
   - Financial stress signals (30%)
   - Regulatory pressure (25%)
   - Market position erosion (20%)
   - PE interest patterns (15%)
   - Management turnover (10%)
5. **Deal Status Updates** — Checks if new signals change deal status (FTC filing → Under Review, close announcement → Closed).

### Layer 3: Deep Analysis (On-Demand)

When a user drills into a deal or target:

- **Structured Dossier** — Auto-populates from cached signals + a focused verification sweep against primary sources (SEC EDGAR for financials, Federal Register for regulatory, GDELT for sentiment). Fixed sections: Overview → Financial Profile → Strategic Rationale → Regulatory Risk → Valuation Context → Comparable Transactions.
- **Deep Dive** — A button launches the full Command Center agent pipeline with M&A skills pre-loaded (`healthcare-ma-signal-hunter`, `payer-financial-decoder`, `deal-room-intelligence`). Produces a presentation deck for stakeholder briefings.

## Data Model (Prisma)

Four new models added to `prisma/schema.prisma`:

### MaSignal — Raw intelligence atoms

```prisma
model MaSignal {
  id               String    @id @default(cuid())
  sector           String    // hospitals|providers|pharmacy|payers|analytics|lifesciences|regulatory
  tier             Int       // 1 (confirmed), 2 (high), 3 (signal)
  headline         String
  summary          String
  sourceUrl        String?
  sourceType       String    // SEC|FTC|GDELT|Web|PressRelease
  entitiesMentioned String[] // company names extracted
  dealId           String?
  deal             MaDeal?   @relation(fields: [dealId], references: [id])
  targetId         String?
  target           MaTarget? @relation(fields: [targetId], references: [id])
  sweepId          String
  sweep            MaSweep   @relation(fields: [sweepId], references: [id])
  createdAt        DateTime  @default(now())
}
```

### MaDeal — Known M&A activity

```prisma
model MaDeal {
  id             String     @id @default(cuid())
  acquirer       String
  targetCompany  String
  sector         String
  status         String     @default("rumor") // rumor|announced|under_review|closed|blocked|withdrawn
  dealValue      Float?     // in millions USD
  announcedDate  DateTime?
  signalCount    Int        @default(0)
  tier           Int        @default(3) // highest confidence signal
  lastSignalAt   DateTime?
  dossierJson    Json?      // cached structured dossier
  signals        MaSignal[]
  promotedTarget MaTarget?  @relation("TargetPromotion")
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
}
```

### MaTarget — Engine-identified acquisition candidates

```prisma
model MaTarget {
  id                String     @id @default(cuid())
  companyName       String
  sector            String
  vulnerabilityScore Float     @default(0) // 0-100
  fitVectors        Json       // { peRollup, verticalIntegration, megaMerger, distress }
  triggerSignals    String[]   // what's driving the identification
  signalCount       Int        @default(0)
  lastSignalAt      DateTime?
  promotedToDealId  String?    @unique
  promotedToDeal    MaDeal?    @relation("TargetPromotion", fields: [promotedToDealId], references: [id])
  dossierJson       Json?      // cached structured dossier
  signals           MaSignal[]
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
}
```

### MaSweep — Audit trail for background runs

```prisma
model MaSweep {
  id             String     @id @default(cuid())
  startedAt      DateTime   @default(now())
  completedAt    DateTime?
  status         String     @default("running") // running|completed|failed
  signalsFound   Int        @default(0)
  dealsUpdated   Int        @default(0)
  targetsUpdated Int        @default(0)
  sectorsSwept   String[]
  signals        MaSignal[]
}
```

### Key relationships

- Signals link to deals OR targets (or neither if unclassified)
- When a target gets an announced deal, `promotedToDealId` links them — the prediction is validated
- Vulnerability score recomputes on every new signal attachment
- Sweep records provide audit trail of all background runs

## Dashboard UX: Split-Pane

### KPI Bar (top)
- Total deal value YTD
- Deal count (by status breakdown)
- Active target count
- Signal count (last 24h)
- Top sector by activity

### Deal Radar (left pane)
- Deal cards: acquirer → target, sector badge, status pill, deal value, signal count, last signal timestamp
- Sortable by: recency, deal value, signal count, tier
- Status filters: All / Rumor / Announced / Under Review / Closed

### Target Board (right pane)
- Target cards: company name, sector, vulnerability score (gauge), top 3 trigger signals, fit vector badges (PE Rollup, Vertical Integration, Distress, etc.)
- Sortable by: vulnerability score, signal recency, signal count
- "Promoted" badge when a target becomes a real deal

### Sector Tabs
7 tabs matching the skill's sectors, filtering both panes simultaneously. Each tab shows sector-specific KPIs from the benchmarks (e.g., Hospital: distress rate, Provider: PE platform count).

### Drill-Down Dossier
Click any deal/target → slide-out panel with structured sections:
1. Overview
2. Financial Profile
3. Strategic Rationale
4. Regulatory Risk
5. Valuation Context
6. Comparable Transactions

Auto-populated from cached signals. "Deep Dive" button launches full agent pipeline.

## Platform Integration

- Route: `/engines/ma` inside `(platform)` route group
- Engine manifest: `EngineShell` with violet accent (`#8b5cf6`), status changes from `coming-soon` to `active`
- Sweep API: `POST /api/engines/ma/sweep` (triggered by cron or manual)
- Dashboard API: `GET /api/engines/ma/dashboard` (aggregates from Prisma/PostgreSQL)
- Signal API: `GET /api/engines/ma/signals?sector=&tier=&since=`
- Deal API: `GET /api/engines/ma/deals?status=&sector=`
- Target API: `GET /api/engines/ma/targets?minScore=&sector=`
- Dossier API: `GET /api/engines/ma/dossier/:type/:id` (type = deal|target)
- Deep dive reuses existing Command Center pipeline with M&A skills pre-loaded

## Existing Assets Leveraged

- `healthcare-ma-signal-hunter` skill — sector definitions, query patterns, signal taxonomy, dashboard template
- `payer-financial-decoder` skill — financial analysis for dossier generation
- `deal-room-intelligence` skill — deep dive presentation generation
- `competitor-battlecard` skill — competitive context for targets
- MCP servers: `sec-edgar`, `federal-register`, `gdelt` (via web search), `opensecrets-lobbying`

## Build Sequence

1. Prisma schema migration (4 new models)
2. Sweep pipeline (signal collection + entity resolution)
3. Intelligence processing (deal tracking + target identification + vulnerability scoring)
4. Dashboard API endpoints
5. Dashboard UI (KPI bar, deal radar, target board, sector tabs)
6. Dossier slide-out panel
7. Deep dive integration (Command Center pipeline bridge)
8. Engine manifest activation
9. Integration tests
