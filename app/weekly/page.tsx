import { createMCPClient } from "@/lib/mcp-client";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { ReliabilityScore } from "@/components/ReliabilityScore";
import type { DruidProduct, DruidRegion } from "@/lib/types";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

interface WeeklyPageProps {
  searchParams: Promise<{ product?: string; region?: string }>;
}

export default async function WeeklyPage({ searchParams }: WeeklyPageProps) {
  const params = await searchParams;
  const product = (params.product as DruidProduct) ?? "music";
  const region = (params.region as DruidRegion) ?? "all";

  const client = createMCPClient(undefined, product, region);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = {
    start: weekAgo.toISOString(),
    end: now.toISOString(),
  };

  const report = await client.getWeeklyReport(range);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-card p-8 bg-gradient-to-b from-brand-green/20 to-surface-base text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Your Week in Druid
        </h1>
        <p className="text-text-secondary">
          {report.clusterName} &middot;{" "}
          {new Date(report.dateRange.start).toLocaleDateString()} &ndash;{" "}
          {new Date(report.dateRange.end).toLocaleDateString()}
        </p>
      </div>

      {/* Reliability Score */}
      <WeeklyReportCard
        title="Cluster Reliability"
        accent={report.reliabilityScore >= 99.9 ? "green" : report.reliabilityScore >= 99.5 ? "yellow" : "red"}
      >
        <ReliabilityScore
          score={report.reliabilityScore}
          total={report.queryMetrics.totalQueries}
          successful={report.queryMetrics.successfulQueries}
        />
      </WeeklyReportCard>

      {/* Top Performer */}
      <WeeklyReportCard title="Top Performer" accent="green">
        <p className="text-2xl font-bold mb-1">
          {report.topPerformer.datasource}
        </p>
        <p className="text-text-secondary">
          {report.topPerformer.rowsIngested.toLocaleString()} rows ingested in{" "}
          {formatDuration(report.topPerformer.durationMs)}
        </p>
        <p className="text-sm text-brand-green mt-2">
          {Math.floor(
            report.topPerformer.rowsIngested /
              (report.topPerformer.durationMs / 1000)
          ).toLocaleString()}{" "}
          rows/sec
        </p>
      </WeeklyReportCard>

      {/* The Bottleneck */}
      <WeeklyReportCard title="The Bottleneck" accent="red">
        <p className="text-2xl font-bold mb-1">
          {report.bottleneck.datasource}
        </p>
        <p className="text-text-secondary">
          Task: {report.bottleneck.taskId}
        </p>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="text-brand-red">
            {report.bottleneck.failureCount} failures
          </span>
          <span className="text-text-secondary">
            {formatDuration(report.bottleneck.durationMs)} duration
          </span>
          <span className="text-text-secondary">
            {report.bottleneck.rowsPerSec} rows/sec
          </span>
        </div>
      </WeeklyReportCard>

      {/* SLA Watch */}
      <WeeklyReportCard
        title="SLA Watch"
        accent={report.queryMetrics.queriesOverSla > 100 ? "yellow" : "green"}
      >
        <p className="text-4xl font-bold mb-1">
          {report.queryMetrics.queriesOverSla.toLocaleString()}
        </p>
        <p className="text-text-secondary mb-3">
          queries exceeded {report.queryMetrics.slaThresholdMs}ms threshold
        </p>
        <div className="h-2 bg-surface-base rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-yellow rounded-full"
            style={{
              width: `${Math.min(
                (report.queryMetrics.queriesOverSla /
                  report.queryMetrics.totalQueries) *
                  100 *
                  50,
                100
              )}%`,
            }}
          />
        </div>
      </WeeklyReportCard>

      {/* Segment Health */}
      <WeeklyReportCard title="Segment Health">
        <div className="space-y-3">
          {report.segmentHealth.map((seg) => (
            <div
              key={seg.datasource}
              className="flex items-center justify-between py-2 border-b border-surface-base last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{seg.datasource}</p>
                <p className="text-xs text-text-secondary">
                  {seg.segmentCount} segments &middot;{" "}
                  {formatBytes(seg.totalSizeBytes)} total &middot; avg{" "}
                  {formatBytes(seg.avgSegmentSizeBytes)}
                </p>
              </div>
              {seg.needsCompaction ? (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-yellow/20 text-brand-yellow">
                  Compaction needed
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-green/20 text-brand-green">
                  Healthy
                </span>
              )}
            </div>
          ))}
        </div>
      </WeeklyReportCard>
    </div>
  );
}
