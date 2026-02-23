import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveDruidClient } from "../live-client";

const mockQuery = vi.fn();

vi.mock("../grpc-client", () => ({
  HolocronGrpcClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

describe("LiveDruidClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with default config", () => {
    const client = new LiveDruidClient();
    expect(client).toBeDefined();
  });

  it("getClusterStatus queries sys.servers and maps result", async () => {
    mockQuery.mockResolvedValue([
      { server: "hist1:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "hist2:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "broker1:8082", server_type: "broker", curr_size: 0, max_size: 0 },
    ]);

    const client = new LiveDruidClient();
    const status = await client.getClusterStatus();

    expect(status.serverCount).toBe(3);
    expect(status.healthyServerCount).toBe(3);
    expect(status.clusterName).toContain("holocron");
    expect(status.timestamp).toBeDefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("sys.servers")
    );
  });

  it("getActiveTasks queries sys.tasks for RUNNING", async () => {
    mockQuery.mockResolvedValue([
      {
        task_id: "index_wiki_2026-02-23",
        datasource: "wiki_edits",
        status: "RUNNING",
        created_time: "2026-02-23T10:00:00.000Z",
        duration: 120000,
        error_msg: null,
      },
    ]);

    const client = new LiveDruidClient();
    const tasks = await client.getActiveTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("index_wiki_2026-02-23");
    expect(tasks[0].datasource).toBe("wiki_edits");
    expect(tasks[0].status).toBe("RUNNING");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("RUNNING")
    );
  });

  it("getSegmentHealth queries sys.segments grouped by datasource", async () => {
    mockQuery.mockResolvedValue([
      { datasource: "wiki_edits", segment_count: 200, total_size: 2000000000 },
    ]);

    const client = new LiveDruidClient();
    const segments = await client.getSegmentHealth();

    expect(segments).toHaveLength(1);
    expect(segments[0].datasource).toBe("wiki_edits");
    expect(segments[0].segmentCount).toBe(200);
    expect(segments[0].totalSizeBytes).toBe(2000000000);
    expect(segments[0].avgSegmentSizeBytes).toBe(10000000);
    expect(segments[0].needsCompaction).toBe(true);
  });

  it("getQueryMetrics queries sys.tasks for date range", async () => {
    mockQuery.mockResolvedValue([
      { total: 100, successful: 95, failed: 5, avg_duration: 500 },
    ]);

    const client = new LiveDruidClient();
    const metrics = await client.getQueryMetrics({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(metrics.totalQueries).toBe(100);
    expect(metrics.successfulQueries).toBe(95);
    expect(metrics.failedQueries).toBe(5);
  });

  it("getQueryVelocity returns empty array (no sys table for QPS)", async () => {
    const client = new LiveDruidClient();
    const points = await client.getQueryVelocity();

    expect(points).toEqual([]);
  });

  it("getWeeklyReport aggregates metrics, segments, and tasks", async () => {
    // First call: getQueryMetrics
    mockQuery.mockResolvedValueOnce([
      { total: 100, successful: 95, failed: 5, avg_duration: 500 },
    ]);
    // Second call: getSegmentHealth
    mockQuery.mockResolvedValueOnce([
      { datasource: "wiki_edits", segment_count: 200, total_size: 2000000000 },
    ]);
    // Third call: getActiveTasks
    mockQuery.mockResolvedValueOnce([
      {
        task_id: "index_wiki",
        datasource: "wiki_edits",
        status: "RUNNING",
        created_time: "2026-02-23T10:00:00.000Z",
        duration: 120000,
        error_msg: null,
      },
    ]);

    const client = new LiveDruidClient();
    const report = await client.getWeeklyReport({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(report.reliabilityScore).toBe(95);
    expect(report.queryMetrics.totalQueries).toBe(100);
    expect(report.segmentHealth).toHaveLength(1);
  });

  it("rejects when gRPC query fails", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const client = new LiveDruidClient();
    await expect(client.getClusterStatus()).rejects.toThrow(
      "connection refused"
    );
  });
});
