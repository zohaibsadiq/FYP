import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WakingNotice } from "./waking-notice";
import { NOTICE_AFTER_MS } from "@/lib/wake";

const wakeBackend = vi.fn();

vi.mock("@/lib/wake", async () => {
  const real = await vi.importActual<typeof import("@/lib/wake")>("@/lib/wake");
  return { ...real, wakeBackend: (signal?: AbortSignal) => wakeBackend(signal) };
});

/** Moving the clock forward changes state, so it goes through act like a click. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** A promise this test decides when to settle, standing in for the server. */
function pending<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  wakeBackend.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WakingNotice", () => {
  it("knocks on the server as soon as it is on screen", () => {
    wakeBackend.mockReturnValue(pending<boolean>().promise);
    render(<WakingNotice />);
    expect(wakeBackend).toHaveBeenCalledTimes(1);
  });

  it("says nothing at all while the server answers quickly", async () => {
    wakeBackend.mockResolvedValue(true);
    const { container } = render(<WakingNotice />);

    await waitFor(() => expect(wakeBackend).toHaveBeenCalled());
    advance(NOTICE_AFTER_MS + 500);

    expect(container).toBeEmptyDOMElement();
  });

  it("speaks up once the wait is long enough to look broken", async () => {
    wakeBackend.mockReturnValue(pending<boolean>().promise);
    render(<WakingNotice />);

    // Nothing yet: a warm server must never make this flash up.
    advance(NOTICE_AFTER_MS - 500);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    advance(1000);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/starting the server up/i),
    );
  });

  it("says roughly how long, so nobody gives up too early", async () => {
    wakeBackend.mockReturnValue(pending<boolean>().promise);
    render(<WakingNotice />);
    advance(NOTICE_AFTER_MS + 100);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/up to a minute/i),
    );
  });

  it("goes away once the server is up", async () => {
    const server = pending<boolean>();
    wakeBackend.mockReturnValue(server.promise);
    render(<WakingNotice />);

    advance(NOTICE_AFTER_MS + 100);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    server.settle(true);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("also goes away when the server cannot be reached, leaving the page to explain", async () => {
    const server = pending<boolean>();
    wakeBackend.mockReturnValue(server.promise);
    render(<WakingNotice />);

    advance(NOTICE_AFTER_MS + 100);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    server.settle(false);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("is announced to a screen reader rather than only drawn", async () => {
    wakeBackend.mockReturnValue(pending<boolean>().promise);
    render(<WakingNotice />);
    advance(NOTICE_AFTER_MS + 100);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite"),
    );
  });
});
