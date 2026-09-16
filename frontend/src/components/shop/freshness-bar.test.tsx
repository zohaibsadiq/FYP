import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FreshnessBar } from "./freshness-bar";
import type { Freshness } from "@/types/shopping";

function freshness(overrides: Partial<Freshness> = {}): Freshness {
  return {
    checked_at: "2026-09-15T06:00:00Z",
    is_stale: false,
    stale_after_hours: 24,
    summary: "Prices checked 2 hours ago.",
    shops_working: 8,
    shops_total: 8,
    deals_listed: 7411,
    deals_on_sale: 4325,
    shops: [
      {
        id: 1,
        name: "Outfitters",
        slug: "outfitters",
        site_url: "https://outfitters.com.pk",
        currency: "PKR",
        last_checked_at: "2026-09-15T06:00:00Z",
        last_result: "OK",
        last_result_label: "Last check succeeded",
        deal_count: 967,
      },
    ],
    ...overrides,
  };
}

describe("FreshnessBar", () => {
  it("says how old the prices are without being asked", () => {
    render(<FreshnessBar freshness={freshness()} />);
    expect(screen.getByText("Prices checked 2 hours ago.")).toBeInTheDocument();
  });

  it("warns plainly when the prices are older than we will vouch for", () => {
    render(
      <FreshnessBar
        freshness={freshness({
          is_stale: true,
          summary: "Prices were last checked 3 days ago and may have moved since.",
        })}
      />,
    );
    expect(screen.getByText(/may have moved since/i)).toBeInTheDocument();
  });

  it("says how many shops answered, so a gap is never silent", () => {
    render(<FreshnessBar freshness={freshness({ shops_working: 6 })} />);
    expect(screen.getByRole("button", { name: /6 of 8 shops/i })).toHaveTextContent(
      /2 not answering/i,
    );
  });

  it("keeps the shop list closed until it is asked for", () => {
    render(<FreshnessBar freshness={freshness()} />);
    expect(screen.queryByRole("link", { name: "Outfitters" })).not.toBeInTheDocument();
  });

  it("opens the shop list on request and links to each one", async () => {
    render(<FreshnessBar freshness={freshness()} />);
    await userEvent.click(screen.getByRole("button", { name: /shops/i }));

    const link = screen.getByRole("link", { name: "Outfitters" });
    expect(link).toHaveAttribute("href", "https://outfitters.com.pk");
    expect(screen.getByText(/967 things/)).toBeInTheDocument();
  });

  it("marks a shop whose last check failed rather than hiding it", async () => {
    render(
      <FreshnessBar
        freshness={freshness({
          shops_working: 7,
          shops: [
            {
              ...freshness().shops[0],
              last_result: "FAILED",
              last_result_label: "Last check failed",
            },
          ],
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /shops/i }));
    expect(screen.getByText(/last check failed/i)).toBeInTheDocument();
  });

  it("draws nothing at all when there is nothing to report", () => {
    const { container } = render(<FreshnessBar />);
    expect(container).toBeEmptyDOMElement();
  });
});
