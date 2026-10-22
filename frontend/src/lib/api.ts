import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { tokens } from "./tokens";
import type { ApiFieldErrors } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// No default Content-Type here, on purpose. Axios picks application/json for
// plain objects by itself, but a preset header makes it turn a photo upload
// (FormData) into JSON, and the photo then arrives empty with no error anywhere.
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokens.getAccess();
  if (access) {
    config.headers = config.headers ?? new AxiosHeaders();
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

// The sign-in token lasts 60 minutes, so it usually runs out between page views.
// The next page then fires several requests at once and they all come back 401
// together. Refreshing once per failure would ask for a new token several times
// at once, and because every refresh also replaces the refresh token, whichever
// answer landed last would win and the others would be dead. One shared promise
// turns the burst into a single refresh that every caller waits on.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.getRefresh();
  if (!refresh) throw new Error("No refresh token");

  // Plain axios here. Going through `api` would run the 401 handler below on
  // the refresh call itself.
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_BASE_URL}/api/auth/refresh/`,
    { refresh },
    { headers: { "Content-Type": "application/json" } },
  );

  tokens.saveAccess(data.access);
  if (data.refresh) tokens.save(data.access, data.refresh);
  return data.access;
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // A 401 from these three means the password was wrong or the refresh token
    // is dead. Refreshing would only produce another 401.
    const isAuthCall =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshInFlight = refreshInFlight ?? refreshAccessToken();
        const newAccess = await refreshInFlight;
        refreshInFlight = null;

        original.headers = {
          ...(original.headers as Record<string, string>),
          Authorization: `Bearer ${newAccess}`,
        };
        return api.request(original);
      } catch {
        refreshInFlight = null;
        tokens.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  },
);

/** Flattens any error from the API into a single sentence for a toast. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (!error.response) {
    return "Cannot reach the server. Check the connection and try again.";
  }

  const data = error.response.data as ApiFieldErrors & { detail?: string };
  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;

  const firstKey = Object.keys(data ?? {})[0];
  if (firstKey) {
    const value = data[firstKey];
    const message = Array.isArray(value) ? value[0] : value;
    if (message) return String(message);
  }

  return fallback;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || !error.response) return {};

  const data = error.response.data as ApiFieldErrors;
  if (typeof data !== "object" || data === null) return {};

  const result: Record<string, string> = {};
  for (const [field, value] of Object.entries(data)) {
    if (field === "detail") continue;
    result[field] = Array.isArray(value) ? String(value[0]) : String(value);
  }
  return result;
}

// The server's wording when a save names a row that no longer exists. Example:
// a dropdown filled a minute ago still offers a drawer that was deleted since,
// because lists are kept for a minute without being re-read.
const STALE_CHOICE = /invalid pk|object does not exist/i;

/** True when a save was refused because something it pointed at has been removed. */
export function isStaleChoiceError(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 400) return false;

  const data = error.response.data;
  if (typeof data !== "object" || data === null) return false;

  return Object.values(data).some((value) =>
    (Array.isArray(value) ? value : [value]).some((message) =>
      STALE_CHOICE.test(String(message)),
    ),
  );
}
