import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoanCard } from "./loan-card";
import type { Loan } from "@/types/friends";

const onAgree = vi.fn();
const onDecline = vi.fn();
const onReturned = vi.fn();
const onCancel = vi.fn();

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 12,
    item: {
      id: 4,
      name: "Blue Blazer",
      brand: "Khaadi",
      size: "M",
      category_name: "Blazer",
      display_image_url: "",
      primary_color_hex: "#33568a",
      primary_color_name: "Blue",
    },
    lender: { id: 1, display_name: "Ali Khan", city: "Lahore" },
    borrower: { id: 2, display_name: "Sara Ali", city: "Karachi" },
    their_name: "Ali from college",
    status: "ASKED",
    status_label: "Waiting for an answer",
    borrow_from: "2026-09-20",
    borrow_until: "2026-09-25",
    message: "For a wedding on Saturday.",
    is_overdue: false,
    days_late: 0,
    created_at: "2026-09-19T08:00:00Z",
    answered_at: null,
    returned_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  onAgree.mockReset();
  onDecline.mockReset();
  onReturned.mockReset();
  onCancel.mockReset();
});

describe("LoanCard", () => {
  it("names the thing and why they want it", () => {
    render(<LoanCard loan={loan()} side="lender" />);
    expect(screen.getByText("Blue Blazer")).toBeInTheDocument();
    expect(screen.getByText("For a wedding on Saturday.")).toBeInTheDocument();
  });

  it("uses your own name for them, never their account name", () => {
    render(<LoanCard loan={loan()} side="lender" />);
    expect(screen.getByText(/Ali from college wants it/)).toBeInTheDocument();
    expect(screen.queryByText(/Sara Ali/)).not.toBeInTheDocument();
  });

  it("gives the lender a yes and a no", async () => {
    render(<LoanCard loan={loan()} side="lender" onAgree={onAgree} onDecline={onDecline} />);
    await userEvent.click(screen.getByRole("button", { name: /yes, lend it/i }));
    expect(onAgree).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /not this time/i }));
    expect(onDecline).toHaveBeenCalled();
  });

  it("gives the borrower a way out instead", async () => {
    render(<LoanCard loan={loan()} side="borrower" onCancel={onCancel} />);
    expect(screen.queryByRole("button", { name: /yes, lend it/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /changed my mind/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("offers to take it back once it is out", async () => {
    render(
      <LoanCard
        loan={loan({ status: "AGREED", status_label: "Lent out" })}
        side="lender"
        onReturned={onReturned}
      />,
    );
    expect(screen.queryByRole("button", { name: /yes, lend it/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /got it back/i }));
    expect(onReturned).toHaveBeenCalled();
  });

  it("says how late something is, rather than staying quiet about it", () => {
    render(
      <LoanCard
        loan={loan({ status: "AGREED", status_label: "Lent out", is_overdue: true, days_late: 3 })}
        side="borrower"
      />,
    );
    expect(screen.getByText("3 days late")).toBeInTheDocument();
  });

  it("counts one day as a day, not days", () => {
    render(
      <LoanCard
        loan={loan({ status: "AGREED", status_label: "Lent out", is_overdue: true, days_late: 1 })}
        side="borrower"
      />,
    );
    expect(screen.getByText("1 day late")).toBeInTheDocument();
  });

  it("shows nothing about lateness when it is not late", () => {
    render(<LoanCard loan={loan({ status: "AGREED", status_label: "Lent out" })} side="borrower" />);
    expect(screen.queryByText(/late/i)).not.toBeInTheDocument();
  });

  it("offers no buttons at all once it has been given back", () => {
    render(
      <LoanCard
        loan={loan({ status: "RETURNED", status_label: "Given back" })}
        side="lender"
        onAgree={onAgree}
        onReturned={onReturned}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("copes with a request that carried no message", () => {
    render(<LoanCard loan={loan({ message: "" })} side="lender" />);
    expect(screen.getByText("Blue Blazer")).toBeInTheDocument();
  });
});
