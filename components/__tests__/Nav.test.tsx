import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "../Nav";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Nav", () => {
  it("renders the app name", () => {
    render(<Nav />);
    expect(screen.getByText("daily-crust")).toBeTruthy();
  });

  it("renders navigation links", () => {
    render(<Nav />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Weekly")).toBeTruthy();
  });

  it("links to correct paths", () => {
    render(<Nav />);
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    const weeklyLink = screen.getByText("Weekly").closest("a");
    expect(dashboardLink?.getAttribute("href")).toBe("/dashboard");
    expect(weeklyLink?.getAttribute("href")).toBe("/weekly");
  });
});
