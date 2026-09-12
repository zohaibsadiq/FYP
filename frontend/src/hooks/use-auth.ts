"use client";

/**
 * All auth logic in one file, exposed as React Query hooks.
 *
 * Why React Query instead of plain useState + useEffect?
 *  - It caches the user, so the navbar does not refetch on every page change.
 *  - It gives us isPending / isError for free, so we write no loading flags.
 *  - invalidateQueries() refreshes data everywhere at once after an update.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import type { AuthResponse, LoginPayload, RegisterPayload, User } from "@/types";

/** One constant key so we never mistype the cache key in two places. */
export const ME_QUERY_KEY = ["auth", "me"] as const;

// ---------------------------------------------------------------------------
// Read the logged-in user
// ---------------------------------------------------------------------------

export function useCurrentUser(): UseQueryResult<User> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me/");
      return data;
    },
    // Do not even try if there is no token - avoids a pointless 401 on first load
    enabled: tokens.isLoggedIn(),
    staleTime: 5 * 60 * 1000, // treat as fresh for 5 minutes
    retry: false, // a failed /me/ means "not logged in", retrying will not help
  });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await api.post<AuthResponse>("/auth/login/", payload);
      return data;
    },
    onSuccess: (data) => {
      tokens.save(data.access, data.refresh);
      // Put the user straight into the cache so the dashboard renders instantly
      // instead of showing a loading spinner.
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      router.push("/dashboard");
    },
  });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await api.post<AuthResponse>("/auth/register/", payload);
      return data;
    },
    onSuccess: (data) => {
      // Django already returned tokens, so signup logs you straight in.
      tokens.save(data.access, data.refresh);
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      router.push("/dashboard");
    },
  });
}

// ---------------------------------------------------------------------------
// Update my profile (city, name, body photo)
// ---------------------------------------------------------------------------

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<User>) => {
      const { data } = await api.patch<User>("/auth/me/", payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
    },
  });
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    tokens.clear();
    queryClient.clear(); // wipe cached data so the next user sees nothing of ours
    router.push("/login");
  };
}
