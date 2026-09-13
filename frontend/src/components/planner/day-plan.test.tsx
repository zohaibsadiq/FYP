import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DayPlan } from "./day-plan";
import { addDays, todayIso } from "@/lib/dates";
import type { PlannedOutfit } from "@/types/planner";
import type { GarmentListItem } from "@/types/wardrobe";

let plan: PlannedOutfit | null = null;
let pending = false;
const saveMutate = vi.fn();
const confirmMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/hooks/use-planner", () => ({
  usePlanForDay: () => ({ data: plan, isPending: pending }),
  useSavePlan: () => ({ mutate: saveMutate, isPending: false }),
  useConfirmWorn: () => ({ mutate: confirmMutate, isPending: false }),
  useDeletePlan: () => ({ mutate: deleteMutate, isPending: false }),
}));

vi.mock("@/hooks/use-wardrobe", () => ({
  useGarments: () => ({ data: { results: [], count: 0 }, isPending: false }),
  useItemWears: () => ({ data: [], isPending: false, isError: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function garment(id: number, name: string, overrides: Partial<GarmentListItem> = {}): GarmentListItem {
  return {
    id,
    name,
    display_image_url: "",
    wear_count: 2,
    last_worn_date: "2026-09-12",
    days_since_worn: 2,
    last_worn_note: "Office",
    ...overrides,
  } as GarmentListItem;
}

function outfit(overrides: Partial<PlannedOutfit> = {}): PlannedOutfit {
  return {
    id: 5,
    planned_for: addDays(todayIso(), -1),
    label: "Office",
    note: "",
    items: [1],
    item_details: [garment(1, "Cream kurta")],
    is_confirmed: false,
    worn_confirmed_at: null,
    days_away: -1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  saveMutate.mockReset();
  confirmMutate.mockReset();
  deleteMutate.mockReset();
  plan = null;
  pending = false;
});

describe("DayPlan, on a free day", () => {
  it("holds the save button back until there is something to save", () => {
    render(<DayPlan date="2026-09-20" />);
    expect(screen.queryByRole("button", { name: /save this day/i })).not.toBeInTheDocument();
    expect(screen.getByText(/a save button appears here/i)).toBeInTheDocument();
  });

  it("brings the save button out once the day is named", async () => {
    render(<DayPlan date="2026-09-20" />);
    await userEvent.type(screen.getByLabelText(/what is the day/i), "Eid");
    expect(screen.getByRole("button", { name: /save this day/i })).toBeInTheDocument();
  });

  it("does not count spaces alone as something worth saving", async () => {
    render(<DayPlan date="2026-09-20" />);
    await userEvent.type(screen.getByLabelText(/what is the day/i), "   ");
    expect(screen.queryByRole("button", { name: /save this day/i })).not.toBeInTheDocument();
  });

  it("brings it out for a note on its own too", async () => {
    render(<DayPlan date="2026-09-20" />);
    await userEvent.type(screen.getByLabelText(/remember/i), "Leaving at six");
    expect(screen.getByRole("button", { name: /save this day/i })).toBeInTheDocument();
  });
});

describe("DayPlan, on a day already planned", () => {
  it("shows what was picked and when each was last worn", () => {
    plan = outfit();
    render(<DayPlan date={plan.planned_for} />);
    expect(screen.getByText("Cream kurta")).toBeInTheDocument();
    expect(screen.getByText("Worn 2 days ago, for Office")).toBeInTheDocument();
  });

  it("offers the full history of each thing on the day", () => {
    plan = outfit();
    render(<DayPlan date={plan.planned_for} />);
    expect(screen.getByRole("button", { name: /when did i wear it/i })).toBeInTheDocument();
  });

  it("offers to record it as worn once the day has passed", () => {
    plan = outfit();
    render(<DayPlan date={plan.planned_for} />);
    expect(screen.getByRole("button", { name: /^i wore this$/i })).toBeInTheDocument();
  });

  it("does not offer that for a day still to come", () => {
    plan = outfit({ planned_for: addDays(todayIso(), 4), days_away: 4 });
    render(<DayPlan date={plan.planned_for} />);
    expect(screen.queryByRole("button", { name: /^i wore this$/i })).not.toBeInTheDocument();
  });

  it("stops offering it once it is already recorded", () => {
    plan = outfit({ is_confirmed: true, worn_confirmed_at: "2026-09-13T10:00:00Z" });
    render(<DayPlan date={plan.planned_for} />);
    expect(screen.queryByRole("button", { name: /^i wore this$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/it is on the record/i)).toBeInTheDocument();
  });

  it("holds back Save changes until something is actually different", async () => {
    plan = outfit();
    render(<DayPlan date={plan.planned_for} />);
    await userEvent.click(screen.getByRole("button", { name: /change it/i }));

    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing has changed yet/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/what is the day/i), " party");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});
