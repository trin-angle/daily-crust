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
