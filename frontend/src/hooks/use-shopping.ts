"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Paginated } from "@/types";
import type {
  Deal,
  DealFilters,
  FilterOptions,
  Freshness,
  PriceChange,
} from "@/types/shopping";

// Hierarchical, so invalidating ["shopping"] clears everything below it while
// invalidating ["shopping","deals"] leaves the filter choices cached.
export const shoppingKeys = {
  all: ["shopping"] as const,
  deals: () => [...shoppingKeys.all, "deals"] as const,
  dealList: (filters: DealFilters) => [...shoppingKeys.deals(), filters] as const,
  deal: (id: number) => [...shoppingKeys.deals(), id] as const,
  priceHistory: (id: number) => [...shoppingKeys.deal(id), "prices"] as const,
  freshness: () => [...shoppingKeys.all, "freshness"] as const,
  filters: () => [...shoppingKeys.all, "filters"] as const,
};

// Prices are refreshed by a job that runs a couple of times a day, so asking
// again the moment a tab regains focus would only burn a request.
const HALF_AN_HOUR = 30 * 60 * 1000;

function cleanParams(filters: DealFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  );
}

export function useDeals(filters: DealFilters = {}) {
  return useInfiniteQuery({
    queryKey: shoppingKeys.dealList(filters),
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<Paginated<Deal>>("/shopping/deals/", {
        params: { ...cleanParams(filters), page: pageParam },
      });
      return data;
    },
    initialPageParam: 1,
    // The envelope gives a link rather than a number, so the page after the
    // one just loaded is however many have been loaded, plus one.
    getNextPageParam: (last, loaded) => (last.next ? loaded.length + 1 : undefined),
    // Without this the grid empties on every filter change and the page jumps
    // back to the top while the next answer is on its way.
    placeholderData: keepPreviousData,
    staleTime: HALF_AN_HOUR,
  });
}

export function useFreshness() {
  return useQuery({
    queryKey: shoppingKeys.freshness(),
    queryFn: async () => {
      const { data } = await api.get<Freshness>("/shopping/freshness/");
      return data;
    },
    staleTime: HALF_AN_HOUR,
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: shoppingKeys.filters(),
    queryFn: async () => {
      const { data } = await api.get<FilterOptions>("/shopping/filters/");
      return data;
    },
    staleTime: HALF_AN_HOUR,
  });
}

export function usePriceHistory(id: number | null) {
  return useQuery({
    queryKey: shoppingKeys.priceHistory(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<PriceChange[]>(`/shopping/deals/${id}/price-history/`);
      return data;
    },
    enabled: id !== null,
  });
}
