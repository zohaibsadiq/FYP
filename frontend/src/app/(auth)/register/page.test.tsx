import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegisterPage from "./page";

const mutate = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useRegister: () => ({ mutate, isPending: false }),
  useSkipIfSignedIn: () => {},
}));

beforeEach(() => {
  mutate.mockReset();
});

async function fillAboutYou(name = "Ayesha Khan", email = "ayesha@example.test") {
  if (name) await userEvent.type(screen.getByLabelText("Full name"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
}

const next = () => userEvent.click(screen.getByRole("button", { name: /next/i }));

describe("RegisterPage", () => {
  it("asks about the person first, and only that", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("City")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("will not move on without a name and a real-looking email", async () => {
    render(<RegisterPage />);
    await fillAboutYou("", "not-an-email");
    await next();

    expect(screen.getByText("Please tell us your name.")).toBeInTheDocument();
    expect(screen.getByText("That does not look like an email address.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("moves to the city once the first screen is filled in", async () => {
    render(<RegisterPage />);
    await fillAboutYou();
    await next();

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /children's clothes/i })).toBeInTheDocument();
  });

  it("keeps what was typed when going back", async () => {
    render(<RegisterPage />);
    await fillAboutYou();
    await next();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByLabelText("Full name")).toHaveValue("Ayesha Khan");
    expect(screen.getByLabelText("Email")).toHaveValue("ayesha@example.test");
  });

  it("insists the two passwords match before creating anything", async () => {
    render(<RegisterPage />);
    await fillAboutYou();
    await next();
    await userEvent.type(screen.getByLabelText("City"), "Lahore");
    await next();
    await userEvent.type(screen.getByLabelText("Password"), "Correct-horse-9");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Different-horse-9");
    await userEvent.click(screen.getByRole("button", { name: /create my closet/i }));

    expect(screen.getByText("Both passwords must be the same.")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sends everything from all three screens, tidied up", async () => {
    render(<RegisterPage />);
    await fillAboutYou(" Ayesha Khan ", "Ayesha@Example.test");
    await next();
    await userEvent.type(screen.getByLabelText("City"), "Lahore");
    await userEvent.click(screen.getByRole("button", { name: /children's clothes/i }));
    await next();
    await userEvent.type(screen.getByLabelText("Password"), "Correct-horse-9");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Correct-horse-9");
    await userEvent.click(screen.getByRole("button", { name: /create my closet/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({
      full_name: "Ayesha Khan",
      email: "ayesha@example.test",
      city: "Lahore",
      shopping_for: "KIDS",
      password: "Correct-horse-9",
      password_confirm: "Correct-horse-9",
      country_code: "PK",
    });
  });

  it("goes back to the screen the server complained about", async () => {
    mutate.mockImplementation((_payload, opts) => {
      opts.onError({
        isAxiosError: true,
        response: { status: 400, data: { email: ["An account with this email already exists."] } },
      });
    });
    render(<RegisterPage />);
    await fillAboutYou();
    await next();
    await userEvent.type(screen.getByLabelText("City"), "Lahore");
    await next();
    await userEvent.type(screen.getByLabelText("Password"), "Correct-horse-9");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Correct-horse-9");
    await userEvent.click(screen.getByRole("button", { name: /create my closet/i }));

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
  });

  it("lets a password be shown before it is sent", async () => {
    render(<RegisterPage />);
    await fillAboutYou();
    await next();
    await userEvent.type(screen.getByLabelText("City"), "Lahore");
    await next();

    const box = screen.getByLabelText("Password");
    expect(box).toHaveAttribute("type", "password");
    await userEvent.click(screen.getAllByRole("button", { name: /show/i })[0]);
    expect(box).toHaveAttribute("type", "text");
  });
});
