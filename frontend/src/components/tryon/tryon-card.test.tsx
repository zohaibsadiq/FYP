import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TryOnCard } from "./tryon-card";
import type { TryOn } from "@/types/tryon";

const onDelete = vi.fn();

function picture(overrides: Partial<TryOn> = {}): TryOn {
  return {
    id: 7,
    item: 3,
    garment_name: "Blue Kurta",
    garment_image_url: "https://images.test/kurta.png",
    garment_slot: "TOP",
    garment_slot_label: "Top half",
    status: "READY",
    status_label: "Ready",
    result_url: "https://images.test/result.png",
    error: "",
    created_at: "2026-10-22T08:00:00Z",
    completed_at: "2026-10-22T08:03:00Z",
    ...overrides,
  };
}

const WAITING = { status: "PENDING" as const, status_label: "Working on it", result_url: "" };

beforeEach(() => onDelete.mockReset());

describe("TryOnCard", () => {
  it("names the garment it was made from", () => {
    render(<TryOnCard picture={picture()} onDelete={onDelete} />);
    expect(screen.getByText("Blue Kurta")).toBeInTheDocument();
  });

  it("describes the picture for somebody who cannot see it", () => {
    render(<TryOnCard picture={picture()} onDelete={onDelete} />);
    expect(screen.getByAltText("You wearing Blue Kurta")).toBeInTheDocument();
  });

  it("says how long the wait will be rather than spinning silently", () => {
    render(<TryOnCard picture={picture(WAITING)} onDelete={onDelete} />);
    expect(screen.getByText(/two to four minutes/i)).toBeInTheDocument();
  });

  it("keeps the garment name on screen while it waits", () => {
    render(<TryOnCard picture={picture(WAITING)} onDelete={onDelete} />);
    expect(screen.getByText("Blue Kurta")).toBeInTheDocument();
  });

  it("offers no download until there is something to download", () => {
    render(<TryOnCard picture={picture(WAITING)} onDelete={onDelete} />);
    expect(screen.queryByRole("link", { name: /save/i })).not.toBeInTheDocument();
  });

  it("offers a download once it is ready", () => {
    render(<TryOnCard picture={picture()} onDelete={onDelete} />);
    expect(screen.getByRole("link", { name: /save/i })).toHaveAttribute(
      "href",
      "https://images.test/result.png",
    );
  });

  it("shows the reason a picture failed, in the words the server sent", () => {
    render(
      <TryOnCard
        picture={picture({
          status: "FAILED",
          status_label: "Did not work",
          result_url: "",
          error: "A clear, full-length photo facing the camera works best.",
        })}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/full-length photo facing the camera/i)).toBeInTheDocument();
  });

  it("falls back to plain words when a failure carried no reason", () => {
    render(
      <TryOnCard
        picture={picture({ status: "FAILED", status_label: "Did not work", result_url: "", error: "" })}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText(/did not work/i)).toBeInTheDocument();
  });

  it("can be deleted at any stage", async () => {
    render(<TryOnCard picture={picture(WAITING)} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("names a garment that was uploaded and never kept", () => {
    render(
      <TryOnCard
        picture={picture({ item: null, garment_name: "Uploaded photo" })}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("Uploaded photo")).toBeInTheDocument();
  });

  it("says which part of the body it was drawn on", () => {
    render(<TryOnCard picture={picture()} onDelete={onDelete} />);
    expect(screen.getByText("Top half")).toBeInTheDocument();
  });

  it("keeps the delete button reachable by name even when its label is hidden", () => {
    render(<TryOnCard picture={picture()} onDelete={onDelete} />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });
});
