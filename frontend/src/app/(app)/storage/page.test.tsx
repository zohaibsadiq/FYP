import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StoragePage from "./page";
import type { StorageLocation, StorageNode, WardrobeStats } from "@/types/wardrobe";

let tree: StorageNode[] = [];
let flat: StorageLocation[] = [];
let stats: Partial<WardrobeStats> | undefined;
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("@/hooks/use-wardrobe", () => ({
  useStorageTree: () => ({ data: tree, isPending: false }),
  useStorageLocations: () => ({ data: flat }),
  useWardrobeStats: () => ({ data: stats }),
  useCreateStorageLocation: () => idle,
  useUpdateStorageLocation: () => idle,
  useDeleteStorageLocation: () => idle,
}));

function node(id: number, name: string, kind: StorageNode["kind"], children: StorageNode[] = [], items = 0): StorageNode {
  return { id, name, kind, kind_label: kind, notes: "", item_count: items, children };
}

function place(id: number, name: string, kind: StorageLocation["kind"], parent: number | null, depth: number): StorageLocation {
  return {
    id,
    name,
    kind,
    kind_label: kind,
    parent,
    full_path: name,
    depth,
    notes: "",
    item_count: 0,
    created_at: "2026-10-01T08:00:00Z",
  };
}

beforeEach(() => {
  tree = [
    node(1, "Bedroom", "ROOM", [
      node(2, "Main Wardrobe", "WARDROBE", [node(3, "Top Drawer", "DRAWER", [], 4)]),
    ]),
  ];
  flat = [
    place(1, "Bedroom", "ROOM", null, 0),
    place(2, "Main Wardrobe", "WARDROBE", 1, 1),
    place(3, "Top Drawer", "DRAWER", 2, 2),
  ];
  stats = { total: 6, unplaced: 2, storage_locations: 3 };
});

describe("StoragePage", () => {
  it("lists every place, with the ones inside shown under their parent", () => {
    render(<StoragePage />);
    expect(screen.getByText("Bedroom")).toBeInTheDocument();
    expect(screen.getByText("Main Wardrobe")).toBeInTheDocument();
    expect(screen.getByText("Top Drawer")).toBeInTheDocument();
    expect(screen.getByText(/2 places inside, 4 items/)).toBeInTheDocument();
  });

  it("counts the items that still have no place", () => {
    render(<StoragePage />);
    expect(screen.getByText(/2 items have no place yet/)).toBeInTheDocument();
    expect(screen.getByText(/4 items have a place/)).toBeInTheDocument();
  });

  it("opens the add form from the button in the header", async () => {
    render(<StoragePage />);
    expect(screen.queryByLabelText("What is it called?")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /add a place/i }));

    expect(screen.getByRole("heading", { name: "Add a place" })).toBeInTheDocument();
    expect(screen.getByLabelText("What is it called?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drawer" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the form straight away when there are no places yet", () => {
    tree = [];
    flat = [];
    render(<StoragePage />);
    expect(screen.getByText("No places yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add a place" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add a place/i })).not.toBeInTheDocument();
  });

  it("opens the change form in place of the row", async () => {
    render(<StoragePage />);

    await userEvent.click(screen.getByRole("button", { name: "Change Top Drawer" }));

    expect(screen.getByRole("heading", { name: "Change Top Drawer" })).toBeInTheDocument();
    expect(screen.getByLabelText("What is it called?")).toHaveValue("Top Drawer");
  });
});
