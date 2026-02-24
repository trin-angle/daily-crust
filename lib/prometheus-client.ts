export interface PrometheusConfig {
  url: string;
}

interface PrometheusResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PrometheusRangeResult {
  metric: Record<string, string>;
  values: [number, string][];
}

export class PrometheusClient {
  private url: string;

  constructor(config?: PrometheusConfig) {
    this.url = (
      config?.url ??
      process.env.PROMETHEUS_URL ??
      "http://localhost:9092"
    ).replace(/\/$/, "");
  }

  async instantQuery(query: string): Promise<PrometheusResult[]> {
    const params = new URLSearchParams({ query });
    const response = await fetch(
      `${this.url}/api/v1/query?${params}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Prometheus query failed (${response.status}): ${text}`);
    }

    const json = await response.json();
    return json.data?.result ?? [];
  }

  async rangeQuery(
    query: string,
    start: number,
    end: number,
    step: number
  ): Promise<PrometheusRangeResult[]> {
    const params = new URLSearchParams({
      query,
      start: String(start),
      end: String(end),
      step: String(step),
    });
    const response = await fetch(
      `${this.url}/api/v1/query_range?${params}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Prometheus range query failed (${response.status}): ${text}`
      );
    }

    const json = await response.json();
    return json.data?.result ?? [];
  }

  async scalarValue(query: string): Promise<number> {
    const results = await this.instantQuery(query);
    if (results.length === 0) return 0;
    return parseFloat(results[0].value[1]) || 0;
  }
}
