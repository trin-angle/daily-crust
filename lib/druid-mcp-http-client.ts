export interface McpClientConfig {
  url: string;
}

export class DruidMcpHttpClient {
  private url: string;
  private sessionId: string | null = null;
  private requestId = 0;
  private initPromise: Promise<void> | null = null;

  constructor(config: McpClientConfig) {
    this.url = config.url;
  }

  private async initialize(): Promise<void> {
    if (this.sessionId) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const id = ++this.requestId;
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "daily-crust", version: "1.0" },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`MCP initialize failed (${response.status}): ${text}`);
      }

      this.sessionId = response.headers.get("mcp-session-id");
      if (!this.sessionId) {
        throw new Error("MCP server did not return session ID");
      }
    })();

    return this.initPromise;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<any> {
    await this.initialize();

    const id = ++this.requestId;
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
        "Mcp-Session-Id": this.sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MCP tool call failed (${response.status}): ${text}`);
    }

    const text = await response.text();
    return this.parseResponse(text, id);
  }

  private parseResponse(text: string, expectedId: number): any {
    // SSE format: lines starting with "data:"
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    if (dataLines.length > 0) {
      for (const line of dataLines) {
        const parsed = JSON.parse(line);
        if (parsed.error) {
          throw new Error(
            `MCP error: ${parsed.error.message ?? JSON.stringify(parsed.error)}`
          );
        }
        if (parsed.id === expectedId && parsed.result) {
          const content = parsed.result.content?.[0]?.text;
          if (content) {
            return JSON.parse(content);
          }
          return parsed.result;
        }
      }
    }

    // Non-SSE JSON response
    const parsed = JSON.parse(text);
    if (parsed.error) {
      throw new Error(
        `MCP error: ${parsed.error.message ?? JSON.stringify(parsed.error)}`
      );
    }
    if (parsed.result) {
      const content = parsed.result.content?.[0]?.text;
      if (content) {
        return JSON.parse(content);
      }
      return parsed.result;
    }

    throw new Error("No valid response found in MCP response");
  }
}
