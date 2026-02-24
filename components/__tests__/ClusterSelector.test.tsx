import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClusterSelector } from "../ClusterSelector";

describe("ClusterSelector", () => {
  it("renders product and region options for music", () => {
    render(
      <ClusterSelector
        product="music"
        region="all"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("Podcast")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("GEW1")).toBeInTheDocument();
    expect(screen.getByText("GUC3")).toBeInTheDocument();
  });

  it("renders podcast regions when podcast is selected", () => {
    render(
      <ClusterSelector
        product="podcast"
        region="all"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    expect(screen.getByText("GEW4")).toBeInTheDocument();
    expect(screen.getByText("GUC3")).toBeInTheDocument();
  });

  it("highlights the selected product", () => {
    render(
      <ClusterSelector
        product="music"
        region="all"
        onProductChange={vi.fn()}
        onRegionChange={vi.fn()}
      />
    );
    const musicBtn = screen.getByText("Music");
    expect(musicBtn.className).toContain("bg-brand-green");
    const podcastBtn = screen.getByText("Podcast");
    expect(podcastBtn.className).not.toContain("bg-brand-green");
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
    const gew1Btn = screen.getByText("GEW1");
    expect(gew1Btn.className).toContain("bg-brand-green");
  });

  it("calls onProductChange and resets region when product clicked", () => {
    const onProductChange = vi.fn();
    const onRegionChange = vi.fn();
    render(
      <ClusterSelector
        product="music"
        region="gew1"
        onProductChange={onProductChange}
        onRegionChange={onRegionChange}
      />
    );
    fireEvent.click(screen.getByText("Podcast"));
    expect(onProductChange).toHaveBeenCalledWith("podcast");
    expect(onRegionChange).toHaveBeenCalledWith("all");
  });

  it("calls onRegionChange when region clicked", () => {
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
});
