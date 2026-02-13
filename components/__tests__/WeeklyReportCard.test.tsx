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
