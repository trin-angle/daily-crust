# Live Client + Region Filtering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live Druid client using archdruid CLI and multi-region filtering to the dashboard.

**Architecture:** The `DruidMCPClient` interface gains an optional `region` parameter. A new `LiveDruidClient` shells out to archdruid to query Druid system tables. The dashboard gets a `RegionSelector` component that passes the selected region through API route query params. Mock client remains the default; live mode activates via `MCP_MODE=live`.

**Tech Stack:** Next.js App Router, TypeScript, Node.js `child_process`, archdruid CLI, Vitest

---

### Task 1: Add DruidRegion type and update interfaces

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/mcp-client.ts`
- Modify: `lib/__tests__/types.test.ts`

**Step 1: Write failing test**

Add a new test case to `lib/__tests__/types.test.ts`:

```typescript
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  IngestionStats,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
} from "../types";

// Add after existing tests:
it("DruidRegion accepts valid region strings", () => {
  const regions: DruidRegion[] = [
    "osd-prod-gew1",
    "osd-prod-guc3",
    "osd-prod-gae2",
    "all",
  ];
  expect(regions).toHaveLength(4);
});

it("ClusterStatus includes optional region", () => {
  const status: ClusterStatus = {
    clusterName: "druid-prod-01",
    uptimePercent: 99.97,
    serverCount: 12,
    healthyServerCount: 12,
    timestamp: new Date().toISOString(),
    region: "osd-prod-gew1",
  };
  expect(status.region).toBe("osd-prod-gew1");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/types.test.ts`
Expected: FAIL — `DruidRegion` not exported, `region` not in `ClusterStatus`

**Step 3: Update types**

In `lib/types.ts`, add at the top:

```typescript
export type DruidRegion = "osd-prod-gew1" | "osd-prod-guc3" | "osd-prod-gae2" | "all";
```

Add `region?: DruidRegion` to `ClusterStatus`:

```typescript
export interface ClusterStatus {
  clusterName: string;
  uptimePercent: number;
  serverCount: number;
  healthyServerCount: number;
  timestamp: string;
  region?: DruidRegion;
}
```

**Step 4: Update DruidMCPClient interface**

In `lib/mcp-client.ts`, update the import and interface:

```typescript
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
} from "./types";
import { MockDruidClient } from "./mock-client";

export interface DruidMCPClient {
  getClusterStatus(region?: DruidRegion): Promise<ClusterStatus>;
  getActiveTasks(region?: DruidRegion): Promise<Task[]>;
  getQueryMetrics(range: DateRange, region?: DruidRegion): Promise<QueryMetrics>;
  getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]>;
  getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange, region?: DruidRegion): Promise<WeeklyReport>;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/types.test.ts`
Expected: PASS (all 8 tests)

**Step 6: Commit**

```bash
git add lib/types.ts lib/mcp-client.ts lib/__tests__/types.test.ts
git commit -m "feat: add DruidRegion type and region parameter to client interface"
```

---

### Task 2: Update MockDruidClient to accept region parameter

**Files:**
- Modify: `lib/mock-client.ts`
- Modify: `lib/__tests__/mock-client.test.ts`

**Step 1: Write failing test**

Add to `lib/__tests__/mock-client.test.ts`:

```typescript
it("getClusterStatus accepts optional region", async () => {
  const status = await client.getClusterStatus("osd-prod-gew1");
  expect(status.clusterName).toBe("druid-prod-01");
});

it("getActiveTasks accepts optional region", async () => {
  const tasks = await client.getActiveTasks("osd-prod-guc3");
  expect(Array.isArray(tasks)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/mock-client.test.ts`
Expected: FAIL — type error, methods don't accept region parameter

**Step 3: Update mock client method signatures**

In `lib/mock-client.ts`, update all method signatures to accept optional `DruidRegion`:

```typescript
import type { DruidRegion } from "./types";

// Update each method signature:
async getClusterStatus(_region?: DruidRegion): Promise<ClusterStatus> { ... }
async getActiveTasks(_region?: DruidRegion): Promise<Task[]> { ... }
async getQueryMetrics(range: DateRange, _region?: DruidRegion): Promise<QueryMetrics> { ... }
async getSegmentHealth(_region?: DruidRegion): Promise<SegmentHealth[]> { ... }
async getQueryVelocity(_region?: DruidRegion): Promise<QpsPoint[]> { ... }
async getWeeklyReport(range: DateRange, _region?: DruidRegion): Promise<WeeklyReport> { ... }
```

The bodies stay exactly the same — the mock ignores the region parameter.

**Step 4: Run tests**

Run: `npx vitest run lib/__tests__/mock-client.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add lib/mock-client.ts lib/__tests__/mock-client.test.ts
git commit -m "feat: accept optional region parameter in mock client"
```

---

### Task 3: Create LiveDruidClient

**Files:**
- Create: `lib/live-client.ts`
- Create: `lib/__tests__/live-client.test.ts`

**Step 1: Write test for archdruid helper**

Create `lib/__tests__/live-client.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { LiveDruidClient } from "../live-client";

// Mock child_process to avoid actually calling archdruid
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "child_process";

const mockExecFile = vi.mocked(execFile);

function mockExecResult(stdout: string) {
  mockExecFile.mockImplementation(
    (_cmd: any, _args: any, _opts: any, callback: any) => {
      callback(null, stdout, "");
      return {} as any;
    }
  );
}

describe("LiveDruidClient", () => {
  it("constructs with default config", () => {
    const client = new LiveDruidClient();
    expect(client).toBeDefined();
  });

  it("constructs with custom archdruid path and default cluster", () => {
    const client = new LiveDruidClient({
      archdruidPath: "/custom/path",
      defaultCluster: "osd-prod-guc3",
    });
    expect(client).toBeDefined();
  });

  it("getClusterStatus calls archdruid and parses response", async () => {
    const mockResponse = JSON.stringify({
      cluster: "osd-prod-gew1",
      servers: {
        total: 12,
        healthy: 12,
      },
      uptime_percent: 99.95,
    });
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const status = await client.getClusterStatus("osd-prod-gew1");

    expect(status.clusterName).toBe("osd-prod-gew1");
    expect(status.serverCount).toBe(12);
    expect(status.healthyServerCount).toBe(12);
    expect(status.uptimePercent).toBe(99.95);
    expect(status.region).toBe("osd-prod-gew1");
  });

  it("getActiveTasks calls archdruid and parses response", async () => {
    const mockResponse = JSON.stringify([
      {
        id: "index_wiki_2026-02-12",
        dataSource: "wiki_edits",
        status: "RUNNING",
        duration: 120000,
        rowCount: 5000000,
        progress: 78,
        createdTime: "2026-02-12T10:00:00Z",
      },
    ]);
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const tasks = await client.getActiveTasks("osd-prod-gew1");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("index_wiki_2026-02-12");
    expect(tasks[0].datasource).toBe("wiki_edits");
    expect(tasks[0].status).toBe("RUNNING");
  });

  it("getSegmentHealth queries sys.segments via SQL", async () => {
    const mockResponse = JSON.stringify([
      {
        datasource: "wiki_edits",
        segment_count: 200,
        total_size: 2000000000,
      },
    ]);
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const segments = await client.getSegmentHealth("osd-prod-gew1");

    expect(segments).toHaveLength(1);
    expect(segments[0].datasource).toBe("wiki_edits");
    expect(segments[0].segmentCount).toBe(200);
    expect(segments[0].avgSegmentSizeBytes).toBe(10000000);
  });

  it("throws when archdruid fails", async () => {
    mockExecFile.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(new Error("archdruid not found"), "", "command not found");
        return {} as any;
      }
    );

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    await expect(client.getClusterStatus("osd-prod-gew1")).rejects.toThrow(
      "archdruid not found"
    );
  });

  it("resolves region 'all' by querying all clusters", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callCount++;
        const response = JSON.stringify({
          cluster: `osd-prod-region${callCount}`,
          servers: { total: 4, healthy: 4 },
          uptime_percent: 99.9,
        });
        callback(null, response, "");
        return {} as any;
      }
    );

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const status = await client.getClusterStatus("all");

    // "all" should aggregate across 3 clusters
    expect(status.serverCount).toBe(12); // 4 * 3
    expect(status.healthyServerCount).toBe(12);
    expect(status.clusterName).toBe("osd-prod (all regions)");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/live-client.test.ts`
Expected: FAIL — `live-client.ts` doesn't exist

**Step 3: Create live client implementation**

Create `lib/live-client.ts`:

```typescript
import { execFile } from "child_process";
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
  TopPerformer,
  Bottleneck,
} from "./types";
import type { DruidMCPClient } from "./mcp-client";

const ALL_REGIONS: Exclude<DruidRegion, "all">[] = [
  "osd-prod-gew1",
  "osd-prod-guc3",
  "osd-prod-gae2",
];

interface LiveClientConfig {
  archdruidPath?: string;
  defaultCluster?: DruidRegion;
}

function runArchdruid(
  archdruidPath: string,
  args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "uv",
      ["run", archdruidPath, ...args],
      { timeout: 30000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(error.message || stderr));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

export class LiveDruidClient implements DruidMCPClient {
  private archdruidPath: string;
  private defaultCluster: DruidRegion;

  constructor(config?: LiveClientConfig) {
    this.archdruidPath =
      config?.archdruidPath ??
      process.env.ARCHDRUID_PATH ??
      "archdruid";
    this.defaultCluster =
      config?.defaultCluster ??
      (process.env.DRUID_CLUSTER as DruidRegion) ??
      "all";
  }

  private resolveRegion(region?: DruidRegion): DruidRegion {
    return region ?? this.defaultCluster;
  }

  private async runForRegion<T>(
    region: DruidRegion,
    fn: (cluster: Exclude<DruidRegion, "all">) => Promise<T>
  ): Promise<T[]> {
    if (region === "all") {
      return Promise.all(ALL_REGIONS.map(fn));
    }
    return [await fn(region as Exclude<DruidRegion, "all">)];
  }

  async getClusterStatus(region?: DruidRegion): Promise<ClusterStatus> {
    const resolved = this.resolveRegion(region);

    const results = await this.runForRegion(resolved, async (cluster) => {
      const raw = await runArchdruid(this.archdruidPath, [
        "cluster",
        "health",
        "--cluster",
        cluster,
        "--output",
        "json",
      ]);
      return JSON.parse(raw);
    });

    if (results.length === 1) {
      const r = results[0];
      return {
        clusterName: r.cluster,
        uptimePercent: r.uptime_percent,
        serverCount: r.servers.total,
        healthyServerCount: r.servers.healthy,
        timestamp: new Date().toISOString(),
        region: resolved === "all" ? undefined : resolved,
      };
    }

    // Aggregate across all regions
    const totalServers = results.reduce((sum, r) => sum + r.servers.total, 0);
    const healthyServers = results.reduce(
      (sum, r) => sum + r.servers.healthy,
      0
    );
    const avgUptime =
      results.reduce((sum, r) => sum + r.uptime_percent, 0) / results.length;

    return {
      clusterName: "osd-prod (all regions)",
      uptimePercent: parseFloat(avgUptime.toFixed(2)),
      serverCount: totalServers,
      healthyServerCount: healthyServers,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(region?: DruidRegion): Promise<Task[]> {
    const resolved = this.resolveRegion(region);

    const results = await this.runForRegion(resolved, async (cluster) => {
      const raw = await runArchdruid(this.archdruidPath, [
        "tasks",
        "list",
        "--cluster",
        cluster,
        "--state",
        "RUNNING",
        "--output",
        "json",
      ]);
      return JSON.parse(raw) as any[];
    });

    return results.flat().map((t) => ({
      taskId: t.id,
      datasource: t.dataSource,
      status: t.status as Task["status"],
      duration: t.duration ?? 0,
      rowCount: t.rowCount ?? 0,
      progressPercent: t.progress ?? 0,
      createdTime: t.createdTime,
    }));
  }

  async getQueryMetrics(
    range: DateRange,
    region?: DruidRegion
  ): Promise<QueryMetrics> {
    const resolved = this.resolveRegion(region);
    const cluster =
      resolved === "all" ? ALL_REGIONS[0] : resolved;

    const query = `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed FROM sys.tasks WHERE created_time >= '${range.start}' AND created_time <= '${range.end}'`;

    const raw = await runArchdruid(this.archdruidPath, [
      "query",
      "run",
      "--cluster",
      cluster,
      "--query",
      query,
      "--output",
      "json",
    ]);
    const rows = JSON.parse(raw);
    const r = rows[0] ?? { total: 0, successful: 0, failed: 0 };

    return {
      totalQueries: r.total,
      successfulQueries: r.successful,
      failedQueries: r.failed,
      avgQueryTimeMs: 0,
      queriesOverSla: 0,
      slaThresholdMs: 1000,
    };
  }

  async getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]> {
    const resolved = this.resolveRegion(region);
    const cluster =
      resolved === "all" ? ALL_REGIONS[0] : resolved;

    const query = `SELECT datasource, COUNT(*) as segment_count, SUM("size") as total_size FROM sys.segments WHERE is_active = 1 GROUP BY datasource`;

    const raw = await runArchdruid(this.archdruidPath, [
      "query",
      "run",
      "--cluster",
      cluster,
      "--query",
      query,
      "--output",
      "json",
    ]);
    const rows = JSON.parse(raw) as any[];

    return rows.map((r) => {
      const avgSize = Math.floor(r.total_size / r.segment_count);
      const needsCompaction = avgSize < 100_000_000 || r.segment_count > 500;
      return {
        datasource: r.datasource,
        segmentCount: r.segment_count,
        totalSizeBytes: r.total_size,
        avgSegmentSizeBytes: avgSize,
        needsCompaction,
        reason: needsCompaction
          ? avgSize < 100_000_000
            ? "Segments too small (< 100MB avg)"
            : "High segment count (> 500)"
          : "Healthy",
      };
    });
  }

  async getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]> {
    // QPS is synthesized — there's no native sys table for real-time QPS.
    // Return empty array; the dashboard handles empty gracefully.
    return [];
  }

  async getWeeklyReport(
    range: DateRange,
    region?: DruidRegion
  ): Promise<WeeklyReport> {
    const [metrics, segments, tasks] = await Promise.all([
      this.getQueryMetrics(range, region),
      this.getSegmentHealth(region),
      this.getActiveTasks(region),
    ]);

    const reliability =
      metrics.totalQueries > 0
        ? parseFloat(
            (
              (metrics.successfulQueries / metrics.totalQueries) *
              100
            ).toFixed(2)
          )
        : 100;

    const topPerformer: TopPerformer = tasks.length > 0
      ? {
          datasource: tasks.sort((a, b) => b.rowCount - a.rowCount)[0].datasource,
          rowsIngested: tasks[0].rowCount,
          durationMs: tasks[0].duration,
        }
      : { datasource: "N/A", rowsIngested: 0, durationMs: 0 };

    const bottleneck: Bottleneck = tasks.length > 0
      ? {
          taskId: tasks.sort((a, b) => a.progressPercent - b.progressPercent)[0].taskId,
          datasource: tasks[0].datasource,
          durationMs: tasks[0].duration,
          rowsPerSec: tasks[0].duration > 0
            ? parseFloat((tasks[0].rowCount / (tasks[0].duration / 1000)).toFixed(1))
            : 0,
          failureCount: 0,
        }
      : { taskId: "N/A", datasource: "N/A", durationMs: 0, rowsPerSec: 0, failureCount: 0 };

    const resolved = region ?? this.defaultCluster;

    return {
      clusterName: resolved === "all" ? "osd-prod (all regions)" : resolved,
      dateRange: range,
      reliabilityScore: reliability,
      queryMetrics: metrics,
      topPerformer,
      bottleneck,
      segmentHealth: segments,
    };
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run lib/__tests__/live-client.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add lib/live-client.ts lib/__tests__/live-client.test.ts
git commit -m "feat: add LiveDruidClient using archdruid CLI"
```

---

### Task 4: Update mcp-client factory for live mode

**Files:**
- Modify: `lib/mcp-client.ts`

**Step 1: Write failing test**

Add to `lib/__tests__/mock-client.test.ts` (rename file would be ideal, but keep it simple):

```typescript
it("createMCPClient('live') returns a LiveDruidClient", async () => {
  // Set env to avoid archdruid not-found error
  const client = createMCPClient("live");
  expect(client).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/mock-client.test.ts`
Expected: FAIL — `Unknown MCP_MODE: live`

**Step 3: Update factory**

In `lib/mcp-client.ts`, add the live client import and case:

```typescript
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
} from "./types";
import { MockDruidClient } from "./mock-client";
import { LiveDruidClient } from "./live-client";

export interface DruidMCPClient {
  getClusterStatus(region?: DruidRegion): Promise<ClusterStatus>;
  getActiveTasks(region?: DruidRegion): Promise<Task[]>;
  getQueryMetrics(range: DateRange, region?: DruidRegion): Promise<QueryMetrics>;
  getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]>;
  getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange, region?: DruidRegion): Promise<WeeklyReport>;
}

export function createMCPClient(mode?: string): DruidMCPClient {
  const resolvedMode = mode ?? process.env.MCP_MODE ?? "mock";
  if (resolvedMode === "mock") {
    return new MockDruidClient();
  }
  if (resolvedMode === "live") {
    return new LiveDruidClient();
  }
  throw new Error(
    `Unknown MCP_MODE: ${resolvedMode}. Supported: "mock", "live".`
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run lib/__tests__/mock-client.test.ts`
Expected: PASS (all 9 tests)

**Step 5: Commit**

```bash
git add lib/mcp-client.ts lib/__tests__/mock-client.test.ts
git commit -m "feat: add live mode to MCP client factory"
```

---

### Task 5: Update API routes to accept region query parameter

**Files:**
- Modify: `app/api/cluster/status/route.ts`
- Modify: `app/api/cluster/tasks/route.ts`
- Modify: `app/api/cluster/qps/route.ts`

**Step 1: Update status route**

Replace `app/api/cluster/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";
import type { DruidRegion } from "@/lib/types";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") as DruidRegion | null;
  const client = createMCPClient();
  const status = await client.getClusterStatus(region ?? undefined);
  return NextResponse.json(status);
}
```

**Step 2: Update tasks route**

Replace `app/api/cluster/tasks/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";
import type { DruidRegion } from "@/lib/types";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") as DruidRegion | null;
  const client = createMCPClient();
  const tasks = await client.getActiveTasks(region ?? undefined);
  return NextResponse.json(tasks);
}
```

**Step 3: Update qps route**

Replace `app/api/cluster/qps/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";
import type { DruidRegion } from "@/lib/types";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") as DruidRegion | null;
  const client = createMCPClient();
  const qps = await client.getQueryVelocity(region ?? undefined);
  return NextResponse.json(qps);
}
```

**Step 4: Run full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add app/api/cluster/status/route.ts app/api/cluster/tasks/route.ts app/api/cluster/qps/route.ts
git commit -m "feat: accept region query parameter in API routes"
```

---

### Task 6: Create RegionSelector component

**Files:**
- Create: `components/RegionSelector.tsx`
- Create: `components/__tests__/RegionSelector.test.tsx`

**Step 1: Write failing test**

Create `components/__tests__/RegionSelector.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegionSelector } from "../RegionSelector";

describe("RegionSelector", () => {
  it("renders all region options", () => {
    render(<RegionSelector selected="all" onSelect={vi.fn()} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("GEW1")).toBeInTheDocument();
    expect(screen.getByText("GUC3")).toBeInTheDocument();
    expect(screen.getByText("GAE2")).toBeInTheDocument();
  });

  it("highlights the selected region", () => {
    render(<RegionSelector selected="osd-prod-gew1" onSelect={vi.fn()} />);
    const gew1Button = screen.getByText("GEW1");
    expect(gew1Button.className).toContain("bg-brand-green");
  });

  it("calls onSelect when a region is clicked", () => {
    const onSelect = vi.fn();
    render(<RegionSelector selected="all" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GUC3"));
    expect(onSelect).toHaveBeenCalledWith("osd-prod-guc3");
  });

  it("does not highlight unselected regions", () => {
    render(<RegionSelector selected="osd-prod-gew1" onSelect={vi.fn()} />);
    const allButton = screen.getByText("All");
    expect(allButton.className).not.toContain("bg-brand-green");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/RegionSelector.test.tsx`
Expected: FAIL — module not found

**Step 3: Create component**

Create `components/RegionSelector.tsx`:

```tsx
"use client";

import type { DruidRegion } from "@/lib/types";

const REGIONS: { value: DruidRegion; label: string }[] = [
  { value: "all", label: "All" },
  { value: "osd-prod-gew1", label: "GEW1" },
  { value: "osd-prod-guc3", label: "GUC3" },
  { value: "osd-prod-gae2", label: "GAE2" },
];

interface RegionSelectorProps {
  selected: DruidRegion;
  onSelect: (region: DruidRegion) => void;
}

export function RegionSelector({ selected, onSelect }: RegionSelectorProps) {
  return (
    <div className="flex gap-1">
      {REGIONS.map((region) => (
        <button
          key={region.value}
          onClick={() => onSelect(region.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === region.value
              ? "bg-brand-green text-surface-base"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
          }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run components/__tests__/RegionSelector.test.tsx`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add components/RegionSelector.tsx components/__tests__/RegionSelector.test.tsx
git commit -m "feat: add RegionSelector component"
```

---

### Task 7: Integrate RegionSelector into dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Update dashboard page**

Add RegionSelector state and pass region to all fetch calls.

In `app/dashboard/page.tsx`:

1. Add imports:
```typescript
import { RegionSelector } from "@/components/RegionSelector";
import type { ClusterStatus, Task, QpsPoint, DruidRegion } from "@/lib/types";
```

2. Add region state:
```typescript
const [region, setRegion] = useState<DruidRegion>("all");
```

3. Update fetchData to include region parameter and depend on it:
```typescript
const fetchData = useCallback(async () => {
  const params = region !== "all" ? `?region=${region}` : "";
  const [statusRes, tasksRes, qpsRes] = await Promise.all([
    fetch(`/api/cluster/status${params}`),
    fetch(`/api/cluster/tasks${params}`),
    fetch(`/api/cluster/qps${params}`),
  ]);
  setStatus(await statusRes.json());
  setTasks(await tasksRes.json());
  setQps(await qpsRes.json());
  setLastUpdated(new Date());
  setSecondsAgo(0);
}, [region]);
```

4. Add RegionSelector to the JSX, above the metric tiles:
```tsx
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold">Live Dashboard</h2>
    <RegionSelector selected={region} onSelect={setRegion} />
  </div>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {/* ... existing MetricTile cards ... */}
  </div>
  {/* ... rest unchanged ... */}
</div>
```

The full updated file:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { MetricTile } from "@/components/MetricTile";
import { QpsChart } from "@/components/QpsChart";
import { IngestionList } from "@/components/IngestionList";
import { RegionSelector } from "@/components/RegionSelector";
import type { ClusterStatus, Task, QpsPoint, DruidRegion } from "@/lib/types";

const POLL_INTERVAL = 15000;

function getUptimeStatus(pct: number): "success" | "warning" | "error" {
  if (pct >= 99.9) return "success";
  if (pct >= 99.5) return "warning";
  return "error";
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ClusterStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [qps, setQps] = useState<QpsPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [region, setRegion] = useState<DruidRegion>("all");

  const fetchData = useCallback(async () => {
    const params = region !== "all" ? `?region=${region}` : "";
    const [statusRes, tasksRes, qpsRes] = await Promise.all([
      fetch(`/api/cluster/status${params}`),
      fetch(`/api/cluster/tasks${params}`),
      fetch(`/api/cluster/qps${params}`),
    ]);
    setStatus(await statusRes.json());
    setTasks(await tasksRes.json());
    setQps(await qpsRes.json());
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, [region]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const currentQps = qps.length > 0 ? qps[qps.length - 1].qps : 0;
  const runningTasks = tasks.filter((t) => t.status === "RUNNING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Live Dashboard</h2>
        <RegionSelector selected={region} onSelect={setRegion} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricTile
          label="Uptime"
          value={status ? `${status.uptimePercent}%` : "---"}
          subtitle={
            status
              ? `${status.healthyServerCount}/${status.serverCount} servers`
              : undefined
          }
          status={status ? getUptimeStatus(status.uptimePercent) : "neutral"}
        />
        <MetricTile
          label="Query Velocity"
          value={currentQps ? `${currentQps.toLocaleString()}/s` : "---"}
          status="neutral"
        >
          <QpsChart data={qps} />
        </MetricTile>
        <MetricTile
          label="Active Tasks"
          value={String(runningTasks.length)}
          subtitle={
            tasks.length !== runningTasks.length
              ? `${tasks.length - runningTasks.length} other`
              : undefined
          }
          status="neutral"
        />
      </div>

      <IngestionList tasks={runningTasks} />

      <div className="flex items-center justify-end gap-2 text-xs text-text-secondary">
        <span className="inline-block w-2 h-2 rounded-full bg-brand-green animate-pulse" />
        <span>
          Last updated: {secondsAgo}s ago
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Run dev server and verify visually**

Run: `npm run dev`
Verify: RegionSelector pills appear above metric tiles on `/dashboard`

**Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add region selector to live dashboard"
```

---

### Task 8: Run all tests and build

**Files:** None (verification only)

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (should be ~46 tests across 11 files)

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit if any fixes were needed**

If tests or build revealed issues, fix and commit.
