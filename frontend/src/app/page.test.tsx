import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LandingPage from "./page";

describe("LandingPage", () => {
  it("leads with the one thing the app is for", () => {
    render(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/everything you own/i);
  });

  it("offers both doors in, at the top and at the bottom", () => {
    render(<LandingPage />);
    const create = screen.getAllByRole("link", { name: /create your closet/i });
    const signIn = screen.getAllByRole("link", { name: /sign in/i });
    expect(create.length).toBeGreaterThanOrEqual(2);
    expect(create.every((link) => link.getAttribute("href") === "/register")).toBe(true);
    expect(signIn.every((link) => link.getAttribute("href") === "/login")).toBe(true);
  });

  it("names every feature of the app", () => {
    render(<LandingPage />);
    for (const name of [
      "My Clothes",
      "Where Things Are",
      "Weather and Plans",
      "Sales",
      "Buy and Sell",
      "Borrow from Friends",
      "Try It On",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("names the shops it watches, once each for a reader", () => {
    render(<LandingPage />);
    expect(screen.getAllByText("Junaid Jamshed").length).toBeGreaterThanOrEqual(1);
  });

  it("answers the questions people ask first", () => {
    render(<LandingPage />);
    expect(screen.getByText("Does it cost anything?")).toBeInTheDocument();
    expect(screen.getByText("Who can see my clothes?")).toBeInTheDocument();
  });
});
