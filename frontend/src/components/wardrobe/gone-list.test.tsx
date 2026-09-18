import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoneList } from "./gone-list";
import type { GarmentListItem } from "@/types/wardrobe";

const askedWith: Record<string, unknown>[] = [];
const broughtBack = vi.fn();
let rows: Partial<GarmentListItem>[] = [];
let pending = false;

vi.mock("@/hooks/use-wardrobe", () => ({
  useGarments: (filters: Record<string, unknown>) => {
    askedWith.push(filters);
    return { data: pending ? undefined : { count: rows.length, results: rows }, isPending: pending };
  },
  useToggleArchived: () => ({ mutate: broughtBack, isPending: false }),
}));

function item(over: Partial<GarmentListItem> = {}): Partial<GarmentListItem> {
  return {
    id: 1,
    name: "Winter Coat",
    status: "ARCHIVED",
    status_label: "Put away",
    wear_count: 4,
    display_image_url: "",
    ...over,
  };
}

beforeEach(() => {
  askedWith.length = 0;
  broughtBack.mockReset();
  pending = false;
  rows = [item()];
});

describe("GoneList", () => {
  it("asks only for things that have left the closet", () => {
    render(<GoneList />);
    expect(askedWith[0]).toEqual({ gone: true });
  });

  it("passes the search word along so the box still works here", () => {
    render(<GoneList search="coat" />);
    expect(askedWith[0]).toEqual({ gone: true, search: "coat" });
  });

  it("keeps the wear count, which is why these are kept at all", () => {
    render(<GoneList />);
    expect(screen.getByText(/worn 4 times/)).toBeInTheDocument();
  });

  it("counts one wear as a time, not times", () => {
    rows = [item({ wear_count: 1 })];
    render(<GoneList />);
    expect(screen.getByText(/worn 1 time(?!s)/)).toBeInTheDocument();
  });

  it("says plainly when something was never worn", () => {
    rows = [item({ wear_count: 0 })];
    render(<GoneList />);
    expect(screen.getByText(/never worn/)).toBeInTheDocument();
  });

  it("lets a put-away thing come back", async () => {
    render(<GoneList />);
    await userEvent.click(screen.getByRole("button", { name: /bring it back/i }));
    expect(broughtBack).toHaveBeenCalledWith(
      { id: 1, archived: false },
      expect.anything(),
    );
  });

  it("offers no way back for something sold, because it is not yours", () => {
    rows = [item({ id: 2, name: "Blue Kurta", status: "SOLD", status_label: "Sold" })];
    render(<GoneList />);
    expect(screen.queryByRole("button", { name: /bring it back/i })).not.toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
  });

  it("explains itself when nothing has left yet", () => {
    rows = [];
    render(<GoneList />);
    expect(screen.getByText(/nothing has left your closet/i)).toBeInTheDocument();
  });

  it("says nothing matched when a search finds none of them", () => {
    rows = [];
    render(<GoneList search="hat" />);
    expect(screen.getByText(/nothing matched/i)).toBeInTheDocument();
  });

  it("shows a placeholder rather than an empty box while loading", () => {
    pending = true;
    render(<GoneList />);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
