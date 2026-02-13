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
