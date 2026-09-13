"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { tokens } from "@/lib/tokens";
import type { TodayPlan } from "@/types/planner";

export const plannerKeys = {
  all: ["planner"] as const,
  today: () => [...plannerKeys.all, "today"] as const,
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
