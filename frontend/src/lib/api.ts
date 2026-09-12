import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

import { tokens } from "./tokens";
import type { ApiFieldErrors } from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// No default Content-Type here. Axios picks application/json for plain objects
// on its own, but a preset header makes it serialise FormData to JSON, and image
// uploads then arrive empty with no error anywhere.
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

// The access token lasts 60 minutes, so it lapses between page views rather than
// mid-request, and the first burst of calls afterwards comes back 401 together.
// Refreshing once per failure would fire one refresh call per 401, and since
// ROTATE_REFRESH_TOKENS is on every one of those mints another refresh token,
// leaving whichever response lands last as the stored pair. One promise held here
// turns a burst into a single refresh that the other callers wait on.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.getRefresh();
  if (!refresh) throw new Error("No refresh token");

  // Bare axios: going through `api` would re-enter the interceptor below.
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

    // A 401 from these three means bad credentials or a dead refresh token, and
    // refreshing would only produce another 401.
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
