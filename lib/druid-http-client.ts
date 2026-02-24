export interface DruidHttpConfig {
  url: string;
  username?: string;
  password?: string;
}

export class DruidHttpClient {
  private url: string;
  private authHeader?: string;

  constructor(config: DruidHttpConfig) {
    this.url = config.url.replace(/\/$/, "");
    if (config.username && config.password) {
      this.authHeader =
        "Basic " +
        Buffer.from(`${config.username}:${config.password}`).toString("base64");
    }
  }

  async query(sql: string): Promise<any[]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.authHeader) {
      headers["Authorization"] = this.authHeader;
    }

    const response = await fetch(`${this.url}/druid/v2/sql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Druid query failed (${response.status}): ${text}`);
    }

    return response.json();
  }
}
