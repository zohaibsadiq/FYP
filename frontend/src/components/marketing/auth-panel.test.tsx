import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthPanel, AuthSwitch } from "./auth-panel";

let segment = "login";
vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => segment }));

describe("AuthSwitch", () => {
  it("points a visitor on the sign-in page to sign up", () => {
    segment = "login";
    render(<AuthSwitch />);
    expect(screen.getByRole("link", { name: /create your closet/i })).toHaveAttribute("href", "/register");
  });

  it("points a visitor on the sign-up page to sign in", () => {
    segment = "register";
    render(<AuthSwitch />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});

describe("AuthPanel", () => {
  it("shows a different picture and promise on each page", () => {
    segment = "login";
    const { unmount } = render(<AuthPanel />);
    expect(screen.getByText(/where you left it/i)).toBeInTheDocument();
    unmount();

    segment = "register";
    render(<AuthPanel />);
    expect(screen.getByText(/with one item/i)).toBeInTheDocument();
  });
});
