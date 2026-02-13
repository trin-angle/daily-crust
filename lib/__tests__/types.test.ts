import { describe, it, expect } from "vitest";
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  IngestionStats,
  QpsPoint,
  DateRange,
  WeeklyReport,
} from "../types";

describe("types", () => {
  it("ClusterStatus satisfies shape", () => {
    const status: ClusterStatus = {
      clusterName: "druid-prod-01",
      uptimePercent: 99.97,
      serverCount: 12,
      healthyServerCount: 12,
      timestamp: new Date().toISOString(),
    };
    expect(status.clusterName).toBe("druid-prod-01");
  });

  it("Task satisfies shape", () => {
    const task: Task = {
      taskId: "index_wiki_2024-01-01",
      datasource: "wiki_edits",
      status: "RUNNING",
      duration: 120000,
      rowCount: 5000000,
      progressPercent: 78,
      createdTime: new Date().toISOString(),
    };
    expect(task.status).toBe("RUNNING");
  });

  it("QueryMetrics satisfies shape", () => {
    const metrics: QueryMetrics = {
      totalQueries: 100000,
      successfulQueries: 99940,
      failedQueries: 60,
      avgQueryTimeMs: 245,
      queriesOverSla: 312,
      slaThresholdMs: 1000,
    };
    expect(metrics.totalQueries).toBe(100000);
  });

  it("SegmentHealth satisfies shape", () => {
    const segment: SegmentHealth = {
      datasource: "event_logs",
      segmentCount: 450,
      totalSizeBytes: 1_200_000_000,
      avgSegmentSizeBytes: 2_666_666,
      needsCompaction: true,
      reason: "Segment count high relative to total size",
    };
    expect(segment.needsCompaction).toBe(true);
  });

  it("QpsPoint satisfies shape", () => {
    const point: QpsPoint = {
      timestamp: new Date().toISOString(),
      qps: 1247,
    };
    expect(point.qps).toBe(1247);
  });

  it("WeeklyReport satisfies shape", () => {
    const report: WeeklyReport = {
      clusterName: "druid-prod-01",
      dateRange: {
        start: "2026-02-05T00:00:00Z",
        end: "2026-02-12T00:00:00Z",
      },
      reliabilityScore: 99.94,
      queryMetrics: {
        totalQueries: 100000,
        successfulQueries: 99940,
        failedQueries: 60,
        avgQueryTimeMs: 245,
        queriesOverSla: 312,
        slaThresholdMs: 1000,
      },
      topPerformer: {
        datasource: "wiki_edits",
        rowsIngested: 50_000_000,
        durationMs: 180000,
      },
      bottleneck: {
        taskId: "index_ad_clicks_2026-02-10",
        datasource: "ad_clicks",
        durationMs: 900000,
        rowsPerSec: 12.5,
        failureCount: 3,
      },
      segmentHealth: [],
    };
    expect(report.reliabilityScore).toBe(99.94);
  });
});
