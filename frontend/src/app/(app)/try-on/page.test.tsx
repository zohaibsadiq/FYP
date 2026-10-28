import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TryOnPage from "./page";
import type { TryOn, TryOnAvailability } from "@/types/tryon";
import type { GarmentListItem } from "@/types/wardrobe";

let availability: TryOnAvailability;
let pictures: TryOn[] = [];
let closet: Partial<GarmentListItem>[] = [];
const ask = vi.fn();

vi.mock("@/hooks/use-tryon", () => ({
  useTryOnAvailability: () => ({ data: availability, isPending: false }),
  useTryOns: () => ({ data: pictures, isPending: false }),
  useAskForTryOn: () => ({ mutate: ask, isPending: false }),
  useTryOnUpload: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTryOn: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-wardrobe", () => ({
  useGarments: () => ({ data: { count: closet.length, results: closet } }),
}));
vi.mock("@/components/tryon/body-photo-card", () => ({ BodyPhotoCard: () => <p>body photo</p> }));
vi.mock("@/components/tryon/upload-garment-dialog", () => ({ UploadGarmentDialog: () => null }));
vi.mock("@/components/tryon/tryon-card", () => ({
  TryOnCard: ({ picture }: { picture: TryOn }) => <article>{picture.garment_name}</article>,
}));

function item(id: number, name: string, slot: GarmentListItem["category_slot"]): Partial<GarmentListItem> {
  return { id, name, category_slot: slot, display_image_url: "https://images.test/x.png" };
}

function picture(over: Partial<TryOn> = {}): TryOn {
  return {
    id: 1,
    item: 1,
    garment_name: "Navy Kurta",
    garment_image_url: "",
    garment_slot: "TOP",
    garment_slot_label: "Top half",
    status: "READY",
    status_label: "Ready",
    result_url: "https://images.test/result.png",
    error: "",
    created_at: "2026-10-27T08:00:00Z",
    completed_at: "2026-10-27T08:03:00Z",
    ...over,
  };
}

beforeEach(() => {
  ask.mockReset();
  availability = { available: true, has_body_photo: true, daily_limit: 5, used_today: 2, left_today: 3 };
  pictures = [];
  closet = [
    item(1, "Navy Kurta", "TOP"),
    item(2, "Brown Khussa", "FOOTWEAR"),
    item(3, "Olive Jacket", "OUTERWEAR"),
  ];
});

describe("TryOnPage", () => {
  it("offers only the things that can be drawn on, so shoes are left out", () => {
    render(<TryOnPage />);
    expect(screen.getByRole("button", { name: /navy kurta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /olive jacket/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /brown khussa/i })).not.toBeInTheDocument();
  });

  it("starts a picture when a garment is tapped", async () => {
    render(<TryOnPage />);
    await userEvent.click(screen.getByRole("button", { name: /navy kurta/i }));
    expect(ask).toHaveBeenCalledWith(1, expect.anything());
  });

  it("says how many pictures are left today", () => {
    render(<TryOnPage />);
    expect(screen.getByText("3 of 5 left today")).toBeInTheDocument();
  });

  it("explains how it works and keeps the garments back until there is a photo", () => {
    availability = { ...availability, has_body_photo: false };
    render(<TryOnPage />);
    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /navy kurta/i })).not.toBeInTheDocument();
    expect(screen.getByText("body photo")).toBeInTheDocument();
  });

  it("says plainly when the feature is switched off", () => {
    availability = { ...availability, available: false };
    render(<TryOnPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(/switched off/i);
    expect(screen.queryByRole("button", { name: /navy kurta/i })).not.toBeInTheDocument();
  });

  it("lists the pictures already made and counts the ones still on the way", () => {
    pictures = [
      picture(),
      picture({ id: 2, garment_name: "Olive Jacket", status: "PENDING", status_label: "Working on it", result_url: "" }),
    ];
    render(<TryOnPage />);
    expect(screen.getByText("Navy Kurta", { selector: "article" })).toBeInTheDocument();
    expect(screen.getByText("1 ready, 1 on the way")).toBeInTheDocument();
  });
});
