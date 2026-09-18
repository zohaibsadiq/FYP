import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EnquiryCard } from "./enquiry-card";
import type { Enquiry } from "@/types/market";

const onAccept = vi.fn();
const onDecline = vi.fn();
const onWithdraw = vi.fn();

function enquiry(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 5,
    listing: {
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
      condition_label: "Good",
      audience: "WOMEN",
      audience_label: "Women",
      note: "",
      city: "Lahore",
      status: "ACTIVE",
      status_label: "For sale",
      created_at: "2026-09-18T08:00:00Z",
      my_enquiry_status: "SENT",
    },
    buyer: { id: 4, display_name: "Sara Ali", city: "Karachi" },
    message: "Is this still available?",
    status: "SENT",
    status_label: "Waiting for the seller",
    created_at: "2026-09-18T09:00:00Z",
    answered_at: null,
    contact: null,
    ...overrides,
  };
}

const AGREED = {
  status: "ACCEPTED" as const,
  status_label: "Seller said yes",
  contact: {
    name: "Ayesha Khan",
    city: "Lahore",
    email: "ayesha@example.com",
    phone: "0300-1234567",
  },
};

beforeEach(() => {
  onAccept.mockReset();
  onDecline.mockReset();
  onWithdraw.mockReset();
});

describe("EnquiryCard", () => {
  it("shows what is being asked for and at what price", () => {
    render(<EnquiryCard enquiry={enquiry()} side="seller" />);
    expect(screen.getByText("Blue Kurta")).toBeInTheDocument();
    expect(screen.getByText("Rs 1,600")).toBeInTheDocument();
  });

  it("shows the buyer's message", () => {
    render(<EnquiryCard enquiry={enquiry()} side="seller" />);
    expect(screen.getByText("Is this still available?")).toBeInTheDocument();
  });

  it("gives the seller a yes and a no", async () => {
    render(
      <EnquiryCard enquiry={enquiry()} side="seller" onAccept={onAccept} onDecline={onDecline} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /yes, deal/i }));
    expect(onAccept).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /no thanks/i }));
    expect(onDecline).toHaveBeenCalled();
  });

  it("gives the buyer a way out instead", async () => {
    render(<EnquiryCard enquiry={enquiry()} side="buyer" onWithdraw={onWithdraw} />);
    expect(screen.queryByRole("button", { name: /yes, deal/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /change my mind/i }));
    expect(onWithdraw).toHaveBeenCalled();
  });

  it("shows no contact details while the seller has not answered", () => {
    render(<EnquiryCard enquiry={enquiry()} side="buyer" />);
    expect(screen.queryByText(/0300/)).not.toBeInTheDocument();
    expect(screen.queryByText(/@example.com/)).not.toBeInTheDocument();
    expect(screen.queryByText(/how to reach them/i)).not.toBeInTheDocument();
  });

  it("shows contact details once the seller agrees", () => {
    render(<EnquiryCard enquiry={enquiry(AGREED)} side="buyer" />);
    expect(screen.getByText(/how to reach them/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "0300-1234567" })).toHaveAttribute(
      "href",
      "tel:0300-1234567",
    );
    expect(screen.getByRole("link", { name: "ayesha@example.com" })).toHaveAttribute(
      "href",
      "mailto:ayesha@example.com",
    );
  });

  it("warns that money is never handled here", () => {
    render(<EnquiryCard enquiry={enquiry(AGREED)} side="buyer" />);
    expect(screen.getByText(/never handles money/i)).toBeInTheDocument();
    expect(screen.getByText(/somewhere public/i)).toBeInTheDocument();
  });

  it("stops offering yes and no once it is answered", () => {
    render(
      <EnquiryCard enquiry={enquiry(AGREED)} side="seller" onAccept={onAccept} onDecline={onDecline} />,
    );
    expect(screen.queryByRole("button", { name: /yes, deal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /no thanks/i })).not.toBeInTheDocument();
  });

  it("copes with somebody who never saved a phone number", () => {
    render(
      <EnquiryCard
        enquiry={enquiry({ ...AGREED, contact: { ...AGREED.contact, phone: "" } })}
        side="buyer"
      />,
    );
    expect(screen.getByRole("link", { name: "ayesha@example.com" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^tel:/ })).not.toBeInTheDocument();
  });
});
