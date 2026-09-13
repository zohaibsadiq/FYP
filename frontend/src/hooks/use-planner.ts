"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import { wardrobeKeys } from "@/hooks/use-wardrobe";
import type { Paginated } from "@/types";
import type {
  ConfirmedPlan,
  PlanDay,
  PlanPayload,
  PlannedOutfit,
  TodayPlan,
} from "@/types/planner";

export const plannerKeys = {
  all: ["planner"] as const,
  today: () => [...plannerKeys.all, "today"] as const,
  plans: () => [...plannerKeys.all, "plans"] as const,
  month: (from: string, to: string) => [...plannerKeys.plans(), "month", from, to] as const,
  day: (date: string) => [...plannerKeys.plans(), "day", date] as const,
};

/**
 * The weather and what suits it. Held for half an hour, the same as the server
 * holds its own copy, so moving between screens does not refetch it.
 */
export function usePlannerToday() {
  return useQuery({
    queryKey: plannerKeys.today(),
    queryFn: async () => {
      const { data } = await api.get<TodayPlan>("/planner/today/");
      return data;
    },
    enabled: tokens.isLoggedIn(),
    staleTime: 30 * 60 * 1000,
  });
}

/** Which days in a range have something planned, without their contents. */
export function usePlanMonth(from: string, to: string) {
  return useQuery({
    queryKey: plannerKeys.month(from, to),
    queryFn: async () => {
      const { data } = await api.get<PlanDay[]>("/planner/outfits/calendar/", {
        params: { since: from, until: to },
      });
      return data;
    },
    enabled: tokens.isLoggedIn(),
    placeholderData: keepPreviousData,
  });
}

/** The plan for one day, or null when that day is still free. */
export function usePlanForDay(date: string | null) {
  return useQuery({
    queryKey: plannerKeys.day(date ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Paginated<PlannedOutfit>>("/planner/outfits/", {
        params: { on: date },
      });
      return data.results[0] ?? null;
    },
    enabled: Boolean(date),
  });
}

/** Everything a plan touches, in one place, so the three hooks below agree. */
function refreshPlans(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: plannerKeys.all });
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.items() });
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.stats() });
  queryClient.invalidateQueries({ queryKey: wardrobeKeys.wears() });
}

export function useSavePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: PlanPayload & { id?: number }) => {
      const { data } = id
        ? await api.patch<PlannedOutfit>(`/planner/outfits/${id}/`, payload)
        : await api.post<PlannedOutfit>("/planner/outfits/", payload);
      return data;
    },
    onSuccess: () => refreshPlans(queryClient),
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/planner/outfits/${id}/`);
      return id;
    },
    onSuccess: () => refreshPlans(queryClient),
  });
}

/** Confirms the plan really was worn, which writes that day into the wear log. */
export function useConfirmWorn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<ConfirmedPlan>(`/planner/outfits/${id}/wore-it/`);
      return data;
    },
    onSuccess: () => refreshPlans(queryClient),
  });
}
