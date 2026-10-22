import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BodyPhotoCard } from "./body-photo-card";
import type { BodyPhotoState } from "@/types/tryon";

const saved = vi.fn();
const deleted = vi.fn();
let state: BodyPhotoState | undefined;
let loading = false;

vi.mock("@/hooks/use-tryon", () => ({
  useBodyPhoto: () => ({ data: state, isPending: loading }),
  useSaveBodyPhoto: () => ({ mutate: saved, isPending: false }),
  useDeleteBodyPhoto: () => ({ mutate: deleted, isPending: false }),
}));

beforeEach(() => {
  saved.mockReset();
  deleted.mockReset();
  loading = false;
  state = { has_body_photo: false, body_photo_url: "", consented_at: null };
});

describe("BodyPhotoCard", () => {
  describe("before a photo is added", () => {
    it("explains where the photo goes before asking for it", () => {
      render(<BodyPhotoCard />);
      expect(screen.getByText(/sent to the company that/i)).toBeInTheDocument();
    });

    it("says deleting the photo deletes the pictures too", () => {
      render(<BodyPhotoCard />);
      expect(screen.getByText(/deletes every picture made from it/i)).toBeInTheDocument();
    });

    it("ties agreement to the act of choosing a photo", () => {
      render(<BodyPhotoCard />);
      expect(screen.getByRole("button", { name: /choose a photo and agree/i })).toBeInTheDocument();
    });

    it("shows what makes a good photo and what does not", () => {
      render(<BodyPhotoCard />);
      expect(screen.getByText(/works well/i)).toBeInTheDocument();
      expect(screen.getByText(/gives a poor result/i)).toBeInTheDocument();
      expect(screen.getByText(/plain wall behind you/i)).toBeInTheDocument();
    });

    it("saves the file that was picked", async () => {
      const { container } = render(<BodyPhotoCard />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["x"], "me.png", { type: "image/png" });

      await userEvent.upload(input, file);
      expect(saved).toHaveBeenCalledWith(file, expect.anything());
    });
  });

  describe("once a photo is saved", () => {
    beforeEach(() => {
      state = {
        has_body_photo: true,
        body_photo_url: "https://images.test/me.png",
        consented_at: "2026-10-22T08:00:00Z",
      };
    });

    it("shows the photo back, described for screen readers", () => {
      render(<BodyPhotoCard />);
      expect(
        screen.getByAltText(/photo of you that clothes are drawn onto/i),
      ).toBeInTheDocument();
    });

    it("offers to replace it", () => {
      render(<BodyPhotoCard />);
      expect(screen.getByRole("button", { name: /different photo/i })).toBeInTheDocument();
    });

    it("does not delete on the first press", async () => {
      render(<BodyPhotoCard />);
      await userEvent.click(screen.getByRole("button", { name: /delete my photo/i }));
      expect(deleted).not.toHaveBeenCalled();
    });

    it("warns what else goes before confirming", async () => {
      render(<BodyPhotoCard />);
      await userEvent.click(screen.getByRole("button", { name: /delete my photo/i }));
      expect(screen.getByText(/also deletes every picture/i)).toBeInTheDocument();
    });

    it("deletes once it is confirmed", async () => {
      render(<BodyPhotoCard />);
      await userEvent.click(screen.getByRole("button", { name: /delete my photo/i }));
      await userEvent.click(screen.getByRole("button", { name: /yes, delete everything/i }));
      expect(deleted).toHaveBeenCalled();
    });

    it("lets the person back out", async () => {
      render(<BodyPhotoCard />);
      await userEvent.click(screen.getByRole("button", { name: /delete my photo/i }));
      await userEvent.click(screen.getByRole("button", { name: /keep it/i }));
      expect(deleted).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /delete my photo/i })).toBeInTheDocument();
    });
  });

  it("shows a placeholder rather than an empty box while loading", () => {
    loading = true;
    state = undefined;
    render(<BodyPhotoCard />);
    expect(screen.queryByRole("button", { name: /choose a photo/i })).not.toBeInTheDocument();
  });
});
