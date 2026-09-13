import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WearHistory } from "./wear-history";
import { addDays, todayIso } from "@/lib/dates";
import type { Garment, WearEvent } from "@/types/wardrobe";

const recordMutate = vi.fn();
const forgetMutate = vi.fn();
let log: WearEvent[] = [];
let pending = false;

vi.mock("@/hooks/use-wardrobe", () => ({
  useItemWears: () => ({ data: log, isPending: pending, isError: false }),
  useRecordWear: () => ({ mutate: recordMutate, isPending: false }),
  useForgetWear: () => ({ mutate: forgetMutate, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wear(id: number, worn_on: string, note = ""): WearEvent {
  return {
    id,
    item: 7,
    item_name: "Blue shirt",
    item_image_url: "",
    item_slot: "TOP",
    worn_on,
    note,
    days_ago: 0,
    created_at: "2026-09-14T00:00:00Z",
  };
}

function garment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: 7,
    name: "Blue shirt",
    wear_count: 2,
    days_since_worn: 3,
    ...overrides,
  } as Garment;
}

// Built from today rather than written out, so "Yesterday" stays yesterday
// whenever these run.
const YESTERDAY = addDays(todayIso(), -1);
const FORTNIGHT_AGO = addDays(todayIso(), -14);

beforeEach(() => {
  recordMutate.mockReset();
  forgetMutate.mockReset();
  pending = false;
  log = [wear(1, YESTERDAY), wear(2, FORTNIGHT_AGO, "Office")];
});

describe("WearHistory", () => {
  it("lists every recorded day", () => {
    render(<WearHistory item={garment()} />);
    expect(screen.getByText(YESTERDAY)).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
  });

  it("says how long ago it was last worn in words, not a raw number of days", () => {
    render(<WearHistory item={garment({ wear_count: 4, days_since_worn: 95 })} />);
    expect(screen.getByText(/3 months ago/)).toBeInTheDocument();
  });

  it("tells someone with no history what to do instead of showing an empty box", () => {
    log = [];
    render(<WearHistory item={garment({ wear_count: 0, days_since_worn: null })} />);
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/newest first/)).toBeInTheDocument();
  });

  it("hides the form until it is asked for", async () => {
    render(<WearHistory item={garment()} />);
    expect(screen.queryByLabelText(/which day/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /another day/i }));
    expect(screen.getByLabelText(/which day/i)).toBeInTheDocument();
  });

  it("will not let a day in the future be picked", async () => {
    render(<WearHistory item={garment()} />);
    await userEvent.click(screen.getByRole("button", { name: /another day/i }));
    expect(screen.getByLabelText(/which day/i)).toHaveAttribute("max", todayIso());
  });

  it("sends the day and the occasion together", async () => {
    render(<WearHistory item={garment()} />);
    await userEvent.click(screen.getByRole("button", { name: /another day/i }));

    const field = screen.getByLabelText(/which day/i);
    await userEvent.clear(field);
    await userEvent.type(field, "2026-09-05");
    await userEvent.type(screen.getByLabelText(/occasion/i), "Eid");
    await userEvent.click(screen.getByRole("button", { name: /save this day/i }));

    expect(recordMutate).toHaveBeenCalledWith(
      { id: 7, date: "2026-09-05", note: "Eid" },
      expect.anything(),
    );
  });

  it("shows the reason a day was refused, next to the field", async () => {
    recordMutate.mockImplementation((_input, opts) =>
      opts.onError({
        isAxiosError: true,
        response: { status: 400, data: { worn_on: ["Already recorded."] } },
      }),
    );
    render(<WearHistory item={garment()} />);
    await userEvent.click(screen.getByRole("button", { name: /another day/i }));
    await userEvent.click(screen.getByRole("button", { name: /save this day/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/already recorded/i));
  });

  it("removes one day by the day itself, not by a row number", async () => {
    render(<WearHistory item={garment()} />);
    await userEvent.click(screen.getByRole("button", { name: /remove yesterday from the record/i }));

    expect(forgetMutate).toHaveBeenCalledWith(
      { id: 7, date: YESTERDAY },
      expect.anything(),
    );
  });

  it("gives each remove button a name that says which day it removes", () => {
    render(<WearHistory item={garment()} />);
    const buttons = screen.getAllByRole("button", { name: /from the record/i });
    const names = buttons.map((b) => b.textContent);
    expect(new Set(names).size).toBe(names.length);
  });

  it("shows a placeholder while the history is still loading", () => {
    pending = true;
    render(<WearHistory item={garment()} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
