import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClusterSelector } from "../ClusterSelector";

// RegionSelector has been replaced by ClusterSelector
// These tests verify ClusterSelector maintains region selection behavior
describe("ClusterSelector (formerly RegionSelector)", () => {
  it("renders all region options for music", () => {
    render(
      <ClusterSelector
        product="music"
        region="all"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("GEW1")).toBeInTheDocument();
    expect(screen.getByText("GUC3")).toBeInTheDocument();
  });

  it("highlights the selected region", () => {
    render(
      <ClusterSelector
        product="music"
        region="gew1"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    const gew1Button = screen.getByText("GEW1");
    expect(gew1Button.className).toContain("bg-brand-green");
  });

  it("calls onRegionChange when a region is clicked", () => {
    const onRegionChange = vi.fn();
    render(
      <ClusterSelector
        product="music"
        region="all"
        onProductChange={vi.fn()}
        onRegionChange={onRegionChange}
      />
    );
    fireEvent.click(screen.getByText("GUC3"));
    expect(onRegionChange).toHaveBeenCalledWith("guc3");
  });

  it("does not highlight unselected regions", () => {
    render(
      <ClusterSelector
        product="music"
        region="gew1"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    const allButton = screen.getByText("All");
    expect(allButton.className).not.toContain("bg-brand-green");
  });
});
