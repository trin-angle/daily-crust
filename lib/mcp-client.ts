import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
} from "./types";
import { MockDruidClient } from "./mock-client";

export interface DruidMCPClient {
  getClusterStatus(): Promise<ClusterStatus>;
  getActiveTasks(): Promise<Task[]>;
  getQueryMetrics(range: DateRange): Promise<QueryMetrics>;
  getSegmentHealth(): Promise<SegmentHealth[]>;
  getQueryVelocity(): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange): Promise<WeeklyReport>;
}

export function createMCPClient(mode?: string): DruidMCPClient {
  const resolvedMode = mode ?? process.env.MCP_MODE ?? "mock";
  if (resolvedMode === "mock") {
    return new MockDruidClient();
  }
  throw new Error(
    `Unknown MCP_MODE: ${resolvedMode}. Only "mock" is currently supported.`
  );
}
