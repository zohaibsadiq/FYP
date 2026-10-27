import axios, { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, getErrorMessage, getFieldErrors, gotNoAnswer, isSignedOutAnswer, isStaleChoiceError } from "./api";
import { tokens } from "./tokens";

function apiError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config as never, null, {
    status,
    statusText: "",
    data,
    headers: new AxiosHeaders(),
    config: config as never,
  });
}

describe("isStaleChoiceError", () => {
  it("spots a dropdown row the server no longer has", () => {
    const error = apiError(400, { parent: ['Invalid pk "8" - object does not exist.'] });

    expect(isStaleChoiceError(error)).toBe(true);
  });

  it("spots it on a garment's storage location too", () => {
    const error = apiError(400, {
      storage_location: ['Invalid pk "12" - object does not exist.'],
    });

    expect(isStaleChoiceError(error)).toBe(true);
  });

  it("leaves an ordinary validation error alone", () => {
    const error = apiError(400, { name: ["This field may not be blank."] });

    expect(isStaleChoiceError(error)).toBe(false);
  });

  it("ignores a server fault", () => {
    expect(isStaleChoiceError(apiError(500, "Server Error"))).toBe(false);
  });

  it("ignores anything that is not a request failure", () => {
    expect(isStaleChoiceError(new Error("offline"))).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("reads DRF's detail key", () => {
    expect(getErrorMessage(apiError(403, { detail: "Not allowed." }))).toBe("Not allowed.");
  });

  it("falls back to the first field message", () => {
    expect(getErrorMessage(apiError(400, { name: ["This field is required."] }))).toBe(
      "This field is required.",
    );
  });

  it("names the connection when no response came back", () => {
    expect(getErrorMessage(new AxiosError("Network Error", "ERR_NETWORK"))).toMatch(
      /cannot reach the server/i,
    );
  });
});

describe("getFieldErrors", () => {
  it("flattens each field to one sentence and drops detail", () => {
    const error = apiError(400, {
      detail: "Invalid input.",
      name: ["This field is required.", "Too short."],
      category: ["Choose one."],
    });

    expect(getFieldErrors(error)).toEqual({
      name: "This field is required.",
      category: "Choose one.",
    });
  });
});


describe("isSignedOutAnswer and gotNoAnswer", () => {
  it("treats only a 401 as signed out", () => {
    expect(isSignedOutAnswer(apiError(401, { detail: "Token is invalid or expired" }))).toBe(true);
    expect(isSignedOutAnswer(apiError(500, "Server Error"))).toBe(false);
    expect(isSignedOutAnswer(new Error("boom"))).toBe(false);
  });

  it("knows a timeout from a refusal", () => {
    expect(gotNoAnswer(new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED"))).toBe(true);
    expect(gotNoAnswer(apiError(401, {}))).toBe(false);
  });
});

describe("the silent token refresh", () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
    tokens.save("old-access", "old-refresh");
    // Every request through `api` answers 401, as an expired token would.
    api.defaults.adapter = async (config) =>
      Promise.reject(
        new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
          status: 401,
          statusText: "",
          data: { detail: "Token is invalid or expired" },
          headers: new AxiosHeaders(),
          config,
        }),
      );
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("keeps the tokens when the refresh call gets no answer", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new AxiosError("timeout of 30000ms exceeded", "ECONNABORTED"));

    await expect(api.get("/auth/me/")).rejects.toMatchObject({ code: "ECONNABORTED" });
    expect(tokens.getRefresh()).toBe("old-refresh");
  });

  it("clears the tokens when the refresh token itself is refused", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(apiError(401, { detail: "Token is blacklisted" }));

    await expect(api.get("/auth/me/")).rejects.toBeTruthy();
    expect(tokens.isLoggedIn()).toBe(false);
  });
});
