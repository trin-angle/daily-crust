import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  TopPerformer,
  Bottleneck,
  DruidRegion,
} from "./types";
import type { DruidMCPClient } from "./mcp-client";

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

const DATASOURCES = [
  "wiki_edits",
  "ad_clicks",
  "event_logs",
  "user_sessions",
  "page_views",
  "search_queries",
];

export class MockDruidClient implements DruidMCPClient {
  async getClusterStatus(_region?: DruidRegion): Promise<ClusterStatus> {
    const serverCount = 12;
    const healthyCount = Math.random() > 0.1 ? serverCount : serverCount - 1;
    return {
      clusterName: "druid-prod-01",
      uptimePercent: parseFloat(rand(99.9, 99.99).toFixed(2)),
      serverCount,
      healthyServerCount: healthyCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(_region?: DruidRegion): Promise<Task[]> {
    const count = randInt(2, 5);
    return Array.from({ length: count }, (_, i) => ({
      taskId: `index_${DATASOURCES[i % DATASOURCES.length]}_${new Date().toISOString().slice(0, 10)}`,
      datasource: DATASOURCES[i % DATASOURCES.length],
      status: "RUNNING" as const,
      duration: randInt(30000, 600000),
      rowCount: randInt(100000, 10000000),
      progressPercent: randInt(10, 95),
      createdTime: new Date(Date.now() - randInt(60000, 600000)).toISOString(),
    }));
  }

  async getQueryMetrics(range: DateRange, _region?: DruidRegion): Promise<QueryMetrics> {
    const total = randInt(80000, 120000);
    const failed = randInt(20, 100);
    return {
      totalQueries: total,
      successfulQueries: total - failed,
      failedQueries: failed,
      avgQueryTimeMs: randInt(150, 400),
      queriesOverSla: randInt(100, 500),
      slaThresholdMs: 1000,
    };
  }

  async getSegmentHealth(_region?: DruidRegion): Promise<SegmentHealth[]> {
    return DATASOURCES.slice(0, 4).map((ds) => {
      const segCount = randInt(50, 800);
      const totalSize = randInt(500_000_000, 5_000_000_000);
      const avgSize = Math.floor(totalSize / segCount);
      const needsCompaction = avgSize < 100_000_000 || segCount > 500;
      return {
        datasource: ds,
        segmentCount: segCount,
        totalSizeBytes: totalSize,
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
    const now = Date.now();
    return Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(now - (19 - i) * 15000).toISOString(),
      qps: randInt(800, 1500),
    }));
  }

  async getWeeklyReport(range: DateRange, _region?: DruidRegion): Promise<WeeklyReport> {
    const metrics = await this.getQueryMetrics(range);
    const reliability = parseFloat(
      ((metrics.successfulQueries / metrics.totalQueries) * 100).toFixed(2)
    );
    const topPerformer: TopPerformer = {
      datasource: "wiki_edits",
      rowsIngested: randInt(30_000_000, 80_000_000),
      durationMs: randInt(120000, 300000),
    };
    const bottleneck: Bottleneck = {
      taskId: "index_ad_clicks_2026-02-10",
      datasource: "ad_clicks",
      durationMs: randInt(600000, 1200000),
      rowsPerSec: parseFloat(rand(5, 25).toFixed(1)),
      failureCount: randInt(1, 5),
    };
    const segments = await this.getSegmentHealth();
    return {
      clusterName: "druid-prod-01",
      dateRange: range,
      reliabilityScore: reliability,
      queryMetrics: metrics,
      topPerformer,
      bottleneck,
      segmentHealth: segments,
    };
  }
}
