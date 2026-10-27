import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mutate = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useLogin: () => ({ mutate, isPending: false }),
  useSkipIfSignedIn: () => {},
}));

beforeEach(() => {
  mutate.mockReset();
});

describe("LoginPage", () => {
  it("sends the email without stray spaces", async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), " ayesha@example.test ");
    await userEvent.type(screen.getByLabelText("Password"), "Correct-horse-9");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(mutate.mock.calls[0][0]).toEqual({ email: "ayesha@example.test", password: "Correct-horse-9" });
  });

  it("can show the password while it is being typed", async () => {
    render(<LoginPage />);
    const box = screen.getByLabelText("Password");
    expect(box).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: /show/i }));
    expect(box).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: /hide/i }));
    expect(box).toHaveAttribute("type", "password");
  });

  it("keeps the server's refusal on the page, not only in a toast", async () => {
    mutate.mockImplementation((_payload, opts) => {
      opts.onError({ isAxiosError: true, response: { status: 401, data: { detail: "No active account found" } } });
    });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "ayesha@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("No active account found");
  });
});
