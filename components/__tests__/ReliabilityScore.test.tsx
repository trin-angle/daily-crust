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
