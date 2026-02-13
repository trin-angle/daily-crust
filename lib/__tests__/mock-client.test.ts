import { describe, it, expect } from "vitest";
import { createMCPClient } from "../mcp-client";

describe("MockDruidClient", () => {
  const client = createMCPClient("mock");

  it("getClusterStatus returns valid ClusterStatus", async () => {
    const status = await client.getClusterStatus();
    expect(status.clusterName).toBe("druid-prod-01");
    expect(status.uptimePercent).toBeGreaterThan(99);
    expect(status.uptimePercent).toBeLessThanOrEqual(100);
    expect(status.serverCount).toBeGreaterThan(0);
    expect(status.healthyServerCount).toBeLessThanOrEqual(status.serverCount);
    expect(status.timestamp).toBeTruthy();
  });

  it("getActiveTasks returns array of tasks", async () => {
    const tasks = await client.getActiveTasks();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.taskId).toBeTruthy();
      expect(task.datasource).toBeTruthy();
      expect(["RUNNING", "SUCCESS", "FAILED", "WAITING"]).toContain(
        task.status
      );
      expect(task.progressPercent).toBeGreaterThanOrEqual(0);
      expect(task.progressPercent).toBeLessThanOrEqual(100);
    }
  });

  it("getQueryMetrics returns valid metrics", async () => {
    const range = {
      start: "2026-02-05T00:00:00Z",
      end: "2026-02-12T00:00:00Z",
    };
    const metrics = await client.getQueryMetrics(range);
    expect(metrics.totalQueries).toBeGreaterThan(0);
    expect(metrics.successfulQueries).toBeLessThanOrEqual(
      metrics.totalQueries
    );
    expect(metrics.failedQueries).toBe(
      metrics.totalQueries - metrics.successfulQueries
    );
    expect(metrics.slaThresholdMs).toBe(1000);
  });

  it("getSegmentHealth returns array of segments", async () => {
    const segments = await client.getSegmentHealth();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg.datasource).toBeTruthy();
      expect(seg.segmentCount).toBeGreaterThan(0);
      expect(typeof seg.needsCompaction).toBe("boolean");
    }
  });

  it("getQueryVelocity returns QPS time series", async () => {
    const points = await client.getQueryVelocity();
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.timestamp).toBeTruthy();
      expect(point.qps).toBeGreaterThan(0);
    }
  });

  it("getWeeklyReport returns a complete report", async () => {
    const range = {
      start: "2026-02-05T00:00:00Z",
      end: "2026-02-12T00:00:00Z",
    };
    const report = await client.getWeeklyReport(range);
    expect(report.clusterName).toBe("druid-prod-01");
    expect(report.reliabilityScore).toBeGreaterThan(99);
    expect(report.topPerformer.datasource).toBeTruthy();
    expect(report.bottleneck.taskId).toBeTruthy();
    expect(report.segmentHealth.length).toBeGreaterThan(0);
  });
});
