# daily-crust Design Document

**Date:** 2026-02-12
**Status:** Approved

## Overview

daily-crust is a Druid cluster monitoring web app styled with Spotify's design language. It connects to an internal MCP server exposing Druid metrics and presents two views: a "Druid Wrapped" weekly performance report and a live operational dashboard.

## Decisions

- **Data source:** Simulated mock data with a clean MCP client interface for future swap-in
- **Weekly report:** Static "Druid Wrapped" snapshot (not interactive/filterable)
- **Live dashboard:** Client-side polling every 15 seconds
- **Authentication:** None (internal trusted network)
- **Persistence:** None (all data fetched live from MCP)
- **Stack:** Next.js App Router + Tailwind CSS + Recharts

## Architecture

```
Next.js App
├── /weekly (Server Component) — Druid Wrapped report
├── /dashboard (Client Component) — Live metrics dashboard
├── /api/cluster/* — API routes proxying MCP client
└── lib/
    ├── mcp-client.ts — DruidMCPClient interface + factory
    └── mock-client.ts — Simulated Druid data
```

The MCP client layer defines a TypeScript interface (`DruidMCPClient`). A mock implementation provides realistic simulated data. A `MCP_MODE` env var controls which implementation is used — swap to `live` when the real MCP server is available.

## Weekly Report — "Druid Wrapped"

A single-page, scrollable report with large typography and Spotify-Wrapped aesthetic. Sections:

1. **Hero / Title Card** — "Your Week in Druid" with cluster name and date range. Gradient from Spotify Green to black.
2. **Cluster Reliability Score** — Giant percentage. Green >= 99.9%, yellow >= 99.5%, red below. Subtext: "X out of Y queries succeeded."
3. **Top Performer** — Datasource with the most rows ingested in the shortest time. Name, row count, duration.
4. **The Bottleneck** — Worst-performing ingestion task. Task ID, datasource, duration, rows/sec. Red accent.
5. **SLA Watch** — Count of queries exceeding 1s threshold. Proportion bar.
6. **Segment Health** — Compaction recommendations. Segments too small (<100MB) or too large. Segment count vs total size.

## Live Dashboard

Minimal, glanceable real-time view. Layout:

- **Top row:** Three MetricTile cards — Uptime (percentage + heartbeat), QPS (number + sparkline chart), Active Tasks (count).
- **Main area:** Ingestion list — running tasks with progress bars, datasource names, progress percentage, time since last update.
- **Bottom bar:** Refresh indicator showing seconds since last poll, green dot for active auto-refresh.

Polling interval: 15 seconds via Next.js API routes.

## MCP Client Interface

```typescript
interface DruidMCPClient {
  getClusterStatus(): Promise<ClusterStatus>
  getActiveTasks(): Promise<Task[]>
  getQueryMetrics(range: DateRange): Promise<QueryMetrics>
  getSegmentHealth(): Promise<SegmentHealth[]>
  getIngestionStats(range: DateRange): Promise<IngestionStats[]>
  getQueryVelocity(): Promise<QueuePoint[]>
}
```

Mock implementation returns realistic, slightly randomized data: uptime ~99.9%, QPS 800-1500, a few running ingestion tasks, realistic segment size distribution.

## API Routes

- `GET /api/cluster/status` — cluster status (uptime, server count)
- `GET /api/cluster/tasks` — active ingestion tasks
- `GET /api/cluster/qps` — query velocity time series

Weekly report data is fetched server-side directly via the MCP client (no API route needed).

## Design System

- **Theme:** Dark mode only
- **Background:** `#121212` (main), `#282828` (cards)
- **Brand green:** `#1DB954`
- **Text:** `#FFFFFF` (headings), `#B3B3B3` (secondary)
- **Error:** `#E91429`
- **Warning:** `#F59B23`
- **Font:** Circular Std, Helvetica Neue, system sans-serif
- **Cards:** `border-radius: 8px`, flat background `#181818` or `#282828`, subtle hover `#2a2a2a`

## File Structure

```
daily-crust/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/page.tsx
│   ├── weekly/page.tsx
│   └── api/cluster/
│       ├── status/route.ts
│       ├── tasks/route.ts
│       └── qps/route.ts
├── components/
│   ├── MetricTile.tsx
│   ├── QpsChart.tsx
│   ├── IngestionList.tsx
│   ├── WeeklyReportCard.tsx
│   ├── ReliabilityScore.tsx
│   └── Nav.tsx
├── lib/
│   ├── mcp-client.ts
│   ├── mock-client.ts
│   └── types.ts
├── tailwind.config.ts
└── .env.local
```
