"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
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
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
        <Area type="monotone" dataKey="qps" stroke="#1DB954" fill="url(#qpsGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
