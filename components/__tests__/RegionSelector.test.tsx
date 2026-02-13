import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegionSelector } from "../RegionSelector";

describe("RegionSelector", () => {
  it("renders all region options", () => {
    render(<RegionSelector selected="all" onSelect={vi.fn()} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("GEW1")).toBeInTheDocument();
    expect(screen.getByText("GUC3")).toBeInTheDocument();
    expect(screen.getByText("GAE2")).toBeInTheDocument();
  });

  it("highlights the selected region", () => {
    render(<RegionSelector selected="osd-prod-gew1" onSelect={vi.fn()} />);
    const gew1Button = screen.getByText("GEW1");
    expect(gew1Button.className).toContain("bg-brand-green");
  });

  it("calls onSelect when a region is clicked", () => {
    const onSelect = vi.fn();
    render(<RegionSelector selected="all" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GUC3"));
    expect(onSelect).toHaveBeenCalledWith("osd-prod-guc3");
  });

  it("does not highlight unselected regions", () => {
    render(<RegionSelector selected="osd-prod-gew1" onSelect={vi.fn()} />);
    const allButton = screen.getByText("All");
    expect(allButton.className).not.toContain("bg-brand-green");
  });
});
