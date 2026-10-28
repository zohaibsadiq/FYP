import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProfilePage from "./page";
import type { User } from "@/types";

const mutate = vi.fn();
let me: User;

vi.mock("@/hooks/use-auth", () => ({
  useCurrentUser: () => ({ data: me, isPending: false }),
  useUpdateProfile: () => ({ mutate, isPending: false }),
}));

beforeEach(() => {
  mutate.mockReset();
  me = {
    id: 1,
    email: "ayesha@example.com",
    full_name: "Ayesha Khan",
    display_name: "Ayesha Khan",
    city: "Lahore",
    country_code: "PK",
    shopping_for: "WOMEN",
    phone: "",
    shares_closet: false,
    body_photo_url: "",
    has_body_photo: false,
    date_joined: "2026-09-01T08:00:00Z",
  };
});

describe("ProfilePage", () => {
  it("shows what is saved, with the email locked", () => {
    render(<ProfilePage />);
    expect(screen.getByLabelText("Your name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByText("Lahore, PK")).toBeInTheDocument();
  });

  it("keeps the save button quiet until something changes", async () => {
    render(<ProfilePage />);
    expect(screen.getByRole("button", { name: "Nothing to save" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Phone number"), "0300");
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeEnabled();

    await userEvent.click(save);
    expect(mutate).toHaveBeenCalledWith({ phone: "0300" }, expect.anything());
  });

  it("lets the person choose whose clothes open first", async () => {
    render(<ProfilePage />);
    expect(screen.getByRole("button", { name: /women's clothes/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Everything" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(mutate).toHaveBeenCalledWith({ shopping_for: "EVERYTHING" }, expect.anything());
  });

  it("says plainly who the phone number is given to", () => {
    render(<ProfilePage />);
    expect(screen.getByText(/given to one person only/i)).toBeInTheDocument();
  });
});
