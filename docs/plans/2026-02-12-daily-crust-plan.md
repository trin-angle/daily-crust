# daily-crust Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Druid cluster monitoring dashboard with a "Druid Wrapped" weekly report and a live operational dashboard, styled in Spotify's dark design language.

**Architecture:** Next.js App Router with two pages (`/weekly` server-rendered, `/dashboard` client-rendered). A `DruidMCPClient` interface abstracts the data layer; a mock implementation provides simulated data. API routes proxy the MCP client for client-side polling.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Vitest + React Testing Library

**Design doc:** `docs/plans/2026-02-12-daily-crust-design.md`

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Step 1: Create Next.js app with Tailwind**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

When prompted, accept defaults. If it asks about Turbopack, say yes.

Expected: Project scaffolded with `app/` directory, `tailwind.config.ts`, etc.

**Step 2: Install additional dependencies**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm install recharts
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: Packages installed, `package.json` updated.

**Step 3: Create Vitest config**

Create: `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Create: `vitest.setup.ts`

```typescript
import "@testing-library/jest-dom/vitest";
```

**Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Create `.env.local`**

Create: `.env.local`

```
MCP_MODE=mock
```

**Step 6: Verify setup**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds with no errors.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind, Vitest, Recharts"
```

---

### Task 2: Configure Spotify Design Tokens

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Step 1: Update Tailwind config with Spotify design tokens**

Replace `tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#121212",
          raised: "#181818",
          card: "#282828",
          hover: "#2a2a2a",
        },
        brand: {
          green: "#1DB954",
          red: "#E91429",
          yellow: "#F59B23",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#B3B3B3",
        },
      },
      fontFamily: {
        sans: [
          "Circular Std",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 2: Update global styles**

Replace `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #121212;
  color: #ffffff;
  font-family: "Circular Std", "Helvetica Neue", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background-color: #1db954;
  color: #ffffff;
}
```

**Step 3: Verify build**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "style: add Spotify design tokens to Tailwind config"
```

---

### Task 3: Define TypeScript Types

**Files:**
- Create: `lib/types.ts`
- Test: `lib/__tests__/types.test.ts`

**Step 1: Write a type validation test**

Create: `lib/__tests__/types.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  IngestionStats,
  QpsPoint,
  DateRange,
  WeeklyReport,
} from "../types";

describe("types", () => {
  it("ClusterStatus satisfies shape", () => {
    const status: ClusterStatus = {
      clusterName: "druid-prod-01",
      uptimePercent: 99.97,
      serverCount: 12,
      healthyServerCount: 12,
      timestamp: new Date().toISOString(),
    };
    expect(status.clusterName).toBe("druid-prod-01");
  });

  it("Task satisfies shape", () => {
    const task: Task = {
      taskId: "index_wiki_2024-01-01",
      datasource: "wiki_edits",
      status: "RUNNING",
      duration: 120000,
      rowCount: 5000000,
      progressPercent: 78,
      createdTime: new Date().toISOString(),
    };
    expect(task.status).toBe("RUNNING");
  });

  it("QueryMetrics satisfies shape", () => {
    const metrics: QueryMetrics = {
      totalQueries: 100000,
      successfulQueries: 99940,
      failedQueries: 60,
      avgQueryTimeMs: 245,
      queriesOverSla: 312,
      slaThresholdMs: 1000,
    };
    expect(metrics.totalQueries).toBe(100000);
  });

  it("SegmentHealth satisfies shape", () => {
    const segment: SegmentHealth = {
      datasource: "event_logs",
      segmentCount: 450,
      totalSizeBytes: 1_200_000_000,
      avgSegmentSizeBytes: 2_666_666,
      needsCompaction: true,
      reason: "Segment count high relative to total size",
    };
    expect(segment.needsCompaction).toBe(true);
  });

  it("QpsPoint satisfies shape", () => {
    const point: QpsPoint = {
      timestamp: new Date().toISOString(),
      qps: 1247,
    };
    expect(point.qps).toBe(1247);
  });

  it("WeeklyReport satisfies shape", () => {
    const report: WeeklyReport = {
      clusterName: "druid-prod-01",
      dateRange: {
        start: "2026-02-05T00:00:00Z",
        end: "2026-02-12T00:00:00Z",
      },
      reliabilityScore: 99.94,
      queryMetrics: {
        totalQueries: 100000,
        successfulQueries: 99940,
        failedQueries: 60,
        avgQueryTimeMs: 245,
        queriesOverSla: 312,
        slaThresholdMs: 1000,
      },
      topPerformer: {
        datasource: "wiki_edits",
        rowsIngested: 50_000_000,
        durationMs: 180000,
      },
      bottleneck: {
        taskId: "index_ad_clicks_2026-02-10",
        datasource: "ad_clicks",
        durationMs: 900000,
        rowsPerSec: 12.5,
        failureCount: 3,
      },
      segmentHealth: [],
    };
    expect(report.reliabilityScore).toBe(99.94);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run lib/__tests__/types.test.ts
```

Expected: FAIL — cannot find module `../types`.

**Step 3: Write the types**

Create: `lib/types.ts`

```typescript
export interface DateRange {
  start: string;
  end: string;
}

export interface ClusterStatus {
  clusterName: string;
  uptimePercent: number;
  serverCount: number;
  healthyServerCount: number;
  timestamp: string;
}

export interface Task {
  taskId: string;
  datasource: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "WAITING";
  duration: number;
  rowCount: number;
  progressPercent: number;
  createdTime: string;
}

export interface QueryMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  avgQueryTimeMs: number;
  queriesOverSla: number;
  slaThresholdMs: number;
}

export interface SegmentHealth {
  datasource: string;
  segmentCount: number;
  totalSizeBytes: number;
  avgSegmentSizeBytes: number;
  needsCompaction: boolean;
  reason: string;
}

export interface IngestionStats {
  datasource: string;
  rowsIngested: number;
  durationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface QpsPoint {
  timestamp: string;
  qps: number;
}

export interface TopPerformer {
  datasource: string;
  rowsIngested: number;
  durationMs: number;
}

export interface Bottleneck {
  taskId: string;
  datasource: string;
  durationMs: number;
  rowsPerSec: number;
  failureCount: number;
}

export interface WeeklyReport {
  clusterName: string;
  dateRange: DateRange;
  reliabilityScore: number;
  queryMetrics: QueryMetrics;
  topPerformer: TopPerformer;
  bottleneck: Bottleneck;
  segmentHealth: SegmentHealth[];
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run lib/__tests__/types.test.ts
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add lib/types.ts lib/__tests__/types.test.ts
git commit -m "feat: add TypeScript types for Druid MCP data models"
```

---

### Task 4: MCP Client Interface + Mock Implementation

**Files:**
- Create: `lib/mcp-client.ts`
- Create: `lib/mock-client.ts`
- Test: `lib/__tests__/mock-client.test.ts`

**Step 1: Write tests for the mock client**

Create: `lib/__tests__/mock-client.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { createMCPClient } from "../mcp-client";
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  WeeklyReport,
} from "../types";

describe("MockDruidClient", () => {
  const client = createMCPClient("mock");

  it("getClusterStatus returns valid ClusterStatus", async () => {
    const status = await client.getClusterStatus();
    expect(status.clusterName).toBe("druid-prod-01");
    expect(status.uptimePercent).toBeGreaterThan(99);
    expect(status.uptimePercent).toBeLessThanOrEqual(100);
    expect(status.serverCount).toBeGreaterThan(0);
    expect(status.healthyServerCount).toBeLessThanOrEqual(status.serverCount);
    expect(status.timestamp).toBeTruthy();
  });

  it("getActiveTasks returns array of tasks", async () => {
    const tasks = await client.getActiveTasks();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.taskId).toBeTruthy();
      expect(task.datasource).toBeTruthy();
      expect(["RUNNING", "SUCCESS", "FAILED", "WAITING"]).toContain(
        task.status
      );
      expect(task.progressPercent).toBeGreaterThanOrEqual(0);
      expect(task.progressPercent).toBeLessThanOrEqual(100);
    }
  });

  it("getQueryMetrics returns valid metrics", async () => {
    const range = {
      start: "2026-02-05T00:00:00Z",
      end: "2026-02-12T00:00:00Z",
    };
    const metrics = await client.getQueryMetrics(range);
    expect(metrics.totalQueries).toBeGreaterThan(0);
    expect(metrics.successfulQueries).toBeLessThanOrEqual(
      metrics.totalQueries
    );
    expect(metrics.failedQueries).toBe(
      metrics.totalQueries - metrics.successfulQueries
    );
    expect(metrics.slaThresholdMs).toBe(1000);
  });

  it("getSegmentHealth returns array of segments", async () => {
    const segments = await client.getSegmentHealth();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg.datasource).toBeTruthy();
      expect(seg.segmentCount).toBeGreaterThan(0);
      expect(typeof seg.needsCompaction).toBe("boolean");
    }
  });

  it("getQueryVelocity returns QPS time series", async () => {
    const points = await client.getQueryVelocity();
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.timestamp).toBeTruthy();
      expect(point.qps).toBeGreaterThan(0);
    }
  });

  it("getWeeklyReport returns a complete report", async () => {
    const range = {
      start: "2026-02-05T00:00:00Z",
      end: "2026-02-12T00:00:00Z",
    };
    const report = await client.getWeeklyReport(range);
    expect(report.clusterName).toBe("druid-prod-01");
    expect(report.reliabilityScore).toBeGreaterThan(99);
    expect(report.topPerformer.datasource).toBeTruthy();
    expect(report.bottleneck.taskId).toBeTruthy();
    expect(report.segmentHealth.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run lib/__tests__/mock-client.test.ts
```

Expected: FAIL — cannot find module `../mcp-client`.

**Step 3: Write the MCP client interface and factory**

Create: `lib/mcp-client.ts`

```typescript
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
} from "./types";

export interface DruidMCPClient {
  getClusterStatus(): Promise<ClusterStatus>;
  getActiveTasks(): Promise<Task[]>;
  getQueryMetrics(range: DateRange): Promise<QueryMetrics>;
  getSegmentHealth(): Promise<SegmentHealth[]>;
  getQueryVelocity(): Promise<QpsPoint[]>;
  getWeeklyReport(range: DateRange): Promise<WeeklyReport>;
}

export function createMCPClient(mode?: string): DruidMCPClient {
  const resolvedMode = mode ?? process.env.MCP_MODE ?? "mock";

  if (resolvedMode === "mock") {
    // Dynamic import avoided for simplicity; direct import
    const { MockDruidClient } = require("./mock-client");
    return new MockDruidClient();
  }

  throw new Error(`Unknown MCP_MODE: ${resolvedMode}. Only "mock" is currently supported.`);
}
```

**Step 4: Write the mock client implementation**

Create: `lib/mock-client.ts`

```typescript
import type {
  ClusterStatus,
  Task,
  QueryMetrics,
  SegmentHealth,
  QpsPoint,
  DateRange,
  WeeklyReport,
  TopPerformer,
  Bottleneck,
} from "./types";
import type { DruidMCPClient } from "./mcp-client";

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

const DATASOURCES = [
  "wiki_edits",
  "ad_clicks",
  "event_logs",
  "user_sessions",
  "page_views",
  "search_queries",
];

export class MockDruidClient implements DruidMCPClient {
  async getClusterStatus(): Promise<ClusterStatus> {
    const serverCount = 12;
    const healthyCount = Math.random() > 0.1 ? serverCount : serverCount - 1;
    return {
      clusterName: "druid-prod-01",
      uptimePercent: parseFloat(rand(99.9, 99.99).toFixed(2)),
      serverCount,
      healthyServerCount: healthyCount,
      timestamp: new Date().toISOString(),
    };
  }

  async getActiveTasks(): Promise<Task[]> {
    const count = randInt(2, 5);
    return Array.from({ length: count }, (_, i) => ({
      taskId: `index_${DATASOURCES[i % DATASOURCES.length]}_${new Date().toISOString().slice(0, 10)}`,
      datasource: DATASOURCES[i % DATASOURCES.length],
      status: "RUNNING" as const,
      duration: randInt(30000, 600000),
      rowCount: randInt(100000, 10000000),
      progressPercent: randInt(10, 95),
      createdTime: new Date(Date.now() - randInt(60000, 600000)).toISOString(),
    }));
  }

  async getQueryMetrics(range: DateRange): Promise<QueryMetrics> {
    const total = randInt(80000, 120000);
    const failed = randInt(20, 100);
    return {
      totalQueries: total,
      successfulQueries: total - failed,
      failedQueries: failed,
      avgQueryTimeMs: randInt(150, 400),
      queriesOverSla: randInt(100, 500),
      slaThresholdMs: 1000,
    };
  }

  async getSegmentHealth(): Promise<SegmentHealth[]> {
    return DATASOURCES.slice(0, 4).map((ds) => {
      const segCount = randInt(50, 800);
      const totalSize = randInt(500_000_000, 5_000_000_000);
      const avgSize = Math.floor(totalSize / segCount);
      const needsCompaction = avgSize < 100_000_000 || segCount > 500;
      return {
        datasource: ds,
        segmentCount: segCount,
        totalSizeBytes: totalSize,
        avgSegmentSizeBytes: avgSize,
        needsCompaction,
        reason: needsCompaction
          ? avgSize < 100_000_000
            ? "Segments too small (< 100MB avg)"
            : "High segment count (> 500)"
          : "Healthy",
      };
    });
  }

  async getQueryVelocity(): Promise<QpsPoint[]> {
    const now = Date.now();
    return Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date(now - (19 - i) * 15000).toISOString(),
      qps: randInt(800, 1500),
    }));
  }

  async getWeeklyReport(range: DateRange): Promise<WeeklyReport> {
    const metrics = await this.getQueryMetrics(range);
    const reliability = parseFloat(
      ((metrics.successfulQueries / metrics.totalQueries) * 100).toFixed(2)
    );

    const topPerformer: TopPerformer = {
      datasource: "wiki_edits",
      rowsIngested: randInt(30_000_000, 80_000_000),
      durationMs: randInt(120000, 300000),
    };

    const bottleneck: Bottleneck = {
      taskId: "index_ad_clicks_2026-02-10",
      datasource: "ad_clicks",
      durationMs: randInt(600000, 1200000),
      rowsPerSec: parseFloat(rand(5, 25).toFixed(1)),
      failureCount: randInt(1, 5),
    };

    const segments = await this.getSegmentHealth();

    return {
      clusterName: "druid-prod-01",
      dateRange: range,
      reliabilityScore: reliability,
      queryMetrics: metrics,
      topPerformer,
      bottleneck,
      segmentHealth: segments,
    };
  }
}
```

**Step 5: Run tests to verify they pass**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run lib/__tests__/mock-client.test.ts
```

Expected: All 6 tests PASS.

**Step 6: Commit**

```bash
git add lib/mcp-client.ts lib/mock-client.ts lib/__tests__/mock-client.test.ts
git commit -m "feat: add DruidMCPClient interface and mock implementation"
```

---

### Task 5: API Routes

**Files:**
- Create: `app/api/cluster/status/route.ts`
- Create: `app/api/cluster/tasks/route.ts`
- Create: `app/api/cluster/qps/route.ts`

**Step 1: Write API route for cluster status**

Create: `app/api/cluster/status/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const status = await client.getClusterStatus();
  return NextResponse.json(status);
}
```

**Step 2: Write API route for active tasks**

Create: `app/api/cluster/tasks/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const tasks = await client.getActiveTasks();
  return NextResponse.json(tasks);
}
```

**Step 3: Write API route for QPS**

Create: `app/api/cluster/qps/route.ts`

```typescript
import { NextResponse } from "next/server";
import { createMCPClient } from "@/lib/mcp-client";

export async function GET() {
  const client = createMCPClient();
  const qps = await client.getQueryVelocity();
  return NextResponse.json(qps);
}
```

**Step 4: Verify build**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add app/api/
git commit -m "feat: add API routes for cluster status, tasks, and QPS"
```

---

### Task 6: Nav Component + Root Layout

**Files:**
- Create: `components/Nav.tsx`
- Modify: `app/layout.tsx`
- Create: `app/page.tsx` (redirect)
- Test: `components/__tests__/Nav.test.tsx`

**Step 1: Write test for Nav component**

Create: `components/__tests__/Nav.test.tsx`

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "../Nav";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Nav", () => {
  it("renders the app name", () => {
    render(<Nav />);
    expect(screen.getByText("daily-crust")).toBeTruthy();
  });

  it("renders navigation links", () => {
    render(<Nav />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Weekly")).toBeTruthy();
  });

  it("links to correct paths", () => {
    render(<Nav />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const weeklyLink = screen.getByText("Weekly").closest("a");
    expect(dashboardLink?.getAttribute("href")).toBe("/dashboard");
    expect(weeklyLink?.getAttribute("href")).toBe("/weekly");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/Nav.test.tsx
```

Expected: FAIL — cannot find module `../Nav`.

**Step 3: Write Nav component**

Create: `components/Nav.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/weekly", label: "Weekly" },
  ];

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-surface-card">
      <span className="text-lg font-bold tracking-tight text-text-primary">
        daily-crust
      </span>
      <div className="flex gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              pathname === link.href
                ? "bg-brand-green text-surface-base"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-card"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/Nav.test.tsx
```

Expected: All 3 tests PASS.

**Step 5: Update root layout**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "daily-crust",
  description: "Druid cluster monitoring dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-base text-text-primary min-h-screen">
        <Nav />
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

**Step 6: Create root page redirect**

Replace `app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

**Step 7: Verify build**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds.

**Step 8: Commit**

```bash
git add components/Nav.tsx components/__tests__/Nav.test.tsx app/layout.tsx app/page.tsx
git commit -m "feat: add Nav component and root layout with Spotify dark theme"
```

---

### Task 7: MetricTile Component

**Files:**
- Create: `components/MetricTile.tsx`
- Test: `components/__tests__/MetricTile.test.tsx`

**Step 1: Write test for MetricTile**

Create: `components/__tests__/MetricTile.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricTile } from "../MetricTile";

describe("MetricTile", () => {
  it("renders label and value", () => {
    render(<MetricTile label="Uptime" value="99.97%" />);
    expect(screen.getByText("Uptime")).toBeTruthy();
    expect(screen.getByText("99.97%")).toBeTruthy();
  });

  it("renders subtitle when provided", () => {
    render(
      <MetricTile label="Active Tasks" value="12" subtitle="3 waiting" />
    );
    expect(screen.getByText("3 waiting")).toBeTruthy();
  });

  it("applies status color class for success", () => {
    const { container } = render(
      <MetricTile label="Uptime" value="99.97%" status="success" />
    );
    const valueEl = container.querySelector("[data-testid='metric-value']");
    expect(valueEl?.className).toContain("text-brand-green");
  });

  it("applies status color class for error", () => {
    const { container } = render(
      <MetricTile label="Failures" value="42" status="error" />
    );
    const valueEl = container.querySelector("[data-testid='metric-value']");
    expect(valueEl?.className).toContain("text-brand-red");
  });

  it("renders children (for sparklines etc.)", () => {
    render(
      <MetricTile label="QPS" value="1,247">
        <div data-testid="sparkline">chart</div>
      </MetricTile>
    );
    expect(screen.getByTestId("sparkline")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/MetricTile.test.tsx
```

Expected: FAIL.

**Step 3: Write MetricTile component**

Create: `components/MetricTile.tsx`

```tsx
type Status = "success" | "warning" | "error" | "neutral";

const statusColors: Record<Status, string> = {
  success: "text-brand-green",
  warning: "text-brand-yellow",
  error: "text-brand-red",
  neutral: "text-text-primary",
};

interface MetricTileProps {
  label: string;
  value: string;
  subtitle?: string;
  status?: Status;
  children?: React.ReactNode;
}

export function MetricTile({
  label,
  value,
  subtitle,
  status = "neutral",
  children,
}: MetricTileProps) {
  return (
    <div className="bg-surface-card rounded-card p-5 hover:bg-surface-hover transition-colors">
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      <p
        data-testid="metric-value"
        className={`text-3xl font-bold tracking-tight ${statusColors[status]}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/MetricTile.test.tsx
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add components/MetricTile.tsx components/__tests__/MetricTile.test.tsx
git commit -m "feat: add MetricTile component"
```

---

### Task 8: QpsChart Component

**Files:**
- Create: `components/QpsChart.tsx`
- Test: `components/__tests__/QpsChart.test.tsx`

**Step 1: Write test for QpsChart**

Create: `components/__tests__/QpsChart.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QpsChart } from "../QpsChart";
import type { QpsPoint } from "@/lib/types";

// Mock Recharts — it doesn't render in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const mockData: QpsPoint[] = [
  { timestamp: "2026-02-12T10:00:00Z", qps: 1000 },
  { timestamp: "2026-02-12T10:00:15Z", qps: 1100 },
  { timestamp: "2026-02-12T10:00:30Z", qps: 950 },
];

describe("QpsChart", () => {
  it("renders the chart container", () => {
    render(<QpsChart data={mockData} />);
    expect(screen.getByTestId("responsive-container")).toBeTruthy();
  });

  it("renders the area chart", () => {
    render(<QpsChart data={mockData} />);
    expect(screen.getByTestId("area-chart")).toBeTruthy();
  });

  it("renders empty state when no data", () => {
    render(<QpsChart data={[]} />);
    expect(screen.getByText("No data")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/QpsChart.test.tsx
```

Expected: FAIL.

**Step 3: Write QpsChart component**

Create: `components/QpsChart.tsx`

```tsx
"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { QpsPoint } from "@/lib/types";

interface QpsChartProps {
  data: QpsPoint[];
}

export function QpsChart({ data }: QpsChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-text-secondary text-sm">
        No data
      </div>
    );
  }

  const formatted = data.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    qps: p.qps,
  }));

  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="qpsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1DB954" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#1DB954" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: "#282828",
            border: "none",
            borderRadius: "8px",
            color: "#FFFFFF",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="qps"
          stroke="#1DB954"
          fill="url(#qpsGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/QpsChart.test.tsx
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add components/QpsChart.tsx components/__tests__/QpsChart.test.tsx
git commit -m "feat: add QpsChart sparkline component"
```

---

### Task 9: IngestionList Component

**Files:**
- Create: `components/IngestionList.tsx`
- Test: `components/__tests__/IngestionList.test.tsx`

**Step 1: Write test for IngestionList**

Create: `components/__tests__/IngestionList.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IngestionList } from "../IngestionList";
import type { Task } from "@/lib/types";

const mockTasks: Task[] = [
  {
    taskId: "index_wiki_2026-02-12",
    datasource: "wiki_edits",
    status: "RUNNING",
    duration: 120000,
    rowCount: 5000000,
    progressPercent: 78,
    createdTime: new Date(Date.now() - 120000).toISOString(),
  },
  {
    taskId: "index_ad_clicks_2026-02-12",
    datasource: "ad_clicks",
    status: "RUNNING",
    duration: 60000,
    rowCount: 2000000,
    progressPercent: 55,
    createdTime: new Date(Date.now() - 60000).toISOString(),
  },
];

describe("IngestionList", () => {
  it("renders all tasks", () => {
    render(<IngestionList tasks={mockTasks} />);
    expect(screen.getByText("wiki_edits")).toBeTruthy();
    expect(screen.getByText("ad_clicks")).toBeTruthy();
  });

  it("shows progress percentages", () => {
    render(<IngestionList tasks={mockTasks} />);
    expect(screen.getByText("78%")).toBeTruthy();
    expect(screen.getByText("55%")).toBeTruthy();
  });

  it("renders empty state when no tasks", () => {
    render(<IngestionList tasks={[]} />);
    expect(screen.getByText("No active ingestions")).toBeTruthy();
  });

  it("renders the section heading", () => {
    render(<IngestionList tasks={mockTasks} />);
    expect(screen.getByText("Active Ingestions")).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/IngestionList.test.tsx
```

Expected: FAIL.

**Step 3: Write IngestionList component**

Create: `components/IngestionList.tsx`

```tsx
import type { Task } from "@/lib/types";

interface IngestionListProps {
  tasks: Task[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function IngestionList({ tasks }: IngestionListProps) {
  return (
    <div>
      <h2 className="text-sm font-medium text-text-secondary mb-3">
        Active Ingestions
      </h2>
      {tasks.length === 0 ? (
        <div className="bg-surface-card rounded-card p-6 text-center text-text-secondary text-sm">
          No active ingestions
        </div>
      ) : (
        <div className="bg-surface-card rounded-card divide-y divide-surface-base">
          {tasks.map((task) => (
            <div
              key={task.taskId}
              className="flex items-center gap-4 px-4 py-3 hover:bg-surface-hover transition-colors"
            >
              <span className="text-sm font-medium text-text-primary w-32 truncate">
                {task.datasource}
              </span>
              <div className="flex-1 h-2 bg-surface-base rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all"
                  style={{ width: `${task.progressPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-text-primary w-10 text-right">
                {task.progressPercent}%
              </span>
              <span className="text-xs text-text-secondary w-16 text-right">
                {formatDuration(task.duration)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/IngestionList.test.tsx
```

Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add components/IngestionList.tsx components/__tests__/IngestionList.test.tsx
git commit -m "feat: add IngestionList component with progress bars"
```

---

### Task 10: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

**Step 1: Write the dashboard page**

Create: `app/dashboard/page.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { MetricTile } from "@/components/MetricTile";
import { QpsChart } from "@/components/QpsChart";
import { IngestionList } from "@/components/IngestionList";
import type { ClusterStatus, Task, QpsPoint } from "@/lib/types";

const POLL_INTERVAL = 15000;

function getUptimeStatus(pct: number): "success" | "warning" | "error" {
  if (pct >= 99.9) return "success";
  if (pct >= 99.5) return "warning";
  return "error";
}

export default function DashboardPage() {
  const [status, setStatus] = useState<ClusterStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [qps, setQps] = useState<QpsPoint[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const fetchData = useCallback(async () => {
    const [statusRes, tasksRes, qpsRes] = await Promise.all([
      fetch("/api/cluster/status"),
      fetch("/api/cluster/tasks"),
      fetch("/api/cluster/qps"),
    ]);
    setStatus(await statusRes.json());
    setTasks(await tasksRes.json());
    setQps(await qpsRes.json());
    setLastUpdated(new Date());
    setSecondsAgo(0);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const currentQps = qps.length > 0 ? qps[qps.length - 1].qps : 0;
  const runningTasks = tasks.filter((t) => t.status === "RUNNING");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricTile
          label="Uptime"
          value={status ? `${status.uptimePercent}%` : "---"}
          subtitle={
            status
              ? `${status.healthyServerCount}/${status.serverCount} servers`
              : undefined
          }
          status={status ? getUptimeStatus(status.uptimePercent) : "neutral"}
        />
        <MetricTile
          label="Query Velocity"
          value={currentQps ? `${currentQps.toLocaleString()}/s` : "---"}
          status="neutral"
        >
          <QpsChart data={qps} />
        </MetricTile>
        <MetricTile
          label="Active Tasks"
          value={String(runningTasks.length)}
          subtitle={
            tasks.length !== runningTasks.length
              ? `${tasks.length - runningTasks.length} other`
              : undefined
          }
          status="neutral"
        />
      </div>

      <IngestionList tasks={runningTasks} />

      <div className="flex items-center justify-end gap-2 text-xs text-text-secondary">
        <span className="inline-block w-2 h-2 rounded-full bg-brand-green animate-pulse" />
        <span>
          Last updated: {secondsAgo}s ago
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add live dashboard page with polling"
```

---

### Task 11: WeeklyReportCard Component

**Files:**
- Create: `components/WeeklyReportCard.tsx`
- Test: `components/__tests__/WeeklyReportCard.test.tsx`

**Step 1: Write test for WeeklyReportCard**

Create: `components/__tests__/WeeklyReportCard.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyReportCard } from "../WeeklyReportCard";

describe("WeeklyReportCard", () => {
  it("renders title and children", () => {
    render(
      <WeeklyReportCard title="Cluster Reliability">
        <p>99.94%</p>
      </WeeklyReportCard>
    );
    expect(screen.getByText("Cluster Reliability")).toBeTruthy();
    expect(screen.getByText("99.94%")).toBeTruthy();
  });

  it("applies accent color class", () => {
    const { container } = render(
      <WeeklyReportCard title="SLA Watch" accent="red">
        <p>Content</p>
      </WeeklyReportCard>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-brand-red");
  });

  it("defaults to no accent border", () => {
    const { container } = render(
      <WeeklyReportCard title="Test">
        <p>Content</p>
      </WeeklyReportCard>
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("border-brand");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/WeeklyReportCard.test.tsx
```

Expected: FAIL.

**Step 3: Write WeeklyReportCard component**

Create: `components/WeeklyReportCard.tsx`

```tsx
type Accent = "green" | "red" | "yellow" | "none";

const accentBorders: Record<Accent, string> = {
  green: "border-l-4 border-brand-green",
  red: "border-l-4 border-brand-red",
  yellow: "border-l-4 border-brand-yellow",
  none: "",
};

interface WeeklyReportCardProps {
  title: string;
  accent?: Accent;
  children: React.ReactNode;
}

export function WeeklyReportCard({
  title,
  accent = "none",
  children,
}: WeeklyReportCardProps) {
  return (
    <div
      className={`bg-surface-card rounded-card p-6 ${accentBorders[accent]}`}
    >
      <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/WeeklyReportCard.test.tsx
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add components/WeeklyReportCard.tsx components/__tests__/WeeklyReportCard.test.tsx
git commit -m "feat: add WeeklyReportCard component"
```

---

### Task 12: ReliabilityScore Component

**Files:**
- Create: `components/ReliabilityScore.tsx`
- Test: `components/__tests__/ReliabilityScore.test.tsx`

**Step 1: Write test for ReliabilityScore**

Create: `components/__tests__/ReliabilityScore.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReliabilityScore } from "../ReliabilityScore";

describe("ReliabilityScore", () => {
  it("displays the score as a percentage", () => {
    render(<ReliabilityScore score={99.94} total={100000} successful={99940} />);
    expect(screen.getByText("99.94%")).toBeTruthy();
  });

  it("shows success/total subtext", () => {
    render(<ReliabilityScore score={99.94} total={100000} successful={99940} />);
    expect(screen.getByText(/99,940 of 100,000 queries succeeded/)).toBeTruthy();
  });

  it("uses green color for >= 99.9", () => {
    const { container } = render(
      <ReliabilityScore score={99.94} total={100000} successful={99940} />
    );
    const scoreEl = container.querySelector("[data-testid='reliability-score']");
    expect(scoreEl?.className).toContain("text-brand-green");
  });

  it("uses yellow color for >= 99.5 and < 99.9", () => {
    const { container } = render(
      <ReliabilityScore score={99.7} total={100000} successful={99700} />
    );
    const scoreEl = container.querySelector("[data-testid='reliability-score']");
    expect(scoreEl?.className).toContain("text-brand-yellow");
  });

  it("uses red color for < 99.5", () => {
    const { container } = render(
      <ReliabilityScore score={99.2} total={100000} successful={99200} />
    );
    const scoreEl = container.querySelector("[data-testid='reliability-score']");
    expect(scoreEl?.className).toContain("text-brand-red");
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/ReliabilityScore.test.tsx
```

Expected: FAIL.

**Step 3: Write ReliabilityScore component**

Create: `components/ReliabilityScore.tsx`

```tsx
interface ReliabilityScoreProps {
  score: number;
  total: number;
  successful: number;
}

function getScoreColor(score: number): string {
  if (score >= 99.9) return "text-brand-green";
  if (score >= 99.5) return "text-brand-yellow";
  return "text-brand-red";
}

export function ReliabilityScore({
  score,
  total,
  successful,
}: ReliabilityScoreProps) {
  return (
    <div className="text-center py-4">
      <p
        data-testid="reliability-score"
        className={`text-6xl font-bold tracking-tight ${getScoreColor(score)}`}
      >
        {score}%
      </p>
      <p className="text-text-secondary mt-2">
        {successful.toLocaleString()} of {total.toLocaleString()} queries
        succeeded
      </p>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run components/__tests__/ReliabilityScore.test.tsx
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add components/ReliabilityScore.tsx components/__tests__/ReliabilityScore.test.tsx
git commit -m "feat: add ReliabilityScore component with color-coded display"
```

---

### Task 13: Weekly Report Page ("Druid Wrapped")

**Files:**
- Create: `app/weekly/page.tsx`

**Step 1: Write the weekly report page**

Create: `app/weekly/page.tsx`

```tsx
import { createMCPClient } from "@/lib/mcp-client";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { ReliabilityScore } from "@/components/ReliabilityScore";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(1)} KB`;
}

export default async function WeeklyPage() {
  const client = createMCPClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const range = {
    start: weekAgo.toISOString(),
    end: now.toISOString(),
  };

  const report = await client.getWeeklyReport(range);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-card p-8 bg-gradient-to-b from-brand-green/20 to-surface-base text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Your Week in Druid
        </h1>
        <p className="text-text-secondary">
          {report.clusterName} &middot;{" "}
          {new Date(report.dateRange.start).toLocaleDateString()} &ndash;{" "}
          {new Date(report.dateRange.end).toLocaleDateString()}
        </p>
      </div>

      {/* Reliability Score */}
      <WeeklyReportCard
        title="Cluster Reliability"
        accent={report.reliabilityScore >= 99.9 ? "green" : report.reliabilityScore >= 99.5 ? "yellow" : "red"}
      >
        <ReliabilityScore
          score={report.reliabilityScore}
          total={report.queryMetrics.totalQueries}
          successful={report.queryMetrics.successfulQueries}
        />
      </WeeklyReportCard>

      {/* Top Performer */}
      <WeeklyReportCard title="Top Performer" accent="green">
        <p className="text-2xl font-bold mb-1">
          {report.topPerformer.datasource}
        </p>
        <p className="text-text-secondary">
          {report.topPerformer.rowsIngested.toLocaleString()} rows ingested in{" "}
          {formatDuration(report.topPerformer.durationMs)}
        </p>
        <p className="text-sm text-brand-green mt-2">
          {Math.floor(
            report.topPerformer.rowsIngested /
              (report.topPerformer.durationMs / 1000)
          ).toLocaleString()}{" "}
          rows/sec
        </p>
      </WeeklyReportCard>

      {/* The Bottleneck */}
      <WeeklyReportCard title="The Bottleneck" accent="red">
        <p className="text-2xl font-bold mb-1">
          {report.bottleneck.datasource}
        </p>
        <p className="text-text-secondary">
          Task: {report.bottleneck.taskId}
        </p>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="text-brand-red">
            {report.bottleneck.failureCount} failures
          </span>
          <span className="text-text-secondary">
            {formatDuration(report.bottleneck.durationMs)} duration
          </span>
          <span className="text-text-secondary">
            {report.bottleneck.rowsPerSec} rows/sec
          </span>
        </div>
      </WeeklyReportCard>

      {/* SLA Watch */}
      <WeeklyReportCard
        title="SLA Watch"
        accent={report.queryMetrics.queriesOverSla > 100 ? "yellow" : "green"}
      >
        <p className="text-4xl font-bold mb-1">
          {report.queryMetrics.queriesOverSla.toLocaleString()}
        </p>
        <p className="text-text-secondary mb-3">
          queries exceeded {report.queryMetrics.slaThresholdMs}ms threshold
        </p>
        <div className="h-2 bg-surface-base rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-yellow rounded-full"
            style={{
              width: `${Math.min(
                (report.queryMetrics.queriesOverSla /
                  report.queryMetrics.totalQueries) *
                  100 *
                  50, // Scale up for visibility
                100
              )}%`,
            }}
          />
        </div>
      </WeeklyReportCard>

      {/* Segment Health */}
      <WeeklyReportCard title="Segment Health">
        <div className="space-y-3">
          {report.segmentHealth.map((seg) => (
            <div
              key={seg.datasource}
              className="flex items-center justify-between py-2 border-b border-surface-base last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{seg.datasource}</p>
                <p className="text-xs text-text-secondary">
                  {seg.segmentCount} segments &middot;{" "}
                  {formatBytes(seg.totalSizeBytes)} total &middot; avg{" "}
                  {formatBytes(seg.avgSegmentSizeBytes)}
                </p>
              </div>
              {seg.needsCompaction ? (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-yellow/20 text-brand-yellow">
                  Compaction needed
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-brand-green/20 text-brand-green">
                  Healthy
                </span>
              )}
            </div>
          ))}
        </div>
      </WeeklyReportCard>
    </div>
  );
}
```

**Step 2: Verify build**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add app/weekly/page.tsx
git commit -m "feat: add Druid Wrapped weekly report page"
```

---

### Task 14: Final Integration + Smoke Test

**Files:**
- None new — verification only

**Step 1: Run all tests**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npx vitest run
```

Expected: All tests pass.

**Step 2: Build the project**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Start dev server and verify visually**

Run:
```bash
cd /Users/trinitys/Projects/daily-crust
npm run dev
```

Open `http://localhost:3000` in browser. Verify:
- Root redirects to `/dashboard`
- Dashboard shows three MetricTile cards, QPS chart, ingestion list, refresh indicator
- Nav links work — clicking "Weekly" shows the Druid Wrapped report
- Weekly report shows hero, reliability score, top performer, bottleneck, SLA watch, segment health
- Dark theme is applied throughout
- All text is readable (white on dark backgrounds)

**Step 4: Stop dev server and commit any fixes**

If fixes are needed, commit them. Otherwise:

```bash
git log --oneline
```

Expected: Clean commit history with one commit per task.
