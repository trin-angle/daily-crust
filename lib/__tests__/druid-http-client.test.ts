import { describe, it, expect, vi, beforeEach } from "vitest";
import { DruidHttpClient } from "../druid-http-client";

describe("DruidHttpClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs with config", () => {
    const client = new DruidHttpClient({
      url: "http://localhost:9100",
      username: "druid",
      password: "druid",
    });
    expect(client).toBeDefined();
  });

  it("sends SQL query with basic auth and parses objectLines response", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '{"server":"hist1:8083","server_type":"historical"}\n{"server":"broker1:8082","server_type":"broker"}\n',
        { status: 200 }
      )
    );

    const client = new DruidHttpClient({
      url: "http://localhost:9100",
      username: "druid",
      password: "druid",
    });
    const rows = await client.query("SELECT server, server_type FROM sys.servers");

    expect(rows).toHaveLength(2);
    expect(rows[0].server).toBe("hist1:8083");
    expect(rows[1].server_type).toBe("broker");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9100/druid/v2/sql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: expect.stringContaining("Basic"),
        }),
      })
    );
  });

  it("returns empty array for empty response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 })
    );

    const client = new DruidHttpClient({
      url: "http://localhost:9100",
      username: "druid",
      password: "druid",
    });
    const rows = await client.query("SELECT 1");

    expect(rows).toEqual([]);
  });

  it("throws on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    const client = new DruidHttpClient({
      url: "http://localhost:9100",
      username: "wrong",
      password: "creds",
    });

    await expect(client.query("SELECT 1")).rejects.toThrow(
      "Druid SQL query failed (401)"
    );
  });

  it("strips trailing slash from URL", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 })
    );

    const client = new DruidHttpClient({
      url: "http://localhost:9100/",
      username: "druid",
      password: "druid",
    });
    await client.query("SELECT 1");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:9100/druid/v2/sql",
      expect.any(Object)
    );
  });
});
