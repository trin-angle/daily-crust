import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  DruidRegion,
  DruidProduct,
} from "./types";
import { MockDruidClient } from "./mock-client";
import { LiveDruidClient } from "./live-client";
import { AggregatedDruidClient } from "./aggregated-client";
import { getClusterConfig, getClusterConfigs } from "./region-config";

export interface DruidMCPClient {
  getClusterStatus(region?: DruidRegion): Promise<ClusterStatus>;
  getActiveTasks(region?: DruidRegion): Promise<Task[]>;
  getQueryMetrics(range: DateRange, region?: DruidRegion): Promise<QueryMetrics>;
  getSegmentHealth(region?: DruidRegion): Promise<SegmentHealth[]>;
  getQueryVelocity(region?: DruidRegion): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange, region?: DruidRegion): Promise<WeeklyReport>;
}

export function createMCPClient(
  mode?: string,
  product?: DruidProduct,
  region?: DruidRegion
): DruidMCPClient {
  const resolvedMode = mode ?? process.env.MCP_MODE ?? "mock";
  if (resolvedMode === "mock") {
    return new MockDruidClient();
  }
  if (resolvedMode === "live") {
    const resolvedProduct = product ?? "music";
    const resolvedRegion = region ?? "all";

    if (resolvedRegion === "all") {
      const configs = getClusterConfigs(resolvedProduct);
      const clients = configs.map((cfg) => new LiveDruidClient(cfg));
      return new AggregatedDruidClient(clients, resolvedProduct);
    }

    const config = getClusterConfig(resolvedProduct, resolvedRegion);
    return new LiveDruidClient(config);
  }
  throw new Error(
    `Unknown MCP_MODE: ${resolvedMode}. Supported: "mock", "live".`
  );
}
