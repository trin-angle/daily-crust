import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QpsChart } from "../QpsChart";
import type { QpsPoint } from "@/lib/types";

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
