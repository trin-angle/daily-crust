import { describe, it, expect, vi } from "vitest";
import { AggregatedDruidClient } from "../aggregated-client";
import type { DruidMCPClient } from "../mcp-client";
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  WeeklyReport,
} from "../types";

function mockClient(overrides: Partial<DruidMCPClient> = {}): DruidMCPClient {
  return {
    getClusterStatus: vi.fn().mockResolvedValue({
      clusterName: "cluster-a",
      uptimePercent: 100,
      serverCount: 10,
      healthyServerCount: 10,
      timestamp: new Date().toISOString(),
    } satisfies ClusterStatus),
    getActiveTasks: vi.fn().mockResolvedValue([
      {
        taskId: "task-1",
        datasource: "ds1",
        status: "RUNNING",
        duration: 60000,
        rowCount: 1000,
        progressPercent: 50,
        createdTime: new Date().toISOString(),
      },
    ] satisfies Task[]),
    getQueryMetrics: vi.fn().mockResolvedValue({
      totalQueries: 1000,
      successfulQueries: 990,
      failedQueries: 10,
      avgQueryTimeMs: 100,
      queriesOverSla: 5,
      slaThresholdMs: 1000,
    } satisfies QueryMetrics),
    getSegmentHealth: vi.fn().mockResolvedValue([
      {
        datasource: "ds1",
        segmentCount: 100,
        totalSizeBytes: 1_000_000_000,
        avgSegmentSizeBytes: 10_000_000,
        needsCompaction: true,
        reason: "Segments too small (< 100MB avg)",
      },
    ] satisfies SegmentHealth[]),
    getQueryVelocity: vi.fn().mockResolvedValue([
      { timestamp: "2026-02-23T10:00:00.000Z", qps: 1.5 },
      { timestamp: "2026-02-23T10:01:00.000Z", qps: 2.0 },
    ] satisfies QpsPoint[]),
    getWeeklyReport: vi.fn().mockResolvedValue({
      clusterName: "cluster-a",
      dateRange: { start: "2026-02-16", end: "2026-02-23" },
      reliabilityScore: 99,
      queryMetrics: {
        totalQueries: 1000,
        successfulQueries: 990,
        failedQueries: 10,
        avgQueryTimeMs: 100,
        queriesOverSla: 5,
        slaThresholdMs: 1000,
      },
      topPerformer: { datasource: "ds1", rowsIngested: 5000, durationMs: 60000 },
      bottleneck: { taskId: "task-1", datasource: "ds1", durationMs: 120000, rowsPerSec: 10, failureCount: 1 },
      segmentHealth: [],
    } satisfies WeeklyReport),
    ...overrides,
  };
}

describe("AggregatedDruidClient", () => {
  it("sums server counts across clusters", async () => {
    const c1 = mockClient();
    const c2 = mockClient({
      getClusterStatus: vi.fn().mockResolvedValue({
        clusterName: "cluster-b",
        uptimePercent: 100,
        serverCount: 20,
        healthyServerCount: 19,
        timestamp: new Date().toISOString(),
      }),
    });

    const agg = new AggregatedDruidClient([c1, c2], "music");
    const status = await agg.getClusterStatus();

    expect(status.serverCount).toBe(30);
    expect(status.healthyServerCount).toBe(29);
    expect(status.clusterName).toBe("music (all regions)");
  });

  it("concatenates tasks from all clusters", async () => {
    const c1 = mockClient();
    const c2 = mockClient({
      getActiveTasks: vi.fn().mockResolvedValue([
        {
          taskId: "task-2",
          datasource: "ds2",
          status: "RUNNING",
          duration: 30000,
          rowCount: 500,
          progressPercent: 80,
          createdTime: new Date().toISOString(),
        },
      ]),
    });

    const agg = new AggregatedDruidClient([c1, c2], "music");
    const tasks = await agg.getActiveTasks();

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.taskId)).toEqual(["task-1", "task-2"]);
  });

  it("sums query metrics with weighted avg query time", async () => {
    const c1 = mockClient();
    const c2 = mockClient({
      getQueryMetrics: vi.fn().mockResolvedValue({
        totalQueries: 2000,
        successfulQueries: 1980,
        failedQueries: 20,
        avgQueryTimeMs: 200,
        queriesOverSla: 10,
        slaThresholdMs: 1000,
      }),
    });

    const agg = new AggregatedDruidClient([c1, c2], "music");
    const metrics = await agg.getQueryMetrics({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(metrics.totalQueries).toBe(3000);
    expect(metrics.successfulQueries).toBe(2970);
    expect(metrics.failedQueries).toBe(30);
    expect(metrics.queriesOverSla).toBe(15);
    // Weighted avg: (100*1000 + 200*2000) / 3000 = 166.67 ≈ 167
    expect(metrics.avgQueryTimeMs).toBe(167);
  });

  it("concatenates segment health from all clusters", async () => {
    const c1 = mockClient();
    const c2 = mockClient({
      getSegmentHealth: vi.fn().mockResolvedValue([
        {
          datasource: "ds2",
          segmentCount: 200,
          totalSizeBytes: 2_000_000_000,
          avgSegmentSizeBytes: 10_000_000,
          needsCompaction: false,
          reason: "Healthy",
        },
      ]),
    });

    const agg = new AggregatedDruidClient([c1, c2], "music");
    const segments = await agg.getSegmentHealth();

    expect(segments).toHaveLength(2);
  });

  it("sums QPS per timestamp across clusters", async () => {
    const c1 = mockClient();
    const c2 = mockClient({
      getQueryVelocity: vi.fn().mockResolvedValue([
        { timestamp: "2026-02-23T10:00:00.000Z", qps: 3.0 },
        { timestamp: "2026-02-23T10:01:00.000Z", qps: 4.0 },
      ]),
    });

    const agg = new AggregatedDruidClient([c1, c2], "music");
    const points = await agg.getQueryVelocity();

    expect(points).toHaveLength(2);
    expect(points[0].qps).toBe(4.5);  // 1.5 + 3.0
    expect(points[1].qps).toBe(6.0);  // 2.0 + 4.0
  });

  it("returns empty array when no QPS data", async () => {
    const c1 = mockClient({
      getQueryVelocity: vi.fn().mockResolvedValue([]),
    });

    const agg = new AggregatedDruidClient([c1], "music");
    const points = await agg.getQueryVelocity();

    expect(points).toEqual([]);
  });
});
