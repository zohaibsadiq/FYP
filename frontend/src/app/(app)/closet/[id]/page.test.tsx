import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ItemPage from "./page";
import type { Garment } from "@/types/wardrobe";

let garment: Garment;
const idle = { mutate: vi.fn(), isPending: false };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/use-wardrobe", () => ({
  useGarment: () => ({ data: garment, isPending: false, isError: false }),
  useCategories: () => ({ data: [] }),
  useStorageLocations: () => ({ data: [] }),
  useRecordWear: () => idle,
  useToggleLaundry: () => idle,
  useToggleFavorite: () => idle,
  useToggleArchived: () => idle,
  useDeleteGarment: () => idle,
  useUpdateGarment: () => idle,
  useCreateStorageLocation: () => idle,
  useUploadGarmentImage: () => idle,
  useDiscardUpload: () => idle,
}));
vi.mock("@/components/wardrobe/wear-history", () => ({ WearHistory: () => null }));
vi.mock("@/components/wardrobe/photo-guide", () => ({ PhotoGuide: () => null }));

function kurta(over: Partial<Garment> = {}): Garment {
  return {
    id: 7,
    name: "Blue Kurta",
    brand: "",
    size: "M",
    material: "",
    pattern: "SOLID",
    category: 2,
    category_name: "Kurta",
    category_slot: "TOP",
    display_image_url: "",
    original_image_url: "",
    clean_image_url: "",
    primary_color_hex: "",
    primary_color_name: "",
    secondary_color_hex: "",
    seasons: [],
    occasions: [],
    warmth_level: 3,
    is_waterproof: false,
    status: "IN_WARDROBE",
    status_label: "In wardrobe",
    is_wearable_now: true,
    is_favorite: false,
    is_lendable: true,
    storage_location: null,
    location_path: "",
    wear_count: 0,
    last_worn_date: null,
    days_since_worn: null,
    last_worn_note: "",
    purchase_price: null,
    currency: "PKR",
    purchase_date: null,
    cost_per_wear: null,
    notes: "",
    created_at: "2026-10-01T08:00:00Z",
    updated_at: "2026-10-01T08:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  garment = kurta();
});

describe("ItemPage", () => {
  it("offers to add a photo straight from the empty picture", async () => {
    render(<ItemPage />);

    await userEvent.click(screen.getByRole("button", { name: /add a photo/i }));

    expect(screen.getByRole("heading", { name: /change details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take or choose a photo/i })).toBeInTheDocument();
  });

  it("offers to change the photo when there is one", async () => {
    garment = kurta({ display_image_url: "https://images.test/kurta.png" });
    render(<ItemPage />);

    await userEvent.click(screen.getByRole("button", { name: /change photo/i }));

    expect(screen.getByRole("heading", { name: /change details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove photo/i })).toBeInTheDocument();
  });

  it("still has the plain change-details button for everything else", () => {
    render(<ItemPage />);
    expect(screen.getByRole("button", { name: /change details/i })).toBeInTheDocument();
  });
});
