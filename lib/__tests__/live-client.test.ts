import { describe, it, expect, vi } from "vitest";
import { LiveDruidClient } from "../live-client";

// Mock child_process to avoid actually calling archdruid
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => {
  const mod = { execFile: mockExecFile };
  return { ...mod, default: mod };
});

function mockExecResult(stdout: string) {
  mockExecFile.mockImplementation(
    (_cmd: any, _args: any, _opts: any, callback: any) => {
      callback(null, stdout, "");
      return {} as any;
    }
  );
}

describe("LiveDruidClient", () => {
  it("constructs with default config", () => {
    const client = new LiveDruidClient();
    expect(client).toBeDefined();
  });

  it("constructs with custom archdruid path and default cluster", () => {
    const client = new LiveDruidClient({
      archdruidPath: "/custom/path",
      defaultCluster: "osd-prod-guc3",
    });
    expect(client).toBeDefined();
  });

  it("getClusterStatus calls archdruid and parses response", async () => {
    const mockResponse = JSON.stringify({
      cluster: "osd-prod-gew1",
      servers: {
        total: 12,
        healthy: 12,
      },
      uptime_percent: 99.95,
    });
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const status = await client.getClusterStatus("osd-prod-gew1");

    expect(status.clusterName).toBe("osd-prod-gew1");
    expect(status.serverCount).toBe(12);
    expect(status.healthyServerCount).toBe(12);
    expect(status.uptimePercent).toBe(99.95);
    expect(status.region).toBe("osd-prod-gew1");
  });

  it("getActiveTasks calls archdruid and parses response", async () => {
    const mockResponse = JSON.stringify([
      {
        id: "index_wiki_2026-02-12",
        dataSource: "wiki_edits",
        status: "RUNNING",
        duration: 120000,
        rowCount: 5000000,
        progress: 78,
        createdTime: "2026-02-12T10:00:00Z",
      },
    ]);
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const tasks = await client.getActiveTasks("osd-prod-gew1");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe("index_wiki_2026-02-12");
    expect(tasks[0].datasource).toBe("wiki_edits");
    expect(tasks[0].status).toBe("RUNNING");
  });

  it("getSegmentHealth queries sys.segments via SQL", async () => {
    const mockResponse = JSON.stringify([
      {
        datasource: "wiki_edits",
        segment_count: 200,
        total_size: 2000000000,
      },
    ]);
    mockExecResult(mockResponse);

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const segments = await client.getSegmentHealth("osd-prod-gew1");

    expect(segments).toHaveLength(1);
    expect(segments[0].datasource).toBe("wiki_edits");
    expect(segments[0].segmentCount).toBe(200);
    expect(segments[0].avgSegmentSizeBytes).toBe(10000000);
  });

  it("throws when archdruid fails", async () => {
    mockExecFile.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(new Error("archdruid not found"), "", "command not found");
        return {} as any;
      }
    );

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    await expect(client.getClusterStatus("osd-prod-gew1")).rejects.toThrow(
      "archdruid not found"
    );
  });

  it("resolves region 'all' by querying all clusters", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callCount++;
        const response = JSON.stringify({
          cluster: `osd-prod-region${callCount}`,
          servers: { total: 4, healthy: 4 },
          uptime_percent: 99.9,
        });
        callback(null, response, "");
        return {} as any;
      }
    );

    const client = new LiveDruidClient({ archdruidPath: "archdruid" });
    const status = await client.getClusterStatus("all");

    // "all" should aggregate across 3 clusters
    expect(status.serverCount).toBe(12); // 4 * 3
    expect(status.healthyServerCount).toBe(12);
    expect(status.clusterName).toBe("osd-prod (all regions)");
  });
});
