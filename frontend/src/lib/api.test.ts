import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { getErrorMessage, getFieldErrors, isStaleChoiceError } from "./api";

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
