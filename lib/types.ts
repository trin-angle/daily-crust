export interface DateRange {
  start: string;
  end: string;
}

export interface ClusterStatus {
  clusterName: string;
  uptimePercent: number;
  serverCount: number;
  healthyServerCount: number;
  timestamp: string;
}

export interface Task {
  taskId: string;
  datasource: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "WAITING";
  duration: number;
  rowCount: number;
  progressPercent: number;
  createdTime: string;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgQueryTimeMs: number;
  queriesOverSla: number;
  slaThresholdMs: number;
}

export interface SegmentHealth {
  datasource: string;
  segmentCount: number;
  totalSizeBytes: number;
  avgSegmentSizeBytes: number;
  needsCompaction: boolean;
  reason: string;
}

export interface IngestionStats {
  datasource: string;
  rowsIngested: number;
  durationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface QpsPoint {
  timestamp: string;
  qps: number;
}

export interface TopPerformer {
  datasource: string;
  rowsIngested: number;
  durationMs: number;
}

export interface Bottleneck {
  taskId: string;
  datasource: string;
  durationMs: number;
  rowsPerSec: number;
  failureCount: number;
}

export interface WeeklyReport {
  clusterName: string;
  dateRange: DateRange;
  reliabilityScore: number;
  queryMetrics: QueryMetrics;
  topPerformer: TopPerformer;
  bottleneck: Bottleneck;
  segmentHealth: SegmentHealth[];
}
