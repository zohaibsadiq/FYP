import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CopyLookPage from "./page";
import type { LookPart, LookResult } from "@/types/look";
import type { GarmentListItem } from "@/types/wardrobe";

const copyMutate = vi.fn();
let pending = false;

vi.mock("@/hooks/use-look", () => ({
  useCopyLook: () => ({ mutate: copyMutate, isPending: pending }),
}));

function garment(id: number, name: string): GarmentListItem {
  return {
    id,
    name,
    display_image_url: "",
    wear_count: 2,
    last_worn_date: "2026-09-12",
    days_since_worn: 2,
    last_worn_note: "Office",
  } as GarmentListItem;
}

function part(overrides: Partial<LookPart> = {}): LookPart {
  return {
    slot: "TOP",
    slot_label: "Top",
    hex: "#f2f2f2",
    color_name: "White",
    best_score: 88,
    missing: false,
    matches: [{ item: garment(1, "White shirt"), score: 88, verdict: "Almost the same" }],
    ...overrides,
  };
}

function result(overrides: Partial<LookResult> = {}): LookResult {
  return {
    parts: [part()],
    how_close: 92,
    verdict: "Almost the same",
    note: "Read from head to feet.",
    code: "",
    is_full_length: true,
    one_garment_only: false,
    preview: "data:image/jpeg;base64,abc",
    ...overrides,
  };
}

async function upload(answer: LookResult | { error: unknown }) {
  copyMutate.mockImplementation((_input, opts) => {
    if ("error" in answer) opts.onError(answer.error);
    else opts.onSuccess(answer);
  });
  const { container } = render(<CopyLookPage />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File(["x"], "look.png", { type: "image/png" }));
}

beforeEach(() => {
  copyMutate.mockReset();
  pending = false;
});

describe("Copy a look", () => {
  it("explains what makes a good photo before anything is sent", () => {
    render(<CopyLookPage />);
    expect(screen.getByText(/head to feet/i)).toBeInTheDocument();
    expect(screen.getByText(/plain wall behind them/i)).toBeInTheDocument();
  });

  it("says plainly that the photo is not kept", () => {
    render(<CopyLookPage />);
    expect(screen.getByText(/nothing is saved/i)).toBeInTheDocument();
  });

  it("refuses an oversized photo before spending an upload on it", async () => {
    const { container } = render(<CopyLookPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const huge = new File([new Uint8Array(13 * 1024 * 1024)], "big.png", { type: "image/png" });
    await userEvent.upload(input, huge);

    expect(copyMutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/larger than 12 MB/i);
  });

  it("leads with how close the closet gets, in words as well as a number", async () => {
    await upload(result());
    // The overall figure is an average across the parts, so it stands apart
    // from any one match score.
    await waitFor(() => expect(screen.getByText("92%")).toBeInTheDocument());
    expect(screen.getAllByText("Almost the same").length).toBeGreaterThan(0);

    // The best score is repeated on the part heading, so the row is scoped.
    const row = screen.getByRole("link", { name: /white shirt/i });
    expect(within(row).getByText("88%")).toBeInTheDocument();
  });

  it("shows what was read for each part of the outfit", async () => {
    await upload(
      result({
        parts: [
          part(),
          part({ slot: "BOTTOM", slot_label: "Bottom", color_name: "Denim", hex: "#33568a" }),
        ],
      }),
    );
    await waitFor(() => expect(screen.getByText("Bottom")).toBeInTheDocument());
    expect(screen.getByText("Denim")).toBeInTheDocument();
  });

  it("links each suggestion to the item it is", async () => {
    await upload(result());
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /white shirt/i })).toHaveAttribute(
        "href",
        "/closet/1",
      ),
    );
  });

  it("says what is missing rather than offering a poor match as a good one", async () => {
    await upload(result({ parts: [part({ missing: true, matches: [], best_score: 0 })] }));
    await waitFor(() => expect(screen.getByText(/you have nothing in white/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /add something/i })).toBeInTheDocument();
  });

  it("passes on the note about how the photo was read", async () => {
    await upload(
      result({
        one_garment_only: true,
        note: "This looks like one piece of clothing rather than a whole outfit.",
      }),
    );
    await waitFor(() => expect(screen.getByText(/one piece of clothing/i)).toBeInTheDocument());
  });

  it("shows an unreadable photo as an explanation, not a score", async () => {
    await upload(
      result({
        code: "too_small",
        note: "That picture is too small to read. Try a larger one.",
        parts: [],
        how_close: 0,
        verdict: "",
      }),
    );
    await waitFor(() => expect(screen.getByText(/too small to read/i)).toBeInTheDocument());
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("offers a way back to try a different photo", async () => {
    await upload(result());
    await waitFor(() => expect(screen.getByText("92%")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /try another photo/i }));
    expect(screen.queryByText("92%")).not.toBeInTheDocument();
    expect(screen.getByText(/head to feet/i)).toBeInTheDocument();
  });

  it("shows the reason when the server refuses the photo", async () => {
    await upload({
      error: {
        isAxiosError: true,
        response: { status: 400, data: { image: ["That file is not a picture we can read."] } },
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/not a picture we can read/i),
    );
  });

  it("says it is working while the photo is being read", () => {
    pending = true;
    render(<CopyLookPage />);
    expect(screen.getByText(/reading the outfit/i)).toBeInTheDocument();
  });

  it("marks a weak match differently from a strong one", async () => {
    await upload(
      result({
        parts: [
          part({
            best_score: 41,
            matches: [{ item: garment(2, "Grey tee"), score: 41, verdict: "A bit different" }],
          }),
        ],
      }),
    );
    const row = await screen.findByRole("link", { name: /grey tee/i });
    expect(within(row).getByText("A bit different")).toBeInTheDocument();
  });
});
