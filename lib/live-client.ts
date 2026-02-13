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

  async getQueryVelocity(_region?: DruidRegion): Promise<QpsPoint[]> {
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

    const sortedByRows = [...tasks].sort((a, b) => b.rowCount - a.rowCount);
    const topPerformer: TopPerformer = sortedByRows.length > 0
      ? {
          datasource: sortedByRows[0].datasource,
          rowsIngested: sortedByRows[0].rowCount,
          durationMs: sortedByRows[0].duration,
        }
      : { datasource: "N/A", rowsIngested: 0, durationMs: 0 };

    const sortedByProgress = [...tasks].sort((a, b) => a.progressPercent - b.progressPercent);
    const bottleneck: Bottleneck = sortedByProgress.length > 0
      ? {
          taskId: sortedByProgress[0].taskId,
          datasource: sortedByProgress[0].datasource,
          durationMs: sortedByProgress[0].duration,
          rowsPerSec: sortedByProgress[0].duration > 0
            ? parseFloat((sortedByProgress[0].rowCount / (sortedByProgress[0].duration / 1000)).toFixed(1))
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
