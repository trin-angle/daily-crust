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
    render(<MetricTile label="Active Tasks" value="12" subtitle="3 waiting" />);
    expect(screen.getByText("3 waiting")).toBeTruthy();
  });

  it("applies status color class for success", () => {
    const { container } = render(<MetricTile label="Uptime" value="99.97%" status="success" />);
    const valueEl = container.querySelector("[data-testid='metric-value']");
    expect(valueEl?.className).toContain("text-brand-green");
  });

  it("applies status color class for error", () => {
    const { container } = render(<MetricTile label="Failures" value="42" status="error" />);
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
