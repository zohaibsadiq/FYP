import { AxiosError, AxiosHeaders } from "axios";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppLayout from "./layout";
import { tokens } from "@/lib/tokens";

const replace = vi.fn();
let meError: unknown = null;

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useCurrentUser: () => ({ error: meError }) }));
vi.mock("@/components/layout/sidebar", () => ({ Sidebar: () => null }));
vi.mock("@/components/layout/topbar", () => ({ Topbar: () => null }));
vi.mock("@/components/layout/mobile-nav", () => ({ MobileNav: () => null }));

function answer(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config as never, null, {
    status,
    statusText: "",
    data: {},
    headers: new AxiosHeaders(),
    config: config as never,
  });
}

function noAnswer() {
  return new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED");
}

beforeEach(() => {
  replace.mockReset();
  meError = null;
  localStorage.clear();
});

afterEach(() => localStorage.clear());

describe("AppLayout", () => {
  it("shows the page when a token is in the browser", () => {
    tokens.save("access", "refresh");
    render(<AppLayout><p>my closet</p></AppLayout>);

    expect(screen.getByText("my closet")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a visitor with no token to the sign-in page", async () => {
    render(<AppLayout><p>my closet</p></AppLayout>);

    expect(screen.queryByText("my closet")).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("keeps somebody signed in when the server cannot be reached", () => {
    tokens.save("access", "refresh");
    meError = noAnswer();
    render(<AppLayout><p>my closet</p></AppLayout>);

    expect(screen.getByText("my closet")).toBeInTheDocument();
    expect(tokens.isLoggedIn()).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps somebody signed in when the server has a fault of its own", () => {
    tokens.save("access", "refresh");
    meError = answer(500);
    render(<AppLayout><p>my closet</p></AppLayout>);

    expect(tokens.isLoggedIn()).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out when the server says the token is dead", async () => {
    tokens.save("access", "refresh");
    meError = answer(401);
    render(<AppLayout><p>my closet</p></AppLayout>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(tokens.isLoggedIn()).toBe(false);
  });

  it("signs this tab out when another tab signs out", async () => {
    tokens.save("access", "refresh");
    render(<AppLayout><p>my closet</p></AppLayout>);
    expect(screen.getByText("my closet")).toBeInTheDocument();

    act(() => tokens.clear());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
