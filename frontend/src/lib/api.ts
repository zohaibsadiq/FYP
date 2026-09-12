/**
 * The single place where the frontend talks to Django.
 *
 * Nothing in the app calls axios directly - everything goes through `api`.
 * That means we configure the base URL and the login token ONCE, here, instead
 * of repeating it in every component.
 *
 * Two automatic behaviours are set up below:
 *
 *  1. REQUEST interceptor  - attaches "Authorization: Bearer <token>" to every
 *                            outgoing request, so we never forget it.
 *
 *  2. RESPONSE interceptor - if Django replies 401 (token expired), it quietly
 *                            swaps the refresh token for a new access token and
 *                            retries the original request. The user sees nothing.
 */

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

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000, // 30s. Raised later for the try-on endpoint, which is slow.
});

// ---------------------------------------------------------------------------
// 1. Attach the token to every request
// ---------------------------------------------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokens.getAccess();
  if (access) {
    config.headers = config.headers ?? new AxiosHeaders();
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

// ---------------------------------------------------------------------------
// 2. Refresh the token automatically when it expires
// ---------------------------------------------------------------------------

/**
 * If five requests fail at the same moment, we must NOT fire five refresh
 * calls. We keep one promise in flight and let everyone wait on it.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.getRefresh();
  if (!refresh) throw new Error("No refresh token");

  // Plain axios, not `api` - otherwise this call would be intercepted too
  // and we would loop forever.
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_BASE_URL}/api/auth/refresh/`,
    { refresh },
    { headers: { "Content-Type": "application/json" } },
  );

  tokens.saveAccess(data.access);
  // ROTATE_REFRESH_TOKENS is on in Django, so a new refresh token comes back too
  if (data.refresh) tokens.save(data.access, data.refresh);
  return data.access;
}

/** Marker so we only ever retry a request once. */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    const isAuthCall =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh");

    // Only try to refresh on a 401, only once, and never for the login call
    // itself (a 401 there just means "wrong password").
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
        // Refresh token is dead too - the session is genuinely over.
        tokens.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * Turns any Django/axios error into one readable sentence we can put in a toast.
 *
 * Django sends validation errors like:
 *   { "email": ["An account with this email already exists."] }
 * and general errors like:
 *   { "detail": "Not found." }
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  if (!error.response) {
    return "Cannot reach the server. Is the Django backend running on port 8000?";
  }

  const data = error.response.data as ApiFieldErrors & { detail?: string };
  if (typeof data === "string") return data;
  if (data?.detail) return data.detail;

  // Take the first field error we find
  const firstKey = Object.keys(data ?? {})[0];
  if (firstKey) {
    const value = data[firstKey];
    const message = Array.isArray(value) ? value[0] : value;
    if (message) return String(message);
  }

  return fallback;
}

/**
 * Pulls out per-field errors so a form can show them under the right input.
 * Example result: { email: "An account with this email already exists." }
 */
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
