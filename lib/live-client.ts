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
import { DruidMcpHttpClient } from "./druid-mcp-http-client";
import { PrometheusClient } from "./prometheus-client";

interface LiveClientConfig {
  mcpUrl?: string;
  prometheusUrl?: string;
}

export class LiveDruidClient implements DruidMCPClient {
  private mcp: DruidMcpHttpClient;
  private prom: PrometheusClient;

  constructor(config?: LiveClientConfig) {
    const mcpUrl =
      config?.mcpUrl ??
      process.env.DRUID_MCP_URL ??
      "http://localhost:9090/mcp";
    this.mcp = new DruidMcpHttpClient({ url: mcpUrl });
    this.prom = new PrometheusClient({
      url: config?.prometheusUrl ?? process.env.PROMETHEUS_URL ?? "http://localhost:9092",
    });
  }

  private async sql(query: string): Promise<any[]> {
    return this.mcp.callTool("queryDruidSql", { sqlQuery: query });
  }

  async getClusterStatus(_region?: DruidRegion): Promise<ClusterStatus> {
    const rows = await this.sql(
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
      clusterName: "osd-dev-gew4",
      uptimePercent,
      serverCount,
      healthyServerCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(_region?: DruidRegion): Promise<Task[]> {
    const rows = await this.sql(
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
    _range: DateRange,
    _region?: DruidRegion
  ): Promise<QueryMetrics> {
    const [total, successful, failed, avgTime] = await Promise.all([
      this.prom.scalarValue("sum(druid_query_count_total)"),
      this.prom.scalarValue("sum(druid_query_success_count_total)"),
      this.prom.scalarValue("sum(druid_query_failed_count_total)"),
      this.prom.scalarValue(
        "sum(druid_query_time_sum) / sum(druid_query_time_count)"
      ),
    ]);

    return {
      totalQueries: Math.round(total),
      successfulQueries: Math.round(successful),
      failedQueries: Math.round(failed),
      avgQueryTimeMs: Math.round(avgTime),
      queriesOverSla: 0,
      slaThresholdMs: 1000,
    };
  }

  async getSegmentHealth(_region?: DruidRegion): Promise<SegmentHealth[]> {
    const rows = await this.sql(
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
    const now = Math.floor(Date.now() / 1000);
    const oneHourAgo = now - 3600;

    const results = await this.prom.rangeQuery(
      "sum(rate(druid_query_count_total[1m]))",
      oneHourAgo,
      now,
      60
    );

    if (results.length === 0) return [];

    return results[0].values.map(([ts, val]) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      qps: parseFloat(parseFloat(val).toFixed(2)),
    }));
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
      clusterName: "osd-dev-gew4",
      dateRange: range,
      reliabilityScore: reliability,
      queryMetrics: metrics,
      topPerformer,
      bottleneck,
      segmentHealth: segments,
    };
  }
}
