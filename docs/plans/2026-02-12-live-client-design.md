# Live Client + Region Filtering Design

**Date:** 2026-02-12
**Status:** Approved

## Overview

Add a live Druid client that connects to Babka/OSD clusters via archdruid CLI, and add multi-region filtering to the dashboard UI. The app stays on mock mode until cluster access is configured, then switches via `MCP_MODE=live`.

## Decisions

- **Connection method:** archdruid CLI subprocess (handles auth, gRPC, and cluster routing)
- **Multi-region:** Support GEW1, GUC3, GAE2, and "all" (parallel queries merged)
- **Backward compatible:** Mock client continues working; region parameter is optional
- **Config:** `ARCHDRUID_PATH`, `DRUID_CLUSTER` (default region), `MCP_MODE` env vars

## Type Changes

```typescript
export type DruidRegion = "osd-prod-gew1" | "osd-prod-guc3" | "osd-prod-gae2" | "all";

// DruidMCPClient methods gain optional region parameter
export interface DruidMCPClient {
  getClusterStatus(region?: DruidRegion): Promise<ClusterStatus>;
  getActiveTasks(region?: DruidRegion): Promise<Task[]>;
  getQueryMetrics(range: DateRange, region?: DruidRegion): Promise<QueryMetrics>;
  getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]>;
  getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange, region?: DruidRegion): Promise<WeeklyReport>;
}
```

Add `region` field to `ClusterStatus` to identify which cluster the data came from.

## Live Client (`lib/live-client.ts`)

Uses `child_process.execFile` to run archdruid commands:

| Method | archdruid Command |
|---|---|
| `getClusterStatus` | `archdruid cluster health --cluster {region} --output json` |
| `getActiveTasks` | `archdruid tasks list --cluster {region} --state RUNNING --output json` |
| `getSegmentHealth` | `archdruid query run --cluster {region} --query "SELECT datasource, COUNT(*) as segment_count, SUM(\"size\") as total_size FROM sys.segments GROUP BY datasource"` |
| `getQueryMetrics` | `archdruid query run --cluster {region} --query "SELECT COUNT(*) as total, ... FROM sys.tasks WHERE ..."` |
| `getQueryVelocity` | Synthesized from polling frequency (no native QPS endpoint) |
| `getWeeklyReport` | Aggregates multiple queries |

For `region = "all"`: runs in parallel across all three regions and merges results.

## API Route Changes

Each route accepts `?region=osd-prod-gew1` query parameter:
- `GET /api/cluster/status?region=all`
- `GET /api/cluster/tasks?region=osd-prod-guc3`
- `GET /api/cluster/qps?region=osd-prod-gew1`

Defaults to `process.env.DRUID_CLUSTER ?? "all"`.

## Dashboard UI: Region Selector

A pill-style `RegionSelector` component at the top of the dashboard page, above the metric tiles. Matches the Nav styling (dark background, green active state).

Options: **All** | **GEW1** | **GUC3** | **GAE2**

Selected region stored in component state, passed to all fetch calls. Persists across polls.

## Mock Client Updates

Mock client accepts the region parameter but ignores it (returns same simulated data). No behavioral change for mock mode.

## Environment Variables

```env
MCP_MODE=live          # Switch from mock to live
ARCHDRUID_PATH=/path/to/archdruid   # Path to archdruid repo
DRUID_CLUSTER=all      # Default region
```

## File Changes

```
lib/types.ts           — Add DruidRegion type, region field to ClusterStatus
lib/mcp-client.ts      — Update interface, factory supports "live" mode
lib/live-client.ts     — NEW: LiveDruidClient class
lib/mock-client.ts     — Accept optional region param (no-op)
app/api/cluster/*/     — Parse ?region query param, pass to client
components/RegionSelector.tsx — NEW: Region filter pills
app/dashboard/page.tsx — Add RegionSelector, pass region to API calls
```
