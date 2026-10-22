"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paginated } from "@/types";
import type {
  CircleStats,
  Friend,
  FriendRequest,
  GarmentToBorrow,
  Loan,
  MyCode,
  Waiting,
} from "@/types/friends";

// Keys are nested like folders, so agreeing to lend something clears the
// friend list, the loans and the header numbers in one call.
const friendKeys = {
  all: ["friends"] as const,
  list: () => [...friendKeys.all, "list"] as const,
  requests: () => [...friendKeys.all, "requests"] as const,
  code: () => [...friendKeys.all, "code"] as const,
  loans: () => [...friendKeys.all, "loans"] as const,
  stats: () => [...friendKeys.all, "stats"] as const,
  closet: (id: number) => [...friendKeys.all, "closet", id] as const,
};

/** The server sends lists in pages; every caller here only wants the rows. */
function rows<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export function useMyFriendCode() {
  return useQuery({
    queryKey: friendKeys.code(),
    queryFn: async () => (await api.get<MyCode>("/friends/my-code/")).data,
  });
}

export function useNewFriendCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<MyCode>("/friends/my-code/")).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.code() }),
  });
}

export function useFriends() {
  return useQuery({
    queryKey: friendKeys.list(),
    queryFn: async () => rows((await api.get<Paginated<Friend>>("/friends/")).data),
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: friendKeys.requests(),
    queryFn: async () =>
      rows((await api.get<Paginated<FriendRequest>>("/friends/requests/")).data),
  });
}

export function useCircleStats() {
  return useQuery({
    queryKey: friendKeys.stats(),
    queryFn: async () => (await api.get<CircleStats>("/friends/stats/")).data,
  });
}

/** Only ever called once a friend has actually opened their closet. */
export function useFriendCloset(friendId: number | null) {
  return useQuery({
    queryKey: friendKeys.closet(friendId ?? 0),
    queryFn: async () =>
      (await api.get<GarmentToBorrow[]>(`/friends/${friendId}/closet/`)).data,
    enabled: friendId !== null,
  });
}

export function useLoans() {
  return useQuery({
    queryKey: friendKeys.loans(),
    queryFn: async () => rows((await api.get<Paginated<Loan>>("/friends/loans/")).data),
  });
}

/** Everything below changes more than one list, so all of them are refreshed. */
function useCircleAction<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.all }),
  });
}

export function useAskToBeFriends() {
  return useCircleAction(async (code: string) => {
    const { data } = await api.post<FriendRequest>("/friends/requests/by-code/", { code });
    return data;
  });
}

export function useAnswerFriendRequest() {
  return useCircleAction(
    async ({ id, answer, nickname }: { id: number; answer: "accept" | "decline"; nickname?: string }) => {
      const body = answer === "accept" ? { nickname: nickname ?? "" } : {};
      const { data } = await api.post(`/friends/requests/${id}/${answer}/`, body);
      return data;
    },
  );
}

export function useUpdateFriend() {
  return useCircleAction(
    async ({ id, ...changes }: { id: number; nickname?: string; blocked?: boolean }) => {
      const { data } = await api.patch<Friend>(`/friends/${id}/`, changes);
      return data;
    },
  );
}

export function useRemoveFriend() {
  return useCircleAction(async (id: number) => {
    await api.delete(`/friends/${id}/`);
  });
}

export function useAskToBorrow() {
  return useCircleAction(
    async ({
      itemId,
      ...body
    }: {
      itemId: number;
      borrow_from: string;
      borrow_until: string;
      message?: string;
    }) => {
      const { data } = await api.post<Loan>(`/friends/loans/ask/${itemId}/`, body);
      return data;
    },
  );
}

export function useAnswerLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      answer,
    }: {
      id: number;
      answer: "agree" | "decline" | "returned" | "cancel";
    }) => {
      const { data } = await api.post(`/friends/loans/${id}/${answer}/`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendKeys.all });
      // Agreeing or taking something back moves the item's status, so the
      // closet and its counts are stale too.
      queryClient.invalidateQueries({ queryKey: ["wardrobe"] });
    },
  });
}

/**
 * Asked again every minute and whenever the tab comes back into focus. This is
 * the only request in the app that repeats by itself. It returns counts only,
 * no names, because it runs for everybody signed in and almost always answers
 * zero.
 */
export function useWaiting() {
  return useQuery({
    queryKey: [...friendKeys.all, "waiting"] as const,
    queryFn: async () => (await api.get<Waiting>("/auth/waiting/")).data,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    // A failed poll should never show an error; the badge simply stays as it was.
    retry: false,
  });
}
