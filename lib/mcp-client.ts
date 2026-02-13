import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
} from "./types";
import { MockDruidClient } from "./mock-client";
import { LiveDruidClient } from "./live-client";

export interface DruidMCPClient {
  getClusterStatus(region?: DruidRegion): Promise<ClusterStatus>;
  getActiveTasks(region?: DruidRegion): Promise<Task[]>;
  getQueryMetrics(range: DateRange, region?: DruidRegion): Promise<QueryMetrics>;
  getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]>;
  getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange, region?: DruidRegion): Promise<WeeklyReport>;
}

export function createMCPClient(mode?: string): DruidMCPClient {
  const resolvedMode = mode ?? process.env.MCP_MODE ?? "mock";
  if (resolvedMode === "mock") {
    return new MockDruidClient();
  }
  if (resolvedMode === "live") {
    return new LiveDruidClient();
  }
  throw new Error(
    `Unknown MCP_MODE: ${resolvedMode}. Supported: "mock", "live".`
  );
}
