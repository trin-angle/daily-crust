import { describe, it, expect, vi, beforeEach } from "vitest";
import { LiveDruidClient } from "../live-client";

const mockQuery = vi.fn();
const mockScalarValue = vi.fn();
const mockRangeQuery = vi.fn();

vi.mock("../druid-http-client", () => ({
  DruidHttpClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

vi.mock("../prometheus-client", () => ({
  PrometheusClient: vi.fn().mockImplementation(() => ({
    scalarValue: mockScalarValue,
    rangeQuery: mockRangeQuery,
  })),
}));

const TEST_CONFIG = {
  clusterName: "osd-prod-gew1",
  druidUrl: "http://localhost:9100",
  druidUsername: "druid",
  druidPassword: "druid",
  prometheusUrl: "http://localhost:9101",
};

describe("LiveDruidClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs with config", () => {
    const client = new LiveDruidClient(TEST_CONFIG);
    expect(client).toBeDefined();
  });

  it("getClusterStatus queries sys.servers and maps result", async () => {
    mockQuery.mockResolvedValue([
      { server: "hist1:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "hist2:8083", server_type: "historical", curr_size: 100, max_size: 200 },
      { server: "broker1:8082", server_type: "broker", curr_size: 0, max_size: 0 },
    ]);

    const client = new LiveDruidClient(TEST_CONFIG);
    const status = await client.getClusterStatus();

    expect(status.serverCount).toBe(3);
    expect(status.healthyServerCount).toBe(3);
    expect(status.clusterName).toBe("osd-prod-gew1");
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

    const client = new LiveDruidClient(TEST_CONFIG);
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

    const client = new LiveDruidClient(TEST_CONFIG);
    const segments = await client.getSegmentHealth();

    expect(segments).toHaveLength(1);
    expect(segments[0].datasource).toBe("wiki_edits");
    expect(segments[0].segmentCount).toBe(200);
    expect(segments[0].totalSizeBytes).toBe(2000000000);
    expect(segments[0].avgSegmentSizeBytes).toBe(10000000);
    expect(segments[0].needsCompaction).toBe(true);
  });

  it("getQueryMetrics fetches from Prometheus", async () => {
    mockScalarValue
      .mockResolvedValueOnce(18903)  // total
      .mockResolvedValueOnce(18824)  // successful
      .mockResolvedValueOnce(79)     // failed
      .mockResolvedValueOnce(2.4);   // avg time

    const client = new LiveDruidClient(TEST_CONFIG);
    const metrics = await client.getQueryMetrics({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(metrics.totalQueries).toBe(18903);
    expect(metrics.successfulQueries).toBe(18824);
    expect(metrics.failedQueries).toBe(79);
    expect(metrics.avgQueryTimeMs).toBe(2);
    expect(mockScalarValue).toHaveBeenCalledTimes(4);
    expect(mockScalarValue).toHaveBeenCalledWith(
      expect.stringContaining("druid_query_count_total")
    );
  });

  it("getQueryVelocity returns QPS time series from Prometheus", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockRangeQuery.mockResolvedValue([
      {
        metric: {},
        values: [
          [now - 120, "1.5"],
          [now - 60, "2.3"],
          [now, "1.8"],
        ],
      },
    ]);

    const client = new LiveDruidClient(TEST_CONFIG);
    const points = await client.getQueryVelocity();

    expect(points).toHaveLength(3);
    expect(points[0].qps).toBe(1.5);
    expect(points[1].qps).toBe(2.3);
    expect(points[2].qps).toBe(1.8);
    expect(points[0].timestamp).toBeDefined();
    expect(mockRangeQuery).toHaveBeenCalledWith(
      expect.stringContaining("druid_query_count_total"),
      expect.any(Number),
      expect.any(Number),
      60
    );
  });

  it("getQueryVelocity returns empty array when no data", async () => {
    mockRangeQuery.mockResolvedValue([]);

    const client = new LiveDruidClient(TEST_CONFIG);
    const points = await client.getQueryVelocity();

    expect(points).toEqual([]);
  });

  it("getWeeklyReport aggregates metrics, segments, and tasks", async () => {
    // Prometheus calls for getQueryMetrics
    mockScalarValue
      .mockResolvedValueOnce(100)   // total
      .mockResolvedValueOnce(95)    // successful
      .mockResolvedValueOnce(5)     // failed
      .mockResolvedValueOnce(500);  // avg time

    // Druid calls: getSegmentHealth then getActiveTasks
    mockQuery
      .mockResolvedValueOnce([
        { datasource: "wiki_edits", segment_count: 200, total_size: 2000000000 },
      ])
      .mockResolvedValueOnce([
        {
          task_id: "index_wiki",
          datasource: "wiki_edits",
          status: "RUNNING",
          created_time: "2026-02-23T10:00:00.000Z",
          duration: 120000,
          error_msg: null,
        },
      ]);

    const client = new LiveDruidClient(TEST_CONFIG);
    const report = await client.getWeeklyReport({
      start: "2026-02-16",
      end: "2026-02-23",
    });

    expect(report.clusterName).toBe("osd-prod-gew1");
    expect(report.reliabilityScore).toBe(95);
    expect(report.queryMetrics.totalQueries).toBe(100);
    expect(report.segmentHealth).toHaveLength(1);
  });

  it("rejects when Druid query fails", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const client = new LiveDruidClient(TEST_CONFIG);
    await expect(client.getClusterStatus()).rejects.toThrow(
      "connection refused"
    );
  });
});
