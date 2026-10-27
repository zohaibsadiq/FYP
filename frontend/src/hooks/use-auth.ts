"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { plannerKeys } from "@/hooks/use-planner";
import { api, gotNoAnswer } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import type { AuthResponse, LoginPayload, RegisterPayload, User } from "@/types";

const ME_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser(): UseQueryResult<User> {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me/");
      return data;
    },
    enabled: tokens.isLoggedIn(),
    staleTime: 5 * 60 * 1000,
    // A refusal means signed out, and asking again gives the same refusal. No
    // answer at all is usually the server waking up, so that gets one more try.
    retry: (failureCount, error) => gotNoAnswer(error) && failureCount < 2,
  });
}

/** Sends somebody who is already signed in past the sign-in pages. */
export function useSkipIfSignedIn() {
  const router = useRouter();
  useEffect(() => {
    if (tokens.isLoggedIn()) router.replace("/dashboard");
  }, [router]);
}

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
      // Login already returns the account details, so storing them here saves
      // a second request to /auth/me/.
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      router.push("/dashboard");
    },
  });
}

export function useRegister() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await api.post<AuthResponse>("/auth/register/", payload);
      return data;
    },
    onSuccess: (data) => {
      tokens.save(data.access, data.refresh);
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      router.push("/dashboard");
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<User>) => {
      const { data } = await api.patch<User>("/auth/me/", payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ME_QUERY_KEY, data);
      // The city decides which weather is shown, so a saved profile has to
      // drop the reading that was fetched for the old one.
      queryClient.invalidateQueries({ queryKey: plannerKeys.all });
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    tokens.clear();
    queryClient.clear();
    router.push("/login");
  };
}
