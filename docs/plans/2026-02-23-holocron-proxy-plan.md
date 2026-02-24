# Holocron Proxy Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the subprocess-based LiveDruidClient with a gRPC client that queries Druid through the holocron proxy, using SQL against system tables for all data.

**Architecture:** A thin `HolocronGrpcClient` wraps `@grpc/grpc-js` to call the holocron proxy's `Proxy` RPC with SQL queries. The existing `LiveDruidClient` is rewritten to use this client instead of shelling out to archdruid. The `DruidMCPClient` interface and all UI code remain unchanged.

**Tech Stack:** TypeScript, @grpc/grpc-js, @grpc/proto-loader, protobuf, Vitest

---

### Task 1: Install gRPC dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run: `npm install @grpc/grpc-js @grpc/proto-loader`

**Step 2: Verify installation**

Run: `node -e "require('@grpc/grpc-js'); require('@grpc/proto-loader'); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add gRPC dependencies for holocron proxy"
```

---

### Task 2: Add protobuf definitions

**Files:**
- Create: `lib/protos/query.proto`
- Create: `lib/protos/holocronproxy.proto`

**Step 1: Create query.proto**

Copy from `~/Projects/archdruid/src/protos/query.proto` as-is. This is the Apache-licensed Druid gRPC protocol defining `QueryRequest`, `QueryResponse`, and related types.

**Step 2: Create holocronproxy.proto**

Copy from `~/Projects/archdruid/src/protos/holocronproxy.proto` but fix the import path. The original imports `archdruid/generated/query.proto` — change this to `query.proto` since both files will be siblings in `lib/protos/`.

```protobuf
syntax = "proto3";
package spotify.holocron.v1;

import "query.proto";

option java_package = "com.spotify.holocron.schema.v1";
option java_multiple_files = true;
option java_outer_classname = "HolocronProxy";

service HolocronProxyService {
  rpc Proxy (druidGrpc.QueryRequest) returns (druidGrpc.QueryResponse) {}
  rpc LaneOneProxy (druidGrpc.QueryRequest) returns (druidGrpc.QueryResponse) {}
}
```

**Step 3: Verify proto loading**

Run:
```bash
node -e "
const loader = require('@grpc/proto-loader');
const def = loader.loadSync('lib/protos/holocronproxy.proto', {
  keepCase: true,
  longs: String,
  defaults: true,
  includeDirs: ['lib/protos']
});
console.log(Object.keys(def).filter(k => k.includes('Holocron')));
"
```
Expected: Array containing `spotify.holocron.v1.HolocronProxyService`

**Step 4: Commit**

```bash
git add lib/protos/query.proto lib/protos/holocronproxy.proto
git commit -m "feat: add protobuf definitions for holocron proxy"
```

---

### Task 3: Create HolocronGrpcClient with tests

**Files:**
- Create: `lib/grpc-client.ts`
- Create: `lib/__tests__/grpc-client.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/grpc-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HolocronGrpcClient } from "../grpc-client";

// Mock @grpc/grpc-js and @grpc/proto-loader
const mockProxy = vi.fn();
const mockServiceConstructor = vi.fn().mockImplementation(() => ({
  Proxy: mockProxy,
}));

vi.mock("@grpc/grpc-js", () => ({
  loadPackageDefinition: vi.fn().mockReturnValue({
    spotify: {
      holocron: {
        v1: {
          HolocronProxyService: mockServiceConstructor,
        },
      },
    },
  }),
  credentials: {
    createInsecure: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@grpc/proto-loader", () => ({
  loadSync: vi.fn().mockReturnValue({}),
}));

describe("HolocronGrpcClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with host config", () => {
    const client = new HolocronGrpcClient({
      host: "localhost:50051",
    });
    expect(client).toBeDefined();
    expect(mockServiceConstructor).toHaveBeenCalledWith(
      "localhost:50051",
      expect.anything()
    );
  });

  it("query sends SQL and returns parsed JSON rows", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(null, {
          status: 1, // OK
          columns: [{ name: "cnt", sqlType: "BIGINT", druidType: 2 }],
          data: Buffer.from(JSON.stringify([{ cnt: 42 }])),
        });
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    const rows = await client.query("SELECT COUNT(*) as cnt FROM sys.servers");

    expect(rows).toEqual([{ cnt: 42 }]);
    expect(mockProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "SELECT COUNT(*) as cnt FROM sys.servers",
        resultFormat: 3, // JSON_ARRAY
        queryType: 0, // SQL
      }),
      expect.anything(),
      expect.any(Function)
    );
  });

  it("query rejects on gRPC error", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(new Error("connection refused"), null);
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    await expect(
      client.query("SELECT 1")
    ).rejects.toThrow("connection refused");
  });

  it("query rejects on non-OK status", async () => {
    mockProxy.mockImplementation(
      (request: any, options: any, callback: any) => {
        callback(null, {
          status: 4, // INVALID_SQL
          errorMessage: "Unknown table sys.nope",
          data: null,
        });
      }
    );

    const client = new HolocronGrpcClient({ host: "localhost:50051" });
    await expect(
      client.query("SELECT * FROM sys.nope")
    ).rejects.toThrow("Unknown table sys.nope");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/grpc-client.test.ts`
Expected: FAIL — `grpc-client` module not found

**Step 3: Write the implementation**

```typescript
// lib/grpc-client.ts
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

export interface HolocronConfig {
  host: string;
}

export class HolocronGrpcClient {
  private client: any;

  constructor(config: HolocronConfig) {
    const protoPath = path.resolve(
      process.cwd(),
      "lib/protos/holocronproxy.proto"
    );
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      defaults: true,
      includeDirs: [path.resolve(process.cwd(), "lib/protos")],
    });
    const proto = grpc.loadPackageDefinition(packageDef) as any;
    const Service = proto.spotify.holocron.v1.HolocronProxyService;
    this.client = new Service(config.host, grpc.credentials.createInsecure());
  }

  async query(sql: string): Promise<any[]> {
    const request = {
      query: sql,
      resultFormat: 3, // JSON_ARRAY
      context: {},
      queryType: 0, // SQL
    };

    return new Promise((resolve, reject) => {
      this.client.Proxy(
        request,
        { deadline: Date.now() + 10_000 },
        (err: Error | null, response: any) => {
          if (err) return reject(err);
          if (response.status !== 1) {
            return reject(
              new Error(response.errorMessage || "Query failed")
            );
          }
          const data = response.data
            ? JSON.parse(response.data.toString())
            : [];
          resolve(data);
        }
      );
    });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/grpc-client.test.ts`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add lib/grpc-client.ts lib/__tests__/grpc-client.test.ts
git commit -m "feat: add HolocronGrpcClient with gRPC query support"
```

---

### Task 4: Rewrite LiveDruidClient to use gRPC

**Files:**
- Modify: `lib/live-client.ts` (full rewrite)
- Modify: `lib/__tests__/live-client.test.ts` (full rewrite)

**Step 1: Write the failing tests**

Replace the entire test file. The new tests mock `HolocronGrpcClient` instead of `child_process`.

```typescript
// lib/__tests__/live-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveDruidClient } from "../live-client";

const mockQuery = vi.fn();

vi.mock("../grpc-client", () => ({
  HolocronGrpcClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

describe("LiveDruidClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with default config", () => {
    const client = new LiveDruidClient();
    expect(client).toBeDefined();
  });

  it("getClusterStatus queries sys.servers and maps result", async () => {
    mockQuery.mockResolvedValue([
      { server: "hist1:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "hist2:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "broker1:8082", server_type: "broker", curr_size: 0, max_size: 0 },
    ]);

    const client = new LiveDruidClient();
    const status = await client.getClusterStatus();

    expect(status.serverCount).toBe(3);
    expect(status.healthyServerCount).toBe(3);
    expect(status.clusterName).toContain("holocron");
    expect(status.timestamp).toBeDefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("sys.servers")
    );
  });

  it("getActiveTasks queries sys.tasks for RUNNING", async () => {
    mockQuery.mockResolvedValue([
      {
        task_id: "index_wiki_2026-02-23",
        datasource: "wiki_edits",
        status: "RUNNING",
        created_time: "2026-02-23T10:00:00.000Z",
        duration: 120000,
        error_msg: null,
      },
    ]);

    const client = new LiveDruidClient();
    const tasks = await client.getActiveTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("index_wiki_2026-02-23");
    expect(tasks[0].datasource).toBe("wiki_edits");
    expect(tasks[0].status).toBe("RUNNING");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("RUNNING")
    );
  });

  it("getSegmentHealth queries sys.segments grouped by datasource", async () => {
    mockQuery.mockResolvedValue([
      { datasource: "wiki_edits", segment_count: 200, total_size: 2000000000 },
    ]);

    const client = new LiveDruidClient();
    const segments = await client.getSegmentHealth();

    expect(segments).toHaveLength(1);
    expect(segments[0].datasource).toBe("wiki_edits");
    expect(segments[0].segmentCount).toBe(200);
    expect(segments[0].totalSizeBytes).toBe(2000000000);
    expect(segments[0].avgSegmentSizeBytes).toBe(10000000);
    expect(segments[0].needsCompaction).toBe(true); // avg < 100MB
  });

  it("getQueryMetrics queries sys.tasks for date range", async () => {
    mockQuery.mockResolvedValue([
      { total: 100, successful: 95, failed: 5, avg_duration: 500 },
    ]);

    const client = new LiveDruidClient();
    const metrics = await client.getQueryMetrics({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(metrics.totalQueries).toBe(100);
    expect(metrics.successfulQueries).toBe(95);
    expect(metrics.failedQueries).toBe(5);
  });

  it("getQueryVelocity returns empty array (no sys table for QPS)", async () => {
    const client = new LiveDruidClient();
    const points = await client.getQueryVelocity();

    expect(points).toEqual([]);
  });

  it("getWeeklyReport aggregates metrics, segments, and tasks", async () => {
    // First call: getQueryMetrics
    mockQuery.mockResolvedValueOnce([
      { total: 100, successful: 95, failed: 5, avg_duration: 500 },
    ]);
    // Second call: getSegmentHealth
    mockQuery.mockResolvedValueOnce([
      { datasource: "wiki_edits", segment_count: 200, total_size: 2000000000 },
    ]);
    // Third call: getActiveTasks
    mockQuery.mockResolvedValueOnce([
      {
        task_id: "index_wiki",
        datasource: "wiki_edits",
        status: "RUNNING",
        created_time: "2026-02-23T10:00:00.000Z",
        duration: 120000,
        error_msg: null,
      },
    ]);

    const client = new LiveDruidClient();
    const report = await client.getWeeklyReport({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(report.reliabilityScore).toBe(95);
    expect(report.queryMetrics.totalQueries).toBe(100);
    expect(report.segmentHealth).toHaveLength(1);
  });

  it("rejects when gRPC query fails", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const client = new LiveDruidClient();
    await expect(client.getClusterStatus()).rejects.toThrow(
      "connection refused"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/live-client.test.ts`
Expected: FAIL — LiveDruidClient still uses old child_process approach

**Step 3: Rewrite the implementation**

Replace the entire `lib/live-client.ts`:

```typescript
// lib/live-client.ts
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
import { HolocronGrpcClient } from "./grpc-client";

interface LiveClientConfig {
  holocronHost?: string;
}

export class LiveDruidClient implements DruidMCPClient {
  private grpc: HolocronGrpcClient;

  constructor(config?: LiveClientConfig) {
    const host =
      config?.holocronHost ??
      process.env.HOLOCRON_PROXY_HOST ??
      "holocron-proxy-service:50051";
    this.grpc = new HolocronGrpcClient({ host });
  }

  async getClusterStatus(_region?: DruidRegion): Promise<ClusterStatus> {
    const rows = await this.grpc.query(
      `SELECT server, server_type, curr_size, max_size FROM sys.servers`
    );

    const serverCount = rows.length;
    const healthyServerCount = rows.filter(
      (r: any) => r.max_size === 0 || r.curr_size < r.max_size
    ).length;
    const uptimePercent =
      serverCount > 0
        ? parseFloat(
            ((healthyServerCount / serverCount) * 100).toFixed(2)
          )
        : 0;

    return {
      clusterName: "holocron-proxy",
      uptimePercent,
      serverCount,
      healthyServerCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(_region?: DruidRegion): Promise<Task[]> {
    const rows = await this.grpc.query(
      `SELECT task_id, datasource, status, created_time, duration, error_msg FROM sys.tasks WHERE status = 'RUNNING' ORDER BY created_time DESC`
    );

    return rows.map((r: any) => ({
      taskId: r.task_id,
      datasource: r.datasource,
      status: r.status as Task["status"],
      duration: r.duration ?? 0,
      rowCount: 0,
      progressPercent: 0,
      createdTime: r.created_time,
    }));
  }

  async getQueryMetrics(
    range: DateRange,
    _region?: DruidRegion
  ): Promise<QueryMetrics> {
    const rows = await this.grpc.query(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful, SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed, AVG(duration) as avg_duration FROM sys.tasks WHERE created_time >= '${range.start}' AND created_time <= '${range.end}'`
    );
    const r = rows[0] ?? { total: 0, successful: 0, failed: 0, avg_duration: 0 };

    return {
      totalQueries: r.total,
      successfulQueries: r.successful,
      failedQueries: r.failed,
      avgQueryTimeMs: Math.round(r.avg_duration ?? 0),
      queriesOverSla: 0,
      slaThresholdMs: 1000,
    };
  }

  async getSegmentHealth(_region?: DruidRegion): Promise<SegmentHealth[]> {
    const rows = await this.grpc.query(
      `SELECT datasource, COUNT(*) as segment_count, SUM("size") as total_size FROM sys.segments WHERE is_active = 1 GROUP BY datasource ORDER BY total_size DESC`
    );

    return rows.map((r: any) => {
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

  async getQueryVelocity(_region?: DruidRegion): Promise<QpsPoint[]> {
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

    const sortedByRows = [...tasks].sort((a, b) => b.rowCount - a.rowCount);
    const topPerformer: TopPerformer =
      sortedByRows.length > 0
        ? {
            datasource: sortedByRows[0].datasource,
            rowsIngested: sortedByRows[0].rowCount,
            durationMs: sortedByRows[0].duration,
          }
        : { datasource: "N/A", rowsIngested: 0, durationMs: 0 };

    const sortedByProgress = [...tasks].sort(
      (a, b) => a.progressPercent - b.progressPercent
    );
    const bottleneck: Bottleneck =
      sortedByProgress.length > 0
        ? {
            taskId: sortedByProgress[0].taskId,
            datasource: sortedByProgress[0].datasource,
            durationMs: sortedByProgress[0].duration,
            rowsPerSec:
              sortedByProgress[0].duration > 0
                ? parseFloat(
                    (
                      sortedByProgress[0].rowCount /
                      (sortedByProgress[0].duration / 1000)
                    ).toFixed(1)
                  )
                : 0,
            failureCount: 0,
          }
        : {
            taskId: "N/A",
            datasource: "N/A",
            durationMs: 0,
            rowsPerSec: 0,
            failureCount: 0,
          };

    return {
      clusterName: "holocron-proxy",
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

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/live-client.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add lib/live-client.ts lib/__tests__/live-client.test.ts
git commit -m "feat: rewrite LiveDruidClient to use holocron proxy gRPC"
```

---

### Task 5: Update config and client factory

**Files:**
- Modify: `lib/mcp-client.ts` (remove old import if needed)
- Modify: `.env.local`

**Step 1: Update .env.local**

```env
MCP_MODE=mock
HOLOCRON_PROXY_HOST=holocron-proxy-service:50051
```

The `ARCHDRUID_PATH` and `DRUID_CLUSTER` vars are no longer used.

**Step 2: Verify factory still works**

The `createMCPClient` function in `mcp-client.ts` already imports `LiveDruidClient` and constructs it — no changes needed since the constructor is still zero-arg compatible.

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add .env.local
git commit -m "chore: update env config for holocron proxy"
```

---

### Task 6: Smoke test with live proxy

**Files:** None (manual verification)

**Step 1: Switch to live mode**

Set `MCP_MODE=live` in `.env.local`.

**Step 2: Start dev server**

Run: `npm run dev`

**Step 3: Test API endpoints**

Open in browser or curl:
- `http://localhost:3000/api/cluster/status`
- `http://localhost:3000/api/cluster/tasks`
- `http://localhost:3000/api/cluster/qps`

**Step 4: Check dashboard**

Open `http://localhost:3000/dashboard` and verify real data appears.

**Step 5: Switch back to mock if needed**

Set `MCP_MODE=mock` in `.env.local` if the proxy isn't reachable from your local machine.

**Step 6: Commit any fixes from smoke testing**

```bash
git add -p
git commit -m "fix: address issues found during live smoke test"
```
