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
