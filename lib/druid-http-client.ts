export interface DruidHttpConfig {
  url: string;
  username: string;
  password: string;
}

export class DruidHttpClient {
  private url: string;
  private authHeader: string;

  constructor(config: DruidHttpConfig) {
    this.url = config.url.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  async query(sql: string): Promise<any[]> {
    const response = await fetch(`${this.url}/druid/v2/sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ query: sql, resultFormat: "objectLines" }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Druid SQL query failed (${response.status}): ${text}`);
    }

    const text = await response.text();
    if (!text.trim()) return [];

    return text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }
}
