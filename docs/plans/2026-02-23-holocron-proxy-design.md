# Holocron Proxy Integration Design

## Goal

Replace the current `LiveDruidClient` (which shells out to non-existent archdruid CLI commands) with a gRPC client that queries Druid through the holocron proxy. All cluster data — health, tasks, segments, query metrics — will be derived from SQL queries against Druid system tables.

## Architecture

```
Next.js API routes (/api/cluster/*)
  → LiveDruidClient (TypeScript, implements DruidMCPClient)
    → HolocronGrpcClient (thin wrapper)
      → @grpc/grpc-js + proto-loader
        → holocron-proxy-service (gRPC, port 50051)
          → Druid cluster (routed by topology)
```

The `DruidMCPClient` interface is unchanged. Only the `LiveDruidClient` implementation changes. No UI modifications required.

## Protobuf Interface

Two proto files copied from archdruid:

**`query.proto`** — Druid gRPC query protocol (Apache licensed):
- `QueryRequest`: query string, result format (JSON_ARRAY), context map, query type (SQL)
- `QueryResponse`: status, columns schema, data bytes

**`holocronproxy.proto`** — Spotify holocron proxy service:
- `HolocronProxyService.Proxy(QueryRequest) → QueryResponse`
- `HolocronProxyService.LaneOneProxy(QueryRequest) → QueryResponse`

## SQL Queries

All data derived from Druid system tables via SQL:

### Cluster Health (`sys.servers`)

```sql
SELECT
  server,
  server_type,
  is_leader,
  curr_size,
  max_size
FROM sys.servers
```

Map to `ClusterStatus`: count total servers, count servers where `curr_size < max_size` as healthy, derive uptime from server availability ratio.

### Running Tasks (`sys.tasks`)

```sql
SELECT
  task_id,
  datasource,
  status,
  created_time,
  duration,
  error_msg
FROM sys.tasks
WHERE status = 'RUNNING'
ORDER BY created_time DESC
```

Map to `Task[]`. Progress percent is not available from `sys.tasks` — set to 0 or omit.

### Segment Health (`sys.segments`)

```sql
SELECT
  datasource,
  COUNT(*) as segment_count,
  SUM("size") as total_size
FROM sys.segments
WHERE is_active = 1
GROUP BY datasource
ORDER BY total_size DESC
```

Map to `SegmentHealth[]`. Compaction heuristic: flag if avg segment size < 100MB or segment count > 500.

### Query/Task Metrics

```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
FROM sys.tasks
WHERE created_time >= '{start}'
  AND created_time <= '{end}'
```

Map to `QueryMetrics`. `avgQueryTimeMs` derived from average task duration. `queriesOverSla` derived from tasks with duration > 1000ms.

### Query Velocity (`QpsPoint[]`)

No direct sys table for real-time QPS. Approximate from task creation rate:

```sql
SELECT
  TIME_FLOOR(created_time, 'PT1M') as ts,
  COUNT(*) as cnt
FROM sys.tasks
WHERE created_time >= CURRENT_TIMESTAMP - INTERVAL '5' MINUTE
GROUP BY TIME_FLOOR(created_time, 'PT1M')
ORDER BY ts
```

If this doesn't yield useful data, fall back to returning empty array (dashboard handles this gracefully).

## gRPC Client Implementation

New file `lib/grpc-client.ts`:

```typescript
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

interface HolocronConfig {
  host: string; // e.g. "holocron-proxy-service:50051"
}

class HolocronGrpcClient {
  private client: any;

  constructor(config: HolocronConfig) {
    const packageDef = protoLoader.loadSync("lib/protos/holocronproxy.proto", {
      keepCase: true,
      longs: String,
      defaults: true,
      includeDirs: ["lib/protos"],
    });
    const proto = grpc.loadPackageDefinition(packageDef);
    const service = proto.spotify.holocron.v1.HolocronProxyService;
    this.client = new service(config.host, grpc.credentials.createInsecure());
  }

  async query(sql: string): Promise<any[]> {
    const request = {
      query: sql,
      resultFormat: 5, // JSON_ARRAY_LINES
      context: {},
      queryType: 0, // SQL
    };

    return new Promise((resolve, reject) => {
      this.client.Proxy(request, { deadline: Date.now() + 10000 },
        (err, response) => {
          if (err) return reject(err);
          if (response.status !== 1) { // not OK
            return reject(new Error(response.errorMessage || "Query failed"));
          }
          const data = JSON.parse(response.data.toString());
          resolve(data);
        }
      );
    });
  }
}
```

## LiveDruidClient Rewrite

Replace `execFile`/subprocess approach with `HolocronGrpcClient.query()` calls. Each `DruidMCPClient` method becomes a SQL query + result mapping.

Region handling: The holocron proxy routes queries via topology, so explicit region selection may not apply the same way. For now, the proxy routes to the cluster determined by topology config. Region filtering can be revisited once basic connectivity works.

## Configuration

```env
MCP_MODE=live
HOLOCRON_PROXY_HOST=holocron-proxy-service:50051
```

The `ARCHDRUID_PATH` and `DRUID_CLUSTER` env vars become unused.

## Dependencies

New npm packages:
- `@grpc/grpc-js` — gRPC client for Node.js
- `@grpc/proto-loader` — dynamic proto loading

## Files Changed

| File | Change |
|------|--------|
| `lib/protos/query.proto` | New — copied from archdruid |
| `lib/protos/holocronproxy.proto` | New — copied from archdruid |
| `lib/grpc-client.ts` | New — thin gRPC wrapper |
| `lib/live-client.ts` | Rewrite — use gRPC instead of subprocess |
| `.env.local` | Update — add HOLOCRON_PROXY_HOST |
| `package.json` | Update — add grpc dependencies |

## What Stays the Same

- `DruidMCPClient` interface (no changes)
- `MockDruidClient` (untouched, still works for development)
- All UI components and pages
- API routes
- `MCP_MODE` toggle between mock/live

## Open Questions

1. **Auth:** The archdruid codebase uses an insecure channel for holocron proxy. Will this work from a local dev machine on VPN, or do we need service account auth?
2. **Region routing:** Holocron proxy routes via topology — does the topology give us per-region control, or does it pick a single cluster?
3. **QPS data:** `sys.tasks` may not be granular enough for real-time QPS. May need to accept empty velocity charts in live mode initially.
