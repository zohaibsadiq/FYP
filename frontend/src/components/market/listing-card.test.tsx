import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListingCard } from "./listing-card";
import type { Listing } from "@/types/market";

const onAsk = vi.fn();
const onReport = vi.fn();

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 1,
    item: {
      name: "Blue Kurta",
      brand: "Khaadi",
      size: "M",
      material: "Cotton",
      pattern: "SOLID",
      pattern_label: "Solid",
      category_name: "Kurta",
      category_slot: "TOP",
      display_image_url: "",
      primary_color_hex: "#33568a",
      primary_color_name: "Blue",
    },
    seller: { id: 9, display_name: "Ayesha Khan", city: "Lahore" },
    asking_price: "1600.00",
    currency: "PKR",
    condition: "GOOD",
    condition_label: "Good, worn a few times",
    audience: "WOMEN",
    audience_label: "Women",
    note: "Worn twice, no marks",
    city: "Lahore",
    status: "ACTIVE",
    status_label: "For sale",
    created_at: "2026-09-18T08:00:00Z",
    my_enquiry_status: "",
    ...overrides,
  };
}

beforeEach(() => {
  onAsk.mockReset();
  onReport.mockReset();
});

describe("ListingCard", () => {
  it("shows the price the seller is asking", () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    expect(screen.getByText("Rs 1,600")).toBeInTheDocument();
  });

  it("shows what the thing is, its size and its brand", () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    expect(screen.getByText("Blue Kurta")).toBeInTheDocument();
    expect(screen.getByText(/Kurta - Size M - Khaadi/)).toBeInTheDocument();
  });

  it("says how worn it is", () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    expect(screen.getByText("Good, worn a few times")).toBeInTheDocument();
  });

  it("names the seller and where they are", () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    expect(screen.getByText(/Ayesha Khan, Lahore/)).toBeInTheDocument();
  });

  it("offers a way to ask", async () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    await userEvent.click(screen.getByRole("button", { name: /ask to buy/i }));
    expect(onAsk).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("stops offering once somebody has already asked", () => {
    render(
      <ListingCard listing={listing({ my_enquiry_status: "SENT" })} onAsk={onAsk} onReport={onReport} />,
    );
    expect(screen.queryByRole("button", { name: /ask to buy/i })).not.toBeInTheDocument();
    expect(screen.getByText(/waiting for a reply/i)).toBeInTheDocument();
  });

  it("says plainly when the seller agreed", () => {
    render(
      <ListingCard
        listing={listing({ my_enquiry_status: "ACCEPTED" })}
        onAsk={onAsk}
        onReport={onReport}
      />,
    );
    expect(screen.getByText(/they said yes/i)).toBeInTheDocument();
  });

  it("says when a request came to nothing", () => {
    render(
      <ListingCard
        listing={listing({ my_enquiry_status: "DECLINED" })}
        onAsk={onAsk}
        onReport={onReport}
      />,
    );
    expect(screen.getByText(/this one is closed/i)).toBeInTheDocument();
  });

  it("offers a way to report it", async () => {
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    await userEvent.click(screen.getByRole("button", { name: /report this/i }));
    expect(onReport).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("never shows anything private about the seller's own use of it", () => {
    // The server does not send these at all. This guards against somebody
    // later swapping in the closet's own serializer, which does.
    render(<ListingCard listing={listing()} onAsk={onAsk} onReport={onReport} />);
    // Named precisely. A loose pattern like /times/ would match the honest
    // condition label "worn a few times" and fail for the wrong reason.
    for (const leak of [
      /cost per wear/i,
      /worn \d+ times?/i,
      /last worn/i,
      /kept in/i,
      /you paid/i,
      /rs [\d,]+ paid/i,
    ]) {
      expect(screen.queryByText(leak)).not.toBeInTheDocument();
    }
  });
});
