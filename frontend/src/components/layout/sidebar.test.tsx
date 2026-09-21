import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./sidebar";
import type { Waiting } from "@/types/friends";

let waiting: Partial<Waiting> | undefined;

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/hooks/use-friends", () => ({ useWaiting: () => ({ data: waiting }) }));

beforeEach(() => {
  waiting = { friend_requests: 0, borrow_asks: 0, buy_requests: 0, overdue: 0, total: 0 };
});

const link = (name: RegExp) => screen.getByRole("link", { name });

describe("Sidebar", () => {
  it("shows no numbers when nothing is waiting", () => {
    render(<Sidebar />);
    expect(within(link(/borrow from friends/i)).queryByText(/waiting for you/i)).toBeNull();
  });

  it("adds friend requests and borrow asks into one number", () => {
    waiting = { friend_requests: 2, borrow_asks: 3, buy_requests: 0, overdue: 0, total: 5 };
    render(<Sidebar />);
    expect(within(link(/borrow from friends/i)).getByText("5")).toBeInTheDocument();
  });

  it("puts buy requests on Buy and Sell, not on friends", () => {
    waiting = { friend_requests: 0, borrow_asks: 0, buy_requests: 4, overdue: 0, total: 4 };
    render(<Sidebar />);
    expect(within(link(/buy and sell/i)).getByText("4")).toBeInTheDocument();
    expect(within(link(/borrow from friends/i)).queryByText("4")).toBeNull();
  });

  it("does not count being late as somebody waiting on you", () => {
    waiting = { friend_requests: 0, borrow_asks: 0, buy_requests: 0, overdue: 3, total: 0 };
    render(<Sidebar />);
    expect(within(link(/borrow from friends/i)).queryByText("3")).toBeNull();
  });

  it("says out loud what the number means, not just a bare digit", () => {
    waiting = { friend_requests: 1, borrow_asks: 0, buy_requests: 0, overdue: 0, total: 1 };
    render(<Sidebar />);
    expect(within(link(/borrow from friends/i)).getByText(/waiting for you/i)).toBeInTheDocument();
  });

  it("draws the menu even before the first poll comes back", () => {
    waiting = undefined;
    render(<Sidebar />);
    expect(link(/my clothes/i)).toBeInTheDocument();
  });

  it("never puts a number on a page that has nothing to answer", () => {
    waiting = { friend_requests: 9, borrow_asks: 0, buy_requests: 0, overdue: 0, total: 9 };
    render(<Sidebar />);
    expect(within(link(/my clothes/i)).queryByText("9")).toBeNull();
  });
});
