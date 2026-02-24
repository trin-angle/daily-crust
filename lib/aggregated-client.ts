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

export class AggregatedDruidClient implements DruidMCPClient {
  private clients: DruidMCPClient[];
  private productName: string;

  constructor(clients: DruidMCPClient[], productName: string) {
    this.clients = clients;
    this.productName = productName;
  }

  async getClusterStatus(_region?: DruidRegion): Promise<ClusterStatus> {
    const results = await Promise.all(
      this.clients.map((c) => c.getClusterStatus())
    );

    const serverCount = results.reduce((sum, r) => sum + r.serverCount, 0);
    const healthyServerCount = results.reduce(
      (sum, r) => sum + r.healthyServerCount,
      0
    );
    const uptimePercent =
      serverCount > 0
        ? parseFloat(
            ((healthyServerCount / serverCount) * 100).toFixed(2)
          )
        : 0;

    return {
      clusterName: `${this.productName} (all regions)`,
      uptimePercent,
      serverCount,
      healthyServerCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(_region?: DruidRegion): Promise<Task[]> {
    const results = await Promise.all(
      this.clients.map((c) => c.getActiveTasks())
    );
    return results.flat();
  }

  async getQueryMetrics(
    range: DateRange,
    _region?: DruidRegion
  ): Promise<QueryMetrics> {
    const results = await Promise.all(
      this.clients.map((c) => c.getQueryMetrics(range))
    );

    const totalQueries = results.reduce((s, r) => s + r.totalQueries, 0);
    const successfulQueries = results.reduce(
      (s, r) => s + r.successfulQueries,
      0
    );
    const failedQueries = results.reduce((s, r) => s + r.failedQueries, 0);
    const queriesOverSla = results.reduce((s, r) => s + r.queriesOverSla, 0);

    // Weighted average of query time by total queries
    const avgQueryTimeMs =
      totalQueries > 0
        ? Math.round(
            results.reduce(
              (s, r) => s + r.avgQueryTimeMs * r.totalQueries,
              0
            ) / totalQueries
          )
        : 0;

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      avgQueryTimeMs,
      queriesOverSla,
      slaThresholdMs: results[0]?.slaThresholdMs ?? 1000,
    };
  }

  async getSegmentHealth(_region?: DruidRegion): Promise<SegmentHealth[]> {
    const results = await Promise.all(
      this.clients.map((c) => c.getSegmentHealth())
    );
    return results.flat();
  }

  async getQueryVelocity(_region?: DruidRegion): Promise<QpsPoint[]> {
    const results = await Promise.all(
      this.clients.map((c) => c.getQueryVelocity())
    );

    if (results.length === 0) return [];

    // Sum QPS values per timestamp across all clusters
    const byTimestamp = new Map<string, number>();
    for (const points of results) {
      for (const p of points) {
        byTimestamp.set(p.timestamp, (byTimestamp.get(p.timestamp) ?? 0) + p.qps);
      }
    }

    return Array.from(byTimestamp.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, qps]) => ({
        timestamp,
        qps: parseFloat(qps.toFixed(2)),
      }));
  }

  async getWeeklyReport(
    range: DateRange,
    _region?: DruidRegion
  ): Promise<WeeklyReport> {
    const reports = await Promise.all(
      this.clients.map((c) => c.getWeeklyReport(range))
    );

    const metrics = await this.getQueryMetrics(range);

    const reliability =
      metrics.totalQueries > 0
        ? parseFloat(
            (
              (metrics.successfulQueries / metrics.totalQueries) *
              100
            ).toFixed(2)
          )
        : 100;

    const allSegments = reports.flatMap((r) => r.segmentHealth);

    // Best top performer across all clusters
    const allTopPerformers = reports.map((r) => r.topPerformer);
    const topPerformer: TopPerformer =
      allTopPerformers.length > 0
        ? allTopPerformers.reduce((best, curr) =>
            curr.rowsIngested > best.rowsIngested ? curr : best
          )
        : { datasource: "N/A", rowsIngested: 0, durationMs: 0 };

    // Worst bottleneck across all clusters
    const allBottlenecks = reports
      .map((r) => r.bottleneck)
      .filter((b) => b.taskId !== "N/A");
    const bottleneck: Bottleneck =
      allBottlenecks.length > 0
        ? allBottlenecks.reduce((worst, curr) =>
            curr.durationMs > worst.durationMs ? curr : worst
          )
        : {
            taskId: "N/A",
            datasource: "N/A",
            durationMs: 0,
            rowsPerSec: 0,
            failureCount: 0,
          };

    return {
      clusterName: `${this.productName} (all regions)`,
      dateRange: range,
      reliabilityScore: reliability,
      queryMetrics: metrics,
      topPerformer,
      bottleneck,
      segmentHealth: allSegments,
    };
  }
}
