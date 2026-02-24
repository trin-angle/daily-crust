import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DruidMcpHttpClient } from "../druid-mcp-http-client";

describe("DruidMcpHttpClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchSequence(
    ...responses: Array<{
      ok: boolean;
      status?: number;
      headers?: Record<string, string>;
      body: string;
    }>
  ) {
    let callIndex = 0;
    global.fetch = vi.fn(async () => {
      const resp = responses[callIndex++];
      return {
        ok: resp.ok,
        status: resp.status ?? (resp.ok ? 200 : 500),
        headers: new Headers(resp.headers ?? {}),
        text: async () => resp.body,
      } as Response;
    });
  }

  it("initializes session and calls tool", async () => {
    mockFetchSequence(
      {
        ok: true,
        headers: { "mcp-session-id": "test-session-123" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { protocolVersion: "2024-11-05" },
        }),
      },
      {
        ok: true,
        body: `data:${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [{ type: "text", text: JSON.stringify([{ cnt: 84 }]) }],
            isError: false,
          },
        })}\n\n`,
      }
    );

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    const result = await client.callTool("queryDruidSql", {
      sqlQuery: "SELECT COUNT(*) as cnt FROM sys.servers",
    });

    expect(result).toEqual([{ cnt: 84 }]);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify initialize call
    const initCall = (global.fetch as any).mock.calls[0];
    const initBody = JSON.parse(initCall[1].body);
    expect(initBody.method).toBe("initialize");

    // Verify tool call includes session header
    const toolCall = (global.fetch as any).mock.calls[1];
    expect(toolCall[1].headers["Mcp-Session-Id"]).toBe("test-session-123");
    const toolBody = JSON.parse(toolCall[1].body);
    expect(toolBody.method).toBe("tools/call");
    expect(toolBody.params.name).toBe("queryDruidSql");
  });

  it("reuses session for multiple tool calls", async () => {
    mockFetchSequence(
      {
        ok: true,
        headers: { "mcp-session-id": "session-reuse" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
      },
      {
        ok: true,
        body: `data:${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: { content: [{ type: "text", text: "[]" }] },
        })}\n\n`,
      },
      {
        ok: true,
        body: `data:${JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          result: { content: [{ type: "text", text: "[]" }] },
        })}\n\n`,
      }
    );

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    await client.callTool("listRunningTasks");
    await client.callTool("listCompletedTasks");

    // Initialize once + 2 tool calls = 3 fetches
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("throws when initialize fails", async () => {
    mockFetchSequence({
      ok: false,
      status: 500,
      body: "Internal Server Error",
    });

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    await expect(client.callTool("test")).rejects.toThrow(
      "MCP initialize failed (500)"
    );
  });

  it("throws when no session ID returned", async () => {
    mockFetchSequence({
      ok: true,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
    });

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    await expect(client.callTool("test")).rejects.toThrow(
      "MCP server did not return session ID"
    );
  });

  it("throws on MCP error response", async () => {
    mockFetchSequence(
      {
        ok: true,
        headers: { "mcp-session-id": "err-session" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
      },
      {
        ok: true,
        body: `data:${JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          error: { code: -32600, message: "Invalid tool" },
        })}\n\n`,
      }
    );

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    await expect(client.callTool("badTool")).rejects.toThrow(
      "MCP error: Invalid tool"
    );
  });

  it("handles non-SSE JSON response", async () => {
    mockFetchSequence(
      {
        ok: true,
        headers: { "mcp-session-id": "json-session" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }),
      },
      {
        ok: true,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [
              { type: "text", text: JSON.stringify({ healthy: true }) },
            ],
          },
        }),
      }
    );

    const client = new DruidMcpHttpClient({ url: "http://localhost:9090/mcp" });
    const result = await client.callTool("checkClusterHealth");
    expect(result).toEqual({ healthy: true });
  });
});
